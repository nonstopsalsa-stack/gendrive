$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$tempDir = Join-Path $env:TEMP "inspect_both_$(Get-Random)"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

$port = 9278
$edge = Start-Process -FilePath $edgePath -ArgumentList "--headless=new", "--remote-debugging-port=$port", "--user-data-dir=`"$tempDir`"", "--disable-gpu" -PassThru
Start-Sleep -Seconds 3

try {
  # 1. Test index.html
  $indexUrl = "file:///" + ((Get-Item "index.html").FullName.Replace('\', '/'))
  $page1 = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$indexUrl"
  Start-Sleep -Seconds 2

  $ws1 = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $ws1.ConnectAsync((New-Object Uri($page1.webSocketDebuggerUrl)), $ct).Wait()

  $cmd1 = @{
    id = 1
    method = "Runtime.evaluate"
    params = @{
      expression = @'
(() => {
  return {
    stateExists: typeof state !== 'undefined',
    tasksCount: typeof state !== 'undefined' && state.tasks ? state.tasks.length : -1,
    habitsCount: typeof state !== 'undefined' && state.habits ? state.habits.length : -1,
    currentMode: typeof state !== 'undefined' ? state.currentMode : null,
    renderedCards: document.querySelectorAll('.card, .task-card, .habit-card, .matrix-task-card').length,
    syncStatusText: document.getElementById('sync-status') ? document.getElementById('sync-status').textContent.trim() : null
  };
})()
'@
      returnByValue = $true
    }
  } | ConvertTo-Json -Compress

  $bytes1 = [System.Text.Encoding]::UTF8.GetBytes($cmd1)
  $ws1.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes1)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  $buf1 = New-Object byte[] 1048576
  $res1 = $ws1.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$buf1)), $ct).Result
  $resText1 = [System.Text.Encoding]::UTF8.GetString($buf1, 0, $res1.Count)
  Write-Host "Index.html diagnosis:"
  Write-Host $resText1

  # 2. Test mobile.html
  $mobileUrl = "file:///" + ((Get-Item "mobile.html").FullName.Replace('\', '/'))
  $page2 = Invoke-RestMethod -Method Put -Uri "http://localhost:${port}/json/new?$mobileUrl"
  Start-Sleep -Seconds 2

  $ws2 = New-Object System.Net.WebSockets.ClientWebSocket
  $ws2.ConnectAsync((New-Object Uri($page2.webSocketDebuggerUrl)), $ct).Wait()

  $cmd2 = @{
    id = 2
    method = "Runtime.evaluate"
    params = @{
      expression = @'
(() => {
  return {
    mStateExists: typeof mState !== 'undefined',
    mobileTasks: typeof mState !== 'undefined' && mState.tasks ? mState.tasks.length : -1,
    mobileHabits: typeof mState !== 'undefined' && mState.habits ? mState.habits.length : -1,
    mSyncBadgeText: document.getElementById('m-sync-badge') ? document.getElementById('m-sync-badge').textContent.trim() : null,
    taskListHtmlLength: document.getElementById('m-task-list') ? document.getElementById('m-task-list').innerHTML.length : -1
  };
})()
'@
      returnByValue = $true
    }
  } | ConvertTo-Json -Compress

  $bytes2 = [System.Text.Encoding]::UTF8.GetBytes($cmd2)
  $ws2.SendAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes2)), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()
  $buf2 = New-Object byte[] 1048576
  $res2 = $ws2.ReceiveAsync((New-Object System.ArraySegment[byte] -ArgumentList @(,$buf2)), $ct).Result
  $resText2 = [System.Text.Encoding]::UTF8.GetString($buf2, 0, $res2.Count)
  Write-Host "Mobile.html diagnosis:"
  Write-Host $resText2

} finally {
  if ($edge -and -not $edge.HasExited) {
    Stop-Process -Id $edge.Id -Force -ErrorAction SilentlyContinue
  }
  Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
