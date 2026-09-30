(function() {
  const results = [];
  function assert(name, condition, detail) {
    results.push({ name: name, pass: Boolean(condition), detail: String(detail || '') });
  }

  const btnPrev = document.getElementById('btn-date-prev');
  const btnNext = document.getElementById('btn-date-next');
  const btnTodayEl = document.getElementById('btn-date-today');
  const bannerEl = document.getElementById('past-date-banner');
  const dateTagEl = document.getElementById('header-date-tag');
  const dateTextEl = document.getElementById('header-date-text');

  assert('0-1. Date navigation elements exist', btnPrev && btnNext && btnTodayEl && bannerEl && dateTagEl && dateTextEl);

  // 1. Initial State (Today)
  assert('1-1. Today tag text is "今日"', dateTagEl && dateTagEl.textContent.trim() === '今日', dateTagEl ? dateTagEl.textContent : 'null');
  assert('1-2. Today tag class is date-tag-today', dateTagEl && dateTagEl.className === 'date-tag-today', dateTagEl ? dateTagEl.className : 'null');
  assert('1-3. Banner is hidden today', bannerEl && bannerEl.classList.contains('hidden'), 'Should contain hidden');
  assert('1-4. Today button is hidden', btnTodayEl && btnTodayEl.classList.contains('hidden'), 'Should contain hidden');
  assert('1-5. Header date text contains valid Japanese date', 
    dateTextEl && dateTextEl.textContent.includes('年') && dateTextEl.textContent.includes('月') && dateTextEl.textContent.includes('日'), 
    dateTextEl ? dateTextEl.textContent : 'null');

  // 2. Click Prev (Move to Yesterday)
  btnPrev.click();
  assert('2-1. After Prev click: Yesterday tag text is "昨日"', dateTagEl && dateTagEl.textContent.trim() === '昨日', dateTagEl ? dateTagEl.textContent : 'null');
  assert('2-2. Yesterday tag class is date-tag-past', dateTagEl && dateTagEl.className === 'date-tag-past', dateTagEl ? dateTagEl.className : 'null');
  assert('2-3. Yesterday banner is visible', bannerEl && !bannerEl.classList.contains('hidden'), 'Hidden should be removed');
  assert('2-4. Yesterday banner class is "past-date-banner is-past"', bannerEl && bannerEl.className === 'past-date-banner is-past', bannerEl ? bannerEl.className : 'null');
  assert('2-5. Yesterday banner text has 過去日 and 昨日', 
    bannerEl && bannerEl.innerHTML.includes('過去日（<b>') && bannerEl.innerHTML.includes('(昨日)</b>）の実行記録モードです。過去の完了実績を確認・修正できます。'), 
    bannerEl ? bannerEl.innerHTML : 'null');
  assert('2-6. Yesterday banner contains calendar emoji 📅', bannerEl && bannerEl.innerHTML.includes('📅'), bannerEl ? bannerEl.innerHTML : 'null');
  assert('2-7. Yesterday banner reset button text is "⟲ 今日の画面に戻る"', 
    bannerEl && bannerEl.innerHTML.includes('⟲ 今日の画面に戻る'), bannerEl ? bannerEl.innerHTML : 'null');
  assert('2-8. Yesterday banner has NO mojibake', 
    bannerEl && !bannerEl.innerHTML.includes('\uFFFD') && !bannerEl.innerHTML.includes('驕主悉'), 
    bannerEl ? bannerEl.innerHTML : 'null');

  // 3. Click Prev again (Move to 2 days ago: 一昨日)
  btnPrev.click();
  assert('3-1. After 2nd Prev click: Tag text is "一昨日"', dateTagEl && dateTagEl.textContent.trim() === '一昨日', dateTagEl ? dateTagEl.textContent : 'null');
  assert('3-2. 2 days ago banner contains "一昨日"', bannerEl && bannerEl.innerHTML.includes('(一昨日)</b>'), bannerEl ? bannerEl.innerHTML : 'null');
  assert('3-3. 2 days ago banner has NO mojibake', 
    bannerEl && !bannerEl.innerHTML.includes('\uFFFD') && !bannerEl.innerHTML.includes('荳€譏ｨ譌･'), 
    bannerEl ? bannerEl.innerHTML : 'null');

  // 4. Click Reset Button in Banner (Return to Today)
  const btnReset = document.getElementById('btn-banner-reset');
  assert('4-1. Reset button exists in banner', Boolean(btnReset));
  if (btnReset) btnReset.click();
  assert('4-2. After banner reset click: Tag text is "今日"', dateTagEl && dateTagEl.textContent.trim() === '今日', dateTagEl ? dateTagEl.textContent : 'null');
  assert('4-3. After banner reset click: Banner is hidden', bannerEl && bannerEl.classList.contains('hidden'), 'Should be hidden');

  // 5. Click Next (Move to Tomorrow: 明日)
  btnNext.click();
  assert('5-1. After Next click: Tomorrow tag text is "明日"', dateTagEl && dateTagEl.textContent.trim() === '明日', dateTagEl ? dateTagEl.textContent : 'null');
  assert('5-2. Tomorrow tag class is date-tag-future', dateTagEl && dateTagEl.className === 'date-tag-future', dateTagEl ? dateTagEl.className : 'null');
  assert('5-3. Tomorrow banner is visible', bannerEl && !bannerEl.classList.contains('hidden'), 'Hidden should be removed');
  assert('5-4. Tomorrow banner class is "past-date-banner is-future"', bannerEl && bannerEl.className === 'past-date-banner is-future', bannerEl ? bannerEl.className : 'null');
  assert('5-5. Tomorrow banner contains 未来日 and 明日', 
    bannerEl && bannerEl.innerHTML.includes('未来日（<b>') && bannerEl.innerHTML.includes('(明日)</b>）の事前計画モードです。予定タスクの確認・事前追加ができます。'), 
    bannerEl ? bannerEl.innerHTML : 'null');
  assert('5-6. Tomorrow banner contains schedule emoji 🗓️', bannerEl && bannerEl.innerHTML.includes('🗓️'), bannerEl ? bannerEl.innerHTML : 'null');
  assert('5-7. Tomorrow banner reset button is "⟲ 今日の画面に戻る"', 
    bannerEl && bannerEl.innerHTML.includes('⟲ 今日の画面に戻る'), bannerEl ? bannerEl.innerHTML : 'null');
  assert('5-8. Tomorrow banner has NO mojibake', 
    bannerEl && !bannerEl.innerHTML.includes('\uFFFD') && !bannerEl.innerHTML.includes('譛ｪ譚･'), 
    bannerEl ? bannerEl.innerHTML : 'null');

  // 6. Click Next again (Move to Day After Tomorrow: 明後日)
  btnNext.click();
  assert('6-1. After 2nd Next click: Tag text is "明後日"', dateTagEl && dateTagEl.textContent.trim() === '明後日', dateTagEl ? dateTagEl.textContent : 'null');
  assert('6-2. Day after tomorrow banner contains "明後日"', bannerEl && bannerEl.innerHTML.includes('(明後日)</b>'), bannerEl ? bannerEl.innerHTML : 'null');
  assert('6-3. Day after tomorrow banner has NO mojibake', 
    bannerEl && !bannerEl.innerHTML.includes('\uFFFD') && !bannerEl.innerHTML.includes('譏主ｾ梧律'), 
    bannerEl ? bannerEl.innerHTML : 'null');

  // 7. Click Header Today Button (Return to Today)
  btnTodayEl.click();
  assert('7-1. After header today click: Tag text is "今日"', dateTagEl && dateTagEl.textContent.trim() === '今日', dateTagEl ? dateTagEl.textContent : 'null');
  assert('7-2. After header today click: Banner is hidden', bannerEl && bannerEl.classList.contains('hidden'), 'Should be hidden');

  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  const failed = total - passed;

  return JSON.stringify({
    total: total,
    passed: passed,
    failed: failed,
    allPassed: failed === 0,
    results: results
  });
})();
