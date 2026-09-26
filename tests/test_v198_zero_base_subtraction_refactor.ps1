$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_v198_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9265
Write-Host "Starting Edge in headless mode on port $port..."
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--window-size=2560,1080", "--disable-gpu" -PassThru
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

    $buf = New-Object byte[] 2097152
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.exceptionDetails) {
      Write-Host "JS EXCEPTION: $($json.result.exceptionDetails | ConvertTo-Json -Depth 3)" -ForegroundColor Red
    }
    return $json.result.result.value
  }

  $testScript = [System.IO.File]::ReadAllText("tests/test_v198_runner.js", [System.Text.Encoding]::UTF8)

  Write-Host "Executing in-browser test script..."
  $results = Exec-Js $testScript

  Write-Host "`n====================== TEST RESULTS ======================" -ForegroundColor Cyan
  $allPassed = $true
  foreach ($r in $results) {
    if ($r.pass) {
      Write-Host "  [PASS] $($r.name)" -ForegroundColor Green
    } else {
      Write-Host "  [FAIL] $($r.name): $($r.extra)" -ForegroundColor Red
      $allPassed = $false
    }
  }
  Write-Host "==========================================================" -ForegroundColor Cyan

  if ($allPassed) {
    Write-Host "`nALL TESTS PASSED SUCCESSFULLY! (100% PASS)" -ForegroundColor Green
    exit 0
  } else {
    Write-Host "`nSOME TESTS FAILED!" -ForegroundColor Red
    exit 1
  }

} finally {
  if ($ws -and $ws.State -eq 'Open') {
    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Closing", $ct).Wait()
  }
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force
  }
  Start-Sleep -Seconds 1
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
