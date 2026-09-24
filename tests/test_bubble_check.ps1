$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=9233", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:9233/json/new?$fileUrl"
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

    $buf = New-Object byte[] 524288
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    $json = $resText | ConvertFrom-Json
    if ($json.result.result) {
      return $json.result.result.value
    }
    return $json
  }

  $testScript = @'
(async () => {
  const log = [];

  // Load real_gas_data.js
  await new Promise((resolve) => {
    const s = document.createElement('script');
    s.src = 'tests/real_gas_data.js';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });

  state.habits = window.__REAL_GAS_DATA__.data.habits || [];
  state.tasks = window.__REAL_GAS_DATA__.data.tasks || [];
  state.currentSection = SECTIONS_CONFIG[0].name; // "第1セッション"
  state.currentMode = "section";
  state.selectedDateOffset = 0;
  state.filters.status = "uncompleted";

  renderApp();

  // Spy on openEditModal
  let openEditModalCalledWith = null;
  const origOpenEditModal = window.openEditModal;
  window.openEditModal = function(id) {
    openEditModalCalledWith = id;
    log.push(">>> openEditModal CALLED with id: " + id);
    return origOpenEditModal.apply(this, arguments);
  };

  const card = document.querySelector('.habit-card[data-id="H088"]');
  const startBtn = card.querySelector('.btn-habit-action.start');

  log.push("Dispatching real MouseEvent 'click' to startBtn...");
  const evt = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
  startBtn.dispatchEvent(evt);

  log.push("openEditModalCalledWith: " + openEditModalCalledWith);

  const editModal = document.getElementById('modal-edit-habit');
  log.push("modal-edit-habit active: " + (editModal ? editModal.classList.contains('active') : 'no modal'));

  return log;
})()
'@

  $result = Exec-Js $testScript
  $result | ForEach-Object { Write-Host $_ }

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
