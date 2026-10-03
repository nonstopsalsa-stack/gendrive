[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Running Carryover & Quota Shield FALSIFICATION Suite" -ForegroundColor Cyan
Write-Host " (Testing bug reproduction & boundary failure detection)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$port = 9224
$tempUserData = Join-Path $env:TEMP ("edge_test_falsify_" + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tempUserData -Force | Out-Null

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless", "--remote-debugging-port=$port", "--disable-gpu", "--user-data-dir=`"$tempUserData`"" -PassThru
Start-Sleep -Seconds 2

$ws = $null
try {
    $testHtmlPath = (Get-Item .\tests\test_carryover_and_quota_shield_falsification.html).FullName.Replace('\', '/')
    $fileUrl = "file:///$testHtmlPath"
    
    Write-Host "Target URL: $fileUrl" -ForegroundColor Gray
    $page = Invoke-RestMethod -Method Put -Uri "http://localhost:$port/json/new?$fileUrl"
    Start-Sleep -Seconds 2

    $wsUrl = $page.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = New-Object System.Threading.CancellationToken
    $uri = New-Object System.Uri($wsUrl)
    $ws.ConnectAsync($uri, $ct).Wait()

    Start-Sleep -Seconds 1

    $evalCmd = @{
        id = 1
        method = "Runtime.evaluate"
        params = @{
            expression = "window.runFalsificationTest ? JSON.stringify(window.runFalsificationTest()) : JSON.stringify({ error: 'window.runFalsificationTest not defined' })"
            returnByValue = $true
        }
    } | ConvertTo-Json -Compress

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($evalCmd)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

    $buf = New-Object byte[] 65536
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)

    $json = $resText | ConvertFrom-Json
    $val = $json.result.result.value | ConvertFrom-Json

    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host " Falsification Test Results (Expected Failures)" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan

    foreach ($r in $val.results) {
        if ($r.pass) {
            Write-Host " [PASS] $($r.name)" -ForegroundColor Green
        } else {
            Write-Host " [FAIL] $($r.name)" -ForegroundColor Red
        }
    }

    if ($val.passed) {
        Write-Host "==========================================================" -ForegroundColor Red
        Write-Host "ANOMALY: Falsification tests unexpectedly PASSED!" -ForegroundColor Red
        exit 0
    } else {
        Write-Host "==========================================================" -ForegroundColor Yellow
        Write-Host "CONFIRMED: ALL FALSIFICATION TESTS FAILED AS EXPECTED (BUGS CORRECTLY DETECTED)!" -ForegroundColor Yellow
        exit 1
    }

} catch {
    Write-Host "Error running test: $_" -ForegroundColor Red
    exit 1
} finally {
    if ($ws -and $ws.State -eq 'Open') {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", [System.Threading.CancellationToken]::None).Wait()
    }
    if ($edge -and -not $edge.HasExited) {
        Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Milliseconds 500
    Remove-Item -Path $tempUserData -Recurse -Force -ErrorAction SilentlyContinue
}
