$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_scoreboard_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9262
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

  // 1. Version check
  assert("Version check: APP_VERSION is v1.9.5", typeof APP_VERSION !== 'undefined' && APP_VERSION === 'v1.9.5', typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined');

  // 2. Test migrateHabit auto-salvages 2026-09-22 and 2026-09-23
  const testHabit = {
    id: 'H_TEST_SALVAGE',
    name: 'Body Composition Test',
    targetTimes: 1,
    targetMin: 5,
    history: {
      '2026-09-20': { done: true, count: 1 },
      '2026-09-21': { done: true, count: 1 }
    },
    executionLogs: []
  };

  const migrated = migrateHabit(testHabit, 0);
  assert("Step 1: 2026-09-22 is auto-salvaged", Boolean(migrated.history['2026-09-22'] && migrated.history['2026-09-22'].done));
  assert("Step 1: 2026-09-23 is auto-salvaged", Boolean(migrated.history['2026-09-23'] && migrated.history['2026-09-23'].done));

  // 3. Test Streak Calculation for Salvaged Habit
  // Assuming today is 2026-09-24, if 2026-08-25 to 2026-09-23 are all done:
  const consecutiveHabit = {
    id: 'H_CONSECUTIVE',
    name: '29-Day Habit',
    targetTimes: 1,
    history: {},
    executionLogs: []
  };
  // Fill 2026-08-25 through 2026-09-21
  for (let d = 25; d <= 31; d++) {
    consecutiveHabit.history[`2026-08-${String(d).padStart(2, '0')}`] = { done: true, count: 1 };
  }
  for (let d = 1; d <= 21; d++) {
    consecutiveHabit.history[`2026-09-${String(d).padStart(2, '0')}`] = { done: true, count: 1 };
  }

  const migratedConsecutive = migrateHabit(consecutiveHabit, 1);
  const streak = getHabitCurrentStreak(migratedConsecutive);
  assert("Step 1: Salvaged consecutive habit streak is at least 29 days", streak >= 29, "Streak was: " + streak);

  // 4. Test recalculateHabitRates reflects restored streak
  recalculateHabitRates(migratedConsecutive);
  const r7 = Math.round((migratedConsecutive.stats.d7 || 0) * 100);
  const r30 = Math.round((migratedConsecutive.stats.d30 || 0) * 100);
  assert("Step 1: 7-day rate is >= 85%", r7 >= 85, "7-day rate was: " + r7 + "%");
  assert("Step 1: 30-day rate is >= 85%", r30 >= 85, "30-day rate was: " + r30 + "%");

  // 5. Test Recurring Task Streak with Object History & Array History
  const recTaskObj = {
    id: 'T_REC_OBJ',
    title: 'Recurring Task Object History',
    type: 'recurring',
    history: {
      '2026-09-22': { done: true },
      '2026-09-23': { done: true }
    }
  };
  const taskStreakObj = getTaskCurrentStreak(recTaskObj);
  assert("Step 2: Recurring task with object history calculates streak >= 2", taskStreakObj >= 2, "Task streak was: " + taskStreakObj);

  const recTaskArr = {
    id: 'T_REC_ARR',
    title: 'Recurring Task Array History',
    type: 'recurring',
    history: [
      { date: '2026-09-22', durationMin: 15 },
      { date: '2026-09-23', durationMin: 15 }
    ]
  };
  const taskStreakArr = getTaskCurrentStreak(recTaskArr);
  assert("Step 2: Recurring task with array history calculates streak >= 2", taskStreakArr >= 2, "Task streak was: " + taskStreakArr);

  // 6. Test Scoreboard Render in DOM
  state.masterSubtab = 'analytics';
  if (typeof renderTableAnalyticsView === 'function') renderTableAnalyticsView();
  const kpiCards = document.querySelectorAll('#analytics-kpi-row .analytics-kpi-card');
  const scoreboardGrid = document.querySelector('#analytics-scoreboard-container table, #analytics-scoreboard-container .scoreboard-grid, #analytics-scoreboard-container');
  assert("Step 4: Scoreboard KPI renders in DOM", kpiCards.length >= 3, "KPI cards count: " + kpiCards.length);
  assert("Step 4: Scoreboard container has content", Boolean(scoreboardGrid && scoreboardGrid.innerHTML.length > 20), "Scoreboard length: " + (scoreboardGrid ? scoreboardGrid.innerHTML.length : 0));

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
  Write-Host " Gendrive Scoreboard Restoration Test Results"
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
    Write-Host "SUCCESS: ALL SCOREBOARD RESTORATION TESTS PASSED!" -ForegroundColor Cyan
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
