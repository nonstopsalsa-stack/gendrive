$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "compile_test_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9274
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?about:blank"
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object Uri($page.webSocketDebuggerUrl)), $ct).Wait()

  function Check-File-Syntax($fileName) {
    $code = [System.IO.File]::ReadAllText($fileName, [System.Text.Encoding]::UTF8)
    $msgId = [System.Guid]::NewGuid().ToString()
    $cmd = @{
      id = 1
      method = "Runtime.compileScript"
      params = @{
        expression = $code
        sourceURL = $fileName
        persistScript = $false
      }
    } | ConvertTo-Json -Compress

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

    $buf = New-Object byte[] 1048576
    $res = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)), $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.exceptionDetails) {
      Write-Host "SYNTAX ERROR in $fileName :" -ForegroundColor Red
      Write-Host ($json.result.exceptionDetails | ConvertTo-Json -Depth 5) -ForegroundColor Red
    } else {
      Write-Host "OK: $fileName syntax valid." -ForegroundColor Green
    }
  }

  Check-File-Syntax "mobile.js"
  Check-File-Syntax "js/config.js"
  Check-File-Syntax "js/services/taskCloneHelper.js"
  Check-File-Syntax "js/services/storageService.js"

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
