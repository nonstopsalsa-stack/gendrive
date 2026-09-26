$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "mobile_runtime_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9275
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "mobile.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object Uri($page.webSocketDebuggerUrl)), $ct).Wait()

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
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

    $buf = New-Object byte[] 1048576
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.exceptionDetails) {
      Write-Host "RUNTIME EXCEPTION: $($json.result.exceptionDetails | ConvertTo-Json -Depth 5)" -ForegroundColor Red
    }
    return $json.result.result.value
  }

  # Check what's in window/state and DOM
  $res = Exec-Js @'
(() => {
  return {
    stateExists: typeof state !== 'undefined',
    tasksLength: typeof state !== 'undefined' && state.tasks ? state.tasks.length : -1,
    habitsLength: typeof state !== 'undefined' && state.habits ? state.habits.length : -1,
    currentDate: typeof state !== 'undefined' ? state.currentDate : null,
    currentSection: typeof state !== 'undefined' ? state.currentSection : null,
    syncBadgeText: document.getElementById('m-sync-badge') ? document.getElementById('m-sync-badge').textContent.trim() : null,
    taskCardsCount: document.querySelectorAll('.m-card-task').length,
    habitCardsCount: document.querySelectorAll('.m-card-habit').length,
    renderedHtmlLength: document.getElementById('m-task-list') ? document.getElementById('m-task-list').innerHTML.length : -1,
    gasUrlInStorage: localStorage.getItem('gendrive_gas_api_url')
  };
})()
'@

  Write-Host "Diagnostic state on mobile.html:"
  $res | Format-List | Out-String | Write-Host

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
