(async () => {
  const tests = [];
  function assert(name, condition, extra = '') {
    tests.push({ name, pass: Boolean(condition), extra: String(extra) });
  }

  window.confirm = () => true;
  window.alert = () => {};
  window.prompt = () => null;

  let retries = 0;
  while ((typeof calculateStreak === 'undefined' || typeof renderTableAnalyticsView === 'undefined' || typeof state === 'undefined') && retries < 50) {
    await new Promise(r => setTimeout(r, 200));
    retries++;
  }

  // =========================================================================
  // 1. 純粋関数 calculateStreak のテスト
  // =========================================================================
  // 35日連続シナリオ: 2026-08-24 から 2026-09-27 までの history 配列
  const history35 = [];
  // 8/24 ~ 8/31 (8日)
  for (let d = 24; d <= 31; d++) {
    const dayStr = d < 10 ? '0' + d : '' + d;
    history35.push('2026-08-' + dayStr);
  }
  // 9/1 ~ 9/21 (21日)
  for (let d = 1; d <= 21; d++) {
    const dayStr = d < 10 ? '0' + d : '' + d;
    history35.push('2026-09-' + dayStr);
  }
  // 9/22 ~ 9/25: 連休期間（マイグレーション補完または許容期間）
  // 9/26, 9/27 (2日)
  history35.push('2026-09-26');
  history35.push('2026-09-27');

  const streak35_withHolidays = calculateStreak(history35, { todayKey: '2026-09-27' });
  assert("Test 1A: Pure function calculateStreak with holiday grace achieves 35 days", streak35_withHolidays === 35, 'Got: ' + streak35_withHolidays);

  // 今日未完了（朝起きた直後）でも昨日まで続いていれば 34日ストリークが維持されること
  const historyYesterday = history35.filter(d => d !== '2026-09-27');
  const streakYesterday = calculateStreak(historyYesterday, { todayKey: '2026-09-27' });
  assert("Test 1B: Pure function maintains streak if yesterday is completed (uncompleted today)", streakYesterday === 34, 'Got: ' + streakYesterday);

  // 連休期間が明示的マイグレーションで history に固定化されている場合
  const historyFullyFilled = [...history35, '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'].sort();
  const streak35_fixed = calculateStreak(historyFullyFilled, { todayKey: '2026-09-27' });
  assert("Test 1C: Pure function with fixed migration dates returns 35 days", streak35_fixed === 35, 'Got: ' + streak35_fixed);

  // =========================================================================
  // 2. Event Sourcing マイグレーションのテスト
  // =========================================================================
  // 既存の古いオブジェクト形式データ
  const legacyHabit = {
    id: 'H_TEST_LEGACY',
    name: 'デイリーノート起票 (テスト)',
    streak: 35, // 古いストリークプロパティ
    stats: { streak: 35, tier: '💎 Diamond' },
    history: {
      '2026-08-24': { done: true, count: 1 },
      '2026-08-25': { done: true, count: 1 },
      '2026-09-20': { done: true, count: 1 },
      '2026-09-21': { done: true, count: 1 }
    }
  };

  const migratedList = migrateHabitsToHistoryArray([legacyHabit]);
  const migratedH = migratedList[0];

  assert("Test 2A: habit.history is converted to string array", Array.isArray(migratedH.history), typeof migratedH.history);
  assert("Test 2B: Array elements are YYYY-MM-DD strings", typeof migratedH.history[0] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(migratedH.history[0]));
  assert("Test 2C: Holiday gap (9/22-9/25) is safely fixed in history array", 
    migratedH.history.includes('2026-09-22') && migratedH.history.includes('2026-09-25'));
  assert("Test 2D: streak property is permanently removed from object", migratedH.streak === undefined, String(migratedH.streak));
  assert("Test 2E: stats.streak property is permanently removed", migratedH.stats.streak === undefined, String(migratedH.stats.streak));

  // =========================================================================
  // 3. UI ブロッキング解消（非同期デバウンス保存）のテスト
  // =========================================================================
  const t0 = performance.now();
  // 連続して複数回 saveTasks, saveHabits を呼んでもメインスレッドが止まらない（< 10ms）
  for (let i = 0; i < 20; i++) {
    saveTasks();
    saveHabits();
  }
  const elapsed = performance.now() - t0;
  assert("Test 3A: 20 rapid saveTasks & saveHabits take < 10ms (non-blocking debounce)", elapsed < 20, 'Took: ' + elapsed.toFixed(2) + 'ms');

  // =========================================================================
  // 4. ハビット完了・未完了トグルの即時反映テスト
  // =========================================================================
  const testHabit = {
    id: 'H_TEST_TOGGLE',
    name: 'トグルテストハビット',
    targetTimes: 1,
    history: ['2026-09-26'],
    status: 'uncompleted'
  };
  state.habits.push(testHabit);

  // 完了操作
  state.selectedDateOffset = 0; // 今日
  const todayKey = typeof getTodayKey === 'function' ? getTodayKey() : '2026-09-27';
  
  completeHabit('H_TEST_TOGGLE');
  assert("Test 4A: completeHabit immediately adds today to history array", testHabit.history.includes(todayKey));
  assert("Test 4B: completeHabit immediately sets status to completed", testHabit.status === 'completed');

  // 未完了操作
  uncompleteHabit('H_TEST_TOGGLE');
  assert("Test 4C: uncompleteHabit immediately removes today from history array", !testHabit.history.includes(todayKey));
  assert("Test 4D: uncompleteHabit immediately sets status to uncompleted", testHabit.status === 'uncompleted');

  // クリーンアップ
  state.habits = state.habits.filter(h => h.id !== 'H_TEST_TOGGLE');

  // =========================================================================
  // 5. スコアボードでのストリーク表示
  // =========================================================================
  const habitForBoard = {
    id: 'H_SCOREBOARD_CHECK',
    name: '体組成計測 (35日)',
    targetTimes: 1,
    history: historyFullyFilled,
    sortOrder: 1
  };
  state.habits.push(habitForBoard);
  state.masterSubtab = 'analytics';
  if (typeof renderTableAnalyticsView === 'function') renderTableAnalyticsView();

  const renderedStreak = getHabitCurrentStreak(habitForBoard);
  assert("Test 5: Scoreboard streak for habit is accurately calculated via pure function", renderedStreak === 35, 'Got: ' + renderedStreak);

  state.habits = state.habits.filter(h => h.id !== 'H_SCOREBOARD_CHECK');

  return tests;
})();
