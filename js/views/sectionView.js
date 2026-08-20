/**
 * Gendrive - Section View Renderer
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Anytime / Unassigned Tasks Block
// =========================================================================

function renderAnytimeBlock() {
  const secListEl = document.getElementById('anytime-task-list');
  const secCountEl = document.getElementById('anytime-task-count');
  const dailyListEl = document.getElementById('anytime-daily-list');
  const dailyCountEl = document.getElementById('anytime-daily-count');

  // Any task scheduled for current selected date with timingType === 'anytime' OR section === null
  const anytimeTasks = state.tasks.filter(t => {
    if (!isTaskForSelectedDate(t)) return false;
    return t.timingType === 'anytime' || !t.section;
  });

  const activeTasks = anytimeTasks.filter(t => {
    const st = getTaskStatusForSelectedDate(t);
    if (state.filters.status === 'uncompleted') return st !== 'completed' && st !== 'skipped';
    if (state.filters.status === 'completed') return st === 'completed';
    if (state.filters.domain && t.domainMajor !== state.filters.domain && t.domainMinor !== state.filters.domain) return false;
    if (state.filters.dept && t.deptMajor !== state.filters.dept && t.deptMinor !== state.filters.dept) return false;
    if (state.filters.proj && t.projMajor !== state.filters.proj && t.projMinor !== state.filters.proj) return false;
    if (!matchesTagFilters(t)) return false;
    return true;
  });

  if (secCountEl) secCountEl.textContent = `${activeTasks.length}件`;
  if (dailyCountEl) dailyCountEl.textContent = `${activeTasks.length}件`;

  const html = activeTasks.length === 0
    ? `<div class="anytime-tasks-list empty-state">いつでも（未割り当て）のタスクはありません。「＋ タスク追加」またはドラッグ＆ドロップで追加できます。</div>`
    : activeTasks.map(renderTaskCardHtml).join('');

  if (secListEl) secListEl.innerHTML = html;
  if (dailyListEl) dailyListEl.innerHTML = html;
}

// =========================================================================
// 2. Section View (Plan A: Separated Tasks & Habits)
// =========================================================================

function renderSectionView() {
  renderAnytimeBlock();

  const taskSubgroup = document.getElementById('subgroup-section-tasks');
  const habitSubgroup = document.getElementById('subgroup-section-habits');
  const taskContainer = document.getElementById('section-task-list');
  const habitContainer = document.getElementById('section-habit-list');
  const sectionConfig = SECTIONS_CONFIG.find(s => s.name === state.currentSection) || SECTIONS_CONFIG[0];
  
  document.getElementById('section-title').textContent = sectionConfig.label;
  document.getElementById('section-desc').textContent = sectionConfig.desc;

  // Apply Live Timescale to Section Banner if currently active
  const secBanner = document.querySelector('#view-section .section-banner');
  if (secBanner) {
    const secPct = (typeof getSectionTimeProgress === 'function') ? getSectionTimeProgress(state.currentSection) : null;
    if (secPct !== null) {
      secBanner.classList.add('is-active-section', 'is-timescale-active');
      secBanner.classList.toggle('is-timescale-warning', secPct >= 70);
      secBanner.style.setProperty('--section-timescale-pct', `${secPct}%`);
    } else {
      secBanner.classList.remove('is-active-section', 'is-timescale-active', 'is-timescale-warning');
      secBanner.style.removeProperty('--section-timescale-pct');
    }
  }

  const showTasks = state.viewType === 'all' || state.viewType === 'task';
  const showHabits = state.viewType === 'all' || state.viewType === 'habit';

  const splitContainer = document.querySelector('#view-section .section-split-container');
  if (splitContainer) {
    splitContainer.classList.toggle('grid-single', !(showTasks && showHabits));
  }

  if (taskSubgroup) taskSubgroup.style.display = showTasks ? 'flex' : 'none';
  if (habitSubgroup) habitSubgroup.style.display = showHabits ? 'flex' : 'none';

  // 1-A. Tasks for this section (with Intra-Day Auto-Forwarding from previous sections)
  const allSectionTasks = getTasksForSection(state.currentSection);
  const completedTasks = allSectionTasks.filter(t => getTaskStatusForSelectedDate(t) === 'completed').length;
  const secTaskProgEl = document.getElementById('section-task-progress');
  if (secTaskProgEl) secTaskProgEl.textContent = `${completedTasks} / ${allSectionTasks.length}`;
  const countTasksEl = document.getElementById('count-section-tasks');
  if (countTasksEl) countTasksEl.textContent = `${allSectionTasks.length}件`;

  if (showTasks) {
    const filteredTasks = allSectionTasks.filter(t => {
      const st = getTaskStatusForSelectedDate(t);
      if (state.filters.status === 'uncompleted') return st !== 'completed' && st !== 'skipped';
      if (state.filters.status === 'completed') return st === 'completed';
      if (state.filters.domain && t.domainMajor !== state.filters.domain && t.domainMinor !== state.filters.domain) return false;
      if (state.filters.dept && t.deptMajor !== state.filters.dept && t.deptMinor !== state.filters.dept) return false;
      if (state.filters.proj && t.projMajor !== state.filters.proj && t.projMinor !== state.filters.proj) return false;
      if (!matchesTagFilters(t)) return false;
      return true;
    });

    const ghostAddHtml = renderGhostAddTaskHtml(state.currentSection);

    if (filteredTasks.length === 0) {
      taskContainer.innerHTML = `
        <div class="empty-state" style="padding: 16px;">
          <p style="font-size: 12px; color: var(--text-dim);">🎯 このセクションのタスクはすべて完了しました！</p>
        </div>
        ${ghostAddHtml}
      `;
    } else {
      taskContainer.innerHTML = filteredTasks.map(renderTaskCardHtml).join('') + ghostAddHtml;
    }
  }

  // 1-B. Habits for this section
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - state.selectedDateOffset);
  const currentWindowHabits = state.habits.filter(h => isHabitScheduledForDate(h, targetDate) && isHabitInCurrentTimeWindow(h));
  const completedHabits = currentWindowHabits.filter(h => getHabitStatusForSelectedDate(h) === 'completed').length;
  const secHabitProgEl = document.getElementById('section-habit-progress');
  if (secHabitProgEl) secHabitProgEl.textContent = `${completedHabits} / ${currentWindowHabits.length}`;
  const countHabitsEl = document.getElementById('count-section-habits');
  if (countHabitsEl) countHabitsEl.textContent = `${currentWindowHabits.length}件`;

  const totalItems = allSectionTasks.length + currentWindowHabits.length;
  const totalDone = completedTasks + completedHabits;
  const progressPercent = totalItems ? Math.round((totalDone / totalItems) * 100) : 0;
  const secProgBarEl = document.getElementById('section-progress-bar');
  if (secProgBarEl) secProgBarEl.style.width = `${progressPercent}%`;

  if (showHabits) {
    const filteredHabits = getFilteredHabits('section');
    const ghostAddHabitHtml = renderGhostAddHabitHtml(state.currentSection);

    if (filteredHabits.length === 0) {
      habitContainer.innerHTML = `
        <div class="empty-state" style="padding: 16px;">
          <p style="font-size: 12px; color: var(--text-dim);">🌿 このセクションのハビットはすべて完了しました！</p>
        </div>
        ${ghostAddHabitHtml}
      `;
    } else {
      habitContainer.innerHTML = filteredHabits.map((habit, index) => renderHabitCardHtml(habit, index)).join('') + ghostAddHabitHtml;
    }
  }
}
