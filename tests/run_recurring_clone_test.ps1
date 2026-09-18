$edge = Start-Process -FilePath "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList "--headless", "--remote-debugging-port=9222", "--disable-gpu" -PassThru
Start-Sleep -Seconds 2

try {
  $fileUrl = "file:///" + ((Get-Item .\tests\test_recurring_single_clone_and_dedup.html).FullName.Replace('\', '/'))
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
      expression = "JSON.stringify(window.__TEST_SUMMARY__)"
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
  $summary = $json.result.result.value | ConvertFrom-Json
  
  Write-Host "=================================================="
  Write-Host " Gendrive Recurring Task Clone & Dedup Test Suite"
  Write-Host "=================================================="
  Write-Host "Total Tests : $($summary.total)"
  Write-Host "Passed      : $($summary.passed)"
  Write-Host "Failed      : $($summary.failed)"
  Write-Host "--------------------------------------------------"
  $summary.results | ForEach-Object {
    if ($_.pass) {
      Write-Host "PASS: $($_.message)" -ForegroundColor Green
    } else {
      Write-Host "FAIL: $($_.message)" -ForegroundColor Red
    }
  }
  Write-Host "=================================================="
  if ($summary.allPassed) {
    Write-Host "SUCCESS: ALL TESTS PASSED!" -ForegroundColor Cyan
  } else {
    Write-Host "FAILURE: SOME TESTS FAILED!" -ForegroundColor Red
    exit 1
  }
} finally {
  if ($ws -and $ws.State -eq 'Open') { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $ct).Wait() }
  Stop-Process -Id $edge.Id -Force
}
