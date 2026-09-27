[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Gendrive v1.9.16 Headless Edge Browser E2E Test Suite   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) { $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
$tempDir = Join-Path $env:TEMP "edge_preset_test_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
$port = 9295

$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--window-size=1920,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws.ConnectAsync((New-Object System.Uri($page.webSocketDebuggerUrl)), $ct).Wait()

  $script:msgId = 0
  function Exec-Js($code) {
    $currentId = [System.Threading.Interlocked]::Increment([ref]$script:msgId)
    $cmd = @{
      id = $currentId
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

    while ($true) {
      $res = $ws.ReceiveAsync($recvSeg, $ct).Result
      $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
      $json = $resText | ConvertFrom-Json
      if ($json.id -eq $currentId) {
        if ($json.result.exceptionDetails) {
          Write-Host "JS EXCEPTION: $($json.result.exceptionDetails | ConvertTo-Json -Depth 3)" -ForegroundColor Red
        }
        return $json.result.result.value
      }
    }
  }

  $testScript = @'
(async () => {
  const tests = [];
  function assert(name, condition, extra = '') {
    tests.push({ name, pass: Boolean(condition), extra: String(extra) });
  }

  window.confirm = () => true;
  window.alert = () => {};

  // Wait for state & preset service ready
  let retries = 0;
  while ((typeof state === 'undefined' || typeof renderTaskPresetsCards === 'undefined') && retries < 50) {
    await new Promise(r => setTimeout(r, 100));
    retries++;
  }

  // 1. Check version in running browser app
  assert("APP_VERSION is v1.9.16", typeof APP_VERSION !== 'undefined' && APP_VERSION === 'v1.9.16', typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined');

  // 2. Open Presets Modal
  if (typeof openTaskPresetsModal === 'function') {
    openTaskPresetsModal();
  }
  const modal = document.getElementById('modal-task-presets');
  assert("Preset Modal is open and active", Boolean(modal && modal.classList.contains('active')));

  // Ensure presets exist
  if (!state.taskPresets || state.taskPresets.length === 0) {
    state.taskPresets = [
      { id: 'preset_test_1', title: 'Test Task 1', icon: '⚡', estMin: 15 },
      { id: 'preset_test_2', title: 'Test Task 2', icon: '🔥', estMin: 25 },
      { id: 'preset_test_3', title: 'Test Task 3', icon: '📝', estMin: 10 }
    ];
    saveTaskPresets();
    renderTaskPresetsCards();
  }

  const cards = document.querySelectorAll('.preset-card-item');
  assert("Preset cards rendered in DOM (count >= 3)", cards.length >= 3, "Count: " + cards.length);

  // 3. Verify DnD attributes on all cards
  let allDraggable = true;
  let allHaveDataId = true;
  cards.forEach(c => {
    if (c.getAttribute('draggable') !== 'true') allDraggable = false;
    if (!c.getAttribute('data-preset-id')) allHaveDataId = false;
  });
  assert("All preset cards have draggable='true'", allDraggable);
  assert("All preset cards have data-preset-id attribute", allHaveDataId);

  // 4. Test reorderTaskPresets execution
  const p1 = state.taskPresets[0].id;
  const p2 = state.taskPresets[1].id;
  const p3 = state.taskPresets[2].id;

  // Move p3 to before p1 (Insert Left)
  reorderTaskPresets(p3, p1, true);

  const newOrder = state.taskPresets.map(p => p.id);
  assert("reorderTaskPresets correctly reordered state (p3 before p1)", newOrder[0] === p3 && newOrder[1] === p1 && newOrder[2] === p2, "New order: " + newOrder.join(','));

  const cardsAfter = document.querySelectorAll('.preset-card-item');
  const domOrder = Array.from(cardsAfter).map(c => c.getAttribute('data-preset-id'));
  assert("DOM cards correctly re-rendered in new order", domOrder[0] === p3 && domOrder[1] === p1 && domOrder[2] === p2, "DOM order: " + domOrder.join(','));

  // 5. Test Shortcut Key Badges Synchronization
  const badge0 = cardsAfter[0].querySelector('.preset-kbd-badge')?.textContent;
  const badge1 = cardsAfter[1].querySelector('.preset-kbd-badge')?.textContent;
  assert("Shortcut badge on slot 0 is '1'", badge0 === '1', "Slot 0 badge: " + badge0);
  assert("Shortcut badge on slot 1 is '2'", badge1 === '2', "Slot 1 badge: " + badge1);

  // 6. Test Undo Support
  if (typeof executeUndo === 'function') {
    executeUndo();
    const restoredCards = document.querySelectorAll('.preset-card-item');
    const restoredDomOrder = Array.from(restoredCards).map(c => c.getAttribute('data-preset-id'));
    assert("Undo action successfully restored original DOM card order", restoredDomOrder[0] === p1 && restoredDomOrder[1] === p2 && restoredDomOrder[2] === p3, "Restored order: " + restoredDomOrder.join(','));
  } else {
    assert("Undo action function exists", false, "executeUndo not found");
  }

  // 7. Verify Drag Guards on Action Buttons
  const editBtn = cardsAfter[0].querySelector('.btn-preset-edit');
  const deleteBtn = cardsAfter[0].querySelector('.btn-preset-delete');
  assert("Edit button has draggable='false'", editBtn && editBtn.getAttribute('draggable') === 'false');
  assert("Delete button has draggable='false'", deleteBtn && deleteBtn.getAttribute('draggable') === 'false');

  return tests;
})()
'@

  $results = Exec-Js $testScript
  if (-not $results) {
    Write-Host "Result is null or empty!" -ForegroundColor Red
    exit 1
  }

  $allPass = $true
  $results | ForEach-Object {
    if ($_.pass -eq $true) {
      Write-Host " [PASS] $($_.name)" -ForegroundColor Green
    } else {
      Write-Host " [FAIL] $($_.name) [Detail: $($_.extra)]" -ForegroundColor Red
      $allPass = $false
    }
  }

  Write-Host "==========================================================" -ForegroundColor Cyan
  if ($allPass) {
    Write-Host "SUCCESS: ALL E2E BROWSER TESTS PASSED!" -ForegroundColor Green
    exit 0
  } else {
    Write-Host "FAILURE: SOME E2E TESTS FAILED!" -ForegroundColor Red
    exit 1
  }

} finally {
  if ($ws -and $ws.State -eq [System.Net.WebSockets.WebSocketState]::Open) {
    $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "done", $ct).Wait()
  }
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
