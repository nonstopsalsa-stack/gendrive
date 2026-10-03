(() => {
  const r = [];
  r.push({
    name: "Mobile APP_VERSION is v1.9.18",
    pass: typeof APP_VERSION !== 'undefined' && APP_VERSION === 'v1.9.18',
    detail: typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'undefined'
  });

  if (window.__BACKUP_DATA__) {
    const backup = window.__BACKUP_DATA__;
    localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(backup.habits));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(backup.tasks));
    if (typeof loadMobileHabits === 'function') {
      mState.habits = loadMobileHabits();
    }
  }

  const h040 = mState.habits.find(h => h.id === 'H040' || h.name === '体組成計測');
  const streak040 = h040 ? calculateHabitStreak(h040) : 0;
  r.push({
    name: "Mobile calculateHabitStreak correctly calculates 38-day streak as 38",
    pass: streak040 === 38,
    detail: 'Calculated: ' + streak040
  });

  // Grace Period test
  const now = new Date();
  function getDateStr(offsetDays) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const mobGrace = {
    id: 'MOB_GRACE',
    name: 'Mobile Grace',
    targetTimes: 1,
    targetMin: 5,
    history: {},
    executionLogs: []
  };
  for (let i = 1; i <= 37; i++) {
    mobGrace.history[getDateStr(i)] = { done: true, count: 1 };
  }
  const sGrace = calculateHabitStreak(mobGrace);
  r.push({
    name: "Mobile Grace Period holds streak at 37 when today is uncompleted",
    pass: sGrace === 37,
    detail: 'Calculated: ' + sGrace
  });

  return r;
})()
