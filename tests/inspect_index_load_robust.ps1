$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$port = 9287
$tempDir = Join-Path $env:TEMP "edge_index_rob_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$fileUrl"
  Start-Sleep -Seconds 3

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object Uri($page.webSocketDebuggerUrl)), $ct).Wait()

  $script:msgId = 0
  function Send-Cdp($method, $params = @{}) {
    $myId = [System.Threading.Interlocked]::Increment([ref]$script:msgId)
    $cmd = @{
      id = $myId
      method = $method
      params = $params
    } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
    
    $buf = New-Object byte[] 2097152
    while ($true) {
      $res = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)), $ct).Result
      $text = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
      $json = $text | ConvertFrom-Json
      if ($json.id -eq $myId) {
        return $json
      }
    }
  }

  Send-Cdp "Runtime.enable" | Out-Null
  
  $evalCode = @'
(async () => {
  let count = 0;
  while (typeof state === 'undefined' && count < 30) {
    await new Promise(r => setTimeout(r, 100));
    count++;
  }
  return {
    title: document.title,
    appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : null,
    hasState: typeof state !== 'undefined',
    tasks: typeof state !== 'undefined' && state.tasks ? state.tasks.length : 0,
    habits: typeof state !== 'undefined' && state.habits ? state.habits.length : 0,
    renderedCards: document.querySelectorAll('.task-card, .habit-row, .task-row').length
  };
})()
'@

  $res = Send-Cdp "Runtime.evaluate" @{
    expression = $evalCode
    returnByValue = $true
    awaitPromise = $true
  }

  Write-Host "Index.html Evaluation Result:"
  if ($res.result.exceptionDetails) {
    Write-Host "ERROR: $($res.result.exceptionDetails.exception.description)" -ForegroundColor Red
  } else {
    $res.result.result.value | Format-List | Out-String | Write-Host
  }

} finally {
  Stop-Process -Id $edge.Id -Force
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
