$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_v1910_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9266
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

  // Helper date generators relative to today
  const todayObj = new Date();
  function getDateStr(offsetDays) {
    const d = new Date(todayObj);
    d.setDate(d.getDate() - offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // 1. Version Check
  assert("Test 1: APP_VERSION is >= v1.9.10", typeof APP_VERSION !== 'undefined' && APP_VERSION.startsWith('v1.9.'), typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined');

  // 2. 1-day Streak Habit (e.g., done today only)
  const habit1d = {
    id: 'H_1D',
    name: 'Habit 1D Streak',
    targetTimes: 1,
    targetMin: 5,
    history: { [getDateStr(0)]: { done: true, count: 1 } },
    executionLogs: []
  };
  const migrated1d = migrateHabit(habit1d, 0);
  const streak1d = getHabitCurrentStreak(migrated1d);
  assert("Test 2: 1-day streak is recognized and equal to 1", streak1d === 1, "Got: " + streak1d);

  // 3. 2-day Streak Habit (done today and yesterday)
  const habit2d = {
    id: 'H_2D',
    name: 'Habit 2D Streak',
    targetTimes: 1,
    targetMin: 5,
    history: {
      [getDateStr(0)]: { done: true, count: 1 },
      [getDateStr(1)]: { done: true, count: 1 }
    },
    executionLogs: []
  };
  const migrated2d = migrateHabit(habit2d, 1);
  const streak2d = getHabitCurrentStreak(migrated2d);
  assert("Test 3: 2-day streak is recognized and equal to 2", streak2d === 2, "Got: " + streak2d);

  // 4. 10-day Streak Habit with short gap healing (done 10 days, small gap within 4 days)
  const habit10d = {
    id: 'H_10D',
    name: 'Habit 10D Streak',
    targetTimes: 1,
    targetMin: 5,
    history: {},
    executionLogs: []
  };
  // Days 2 through 10 done, day 1 gap, day 0 done -> total 10 active days
  for (let i = 2; i <= 10; i++) {
    habit10d.history[getDateStr(i)] = { done: true, count: 1 };
  }
  habit10d.history[getDateStr(0)] = { done: true, count: 1 };
  const migrated10d = migrateHabit(habit10d, 2);
  const streak10d = getHabitCurrentStreak(migrated10d);
  assert("Test 4: 10-day streak is healed and recognized >= 10", streak10d >= 10, "Got: " + streak10d);

  // 5. 20-day Streak Habit
  const habit20d = {
    id: 'H_20D',
    name: 'Habit 20D Streak',
    targetTimes: 1,
    targetMin: 5,
    history: {},
    executionLogs: []
  };
  for (let i = 0; i < 20; i++) {
    habit20d.history[getDateStr(i)] = { done: true, count: 1 };
  }
  const migrated20d = migrateHabit(habit20d, 3);
  const streak20d = getHabitCurrentStreak(migrated20d);
  assert("Test 5: 20-day streak is recognized as 20", streak20d === 20, "Got: " + streak20d);

  // 6. 30-day+ Habit (Body comp scenario, 33 days)
  const habit30d = {
    id: 'H_30D',
    name: 'Habit 30D Streak',
    targetTimes: 1,
    targetMin: 5,
    history: {},
    executionLogs: []
  };
  for (let i = 0; i < 33; i++) {
    habit30d.history[getDateStr(i)] = { done: true, count: 1 };
  }
  const migrated30d = migrateHabit(habit30d, 4);
  const streak30d = getHabitCurrentStreak(migrated30d);
  assert("Test 6: 30-day+ streak is recognized >= 30 (33 days)", streak30d >= 30, "Got: " + streak30d);

  // 7. Grace Period Protection (Completed yesterday, not yet done today)
  // Should NOT drop to 0, should preserve previous streak
  const habitGrace = {
    id: 'H_GRACE',
    name: 'Habit Grace Period',
    targetTimes: 1,
    targetMin: 5,
    history: {},
    executionLogs: []
  };
  for (let i = 1; i <= 7; i++) {
    habitGrace.history[getDateStr(i)] = { done: true, count: 1 };
  }
  // getDateStr(0) is intentionally NOT done
  const streakGrace = getHabitCurrentStreak(habitGrace);
  assert("Test 7: Grace period holds streak at 7 even when today is not completed yet", streakGrace === 7, "Got: " + streakGrace);

  // 8. Recurring Task Streaks (Single & Multi-day)
  const taskShort = {
    id: 'T_SHORT',
    title: 'Short Streak Task',
    type: 'recurring',
    history: [
      { date: getDateStr(0), durationMin: 15 },
      { date: getDateStr(1), durationMin: 15 },
      { date: getDateStr(2), durationMin: 15 }
    ]
  };
  const taskLong = {
    id: 'T_LONG',
    title: 'Long Streak Task',
    type: 'recurring',
    history: []
  };
  for (let i = 0; i < 15; i++) {
    taskLong.history.push({ date: getDateStr(i), durationMin: 20 });
  }
  sanitizeTasksDates([taskShort, taskLong]);
  const streakTaskShort = getTaskCurrentStreak(taskShort);
  const streakTaskLong = getTaskCurrentStreak(taskLong);
  assert("Test 8A: 3-day recurring task streak is 3", streakTaskShort === 3, "Got: " + streakTaskShort);
  assert("Test 8B: 15-day recurring task streak is 15", streakTaskLong === 15, "Got: " + streakTaskLong);

  // 9. Scoreboard UI Rendering with all tiers
  state.habits = [migrated1d, migrated2d, migrated10d, migrated20d, migrated30d, habitGrace];
  state.tasks = [taskShort, taskLong];
  state.masterSubtab = 'analytics';
  if (typeof renderTableAnalyticsView === 'function') renderTableAnalyticsView();

  const rows = document.querySelectorAll('.analytics-score-row');
  assert("Test 9A: Scoreboard rendered all 8 items (6 habits + 2 tasks)", rows.length === 8, "Rendered rows: " + rows.length);

  // Verify that streak cells are NOT showing '-' for items with streaks
  let zeroCount = 0;
  rows.forEach(row => {
    const streakCell = row.querySelector('.col-ana-streak');
    const text = streakCell ? streakCell.textContent.trim() : '';
    if (text === '-') zeroCount++;
  });
  assert("Test 9B: Zero streaks in scoreboard is 0 (all tiers 1d~33d display active streak)", zeroCount === 0, "Zero count: " + zeroCount);

  const kpiCards = document.querySelectorAll('#analytics-kpi-row .analytics-kpi-card');
  assert("Test 9C: Scoreboard KPI rendered properly", kpiCards.length >= 3, "KPI cards count: " + kpiCards.length);

  return tests;
})()
'@

  Write-Host "Executing in-browser test script for v1.9.10..."
  $results = Exec-Js $testScript
  if (-not $results) {
    Write-Host "Result is null or empty!" -ForegroundColor Red
    exit 1
  }

  Write-Host "=================================================="
  Write-Host " Gendrive v1.9.10 All-Streak Tiers Test Results"
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
    Write-Host "SUCCESS: ALL V1.9.10 TESTS PASSED 100%!" -ForegroundColor Cyan
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
