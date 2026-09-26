$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$tempDir = Join-Path $env:TEMP "edge_inspect_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$port = 9278

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object System.Uri($page.webSocketDebuggerUrl)), $ct).Wait()

  $script:msgId = 1
  function Send-CdpMsg($method, $params = @{}) {
    $script:msgId++
    $cmd = @{ id = $script:msgId; method = $method; params = $params } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  }

  Send-CdpMsg "Runtime.enable"
  Send-CdpMsg "Log.enable"
  Send-CdpMsg "Page.enable"

  # Reload to catch load-time errors
  Send-CdpMsg "Page.reload"

  $startTime = [System.Diagnostics.Stopwatch]::StartNew()
  $buf = New-Object byte[] 1048576
  while ($startTime.ElapsedMilliseconds -lt 6000) {
    if ($ws.State -ne 'Open') { break }
    $recvTask = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)), $ct)
    if ($recvTask.Wait(1000)) {
      $res = $recvTask.Result
      if ($res.Count -gt 0) {
        $text = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
        $json = $text | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($json.method -eq "Runtime.exceptionThrown") {
          Write-Host ">>> EXCEPTION THROWN:" -ForegroundColor Red
          Write-Host ($json.params.exceptionDetails | ConvertTo-Json -Depth 5) -ForegroundColor Red
        } elseif ($json.method -eq "Log.entryAdded" -and $json.params.entry.level -eq "error") {
          Write-Host ">>> LOG ERROR:" -ForegroundColor Red
          Write-Host ($json.params.entry | ConvertTo-Json -Depth 5) -ForegroundColor Red
        } elseif ($json.method -eq "Runtime.consoleAPICalled" -and $json.params.type -eq "error") {
          Write-Host ">>> CONSOLE ERROR:" -ForegroundColor Red
          Write-Host ($json.params | ConvertTo-Json -Depth 5) -ForegroundColor Red
        }
      }
    }
  }
} finally {
  if ($edge -and -not $edge.HasExited) { Stop-Process -Id $edge.Id -Force }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
