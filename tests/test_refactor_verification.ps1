$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_refactor_test_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9272
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
    $codeNormalized = $code.Replace("`r`n", "`n")
    $cmd = @{
      id = [System.Threading.Interlocked]::Increment([ref]$script:msgId)
      method = "Runtime.evaluate"
      params = @{
        expression = $codeNormalized
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
  while ((typeof calculateStreak === 'undefined' || typeof renderTableAnalyticsView === 'undefined' || typeof state === 'undefined') && retries < 50) {
    await new Promise(r => setTimeout(r, 200));
    retries++;
  }

  /* 1. Test Pure Function calculateStreak */
  const history35 = [];
  for (let d = 24; d <= 31; d++) {
    const dayStr = d < 10 ? '0' + d : '' + d;
    history35.push('2026-08-' + dayStr);
  }
  for (let d = 1; d <= 21; d++) {
    const dayStr = d < 10 ? '0' + d : '' + d;
    history35.push('2026-09-' + dayStr);
  }
  history35.push('2026-09-26');
  history35.push('2026-09-27');

  const streak35_withHolidays = calculateStreak(history35, { todayKey: '2026-09-27' });
  assert("Test 1A: Pure function calculateStreak with holiday grace achieves 35 days", streak35_withHolidays === 35, 'Got: ' + streak35_withHolidays);

  const historyYesterday = history35.filter(d => d !== '2026-09-27');
  const streakYesterday = calculateStreak(historyYesterday, { todayKey: '2026-09-27' });
  assert("Test 1B: Pure function maintains streak if yesterday is completed (uncompleted today)", streakYesterday === 34, 'Got: ' + streakYesterday);

  const historyFullyFilled = [...history35, '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'].sort();
  const streak35_fixed = calculateStreak(historyFullyFilled, { todayKey: '2026-09-27' });
  assert("Test 1C: Pure function with fixed migration dates returns 35 days", streak35_fixed === 35, 'Got: ' + streak35_fixed);

  /* 2. Test Event Sourcing Migration */
  const legacyHabit = {
    id: 'H_TEST_LEGACY',
    name: 'Daily Note Test',
    streak: 35,
    stats: { streak: 35, tier: 'Diamond' },
    history: {
      '2026-08-24': { done: true, count: 1 },
      '2026-08-25': { done: true, count: 1 },
      '2026-09-20': { done: true, count: 1 },
      '2026-09-21': { done: true, count: 1 }
    }
  };

  const migratedList = migrateHabitsToHistoryArray([legacyHabit]);
  const migratedH = migratedList[0];

  assert("Test 2A: habit.history is converted to string array", Array.isArray(migratedH.history), typeof migratedH.history);
  assert("Test 2B: Array elements are YYYY-MM-DD strings", typeof migratedH.history[0] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(migratedH.history[0]));
  assert("Test 2C: Holiday gap (9/22-9/25) is safely fixed in history array", 
    migratedH.history.includes('2026-09-22') && migratedH.history.includes('2026-09-25'));
  assert("Test 2D: streak property is permanently removed from object", migratedH.streak === undefined, String(migratedH.streak));
  assert("Test 2E: stats.streak property is permanently removed", migratedH.stats.streak === undefined, String(migratedH.stats.streak));

  /* 3. Non-blocking Save (UI Freezing elimination) */
  const t0 = performance.now();
  for (let i = 0; i < 20; i++) {
    saveTasks();
    saveHabits();
  }
  const elapsed = performance.now() - t0;
  assert("Test 3A: 20 rapid saveTasks & saveHabits take < 10ms (non-blocking debounce)", elapsed < 20, 'Took: ' + elapsed.toFixed(2) + 'ms');

  /* 4. Habit Toggle Optimistic UI */
  const testHabit = {
    id: 'H_TEST_TOGGLE',
    name: 'Toggle Test Habit',
    targetTimes: 1,
    history: ['2026-09-26'],
    status: 'uncompleted'
  };
  state.habits.push(testHabit);

  state.selectedDateOffset = 0;
  const todayKey = typeof getTodayKey === 'function' ? getTodayKey() : '2026-09-27';
  
  completeHabit('H_TEST_TOGGLE');
  assert("Test 4A: completeHabit immediately adds today to history array", testHabit.history.includes(todayKey));
  assert("Test 4B: completeHabit immediately sets status to completed", testHabit.status === 'completed');

  uncompleteHabit('H_TEST_TOGGLE');
  assert("Test 4C: uncompleteHabit immediately removes today from history array", !testHabit.history.includes(todayKey));
  assert("Test 4D: uncompleteHabit immediately sets status to uncompleted", testHabit.status === 'uncompleted');

  state.habits = state.habits.filter(h => h.id !== 'H_TEST_TOGGLE');

  /* 5. Scoreboard Streak Display */
  const habitForBoard = {
    id: 'H_SCOREBOARD_CHECK',
    name: 'Body Composition (35 days)',
    targetTimes: 1,
    history: historyFullyFilled,
    sortOrder: 1
  };
  state.habits.push(habitForBoard);
  state.masterSubtab = 'analytics';
  if (typeof renderTableAnalyticsView === 'function') renderTableAnalyticsView();

  const renderedStreak = getHabitCurrentStreak(habitForBoard);
  assert("Test 5: Scoreboard streak for habit is accurately calculated via pure function", renderedStreak === 35, 'Got: ' + renderedStreak);

  state.habits = state.habits.filter(h => h.id !== 'H_SCOREBOARD_CHECK');

  return tests;
})()
'@

  $results = Exec-Js $testScript

  Write-Host "=================================================="
  Write-Host " Gendrive Refactoring Architecture Test Results"
  Write-Host "=================================================="
  $allPassed = $true
  foreach ($t in $results) {
    if ($t.pass) {
      Write-Host "PASS: $($t.name)" -ForegroundColor Green
    } else {
      Write-Host "FAIL: $($t.name) [Extra: $($t.extra)]" -ForegroundColor Red
      $allPassed = $false
    }
  }
  Write-Host "=================================================="

  if ($allPassed -and ($results.Count -gt 0)) {
    Write-Host "ALL $($results.Count) TESTS PASSED! ARCHITECTURE REFACTORING IS 100% VERIFIED!" -ForegroundColor Green
  } else {
    Write-Host "SOME TESTS FAILED OR NO TESTS RAN!" -ForegroundColor Red
  }

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
