$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$port = 9269
$tempDir = Join-Path $env:TEMP "edge_console_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $wsUrl = $page.webSocketDebuggerUrl
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object Uri($wsUrl)), $ct).Wait()

  $script:msgId = 0
  function Send-Cdp($method, $params) {
    $cmd = @{
      id = [System.Threading.Interlocked]::Increment([ref]$script:msgId)
      method = $method
      params = $params
    } | ConvertTo-Json -Compress -Depth 10
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
    $buf = New-Object byte[] 2097152
    $res = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)), $ct).Result
    return [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
  }

  Send-Cdp "Log.enable" @{}
  Send-Cdp "Runtime.enable" @{}
  Start-Sleep -Seconds 2

  $evalRes = Send-Cdp "Runtime.evaluate" @{
    expression = "({ title: document.title, readyState: document.readyState, hasState: typeof state !== 'undefined', hasAppVersion: typeof APP_VERSION !== 'undefined', hasMigrateHabit: typeof migrateHabit !== 'undefined' })"
    returnByValue = $true
  }
  Write-Host "Eval result: $evalRes"

} finally {
  Stop-Process -Id $edge.Id -Force
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
