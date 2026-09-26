$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$port = 9268
$tempDir = Join-Path $env:TEMP "edge_diag_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $tabs = Invoke-RestMethod -Uri "http://localhost:$port/json"
  $wsUrl = $tabs[0].webSocketDebuggerUrl
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object Uri($wsUrl)), $ct).Wait()

  $script:msgId = 0
  function Exec($code) {
    $cmd = @{
      id = [System.Threading.Interlocked]::Increment([ref]$script:msgId)
      method = "Runtime.evaluate"
      params = @{ expression = $code; returnByValue = $true }
    } | ConvertTo-Json -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $ws.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
    $buf = New-Object byte[] 2097152
    $res = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)), $ct).Result
    $text = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    return ($text | ConvertFrom-Json).result
  }

  $files = @(
    "js/config.js",
    "js/services/profileMasterService.js",
    "js/sampleData.js",
    "js/utils/dateUtils.js",
    "js/engine/recurrenceEngine.js",
    "js/engine/statsEngine.js",
    "js/engine/matrixEngine.js",
    "js/engine/carryoverEngine.js",
    "js/engine/keyboardShortcuts.js",
    "js/services/undoService.js",
    "js/services/storageService.js",
    "js/services/resumeNoteService.js",
    "js/services/taskCloneHelper.js",
    "js/services/taskTimerService.js",
    "js/components/cardRenderers.js",
    "js/components/modalService.js",
    "js/components/taskPresetsService.js",
    "js/components/dragAndDropService.js",
    "js/views/calendarView.js",
    "js/views/sectionView.js",
    "js/views/focusView.js",
    "js/views/allView.js",
    "js/views/tableView.js",
    "js/views/bucketView.js",
    "js/views/goalsView.js",
    "js/views/timerView.js",
    "app.js",
    "mobile.js"
  )

  foreach ($f in $files) {
    $content = Get-Content -Raw -Encoding UTF8 $f
    $escaped = $content | ConvertTo-Json -Compress
    $res = Exec "try { new Function($escaped); 'SYNTAX_OK'; } catch (e) { 'ERROR: ' + e.message; }"
    Write-Host "$f : $($res.value)"
  }
} finally {
  Stop-Process -Id $edge.Id -Force
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
