$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "mobile_trace_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9277
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?about:blank"
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object Uri($page.webSocketDebuggerUrl)), $ct).Wait()

  $script:msgId = 0
  function Send-Cdp($method, $params = @{}) {
    $cmd = @{ id = [System.Threading.Interlocked]::Increment([ref]$script:msgId); method = $method; params = $params } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  }

  Send-Cdp "Runtime.enable"
  Send-Cdp "Log.enable"
  Send-Cdp "Page.enable"

  $fileUrl = "file:///" + ((Get-Item "mobile.html").FullName.Replace('\', '/'))
  Send-Cdp "Page.navigate" @{ url = $fileUrl }

  # Read events for 3 seconds
  $deadline = (Get-Date).AddSeconds(4)
  $events = @()
  $buf = New-Object byte[] 1048576
  while ((Get-Date) -lt $deadline) {
    if ($ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
      $recvTask = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)), $ct)
      if ($recvTask.Wait(500)) {
        $res = $recvTask.Result
        $text = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
        $events += $text
      }
    }
  }

  Write-Host "Captured CDP events during mobile.html page navigation:"
  foreach ($e in $events) {
    $json = $e | ConvertFrom-Json
    if ($json.method -eq "Runtime.exceptionThrown" -or $json.method -eq "Log.entryAdded") {
      Write-Host "--> $($e)" -ForegroundColor Red
    } elseif ($json.method -eq "Page.frameNavigated") {
      Write-Host "Navigated: $($json.params.frame.url)" -ForegroundColor Cyan
    }
  }

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
