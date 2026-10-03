(async () => {
  const r = [];

  let retries = 0;
  while ((typeof APP_VERSION === 'undefined' || typeof calculateHabitStreak === 'undefined' || typeof mState === 'undefined') && retries < 50) {
    await new Promise(res => setTimeout(res, 200));
    retries++;
  }

  // 1. Mobile Version Check
  r.push({
    name: 'Mobile APP_VERSION is v1.9.18',
    pass: typeof APP_VERSION !== 'undefined' && APP_VERSION === 'v1.9.18',
    detail: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined'
  });

  const now = new Date();
  function getDateStr(offsetDays) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // 2. Mobile 38-day Streak Habit
  const mobileHabit38 = {
    id: 'M_H040',
    name: '体組成計測(Mobile)',
    targetTimes: 1,
    targetMin: 5,
    recurrence: { type: 'everyday' },
    history: {},
    executionLogs: []
  };
  for (let i = 0; i < 38; i++) {
    mobileHabit38.history[getDateStr(i)] = { done: true, count: 1 };
  }
  const mobStreak38 = calculateHabitStreak(mobileHabit38);
  r.push({
    name: 'Mobile calculateHabitStreak correctly calculates 38-day streak as 38',
    pass: mobStreak38 === 38,
    detail: 'Calculated: ' + mobStreak38
  });

  // 3. Mobile Grace Period = 1 (Today uncompleted)
  const mobileHabitGrace = {
    id: 'M_GRACE',
    name: 'Mobile Grace Habit',
    targetTimes: 1,
    targetMin: 5,
    recurrence: { type: 'everyday' },
    history: {},
    executionLogs: []
  };
  for (let i = 1; i <= 37; i++) {
    mobileHabitGrace.history[getDateStr(i)] = { done: true, count: 1 };
  }
  const mobStreakGrace = calculateHabitStreak(mobileHabitGrace);
  r.push({
    name: 'Mobile Grace Period holds streak at 37 when today is uncompleted',
    pass: mobStreakGrace === 37,
    detail: 'Calculated: ' + mobStreakGrace
  });

  // 4. Mobile Purge check in migrateMobileHabit
  const mobGapHabit = {
    id: 'M_GAP',
    name: 'Mobile Gap Habit',
    targetTimes: 1,
    targetMin: 5,
    history: {
      [getDateStr(0)]: { done: true, count: 1 },
      [getDateStr(3)]: { done: true, count: 1 }
    },
    executionLogs: []
  };
  const migratedMob = migrateMobileHabit(mobGapHabit, 0);
  const mobHasBridge = Object.values(migratedMob.history || {}).some(v => v && v.note === '継続性ブリッジ自律補完');
  const mobGapExists = Boolean(migratedMob.history[getDateStr(1)]);
  r.push({
    name: 'migrateMobileHabit does NOT fabricate fake dates in history',
    pass: !mobHasBridge && !mobGapExists,
    detail: `gapExists: ${mobGapExists}, hasBridge: ${mobHasBridge}`
  });

  return r;
})()
