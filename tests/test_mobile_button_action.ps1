$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "capture_mobile_btn_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9284
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $mobileUrl = "file:///" + ((Get-Item "mobile.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$mobileUrl"
  Start-Sleep -Seconds 2

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object Uri($page.webSocketDebuggerUrl)), $ct).Wait()

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
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

    $buf = New-Object byte[] 10485760
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.exceptionDetails) {
      Write-Host "EVAL EXCEPTION: $($json.result.exceptionDetails.exception.description)" -ForegroundColor Red
    }
    return $json.result.result.value
  }

  $res = Exec-Js @'
(async () => {
  let count = 0;
  while (count < 20) {
    if (mState && mState.tasks && mState.tasks.length > 0 && !mState.isSyncing) break;
    await new Promise(r => setTimeout(r, 500));
    count++;
  }

  // 1. Check quick add button opens modal
  const addBtn = document.querySelector('.m-fab-btn');
  if (addBtn) addBtn.click();
  await new Promise(r => setTimeout(r, 200));
  const modalActive = document.getElementById('m-quick-add-modal').classList.contains('active');

  // Close modal
  const closeBtn = document.querySelector('.sheet-close-btn');
  if (closeBtn) closeBtn.click();
  await new Promise(r => setTimeout(r, 200));
  const modalClosed = !document.getElementById('m-quick-add-modal').classList.contains('active');

  // 2. Click start on first card
  const firstStartBtn = document.querySelector('.btn-slim-primary');
  let startedTaskId = null;
  if (firstStartBtn) {
    firstStartBtn.click();
    await new Promise(r => setTimeout(r, 300));
    const runningTask = mState.tasks.find(t => t.status === 'in_progress');
    startedTaskId = runningTask ? runningTask.id : null;
  }

  // 3. Pause the running task
  const pauseBtn = document.querySelector('.btn-slim-warning') || document.querySelector('.m-sticky-btn-pause');
  let pausedSuccess = false;
  if (pauseBtn) {
    pauseBtn.click();
    await new Promise(r => setTimeout(r, 300));
    const pausedTask = mState.tasks.find(t => t.id === startedTaskId && t.status === 'paused');
    pausedSuccess = Boolean(pausedTask);
  }

  return {
    modalOpened: modalActive,
    modalClosed: modalClosed,
    taskStarted: Boolean(startedTaskId),
    taskPaused: pausedSuccess,
    stickyBarVisible: document.getElementById('m-sticky-active-bar') ? !document.getElementById('m-sticky-active-bar').classList.contains('hidden') : null
  };
})()
'@

  Write-Host "Mobile Button Action Test Result:"
  $res | Format-List | Out-String | Write-Host

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
