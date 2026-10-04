[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Continue"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Running v1.9.23 Habit SortOrder & Multi-Count Verification Suite" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$port = 9223
$tempUserData = Join-Path $env:TEMP ("edge_test_user_" + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $tempUserData -Force | Out-Null

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless", "--remote-debugging-port=$port", "--disable-gpu", "--user-data-dir=`"$tempUserData`"" -PassThru
Start-Sleep -Seconds 2

$ws = $null
try {
    $testHtmlPath = (Get-Item .\tests\test_v1923_habit_sortorder_and_multicount.html).FullName.Replace('\', '/')
    $fileUrl = "file:///$testHtmlPath"
    
    Write-Host "Target URL: $fileUrl" -ForegroundColor Gray
    $page = Invoke-RestMethod -Method Put -Uri "http://localhost:$port/json/new?$fileUrl"
    Start-Sleep -Seconds 2

    $wsUrl = $page.webSocketDebuggerUrl
    $ws = New-Object System.Net.WebSockets.ClientWebSocket
    $ct = New-Object System.Threading.CancellationToken
    $uri = New-Object System.Uri($wsUrl)
    $ws.ConnectAsync($uri, $ct).Wait()

    # Trigger runV1923Tests()
    $cmd = @{
        id = 1
        method = "Runtime.evaluate"
        params = @{
            expression = "JSON.stringify(window.runV1923Tests())"
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

    $results = $val | ConvertFrom-Json
    $passed = 0
    $failed = 0

    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host " Test Execution Results" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan

    foreach ($r in $results) {
        if ($r.passed) {
            $passed++
            Write-Host " [PASS] $($r.name)" -ForegroundColor Green
            if ($r.extra) {
                Write-Host "        $($r.extra)" -ForegroundColor DarkGray
            }
        } else {
            $failed++
            Write-Host " [FAIL] $($r.name)" -ForegroundColor Red
            if ($r.extra) {
                Write-Host "        $($r.extra)" -ForegroundColor Yellow
            }
        }
    }

    Write-Host "----------------------------------------------------------"
    Write-Host "Total Tests : $($results.Count)"
    Write-Host "Passed      : $passed" -ForegroundColor Green
    Write-Host "Failed      : $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
    Write-Host "==========================================================" -ForegroundColor Cyan

    if ($failed -gt 0) {
        Write-Host "FAILURE: Some tests failed!" -ForegroundColor Red
        exit 1
    } else {
        Write-Host "SUCCESS: ALL TESTS PASSED!" -ForegroundColor Green
        exit 0
    }
}
finally {
    if ($ws -and $ws.State -eq 'Open') {
        $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $ct).Wait()
    }
    if ($edge -and -not $edge.HasExited) {
        Stop-Process -Id $edge.Id -Force
    }
    if (Test-Path $tempUserData) {
        Remove-Item -Path $tempUserData -Recurse -Force -ErrorAction SilentlyContinue
    }
}
