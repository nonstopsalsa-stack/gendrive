/**
 * Gendrive - Stats & Real-Time Rate Analytics Engine
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Pure Streak Calculation Engine (純粋関数)
// =========================================================================

/**
 * 端末ローカル時刻の YYYY-MM-DD 文字列を取得（タイムゾーンズレ排除）
 */
function getLocalDateString(dateObj = new Date()) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * YYYY-MM-DD 文字列に指定日数を加算/減算した YYYY-MM-DD を返す純粋関数
 */
function shiftDateKey(dateKey, offsetDays) {
  const parts = dateKey.split('-');
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  dt.setDate(dt.getDate() + offsetDays);
  return getLocalDateString(dt);
}

/**
 * 純粋関数: history 配列を受け取り、現在の連続日数（ストリーク数）を算出して返す
 * - 永続化データではなく history 配列のみを受け取って数値を返す Pure Function
 * - 端末ローカル時刻の今日（today）および昨日（yesterday）の YYYY-MM-DD を基準
 * - 「今日完了していれば今日から過去へ連続判定」「今日未完了なら昨日から過去へ連続判定」
 * - 過去の連休（2026-09-22〜2026-09-25等）の特定許容期間を安全にサポート
 *
 * @param {Array<string>|Set<string>|Object} history - YYYY-MM-DD 文字列配列
 * @param {Object} [options] - オプション (todayKey, allowedGraceDates)
 * @returns {number} 連続日数
 */
function calculateStreak(history, options = {}) {
  if (!history) return 0;

  // 1. 高速ルックアップ用 Set の構築
  let historySet;
  if (history instanceof Set) {
    historySet = history;
  } else if (Array.isArray(history)) {
    historySet = new Set();
    for (let i = 0; i < history.length; i++) {
      const item = history[i];
      if (typeof item === 'string') {
        const norm = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(item) : item;
        if (norm) historySet.add(norm.slice(0, 10));
      } else if (item && typeof item === 'object') {
        const d = item.date || item.dateKey || item.completedAt;
        const norm = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(d) : d;
        if (norm) historySet.add(norm.slice(0, 10));
      }
    }
  } else if (typeof history === 'object') {
    historySet = new Set();
    for (const k of Object.keys(history)) {
      const v = history[k];
      if (v === true || (typeof v === 'object' && v !== null && (v.done || v.count > 0 || v.status === 'completed' || (v.durationMin && v.durationMin > 0)))) {
        const norm = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(k) : k;
        if (norm) historySet.add(norm.slice(0, 10));
      }
    }
  } else {
    return 0;
  }

  if (historySet.size === 0) return 0;

  // 2. 基準日およびスケジュール判定関数の取得
  const now = new Date();
  const item = options.item || null;
  const isScheduledFn = typeof options.isScheduled === 'function'
    ? options.isScheduled
    : (item && typeof isHabitScheduledForDate === 'function' ? isHabitScheduledForDate : null);

  // 3. 確定ルールに基づく連続日数スキャン (Stateless Deterministic Engine)
  let streak = 0;
  const maxDays = options.maxDays || 365;

  for (let i = 0; i < maxDays; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${day}`;

    const isDone = historySet.has(key);
    const isScheduled = isScheduledFn ? isScheduledFn(item, d) : true;

    if (i === 0) {
      // 確定ルール1: 当日未完了バッファ (Grace Period = 1)
      // 今日がまだ未完了（朝一番など）でも、昨日まで継続していればストリークは前日までの日数を維持して表示
      if (isDone) {
        streak++;
      }
    } else {
      if (isDone) {
        streak++;
      } else if (!isScheduled) {
        // 確定ルール2: 非スケジュール日の保護
        // 平日限定タスクなどの非スケジュール日（土日など）はサボりではなくスキップとして扱いチェーンを切断しない
        continue;
      } else {
        // スケジュール日で未完了 -> チェーン切断
        break;
      }
    }
  }

  return streak;
}

/**
 * ハビットオブジェクトからストリーク数を取得する純粋関数のラッパー
 */
function getHabitCurrentStreak(habit) {
  if (!habit) return 0;
  if (typeof window !== 'undefined' && typeof window.calculateDeterministicStreak === 'function' && typeof window.getHabitCompletedDatesSet === 'function') {
    const dates = window.getHabitCompletedDatesSet(habit);
    return window.calculateDeterministicStreak(dates, habit, typeof isHabitScheduledForDate === 'function' ? isHabitScheduledForDate : null);
  }
  return calculateStreak(habit.history, { item: habit });
}

// グローバル公開
if (typeof window !== 'undefined') {
  window.calculateStreak = calculateStreak;
  window.getHabitCurrentStreak = getHabitCurrentStreak;
}

// =========================================================================
// 2. Habit Elapsed Days & Rate Calculation
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

// リアルタイム達成度再計算（Event Sourcing配列 & 従来オブジェクト両対応）
function recalculateHabitRates(habit) {
  if (!habit) return;
  if (!habit.history) habit.history = [];
  if (!habit.stats) habit.stats = {};

  const rec = habit.recurrence || { type: 'everyday' };
  const elapsedDays = getHabitElapsedDays(habit);

  // 配列（Event Sourcing）とオブジェクト（互換）の両対応チェック
  let historySet = null;
  if (Array.isArray(habit.history)) {
    historySet = new Set(habit.history);
  }

  const isEntryDone = (key) => {
    if (!key) return false;
    if (historySet) {
      return historySet.has(key);
    }
    if (habit.history && typeof habit.history === 'object') {
      const entry = habit.history[key];
      if (entry === true) return true;
      if (typeof entry === 'object' && entry !== null) {
        return Boolean(entry.done || (entry.count && entry.count > 0));
      }
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
        const key = typeof getDateKeyOffset === 'function' ? getDateKeyOffset(i) : shiftDateKey(getLocalDateString(new Date()), -i);
        if (isEntryDone(key)) {
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

        if (typeof isHabitScheduledForDate === 'function' ? isHabitScheduledForDate(habit, d) : true) {
          scheduledDays++;
          const key = typeof getDateKeyOffset === 'function' ? getDateKeyOffset(i) : shiftDateKey(getLocalDateString(new Date()), -i);
          if (isEntryDone(key)) {
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
// 3. Rate Badge Classes & Styling Helpers
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
