[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Running TaskChute ETA Engine T1-T10 Suite (Headless Edge)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$port = 9224
$tempUserData = Join-Path $env:TEMP ("edge_test_user_" + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tempUserData -Force | Out-Null

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless", "--remote-debugging-port=$port", "--disable-gpu", "--user-data-dir=`"$tempUserData`"" -PassThru
Start-Sleep -Seconds 2

$ws = $null
try {
    $testHtmlPath = (Get-Item .\tests\test_eta_engine_t1_t10.html).FullName.Replace('\', '/')
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

    # Run tests
    $evalCmd = @{
        id = 1
        method = "Runtime.evaluate"
        params = @{
            expression = "window.runAllEtaTests ? JSON.stringify(window.runAllEtaTests()) : JSON.stringify({ error: 'window.runAllEtaTests not defined' })"
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
    if (-not $json.result.result.value) {
        Write-Host "Raw CDP Response: $resText" -ForegroundColor Yellow
    }
    $val = $json.result.result.value | ConvertFrom-Json

    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host " ETA Engine Test Results ($($val.passed)/$($val.total) Passed)" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan

    foreach ($log in $val.logs) {
        if ($log.pass) {
            Write-Host " [PASS] $($log.id): $($log.name)" -ForegroundColor Green
            if ($log.detail) {
                Write-Host "        Detail: $($log.detail)" -ForegroundColor DarkGray
            }
        } else {
            Write-Host " [FAIL] $($log.id): $($log.name)" -ForegroundColor Red
            if ($log.detail) {
                Write-Host "        Detail: $($log.detail)" -ForegroundColor Magenta
            }
        }
    }

    if ($val.allPassed) {
        Write-Host "==========================================================" -ForegroundColor Green
        Write-Host "SUCCESS: ALL ETA ENGINE TESTS (T1-T10) PASSED!" -ForegroundColor Green
        exit 0
    } else {
        Write-Host "==========================================================" -ForegroundColor Red
        Write-Host "FAILURE: SOME ETA ENGINE TESTS FAILED!" -ForegroundColor Red
        exit 1
    }

} catch {
    Write-Host "Error running test: $_" -ForegroundColor Red
    exit 1
} finally {
    if ($ws) {
        $ws.Dispose()
    }
    if ($edge -and -not $edge.HasExited) {
        Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $tempUserData) {
        Remove-Item -Path $tempUserData -Recurse -Force -ErrorAction SilentlyContinue
    }
}
