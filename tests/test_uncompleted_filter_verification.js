(function() {
  const results = [];
  function assert(name, condition, detail) {
    results.push({ name: name, pass: Boolean(condition), detail: String(detail || '') });
  }

  const todayKey = getTodayKey();

  assert('0-1. state.habits exists and has items', Array.isArray(state.habits) && state.habits.length > 0, `Count: ${state.habits ? state.habits.length : 0}`);

  // Test 1: getHabitStatusForSelectedDate for today
  let uncompletedCount = 0;
  let completedCount = 0;
  const corruptedHabits = [];

  state.habits.forEach(h => {
    const st = getHabitStatusForSelectedDate(h);
    const targetTimes = typeof getHabitTargetTimes === 'function' ? getHabitTargetTimes(h) : (h.targetTimes || 1);
    const dayLogs = Array.isArray(h.executionLogs)
      ? h.executionLogs.filter(log => log && (log.dateKey === todayKey || (log.completedAt && log.completedAt.startsWith(todayKey))) && log.status !== 'cancelled')
      : [];
    const curCount = dayLogs.length > 0 ? Math.max(...dayLogs.map(l => l.count || 1)) : 0;
    const hasLegitLog = curCount >= targetTimes && targetTimes > 0;

    if (st === 'completed') {
      completedCount++;
      if (!hasLegitLog) {
        corruptedHabits.push({ id: h.id, name: h.name, curCount, targetTimes });
      }
    } else {
      uncompletedCount++;
    }
  });

  assert('1-1. No habit without legitimate executionLogs is evaluated as completed', corruptedHabits.length === 0,
    `Corrupted habits: ${JSON.stringify(corruptedHabits)}`);
  assert('1-2. Multiple uncompleted habits exist (Not just 1 single habit)', uncompletedCount > 5,
    `Uncompleted: ${uncompletedCount}, Completed: ${completedCount}`);

  // Test 2: Filter verification
  if (typeof renderApp === 'function') {
    renderApp();
  }

  const habitCards = document.querySelectorAll('.habit-card');
  const completedCards = document.querySelectorAll('.habit-card.completed');
  const uncompletedCards = document.querySelectorAll('.habit-card:not(.completed)');

  assert('2-1. Habit cards are rendered in DOM', habitCards.length > 0, `Total cards: ${habitCards.length}`);
  assert('2-2. Uncompleted cards exceed completed cards for fresh morning state', uncompletedCards.length >= completedCards.length,
    `Uncompleted cards: ${uncompletedCards.length}, Completed cards: ${completedCards.length}`);

  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  const failed = total - passed;

  return JSON.stringify({
    total: total,
    passed: passed,
    failed: failed,
    allPassed: failed === 0,
    results: results,
    meta: {
      totalHabits: state.habits.length,
      uncompletedCount: uncompletedCount,
      completedCount: completedCount,
      cardCount: habitCards.length
    }
  });
})();
