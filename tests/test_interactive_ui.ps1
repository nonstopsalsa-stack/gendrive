$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$tempDir = Join-Path $env:TEMP "edge_ui_test_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$port = 9280

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--window-size=1920,1080", "--disable-gpu" -PassThru
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

  function Exec-Js($code) {
    $script:msgId++
    $cmd = @{
      id = $script:msgId
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
    $recvTask = $ws.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)), $ct)
    $recvTask.Wait()
    $text = [System.Text.Encoding]::UTF8.GetString($buf, 0, $recvTask.Result.Count)
    $json = $text | ConvertFrom-Json
    return $json.result.result.value
  }

  Send-CdpMsg "Runtime.enable"
  Send-CdpMsg "Input.enable"

  # Wait for app ready
  $checkReady = @"
(() => {
  return {
    appReady: typeof state !== 'undefined' && Boolean(state.tasks),
    hasPresetHandler: typeof setupTaskPresetsHandlers === 'function',
    modalExists: Boolean(document.getElementById('modal-task-presets')),
    btnPresetExists: Boolean(document.getElementById('btn-task-presets'))
  };
})()
"@
  $readyStatus = Exec-Js $checkReady
  Write-Host "Ready Status:"
  Write-Host ($readyStatus | ConvertTo-Json)

  # Test 1: Open preset task modal programmatically & via click
  $openModalJs = @"
(() => {
  const btn = document.getElementById('btn-task-presets');
  if (btn) btn.click();
  const modal = document.getElementById('modal-task-presets');
  return {
    modalActive: modal ? modal.classList.contains('active') : false,
    presetCardsCount: document.querySelectorAll('#task-presets-cards-container .preset-card').length,
    presetsInState: state.taskPresets ? state.taskPresets.length : 0
  };
})()
"@
  $modalStatus = Exec-Js $openModalJs
  Write-Host "`nModal Status after click:"
  Write-Host ($modalStatus | ConvertTo-Json)

  # Test 2: Dispatch keyboard event (ArrowDown, ArrowUp, 'p' for preset)
  $keyTestJs = @"
(() => {
  // Close modal first
  const modal = document.getElementById('modal-task-presets');
  if (modal) modal.classList.remove('active');

  // Trigger 'P' key to open presets
  const pEvent = new KeyboardEvent('keydown', { key: 'p', code: 'KeyP', bubbles: true, cancelable: true });
  window.dispatchEvent(pEvent);

  const openedByP = modal ? modal.classList.contains('active') : false;

  // Arrow key check
  const arrowEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', code: 'ArrowDown', bubbles: true, cancelable: true });
  window.dispatchEvent(arrowEvent);

  return {
    openedByPKey: openedByP,
    hasGlobalKeydown: true
  };
})()
"@
  $keyStatus = Exec-Js $keyTestJs
  Write-Host "`nKey Status after P key:"
  Write-Host ($keyStatus | ConvertTo-Json)

} finally {
  if ($edge -and -not $edge.HasExited) { Stop-Process -Id $edge.Id -Force }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
