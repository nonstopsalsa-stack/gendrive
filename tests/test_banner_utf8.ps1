[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Running Banner UTF-8 Verification Suite on index.html (Headless Edge)" -ForegroundColor Cyan
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
    $indexPath = (Get-Item .\index.html).FullName.Replace('\', '/')
    $fileUrl = "file:///$indexPath"
    
    Write-Host "Target URL: $fileUrl" -ForegroundColor Gray
    $page = Invoke-RestMethod -Method Put -Uri "http://localhost:$port/json/new?$fileUrl"
    Start-Sleep -Seconds 3

    $wsUrl = $page.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = New-Object System.Threading.CancellationToken
    $uri = New-Object System.Uri($wsUrl)
    $ws.ConnectAsync($uri, $ct).Wait()

    # Wait for page readiness
    $ready = $false
    for ($i = 0; $i -lt 20; $i++) {
        $checkCmd = @{
            id = 100 + $i
            method = "Runtime.evaluate"
            params = @{
                expression = "(document.readyState === 'complete' && Boolean(document.getElementById('header-date-tag')) && Boolean(document.getElementById('btn-date-prev')))"
                returnByValue = $true
            }
        } | ConvertTo-Json -Compress
        $checkBytes = [System.Text.Encoding]::UTF8.GetBytes($checkCmd)
        $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$checkBytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
        $checkBuf = New-Object byte[] 4096
        $checkRes = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$checkBuf)), $ct).Result
        $checkJson = [System.Text.Encoding]::UTF8.GetString($checkBuf, 0, $checkRes.Count) | ConvertFrom-Json
        if ($checkJson.result.result.value -eq $true) {
            $ready = $true
            Write-Host "Page ready after $($i * 200)ms" -ForegroundColor Gray
            break
        }
        Start-Sleep -Milliseconds 200
    }

    if (-not $ready) {
        Write-Host "Timeout waiting for page ready" -ForegroundColor Red
        exit 1
    }

    $jsFilePath = (Get-Item .\tests\test_banner_utf8_runner.js).FullName
    $jsCode = [System.IO.File]::ReadAllText($jsFilePath, [System.Text.Encoding]::UTF8)

    $cmd = @{
        id = 1
        method = "Runtime.evaluate"
        params = @{
            expression = $jsCode
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
    $val = $json.result.result.value
    if (-not $val) {
        Write-Host "Evaluation returned empty or error: $resText" -ForegroundColor Red
        exit 1
    }

    $summary = $val | ConvertFrom-Json

    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host " Test Execution Results" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "Total Tests : $($summary.total)"
    Write-Host "Passed      : $($summary.passed)" -ForegroundColor Green
    $failColor = if ($summary.failed -gt 0) { "Red" } else { "Green" }
    Write-Host "Failed      : $($summary.failed)" -ForegroundColor $failColor
    Write-Host "----------------------------------------------------------"

    $summary.results | ForEach-Object {
        if ($_.pass) {
            Write-Host " [PASS] $($_.name)" -ForegroundColor Green
            if ($_.detail) { Write-Host "        $($_.detail)" -ForegroundColor Gray }
        } else {
            Write-Host " [FAIL] $($_.name)" -ForegroundColor Red
            if ($_.detail) { Write-Host "        $($_.detail)" -ForegroundColor Yellow }
        }
    }
    Write-Host "==========================================================" -ForegroundColor Cyan

    if ($summary.allPassed) {
        Write-Host "SUCCESS: ALL BANNER UTF-8 TESTS PASSED ON PRODUCTION INDEX.HTML!" -ForegroundColor Cyan
        exit 0
    } else {
        Write-Host "FAILURE: SOME TESTS FAILED!" -ForegroundColor Red
        exit 1
    }
}
finally {
    if ($ws -and $ws.State -eq 'Open') {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $ct).Wait()
    }
    if ($edge -and -not $edge.HasExited) {
        Stop-Process -Id $edge.Id -Force
    }
    # Clean up temp profile dir
    Start-Sleep -Milliseconds 500
    if (Test-Path $tempUserData) {
        Remove-Item -Recurse -Force $tempUserData -ErrorAction SilentlyContinue
    }
}
