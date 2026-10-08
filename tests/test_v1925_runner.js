(async () => {
  const results = [];
  function assert(name, condition, extra) {
    results.push({ name: name, pass: Boolean(condition), extra: String(extra || '') });
  }

  const todayKey = getTodayKey();
  const yesterdayKey = getDateKeyOffset(1);

  // -------------------------------------------------------------
  // Test 1: 朝の未完了による達成度低下の是正 (ハビット)
  // -------------------------------------------------------------
  const history30ExceptToday = [];
  for (let i = 1; i <= 30; i++) {
    history30ExceptToday.push(getDateKeyOffset(i));
  }
  const habitUncompletedToday = {
    id: "TEST_H1",
    name: "朝テスト習慣",
    createdAt: new Date(Date.now() - 50 * 86400000).toISOString(),
    recurrence: { type: "everyday" },
    history: history30ExceptToday
  };
  recalculateHabitRates(habitUncompletedToday);

  assert(
    "Test 1-1: 今日未完了でも昨日まで継続していれば30日達成度は100%",
    getHabitRate(habitUncompletedToday, 30) === 100,
    "rate30: " + getHabitRate(habitUncompletedToday, 30) + "%"
  );
  assert(
    "Test 1-2: 今日未完了でも7日達成度は100%",
    getHabitRate(habitUncompletedToday, 7) === 100,
    "rate7: " + getHabitRate(habitUncompletedToday, 7) + "%"
  );
  assert(
    "Test 1-3: 今日未完了でも3日達成度は100%",
    getHabitRate(habitUncompletedToday, 3) === 100,
    "rate3: " + getHabitRate(habitUncompletedToday, 3) + "%"
  );

  // 今日完了した場合
  const habitCompletedToday = {
    id: "TEST_H2",
    name: "当日完了習慣",
    createdAt: new Date(Date.now() - 50 * 86400000).toISOString(),
    recurrence: { type: "everyday" },
    history: [todayKey, ...history30ExceptToday]
  };
  recalculateHabitRates(habitCompletedToday);
  assert(
    "Test 1-4: 今日完了している場合は今日起点で30日達成度は100%",
    getHabitRate(habitCompletedToday, 30) === 100,
    "rate30: " + getHabitRate(habitCompletedToday, 30) + "%"
  );

  // -------------------------------------------------------------
  // Test 2: ストリークと達成度の完全一致
  // -------------------------------------------------------------
  const history43 = [];
  for (let i = 1; i <= 43; i++) {
    history43.push(getDateKeyOffset(i));
  }
  const habit43Days = {
    id: "TEST_H3",
    name: "43日連続習慣",
    createdAt: new Date(Date.now() - 50 * 86400000).toISOString(),
    recurrence: { type: "everyday" },
    history: history43
  };
  recalculateHabitRates(habit43Days);
  const streak43 = getHabitCurrentStreak(habit43Days);
  assert(
    "Test 2-1: 43日ストリークの算出が43以上であること",
    streak43 >= 43,
    "streak: " + streak43
  );
  assert(
    "Test 2-2: 43日連続の場合、30日達成度は100%",
    getHabitRate(habit43Days, 30) === 100,
    "rate30: " + getHabitRate(habit43Days, 30) + "%"
  );
  assert(
    "Test 2-3: 43日連続の場合、7日達成度は100%",
    getHabitRate(habit43Days, 7) === 100,
    "rate7: " + getHabitRate(habit43Days, 7) + "%"
  );
  assert(
    "Test 2-4: 43日連続の場合、3日達成度は100%",
    getHabitRate(habit43Days, 3) === 100,
    "rate3: " + getHabitRate(habit43Days, 3) + "%"
  );

  // 7日連続のハビット (7日達成度は100%)
  const history7 = [];
  for (let i = 1; i <= 7; i++) {
    history7.push(getDateKeyOffset(i));
  }
  const habit7Days = {
    id: "TEST_H4",
    name: "7日連続習慣",
    createdAt: new Date(Date.now() - 50 * 86400000).toISOString(),
    recurrence: { type: "everyday" },
    history: history7
  };
  recalculateHabitRates(habit7Days);
  assert(
    "Test 2-5: 7日連続の場合、7日達成度は100%",
    getHabitRate(habit7Days, 7) === 100,
    "rate7: " + getHabitRate(habit7Days, 7) + "%"
  );

  // -------------------------------------------------------------
  // Test 3: 90日達成度のフォールバックとタスク計算バグ修正
  // -------------------------------------------------------------
  const habit46Days = {
    id: "TEST_H5",
    name: "46日運用ハビット",
    createdAt: new Date(Date.now() - 46 * 86400000).toISOString(),
    recurrence: { type: "everyday" },
    history: history30ExceptToday
  };
  recalculateHabitRates(habit46Days);
  const r30Habit = getHabitRate(habit46Days, 30);
  const r90Habit = getHabitRate(habit46Days, 90);
  assert(
    "Test 3-1: 90日未満運用のハビットは90日達成度が30日達成度と同一",
    r90Habit === r30Habit,
    "r30: " + r30Habit + "%, r90: " + r90Habit + "%"
  );

  // タスクの90日フォールバック
  const task46Days = {
    id: "TEST_T1",
    title: "46日運用タスク",
    createdAt: new Date(Date.now() - 46 * 86400000).toISOString(),
    status: "uncompleted",
    history: history30ExceptToday.map(d => ({ date: d, done: true }))
  };
  const r30Task = getTaskPeriodRate(task46Days, 30);
  const r90Task = getTaskPeriodRate(task46Days, 90);
  assert(
    "Test 3-2: 90日未満運用のタスクは90日達成度が30日達成度と同一",
    r90Task === r30Task,
    "r30Task: " + r30Task + "%, r90Task: " + r90Task + "%"
  );

  // タスクの分母固定（90日割）欠陥是正テスト:
  const history10 = [];
  for (let i = 1; i <= 10; i++) {
    history10.push(getDateKeyOffset(i));
  }
  const task10Days = {
    id: "TEST_T2",
    title: "10日運用タスク",
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    status: "uncompleted",
    history: history10.map(d => ({ date: d, done: true }))
  };
  const r30Task10 = getTaskPeriodRate(task10Days, 30);
  assert(
    "Test 3-3: 10日運用タスクの30日達成度は分母10で計算され100%",
    r30Task10 === 100,
    "r30Task10: " + r30Task10 + "%"
  );

  // -------------------------------------------------------------
  // Test 4: 実データ検証 (current_gas_habits.json の主要項目)
  // -------------------------------------------------------------
  let realHabits = (window.__realHabitsData && window.__realHabitsData.length) ? window.__realHabitsData : (state.habits || []);

  // スナップショット最新日(2026-09-30)と現在の端末時刻の「昨日」との日差を算出
  const snapshotLatest = new Date('2026-09-30T00:00:00Z');
  const targetYesterday = new Date();
  targetYesterday.setDate(targetYesterday.getDate() - 1);
  targetYesterday.setHours(0, 0, 0, 0);
  const shiftDiffDays = Math.round((targetYesterday.getTime() - snapshotLatest.getTime()) / 86400000);

  const shiftHabitHistory = (h) => {
    const clone = JSON.parse(JSON.stringify(h));
    if (Array.isArray(clone.history)) {
      clone.history = clone.history.map(d => shiftDateKey(d, shiftDiffDays));
    }
    if (clone.createdAt) {
      const cDate = new Date(clone.createdAt);
      cDate.setDate(cDate.getDate() + shiftDiffDays);
      clone.createdAt = cDate.toISOString();
    }
    return clone;
  };

  const h069 = realHabits.find(h => h.id === 'H069');
  const h041 = realHabits.find(h => h.id === 'H041');
  const h040 = realHabits.find(h => h.id === 'H040');

  if (h069) {
    const shifted069 = shiftHabitHistory(h069);
    recalculateHabitRates(shifted069);
    const s = getHabitCurrentStreak(shifted069);
    const r30 = getHabitRate(shifted069, 30);
    assert("Test 4-1: H069 歯磨き (実データ再現) の 30日達成度は100%", r30 === 100, "streak: " + s + ", r30: " + r30 + "%");
  }
  if (h041) {
    const shifted041 = shiftHabitHistory(h041);
    recalculateHabitRates(shifted041);
    const s = getHabitCurrentStreak(shifted041);
    const r30 = getHabitRate(shifted041, 30);
    assert("Test 4-2: H041 ストレッチ (実データ再現) の 30日達成度は100%", r30 === 100, "streak: " + s + ", r30: " + r30 + "%");
  }
  if (h040) {
    const shifted040 = shiftHabitHistory(h040);
    recalculateHabitRates(shifted040);
    const s = getHabitCurrentStreak(shifted040);
    const r7 = getHabitRate(shifted040, 7);
    const r30 = getHabitRate(shifted040, 30);
    const r90 = getHabitRate(shifted040, 90);
    assert("Test 4-3: H040 体組成計測 (実データ再現) の 7日達成度は100%", r7 === 100, "streak: " + s + ", r7: " + r7 + "%");
    assert("Test 4-4: H040 体組成計測の 90日達成度は30日達成度(" + r30 + "%)と一致", r90 === r30, "r30: " + r30 + "%, r90: " + r90 + "%");
  }

  return results;
})();
