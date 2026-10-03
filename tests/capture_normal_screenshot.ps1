$edgePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
}

$port = 9225
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

  # Open Cloud Sync Modal
  $null = Send-CDP "Runtime.evaluate" @{
    expression = "openCloudSyncModal();"
  }
  Start-Sleep -Milliseconds 300

  # Take normal state screenshot
  $ss = Send-CDP "Page.captureScreenshot" @{
    format = "png"
  }
  $ssBytes = [Convert]::FromBase64String($ss.result.data)
  $ssPath = "C:\Users\nonst\recover\obsidian folder\006_AI_Workspace\habit-app\sync_modal_close_btn_normal.png"
  [System.IO.File]::WriteAllBytes($ssPath, $ssBytes)
  Write-Host "Normal state screenshot saved: $ssPath"

} finally {
  if ($browser -and -not $browser.HasExited) {
    Stop-Process -Id $browser.Id -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path $userData) {
    Remove-Item -Path $userData -Recurse -Force -ErrorAction SilentlyContinue
  }
}
