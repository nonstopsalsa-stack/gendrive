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

  // Test 3: Real Backup Habit H040 (体組成計測) 38-day streak restoration
  // Exact data from gendrive_backup_38days_2026-09-30.json
  const realBackupH040 = {
    id: "H040",
    name: "体組成計測",
    displayType: "section",
    section: "第1セッション",
    repeatType: "everyday",
    targetMin: 5,
    recurrence: { type: "everyday" },
    status: "completed",
    createdAt: "2026-08-24T05:28:13.702Z",
    history: [
      "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28", "2026-08-29", "2026-08-30", "2026-08-31",
      "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08",
      "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14", "2026-09-15", "2026-09-16",
      "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24",
      "2026-09-25", "2026-09-27", "2026-09-28", "2026-09-29", "2026-09-30"
    ],
    executionLogs: [
      { id: "hlog_1790720261844_6v0j", dateKey: "2026-09-30", completedAt: "2026-09-29T22:17:41.844Z", count: 1, durationMin: 5, note: "" },
      { id: "hlog_1790637609216_bzf5", dateKey: "2026-09-29", completedAt: "2026-09-28T23:20:09.216Z", count: 1, durationMin: 5, note: "" },
      { id: "hlog_1790542433594_bhg8", dateKey: "2026-09-28", completedAt: "2026-09-27T20:53:53.594Z", count: 1, durationMin: 5, note: "" },
      { id: "hlog_1790482166280_8wjb", dateKey: "2026-09-27", completedAt: "2026-09-27T04:09:26.280Z", count: 1, durationMin: 1, note: "" },
      { id: "hlog_1789937467603_km39", dateKey: "2026-09-21", completedAt: "2026-09-20T20:51:07.603Z", count: 1, durationMin: 5, note: "" },
      { id: "hlog_1789848594702_qaph", dateKey: "2026-09-20", completedAt: "2026-09-19T20:09:54.702Z", count: 1, durationMin: 1, note: "" },
      { id: "hlog_1789769697988_9mmq", dateKey: "2026-09-19", completedAt: "2026-09-18T22:14:57.988Z", count: 1, durationMin: 5, note: "" },
      { id: "hlog_1788994220166_2fzl", dateKey: "2026-09-10", completedAt: "2026-09-09T22:50:20.166Z", count: 1, durationMin: 5, note: "" },
      { id: "hlog_1788923195811_50v0", dateKey: "2026-09-09", completedAt: "2026-09-09T03:06:35.811Z", count: 1, durationMin: 5, note: "" },
      { id: "hlog_1788803283704_mw5u", dateKey: "2026-09-08", completedAt: "2026-09-07T17:48:03.704Z", count: 1, durationMin: 1, note: "" },
      { id: "hlog_1788719798508_v6wx", dateKey: "2026-09-07", completedAt: "2026-09-06T18:36:38.508Z", count: 1, durationMin: 1, note: "" },
      { id: "hlog_1788643564505_5sfc", dateKey: "2026-09-06", completedAt: "2026-09-05T21:26:04.505Z", count: 1, durationMin: 5, note: "" },
      { id: "hlog_1788557473271_vu8a", dateKey: "2026-09-05", completedAt: "2026-09-04T21:31:13.270Z", count: 1, durationMin: 5, note: "" },
      { id: "hlog_1788476029963_oijt", dateKey: "2026-09-04", completedAt: "2026-09-03T22:53:49.963Z", count: 1, durationMin: 1, note: "" },
      { id: "hlog_1788385618674_0zk1", dateKey: "2026-09-03", completedAt: "2026-09-02T21:46:58.674Z", count: 1, durationMin: 5, note: "" },
      { id: "hlog_1788298771507_klgt", dateKey: "2026-09-02", completedAt: "2026-09-01T21:39:31.507Z", count: 1, durationMin: 1, note: "" },
      { id: "hlog_1788209729606_mj51", dateKey: "2026-09-01", completedAt: "2026-08-31T20:55:29.605Z", count: 1, durationMin: 5, note: "" },
      { id: "hlog_1788122779757_7vre", dateKey: "2026-08-31", completedAt: "2026-08-30T20:46:19.756Z", count: 1, durationMin: 5, note: "" },
      { id: "hlog_1788039281399_5v99", dateKey: "2026-08-30", completedAt: "2026-08-29T21:34:41.399Z", count: 1, durationMin: 5, note: "" },
      { id: "hlog_1787864173615_r7vq", dateKey: "2026-08-28", completedAt: "2026-08-27T20:56:13.615Z", count: 1, durationMin: 1, note: "" },
      { id: "hlog_1787777131148_ko1c", dateKey: "2026-08-27", completedAt: "2026-08-26T20:45:31.148Z", count: 1, durationMin: 1, note: "" },
      { id: "salvage_20260826_H040", dateKey: "2026-08-26", completedAt: "2026-08-26T06:00:00.000Z", count: 1, durationMin: 5, status: "completed", note: "自動サルベージ復旧 (昨日の実行実績)" },
      { id: "hlog_1787603264240_ic02", dateKey: "2026-08-25", completedAt: "2026-08-24T20:27:44.240Z", count: 1, durationMin: 1, note: "" },
      { id: "hlog_1787554077968_y3og", dateKey: "2026-08-24", completedAt: "2026-08-24T06:47:57.968Z", count: 1, durationMin: 1, note: "" }
    ]
  };

  const migratedH040 = migrateHabit(realBackupH040, 0);
  const streak38 = getHabitCurrentStreak(migratedH040);
  r.push({
    name: 'Habit (体組成計測) 38-day consecutive streak is correctly calculated as 38',
    pass: streak38 === 38,
    detail: 'Calculated: ' + streak38
  });

  // Test 4: Grace Period = 1 (Today not yet completed, yesterday was completed)
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

  // Test 7: Zero fabricated fake dates in history
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

  // Test 8: Zero fabricated fake dates in sanitizeTasksDates
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
  state.habits = [migratedH040, habitGrace];
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
    name: 'Scoreboard UI properly renders "38" streak in table row for 体組成計測',
    pass: found38,
    detail: 'Found 38 in DOM: ' + found38
  });

  return r;
})()
