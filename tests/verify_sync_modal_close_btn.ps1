$edgePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}

$port = 9224
$userData = "$env:TEMP\chrome_test_profile_$([guid]::NewGuid().ToString('N'))"
$browser = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--user-data-dir=`"$userData`"" -PassThru
Start-Sleep -Seconds 2

try {
  $fileUrl = "file:///" + ((Get-Item "C:\Users\nonst\recover\obsidian folder\006_AI_Workspace\habit-app\index.html").FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:$port/json/new?$fileUrl"
  Start-Sleep -Seconds 3

  $wsUrl = $page.webSocketDebuggerUrl
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $uri = New-Object System.Uri($wsUrl)
  $ws.ConnectAsync($uri, $ct).Wait()

  function Send-CDP([string]$method, [hashtable]$params = @{}) {
    $id = Get-Random -Minimum 1000 -Maximum 999999
    $cmdObj = @{
      id = $id
      method = $method
    }
    if ($params.Count -gt 0) {
      $cmdObj["params"] = $params
    }
    $cmd = $cmdObj | ConvertTo-Json -Depth 10 -Compress

    $bytes = [System.Text.Encoding]::UTF8.GetBytes($cmd)
    $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
    $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

    $ms = New-Object System.IO.MemoryStream
    $buffer = New-Object byte[] 65536
    $segRecv = New-Object System.ArraySegment[byte] -ArgumentList @(,$buffer)
    do {
      $res = $ws.ReceiveAsync($segRecv, $ct).Result
      $ms.Write($buffer, 0, $res.Count)
    } while (-not $res.EndOfMessage)

    $ms.Seek(0, [System.IO.SeekOrigin]::Begin) | Out-Null
    $reader = New-Object System.IO.StreamReader($ms, [System.Text.Encoding]::UTF8)
    $resText = $reader.ReadToEnd()
    $reader.Dispose()
    $ms.Dispose()

    return $resText | ConvertFrom-Json
  }

  # 1. Open Cloud Sync Modal and inspect button
  $eval1 = Send-CDP "Runtime.evaluate" @{
    expression = @"
(() => {
  openCloudSyncModal();
  const modal = document.getElementById('modal-cloud-sync');
  const btn = modal.querySelector('.modal-close, .btn-modal-close');
  const rect = btn.getBoundingClientRect();
  const cs = window.getComputedStyle(btn);
  const svg = btn.querySelector('svg');
  return JSON.stringify({
    modalActive: modal.classList.contains('active'),
    btnTitle: btn.getAttribute('title'),
    btnAriaLabel: btn.getAttribute('aria-label'),
    width: cs.width,
    height: cs.height,
    color: cs.color,
    bgColor: cs.backgroundColor,
    cursor: cs.cursor,
    borderRadius: cs.borderRadius,
    hasSvg: !!svg,
    svgWidth: svg ? svg.getAttribute('width') : null,
    svgHeight: svg ? svg.getAttribute('height') : null,
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  });
})()
"@
    returnByValue = $true
  }

  Write-Host "================ 1. MODAL OPEN & BUTTON NORMAL STATE ================"
  $val1 = $eval1.result.result.value | ConvertFrom-Json
  $val1 | Format-List | Out-String | Write-Host

  # 2. Hover over close button and check hover style
  $hoverX = [int]($val1.rect.x + $val1.rect.width / 2)
  $hoverY = [int]($val1.rect.y + $val1.rect.height / 2)

  Write-Host "Dispatching mouse hover at ($hoverX, $hoverY)..."
  $null = Send-CDP "Input.dispatchMouseEvent" @{
    type = "mouseMoved"
    x = $hoverX
    y = $hoverY
  }
  Start-Sleep -Milliseconds 300

  $evalHover = Send-CDP "Runtime.evaluate" @{
    expression = @"
(() => {
  const modal = document.getElementById('modal-cloud-sync');
  const btn = modal.querySelector('.modal-close, .btn-modal-close');
  const cs = window.getComputedStyle(btn);
  return JSON.stringify({
    hoverBgColor: cs.backgroundColor,
    hoverColor: cs.color,
    hoverCursor: cs.cursor
  });
})()
"@
    returnByValue = $true
  }

  Write-Host "================ 2. BUTTON HOVER STATE ================"
  $valHover = $evalHover.result.result.value | ConvertFrom-Json
  $valHover | Format-List | Out-String | Write-Host

  # 3. Take screenshot
  $ss = Send-CDP "Page.captureScreenshot" @{
    format = "png"
  }
  $ssBytes = [Convert]::FromBase64String($ss.result.data)
  $ssPath = "C:\Users\nonst\recover\obsidian folder\006_AI_Workspace\habit-app\sync_modal_close_btn_verified.png"
  [System.IO.File]::WriteAllBytes($ssPath, $ssBytes)
  Write-Host "================ 3. SCREENSHOT SAVED: $ssPath ================"

  # 4. Click close button and check if modal closed
  $null = Send-CDP "Input.dispatchMouseEvent" @{
    type = "mousePressed"
    button = "left"
    clickCount = 1
    x = $hoverX
    y = $hoverY
  }
  $null = Send-CDP "Input.dispatchMouseEvent" @{
    type = "mouseReleased"
    button = "left"
    clickCount = 1
    x = $hoverX
    y = $hoverY
  }
  Start-Sleep -Milliseconds 400

  $evalClose = Send-CDP "Runtime.evaluate" @{
    expression = @"
(() => {
  const modal = document.getElementById('modal-cloud-sync');
  return JSON.stringify({
    modalActiveAfterClick: modal.classList.contains('active'),
    modalOpacity: window.getComputedStyle(modal).opacity,
    modalVisibility: window.getComputedStyle(modal).visibility
  });
})()
"@
    returnByValue = $true
  }

  Write-Host "================ 4. AFTER CLICK CLOSE ================"
  $valClose = $evalClose.result.result.value | ConvertFrom-Json
  $valClose | Format-List | Out-String | Write-Host

} finally {
  if ($browser -and -not $browser.HasExited) {
    Stop-Process -Id $browser.Id -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $userData) {
    Remove-Item -Path $userData -Recurse -Force -ErrorAction SilentlyContinue
  }
}
