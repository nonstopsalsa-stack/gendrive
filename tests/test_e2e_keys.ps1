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

  $jsCode = @"
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

  function isHidden(selector) {
    const el = document.querySelector(selector);
    if (!el) return true;
    const style = window.getComputedStyle(el);
    return style.display === 'none' || el.offsetParent === null;
  }

  function isVisible(selector) {
    return !isHidden(selector);
  }

  function runTests() {
    const results = [];
    function test(name, pass, detail) {
      results.push({ name: name, pass: Boolean(pass), detail: detail || '' });
    }

    // 1. Initial Mode should be section and have toolbar visible
    test('Init section toolbar visible', isVisible('.app-toolbar'));
    test('Init section header-right visible', isVisible('.header-right'));

    // 2. Switch to Focus mode
    press('2');
    test('Mode is focus', state.currentMode === 'focus');

    // 3. Verify Extreme Minimalism (Hidden elements in Focus Mode)
    test('Toolbar hidden in focus', isHidden('.app-toolbar'));
    test('Header right items hidden in focus', isHidden('.header-right'));
    test('Smart tag bar hidden in focus', isHidden('#smart-tag-bar-container'));
    test('Focus top bar hidden in focus', isHidden('.focus-top-bar'));

    // 4. Verify Pure Zen Space (Header completely hidden, Footer controls hidden, Soul quote visible)
    test('App header hidden in focus', isHidden('.app-header-smart'));
    test('Focus footer controls (JK hint) hidden in focus', isHidden('.focus-footer-controls'));
    test('Soul quote container visible in focus', isVisible('#focus-soul-quote-container'));
    test('Soul quote text is rendered', document.getElementById('focus-soul-quote-text') && document.getElementById('focus-soul-quote-text').textContent.length > 0);

    // 5. Verify Mindset Banner Text for count 1 (\u30B9\u30FC\u30D1\u30FC\u30D5\u30A9\u30FC\u30AB\u30B9\u30E2\u30FC\u30C9...)
    setFocusCount(1);
    const banner = document.getElementById('focus-mindset-banner');
    test('Mindset banner exists', banner !== null);
    test('Count 1 text includes mindset statement', 
      banner && banner.textContent.indexOf('\u30B9\u30FC\u30D1\u30FC\u30D5\u30A9\u30FC\u30AB\u30B9\u30E2\u30FC\u30C9') !== -1
    );

    // 6. Verify Mindset Banner Text for count 2 (\u3069\u3063\u3061\u304b\u3089\u3084\u308b\uFF1F)
    press('2'); // cycle to 2
    test('Count 2 text includes question 2', 
      banner && banner.textContent.indexOf('\u3069\u3063\u3061\u304b\u3089\u3084\u308b') !== -1
    );

    // 7. Verify Mindset Banner Text for count 3 (\u3069\u308c\u304b\u3089\u3084\u308b\uFF1F)
    press('2'); // cycle to 3
    test('Count 3 text includes question 3', 
      banner && banner.textContent.indexOf('\u3069\u308c\u304b\u3089\u3084\u308b') !== -1
    );

    // 8. Verify Mode switching works seamlessly from focus mode
    press('1');
    test('Press 1 switches to section', state.currentMode === 'section');
    test('Section header restored', isVisible('.app-header-smart'));
    test('Section toolbar restored', isVisible('.app-toolbar'));
    test('Section header-right restored', isVisible('.header-right'));

    press('3');
    test('Press 3 switches to daily', state.currentMode === 'all');
    test('Daily toolbar restored', isVisible('.app-toolbar'));

    press('2');
    test('Press 2 switches back to focus', state.currentMode === 'focus');
    test('App header hidden again in focus', isHidden('.app-header-smart'));
    test('Toolbar hidden again in focus', isHidden('.app-toolbar'));
    test('Header right hidden again in focus', isHidden('.header-right'));

    const allPassed = results.every(r => r.pass);

    resolve(JSON.stringify({
      allPassed: allPassed,
      results: results
    }));
  }

  check();
})
"@

  $evalCmd = @{
    id = 400
    method = "Runtime.evaluate"
    params = @{
      awaitPromise = $true
      returnByValue = $true
      expression = $jsCode
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
    if ($resText.Contains('"id":400')) {
      Write-Host "EVAL_RESULT_400:"
      Write-Host $resText
      break
    }
  }

} finally {
  if ($ws -and $ws.State -eq 'Open') { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "Done", $ct).Wait() }
  Stop-Process -Id $edge.Id -Force
}
