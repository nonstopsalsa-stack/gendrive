$ErrorActionPreference = 'Continue'
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " [TEST SUITE] Gendrive v1.9.17 Deterministic Streak Engine" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_v1917_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9389
Write-Host "[1/4] Starting Edge in headless mode on port $port..." -ForegroundColor Yellow
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--window-size=1920,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

$passedCount = 0
$failedCount = 0

function Report-Assert($name, $pass, $detail = "") {
    if ($pass) {
        Write-Host "  [PASS] $name" -ForegroundColor Green
        $script:passedCount++
    } else {
        Write-Host "  [FAIL] $name - $detail" -ForegroundColor Red
        $script:failedCount++
    }
}

try {
  $fileUrl = "file:///" + ((Get-Item "C:\Users\nonst\recover\obsidian folder\006_AI_Workspace\habit-app\index.html").FullName.Replace('\', '/'))
  Write-Host "[2/4] Connecting to Gendrive: $fileUrl" -ForegroundColor Yellow
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $wsUrl = $page.webSocketDebuggerUrl
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $uri = New-Object System.Uri($wsUrl)
  $ws.ConnectAsync($uri, $ct).Wait(5000) | Out-Null
  Write-Host "[3/4] Connected to Chrome DevTools Protocol." -ForegroundColor Green

  $script:msgId = 0
  function Exec-Js($code) {
    $codeNormalized = $code.Replace("`r`n", "`n")
    $cmd = @{
      id = [System.Threading.Interlocked]::Increment([ref]$script:msgId)
      method = "Runtime.evaluate"
      params = @{
        expression = $codeNormalized
        returnByValue = $true
        awaitPromise = $true
      }
    } | ConvertTo-Json -Compress

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait(10000) | Out-Null

    $buf = New-Object byte[] 2097152
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.exceptionDetails) {
      Write-Host "JS EXCEPTION: $($json.result.exceptionDetails.exception.description)" -ForegroundColor Red
      Write-Host ($json.result.exceptionDetails | ConvertTo-Json -Depth 3) -ForegroundColor Red
    }
    return $json.result.result.value
  }

  Write-Host "[4/4] Executing Deterministic Streak & Purge Verification Suite..." -ForegroundColor Yellow

  $runnerCode = [System.IO.File]::ReadAllText("C:\Users\nonst\recover\obsidian folder\006_AI_Workspace\habit-app\tests\test_v1917_runner.js", [System.Text.Encoding]::UTF8)
  $results = Exec-Js $runnerCode

  Write-Host "=================================================="
  Write-Host " Gendrive v1.9.17 Deterministic Streak Test Results"
  Write-Host "=================================================="
  $allPass = $true
  $results | ForEach-Object {
    Report-Assert $_.name $_.pass $_.detail
    if ($_.pass -ne $true) {
      $allPass = $false
    }
  }
  Write-Host "=================================================="
  Write-Host " TOTAL PASSED: $passedCount / $($passedCount + $failedCount)" -ForegroundColor $(if ($allPass) { 'Green' } else { 'Red' })

  if ($allPass) {
    Write-Host "SUCCESS: ALL V1.9.17 TESTS PASSED 100%!" -ForegroundColor Cyan
    exit 0
  } else {
    Write-Host "FAILURE: SOME TESTS FAILED!" -ForegroundColor Red
    exit 1
  }

} finally {
  Write-Host "Cleaning up Edge process..."
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host "Cleanup completed."
}
