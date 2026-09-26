$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "capture_mobile_load_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9280
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $mobileUrl = "file:///" + ((Get-Item "mobile.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$mobileUrl"
  Start-Sleep -Seconds 3

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
  while (typeof mState === 'undefined' && count < 30) {
    await new Promise(r => setTimeout(r, 100));
    count++;
  }
  return {
    mStateDefined: typeof mState !== 'undefined',
    retries: count,
    tasks: typeof mState !== 'undefined' ? mState.tasks.length : 0,
    habits: typeof mState !== 'undefined' ? mState.habits.length : 0,
    syncBadge: document.getElementById('m-sync-badge') ? document.getElementById('m-sync-badge').textContent.trim() : null,
    renderedCards: document.querySelectorAll('.m-card-item').length,
    listHtml: document.getElementById('m-task-list') ? document.getElementById('m-task-list').innerHTML.slice(0, 300) : null,
    errors: window.__pageErrors || []
  };
})()
'@

  Write-Host "Mobile.html after waiting for load:"
  $res | Format-List | Out-String | Write-Host

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
