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

/**
 * あらゆる日付表現（Dateオブジェクト、ISO文字列、スラッシュ形式、長文Date等）を
 * ユーザーのローカル時刻（JST）基準で確実に "YYYY-MM-DD" に統一正規化する関数
 */
function normalizeToLocalDateKey(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
      const parts = trimmed.split('/');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    // Date string format like "Fri Sep 18 2026 00:00:00 GMT+0900 (日本標準時)"
    const monthNames = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    const match = trimmed.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
    if (match) {
      const mNum = monthNames[match[1]] || '01';
      const dStr = match[2].padStart(2, '0');
      const yStr = match[3];
      return `${yStr}-${mNum}-${dStr}`;
    }
  }

  try {
    const cleanVal = typeof val === 'string' ? val.replace(/\s*\(.*?\)/, '') : val;
    const d = (val instanceof Date) ? val : new Date(cleanVal);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch (e) {}

  return null;
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

// 国民の祝日（祝日法第2条に基づく本祝日・非再帰）
function getJapaneseBaseHolidayName(date) {
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

  return null;
}

function getJapaneseHolidayName(date) {
  // 1. 国民の祝日（本祝日）の判定
  const baseName = getJapaneseBaseHolidayName(date);
  if (baseName) return baseName;

  const y = date.getFullYear();
  const m = date.getMonth(); // 0-11
  const d = date.getDate();
  const w = date.getDay(); // 0:日 - 6:土

  // 土日は振替休日・国民の休日にはならない
  if (w === 0 || w === 6) return null;

  // 2. 振替休日 (祝日法第3条第2項: 祝日が日曜の場合、その後の最も近い祝日でない平日)
  // 直前の連続する祝日期間を遡り、開始日が日曜かつ祝日であるかを判定
  let checkOffset = 1;
  while (checkOffset <= 7) {
    const prev = new Date(y, m, d - checkOffset);
    const prevBase = getJapaneseBaseHolidayName(prev);
    if (!prevBase) {
      break;
    }
    if (prev.getDay() === 0) {
      return '振替休日';
    }
    checkOffset++;
  }

  // 3. 国民の休日 (祝日法第3条第3項: 前日と翌日がともに国民の祝日である平日)
  const prevDate = new Date(y, m, d - 1);
  const nextDate = new Date(y, m, d + 1);
  if (getJapaneseBaseHolidayName(prevDate) && getJapaneseBaseHolidayName(nextDate)) {
    return '国民の休日';
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
