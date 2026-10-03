(async () => {
  const r = [];

  // 0. Wait for environment
  let retries = 0;
  while ((typeof APP_VERSION === 'undefined' || typeof getHabitCurrentStreak === 'undefined' || typeof state === 'undefined') && retries < 50) {
    await new Promise(res => setTimeout(res, 200));
    retries++;
  }

  // Test 1: Version check
  r.push({
    name: 'APP_VERSION is v1.9.18',
    pass: typeof APP_VERSION !== 'undefined' && APP_VERSION === 'v1.9.18',
    detail: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined'
  });

  // Test 2: Console / Syntax Errors check
  const errors = window.__ERRORS__ || [];
  r.push({
    name: 'Zero Console/Syntax Errors on initialization',
    pass: errors.length === 0,
    detail: errors.join('; ')
  });

  // Helper date generator relative to today
  const now = new Date();
  function getDateStr(offsetDays) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Test 3: 38-day Streak Habit (e.g. 体組成計測 scenario: exactly 38 consecutive days from 37 days ago through today)
  const habit38d = {
    id: 'H040',
    name: '体組成計測',
    targetTimes: 1,
    targetMin: 5,
    recurrence: { type: 'everyday' },
    history: {},
    executionLogs: []
  };
  for (let i = 0; i < 38; i++) {
    habit38d.history[getDateStr(i)] = { done: true, count: 1, durationMin: 5 };
  }
  const streak38 = getHabitCurrentStreak(habit38d);
  r.push({
    name: 'Habit (体組成計測) 38-day consecutive streak is correctly calculated as 38',
    pass: streak38 === 38,
    detail: 'Calculated: ' + streak38
  });

  // Test 4: Grace Period = 1 (Today not yet completed, yesterday was completed)
  // Morning scenario: streak holds at 37, does NOT reset to 0 or '-'
  const habitGrace = {
    id: 'H_GRACE',
    name: '朝一番・当日未完了ハビット',
    targetTimes: 1,
    targetMin: 5,
    recurrence: { type: 'everyday' },
    history: {},
    executionLogs: []
  };
  for (let i = 1; i <= 37; i++) {
    habitGrace.history[getDateStr(i)] = { done: true, count: 1 };
  }
  // getDateStr(0) is intentionally NOT done
  const streakGrace = getHabitCurrentStreak(habitGrace);
  r.push({
    name: 'Grace Period holds streak (37 days) when today is uncompleted (no 0 or reset)',
    pass: streakGrace === 37,
    detail: 'Calculated: ' + streakGrace
  });

  // Test 5: Broken Streak (Both today and yesterday uncompleted) -> resets to 0
  const habitBroken = {
    id: 'H_BROKEN',
    name: '途切れたハビット',
    targetTimes: 1,
    targetMin: 5,
    recurrence: { type: 'everyday' },
    history: {},
    executionLogs: []
  };
  for (let i = 2; i <= 10; i++) {
    habitBroken.history[getDateStr(i)] = { done: true, count: 1 };
  }
  // i=0 (today) and i=1 (yesterday) are NOT done
  const streakBroken = getHabitCurrentStreak(habitBroken);
  r.push({
    name: 'Streak resets to 0 when yesterday was also missed (no fake continuation)',
    pass: streakBroken === 0,
    detail: 'Calculated: ' + streakBroken
  });

  // Test 6: Non-scheduled day protection (e.g. Weekdays only habit over the weekend)
  const weekdayHabit = {
    id: 'H_WEEKDAY',
    name: '平日限定ハビット',
    targetTimes: 1,
    targetMin: 15,
    recurrence: { type: 'business_days' },
    history: {},
    executionLogs: []
  };
  let expectedWeekdayStreak = 0;
  for (let i = 1; i <= 30; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const isWeekend = (d.getDay() === 0 || d.getDay() === 6);
    if (!isWeekend) {
      weekdayHabit.history[getDateStr(i)] = { done: true, count: 1 };
      expectedWeekdayStreak++;
    }
  }
  const streakWeekday = getHabitCurrentStreak(weekdayHabit);
  r.push({
    name: 'Non-scheduled days (weekends) are protected and do not break chain',
    pass: streakWeekday === expectedWeekdayStreak && streakWeekday > 0,
    detail: `Calculated: ${streakWeekday}, Expected: ${expectedWeekdayStreak}`
  });

  // Test 7: Autonomous Gap Filling (Continuity Bridge) is COMPLETELY PURGED from migrateHabit
  const habitWithGap = {
    id: 'H_GAP_TEST',
    name: 'Gap Test Habit',
    targetTimes: 1,
    targetMin: 5,
    history: {
      [getDateStr(0)]: { done: true, count: 1 },
      // gap of 2 days
      [getDateStr(3)]: { done: true, count: 1 }
    },
    executionLogs: []
  };
  const migratedGap = migrateHabit(habitWithGap, 0);
  const hasBridgeNoteInHistory = Object.values(migratedGap.history || {}).some(v => v && v.note === '継続性ブリッジ自律補完');
  const hasBridgeNoteInLogs = (migratedGap.executionLogs || []).some(l => l && (l.note === '継続性ブリッジ自律補完' || (typeof l.id === 'string' && l.id.startsWith('bridge_log_'))));
  const gapKey1Exists = Boolean(migratedGap.history[getDateStr(1)]);
  const gapKey2Exists = Boolean(migratedGap.history[getDateStr(2)]);

  r.push({
    name: 'migrateHabit does NOT fabricate fake dates in history (no continuity bridge)',
    pass: !hasBridgeNoteInHistory && !hasBridgeNoteInLogs && !gapKey1Exists && !gapKey2Exists,
    detail: `gap1: ${gapKey1Exists}, gap2: ${gapKey2Exists}, bridgeNote: ${hasBridgeNoteInHistory}`
  });

  // Test 8: Autonomous Gap Filling is COMPLETELY PURGED from sanitizeTasksDates
  const taskWithGap = {
    id: 'T_GAP_TEST',
    title: 'Gap Test Recurring Task',
    type: 'recurring',
    history: [
      { date: getDateStr(0), durationMin: 15 },
      // gap of 3 days
      { date: getDateStr(4), durationMin: 15 }
    ]
  };
  sanitizeTasksDates([taskWithGap]);
  const taskHasBridgeNote = taskWithGap.history.some(h => h && h.note === '継続性ブリッジ自律補完');
  const taskDatesCount = taskWithGap.history.length;
  r.push({
    name: 'sanitizeTasksDates does NOT fabricate fake task dates in history',
    pass: !taskHasBridgeNote && taskDatesCount === 2,
    detail: `count: ${taskDatesCount}, hasBridge: ${taskHasBridgeNote}`
  });

  // Test 9: Scoreboard UI Rendering (Analytics View renders 38-day streak properly)
  state.habits = [habit38d, habitGrace];
  state.tasks = [taskWithGap];
  state.masterSubtab = 'analytics';
  if (typeof renderTableAnalyticsView === 'function') renderTableAnalyticsView();

  const streakCells = document.querySelectorAll('.col-ana-streak');
  let found38 = false;
  streakCells.forEach(cell => {
    const text = cell.textContent.trim();
    if (text.includes('38') || text === '38') found38 = true;
  });

  r.push({
    name: 'Scoreboard UI properly renders "38" streak in table row',
    pass: found38,
    detail: 'Found 38: ' + found38
  });

  return r;
})()
