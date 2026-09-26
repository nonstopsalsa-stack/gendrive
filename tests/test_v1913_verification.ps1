$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_v1913_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9268
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
  function assert(name, cond, extra = '') {
    tests.push({ name, pass: Boolean(cond), extra: String(extra) });
  }

  let retries = 0;
  while ((typeof mergeTasksDeep === 'undefined' || typeof state === 'undefined') && retries < 50) {
    await new Promise(r => setTimeout(r, 100));
    retries++;
  }
  // 1. Version Check
  assert('APP_VERSION is v1.9.13', typeof APP_VERSION !== 'undefined' && APP_VERSION === 'v1.9.13', typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined');

  // 2. FetchWithTimeout function existence
  assert('fetchWithTimeout exists in storageService', typeof fetchWithTimeout === 'function');

  // 3. Zero-Rollback Guard in mergeTasksDeep
  const mockLocalTasks = [{
    id: 't_zero_test',
    title: 'Test Zero Task',
    status: 'in_progress',
    startTimestamp: Date.now() - 5000,
    accumulatedSeconds: 5,
    _localUpdatedAt: Date.now() - 2000 // 2 seconds ago
  }];
  const mockCloudTasksStale = [{
    id: 't_zero_test',
    title: 'Test Zero Task',
    status: 'uncompleted',
    startTimestamp: null,
    accumulatedSeconds: 0,
    updatedAt: new Date(Date.now() + 5000).toISOString() // cloud ahead by 5s (clock skew)
  }];
  const mergedTasks = mergeTasksDeep(mockLocalTasks, mockCloudTasksStale);
  const targetMergedTask = mergedTasks.find(t => t.id === 't_zero_test');
  assert('Zero-Rollback: Task remains in_progress despite newer cloud uncompleted', targetMergedTask && targetMergedTask.status === 'in_progress', targetMergedTask?.status);

  // 4. Zero-Rollback Guard in mergeHabitsDeep
  const mockLocalHabits = [{
    id: 'h_zero_test',
    title: 'Test Zero Habit',
    status: 'completed',
    actEnd: '14:00',
    _localUpdatedAt: Date.now() - 1000 // 1 second ago
  }];
  const mockCloudHabitsStale = [{
    id: 'h_zero_test',
    title: 'Test Zero Habit',
    status: 'uncompleted',
    actEnd: null,
    updatedAt: new Date(Date.now() + 10000).toISOString()
  }];
  const mergedHabits = mergeHabitsDeep(mockLocalHabits, mockCloudHabitsStale);
  const targetMergedHabit = mergedHabits.find(h => h.id === 'h_zero_test');
  assert('Zero-Rollback: Habit remains completed despite cloud uncompleted', targetMergedHabit && targetMergedHabit.status === 'completed', targetMergedHabit?.status);

  // 5. Today done habit never rolls back to uncompleted
  const todayK = getTodayKey();
  const mockHabitDoneToday = [{
    id: 'h_done_today',
    title: 'Done Today Habit',
    status: 'completed',
    history: { [todayK]: { done: true, count: 1 } }
  }];
  const mockCloudHabitUncompleted = [{
    id: 'h_done_today',
    title: 'Done Today Habit',
    status: 'uncompleted',
    history: {}
  }];
  const mergedDoneToday = mergeHabitsDeep(mockHabitDoneToday, mockCloudHabitUncompleted);
  const targetDoneToday = mergedDoneToday.find(h => h.id === 'h_done_today');
  assert('Today completion protection: Habit never reverts to uncompleted', targetDoneToday && targetDoneToday.status === 'completed', targetDoneToday?.status);

  // 6. Habit startHabit / pauseHabit optimistic DOM mutation and _localUpdatedAt
  if (state.habits && state.habits.length > 0) {
    const firstHabit = state.habits[0];
    startHabit(firstHabit.id);
    assert('startHabit sets _localUpdatedAt', Boolean(firstHabit._localUpdatedAt && Date.now() - firstHabit._localUpdatedAt < 3000), firstHabit._localUpdatedAt);
    assert('startHabit sets status in_progress', firstHabit.status === 'in_progress', firstHabit.status);
    pauseHabit(firstHabit.id);
    assert('pauseHabit sets status paused and updates _localUpdatedAt', firstHabit.status === 'paused' && Boolean(firstHabit._localUpdatedAt), firstHabit.status);
  }

  // 7. Custom time habit stays visible in its section
  const targetSection = SECTIONS_CONFIG.find(s => s.id === 'sec_4')?.name || '第3セッション';
  const customHabit = {
    id: 'h_custom_win',
    title: 'Custom Habit',
    displayType: 'custom',
    customStart: '12:00',
    customEnd: '17:00',
    status: 'uncompleted',
    section: targetSection
  };
  const isVisible = isHabitInCurrentTimeWindow(customHabit, targetSection);
  assert('Custom habit 12:00-17:00 is visible in ' + targetSection, isVisible === true, isVisible);

  return tests;
})()
'@

  $results = Exec-Js $testScript
  Write-Host "--- TEST EXECUTION RESULTS (v1.9.13) ---" -ForegroundColor Cyan
  $passCount = 0
  $totalCount = $results.Count
  foreach ($t in $results) {
    if ($t.pass) {
      $passCount++
      Write-Host "[PASS] $($t.name)" -ForegroundColor Green
    } else {
      Write-Host "[FAIL] $($t.name) | Extra: $($t.extra)" -ForegroundColor Red
    }
  }
  Write-Host "Summary: $passCount / $totalCount passed ($([Math]::Round($passCount / $totalCount * 100, 1))%)" -ForegroundColor Yellow
  if ($passCount -ne $totalCount) {
    exit 1
  }
} finally {
  if ($ws -and $ws.State -eq 'Open') { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, 'done', $ct).Wait() }
  if ($edge -and -not $edge.HasExited) { Stop-Process -Id $edge.Id -Force }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
