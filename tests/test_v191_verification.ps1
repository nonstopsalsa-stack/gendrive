$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=9256", "--user-data-dir=`"$tempDir`"", "--window-size=2560,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:9256/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $wsUrl = $page.webSocketDebuggerUrl
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $uri = New-Object System.Uri($wsUrl)
  $ws.ConnectAsync($uri, $ct).Wait()

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
      Write-Host "JS EXCEPTION: $($json.result.exceptionDetails | ConvertTo-Json -Depth 5)" -ForegroundColor Red
      return $null
    }
    if ($json.result.result) {
      return $json.result.result.value
    }
    return $json
  }

  $testScript = @'
(async () => {
  const tests = [];
  function assert(name, condition, extra = '') {
    tests.push({ name, pass: Boolean(condition), extra: String(extra) });
  }

  // Wait until scripts are loaded
  let retries = 0;
  while (typeof APP_VERSION === 'undefined' && retries < 30) {
    await new Promise(r => setTimeout(r, 100));
    retries++;
  }

  // 1. Version Check
  const currentVer = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined';
  assert("APP_VERSION is v1.9.1", currentVer === 'v1.9.1', currentVer);
  const verBadge = document.getElementById('app-version-badge');
  assert("Version badge in DOM shows v1.9.1", verBadge && verBadge.textContent === 'v1.9.1', verBadge ? verBadge.textContent : 'none');

  // Load real_gas_data.js
  await new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'tests/real_gas_data.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });

  // Populate localStorage with real user state (07:45 morning scenario)
  localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(window.__REAL_GAS_DATA__.data.habits));
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(window.__REAL_GAS_DATA__.data.tasks));
  localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(window.__REAL_GAS_DATA__.data.metadata));

  state.habits = loadHabits();
  state.tasks = loadTasks();

  // Set T206 running in routine as in user screenshot
  const t206 = state.tasks.find(t => t.id === 'T206');
  if (t206) {
    t206.status = 'in_progress';
    t206.startTimestamp = Date.now() - 98 * 60 * 1000;
  }
  state.activeTaskId = 'T206';
  state.activeHabitId = null;

  // Set Section 1 manual view at 07:45
  state.currentSection = SECTIONS_CONFIG[0].name;
  state.currentMode = "section";
  state.selectedDateOffset = 0;
  state.filters.status = "uncompleted";

  renderApp();

  // Check H088 rendered
  const h088CardBefore = document.querySelector('.habit-card[data-id="H088"]');
  assert("H088 card rendered in Section 1", Boolean(h088CardBefore));

  const startBtnBefore = h088CardBefore ? h088CardBefore.querySelector('.btn-habit-action.start') : null;
  assert("H088 has start button", Boolean(startBtnBefore));

  // 2. Click Start on H088!
  if (startBtnBefore) {
    startBtnBefore.click();
  }

  // Check state immediately
  const h088 = state.habits.find(h => h.id === 'H088');
  assert("H088 status is in_progress", h088 && h088.status === 'in_progress', h088 ? h088.status : 'null');
  assert("state.activeHabitId is H088", state.activeHabitId === 'H088', state.activeHabitId);
  assert("state.activeTaskId cleared to null", state.activeTaskId === null, state.activeTaskId);

  // Check T206 auto-paused
  const t206After = state.tasks.find(t => t.id === 'T206');
  assert("T206 auto-paused upon H088 start", t206After && t206After.status === 'paused', t206After ? t206After.status : 'null');

  // Check DOM immediately after start (Optimistic Direct DOM Mutation Guard)
  const h088CardStarted = document.querySelector('.habit-card[data-id="H088"]');
  assert("Started H088 card present in DOM", Boolean(h088CardStarted));
  if (h088CardStarted) {
    assert("H088 card has in-progress & is-timescale-active classes", h088CardStarted.classList.contains('in-progress') && h088CardStarted.classList.contains('is-timescale-active'), h088CardStarted.className);
    
    const computedBg = window.getComputedStyle(h088CardStarted).backgroundColor;
    assert("H088 card background is NOT pitch black", !computedBg.includes('rgba(8, 20, 16)'), computedBg);

    const pill = h088CardStarted.querySelector('.tc-status-pill');
    assert("Status pill is in-progress", pill && pill.classList.contains('in-progress'), pill ? pill.className : 'none');

    const doneBtn = h088CardStarted.querySelector('.btn-habit-action.done');
    assert("Action button is done (complete)", Boolean(doneBtn));
  }

  // 3. Test saveHabits preserves order without rolling back
  saveHabits();
  const topHabit = state.habits.find(h => h.section === SECTIONS_CONFIG[0].name);
  assert("H088 promoted to top of section remains top after saveHabits", topHabit && topHabit.id === 'H088', topHabit ? topHabit.id : 'none');

  // 4. Test live timer tick
  updateLiveTimers();
  const timerText = document.getElementById('habit-progress-time-H088');
  assert("H088 live timer text updated with targetMin", timerText && timerText.textContent.includes('12'), timerText ? timerText.textContent : 'none');

  // 5. Test 15s Heartbeat Cloud Pull with Stale Cloud Data (Zero-Rollback Guard)
  const cloudData = window.__REAL_GAS_DATA__.data;
  const mergedTasks = mergeTasksDeep(state.tasks, cloudData.tasks);
  const mergedHabits = mergeHabitsDeep(state.habits, cloudData.habits);

  const mH088 = mergedHabits.find(h => h.id === 'H088');
  assert("mergeHabitsDeep preserves local in_progress against stale cloud uncompleted", mH088 && mH088.status === 'in_progress', mH088 ? mH088.status : 'none');

  const mT206 = mergedTasks.find(t => t.id === 'T206');
  assert("mergeTasksDeep does NOT resurrect T206 to in_progress while H088 is active", mT206 && mT206.status === 'paused', mT206 ? mT206.status : 'none');

  // 6. Test complete H088
  const doneBtn = document.querySelector('.habit-card[data-id="H088"] .btn-habit-action.done');
  if (doneBtn) {
    doneBtn.click();
  }
  const h088Done = state.habits.find(h => h.id === 'H088');
  assert("H088 marked completed in state", h088Done && h088Done.status === 'completed', h088Done ? h088Done.status : 'none');
  assert("activeHabitId cleared after completion", state.activeHabitId === null, state.activeHabitId);

  // 7. Test Task Start Optimistic DOM Mutation
  const t_wait = {
    id: "T_TEST_1",
    title: "TEST TASK 1",
    type: "recurring",
    section: SECTIONS_CONFIG[0].name,
    timingType: "section",
    estMin: 20,
    status: "uncompleted"
  };
  state.tasks.push(t_wait);
  renderApp();

  const testTaskCard = document.querySelector('.task-card[data-id="T_TEST_1"]');
  assert("Test task card rendered", Boolean(testTaskCard));
  const testTaskStartBtn = testTaskCard ? testTaskCard.querySelector('.btn-task-action.start') : null;
  assert("Test task has start button", Boolean(testTaskStartBtn));

  if (testTaskStartBtn) {
    testTaskStartBtn.click();
  }

  assert("T_TEST_1 status is in_progress", t_wait.status === 'in_progress', t_wait.status);
  assert("state.activeTaskId is T_TEST_1", state.activeTaskId === 'T_TEST_1', state.activeTaskId);

  const taskCardStarted = document.querySelector('.task-card[data-id="T_TEST_1"]');
  assert("Task card switched to in-progress & timescale-active", taskCardStarted && taskCardStarted.classList.contains('in-progress') && taskCardStarted.classList.contains('is-timescale-active'));
  const taskDoneBtn = taskCardStarted ? taskCardStarted.querySelector('.btn-task-action.done') : null;
  assert("Task card has done button", Boolean(taskDoneBtn));

  return tests;
})()
'@

  $results = Exec-Js $testScript
  if (-not $results) {
    Write-Host "Result is null or empty!" -ForegroundColor Red
    exit 1
  }
  Write-Host "=================================================="
  Write-Host " Gendrive v1.9.1 Comprehensive Verification Results"
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
    Write-Host "SUCCESS: ALL v1.9.1 TESTS PASSED!" -ForegroundColor Cyan
  } else {
    Write-Host "FAILURE: SOME TESTS FAILED!" -ForegroundColor Red
    exit 1
  }

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
