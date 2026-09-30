(function() {
  const results = [];
  function assert(name, condition, detail) {
    results.push({ name: name, pass: Boolean(condition), detail: String(detail || '') });
  }

  const todayKey = getTodayKey();

  // Test 1: Uncompleted habit with no today logs, _localUpdatedAt older than 120s (e.g. 3 hours ago)
  const habitUncompleted = {
    id: 'h_test_uncompleted_1',
    name: '朝の読書',
    status: 'uncompleted',
    targetTimes: 1,
    targetMin: 15,
    actMin: 0,
    accumulatedSeconds: 0,
    _localUpdatedAt: Date.now() - (3 * 3600 * 1000), // 3 hours ago
    history: { '2026-09-30': { done: true, count: 1 } },
    executionLogs: [
      { id: 'log_past', dateKey: '2026-09-30', completedAt: '2026-09-30T08:00:00.000Z', count: 1, durationMin: 15 }
    ]
  };

  const migrated1 = migrateHabit(JSON.parse(JSON.stringify(habitUncompleted)));
  assert('1-1. Uncompleted habit remains uncompleted after 3 hours', migrated1.status === 'uncompleted', `Got: ${migrated1.status}`);
  assert('1-2. Uncompleted habit has actMin = 0', migrated1.actMin === 0, `Got: ${migrated1.actMin}`);
  assert('1-3. Uncompleted habit has accumulatedSeconds = 0', migrated1.accumulatedSeconds === 0, `Got: ${migrated1.accumulatedSeconds}`);
  assert('1-4. Uncompleted habit does NOT have today in history', !migrated1.history[todayKey], `History today: ${JSON.stringify(migrated1.history[todayKey])}`);

  // Test 2: Zombie / Corrupted habit with status='completed' or dirty history[todayKey], BUT NO today executionLogs
  // This simulates the exact bug condition where habit was marked completed without today logs
  const habitZombie = {
    id: 'h_test_zombie_2',
    name: 'ストレッチ',
    status: 'completed',
    targetTimes: 1,
    targetMin: 7,
    actMin: 7, // corrupted
    accumulatedSeconds: 420,
    _localUpdatedAt: Date.now() - (3 * 3600 * 1000), // 3 hours ago
    history: { [todayKey]: { done: true, count: 1, durationMin: 7 } },
    executionLogs: [] // NO legitimate today log!
  };

  const migrated2 = migrateHabit(JSON.parse(JSON.stringify(habitZombie)));
  assert('2-1. Zombie completed habit is SANITIZED to uncompleted', migrated2.status === 'uncompleted', `Got: ${migrated2.status}`);
  assert('2-2. Zombie habit actMin is reset to 0', migrated2.actMin === 0, `Got: ${migrated2.actMin}`);
  assert('2-3. Zombie habit accumulatedSeconds is reset to 0', migrated2.accumulatedSeconds === 0, `Got: ${migrated2.accumulatedSeconds}`);
  assert('2-4. Zombie habit todayKey is PURGED from history', !migrated2.history[todayKey], `History today: ${JSON.stringify(migrated2.history[todayKey])}`);

  // Test 3: Legitimately completed habit WITH valid today executionLogs
  const habitLegit = {
    id: 'h_test_legit_3',
    name: '英語学習',
    status: 'completed',
    targetTimes: 1,
    targetMin: 20,
    actMin: 22,
    accumulatedSeconds: 0,
    _localUpdatedAt: Date.now() - (3 * 3600 * 1000), // 3 hours ago
    history: {},
    executionLogs: [
      { id: 'log_legit_today', dateKey: todayKey, completedAt: `${todayKey}T06:30:00.000Z`, count: 1, durationMin: 22, status: 'completed' }
    ]
  };

  const migrated3 = migrateHabit(JSON.parse(JSON.stringify(habitLegit)));
  assert('3-1. Legit completed habit remains completed', migrated3.status === 'completed', `Got: ${migrated3.status}`);
  assert('3-2. Legit completed habit has today in history', Boolean(migrated3.history[todayKey]), `History today: ${JSON.stringify(migrated3.history[todayKey])}`);

  // Test 4: Multi-count habit with only 1 of 2 completions (partial)
  const habitMultiPartial = {
    id: 'h_test_multi_4',
    name: '水分補給',
    status: 'uncompleted',
    targetTimes: 2,
    targetMin: 5,
    actMin: 5,
    accumulatedSeconds: 0,
    _localUpdatedAt: Date.now() - (3 * 3600 * 1000),
    history: {},
    executionLogs: [
      { id: 'log_water_1', dateKey: todayKey, completedAt: `${todayKey}T07:00:00.000Z`, count: 1, durationMin: 5 }
    ]
  };

  const migrated4 = migrateHabit(JSON.parse(JSON.stringify(habitMultiPartial)));
  assert('4-1. Multi-count partial habit (1/2) is NOT marked completed', migrated4.status === 'uncompleted', `Got: ${migrated4.status}`);

  // Test 5: Multi-count habit with 2 of 2 completions (goal reached)
  const habitMultiComplete = {
    id: 'h_test_multi_5',
    name: '水分補給',
    status: 'uncompleted',
    targetTimes: 2,
    targetMin: 5,
    actMin: 5,
    accumulatedSeconds: 0,
    _localUpdatedAt: Date.now() - (3 * 3600 * 1000),
    history: {},
    executionLogs: [
      { id: 'log_water_1', dateKey: todayKey, completedAt: `${todayKey}T07:00:00.000Z`, count: 1, durationMin: 5 },
      { id: 'log_water_2', dateKey: todayKey, completedAt: `${todayKey}T10:00:00.000Z`, count: 2, durationMin: 5 }
    ]
  };

  const migrated5 = migrateHabit(JSON.parse(JSON.stringify(habitMultiComplete)));
  assert('5-1. Multi-count habit (2/2) IS marked completed', migrated5.status === 'completed', `Got: ${migrated5.status}`);

  // Test 6: BackupRestoreService isolation test
  // Ensure that backup restore does not inject todayKey into uncompleted habits
  if (typeof salvageHabitHistories === 'function') {
    salvageHabitHistories();
    const storedHabits = JSON.parse(localStorage.getItem(STORAGE_KEYS.HABITS) || '[]');
    const uncompletedWithTodayHistory = storedHabits.filter(h => {
      const logs = Array.isArray(h.executionLogs) ? h.executionLogs.filter(l => l && (l.dateKey === todayKey || (l.completedAt && l.completedAt.startsWith(todayKey)))) : [];
      return logs.length === 0 && h.history && h.history[todayKey];
    });
    assert('6-1. No stored habits have today history without executionLogs', uncompletedWithTodayHistory.length === 0, 
      `Found ${uncompletedWithTodayHistory.length} corrupted habits: ${uncompletedWithTodayHistory.map(h => h.name || h.id).join(', ')}`);
  }

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
