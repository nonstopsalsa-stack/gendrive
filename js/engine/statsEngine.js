/**
 * Gendrive - Stats & Real-Time Rate Analytics Engine
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Habit Elapsed Days & Rate Calculation
// =========================================================================

// ハビットの運用開始からの経過日数（1日目、2日目、...）を算出
function getHabitElapsedDays(habit) {
  if (!habit) return 1;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let createdDate = habit.createdAt ? new Date(habit.createdAt) : null;
  if (!createdDate || isNaN(createdDate.getTime())) {
    createdDate = new Date('2026-08-18T00:00:00.000Z');
  }
  createdDate.setHours(0, 0, 0, 0);

  const diffMs = now.getTime() - createdDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays + 1);
}

// リアルタイム達成度再計算（運用経過日数と期間日数の小さい方を分母とし、未完了・完了をリアルタイムに反映）
function recalculateHabitRates(habit) {
  if (!habit) return;
  if (!habit.history) habit.history = {};
  if (!habit.stats) habit.stats = {};

  const rec = habit.recurrence || { type: 'everyday' };
  const elapsedDays = getHabitElapsedDays(habit);

  const isEntryDone = (entry) => {
    if (entry === true) return true;
    if (typeof entry === 'object' && entry !== null) {
      return Boolean(entry.done || (entry.count && entry.count > 0));
    }
    return false;
  };

  // 1. Weekly Goal Rate Calculation (週N回目標)
  if (rec.type === 'weekly_goal') {
    const timesPerWeek = Math.max(1, Number(rec.timesPerWeek) || 3);

    const calcWeeklyRate = (daysWindow) => {
      const effectiveDays = Math.max(1, Math.min(daysWindow, elapsedDays));
      let totalCompleted = 0;
      for (let i = 0; i < effectiveDays; i++) {
        const key = getDateKeyOffset(i);
        if (isEntryDone(habit.history[key])) {
          totalCompleted++;
        }
      }
      const targetCount = Math.max(1, Math.round(timesPerWeek * (effectiveDays / 7)));
      return Math.min(100, Math.round((totalCompleted / targetCount) * 100));
    };

    const r3 = calcWeeklyRate(3);
    const r7 = calcWeeklyRate(7);
    const r30 = calcWeeklyRate(30);
    const r90 = calcWeeklyRate(90);

    habit.stats.d3 = r3 / 100;
    habit.stats.d7 = r7 / 100;
    habit.stats.d30 = r30 / 100;
    habit.stats.d90 = r90 / 100;
    habit.stats.sevenDay = habit.stats.d7;
    habit.stats.thirtyDay = habit.stats.d30;
    habit.stats.ninetyDay = habit.stats.d90;
  } else {
    // 2. Standard Schedule Rate Calculation (毎日 / 曜日指定 / 間隔など)
    const calcPeriodRate = (daysWindow) => {
      const effectiveDays = Math.max(1, Math.min(daysWindow, elapsedDays));
      let completedCount = 0;
      let scheduledDays = 0;

      for (let i = 0; i < effectiveDays; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);

        if (isHabitScheduledForDate(habit, d)) {
          scheduledDays++;
          const key = getDateKeyOffset(i);
          if (isEntryDone(habit.history[key])) {
            completedCount++;
          }
        }
      }

      if (scheduledDays === 0) return 0;
      return Math.min(100, Math.round((completedCount / scheduledDays) * 100));
    };

    const r3 = calcPeriodRate(3);
    const r7 = calcPeriodRate(7);
    const r30 = calcPeriodRate(30);
    const r90 = calcPeriodRate(90);

    habit.stats.d3 = r3 / 100;
    habit.stats.d7 = r7 / 100;
    habit.stats.d30 = r30 / 100;
    habit.stats.d90 = r90 / 100;
    habit.stats.sevenDay = habit.stats.d7;
    habit.stats.thirtyDay = habit.stats.d30;
    habit.stats.ninetyDay = habit.stats.d90;
  }

  // Determine Tier
  const r30Val = Math.round((habit.stats.d30 || 0) * 100);
  if (r30Val >= 90) habit.stats.tier = '💎 Diamond';
  else if (r30Val >= 80) habit.stats.tier = '🥇 Gold';
  else if (r30Val >= 65) habit.stats.tier = '🥈 Silver';
  else if (r30Val >= 50) habit.stats.tier = '🥉 Bronze';
  else if (r30Val >= 30) habit.stats.tier = '🌱 Developing';
  else habit.stats.tier = '⚠️ Attention';
}

// 達成度取得関数 (常に最新のstats値を返却)
function getHabitRate(habit, days) {
  if (!habit || !habit.stats) return 0;
  const key = `d${days}`;
  if (habit.stats[key] !== undefined) {
    return Math.round(habit.stats[key] * 100);
  }
  return 0;
}

// =========================================================================
// 2. Rate Badge Classes & Styling Helpers
// =========================================================================

// 100% -> rate-gold, 75%+ -> rate-blue, 50%+ -> rate-yellow, 25%+ -> rate-red, <25% -> rate-black
function getRateBadgeClass(ratePercent) {
  if (ratePercent >= 100) return 'rate-gold';
  if (ratePercent >= 75) return 'rate-blue';
  if (ratePercent >= 50) return 'rate-yellow';
  if (ratePercent >= 25) return 'rate-red';
  return 'rate-black';
}

function getRateClass(ratePercent) {
  return getRateBadgeClass(ratePercent);
}
