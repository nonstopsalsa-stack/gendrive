$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_mobile_ver_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9270
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--window-size=412,915", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "mobile.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $wsUrl = $page.webSocketDebuggerUrl
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $uri = New-Object System.Uri($wsUrl)
  $ws.ConnectAsync($uri, $ct).Wait()

  $script:msgId = 0
  function Exec-Js($code) {
    $cmd = @{
      id = [System.Threading.Interlocked]::Increment([ref]$script:msgId)
      method = "Runtime.evaluate"
      params = @{
        expression = $code
        returnByValue = $true
        awaitPromise = $true
      }
    } | ConvertTo-Json -Compress

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

    $buf = New-Object byte[] 1048576
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    return $json.result.result.value
  }

  $testScript = @'
(() => {
  const badge = document.querySelector('.version-capsule-badge');
  const cardBadge = document.querySelector('.settings-version-card span');
  return {
    appVersion: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined',
    headerBadge: badge ? badge.textContent.trim() : null,
    cardBadge: cardBadge ? cardBadge.textContent.trim() : null,
    mobileMigrateExists: typeof migrateHabitMobile === 'function',
    calculateHabitStreakExists: typeof calculateHabitStreak === 'function'
  };
})()
'@

  $result = Exec-Js $testScript
  Write-Host "Mobile verification result:"
  $result | Format-List | Out-String | Write-Host

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
