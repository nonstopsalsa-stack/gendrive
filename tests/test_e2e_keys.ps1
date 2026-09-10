$edge = Start-Process -FilePath "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList "--headless", "--remote-debugging-port=9222", "--disable-gpu" -PassThru
Start-Sleep -Seconds 2

try {
  $fileUrl = "file:///" + ((Get-Item .\index.html).FullName.Replace('\', '/'))
  $page = Invoke-RestMethod -Method Put -Uri "http://localhost:9222/json/new?$fileUrl"
  Start-Sleep -Seconds 2

  $wsUrl = $page.webSocketDebuggerUrl
  $ws = New-Object System.Net.WebSockets.ClientWebSocket
  $ct = New-Object System.Threading.CancellationToken
  $uri = New-Object System.Uri($wsUrl)
  $ws.ConnectAsync($uri, $ct).Wait()

  $evalCmd = @{
    id = 300
    method = "Runtime.evaluate"
    params = @{
      awaitPromise = $true
      returnByValue = $true
      expression = @"
        new Promise((resolve) => {
          function check() {
            if (typeof state !== 'undefined' && state && state.currentMode) {
              runTests();
            } else {
              setTimeout(check, 100);
            }
          }
          
          function press(key) {
            const ev = new KeyboardEvent('keydown', { key: key, bubbles: true, cancelable: true });
            window.dispatchEvent(ev);
          }

          function runTests() {
            const log = [];
            log.push('Init mode: ' + state.currentMode);

            // 1. Press 2 -> Switch to focus
            press('2');
            log.push('After key 2: mode=' + state.currentMode + ', focusCount=' + state.focusCount + ', cards=' + document.querySelectorAll('.focus-card').length);

            // 2. Press 2 again -> Loop focusCount to 2
            press('2');
            log.push('After key 2 (2nd): mode=' + state.currentMode + ', focusCount=' + state.focusCount + ', cards=' + document.querySelectorAll('.focus-card').length);

            // 3. Press 2 third time -> Loop focusCount to 3
            press('2');
            log.push('After key 2 (3rd): mode=' + state.currentMode + ', focusCount=' + state.focusCount + ', cards=' + document.querySelectorAll('.focus-card').length);

            // 4. Press 2 fourth time -> Loop focusCount back to 1
            press('2');
            log.push('After key 2 (4th): mode=' + state.currentMode + ', focusCount=' + state.focusCount + ', cards=' + document.querySelectorAll('.focus-card').length);

            // 5. Switch to 1 (Section)
            press('1');
            log.push('From focus press 1: mode=' + state.currentMode + ' activeView=' + document.querySelector('.view-container.active').id);

            // 6. Switch to 2 (Focus)
            press('2');
            log.push('From section press 2: mode=' + state.currentMode + ' activeView=' + document.querySelector('.view-container.active').id);

            // 7. Switch to 3 (Daily)
            press('3');
            log.push('From focus press 3: mode=' + state.currentMode + ' activeView=' + document.querySelector('.view-container.active').id);

            // 8. Switch to 4 (Master table)
            press('4');
            log.push('From daily press 4: mode=' + state.currentMode + ' activeView=' + document.querySelector('.view-container.active').id);

            // 9. Switch to 5 (Vision goals)
            press('5');
            log.push('From table press 5: mode=' + state.currentMode + ' activeView=' + document.querySelector('.view-container.active').id);

            // 10. Switch to 6 (Timer)
            press('6');
            log.push('From goals press 6: mode=' + state.currentMode + ' activeView=' + document.querySelector('.view-container.active').id);

            // 11. Switch back to 2 (Focus from timer)
            press('2');
            log.push('From timer press 2: mode=' + state.currentMode + ' activeView=' + document.querySelector('.view-container.active').id);

            resolve(JSON.stringify({
              success: true,
              log: log
            }));
          }

          check();
        })
"@
    }
  } | ConvertTo-Json -Compress

  $bytes = [System.Text.Encoding]::UTF8.GetBytes($evalCmd)
  $seg = New-Object System.ArraySegment[byte] -ArgumentList @(,$bytes)
  $ws.SendAsync($seg, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $ct).Wait()

  for ($i = 0; $i -lt 15; $i++) {
    $buf = New-Object byte[] 65536
    $recvSeg = New-Object System.ArraySegment[byte] -ArgumentList @(,$buf)
    $res = $ws.ReceiveAsync($recvSeg, $ct).Result
    $resText = [System.Text.Encoding]::UTF8.GetString($buf, 0, $res.Count)
    if ($resText.Contains('"id":300')) {
      Write-Host "EVAL_RESULT_300:"
      Write-Host $resText
      break
    }
  }

} finally {
  if ($ws -and $ws.State -eq 'Open') { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $ct).Wait() }
  Stop-Process -Id $edge.Id -Force
}
