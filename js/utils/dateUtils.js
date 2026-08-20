/**
 * Gendrive - Date & Holiday Utility Functions
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Date Keys & Section Helpers
// =========================================================================

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDateKeyOffset(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getSelectedDateKey() {
  if (typeof state !== 'undefined' && state && typeof state.selectedDateOffset === 'number') {
    return getDateKeyOffset(state.selectedDateOffset);
  }
  return getTodayKey();
}

function normalizeSectionName(secName) {
  if (!secName) return null;
  if (secName === '早朝' || secName === 'morning') return '第1セッション';
  if (secName === '午前' || secName === 'am') return '第2セッション';
  if (secName === '午後' || secName === 'pm') return '第3セッション';
  if (secName === '夜' || secName === 'night') return '第4セッション';
  return secName;
}

function detectCurrentSection() {
  const hour = new Date().getHours() + new Date().getMinutes() / 60;
  for (const s of SECTIONS_CONFIG) {
    if (s.start <= s.end) {
      if (hour >= s.start && hour < s.end) return s.name;
    } else {
      if (hour >= s.start || hour < s.end) return s.name;
    }
  }
  return '第1セッション';
}

// =========================================================================
// 2. Japanese National Holidays & Business Day Calculations
// =========================================================================

function getJapaneseHolidayName(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1; // 1-12
  const d = date.getDate();
  const w = date.getDay(); // 0:日 - 6:土

  // 固定祝日
  if (m === 1 && d === 1) return '元日';
  if (m === 2 && d === 11) return '建国記念の日';
  if (m === 2 && d === 23) return '天皇誕生日';
  if (m === 4 && d === 29) return '昭和の日';
  if (m === 5 && d === 3) return '憲法記念日';
  if (m === 5 && d === 4) return 'みどりの日';
  if (m === 5 && d === 5) return 'こどもの日';
  if (m === 8 && d === 11) return '山の日';
  if (m === 11 && d === 3) return '文化の日';
  if (m === 11 && d === 23) return '勤労感謝の日';

  // ハッピーマンデー (第N月曜日)
  if (m === 1 && w === 1 && d >= 8 && d <= 14) return '成人の日'; // 第2月曜
  if (m === 7 && w === 1 && d >= 15 && d <= 21) return '海の日'; // 第3月曜
  if (m === 9 && w === 1 && d >= 15 && d <= 21) return '敬老の日'; // 第3月曜
  if (m === 10 && w === 1 && d >= 8 && d <= 14) return 'スポーツの日'; // 第2月曜

  // 春分の日 (簡易計算 2000-2099年)
  if (m === 3 && d === Math.floor(20.8431 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4))) {
    return '春分の日';
  }
  // 秋分の日 (簡易計算 2000-2099年)
  if (m === 9 && d === Math.floor(23.2488 + 0.242194 * (y - 1980) - Math.floor((y - 1980) / 4))) {
    return '秋分の日';
  }

  // 振替休日 (日曜が祝日の場合、月曜以降の最初の平日)
  if (w >= 1 && w <= 5) {
    for (let prevOffset = 1; prevOffset <= 3; prevOffset++) {
      const prev = new Date(y, m - 1, d - prevOffset);
      if (prev.getDay() === 0 && getJapaneseHolidayName(prev)) {
        return '振替休日';
      }
    }
  }

  // 国民の休日 (祝日に挟まれた平日)
  if (w >= 1 && w <= 5) {
    const prev = new Date(y, m - 1, d - 1);
    const next = new Date(y, m - 1, d + 1);
    if (getJapaneseHolidayName(prev) && getJapaneseHolidayName(next)) {
      return '国民の休日';
    }
  }

  return null;
}

function isJapaneseHoliday(date) {
  return getJapaneseHolidayName(date) !== null;
}

function isBusinessDay(date) {
  const w = date.getDay();
  if (w === 0 || w === 6) return false; // 土日
  return !isJapaneseHoliday(date); // 祝日でない平日
}

// Monthly Advanced Checkers
function isFirstBusinessDayOfMonth(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  for (let d = 1; d <= 7; d++) {
    const cur = new Date(y, m, d);
    if (isBusinessDay(cur)) {
      return date.getDate() === d;
    }
  }
  return false;
}

function isLastBusinessDayOfMonth(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const lastDayNum = new Date(y, m + 1, 0).getDate();
  for (let d = lastDayNum; d >= lastDayNum - 7; d--) {
    const cur = new Date(y, m, d);
    if (isBusinessDay(cur)) {
      return date.getDate() === d;
    }
  }
  return false;
}

function isLastDayOfMonth(date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const lastDayNum = new Date(y, m + 1, 0).getDate();
  return date.getDate() === lastDayNum;
}

// Monday-start Week Helper (ISO-8601)
function getMondayOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0(日) - 6(土)
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}
