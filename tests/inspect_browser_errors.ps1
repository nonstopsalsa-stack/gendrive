$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "capture_mobile_err_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9281
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $mobileUrl = "file:///" + ((Get-Item "mobile.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$mobileUrl"
  Start-Sleep -Seconds 2

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

    $buf = New-Object byte[] 10485760
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    return $resText | ConvertFrom-Json
  }

  # Enable Runtime and Log
  Send-Cdp "Runtime.enable" | Out-Null
  Send-Cdp "Log.enable" | Out-Null

  # Evaluate a script to inspect window.errors or run mobile.js evaluation directly
  $evalRes = Send-Cdp "Runtime.evaluate" @{
    expression = @"
(function() {
  const scripts = Array.from(document.querySelectorAll('script')).map(s => s.src);
  return {
    scripts: scripts,
    hasConfig: typeof APP_VERSION !== 'undefined',
    appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : null,
    hasMState: typeof mState !== 'undefined',
    title: document.title,
    bodyLength: document.body.innerHTML.length
  };
})()
"@
    returnByValue = $true
  }

  Write-Host "Initial Eval Result:"
  $evalRes.result.result.value | Format-List

  # Check what happens if we eval mobile.js in this context or check console
  $evalMobile = Send-Cdp "Runtime.evaluate" @{
    expression = "typeof mState !== 'undefined' ? 'mState exists' : 'NO mState'"
    returnByValue = $true
  }
  Write-Host "mState check: $($evalMobile.result.result.value)"

} finally {
  if ($ws -and $ws.State -eq 'Open') {
    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Closing", $ct).Wait()
  }
  if ($edge) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
