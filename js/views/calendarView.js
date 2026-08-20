/**
 * Gendrive - Sidebar Calendar View Renderer
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Calendar Activity Helper
// =========================================================================

function hasActivityOnDate(dateKey, targetDate = null) {
  if (!dateKey) return false;
  
  // Only check for single/standalone tasks specifically scheduled or recorded on this date
  const hasSingleTask = state.tasks.some(t => {
    if (t.type === 'recurring') return false;
    
    // Explicitly scheduled for this date
    if (t.scheduledDate && t.scheduledDate === dateKey) return true;
    
    // Today fallback
    if (!t.scheduledDate && (t.bucket === 'today' || !t.bucket)) {
      return dateKey === getTodayKey();
    }
    
    // Recorded / completed on this date
    if (t.completedAt && t.completedAt.startsWith(dateKey)) return true;
    if (t.actEnd && t.actEnd.startsWith(dateKey)) return true;

    return false;
  });

  return hasSingleTask;
}

// =========================================================================
// 2. Render Sidebar Calendar
// =========================================================================

function renderSidebarCalendar() {
  const gridEl = document.getElementById('sidebar-cal-grid');
  const monthNameEl = document.getElementById('cal-month-name');
  if (!gridEl || !monthNameEl) return;

  const year = state.calendarViewYear;
  const month = state.calendarViewMonth;

  // Update Year/Month Title
  monthNameEl.textContent = `${year}年 ${month + 1}月`;

  // Selected date key
  const selectedDateKey = getSelectedDateKey();

  // Today values
  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = now.getMonth();
  const todayDate = now.getDate();

  // Calculation for calendar matrix (Monday-first)
  // Day of week for 1st day of month (0: Mon, 1: Tue, ..., 6: Sun)
  const firstDay = new Date(year, month, 1);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;

  // Days in current month & previous month
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  let html = '';

  // 1. Previous Month Days (Trailing)
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevDate = new Date(year, month - 1, day);
    const pY = prevDate.getFullYear();
    const pM = prevDate.getMonth();
    const pD = prevDate.getDate();
    const dateKey = `${pY}-${String(pM + 1).padStart(2, '0')}-${String(pD).padStart(2, '0')}`;
    
    const isToday = (pY === todayYear && pM === todayMonth && pD === todayDate);
    const isSelected = (dateKey === selectedDateKey);
    const hasDot = hasActivityOnDate(dateKey, prevDate);

    const classes = ['cal-day-cell', 'other-month'];
    if (isToday) classes.push('is-today');
    if (isSelected) classes.push('is-selected');

    html += `
      <div class="${classes.join(' ')}" onclick="jumpToDate(${pY}, ${pM}, ${pD})" title="${pY}年${pM + 1}月${pD}日">
        <span>${String(day).padStart(2, '0')}</span>
        ${hasDot ? '<span class="cal-activity-dot"></span>' : ''}
      </div>
    `;
  }

  // 2. Current Month Days
  for (let d = 1; d <= daysInCurrentMonth; d++) {
    const currDate = new Date(year, month, d);
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    
    const isToday = (year === todayYear && month === todayMonth && d === todayDate);
    const isSelected = (dateKey === selectedDateKey);
    const hasDot = hasActivityOnDate(dateKey, currDate);

    const classes = ['cal-day-cell'];
    if (isToday) classes.push('is-today');
    if (isSelected) classes.push('is-selected');

    html += `
      <div class="${classes.join(' ')}" onclick="jumpToDate(${year}, ${month}, ${d})" title="${year}年${month + 1}月${d}日">
        <span>${String(d).padStart(2, '0')}</span>
        ${hasDot ? '<span class="cal-activity-dot"></span>' : ''}
      </div>
    `;
  }

  // 3. Next Month Days (Leading) - Fill remaining cells up to multiple of 7 (35 or 42)
  const totalCellsSoFar = startDayOfWeek + daysInCurrentMonth;
  const targetTotal = totalCellsSoFar > 35 ? 42 : 35;
  const nextMonthDaysCount = targetTotal - totalCellsSoFar;

  for (let d = 1; d <= nextMonthDaysCount; d++) {
    const nextDate = new Date(year, month + 1, d);
    const nY = nextDate.getFullYear();
    const nM = nextDate.getMonth();
    const nD = nextDate.getDate();
    const dateKey = `${nY}-${String(nM + 1).padStart(2, '0')}-${String(nD).padStart(2, '0')}`;
    
    const isToday = (nY === todayYear && nM === todayMonth && nD === todayDate);
    const isSelected = (dateKey === selectedDateKey);
    const hasDot = hasActivityOnDate(dateKey, nextDate);

    const classes = ['cal-day-cell', 'other-month'];
    if (isToday) classes.push('is-today');
    if (isSelected) classes.push('is-selected');

    html += `
      <div class="${classes.join(' ')}" onclick="jumpToDate(${nY}, ${nM}, ${nD})" title="${nY}年${nM + 1}月${nD}日">
        <span>${String(d).padStart(2, '0')}</span>
        ${hasDot ? '<span class="cal-activity-dot"></span>' : ''}
      </div>
    `;
  }

  gridEl.innerHTML = html;
}
