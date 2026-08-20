/**
 * Gendrive - Recurrence & Schedule Engine
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Recurrence Matcher & Weekly Counters
// =========================================================================

function getWeeklyCompletionCount(habit, targetDate) {
  const monday = getMondayOfWeek(targetDate);
  let count = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (habit.history && habit.history[key] === true) {
      count++;
    }
  }
  return count;
}

function isHabitScheduledForDate(habit, dateObj) {
  if (!habit) return false;
  const rec = habit.recurrence || { type: 'everyday' };
  const d = dateObj ? new Date(dateObj) : new Date();
  const dayOfWeek = d.getDay(); // 0(日) - 6(土)
  const dayOfMonth = d.getDate(); // 1 - 31

  switch (rec.type) {
    case 'everyday':
      return true;

    case 'daily_times':
      return true;

    case 'business_days':
    case 'weekdays':
      return isBusinessDay(d);

    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;

    case 'custom_days':
      return Array.isArray(rec.days) && rec.days.includes(dayOfWeek);

    case 'weekly_goal': {
      const timesTarget = Number(rec.timesPerWeek) || 3;
      const targetKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      
      // If completed on this specific day, always show (as completed)
      if (habit.history && habit.history[targetKey]) {
        return true;
      }

      // Count completions in this Monday-Sunday week BEFORE this target date
      const monday = getMondayOfWeek(d);
      let weekCompleted = 0;
      for (let i = 0; i < 7; i++) {
        const cur = new Date(monday);
        cur.setDate(cur.getDate() + i);
        const k = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
        if (habit.history && habit.history[k]) {
          weekCompleted++;
        }
      }

      // If already met weekly goal, hide for remaining uncompleted days of the week
      return weekCompleted < timesTarget;
    }

    case 'interval': {
      const interval = Number(rec.intervalDays) || 2;
      if (interval <= 1) return true;
      const start = new Date(habit.createdAt || '2026-05-01');
      start.setHours(0, 0, 0, 0);
      const target = new Date(d);
      target.setHours(0, 0, 0, 0);
      const diffDays = Math.round((target - start) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && (diffDays % interval === 0);
    }

    case 'monthly': {
      const start = new Date(habit.createdAt || '2026-05-01');
      const startMonthIndex = start.getFullYear() * 12 + start.getMonth();
      const curMonthIndex = d.getFullYear() * 12 + d.getMonth();
      const monthInterval = Number(rec.monthInterval) || 1;

      // Month Interval Check
      if ((curMonthIndex - startMonthIndex) % monthInterval !== 0) {
        return false;
      }

      // Timing Rules
      const timingType = rec.timingType || 'specific_day';
      if (timingType === 'specific_day') {
        const targetDay = Number(rec.monthDay) || 1;
        return dayOfMonth === targetDay;
      }
      if (timingType === 'first_business_day') {
        return isFirstBusinessDayOfMonth(d);
      }
      if (timingType === 'last_business_day') {
        return isLastBusinessDayOfMonth(d);
      }
      if (timingType === 'last_day') {
        return isLastDayOfMonth(d);
      }
      return dayOfMonth === 1;
    }

    default:
      return true;
  }
}

// =========================================================================
// 2. Multi-Count & Recurrence UI Helpers
// =========================================================================

function getHabitTargetTimes(habit) {
  if (!habit || !habit.recurrence) return 1;
  if (habit.recurrence.type === 'daily_times') {
    return Math.max(1, parseInt(habit.recurrence.timesPerDay, 10) || 2);
  }
  return 1;
}

function getHabitDayCount(habit, dateKey = null) {
  if (!habit || !habit.history) return 0;
  const dKey = dateKey || getSelectedDateKey();
  const val = habit.history[dKey];
  if (typeof val === 'number') return val;
  if (val === true) return getHabitTargetTimes(habit);
  if (typeof val === 'object' && val !== null) {
    if (typeof val.count === 'number') return val.count;
    if (val.done) return getHabitTargetTimes(habit);
  }
  return 0;
}

function getHabitCompletionProgressHtml(habit, dateKey = null) {
  const target = getHabitTargetTimes(habit);
  if (target <= 1) return '';

  const cur = getHabitDayCount(habit, dateKey);
  const isDone = cur >= target;
  const inProg = cur > 0 && !isDone;

  let dotsHtml = '';
  for (let i = 1; i <= target; i++) {
    dotsHtml += `<span class="daily-times-step-dot ${i <= cur ? 'done' : ''}"></span>`;
  }

  let badgeClass = 'badge-daily-times';
  if (isDone) badgeClass += ' completed-target';
  else if (inProg) badgeClass += ' in-progress';

  return `
    <span class="${badgeClass}" title="本日の進捗: ${cur}/${target}回">
      ⚡ ${cur}/${target}回
      <span class="daily-times-step-dots">${dotsHtml}</span>
    </span>
  `;
}

function getRecurrenceInfo(recurrence) {
  const rec = recurrence || { type: 'everyday' };
  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];
  switch (rec.type) {
    case 'everyday':
      return { type: 'everyday', label: '毎日', icon: '🌐', cls: 'everyday' };
    case 'daily_times':
      return { type: 'daily_times', label: `1日${rec.timesPerDay || 2}回`, icon: '⚡', cls: 'daily-times' };
    case 'business_days':
    case 'weekdays':
      return { type: 'weekdays', label: '平日(祝除く)', icon: '💼', cls: 'weekdays' };
    case 'weekends':
      return { type: 'weekends', label: '週末', icon: '🌴', cls: 'weekends' };
    case 'custom_days': {
      const days = (rec.days || []).map(d => weekdayNames[d]).join('');
      return { type: 'custom_days', label: days || '曜日', icon: '🗓️', cls: 'custom' };
    }
    case 'weekly_goal':
      return { type: 'weekly_goal', label: `週${rec.timesPerWeek || 3}回`, icon: '🎯', cls: 'weekly-goal' };
    case 'interval':
      return { type: 'interval', label: `${rec.intervalDays || 2}日毎`, icon: '⏳', cls: 'interval' };
    case 'monthly': {
      const intStr = rec.monthInterval > 1 ? `${rec.monthInterval}ヶ月毎` : '毎月';
      let timeStr = `${rec.monthDay || 1}日`;
      if (rec.timingType === 'first_business_day') timeStr = '月初平日';
      if (rec.timingType === 'last_business_day') timeStr = '月末平日';
      if (rec.timingType === 'last_day') timeStr = '末日';
      return { type: 'monthly', label: `${intStr} ${timeStr}`, icon: '📅', cls: 'monthly' };
    }
    default:
      return { type: 'everyday', label: '毎日', icon: '🌐', cls: 'everyday' };
  }
}

function getRecurrenceBadgeHtml(recurrence) {
  const info = getRecurrenceInfo(recurrence);
  return `<span class="rec-badge ${info.cls}" title="定期設定: ${info.label}">${info.icon} ${info.label}</span>`;
}
