$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "capture_mobile_full_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9283
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

  Write-Host "Waiting up to 10 seconds for cloud sync to finish..."
  $res = Exec-Js @'
(async () => {
  let count = 0;
  // wait until sync finishes or tasks > 0
  while (count < 20) {
    if (mState && mState.tasks && mState.tasks.length > 0 && !mState.isSyncing) break;
    await new Promise(r => setTimeout(r, 500));
    count++;
  }
  
  // Test clicking habit scope tab
  const habitTab = document.getElementById('m-type-habit');
  if (habitTab) habitTab.click();
  await new Promise(r => setTimeout(r, 300));
  const habitCardsCount = document.querySelectorAll('.m-card-slim').length;

  // Test clicking task scope tab
  const taskTab = document.getElementById('m-type-task');
  if (taskTab) taskTab.click();
  await new Promise(r => setTimeout(r, 300));
  const taskCardsCount = document.querySelectorAll('.m-card-slim').length;

  // Test scope all
  const allScopeBtn = document.querySelector('[data-scope="all"]');
  if (allScopeBtn) allScopeBtn.click();
  await new Promise(r => setTimeout(r, 300));
  const allCardsCount = document.querySelectorAll('.m-card-slim').length;

  return {
    mStateDefined: typeof mState !== 'undefined',
    tasks: mState ? mState.tasks.length : 0,
    habits: mState ? mState.habits.length : 0,
    syncBadge: document.getElementById('m-sync-badge') ? document.getElementById('m-sync-badge').textContent.trim() : null,
    isSyncing: mState ? mState.isSyncing : null,
    habitCardsCount: habitCardsCount,
    taskCardsCount: taskCardsCount,
    allCardsCount: allCardsCount,
    firstCardTitle: document.querySelector('.m-slim-title') ? document.querySelector('.m-slim-title').textContent.trim() : null
  };
})()
'@

  Write-Host "Mobile Full Test Result:"
  $res | Format-List | Out-String | Write-Host

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
