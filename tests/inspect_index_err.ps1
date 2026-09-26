$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "capture_mobile_ex_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9282
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu", "--allow-file-access-from-files" -PassThru
Start-Sleep -Seconds 3

try {
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?about:blank"
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object Uri($page.webSocketDebuggerUrl)), $ct).Wait()

  $script:msgId = 0
  function Send-Cdp($method, $params = @{}) {
    $cmd = @{
      id = [System.Threading.Interlocked]::Increment([ref]$script:msgId)
      method = $method
      params = $params
    } | ConvertTo-Json -Compress

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  }

  Send-Cdp "Runtime.enable"
  Send-Cdp "Log.enable"
  Send-Cdp "Page.enable"

  $mobileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  Send-Cdp "Page.navigate" @{ url = $mobileUrl }

  # Read CDP messages for 5 seconds
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  $buf = New-Object byte[] 65536
  while ($sw.ElapsedMilliseconds -lt 6000) {
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    if ($res.Count -gt 0) {
      $text = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
      $msg = $text | ConvertFrom-Json
      if ($msg.method -eq "Runtime.exceptionThrown") {
        Write-Host ">>> EXCEPTION DETECTED:" -ForegroundColor Red
        $msg.params.exceptionDetails | Format-List | Out-String | Write-Host
      }
      if ($msg.method -eq "Log.entryAdded") {
        Write-Host ">>> LOG: $($msg.params.entry.level) - $($msg.params.entry.text)"
      }
    }
  }

} finally {
  if ($ws -and $ws.State -eq 'Open') {
    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Closing", $ct).Wait()
  }
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}

