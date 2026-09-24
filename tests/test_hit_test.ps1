$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "edge_profile_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

# 画面サイズを 1920x1080 にして起動（ユーザーのデスクトップ環境に近づける）
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless", "--remote-debugging-port=9229", "--user-data-dir=`"$tempDir`"", "--window-size=1920,1080", "--disable-gpu" -PassThru
Start-Sleep -Seconds 2

try {
  $fileUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:9229/json/new?$fileUrl"
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

  $script = @'
(async () => {
  const log = [];

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

  const cardH088 = document.querySelector('.habit-card[data-id="H088"]');
  if (!cardH088) {
    return ["H088 not found in DOM!"];
  }

  const startBtn = cardH088.querySelector('.btn-habit-action.start');
  if (!startBtn) {
    return ["startBtn not found in H088!"];
  }

  const rect = startBtn.getBoundingClientRect();
  log.push(`startBtn rect: left=${rect.left}, top=${rect.top}, width=${rect.width}, height=${rect.height}`);

  // Test what element is at the center of the button!
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const elementAtPoint = document.elementFromPoint(centerX, centerY);
  log.push(`Element at center (${centerX}, ${centerY}): <${elementAtPoint?.tagName}> class="${elementAtPoint?.className}" id="${elementAtPoint?.id}"`);
  log.push(`Is element equal to startBtn? ` + (elementAtPoint === startBtn));

  // Check draggable attribute on card and its effect on clicking
  log.push(`card draggable attribute: ` + cardH088.getAttribute('draggable'));

  // Check all parent elements of startBtn up to body
  let cur = startBtn;
  while (cur && cur !== document.body) {
    const cs = window.getComputedStyle(cur);
    log.push(`Parent <${cur.tagName}> class="${cur.className}" pointer-events="${cs.pointerEvents}" z-index="${cs.zIndex}"`);
    cur = cur.parentElement;
  }

  return log;
})()
'@

  $result = Exec-Js $script
  $result | ForEach-Object { Write-Host $_ }

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
