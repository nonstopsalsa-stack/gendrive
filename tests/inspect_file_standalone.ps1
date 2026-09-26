$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$port = 9286
$tempDir = Join-Path $env:TEMP "edge_config_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?about:blank"
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
  
  $content = Get-Content -Raw -Encoding UTF8 "js/config.js"
  $res = Send-Cdp "Runtime.evaluate" @{
    expression = $content
    returnByValue = $true
  }
  Write-Host "Config eval result:"
  if ($res.result.exceptionDetails) {
    Write-Host "ERROR: $($res.result.exceptionDetails.exception.description)" -ForegroundColor Red
  } else {
    Write-Host "SUCCESS: $($res.result.result.value)" -ForegroundColor Green
  }

} finally {
  Stop-Process -Id $edge.Id -Force
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
