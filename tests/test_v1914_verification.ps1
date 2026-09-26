$ErrorActionPreference = 'Continue'
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " [TEST SUITE] Gendrive v1.9.14 Architecture Verification" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_v1914_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9488
Write-Host "[1/4] Starting Edge in headless mode on port $port..." -ForegroundColor Yellow
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--window-size=1920,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

$passedCount = 0
$failedCount = 0

function Report-Assert($name, $pass, $detail = "") {
    if ($pass) {
        Write-Host "  [PASS] $name" -ForegroundColor Green
        $script:passedCount++
    } else {
        Write-Host "  [FAIL] $name - $detail" -ForegroundColor Red
        $script:failedCount++
    }
}

try {
  $fileUrl = "file:///" + ((Get-Item "C:\Users\nonst\recover\obsidian folder\006_AI_Workspace\habit-app\index.html").FullName.Replace('\', '/'))
  Write-Host "[2/4] Connecting to Gendrive: $fileUrl" -ForegroundColor Yellow
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $wsUrl = $page.webSocketDebuggerUrl
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $uri = New-Object System.Uri($wsUrl)
  $ws.ConnectAsync($uri, $ct).Wait(5000) | Out-Null
  Write-Host "[3/4] Connected to Chrome DevTools Protocol." -ForegroundColor Green

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
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait(10000) | Out-Null

    $buf = New-Object byte[] 2097152
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.exceptionDetails) {
      Write-Host "JS EXCEPTION: $($json.result.exceptionDetails.exception.description)" -ForegroundColor Red
    }
    return $json.result.result.value
  }

  Write-Host "[4/4] Executing Architecture & Defense Suite..." -ForegroundColor Yellow

  $results = Exec-Js @'
  (async () => {
    const r = [];

    // Test 1: APP_VERSION is v1.9.14
    r.push({ name: 'APP_VERSION is v1.9.14', pass: typeof APP_VERSION !== 'undefined' && APP_VERSION === 'v1.9.14', detail: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined' });

    // Test 2: DELETED_HABITS key exists
    r.push({ name: 'STORAGE_KEYS.DELETED_HABITS exists', pass: typeof STORAGE_KEYS !== 'undefined' && Boolean(STORAGE_KEYS.DELETED_HABITS), detail: STORAGE_KEYS?.DELETED_HABITS });

    // Test 3: saveTasks auto-stamping & isLocalDirty flag
    state.tasks = [{ id: 't_auto_stamp', title: 'Original Title', section: 'morning', status: 'uncompleted' }];
    saveTasks(true); // skip cloud push for pure unit test
    const stampedTask = state.tasks.find(t => t.id === 't_auto_stamp');
    const hasLocalTimestamp = stampedTask && typeof stampedTask._localUpdatedAt === 'number' && (Date.now() - stampedTask._localUpdatedAt < 5000);
    r.push({ name: 'saveTasks automatic _localUpdatedAt stamping', pass: hasLocalTimestamp, detail: stampedTask?._localUpdatedAt });
    r.push({ name: 'saveTasks sets isLocalDirty = true', pass: isLocalDirty === true, detail: String(isLocalDirty) });

    // Test 4: saveHabits auto-stamping & isLocalDirty flag
    state.habits = [{ id: 'h_auto_stamp', name: 'Original Habit', section: 'morning', status: 'uncompleted' }];
    saveHabits(true);
    const stampedHabit = state.habits.find(h => h.id === 'h_auto_stamp');
    const hasHabitTimestamp = stampedHabit && typeof stampedHabit._localUpdatedAt === 'number' && (Date.now() - stampedHabit._localUpdatedAt < 5000);
    r.push({ name: 'saveHabits automatic _localUpdatedAt stamping', pass: hasHabitTimestamp, detail: stampedHabit?._localUpdatedAt });

    // Test 5: Habit Tombstone (recordHabitDeletion & zombie resurrection barrier)
    recordHabitDeletion('h_deleted_test', 'Test Deleted Habit');
    const deletedHabitMap = loadDeletedHabitMap();
    const isRecordedInMap = deletedHabitMap.has('h_deleted_test');
    r.push({ name: 'recordHabitDeletion records tombstone in storage', pass: isRecordedInMap, detail: String(isRecordedInMap) });

    // Test 6: mergeHabitsDeep prevents zombie resurrection of deleted habit
    const staleCloudHabits = [{ id: 'h_deleted_test', name: 'Test Deleted Habit', updatedAt: new Date(Date.now() - 10000).toISOString() }];
    const mergedHabitsZombie = mergeHabitsDeep([], staleCloudHabits);
    const zombieResurrected = mergedHabitsZombie.some(h => String(h.id) === 'h_deleted_test');
    r.push({ name: 'mergeHabitsDeep blocks deleted habit zombie resurrection', pass: !zombieResurrected, detail: 'Count: ' + mergedHabitsZombie.length });

    // Test 7: mergeTasksDeep adopts edited attributes (title, section, etc.) for recent local task
    const mockLocalTaskEdited = [{
      id: 't_edit_test',
      title: 'MODIFIED TITLE',
      section: 'afternoon',
      scheduledDate: '2026-09-30',
      _localUpdatedAt: Date.now() - 1000
    }];
    const mockCloudTaskOld = [{
      id: 't_edit_test',
      title: 'OLD STALE CLOUD TITLE',
      section: 'morning',
      scheduledDate: '2026-09-25',
      updatedAt: new Date(Date.now() - 5000).toISOString()
    }];
    const mergedTasksEdited = mergeTasksDeep(mockLocalTaskEdited, mockCloudTaskOld);
    const targetTask = mergedTasksEdited.find(t => t.id === 't_edit_test');
    const taskPropertiesPreserved = targetTask && targetTask.title === 'MODIFIED TITLE' && targetTask.section === 'afternoon' && targetTask.scheduledDate === '2026-09-30';
    r.push({ name: 'mergeTasksDeep adopts all modified attributes (title, section, date) 100%', pass: taskPropertiesPreserved, detail: targetTask?.title + ' / ' + targetTask?.section });

    // Test 8: mergeHabitsDeep adopts edited attributes (name, section, etc.) for recent local habit
    const mockLocalHabitEdited = [{
      id: 'h_edit_test',
      name: 'MODIFIED HABIT NAME',
      section: 'night',
      targetMin: 45,
      _localUpdatedAt: Date.now() - 1000
    }];
    const mockCloudHabitOld = [{
      id: 'h_edit_test',
      name: 'OLD STALE HABIT NAME',
      section: 'morning',
      targetMin: 15,
      updatedAt: new Date(Date.now() - 5000).toISOString()
    }];
    const mergedHabitsEdited = mergeHabitsDeep(mockLocalHabitEdited, mockCloudHabitOld);
    const targetHabit = mergedHabitsEdited.find(h => h.id === 'h_edit_test');
    const habitPropertiesPreserved = targetHabit && targetHabit.name === 'MODIFIED HABIT NAME' && targetHabit.section === 'night' && targetHabit.targetMin === 45;
    r.push({ name: 'mergeHabitsDeep adopts all modified attributes (name, section, min) 100%', pass: habitPropertiesPreserved, detail: targetHabit?.name + ' / ' + targetHabit?.section });

    // Test 9: Stale Pull Barrier (pullDataFromCloud blocks overwrite when isLocalDirty = true)
    isSyncing = false; // ensure not blocked by concurrent initial fetch
    isLocalDirty = true;
    let pullBlocked = false;
    const origLog = console.log;
    console.log = (...args) => {
      const msg = args.map(a => String(a)).join(' ');
      if (msg.includes('isLocalDirty = true') || msg.includes('Cloud pull skipped')) {
        pullBlocked = true;
      }
      origLog(...args);
    };
    await pullDataFromCloud(false, false);
    console.log = origLog;
    r.push({ name: 'pullDataFromCloud blocks stale cloud pull when isLocalDirty = true', pass: pullBlocked, detail: 'pullBlocked: ' + pullBlocked });

    return r;
  })()
'@

  foreach ($t in $results) {
    Report-Assert -name $t.name -pass $t.pass -detail $t.detail
  }

} finally {
  Write-Host "`nCleaning up browser test process..." -ForegroundColor Yellow
  if ($ws -and $ws.State -eq 'Open') {
    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $ct).Wait(2000) | Out-Null
  }
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 1
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " TOTAL: $($passedCount + $failedCount) | PASSED: $passedCount | FAILED: $failedCount" -ForegroundColor $(if ($failedCount -eq 0) { "Green" } else { "Red" })
Write-Host "====================================================" -ForegroundColor Cyan

if ($failedCount -gt 0) {
    exit 1
}
