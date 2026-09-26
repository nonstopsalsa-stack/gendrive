$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_v196_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9263
Write-Host "Starting Edge in headless mode on port $port..."
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--window-size=2560,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  Write-Host "Connecting to page: $fileUrl"
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $wsUrl = $page.webSocketDebuggerUrl
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $uri = New-Object System.Uri($wsUrl)
  $ws.ConnectAsync($uri, $ct).Wait()
  Write-Host "WebSocket CDP connected successfully."

  $script:msgId = 0
  function Exec-Js($code) {
    $cmd = @{
      id = [System.Threading.Interlocked]::Increment([ref]$script:msgId)
      method = "Runtime.evaluate"
      params = @{
        expression = $code
        returnByValue = $true
        awaitPromise = $true
      }
    } | ConvertTo-Json -Compress

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

    $buf = New-Object byte[] 2097152
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.exceptionDetails) {
      Write-Host "JS EXCEPTION: $($json.result.exceptionDetails | ConvertTo-Json -Depth 3)" -ForegroundColor Red
    }
    return $json.result.result.value
  }

  $testScript = @"
(async () => {
  const tests = [];
  function assert(name, condition, extra = '') {
    tests.push({ name, pass: Boolean(condition), extra: String(extra) });
  }

  window.confirm = () => true;
  window.alert = () => {};
  window.prompt = () => null;

  let retries = 0;
  while ((typeof migrateHabit === 'undefined' || typeof sanitizeDailyState === 'undefined' || typeof renderTableAnalyticsView === 'undefined' || typeof state === 'undefined') && retries < 50) {
    await new Promise(r => setTimeout(r, 200));
    retries++;
  }

  // 1. Version Check
  assert("Test 1: Version check - APP_VERSION is >= v1.9.6", typeof APP_VERSION !== 'undefined' && APP_VERSION >= 'v1.9.6', typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined');

  // 2. Test 2: Ghost In-Progress Habit Sanitization (1037 min = 17.28 hrs ago)
  const yesterdayNoon = Date.now() - (1037 * 60 * 1000);
  const ghostHabit = {
    id: 'H088_GHOST',
    name: '起床時 歯磨き (ゴースト再現テスト)',
    status: 'in_progress',
    startTimestamp: yesterdayNoon,
    accumulatedSeconds: 0,
    targetMin: 2,
    targetTimes: 1,
    history: {},
    executionLogs: []
  };

  state.habits = [ghostHabit];
  state.activeHabitId = 'H088_GHOST';

  // Run sanitizeDailyState
  sanitizeDailyState();

  assert("Test 2A: sanitizeDailyState resets 1037-min habit to uncompleted", ghostHabit.status === 'uncompleted', "Status was: " + ghostHabit.status);
  assert("Test 2B: startTimestamp cleared to null", ghostHabit.startTimestamp === null, "startTimestamp was: " + ghostHabit.startTimestamp);
  assert("Test 2C: state.activeHabitId cleared to null", state.activeHabitId === null, "activeHabitId was: " + state.activeHabitId);

  // Test migrateHabit also sanitizes past-day running habit
  const ghostHabit2 = {
    id: 'H088_GHOST2',
    name: '起床時 歯磨き2',
    status: 'in_progress',
    startTimestamp: yesterdayNoon,
    accumulatedSeconds: 0,
    targetMin: 2,
    targetTimes: 1,
    history: {}
  };
  const migratedGhost = migrateHabit(ghostHabit2, 0);
  assert("Test 2D: migrateHabit resets past-day running habit to uncompleted", migratedGhost.status === 'uncompleted', "Status was: " + migratedGhost.status);
  assert("Test 2E: migrateHabit clears startTimestamp", migratedGhost.startTimestamp === null, "startTimestamp was: " + migratedGhost.startTimestamp);

  // 3. Test 3: Auto-Salvage of 2026-09-22, 2026-09-23, AND 2026-09-24
  const streakTestHabit = {
    id: 'H_STREAK_RESTORE',
    name: '30-Day Consecutive Habit',
    targetTimes: 1,
    targetMin: 5,
    history: {},
    executionLogs: []
  };

  for (let d = 25; d <= 31; d++) {
    streakTestHabit.history['2026-08-' + String(d).padStart(2, '0')] = { done: true, count: 1 };
  }
  for (let d = 1; d <= 21; d++) {
    streakTestHabit.history['2026-09-' + String(d).padStart(2, '0')] = { done: true, count: 1 };
  }

  const migratedHabit = migrateHabit(streakTestHabit, 1);

  assert("Test 3A: 2026-09-22 is auto-salvaged", Boolean(migratedHabit.history['2026-09-22'] && migratedHabit.history['2026-09-22'].done));
  assert("Test 3B: 2026-09-23 is auto-salvaged", Boolean(migratedHabit.history['2026-09-23'] && migratedHabit.history['2026-09-23'].done));
  assert("Test 3C: 2026-09-24 (yesterday) is auto-salvaged", Boolean(migratedHabit.history['2026-09-24'] && migratedHabit.history['2026-09-24'].done));

  const streak = getHabitCurrentStreak(migratedHabit);
  assert("Test 3D: Habit current streak is at least 30 days", streak >= 30, "Streak was: " + streak);

  // 4. Test 4: Recurring Task Salvage for 2026-09-24
  const recTask = {
    id: 'T_REC_TEST',
    title: 'Recurring Task Test',
    type: 'recurring',
    history: [
      { date: '2026-09-20', durationMin: 15 },
      { date: '2026-09-21', durationMin: 15 }
    ]
  };
  const sanitizedTasks = sanitizeTasksDates([recTask]);
  const taskDates = sanitizedTasks[0].history.map(h => typeof h === 'object' ? h.date : h);
  assert("Test 4A: Recurring task history includes 2026-09-24", taskDates.includes('2026-09-24'), "Dates: " + taskDates.join(','));
  const taskStreak = getTaskCurrentStreak(sanitizedTasks[0]);
  assert("Test 4B: Recurring task streak is >= 5", taskStreak >= 5, "Task streak was: " + taskStreak);

  // 5. Test 5: Cloud Deep Merge Zero-Zombie for Past-Day in_progress
  const cloudHabits = [{
    id: 'H_CLOUD_OLD',
    name: 'Old Cloud Habit',
    status: 'in_progress',
    startTimestamp: yesterdayNoon,
    history: {}
  }];
  const localHabits = [{
    id: 'H_CLOUD_OLD',
    name: 'Old Cloud Habit',
    status: 'uncompleted',
    history: {}
  }];
  const mergedHabits = mergeHabitsDeep(localHabits, cloudHabits);
  assert("Test 5A: Past-day in_progress from cloud merges as uncompleted", mergedHabits[0].status === 'uncompleted', "Status was: " + mergedHabits[0].status);

  // 6. Test 6: Scoreboard KPI & DOM Render
  state.habits = [migratedHabit];
  state.masterSubtab = 'analytics';
  if (typeof renderTableAnalyticsView === 'function') renderTableAnalyticsView();
  const maxStreakValueEl = document.querySelector('#analytics-kpi-row .analytics-kpi-card:nth-child(2) .kpi-value');
  const maxStreakValue = maxStreakValueEl ? maxStreakValueEl.textContent.trim() : '';
  assert("Test 6A: Scoreboard KPI displays 30+ days streak", maxStreakValue.includes('30') || maxStreakValue.includes('31'), "KPI streak was: " + maxStreakValue);

  return tests;
})()
"@

  Write-Host "Executing in-browser test script..."
  $results = Exec-Js $testScript
  if (-not $results) {
    Write-Host "Result is null or empty!" -ForegroundColor Red
    exit 1
  }

  $allPass = $true
  Write-Host "`n====================== TEST RESULTS ======================" -ForegroundColor Cyan
  foreach ($t in $results) {
    if ($t.pass) {
      Write-Host "  [PASS] $($t.name)" -ForegroundColor Green
    } else {
      Write-Host "  [FAIL] $($t.name) - Extra: $($t.extra)" -ForegroundColor Red
      $allPass = $false
    }
  }
  Write-Host "==========================================================`n" -ForegroundColor Cyan

  if ($allPass) {
    Write-Host "ALL TESTS PASSED SUCCESSFULLY! (100% PASS)" -ForegroundColor Green
    exit 0
  } else {
    Write-Host "SOME TESTS FAILED!" -ForegroundColor Red
    exit 1
  }

} finally {
  if ($ws -and $ws.State -eq 'Open') { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $ct).Wait() }
  if ($edge) { Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue }
  if (Test-Path $tempDir) { Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue }
}
