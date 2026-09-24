$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless", "--remote-debugging-port=9222", "--disable-gpu" -PassThru
Start-Sleep -Seconds 2

try {
  $fileUrl = "file:///" + ((Get-Item "c:\Users\nonst\recover\obsidian folder\006_AI_Workspace\habit-app\tests\test_reproduce_task_t206.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:9222/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $wsUrl = $page.webSocketDebuggerUrl

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $uri = New-Object System.Uri($wsUrl)
  $ws.ConnectAsync($uri, $ct).Wait()

  $cmd = @{
    id = 1
    method = "Runtime.evaluate"
    params = @{
      expression = "JSON.stringify(window.__TEST_LOGS__)"
      returnByValue = $true
    }
  } | ConvertTo-Json -Compress

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
  $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

  $buf = New-Object byte[] 65536
  $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
  $res = $ws.ReceiveAsync($recvSeg, $ct).Result
  $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)

  $json = $resText | ConvertFrom-Json
  $logs = $json.result.result.value | ConvertFrom-Json
  
  Write-Host "=== REPRODUCTION TEST LOGS ==="
  $logs | ForEach-Object { Write-Host $_ }
} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
}
