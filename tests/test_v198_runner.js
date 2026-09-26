(async () => {
  const tests = [];
  function assert(name, condition, extra) {
    tests.push({ name: name, pass: Boolean(condition), extra: String(extra || '') });
  }

  window.confirm = () => true;
  window.alert = () => {};
  window.prompt = () => null;

  let retries = 0;
  while ((typeof migrateHabit === 'undefined' || typeof state === 'undefined' || typeof sanitizeDailyState === 'undefined' || typeof renderTableAnalyticsView === 'undefined') && retries < 50) {
    await new Promise(r => setTimeout(r, 200));
    retries++;
  }

  // 1. Version check
  assert("Test 1: APP_VERSION is v1.9.8", typeof APP_VERSION !== 'undefined' && APP_VERSION === 'v1.9.8', typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined');

  // 2. Zero Hardcoded Salvage Verification (migrateHabit does NOT inject fake dates)
  const incompleteHabit = {
    id: 'H_HONEST_TEST',
    name: 'Honest Habit Without Fake Salvage',
    targetTimes: 1,
    targetMin: 5,
    history: {
      '2026-09-20': { done: true, count: 1 },
      '2026-09-21': { done: true, count: 1 }
    },
    executionLogs: []
  };
  const migratedIncomplete = migrateHabit(incompleteHabit, 0);
  assert("Test 2A: migrateHabit does NOT inject fake 2026-09-22", !migratedIncomplete.history['2026-09-22'], "Key 2026-09-22 existed!");
  assert("Test 2B: migrateHabit does NOT inject fake 2026-09-23", !migratedIncomplete.history['2026-09-23'], "Key 2026-09-23 existed!");
  assert("Test 2C: migrateHabit does NOT inject fake 2026-09-24", !migratedIncomplete.history['2026-09-24'], "Key 2026-09-24 existed!");

  // 3. Natural Streak Integrity (31-day authentic streak is preserved 100%)
  const honest31DayHabit = {
    id: 'H_HONEST_31',
    name: '31-Day Consecutive Authentic Habit',
    targetTimes: 1,
    targetMin: 5,
    history: {},
    executionLogs: []
  };
  // Populate authentic 31 consecutive days: 2026-08-25 through 2026-09-24
  for (let d = 25; d <= 31; d++) {
    const k = '2026-08-' + String(d).padStart(2, '0');
    honest31DayHabit.history[k] = { done: true, count: 1, durationMin: 15 };
  }
  for (let d = 1; d <= 24; d++) {
    const k = '2026-09-' + String(d).padStart(2, '0');
    honest31DayHabit.history[k] = { done: true, count: 1, durationMin: 15 };
  }

  const migrated31 = migrateHabit(honest31DayHabit, 1);
  const streak31 = getHabitCurrentStreak(migrated31);
  assert("Test 3A: Natural 31-day streak is accurately >= 30", streak31 >= 30, "Streak was: " + streak31);

  // 4. ExecutionLogs general integrity mapping (date-agnostic, zero-hardcode)
  const habitWithLogs = {
    id: 'H_LOG_MAPPING',
    name: 'Habit With Execution Logs',
    targetTimes: 1,
    targetMin: 5,
    history: {},
    executionLogs: [
      { id: 'log_1', dateKey: '2026-09-23', status: 'completed', count: 1, durationMin: 10 },
      { id: 'log_2', completedAt: '2026-09-24T10:00:00.000Z', status: 'completed', count: 1, durationMin: 20 }
    ]
  };
  const migratedFromLogs = migrateHabit(habitWithLogs, 2);
  assert("Test 4A: General executionLogs integrity heals 2026-09-23", Boolean(migratedFromLogs.history['2026-09-23'] && migratedFromLogs.history['2026-09-23'].done));
  assert("Test 4B: General executionLogs integrity heals 2026-09-24", Boolean(migratedFromLogs.history['2026-09-24'] && migratedFromLogs.history['2026-09-24'].done));

  // 5. Recurring Task sanitizeTasksDates has ZERO fake date injection
  const recTask = {
    id: 'T_REC_HONEST',
    title: 'Honest Recurring Task',
    type: 'recurring',
    history: [
      { date: '2026-09-20', durationMin: 15 },
      { date: '2026-09-21', durationMin: 15 }
    ]
  };
  const sanitizedTasks = sanitizeTasksDates([recTask]);
  const taskDates = sanitizedTasks[0].history.map(h => typeof h === 'object' ? h.date : h);
  assert("Test 5A: sanitizeTasksDates does NOT inject fake 2026-09-22", !taskDates.includes('2026-09-22'), "Found: " + taskDates.join(','));
  assert("Test 5B: sanitizeTasksDates does NOT inject fake 2026-09-24", !taskDates.includes('2026-09-24'), "Found: " + taskDates.join(','));

  // 6. Ghost Timer Sanitization (overdue/past-day timers safely uncompleted)
  const yesterdayNoon = Date.now() - (26 * 60 * 60 * 1000);
  const ghostTask = {
    id: 'T_GHOST_TEST',
    title: 'Ghost Task From Yesterday',
    type: 'recurring',
    status: 'in_progress',
    startTimestamp: yesterdayNoon,
    accumulatedSeconds: 0
  };
  const sanitizedGhost = sanitizeTasksDates([ghostTask]);
  assert("Test 6A: Overdue past-day in_progress task reset to uncompleted", sanitizedGhost[0].status === 'uncompleted', "Status: " + sanitizedGhost[0].status);
  assert("Test 6B: startTimestamp cleared to null", sanitizedGhost[0].startTimestamp === null, "startTimestamp: " + sanitizedGhost[0].startTimestamp);

  // 7. Cloud Deep Merge Zero Rollback
  const localHabits = [{ id: 'H1', status: 'completed', history: { '2026-09-25': { done: true } } }];
  const cloudHabits = [{ id: 'H1', status: 'uncompleted', history: {} }];
  const mergedHabits = mergeHabitsDeep(localHabits, cloudHabits);
  assert("Test 7A: Completed habit is protected against cloud uncompleted rollback", mergedHabits[0].status === 'completed');

  // 8. Task Presets Deep-Merge Defense
  const localPresets = [
    { id: 'custom_1', title: 'Custom Preset 1' },
    { id: 'custom_2', title: 'Custom Preset 2' }
  ];
  const sampleCloudPresets = DEFAULT_TASK_PRESETS.slice(0, 6);
  const mergedPresets = mergeTaskPresetsDeep(localPresets, sampleCloudPresets);
  assert("Test 8A: Local presets are retained during cloud merge", mergedPresets.some(p => p.id === 'custom_1'));
  assert("Test 8B: Total presets count exceeds sample 6", mergedPresets.length > 6, "Count was: " + mergedPresets.length);

  // 9. Scoreboard KPI displays authentic 30+ days streak
  state.habits = [migrated31];
  state.masterSubtab = 'analytics';
  if (typeof renderTableAnalyticsView === 'function') renderTableAnalyticsView();
  const maxStreakValueEl = document.querySelector('#analytics-kpi-row .analytics-kpi-card:nth-child(2) .kpi-value');
  const maxStreakValue = maxStreakValueEl ? maxStreakValueEl.textContent.trim() : '';
  assert("Test 9A: Scoreboard KPI displays 30+ days streak", maxStreakValue.includes('30') || maxStreakValue.includes('31'), "KPI streak was: " + maxStreakValue);

  return tests;
})();
