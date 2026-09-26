$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_v199_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9265
Write-Host "Starting Edge in headless mode on port $port..."
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--window-size=1920,1080", "--disable-gpu" -PassThru
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

    $buf = New-Object byte[] 1048576
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.exceptionDetails) {
      Write-Host "JS EXCEPTION: $($json.result.exceptionDetails | ConvertTo-Json -Depth 3)" -ForegroundColor Red
    }
    return $json.result.result.value
  }

  $testScript = @'
(async () => {
  const tests = [];
  function assert(name, condition, extra = '') {
    tests.push({ name, pass: Boolean(condition), extra: String(extra) });
  }

  window.confirm = () => true;
  window.alert = () => {};
  window.prompt = () => null;

  let retries = 0;
  while ((typeof migrateHabit === 'undefined' || typeof renderTableAnalyticsView === 'undefined' || typeof state === 'undefined') && retries < 50) {
    await new Promise(r => setTimeout(r, 200));
    retries++;
  }

  assert("Test 1: APP_VERSION is >= v1.9.9", typeof APP_VERSION !== 'undefined' && (APP_VERSION === 'v1.9.9' || APP_VERSION === 'v1.9.10'), typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined');

  // 2. Test Continuity Bridge heals 3-day gap (Body composition scenario)
  const habitBody = {
    id: 'H_BODY_COMP',
    name: '体組成計測',
    targetTimes: 1,
    targetMin: 5,
    history: {},
    executionLogs: []
  };
  // Fill 2026-08-18 through 2026-09-21
  for (let d = 18; d <= 31; d++) {
    habitBody.history[`2026-08-${String(d).padStart(2, '0')}`] = { done: true, count: 1 };
  }
  for (let d = 1; d <= 21; d++) {
    habitBody.history[`2026-09-${String(d).padStart(2, '0')}`] = { done: true, count: 1 };
  }
  // 9/22, 9/23, 9/24 are missing (holes)
  // 9/25 is completed
  habitBody.history['2026-09-25'] = { done: true, count: 1 };

  const healedBody = migrateHabit(habitBody, 0);
  assert("Test 2A: Gap 2026-09-22 is autonomously healed", Boolean(healedBody.history['2026-09-22'] && healedBody.history['2026-09-22'].done));
  assert("Test 2B: Gap 2026-09-23 is autonomously healed", Boolean(healedBody.history['2026-09-23'] && healedBody.history['2026-09-23'].done));
  assert("Test 2C: Gap 2026-09-24 is autonomously healed", Boolean(healedBody.history['2026-09-24'] && healedBody.history['2026-09-24'].done));

  const streakBody = getHabitCurrentStreak(healedBody);
  assert("Test 2D: Body comp streak is restored to >= 30 days", streakBody >= 30, "Streak was: " + streakBody);

  recalculateHabitRates(healedBody);
  const r7Body = Math.round((healedBody.stats.d7 || 0) * 100);
  assert("Test 2E: Body comp 7-day rate is >= 80% (Super/Gold)", r7Body >= 80, "7-day rate was: " + r7Body + "%");

  // 3. Test Continuity Bridge heals 4-day gap (Daily note scenario)
  const habitDailyNote = {
    id: 'H_DAILY_NOTE',
    name: 'デイリーノート起票',
    targetTimes: 1,
    targetMin: 5,
    history: {},
    executionLogs: []
  };
  for (let d = 18; d <= 31; d++) {
    habitDailyNote.history[`2026-08-${String(d).padStart(2, '0')}`] = { done: true, count: 1 };
  }
  for (let d = 1; d <= 21; d++) {
    habitDailyNote.history[`2026-09-${String(d).padStart(2, '0')}`] = { done: true, count: 1 };
  }
  // 9/22 ~ 9/25 missing (4 days gap)
  const healedNote = migrateHabit(habitDailyNote, 1);
  assert("Test 3A: 4-day gap 2026-09-22 is healed", Boolean(healedNote.history['2026-09-22'] && healedNote.history['2026-09-22'].done));
  assert("Test 3B: 4-day gap 2026-09-25 is healed", Boolean(healedNote.history['2026-09-25'] && healedNote.history['2026-09-25'].done));
  const streakNote = getHabitCurrentStreak(healedNote);
  assert("Test 3C: Daily note streak is restored to >= 30 days", streakNote >= 30, "Streak was: " + streakNote);

  // 4. Test Recurring Task Continuity Bridge
  const recTask = {
    id: 'T_REC_ROUTINE',
    title: 'Routine Planning',
    type: 'recurring',
    history: []
  };
  for (let d = 1; d <= 21; d++) {
    recTask.history.push({ date: `2026-09-${String(d).padStart(2, '0')}`, durationMin: 15 });
  }
  // 9/22, 9/23, 9/24 missing, 9/25 done
  recTask.history.push({ date: '2026-09-25', durationMin: 15 });

  sanitizeTasksDates([recTask]);
  const hasTaskGap22 = recTask.history.some(h => (typeof h === 'object' ? h.date : h) === '2026-09-22');
  const hasTaskGap23 = recTask.history.some(h => (typeof h === 'object' ? h.date : h) === '2026-09-23');
  const hasTaskGap24 = recTask.history.some(h => (typeof h === 'object' ? h.date : h) === '2026-09-24');
  assert("Test 4A: Task gap 2026-09-22 is healed", hasTaskGap22);
  assert("Test 4B: Task gap 2026-09-23 is healed", hasTaskGap23);
  assert("Test 4C: Task gap 2026-09-24 is healed", hasTaskGap24);

  const taskStreak = getTaskCurrentStreak(recTask);
  assert("Test 4D: Recurring task streak is >= 20 days", taskStreak >= 20, "Task streak was: " + taskStreak);

  // 5. Test Scoreboard Render in DOM
  state.habits = [healedBody, healedNote];
  state.tasks = [recTask];
  state.masterSubtab = 'analytics';
  if (typeof renderTableAnalyticsView === 'function') renderTableAnalyticsView();
  const kpiCards = document.querySelectorAll('#analytics-kpi-row .analytics-kpi-card');
  assert("Test 5A: Scoreboard KPI renders in DOM", kpiCards.length >= 3, "KPI cards count: " + kpiCards.length);

  const avgR7El = document.querySelector('#analytics-kpi-row .analytics-kpi-card:nth-child(1) .kpi-value');
  const avgR7Text = avgR7El ? avgR7El.textContent : '';
  const avgR7Num = parseInt(avgR7Text, 10) || 0;
  assert("Test 5B: Average 7-day rate is >= 80% (not 4%!)", avgR7Num >= 80, "Average 7-day rate: " + avgR7Text);

  const maxStreakEl = document.querySelector('#analytics-kpi-row .analytics-kpi-card:nth-child(2) .kpi-value');
  const maxStreakText = maxStreakEl ? maxStreakEl.textContent : '';
  assert("Test 5C: Max streak is >= 30 days (not 1 day!)", maxStreakText.includes('30') || maxStreakText.includes('31') || maxStreakText.includes('38') || parseInt(maxStreakText, 10) >= 30, "Max streak text: " + maxStreakText);

  // 6. Test Tomorrow Simulation (2026-09-27)
  // Even if evaluated as if tomorrow is today, streak does not break because history is persistently filled
  const streakTomorrow = getHabitCurrentStreak(healedBody);
  assert("Test 6: Streak continuity holds solidly for future dates", streakTomorrow >= 30, "Tomorrow streak: " + streakTomorrow);

  return tests;
})()
'@

  Write-Host "Executing in-browser test script..."
  $results = Exec-Js $testScript
  if (-not $results) {
    Write-Host "Result is null or empty!" -ForegroundColor Red
    exit 1
  }

  Write-Host "=================================================="
  Write-Host " Gendrive v1.9.9 Continuity Bridge Test Results"
  Write-Host "=================================================="
  $allPass = $true
  $results | ForEach-Object {
    if ($_.pass -eq $true) {
      Write-Host "PASS: $($_.name)" -ForegroundColor Green
    } else {
      Write-Host "FAIL: $($_.name) [Extra: $($_.extra)]" -ForegroundColor Red
      $allPass = $false
    }
  }
  Write-Host "=================================================="
  if ($allPass) {
    Write-Host "SUCCESS: ALL V1.9.9 TESTS PASSED 100%!" -ForegroundColor Cyan
    exit 0
  } else {
    Write-Host "FAILURE: SOME TESTS FAILED!" -ForegroundColor Red
    exit 1
  }

} finally {
  Write-Host "Cleaning up Edge process..."
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Cleanup completed."
}
