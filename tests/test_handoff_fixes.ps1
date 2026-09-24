$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_handoff_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9260
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

  // Prevent any blocking dialogs
  window.confirm = () => true;
  window.alert = () => {};
  window.prompt = () => null;

  let retries = 0;
  while ((typeof state === 'undefined' || !state.tasks) && retries < 30) {
    await new Promise(r => setTimeout(r, 200));
    retries++;
  }

  // Version check
  assert("Version check: APP_VERSION is v1.9.3", typeof APP_VERSION !== 'undefined' && APP_VERSION === 'v1.9.3', typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined');

  // ========================================================
  // Step 1: sanitizeDailyState() tests
  // ========================================================
  {
    // Test 1-A: Orphan paused task (paused + no startTimestamp) should be reset to uncompleted
    const orphanTask = {
      id: 'T_ORPHAN_TEST',
      name: 'Orphan Paused Task',
      status: 'paused',
      startTimestamp: null,
      accumulatedSeconds: 50,
      type: 'single'
    };
    state.tasks.push(orphanTask);
    state.activeTaskId = 'T_ORPHAN_TEST';

    sanitizeDailyState();

    const target1 = state.tasks.find(t => t.id === 'T_ORPHAN_TEST');
    assert("Step 1-A: Orphan paused task resets status to uncompleted", target1 && target1.status === 'uncompleted', target1 ? target1.status : 'not found');
    assert("Step 1-A: Orphan paused task clears accumulatedSeconds", target1 && target1.accumulatedSeconds === 0, target1 ? target1.accumulatedSeconds : 'none');
    assert("Step 1-A: Orphan paused task clears activeTaskId", state.activeTaskId === null, state.activeTaskId);

    // Test 1-B: Normal paused task (paused with recent startTimestamp < 18h) should NOT be reset
    const normalPausedTask = {
      id: 'T_NORMAL_PAUSED',
      name: 'Normal Paused Task',
      status: 'paused',
      startTimestamp: Date.now() - (1 * 60 * 60 * 1000), // 1 hour ago
      accumulatedSeconds: 300,
      type: 'single'
    };
    state.tasks.push(normalPausedTask);
    sanitizeDailyState();
    const target2 = state.tasks.find(t => t.id === 'T_NORMAL_PAUSED');
    assert("Step 1-B: Normal recent paused task is NOT reset", target2 && target2.status === 'paused', target2 ? target2.status : 'not found');

    // Cleanup
    state.tasks = state.tasks.filter(t => t.id !== 'T_ORPHAN_TEST' && t.id !== 'T_NORMAL_PAUSED');
  }

  // ========================================================
  // Step 2: mergeTasksDeep() tests
  // ========================================================
  if (typeof mergeTasksDeep === 'function') {
    // Test 2-A: Local orphan paused vs Cloud uncompleted -> Cloud wins (uncompleted)
    const local1 = [{ id: 'T_MERGE_1', name: 'Task 1', status: 'paused', startTimestamp: null, accumulatedSeconds: 0 }];
    const cloud1 = [{ id: 'T_MERGE_1', name: 'Task 1', status: 'uncompleted' }];
    const merged1 = mergeTasksDeep(local1, cloud1);
    assert("Step 2-A: Orphan local paused yields to cloud uncompleted", merged1[0].status === 'uncompleted', merged1[0] ? merged1[0].status : 'none');

    // Test 2-B: Local orphan paused vs Cloud completed -> Cloud wins (completed)
    const local2 = [{ id: 'T_MERGE_2', name: 'Task 2', status: 'paused', startTimestamp: null, accumulatedSeconds: 0 }];
    const cloud2 = [{ id: 'T_MERGE_2', name: 'Task 2', status: 'completed', completedAt: '2026-09-24T05:00:00.000Z' }];
    const merged2 = mergeTasksDeep(local2, cloud2);
    assert("Step 2-B: Orphan local paused yields to cloud completed", merged2[0].status === 'completed', merged2[0] ? merged2[0].status : 'none');

    // Test 2-C: Non-orphan paused (has accumulatedSeconds) vs Cloud uncompleted -> Local paused is preserved!
    const local3 = [{ id: 'T_MERGE_3', name: 'Task 3', status: 'paused', startTimestamp: null, accumulatedSeconds: 120 }];
    const cloud3 = [{ id: 'T_MERGE_3', name: 'Task 3', status: 'uncompleted' }];
    const merged3 = mergeTasksDeep(local3, cloud3);
    assert("Step 2-C: Non-orphan local paused preserves paused status", merged3[0].status === 'paused', merged3[0] ? merged3[0].status : 'none');
  } else {
    assert("Step 2: mergeTasksDeep exists", false, "mergeTasksDeep is not defined");
  }

  // ========================================================
  // Step 3: updateHeaderAndStatus() recursive renderApp removal
  // ========================================================
  {
    let renderAppCallCount = 0;
    const origRenderApp = window.renderApp;
    window.renderApp = function() {
      renderAppCallCount++;
    };

    state.lastProcessedDate = '2026-09-20'; // simulate date rollover from past
    updateHeaderAndStatus();

    assert("Step 3: updateHeaderAndStatus does NOT recursively invoke renderApp", renderAppCallCount === 0, 'Calls: ' + renderAppCallCount);
    assert("Step 3: state.lastProcessedDate was updated to current", state.lastProcessedDate !== '2026-09-20', state.lastProcessedDate);

    window.renderApp = origRenderApp;
  }

  // ========================================================
  // Step 4-A: restoreFromSnapshot() empty array guard
  // ========================================================
  if (typeof restoreFromSnapshot === 'function') {
    state.taskPresets = [{ id: 'p1', name: 'Custom Preset 1' }, { id: 'p2', name: 'Custom Preset 2' }];
    const mockSnap = {
      timestamp: Date.now(),
      displayTime: '09/24 10:00',
      taskCount: 0,
      habitCount: 0,
      data: {
        tasks: [],
        habits: [],
        goals: {},
        manifesto: {},
        taskPresets: [] // Empty array in snapshot
      }
    };
    localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify([mockSnap]));

    restoreFromSnapshot(0);

    assert("Step 4-A: restoreFromSnapshot does not overwrite with empty taskPresets", state.taskPresets && state.taskPresets.length === 2, 'Length: ' + (state.taskPresets ? state.taskPresets.length : 0));
  } else {
    assert("Step 4-A: restoreFromSnapshot exists", false, "restoreFromSnapshot not defined");
  }

  // ========================================================
  // Step 4-B: loadTaskPresets() warning log on empty array
  // ========================================================
  if (typeof loadTaskPresets === 'function') {
    let warnLogged = false;
    const origWarn = console.warn;
    console.warn = function(...args) {
      if (args[0] && args[0].includes('[loadTaskPresets] localStorage has empty array')) {
        warnLogged = true;
      }
      origWarn.apply(console, args);
    };

    localStorage.setItem(STORAGE_KEYS.PRESETS, '[]');
    const presetsLoaded = loadTaskPresets();
    assert("Step 4-B: loadTaskPresets logs warning when localStorage has empty array", warnLogged === true, 'warnLogged: ' + warnLogged);
    assert("Step 4-B: loadTaskPresets falls back to DEFAULT_TASK_PRESETS", Array.isArray(presetsLoaded) && presetsLoaded.length > 0);

    console.warn = origWarn;
  } else {
    assert("Step 4-B: loadTaskPresets exists", false, "loadTaskPresets not defined");
  }

  // ========================================================
  // Step 4-C: renderTaskPresetsCards() null guard
  // ========================================================
  if (typeof renderTaskPresetsCards === 'function') {
    const grid = document.getElementById('preset-cards-grid');
    if (grid) {
      // Case 1: state.taskPresets is empty array [] -> should show empty-state, NOT default presets
      state.taskPresets = [];
      renderTaskPresetsCards();
      const emptyStateEl = grid.querySelector('.empty-state');
      assert("Step 4-C: Empty array [] displays empty-state rather than default presets", Boolean(emptyStateEl));

      // Case 2: state.taskPresets is null -> should fallback to DEFAULT_TASK_PRESETS
      state.taskPresets = null;
      renderTaskPresetsCards();
      const cardEls = grid.querySelectorAll('.preset-card-item');
      assert("Step 4-C: null state.taskPresets falls back to DEFAULT_TASK_PRESETS cards", cardEls.length > 0, 'Cards: ' + cardEls.length);
    } else {
      assert("Step 4-C: preset-cards-grid element found in DOM", false);
    }
  } else {
    assert("Step 4-C: renderTaskPresetsCards exists", false, "renderTaskPresetsCards not defined");
  }

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
  Write-Host " Gendrive Handoff Fixes Comprehensive Results"
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
    Write-Host "SUCCESS: ALL HANDOFF FIX TESTS PASSED!" -ForegroundColor Cyan
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
