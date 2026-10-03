/**
 * Gendrive - TaskChute Unified ETA & Remaining Calculation Engine
 * 哲生 (AI Company OS & Personal OS Engine)
 * 
 * 仕様（厳守）:
 * 各セクションの残分 = 未完了タスク + 未完了ハビットの所要時間合計（「食材」タグは除外）
 * - 現在が枠より前: 開始時刻 + 残分
 * - 現在が枠内: 現在時刻 + 残分
 * - 現在が枠より後: 終了時刻 + 残分（残0なら「達成」）
 * - 見込がセクション終了時刻を超えたら赤表示(overdue)を維持
 * - 全体の見込 = 最終セクション(第4)の見込時刻、全体の残り = 6セクション残分の合算
 */

// =========================================================================
// 1. Section Remaining Minutes & Counts
// =========================================================================

function getSectionRemaining(sectionName, targetDate = null) {
  const normSecName = (typeof normalizeSectionName === 'function') 
    ? normalizeSectionName(sectionName) 
    : sectionName;

  const tDate = targetDate || (() => {
    const dt = new Date();
    if (typeof state !== 'undefined' && state && typeof state.selectedDateOffset === 'number') {
      dt.setDate(dt.getDate() - state.selectedDateOffset);
    }
    return dt;
  })();

  // 1. Tasks: getTasksForSection returns all tasks assigned to this section before display filter
  const tasks = (typeof getTasksForSection === 'function')
    ? getTasksForSection(normSecName, { nativeOnly: true })
    : ((typeof state !== 'undefined' && state && state.tasks) ? state.tasks.filter(t => isTaskForSelectedDate(t) && normalizeSectionName(t.section) === normSecName) : []);

  let taskRemainMin = 0;
  let taskRemainCount = 0;
  let taskDoneCount = 0;

  tasks.forEach(t => {
    const done = (typeof isTaskDone === 'function')
      ? isTaskDone(t)
      : ((typeof getTaskStatusForSelectedDate === 'function') ? getTaskStatusForSelectedDate(t) === 'completed' : t.status === 'completed');

    if (done) {
      taskDoneCount++;
    } else {
      const st = (typeof getTaskStatusForSelectedDate === 'function')
        ? getTaskStatusForSelectedDate(t)
        : t.status;
      if (st !== 'skipped') {
        const min = (typeof getItemRemainingMinutes === 'function')
          ? getItemRemainingMinutes(t, 'task')
          : (t.estMin || 15);
        taskRemainMin += min;
        taskRemainCount++;
      }
    }
  });

  // 2. Habits: isHabitScheduledForDate + isHabitInDailySection (before display filters)
  const allHabits = (typeof state !== 'undefined' && state && Array.isArray(state.habits)) ? state.habits : [];
  const secHabits = allHabits.filter(h => {
    if (typeof isHabitScheduledForDate === 'function' && !isHabitScheduledForDate(h, tDate)) return false;
    if (typeof isHabitInDailySection === 'function' && !isHabitInDailySection(h, normSecName)) return false;
    return true;
  });

  // Food tag exclusion ('食材' etc.)
  const countableHabits = secHabits.filter(h => {
    return !(typeof isHabitTimeExcluded === 'function' && isHabitTimeExcluded(h));
  });

  let habitRemainMin = 0;
  let habitRemainCount = 0;
  let habitDoneCount = 0;

  countableHabits.forEach(h => {
    const done = (typeof isHabitDone === 'function')
      ? isHabitDone(h)
      : ((typeof getHabitStatusForSelectedDate === 'function') ? getHabitStatusForSelectedDate(h) === 'completed' : h.status === 'completed');

    if (done) {
      habitDoneCount++;
    } else {
      const st = (typeof getHabitStatusForSelectedDate === 'function')
        ? getHabitStatusForSelectedDate(h)
        : h.status;
      if (st !== 'skipped') {
        const min = (typeof getItemRemainingMinutes === 'function')
          ? getItemRemainingMinutes(h, 'habit')
          : (h.targetMin || 5);
        habitRemainMin += min;
        habitRemainCount++;
      }
    }
  });

  const remainMin = taskRemainMin + habitRemainMin;
  const remainCount = taskRemainCount + habitRemainCount;
  const taskTotalCount = tasks.length;
  const habitTotalCount = countableHabits.length;
  const totalCount = taskTotalCount + habitTotalCount;
  const doneCount = taskDoneCount + habitDoneCount;

  return {
    sectionName: normSecName,
    remainMin,
    remainCount,
    taskRemainMin,
    taskRemainCount,
    taskDoneCount,
    taskTotalCount,
    habitRemainMin,
    habitRemainCount,
    habitDoneCount,
    habitTotalCount,
    totalCount,
    doneCount
  };
}

// =========================================================================
// 2. Section ETA Calculation (TaskChute Exact Specifications)
// =========================================================================

function getSectionEta(sectionName, now = new Date()) {
  const normSecName = (typeof normalizeSectionName === 'function') 
    ? normalizeSectionName(sectionName) 
    : sectionName;

  const secConfig = (typeof SECTIONS_CONFIG !== 'undefined')
    ? SECTIONS_CONFIG.find(s => s.name === normSecName)
    : null;

  const remaining = getSectionRemaining(normSecName);
  const { remainMin, remainCount } = remaining;

  // 全タスク・全ハビット完了時は残0分・達成
  if (remainCount === 0 || remainMin === 0) {
    return {
      ...remaining,
      etaTimeStr: '達成!🎉',
      etaDate: new Date(now.getTime()),
      isOverdue: false,
      isAchieved: true
    };
  }

  // セクション定義が見つからない場合の安全フォールバック
  if (!secConfig) {
    const fallbackEta = new Date(now.getTime() + remainMin * 60000);
    const sH = String(fallbackEta.getHours()).padStart(2, '0');
    const sM = String(fallbackEta.getMinutes()).padStart(2, '0');
    return {
      ...remaining,
      etaTimeStr: `${sH}:${sM}`,
      etaDate: fallbackEta,
      isOverdue: false,
      isAchieved: false
    };
  }

  const curHourDec = now.getHours() + (now.getMinutes() / 60) + (now.getSeconds() / 3600);
  const secStart = secConfig.start;
  const secEnd = secConfig.end;

  let baseDate;
  let isOverdue = false;

  if (curHourDec < secStart) {
    // 1. 現在が枠より前: 開始時刻 + 残分
    const startH = Math.floor(secStart);
    const startM = Math.round((secStart - startH) * 60);
    baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM, 0, 0);
  } else if (curHourDec >= secStart && curHourDec < secEnd) {
    // 2. 現在が枠内: 現在時刻 + 残分
    baseDate = new Date(now.getTime());
  } else {
    // 3. 現在が枠より後: 終了時刻 + 残分
    const endH = Math.floor(secEnd);
    const endM = Math.round((secEnd - endH) * 60);
    baseDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM, 0, 0);
  }

  const etaDate = new Date(baseDate.getTime() + remainMin * 60000);
  const etaHourDec = etaDate.getHours() + (etaDate.getMinutes() / 60) + (etaDate.getSeconds() / 3600);

  // overdue判定: 枠後(curHourDec >= secEnd)で未完了がある場合、または見込時刻が枠終了時刻を超えた場合
  if (curHourDec >= secEnd) {
    isOverdue = true;
  } else if (etaDate.getDate() !== now.getDate() || etaHourDec > secEnd) {
    isOverdue = true;
  }

  const sH = String(etaDate.getHours()).padStart(2, '0');
  const sM = String(etaDate.getMinutes()).padStart(2, '0');
  let etaTimeStr = `${sH}:${sM}`;
  if (etaDate.getDate() !== now.getDate()) {
    etaTimeStr = '翌 ' + etaTimeStr;
  }

  return {
    ...remaining,
    etaTimeStr,
    etaDate,
    isOverdue,
    isAchieved: false
  };
}

// =========================================================================
// 3. Day ETA Calculation (Overall Day Summary)
// =========================================================================

function getDayEta(now = new Date()) {
  const sections = (typeof SECTIONS_CONFIG !== 'undefined') ? SECTIONS_CONFIG : [];

  let totalDayRemainMin = 0;
  let totalDayRemainCount = 0;
  let dayTaskRemainMin = 0;
  let dayTaskRemainCount = 0;
  let dayTaskDoneCount = 0;
  let dayTaskTotalCount = 0;
  let dayHabitRemainMin = 0;
  let dayHabitRemainCount = 0;
  let dayHabitDoneCount = 0;
  let dayHabitTotalCount = 0;

  const sectionEtas = [];

  for (const s of sections) {
    const sEta = getSectionEta(s.name, now);
    sectionEtas.push(sEta);

    totalDayRemainMin += sEta.remainMin;
    totalDayRemainCount += sEta.remainCount;
    dayTaskRemainMin += sEta.taskRemainMin;
    dayTaskRemainCount += sEta.taskRemainCount;
    dayTaskDoneCount += sEta.taskDoneCount;
    dayTaskTotalCount += sEta.taskTotalCount;
    dayHabitRemainMin += sEta.habitRemainMin;
    dayHabitRemainCount += sEta.habitRemainCount;
    dayHabitDoneCount += sEta.habitDoneCount;
    dayHabitTotalCount += sEta.habitTotalCount;
  }

  // 1日全体が完了している場合
  if (totalDayRemainCount === 0 || totalDayRemainMin === 0) {
    return {
      totalDayRemainMin: 0,
      totalDayRemainCount: 0,
      dayTaskRemainMin: 0,
      dayTaskRemainCount: 0,
      dayTaskDoneCount,
      dayTaskTotalCount,
      dayHabitRemainMin: 0,
      dayHabitRemainCount: 0,
      dayHabitDoneCount,
      dayHabitTotalCount,
      dayEtaTimeStr: '達成!🎉',
      dayEtaDate: new Date(now.getTime()),
      isDayOverdue: false,
      isAchieved: true,
      sectionEtas
    };
  }

  // 全体の見込 = 最終セクション(第4セッション)の見込時刻
  const sec4Eta = sectionEtas.find(e => e.sectionName === '第4セッション') || sectionEtas[sectionEtas.length - 1];

  let dayEtaTimeStr = '';
  let dayEtaDate = null;
  let isDayOverdue = false;

  if (sec4Eta && sec4Eta.remainCount > 0) {
    dayEtaTimeStr = sec4Eta.etaTimeStr;
    dayEtaDate = sec4Eta.etaDate;
    isDayOverdue = sec4Eta.isOverdue;
  } else {
    // 第4セッションの残分が0で他のセクションに残分がある場合は、最後に未完了があるセクションの見込時刻
    const activeEtas = sectionEtas.filter(e => e.remainCount > 0);
    const lastActive = (activeEtas.length > 0) ? activeEtas[activeEtas.length - 1] : sec4Eta;
    dayEtaTimeStr = lastActive ? lastActive.etaTimeStr : '達成!🎉';
    dayEtaDate = lastActive ? lastActive.etaDate : new Date(now.getTime());
    isDayOverdue = lastActive ? lastActive.isOverdue : false;
  }

  return {
    totalDayRemainMin,
    totalDayRemainCount,
    dayTaskRemainMin,
    dayTaskRemainCount,
    dayTaskDoneCount,
    dayTaskTotalCount,
    dayHabitRemainMin,
    dayHabitRemainCount,
    dayHabitDoneCount,
    dayHabitTotalCount,
    dayEtaTimeStr,
    dayEtaDate,
    isDayOverdue,
    isAchieved: false,
    sectionEtas
  };
}

// Global & CommonJS Export
if (typeof window !== 'undefined') {
  window.getSectionRemaining = getSectionRemaining;
  window.getSectionEta = getSectionEta;
  window.getDayEta = getDayEta;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getSectionRemaining,
    getSectionEta,
    getDayEta
  };
}
