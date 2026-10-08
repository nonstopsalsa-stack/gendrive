# Test Suite for Gendrive Rate & Streak Integrity (v1.9.25)
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_test_integrity_$(Get-Random)"
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

  $rawHabits = [System.IO.File]::ReadAllText((Join-Path (Get-Location) "current_gas_habits.json"), [System.Text.Encoding]::UTF8) | ConvertFrom-Json
  $targetHabits = $rawHabits | Where-Object { @('H069', 'H041', 'H040') -contains $_.id }
  $escapedJson = ($targetHabits | ConvertTo-Json -Depth 5 -Compress) | ConvertTo-Json -Compress
  Exec-Js "window.__realHabitsData = JSON.parse($escapedJson);"

  $testScript = [System.IO.File]::ReadAllText((Join-Path (Get-Location) "tests/test_v1925_runner.js"), [System.Text.Encoding]::UTF8)

  $testResults = Exec-Js $testScript
  Write-Host "`n==== TEST RESULTS ====" -ForegroundColor Cyan
  $allPassed = $true
  if ($testResults -eq $null) {
    Write-Host "No results returned from JS test execution." -ForegroundColor Red
    exit 1
  }

  foreach ($r in $testResults) {
    if ($r.pass) {
      Write-Host " [PASS] $($r.name) ($($r.extra))" -ForegroundColor Green
    } else {
      Write-Host " [FAIL] $($r.name) ($($r.extra))" -ForegroundColor Red
      $allPassed = $false
    }
  }

  if ($allPassed) {
    Write-Host "`nALL TESTS PASSED SUCCESSFULLY!" -ForegroundColor Green
    exit 0
  } else {
    Write-Host "`nSOME TESTS FAILED!" -ForegroundColor Red
    exit 1
  }

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
