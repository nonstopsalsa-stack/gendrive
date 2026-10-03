[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Running Multi-Habit Lifecycle Verification Suite (Headless Edge)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Launch Edge headless with remote debugging port 9222
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$port = 9222
$tempUserData = Join-Path $env:TEMP ("edge_test_user_" + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tempUserData -Force | Out-Null

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless", "--remote-debugging-port=$port", "--disable-gpu", "--user-data-dir=`"$tempUserData`"" -PassThru
Start-Sleep -Seconds 2

$ws = $null
try {
    $testHtmlPath = (Get-Item .\tests\test_multi_habit_lifecycle.html).FullName.Replace('\', '/')
    $fileUrl = "file:///$testHtmlPath"
    
    Write-Host "Target URL: $fileUrl" -ForegroundColor Gray
    $page = Invoke-RestMethod -Method Put -Uri "http://localhost:$port/json/new?$fileUrl"
    Start-Sleep -Seconds 2

    $wsUrl = $page.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = New-Object System.Threading.CancellationToken
    $uri = New-Object System.Uri($wsUrl)
    $ws.ConnectAsync($uri, $ct).Wait()

    # Trigger runLifecycleTest()
    $cmd = @{
        id = 1
        method = "Runtime.evaluate"
        params = @{
            expression = "JSON.stringify(window.runLifecycleTest())"
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
        Write-Host "SUCCESS: ALL MULTI-HABIT LIFECYCLE TESTS PASSED!" -ForegroundColor Cyan
        exit 0
    } else {
        Write-Host "FAILURE: REPRODUCED THE BUG AS EXPECTED." -ForegroundColor Yellow
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
