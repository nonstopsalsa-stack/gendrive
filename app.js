/**
 * Habit Flow - Core Logic & Keyboard Engine
 * Fully customized for 哲生 (AI Company OS & Personal OS Engine)
 * Enhanced with 3-Way Timing Selector (Anytime / Section / Custom Range)
 */

// Master Definitions (SECTIONS_CONFIG, DOMAINS_DATA, DEPTS_DATA, PROJECTS_DATA, MATRIX_KEYS, DEFAULT_MATRIX)
// are loaded from js/config.js

// =========================================================================
// 1-B. UNDO History Engine & 6-Axis Load/Evaluation Matrix Helpers
// =========================================================================







// 2-Step Cascade Select Helpers
function updateMinorSelectOptions(majorSelectId, minorSelectId, dataSource, selectedVal = null) {
  const majorSelect = document.getElementById(majorSelectId);
  const minorSelect = document.getElementById(minorSelectId);
  if (!majorSelect || !minorSelect) return;

  const majorKey = majorSelect.value;
  minorSelect.innerHTML = '<option value="">(未設定)</option>';

  if (majorKey && dataSource[majorKey]) {
    const items = dataSource[majorKey].items || [];
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      if (selectedVal && selectedVal === item) {
        opt.selected = true;
      }
      minorSelect.appendChild(opt);
    });
  }
}

function setupCascadeSelects() {
  // Habit Add
  const addDomMaj = document.getElementById('add-domain-major');
  if (addDomMaj) addDomMaj.addEventListener('change', () => updateMinorSelectOptions('add-domain-major', 'add-domain-minor', DOMAINS_DATA));
  const addDeptMaj = document.getElementById('add-dept-major');
  if (addDeptMaj) addDeptMaj.addEventListener('change', () => updateMinorSelectOptions('add-dept-major', 'add-dept-minor', DEPTS_DATA));
  const addProjMaj = document.getElementById('add-proj-major');
  if (addProjMaj) addProjMaj.addEventListener('change', () => updateMinorSelectOptions('add-proj-major', 'add-proj-minor', PROJECTS_DATA));

  // Habit Edit
  const editDomMaj = document.getElementById('edit-domain-major');
  if (editDomMaj) editDomMaj.addEventListener('change', () => updateMinorSelectOptions('edit-domain-major', 'edit-domain-minor', DOMAINS_DATA));
  const editDeptMaj = document.getElementById('edit-dept-major');
  if (editDeptMaj) editDeptMaj.addEventListener('change', () => updateMinorSelectOptions('edit-dept-major', 'edit-dept-minor', DEPTS_DATA));
  const editProjMaj = document.getElementById('edit-proj-major');
  if (editProjMaj) editProjMaj.addEventListener('change', () => updateMinorSelectOptions('edit-proj-major', 'edit-proj-minor', PROJECTS_DATA));

  // Task Add
  const addTaskDomMaj = document.getElementById('add-task-domain-major');
  if (addTaskDomMaj) addTaskDomMaj.addEventListener('change', () => updateMinorSelectOptions('add-task-domain-major', 'add-task-domain-minor', DOMAINS_DATA));
  const addTaskDeptMaj = document.getElementById('add-task-dept-major');
  if (addTaskDeptMaj) addTaskDeptMaj.addEventListener('change', () => updateMinorSelectOptions('add-task-dept-major', 'add-task-dept-minor', DEPTS_DATA));
  const addTaskProjMaj = document.getElementById('add-task-proj-major');
  if (addTaskProjMaj) addTaskProjMaj.addEventListener('change', () => updateMinorSelectOptions('add-task-proj-major', 'add-task-proj-minor', PROJECTS_DATA));

  // Task Edit
  const editTaskDomMaj = document.getElementById('edit-task-domain-major');
  if (editTaskDomMaj) editTaskDomMaj.addEventListener('change', () => updateMinorSelectOptions('edit-task-domain-major', 'edit-task-domain-minor', DOMAINS_DATA));
  const editTaskDeptMaj = document.getElementById('edit-task-dept-major');
  if (editTaskDeptMaj) editTaskDeptMaj.addEventListener('change', () => updateMinorSelectOptions('edit-task-dept-major', 'edit-task-dept-minor', DEPTS_DATA));
  const editTaskProjMaj = document.getElementById('edit-task-proj-major');
  if (editTaskProjMaj) editTaskProjMaj.addEventListener('change', () => updateMinorSelectOptions('edit-task-proj-major', 'edit-task-proj-minor', PROJECTS_DATA));

  // Preset Add / Edit
  const presetDomMaj = document.getElementById('select-preset-domain-major');
  if (presetDomMaj) presetDomMaj.addEventListener('change', () => updateMinorSelectOptions('select-preset-domain-major', 'select-preset-domain-minor', DOMAINS_DATA));
  const presetDeptMaj = document.getElementById('select-preset-dept-major');
  if (presetDeptMaj) presetDeptMaj.addEventListener('change', () => updateMinorSelectOptions('select-preset-dept-major', 'select-preset-dept-minor', DEPTS_DATA));
  const presetProjMaj = document.getElementById('select-preset-proj-major');
  if (presetProjMaj) presetProjMaj.addEventListener('change', () => updateMinorSelectOptions('select-preset-proj-major', 'select-preset-proj-minor', PROJECTS_DATA));
}

// =========================================================================
// 2. Initial Sample Habits & Rate Analytics (loaded from js/sampleData.js)
// =========================================================================

// =========================================================================
// 2-B. Initial Sample Tasks (loaded from js/sampleData.js)
// =========================================================================



// App State
let state = {
  habits: loadHabits(),
  tasks: loadTasks(),
  goals: loadGoals(),
  manifesto: loadManifesto(),
  goalsSubmode: 'front', // 'front' (4大目標グリッド) | 'back' (魂の宣誓マニフェスト)
  taskPresets: loadTaskPresets(),
  activeHabitId: null,
  activeTaskId: null,
  selectedIndex: 0,
  focusTaskIndex: 0,
  focusHabitIndex: 0,
  currentMode: 'section', // 'section' | 'focus' | 'all' | 'table' | 'bucket' | 'goals'
  currentBucketFilter: null, // { type: 'bucket' | 'label', id: string }
  viewType: 'all', // 'all' | 'task' | 'habit'
  masterSubtab: 'habits', // 'habits' | 'tasks'
  filters: {
    status: 'uncompleted',
    domain: null,
    dept: null,
    proj: null,
    includeTags: [],
    excludeTags: []
  },
  currentSection: detectCurrentSection(),
  selectedAddTimingType: 'section',
  selectedEditTimingType: 'section',
  selectedEditStatus: 'uncompleted',
  contextMenuHabitId: null,
  contextMenuTaskId: null,
  previousMode: 'section',
  selectedDateOffset: 0,
  calendarViewYear: new Date().getFullYear(),
  calendarViewMonth: new Date().getMonth(),
  tableSort: {
    key: 'default',
    order: 'asc'
  },
  selectedTableItemIds: new Set(),
  showDisabledInTable: false
};

// =========================================================================
// 2-T. Tag Engine (Normalization, Dynamic Collection, Suggestions & 3-Way Filters)
// =========================================================================

function normalizeTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return Array.from(new Set(raw.map(t => String(t).trim().replace(/^#/, '')).filter(Boolean)));
  }
  if (typeof raw === 'string') {
    return Array.from(new Set(raw.split(/[,、\s]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean)));
  }
  return [];
}

function getAllRegisteredTags() {
  const tagCounts = {};
  const addTags = (item) => {
    const tags = normalizeTags(item?.tags);
    tags.forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  };

  if (Array.isArray(state.tasks)) state.tasks.forEach(addTags);
  if (Array.isArray(state.habits)) state.habits.forEach(addTags);
  if (Array.isArray(state.taskPresets)) state.taskPresets.forEach(addTags);

  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }));
}

function matchesTagFilters(item) {
  if (!item) return true;
  const itemTags = normalizeTags(item.tags);
  const { includeTags = [], excludeTags = [] } = state.filters || {};

  // 1. Exclude filter (Negative Filter - If any tag matches, exclude immediately)
  if (excludeTags && excludeTags.length > 0) {
    if (excludeTags.some(t => itemTags.includes(t))) return false;
  }

  // 2. Include filter (Positive Filter - Item must match at least one of the includeTags)
  if (includeTags && includeTags.length > 0) {
    if (!includeTags.some(t => itemTags.includes(t))) return false;
  }

  return true;
}

function toggleTagFilter(tag) {
  const cleanTag = tag.trim().replace(/^#/, '');
  if (!state.filters.includeTags) state.filters.includeTags = [];
  if (!state.filters.excludeTags) state.filters.excludeTags = [];

  const isIncluded = state.filters.includeTags.includes(cleanTag);
  const isExcluded = state.filters.excludeTags.includes(cleanTag);

  if (!isIncluded && !isExcluded) {
    // 1st click: Include (Blue)
    state.filters.includeTags.push(cleanTag);
  } else if (isIncluded) {
    // 2nd click: Exclude (Red / Strikethrough)
    state.filters.includeTags = state.filters.includeTags.filter(t => t !== cleanTag);
    state.filters.excludeTags.push(cleanTag);
  } else {
    // 3rd click: Reset
    state.filters.excludeTags = state.filters.excludeTags.filter(t => t !== cleanTag);
  }

  renderApp();
}

function handleTagBadgeClick(e, tag) {
  if (e) e.stopPropagation();
  toggleTagFilter(tag);
}

function renderSmartTagBar() {
  const container = document.getElementById('smart-tag-bar-container');
  const listEl = document.getElementById('smart-tag-chips-list');
  if (!container || !listEl) return;

  const allTags = getAllRegisteredTags();
  const incList = state.filters.includeTags || [];
  const excList = state.filters.excludeTags || [];

  if (allTags.length === 0 && incList.length === 0 && excList.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  const includeSet = new Set(incList);
  const excludeSet = new Set(excList);

  const displayTagsMap = new Map();
  allTags.forEach(t => displayTagsMap.set(t.name, t.count));
  includeSet.forEach(t => { if (!displayTagsMap.has(t)) displayTagsMap.set(t, 0); });
  excludeSet.forEach(t => { if (!displayTagsMap.has(t)) displayTagsMap.set(t, 0); });

  listEl.innerHTML = Array.from(displayTagsMap.entries()).map(([name, count]) => {
    const isInc = includeSet.has(name);
    const isExc = excludeSet.has(name);
    let stateCls = '';
    let icon = '';
    let hint = 'クリックで絞込（含む）';
    if (isInc) {
      stateCls = 'include';
      icon = '<span class="chip-state-icon">✓</span>';
      hint = 'クリックで除外（非表示）に切替';
    } else if (isExc) {
      stateCls = 'exclude';
      icon = '<span class="chip-state-icon">🚫</span>';
      hint = 'クリックでフィルタ解除';
    }

    return `
      <div class="quick-tag-chip ${stateCls}" onclick="toggleTagFilter('${name}')" title="#${name} (${hint})">
        ${icon}
        <span class="quick-tag-name">#${name}</span>
        ${count > 0 ? `<span class="quick-tag-count">${count}</span>` : ''}
      </div>
    `;
  }).join('');
}

function renderTagSuggestions(containerId, inputId) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  if (!container || !input) return;

  const allTags = getAllRegisteredTags();
  if (allTags.length === 0) {
    container.innerHTML = '';
    return;
  }

  const currentTags = normalizeTags(input.value);
  container.innerHTML = allTags.slice(0, 16).map(({ name }) => {
    const isSelected = currentTags.includes(name);
    return `
      <span class="tag-suggestion-chip ${isSelected ? 'active' : ''}" onclick="toggleTagInInput('${inputId}', '${containerId}', '${name}')">
        ${isSelected ? '✓ ' : '+ '}#${name}
      </span>
    `;
  }).join('');
}

function toggleTagInInput(inputId, containerId, tagName) {
  const input = document.getElementById(inputId);
  if (!input) return;
  let currentTags = normalizeTags(input.value);
  if (currentTags.includes(tagName)) {
    currentTags = currentTags.filter(t => t !== tagName);
  } else {
    currentTags.push(tagName);
  }
  input.value = currentTags.join(', ');
  renderTagSuggestions(containerId, inputId);
}

// =========================================================================
// 3. Storage & Real-Time Analytics Engine
// =========================================================================



function getHabitStatusForSelectedDate(habit) {
  if (!habit) return 'uncompleted';
  const k = getSelectedDateKey();

  // 1. Future date is ALWAYS uncompleted (planning mode)
  if (state.selectedDateOffset < 0) {
    return 'uncompleted';
  }
  
  // 2. Check multi-count progress
  const curCount = getHabitDayCount(habit, k);
  const targetTimes = getHabitTargetTimes(habit);
  if (curCount >= targetTimes && targetTimes > 0) return 'completed';

  // 3. Check history object for exact date completion
  const hasHistoryDone = Boolean(habit.history && (habit.history[k] === true || habit.history[k]?.done));
  if (hasHistoryDone) return 'completed';
  
  // 4. Today: real-time active status (only completed if targetTimes reached)
  if (state.selectedDateOffset === 0) {
    if (habit.status === 'completed' && curCount < targetTimes) {
      return 'uncompleted';
    }
    return habit.status || 'uncompleted';
  }

  // 5. Past date without full completion: uncompleted
  return 'uncompleted';
}

function getTaskStatusForSelectedDate(task) {
  if (!task) return 'uncompleted';
  const k = getSelectedDateKey();

  // 1. Future date is ALWAYS uncompleted (planning mode)
  if (state.selectedDateOffset < 0) {
    return 'uncompleted';
  }

  // 2. Recurring task: Check history array for this date
  if (task.type === 'recurring') {
    if (Array.isArray(task.history)) {
      const hasDone = task.history.some(h => (typeof h === 'object' && h !== null && h.date === k));
      if (hasDone) return 'completed';
    }
    if (state.selectedDateOffset === 0) {
      return task.status || 'uncompleted';
    }
    return 'uncompleted';
  }

  // 3. Single task
  if (state.selectedDateOffset === 0) {
    return task.status || 'uncompleted';
  }

  // 4. Past date: single task scheduled for that date
  return task.status || 'uncompleted';
}

function isTaskForSelectedDate(task, dateObj = null) {
  if (!task || task.isDisabled) return false;
  const d = dateObj ? new Date(dateObj) : (() => {
    const dt = new Date();
    dt.setDate(dt.getDate() - state.selectedDateOffset);
    return dt;
  })();
  const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayKey = getTodayKey();

  // 1. 定期タスク (Recurring Tasks)
  if (task.type === 'recurring') {
    return isHabitScheduledForDate(task, d);
  }

  // 2. 単発タスク (Single Tasks)
  if (task.bucket === 'today' || !task.bucket) {
    if (task.scheduledDate) {
      return task.scheduledDate === dateKey;
    }
    // 日付未指定の場合は「今日（todayKey）」に表示
    return dateKey === todayKey;
  }

  return false;
}









function isHabitInCurrentTimeWindow(habit, targetSectionName = null) {
  if (!habit) return false;
  // targetSectionNameが文字列以外（filterコールバックのindex等）の場合はstate.currentSectionを使用
  const actualTargetSec = (typeof targetSectionName === 'string') ? targetSectionName : state.currentSection;
  const normSecName = normalizeSectionName(actualTargetSec);
  const sectionConfig = SECTIONS_CONFIG.find(s => s.name === normSecName) || SECTIONS_CONFIG[0];
  const type = habit.displayType || habit.timingType || 'section';

  // 1. Anytime (1日中表示): どのセクションでも常に表示
  if (type === 'anytime') {
    return true;
  }

  // 2. Section (セクション指定): 指定セクションと完全一致
  if (type === 'section') {
    return normalizeSectionName(habit.section) === normSecName;
  }

  // 3. Custom Time Range (時間指定): セクションの時間枠と少しでも重なっていたら表示
  if (type === 'custom') {
    if (!habit.customStart) return true; // 開始時間未設定なら常時表示

    const [sH, sM] = String(habit.customStart).split(':').map(Number);
    const habitStart = (sH || 0) + (sM || 0) / 60;

    let habitEnd = habitStart + ((habit.targetMin || 30) / 60); // 終了未指定時のフォールバック
    if (habit.customEnd) {
      const [eH, eM] = String(habit.customEnd).split(':').map(Number);
      habitEnd = (eH || 0) + (eM || 0) / 60;
    }

    const secStart = sectionConfig.start;
    const secEnd = sectionConfig.end;

    if (secStart <= secEnd) {
      if (habitStart <= habitEnd) {
        // 通常区間同士の交差判定 (少しでも重なりがあれば true)
        return habitStart < secEnd && habitEnd > secStart;
      } else {
        // ハビットが日またぎの場合 (例: 22:00〜02:00)
        return habitStart < secEnd || habitEnd > secStart;
      }
    } else {
      // セクションが日またぎの場合
      if (habitStart <= habitEnd) {
        return habitEnd > secStart || habitStart < secEnd;
      } else {
        return true;
      }
    }
  }

  return false;
}

// デイリー画面専用: 開始時間がそのセクションに含まれているハビットのみを抽出（重複防止）
function isHabitInDailySection(habit, sectionName) {
  if (!habit) return false;
  const normSecName = normalizeSectionName(sectionName);
  const sectionConfig = SECTIONS_CONFIG.find(s => s.name === normSecName) || SECTIONS_CONFIG[0];
  const type = habit.displayType || habit.timingType || 'section';

  // 1. Anytime: Anytimeはデイリー画面最上部の「Anytimeブロック」に表示するため、各セクションには重複表示しない
  if (type === 'anytime') {
    return false;
  }

  // 2. Section: 指定セクションと完全一致
  if (type === 'section') {
    return normalizeSectionName(habit.section) === normSecName;
  }

  // 3. Custom Time Range: 開始時刻（customStart）がそのセクションの時間内にある場合のみ表示
  if (type === 'custom') {
    if (!habit.customStart) {
      return normalizeSectionName(habit.section) === normSecName;
    }
    const [sH, sM] = String(habit.customStart).split(':').map(Number);
    const habitStart = (sH || 0) + (sM || 0) / 60;

    const secStart = sectionConfig.start;
    const secEnd = sectionConfig.end;

    if (secStart <= secEnd) {
      return habitStart >= secStart && habitStart < secEnd;
    } else {
      // 日またぎセクション
      return habitStart >= secStart || habitStart < secEnd;
    }
  }

  return false;
}



// =========================================================================
// 4. Core Actions (Multi-Count Daily Times & Concurrent Habit Execution)
// =========================================================================

function moveHabitToTopOfSection(habitId) {
  if (!state || !Array.isArray(state.habits)) return;
  const targetId = String(habitId);
  const targetHabitIdx = state.habits.findIndex(h => String(h.id) === targetId);
  if (targetHabitIdx === -1) return;
  const targetHabit = state.habits[targetHabitIdx];

  // Find index of the very first habit in the same section / group
  const firstSectionHabitIdx = state.habits.findIndex(h => {
    if (targetHabit.section) {
      return h.section === targetHabit.section;
    } else {
      return !h.section || h.displayType === 'anytime';
    }
  });

  if (firstSectionHabitIdx !== -1 && firstSectionHabitIdx !== targetHabitIdx) {
    state.habits.splice(targetHabitIdx, 1);
    state.habits.splice(firstSectionHabitIdx, 0, targetHabit);
  }
}

function startHabit(id) {
  const targetId = String(id);
  const habit = state.habits.find(h => String(h.id) === targetId);
  if (!habit) return;

  // Automatically promote started habit to the top of its section
  moveHabitToTopOfSection(targetId);

  // Auto-pause any other in-progress habit
  state.habits.forEach(h => {
    if (String(h.id) !== targetId && h.status === 'in_progress') {
      h.status = 'paused';
      if (h.startTimestamp) {
        const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - h.startTimestamp) / 1000));
        h.accumulatedSeconds = (h.accumulatedSeconds || (h.actMin ? h.actMin * 60 : 0)) + sessionElapsedSec;
        h.actMin = Math.round(h.accumulatedSeconds / 60);
      }
      h.startTimestamp = null;
    }
  });

  habit.status = 'in_progress';
  habit.startTimestamp = Date.now();
  state.activeHabitId = habit.id;

  saveHabits();
  renderApp();
}

function pauseHabit(id) {
  const targetId = String(id);
  const habit = state.habits.find(h => String(h.id) === targetId);
  if (!habit || habit.status !== 'in_progress') return;

  habit.status = 'paused';
  if (habit.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - habit.startTimestamp) / 1000));
    habit.accumulatedSeconds = (habit.accumulatedSeconds || (habit.actMin ? habit.actMin * 60 : 0)) + sessionElapsedSec;
    habit.actMin = Math.round(habit.accumulatedSeconds / 60);
  }
  habit.startTimestamp = null;
  if (state.activeHabitId === habit.id) {
    state.activeHabitId = null;
  }

  saveHabits();
  renderApp();
}

function stepQuickCompleteCount(delta) {
  const countInput = document.getElementById('quick-complete-count');
  if (!countInput) return;
  const cur = parseInt(countInput.value, 10) || 1;
  countInput.value = Math.max(1, cur + delta);
}

function completeHabit(id, userNote = '', userCount = null, userDurationMin = null) {
  const targetId = String(id);
  const habit = state.habits.find(h => String(h.id) === targetId);
  if (!habit) return;

  const now = new Date();
  const dateKey = getSelectedDateKey();
  
  // Calculate elapsed minutes
  let elapsedMin = userDurationMin !== null ? Number(userDurationMin) : (habit.targetMin || 5);
  if (userDurationMin === null) {
    let totalSec = habit.accumulatedSeconds || (habit.actMin ? habit.actMin * 60 : 0);
    if (habit.startTimestamp) {
      totalSec += Math.max(0, Math.floor((Date.now() - habit.startTimestamp) / 1000));
    }
    if (totalSec > 0) {
      elapsedMin = Math.max(1, Math.round(totalSec / 60));
    }
  }

  if (!Array.isArray(habit.durationLogs)) habit.durationLogs = [];
  habit.durationLogs.push(elapsedMin);

  if (!habit.history) habit.history = {};

  const curCount = getHabitDayCount(habit, dateKey);
  const targetTimes = getHabitTargetTimes(habit);
  const newCount = userCount !== null ? Number(userCount) : (curCount + 1);
  const isGoalReached = newCount >= targetTimes;

  const prevHistoryEntry = habit.history[dateKey];
  const prevStatus = habit.status;

  const historyEntry = {
    done: isGoalReached,
    count: newCount,
    durationMin: elapsedMin,
    completedAt: now.toISOString()
  };
  if (userNote && userNote.trim()) {
    historyEntry.note = userNote.trim();
  }
  habit.history[dateKey] = historyEntry;

  // Add to executionLogs array (Timeline)
  if (!Array.isArray(habit.executionLogs)) habit.executionLogs = [];
  const logId = 'hlog_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  habit.executionLogs.unshift({
    id: logId,
    dateKey: dateKey,
    completedAt: now.toISOString(),
    count: newCount,
    durationMin: elapsedMin,
    note: userNote ? userNote.trim() : ''
  });

  habit.status = isGoalReached ? 'completed' : 'uncompleted';
  habit.startTimestamp = null;
  habit.accumulatedSeconds = 0;
  if (String(state.activeHabitId) === targetId) {
    state.activeHabitId = null;
  }

  // UNDO Action Recording
  const toastMsg = targetTimes > 1
    ? (isGoalReached ? `ハビット「${habit.name}」を本日の目標達成 (${newCount}/${targetTimes}回)！🎉` : `ハビット「${habit.name}」(${newCount}/${targetTimes}回目) を完了`)
    : `ハビット「${habit.name}」を完了`;

  pushUndoAction({
    description: toastMsg,
    undo: () => {
      if (prevHistoryEntry === undefined) {
        delete habit.history[dateKey];
      } else {
        habit.history[dateKey] = prevHistoryEntry;
      }
      habit.executionLogs = habit.executionLogs.filter(l => l.id !== logId);
      habit.status = prevStatus;
      recalculateHabitRates(habit);
    }
  });

  recalculateHabitRates(habit);
  saveHabits();
  renderApp();
}

// Execution Timeline Renderer
function renderExecutionTimeline(type, item) {
  const containerId = type === 'habit' ? 'edit-habit-timeline-list' : 'edit-task-timeline-list';
  const countBadgeId = type === 'habit' ? 'edit-habit-timeline-count' : 'edit-task-timeline-count';
  
  const container = document.getElementById(containerId);
  const countBadge = document.getElementById(countBadgeId);
  if (!container) return;

  // Sync executionLogs with history entries if executionLogs is empty but history has entries
  if (!Array.isArray(item.executionLogs)) item.executionLogs = [];
  
  if (item.executionLogs.length === 0 && item.history) {
    if (Array.isArray(item.history)) {
      item.history.forEach((h, idx) => {
        item.executionLogs.push({
          id: 'hist_' + idx + '_' + (h.date || 'unknown'),
          dateKey: h.date || '',
          completedAt: h.completedAt || new Date().toISOString(),
          count: h.count || 1,
          durationMin: h.durationMin || 0,
          note: h.note || ''
        });
      });
    } else if (typeof item.history === 'object') {
      Object.entries(item.history).forEach(([dk, val]) => {
        if (val === true || (typeof val === 'object' && val !== null && (val.done || val.count))) {
          item.executionLogs.push({
            id: 'hist_' + dk,
            dateKey: dk,
            completedAt: (typeof val === 'object' && val.completedAt) ? val.completedAt : `${dk}T12:00:00.000Z`,
            count: (typeof val === 'object' && val.count) ? val.count : 1,
            durationMin: (typeof val === 'object' && val.durationMin) ? val.durationMin : (item.targetMin || 10),
            note: (typeof val === 'object' && val.note) ? val.note : ''
          });
        }
      });
    }
  }

  // Sort logs by date descending
  item.executionLogs.sort((a, b) => new Date(b.completedAt || b.dateKey) - new Date(a.completedAt || a.dateKey));

  if (countBadge) {
    countBadge.textContent = `全${item.executionLogs.length}件の記録`;
  }

  if (item.executionLogs.length === 0) {
    container.innerHTML = `
      <div class="timeline-empty-state">
        <span>📜 まだ実行記録はありません。「✓ 完了」時に一言メモを残すと、ここに時系列で蓄積されます。</span>
      </div>
    `;
    return;
  }

  const isHabit = type === 'habit';
  container.innerHTML = item.executionLogs.map(log => {
    const d = new Date(log.completedAt || log.dateKey);
    const dateFormatted = isNaN(d.getTime()) ? (log.dateKey || '日付未記録') : `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const countText = (isHabit && log.count) ? `<span class="timeline-badge">${log.count}回目</span>` : '';
    const durationText = log.durationMin ? `<span class="timeline-badge">⏱️ ${log.durationMin}分</span>` : '';
    const noteText = log.note ? `<div class="timeline-note">${escapeHtml(log.note)}</div>` : `<div class="timeline-note" style="color: var(--text-dim); font-style: italic;">（メモなし完了）</div>`;

    return `
      <div class="timeline-item ${isHabit ? 'habit-item' : ''}" data-log-id="${log.id}">
        <div class="timeline-item-main">
          <div class="timeline-item-meta">
            <span class="timeline-date">${dateFormatted}</span>
            ${countText}
            ${durationText}
          </div>
          ${noteText}
        </div>
        <div class="timeline-item-actions">
          <button type="button" class="timeline-btn-del" onclick="deleteExecutionLog('${type}', '${item.id}', '${log.id}')" title="この記録を削除">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function deleteExecutionLog(type, itemId, logId) {
  if (!confirm('この実行記録を削除しますか？')) return;
  const list = type === 'habit' ? state.habits : state.tasks;
  const item = list.find(x => String(x.id) === String(itemId));
  if (!item || !Array.isArray(item.executionLogs)) return;

  item.executionLogs = item.executionLogs.filter(l => l.id !== logId);
  if (type === 'habit') {
    saveHabits();
  } else {
    saveTasks();
  }
  renderExecutionTimeline(type, item);
  renderApp();
}

function toggleHabit(id) {
  const targetId = String(id);
  const habit = state.habits.find(h => String(h.id) === targetId);
  if (!habit) return;

  const dateKey = getSelectedDateKey();
  if (!habit.history) habit.history = {};

  const curCount = getHabitDayCount(habit, dateKey);
  const targetTimes = getHabitTargetTimes(habit);

  if (habit.status === 'in_progress') {
    completeHabit(id);
    return;
  }

  if (curCount > 0) {
    const newCount = Math.max(0, curCount - 1);
    const prevHistoryEntry = habit.history[dateKey];
    const prevStatus = habit.status;

    if (newCount === 0) {
      delete habit.history[dateKey];
      habit.status = 'uncompleted';
    } else {
      habit.history[dateKey] = {
        done: newCount >= targetTimes,
        count: newCount,
        durationMin: habit.targetMin || 15,
        completedAt: new Date().toISOString()
      };
      habit.status = (newCount >= targetTimes) ? 'completed' : 'uncompleted';
    }
    habit.startTimestamp = null;

    pushUndoAction({
      description: `ハビット「${habit.name}」の完了を取り消し (${newCount}/${targetTimes}回)`,
      undo: () => {
        habit.history[dateKey] = prevHistoryEntry;
        habit.status = prevStatus;
        recalculateHabitRates(habit);
      }
    });

  } else {
    startHabit(id);
    return;
  }

  recalculateHabitRates(habit);
  saveHabits();
  renderApp();
}

function skipHabit(id) {
  const targetId = String(id);
  const habit = state.habits.find(h => String(h.id) === targetId);
  if (!habit) return;

  const dateKey = getSelectedDateKey();
  if (!habit.history) habit.history = {};
  delete habit.history[dateKey];

  habit.status = 'skipped';
  if (String(state.activeHabitId) === targetId) {
    state.activeHabitId = null;
  }
  habit.startTimestamp = null;

  saveHabits();
  renderApp();
}

// =========================================================================
// 5. Query & Filter
// =========================================================================

function getFilteredHabits(customMode = null) {
  const mode = customMode || state.currentMode;
  let list = [...state.habits];

  // 1. Recurrence schedule filter (Skip for table mode: table mode always displays ALL registered master habits)
  if (mode !== 'table') {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - state.selectedDateOffset);
    list = list.filter(h => isHabitScheduledForDate(h, targetDate));
  }

  // 2. Section Mode: Check Time Window (Overlap)
  if (mode === 'section') {
    list = list.filter(h => isHabitInCurrentTimeWindow(h));
  }

  // 3. Focus Mode: Check if habit is active in current or future time (exclude past expired habits)
  if (mode === 'focus') {
    list = list.filter(isHabitActiveForFocus);
    list = list.filter(h => getHabitStatusForSelectedDate(h) !== 'completed');
  } else if (mode !== 'table') {
    if (state.filters.status === 'uncompleted') {
      list = list.filter(h => getHabitStatusForSelectedDate(h) !== 'completed');
    } else if (state.filters.status === 'completed') {
      list = list.filter(h => getHabitStatusForSelectedDate(h) === 'completed');
    }
  }

  // 4. Domain cascade filter
  if (state.filters.domain) {
    list = list.filter(h => h.domain === state.filters.domain || h.domainMajor === state.filters.domain);
  }

  // 5. Dept cascade filter
  if (state.filters.dept) {
    list = list.filter(h => h.dept === state.filters.dept || h.deptMajor === state.filters.dept);
  }

  // 6. Project cascade filter
  if (state.filters.proj) {
    list = list.filter(h => h.proj === state.filters.proj || h.projMajor === state.filters.proj);
  }

  // 7. Tag 3-way filter (Include / Exclude)
  list = list.filter(matchesTagFilters);

  return list;
}



// =========================================================================
// 6. UI Renderers
// =========================================================================

function renderApp() {
  if (!state.currentSection) {
    state.currentSection = detectCurrentSection();
  }
  updateHeaderAndStatus();
  updateFilterPillsUI();
  updateSidebarBadges();
  renderSidebarCalendar();
  updateCarryoverBanner();

  if (state.currentMode === 'section') {
    renderSectionView();
  } else if (state.currentMode === 'focus') {
    renderFocusView();
  } else if (state.currentMode === 'all') {
    renderAllView();
  } else if (state.currentMode === 'table') {
    renderTableView();
  } else if (state.currentMode === 'bucket') {
    renderBucketView();
  } else if (state.currentMode === 'goals') {
    renderGoalsView();
  } else if (state.currentMode === 'timer') {
    if (typeof renderTimerView === 'function') renderTimerView();
  }
}

function updateHeaderAndStatus() {
  const now = new Date();
  const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  const timeDisplay = document.getElementById('current-time-display');
  if (timeDisplay) timeDisplay.textContent = timeStr;
  
  const secDisplay = document.getElementById('current-section-name');
  if (secDisplay) secDisplay.textContent = state.currentSection;

  // Live Section Time Progress Scale Bar Calculation
  const currentSec = SECTIONS_CONFIG.find(s => s.name === state.currentSection) || SECTIONS_CONFIG[0];
  const startHours = currentSec.start;
  const endHours = currentSec.end;
  const totalSecMins = (endHours - startHours) * 60;

  const nowHours = now.getHours() + now.getMinutes() / 60;
  let elapsedMins = 0;
  if (nowHours < startHours) {
    elapsedMins = 0;
  } else if (nowHours >= endHours) {
    elapsedMins = totalSecMins;
  } else {
    elapsedMins = (nowHours - startHours) * 60;
  }

  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMins / totalSecMins) * 100)));
  const remainingMins = Math.max(0, Math.round(totalSecMins - elapsedMins));

  const scaleFillEl = document.getElementById('section-scale-fill');
  if (scaleFillEl) scaleFillEl.style.width = `${progressPercent}%`;

  const scalePercentEl = document.getElementById('section-scale-percent');
  if (scalePercentEl) scalePercentEl.textContent = `${progressPercent}% 経過 (残り ${remainingMins}分)`;

  const scaleStartEl = document.getElementById('scale-boundary-start');
  if (scaleStartEl) scaleStartEl.textContent = currentSec.startStr || '00:00';

  const scaleEndEl = document.getElementById('scale-boundary-end');
  if (scaleEndEl) scaleEndEl.textContent = currentSec.endStr || '00:00';

  // Target Date Display
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - state.selectedDateOffset);
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const y = targetDate.getFullYear();
  const m = targetDate.getMonth() + 1;
  const d = targetDate.getDate();
  const w = weekdays[targetDate.getDay()];
  const dateStr = `${y}年${m}月${d}日(${w})`;

  const dateTextEl = document.getElementById('header-date-text');
  if (dateTextEl) dateTextEl.textContent = dateStr;

  const dateTagEl = document.getElementById('header-date-tag');
  const btnTodayEl = document.getElementById('btn-date-today');
  const bannerEl = document.getElementById('past-date-banner');
  const bannerDateEl = document.getElementById('banner-date-str');

  if (state.selectedDateOffset === 0) {
    if (dateTagEl) {
      dateTagEl.textContent = '今日';
      dateTagEl.className = 'date-tag-today';
    }
    if (btnTodayEl) btnTodayEl.classList.add('hidden');
    if (bannerEl) bannerEl.classList.add('hidden');
  } else if (state.selectedDateOffset > 0) {
    let tagText = `${state.selectedDateOffset}日前`;
    if (state.selectedDateOffset === 1) tagText = '昨日';
    else if (state.selectedDateOffset === 2) tagText = '一昨日';

    if (dateTagEl) {
      dateTagEl.textContent = tagText;
      dateTagEl.className = 'date-tag-past';
    }
    if (btnTodayEl) btnTodayEl.classList.remove('hidden');
    if (bannerEl) {
      bannerEl.classList.remove('hidden');
      bannerEl.className = 'past-date-banner is-past';
      bannerEl.innerHTML = `
        <div class="banner-left">
          <span class="banner-icon">📜</span>
          <span class="banner-text">過去日（<b>${m}月${d}日 (${tagText})</b>）の実行記録モードです。過去の完了実績を確認・修正できます。</span>
        </div>
        <button class="btn-banner-reset" id="btn-banner-reset" onclick="resetToToday()">⚡ 今日の画面に戻る</button>
      `;
    }
  } else {
    // 未来日 (selectedDateOffset < 0)
    const futureDays = Math.abs(state.selectedDateOffset);
    let tagText = `${futureDays}日後`;
    if (futureDays === 1) tagText = '明日';
    else if (futureDays === 2) tagText = '明後日';

    if (dateTagEl) {
      dateTagEl.textContent = tagText;
      dateTagEl.className = 'date-tag-future';
    }
    if (btnTodayEl) btnTodayEl.classList.remove('hidden');
    if (bannerEl) {
      bannerEl.classList.remove('hidden');
      bannerEl.className = 'past-date-banner is-future';
      bannerEl.innerHTML = `
        <div class="banner-left">
          <span class="banner-icon">📅</span>
          <span class="banner-text">未来日（<b>${m}月${d}日 (${tagText})</b>）の事前計画モードです。予定タスクの確認・事前追加ができます。</span>
        </div>
        <button class="btn-banner-reset" id="btn-banner-reset" onclick="resetToToday()">⚡ 今日の画面に戻る</button>
      `;
    }
  }

  const activeHabit = state.habits.find(h => h.id === state.activeHabitId);
  const activeTask = state.tasks.find(t => t.id === state.activeTaskId || t.status === 'in_progress');
  const activeNameEl = document.getElementById('active-habit-name');
  if (activeNameEl) {
    if (activeTask && state.selectedDateOffset === 0) {
      activeNameEl.textContent = `🎯 ${activeTask.title} (${activeTask.actStart || ''}~)`;
    } else if (activeHabit && state.selectedDateOffset === 0) {
      activeNameEl.textContent = `🌿 ${activeHabit.name}`;
    } else {
      activeNameEl.textContent = 'なし';
    }
  }

  // Real-Time TaskChute Dynamic Estimates & ETAs calculation
  calculateTaskChuteEstimates();
}

function updateFilterPillsUI() {
  const statusLabels = { uncompleted: '未完了のみ', all: '全件表示', completed: '完了のみ' };
  document.getElementById('filter-status-val').textContent = statusLabels[state.filters.status];
  document.getElementById('filter-domain-val').textContent = state.filters.domain || 'すべて';
  document.getElementById('filter-dept-val').textContent = state.filters.dept || 'すべて';
  document.getElementById('filter-proj-val').textContent = state.filters.proj || 'すべて';

  const tagValEl = document.getElementById('filter-tag-val');
  if (tagValEl) {
    const inc = state.filters.includeTags || [];
    const exc = state.filters.excludeTags || [];
    if (inc.length === 0 && exc.length === 0) {
      tagValEl.textContent = 'すべて';
    } else {
      const parts = [];
      if (inc.length > 0) parts.push(`+${inc.map(t => '#' + t).join(',')}`);
      if (exc.length > 0) parts.push(`-${exc.map(t => '#' + t).join(',')}`);
      tagValEl.textContent = parts.join(' ');
    }
  }

  const hasTagFilter = (state.filters.includeTags && state.filters.includeTags.length > 0) || (state.filters.excludeTags && state.filters.excludeTags.length > 0);
  const hasFilter = state.filters.domain || state.filters.dept || state.filters.proj || hasTagFilter || (state.currentMode !== 'table' && state.filters.status !== 'uncompleted');
  const resetBtn = document.getElementById('btn-reset-filters');
  if (hasFilter) {
    resetBtn.classList.remove('hidden');
  } else {
    resetBtn.classList.add('hidden');
  }

  renderSmartTagBar();
}

// Update Left Sidebar Badge Counts
function updateSidebarBadges() {
  const buckets = ['inbox', 'this_week', 'next_week', 'genius', 'someday', 'vault'];
  buckets.forEach(b => {
    const count = state.tasks.filter(t => !t.isDisabled && t.bucket === b && t.status !== 'completed').length;
    const badge = document.getElementById(`badge-count-${b}`);
    if (badge) badge.textContent = count;
  });

  const labels = [
    { key: 'iron_rule', id: 'iron' },
    { key: 'frog0', id: 'frog0' },
    { key: 'p1', id: 'p1' },
    { key: 'p2', id: 'p2' },
    { key: 'p3', id: 'p3' },
    { key: 'p4', id: 'p4' }
  ];
  labels.forEach(l => {
    const count = state.tasks.filter(t => !t.isDisabled && t.label === l.key && t.status !== 'completed').length;
    const badge = document.getElementById(`badge-count-${l.id}`);
    if (badge) badge.textContent = count;
  });
}

// =========================================================================
// 6-CAL. Sidebar Mini Calendar Widget (Amazing Marvin Style)
// =========================================================================

function jumpToDate(year, month, day) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(year, month, day);
  target.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - target.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  state.selectedDateOffset = diffDays;
  state.calendarViewYear = year;
  state.calendarViewMonth = month;
  
  renderApp();
}



// Set View Type Filter (All / Task Only / Habit Only)
function setViewType(type) {
  state.viewType = type;
  document.body.dataset.viewType = type;
  document.querySelectorAll('#filter-view-type .view-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  renderApp();
}

function cycleViewType() {
  const types = ['all', 'task', 'habit'];
  const nextIdx = (types.indexOf(state.viewType) + 1) % types.length;
  setViewType(types[nextIdx]);
}



// TaskChute Dynamic Estimates & ETAs Real-Time Calculation Engine (Date-Aware: Today, Past, Future)
function calculateTaskChuteEstimates() {
  const now = new Date();
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - state.selectedDateOffset);

  const selectedDateTasks = state.tasks.filter(isTaskForSelectedDate);
  const selectedDateHabits = state.habits.filter(h => isHabitScheduledForDate(h, targetDate));

  const isToday = state.selectedDateOffset === 0;
  const isPast = state.selectedDateOffset > 0;
  const isFuture = state.selectedDateOffset < 0;

  // DOM elements
  const dayEtaBadge = document.getElementById('header-daily-eta-badge');
  const dayEtaLabelEl = dayEtaBadge ? dayEtaBadge.querySelector('.daily-eta-label') : null;
  const dayEtaTimeEl = document.getElementById('daily-eta-time-val');
  const dayEtaInfoEl = document.getElementById('daily-eta-remain-info');

  const secEtaBadge = document.getElementById('section-eta-badge');
  const secRemainMinEl = document.getElementById('section-remain-minutes');
  const secEtaTimeEl = document.getElementById('section-eta-time');

  // -------------------------------------------------------------
  // 1. TODAY: Real-Time Dynamic ETA Mode
  // -------------------------------------------------------------
  if (isToday) {
    if (dayEtaLabelEl) dayEtaLabelEl.textContent = '🏁 今日完了見込み:';

    let totalDayRemainMin = 0;
    let totalDayRemainCount = 0;

    selectedDateTasks.forEach(t => {
      const status = getTaskStatusForSelectedDate(t);
      if (status !== 'completed' && status !== 'skipped') {
        totalDayRemainMin += getItemRemainingMinutes(t, 'task');
        totalDayRemainCount++;
      }
    });

    selectedDateHabits.forEach(h => {
      const status = getHabitStatusForSelectedDate(h);
      if (status !== 'completed' && status !== 'skipped') {
        totalDayRemainMin += getItemRemainingMinutes(h, 'habit');
        totalDayRemainCount++;
      }
    });

    const dayEtaDate = new Date(now.getTime() + totalDayRemainMin * 60000);
    const dayEtaTimeStr = `${String(dayEtaDate.getHours()).padStart(2, '0')}:${String(dayEtaDate.getMinutes()).padStart(2, '0')}`;
    const hours = Math.floor(totalDayRemainMin / 60);
    const mins = totalDayRemainMin % 60;
    const dayRemainFormatted = hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;

    if (dayEtaBadge) dayEtaBadge.title = '今日の全未完了アイテムを今すぐ順に実行した場合の終了見込み時刻';
    if (dayEtaTimeEl) dayEtaTimeEl.textContent = totalDayRemainCount > 0 ? dayEtaTimeStr : '達成済🎉';
    if (dayEtaInfoEl) dayEtaInfoEl.textContent = totalDayRemainCount > 0 ? `残り ${dayRemainFormatted} (${totalDayRemainCount}件)` : '今日の全予定クリア';

    // Current Section
    const currentSec = state.currentSection || '第2セッション';
    const secTasks = getTasksForSection(currentSec);
    const secHabits = state.habits.filter(isHabitInCurrentTimeWindow);

    let secRemainMin = 0;
    let secRemainCount = 0;
    secTasks.forEach(t => {
      const status = getTaskStatusForSelectedDate(t);
      if (status !== 'completed' && status !== 'skipped') {
        secRemainMin += getItemRemainingMinutes(t, 'task');
        secRemainCount++;
      }
    });
    secHabits.forEach(h => {
      const status = getHabitStatusForSelectedDate(h);
      if (status !== 'completed' && status !== 'skipped') {
        secRemainMin += getItemRemainingMinutes(h, 'habit');
        secRemainCount++;
      }
    });

    const secEtaDate = new Date(now.getTime() + secRemainMin * 60000);
    const secEtaTimeStr = `${String(secEtaDate.getHours()).padStart(2, '0')}:${String(secEtaDate.getMinutes()).padStart(2, '0')}`;
    const sH = Math.floor(secRemainMin / 60);
    const sM = secRemainMin % 60;

    if (secRemainMinEl) secRemainMinEl.textContent = sH > 0 ? `${sH}時間${sM}分` : `${sM}分`;
    if (secEtaTimeEl) secEtaTimeEl.textContent = secRemainCount > 0 ? secEtaTimeStr : '完了🎉';

    return {
      totalDayRemainMin,
      dayEtaTimeStr,
      dayRemainFormatted,
      totalDayRemainCount,
      secRemainMin,
      secEtaTimeStr,
      secRemainCount
    };
  }

  // -------------------------------------------------------------
  // 2. PAST DATE: Historical Actual Work Summary Mode
  // -------------------------------------------------------------
  if (isPast) {
    if (dayEtaLabelEl) dayEtaLabelEl.textContent = '📜 総実働時間:';

    let pastActualMins = 0;
    let completedCount = 0;
    let totalCount = selectedDateTasks.length + selectedDateHabits.length;

    selectedDateTasks.forEach(t => {
      const status = getTaskStatusForSelectedDate(t);
      if (status === 'completed') {
        completedCount++;
        pastActualMins += t.actMin || t.estMin || 15;
      }
    });

    const k = getSelectedDateKey();
    selectedDateHabits.forEach(h => {
      const status = getHabitStatusForSelectedDate(h);
      if (status === 'completed') {
        completedCount++;
        const logMin = (h.history && typeof h.history[k] === 'object' && h.history[k]?.durationMin) ? h.history[k].durationMin : (h.targetMin || 5);
        pastActualMins += logMin;
      }
    });

    const hours = Math.floor(pastActualMins / 60);
    const mins = pastActualMins % 60;
    const actFormatted = hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;

    if (dayEtaBadge) dayEtaBadge.title = '過去日の実績記録サマリー';
    if (dayEtaTimeEl) dayEtaTimeEl.textContent = `${actFormatted}`;
    if (dayEtaInfoEl) dayEtaInfoEl.textContent = `実績: ${completedCount}/${totalCount}件 完了`;

    // Section Summary for Past Date
    const currentSec = state.currentSection || '第2セッション';
    const secTasks = selectedDateTasks.filter(t => (t.section === currentSec) || (!t.section && currentSec === 'morning_prime'));
    const secHabits = selectedDateHabits.filter(h => h.displayType !== 'anytime' && (h.section === currentSec || (h.displayType === 'custom' && isHabitInTimeRange(h, SECTIONS_CONFIG.find(s => s.name === currentSec)))));

    let secActualMins = 0;
    let secDoneCount = 0;
    secTasks.forEach(t => {
      if (getTaskStatusForSelectedDate(t) === 'completed') {
        secDoneCount++;
        secActualMins += t.actMin || t.estMin || 15;
      }
    });
    secHabits.forEach(h => {
      if (getHabitStatusForSelectedDate(h) === 'completed') {
        secDoneCount++;
        const logMin = (h.history && typeof h.history[k] === 'object' && h.history[k]?.durationMin) ? h.history[k].durationMin : (h.targetMin || 5);
        secActualMins += logMin;
      }
    });

    const sH = Math.floor(secActualMins / 60);
    const sM = secActualMins % 60;
    if (secRemainMinEl) secRemainMinEl.textContent = `${secDoneCount}/${secTasks.length + secHabits.length}件`;
    if (secEtaTimeEl) secEtaTimeEl.textContent = sH > 0 ? `${sH}h${sM}m` : `${sM}分`;

    return {
      pastActualMins,
      completedCount,
      totalCount,
      secActualMins,
      secDoneCount
    };
  }

  // -------------------------------------------------------------
  // 3. FUTURE DATE: Planning & Total Scheduled Estimate Mode
  // -------------------------------------------------------------
  if (isFuture) {
    if (dayEtaLabelEl) dayEtaLabelEl.textContent = '📅 予定合計時間:';

    let totalScheduledMins = 0;
    let totalCount = 0;

    selectedDateTasks.forEach(t => {
      const estInfo = getEstimatedDuration(t, 'task');
      totalScheduledMins += estInfo.targetMin;
      totalCount++;
    });

    selectedDateHabits.forEach(h => {
      const estInfo = getEstimatedDuration(h, 'habit');
      totalScheduledMins += estInfo.targetMin;
      totalCount++;
    });

    const hours = Math.floor(totalScheduledMins / 60);
    const mins = totalScheduledMins % 60;
    const planFormatted = hours > 0 ? `${hours}時間${mins}分` : `${mins}分`;

    if (dayEtaBadge) dayEtaBadge.title = '未来日の予定総時間（事前計画モード）';
    if (dayEtaTimeEl) dayEtaTimeEl.textContent = `${planFormatted}`;
    if (dayEtaInfoEl) dayEtaInfoEl.textContent = `全${totalCount}件の予定`;

    // Section Summary for Future Date
    const currentSec = state.currentSection || '第2セッション';
    const secTasks = selectedDateTasks.filter(t => (t.section === currentSec) || (!t.section && currentSec === 'morning_prime'));
    const secHabits = selectedDateHabits.filter(h => h.displayType !== 'anytime' && (h.section === currentSec || (h.displayType === 'custom' && isHabitInTimeRange(h, SECTIONS_CONFIG.find(s => s.name === currentSec)))));

    let secPlanMins = 0;
    secTasks.forEach(t => { secPlanMins += getEstimatedDuration(t, 'task').targetMin; });
    secHabits.forEach(h => { secPlanMins += getEstimatedDuration(h, 'habit').targetMin; });

    const sH = Math.floor(secPlanMins / 60);
    const sM = secPlanMins % 60;
    if (secRemainMinEl) secRemainMinEl.textContent = `${secTasks.length + secHabits.length}件`;
    if (secEtaTimeEl) secEtaTimeEl.textContent = sH > 0 ? `${sH}h${sM}m` : `${sM}分`;

    return {
      totalScheduledMins,
      totalCount,
      secPlanMins
    };
  }
}





function isHabitInTimeRange(habit, section) {
  if (!habit.customStart) return false;
  const [sH] = habit.customStart.split(':').map(Number);
  return sH >= section.start && sH < section.end;
}

function selectAndToggleHabit(id, index) {
  state.selectedIndex = index;
  toggleHabit(id);
}

// =========================================================================
// Date & Section Navigation Functions for Arrow Keys
function nextDay() {
  state.selectedDateOffset--;
  renderApp();
}

function prevDay() {
  state.selectedDateOffset++;
  renderApp();
}

function resetToToday() {
  const now = new Date();
  state.calendarViewYear = now.getFullYear();
  state.calendarViewMonth = now.getMonth();
  if (state.selectedDateOffset !== 0) {
    state.selectedDateOffset = 0;
    renderApp();
  } else {
    renderSidebarCalendar();
  }
}

function nextSection() {
  const currentIndex = SECTIONS_CONFIG.findIndex(s => s.name === state.currentSection);
  if (currentIndex !== -1 && currentIndex < SECTIONS_CONFIG.length - 1) {
    state.currentSection = SECTIONS_CONFIG[currentIndex + 1].name;
  } else {
    state.currentSection = SECTIONS_CONFIG[0].name; // Loop back to 1st
  }
  if (state.currentMode !== 'section') {
    setMode('section');
  } else {
    renderApp();
  }
}

function prevSection() {
  const currentIndex = SECTIONS_CONFIG.findIndex(s => s.name === state.currentSection);
  if (currentIndex > 0) {
    state.currentSection = SECTIONS_CONFIG[currentIndex - 1].name;
  } else {
    state.currentSection = SECTIONS_CONFIG[SECTIONS_CONFIG.length - 1].name; // Loop back to last
  }
  if (state.currentMode !== 'section') {
    setMode('section');
  } else {
    renderApp();
  }
}



function setMode(mode) {
  // Reset manual sidebar overrides on mode switch
  document.body.classList.remove('sidebar-force-open', 'sidebar-collapsed');

  if (state.currentMode === mode) {
    // Already in this mode: perform context-aware toggle!
    if (mode === 'section') {
      cycleStatusFilter(); // 1: Toggle 未完 ⇄ 全件 ⇄ 完了
      return;
    }
    if (mode === 'focus') {
      cycleViewType(); // 2: Toggle タスク単独 ⇄ ハビット単独 ⇄ 両方
      return;
    }
    if (mode === 'all') {
      cycleStatusFilter(); // 3: Toggle 未完 ⇄ 全件 ⇄ 完了
      return;
    }
    if (mode === 'table') {
      // 4: Cycle Habits (1) ➔ Recurring Tasks (2) ➔ Single Tasks (3) ➔ Habits (1)
      if (state.masterSubtab === 'habits') {
        state.masterSubtab = 'tasks';
      } else if (state.masterSubtab === 'tasks' || state.masterSubtab === 'recurring_tasks') {
        state.masterSubtab = 'single_tasks';
      } else {
        state.masterSubtab = 'habits';
      }
      renderTableView();
      return;
    }
    if (mode === 'goals') {
      // 5: Toggle Front 4-Level Goals ⇄ Back Core Manifesto (魂の宣誓・根本決意)
      toggleGoalsSubmode();
      return;
    }
    if (mode === 'timer') {
      // 6: Already in timer mode -> maintain current view
      return;
    }
  }

  // Switching to new mode
  if (state.currentMode !== mode && state.currentMode !== 'timer') {
    state.previousMode = state.currentMode;
  }
  state.currentMode = mode;
  document.body.dataset.mode = mode;
  state.selectedIndex = 0; // reset selection on view switch
  document.querySelectorAll('.mode-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });
  document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${mode}`).classList.add('active');
  renderApp();
}

function cycleStatusFilter() {
  const modes = ['uncompleted', 'all', 'completed'];
  const nextIdx = (modes.indexOf(state.filters.status) + 1) % modes.length;
  state.filters.status = modes[nextIdx];
  renderApp();
}

function resetAllFilters() {
  state.filters = { status: 'uncompleted', domain: null, dept: null, proj: null, includeTags: [], excludeTags: [] };
  renderApp();
}



// =========================================================================
// 9. View Modes & Filters Global Controls
// =========================================================================


// Bindings
document.querySelectorAll('.mode-tab').forEach(tab => {
  tab.addEventListener('click', () => setMode(tab.dataset.mode));
});

// Table Sort Controls
const tableSortSelect = document.getElementById('table-sort-select');
if (tableSortSelect) {
  tableSortSelect.addEventListener('change', (e) => {
    state.tableSort.key = e.target.value;
    renderApp();
  });
}

const btnSortOrder = document.getElementById('btn-sort-order');
if (btnSortOrder) {
  btnSortOrder.addEventListener('click', () => {
    state.tableSort.order = state.tableSort.order === 'asc' ? 'desc' : 'asc';
    renderApp();
  });
}

// Table Header Sort Clicks
document.querySelectorAll('.col-head.sortable').forEach(head => {
  head.addEventListener('click', () => {
    const key = head.dataset.sort;
    if (state.tableSort.key === key) {
      state.tableSort.order = state.tableSort.order === 'asc' ? 'desc' : 'asc';
    } else {
      state.tableSort.key = key;
      state.tableSort.order = 'asc';
    }
    renderApp();
  });
});

const safeBindClick = (id, fn) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
};

safeBindClick('filter-status-pill', cycleStatusFilter);
safeBindClick('filter-domain-pill', () => openCascadeFilterModal('domain', 'ドメイン (PN1〜PN5)', DOMAINS_DATA));
safeBindClick('filter-dept-pill', () => openCascadeFilterModal('dept', '部門 (本部/直轄)', DEPTS_DATA));
safeBindClick('filter-proj-pill', () => openCascadeFilterModal('proj', 'プロジェクト', PROJECTS_DATA));
safeBindClick('filter-tag-pill', openTagFilterModal);
safeBindClick('btn-reset-filters', resetAllFilters);

safeBindClick('btn-shortcuts', openShortcutsModal);
safeBindClick('btn-close-shortcuts', closeModal);
safeBindClick('btn-close-filter', closeModal);
safeBindClick('btn-add-habit', openAddModal);
safeBindClick('btn-close-add', closeModal);
safeBindClick('btn-cancel-add', closeModal);

// Edit Modal Close
safeBindClick('btn-close-edit', closeModal);
safeBindClick('btn-cancel-edit', closeModal);

// Focus Habit Navigation
safeBindClick('btn-focus-habit-prev', () => {
  if (state.focusHabitIndex > 0) {
    state.focusHabitIndex--;
    renderFocusView();
  }
});
safeBindClick('btn-focus-habit-next', () => {
  state.focusHabitIndex++;
  renderFocusView();
});
safeBindClick('btn-focus-prev', () => {
  const filtered = getFilteredHabits();
  if (state.selectedIndex > 0) {
    state.selectedIndex--;
    renderApp();
  }
});
safeBindClick('btn-focus-next', () => {
  const filtered = getFilteredHabits();
  if (state.selectedIndex < filtered.length - 1) {
    state.selectedIndex++;
    renderApp();
  }
});

document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
});

// =========================================================================
// 10. Habit History & Edit Utilities
// =========================================================================


function renderProfileHistoryGrid(habit) {
  const container = document.getElementById('edit-history-grid');
  if (!container) return;

  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  let html = '';

  // Show past 13 days to today (offset 13 down to 0)
  for (let offset = 13; offset >= 0; offset--) {
    const d = new Date();
    d.setDate(d.getDate() - offset);
    const dateKey = getDateKeyOffset(offset);
    const isCompleted = habit.history && habit.history[dateKey] === true;
    const isToday = offset === 0;
    const m = d.getMonth() + 1;
    const dayNum = d.getDate();
    const w = weekdays[d.getDay()];

    const label = isToday ? '今日' : `${m}/${dayNum}`;
    const statusIcon = isCompleted ? '✓' : '-';

    html += `
      <div class="history-day-tile ${isCompleted ? 'completed' : ''} ${isToday ? 'today' : ''}" 
           onclick="toggleHistoryTile('${habit.id}', '${dateKey}', ${offset})" 
           title="${m}月${dayNum}日(${w}) - クリックして完了/未完了を切替">
        <span class="tile-date">${label}</span>
        <span class="tile-icon">${statusIcon}</span>
      </div>
    `;
  }

  container.innerHTML = html;
}

function toggleHistoryTile(habitId, dateKey, offset) {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit) return;
  if (!habit.history) habit.history = {};

  const wasCompleted = habit.history[dateKey] === true;
  if (wasCompleted) {
    delete habit.history[dateKey];
    if (offset === 0) {
      habit.status = 'uncompleted';
      state.selectedEditStatus = 'uncompleted';
      document.querySelectorAll('#edit-status-selector .segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === 'uncompleted');
      });
    }
  } else {
    habit.history[dateKey] = true;
    if (offset === 0) {
      habit.status = 'completed';
      state.selectedEditStatus = 'completed';
      document.querySelectorAll('#edit-status-selector .segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === 'completed');
      });
    }
  }

  recalculateHabitRates(habit);
  saveHabits();

  // Update rates inside modal
  const r3 = getHabitRate(habit, 3);
  const r7 = getHabitRate(habit, 7);
  const r30 = getHabitRate(habit, 30);
  const r90 = getHabitRate(habit, 90);

  const setBadge = (elId, rate) => {
    const el = document.getElementById(elId);
    if (el) {
      el.textContent = `${rate}%`;
      el.className = `rate-badge ${getRateBadgeClass(rate)}`;
    }
  };
  setBadge('edit-rate-3d', r3);
  setBadge('edit-rate-7d', r7);
  setBadge('edit-rate-30d', r30);
  setBadge('edit-rate-90d', r90);

  const tierEl = document.getElementById('edit-profile-tier');
  if (tierEl) tierEl.textContent = habit.stats?.tier || '🌱 Developing';

  renderProfileHistoryGrid(habit);
  renderApp();
}

// Delete Habit
document.getElementById('btn-delete-habit').addEventListener('click', () => {
  const id = document.getElementById('edit-habit-id').value;
  const habit = state.habits.find(h => h.id === id);
  if (!habit) return;

  if (confirm(`ハビット「${habit.name}」を完全に削除してもよろしいですか？`)) {
    state.habits = state.habits.filter(h => h.id !== id);
    if (state.activeHabitId === id) state.activeHabitId = null;
    saveHabits();
    closeModal();
    renderApp();
  }
});

// =========================================================================
// 11. Custom Right-Click Context Menu Logic
// =========================================================================

// =========================================================================
// 10-C. Context Menus (Habits & Task Quick Defer / Reschedule / Inbox)
// =========================================================================

function getTomorrowDateKey(baseDateKey = null) {
  const base = baseDateKey ? new Date(baseDateKey) : new Date();
  base.setDate(base.getDate() + 1);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
}

function getDayAfterTomorrowDateKey(baseDateKey = null) {
  const base = baseDateKey ? new Date(baseDateKey) : new Date();
  base.setDate(base.getDate() + 2);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
}

function getNextWeekdayDateKey(baseDateKey = null) {
  const base = baseDateKey ? new Date(baseDateKey) : new Date();
  const day = base.getDay(); // 0: Sun, 1: Mon, ..., 5: Fri, 6: Sat
  let addDays = 1;
  if (day === 5) {
    addDays = 3; // 金曜 ➔ 月曜
  } else if (day === 6) {
    addDays = 2; // 土曜 ➔ 月曜
  } else if (day === 0) {
    addDays = 1; // 日曜 ➔ 月曜
  } else {
    addDays = 1; // 月〜木 ➔ 翌日
  }
  base.setDate(base.getDate() + addDays);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
}

function deferTask(taskId, targetDateKey, targetBucket = 'today', actionLabel = '') {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const prevScheduledDate = task.scheduledDate;
  const prevBucket = task.bucket;
  const prevSection = task.section;

  task.scheduledDate = targetDateKey;
  task.bucket = targetBucket;

  saveTasks();
  renderApp();

  if (typeof showUndoToast === 'function') {
    showUndoToast(`⚡ 「${task.title}」を ${actionLabel} に移動しました`, () => {
      task.scheduledDate = prevScheduledDate;
      task.bucket = prevBucket;
      task.section = prevSection;
      saveTasks();
      renderApp();
    });
  }
}

function showContextMenu(e, habitId) {
  e.preventDefault();
  hideAllContextMenus();
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit) return;

  state.contextMenuHabitId = habitId;

  // Header Title
  const headerEl = document.getElementById('context-menu-habit-name');
  if (headerEl) headerEl.textContent = habit.name;

  // Dynamic Toggle Complete Button
  const toggleIcon = document.getElementById('ctx-toggle-icon');
  const toggleText = document.getElementById('ctx-toggle-text');
  const isCompleted = habit.status === 'completed';

  if (isCompleted) {
    if (toggleIcon) toggleIcon.textContent = '⏳';
    if (toggleText) toggleText.textContent = '今日を未完了に戻す';
  } else {
    if (toggleIcon) toggleIcon.textContent = '✓';
    if (toggleText) toggleText.textContent = '今日を完了にする';
  }

  // Positioning with viewport boundary clamp
  const menu = document.getElementById('habit-context-menu');
  if (!menu) return;

  menu.classList.add('active');
  const menuWidth = 240;
  const menuHeight = 230;
  let x = e.clientX;
  let y = e.clientY;

  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }

  menu.style.left = `${Math.max(10, x)}px`;
  menu.style.top = `${Math.max(10, y)}px`;
}

function showTaskContextMenu(e, taskId) {
  e.preventDefault();
  hideAllContextMenus();
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  state.contextMenuTaskId = taskId;

  // Header Title
  const headerEl = document.getElementById('context-menu-task-name');
  if (headerEl) headerEl.textContent = task.title;

  // Dynamic date labels (e.g. 明日 (8/21), 明後日 (8/22), 次の平日 (8/21))
  const tomorrowKey = getTomorrowDateKey();
  const dayAfterKey = getDayAfterTomorrowDateKey();
  const nextWeekdayKey = getNextWeekdayDateKey();

  const tomorrowLabel = document.getElementById('ctx-task-tomorrow-text');
  if (tomorrowLabel) {
    const [, m, d] = tomorrowKey.split('-');
    tomorrowLabel.textContent = `明日 (${parseInt(m, 10)}/${parseInt(d, 10)}) へ移動`;
  }

  const dayAfterLabel = document.getElementById('ctx-task-dayafter-text');
  if (dayAfterLabel) {
    const [, m, d] = dayAfterKey.split('-');
    dayAfterLabel.textContent = `明後日 (${parseInt(m, 10)}/${parseInt(d, 10)}) へ移動`;
  }

  const nextWeekdayLabel = document.getElementById('ctx-task-nextweekday-text');
  if (nextWeekdayLabel) {
    const [, m, d] = nextWeekdayKey.split('-');
    nextWeekdayLabel.textContent = `次の平日 (${parseInt(m, 10)}/${parseInt(d, 10)}) へ移動`;
  }

  // Positioning with viewport boundary clamp
  const menu = document.getElementById('task-context-menu');
  if (!menu) return;

  menu.classList.add('active');
  const menuWidth = 250;
  const menuHeight = 280;
  let x = e.clientX;
  let y = e.clientY;

  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10;
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10;
  }

  menu.style.left = `${Math.max(10, x)}px`;
  menu.style.top = `${Math.max(10, y)}px`;
}

function hideAllContextMenus() {
  const habitMenu = document.getElementById('habit-context-menu');
  if (habitMenu) habitMenu.classList.remove('active');

  const taskMenu = document.getElementById('task-context-menu');
  if (taskMenu) taskMenu.classList.remove('active');
}

function hideContextMenu() {
  hideAllContextMenus();
}

function setupContextMenuHandlers() {
  // Global Right Click Delegation on any task or habit card/row
  document.addEventListener('contextmenu', (e) => {
    // 1. Task Card / Row Right Click
    const taskTarget = e.target.closest('[data-type="task"], .task-card, .table-row.task-row');
    if (taskTarget) {
      const tid = taskTarget.dataset.id || taskTarget.dataset.taskId;
      if (tid && state.tasks.some(t => t.id === tid)) {
        showTaskContextMenu(e, tid);
        return;
      }
    }

    // 2. Habit Card / Row Right Click
    const habitTarget = e.target.closest('[data-type="habit"], .habit-card, .habit-row, [data-id]');
    if (habitTarget) {
      const hid = habitTarget.dataset.id;
      if (hid && state.habits.some(h => h.id === hid)) {
        showContextMenu(e, hid);
        return;
      }
    }

    hideAllContextMenus();
  });

  // Global click & scroll to hide
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#habit-context-menu') && !e.target.closest('#task-context-menu')) {
      hideAllContextMenus();
    }
  });
  window.addEventListener('scroll', hideAllContextMenus, true);
  window.addEventListener('resize', hideAllContextMenus);

  // ==========================================
  // Habit Context Menu Actions
  // ==========================================
  const btnToggle = document.getElementById('ctx-toggle-complete');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      const hid = state.contextMenuHabitId;
      hideAllContextMenus();
      if (!hid) return;
      toggleHabit(hid);
    });
  }

  const btnInProg = document.getElementById('ctx-set-inprogress');
  if (btnInProg) {
    btnInProg.addEventListener('click', () => {
      const hid = state.contextMenuHabitId;
      hideAllContextMenus();
      if (hid) startHabit(hid);
    });
  }

  const btnSkip = document.getElementById('ctx-set-skip');
  if (btnSkip) {
    btnSkip.addEventListener('click', () => {
      const hid = state.contextMenuHabitId;
      hideAllContextMenus();
      if (hid) skipHabit(hid);
    });
  }

  const btnProfile = document.getElementById('ctx-open-profile');
  if (btnProfile) {
    btnProfile.addEventListener('click', () => {
      const hid = state.contextMenuHabitId;
      hideAllContextMenus();
      if (hid) openEditModal(hid);
    });
  }

  const btnDelete = document.getElementById('ctx-delete-habit');
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      const hid = state.contextMenuHabitId;
      hideAllContextMenus();
      if (!hid) return;
      const habit = state.habits.find(h => h.id === hid);
      if (habit && confirm(`ハビット「${habit.name}」を完全に削除してもよろしいですか？`)) {
        state.habits = state.habits.filter(h => h.id !== hid);
        if (state.activeHabitId === hid) state.activeHabitId = null;
        saveHabits();
        renderApp();
      }
    });
  }

  // ==========================================
  // Task Context Menu Actions (Quick Defer / Reschedule / Inbox)
  // ==========================================

  // 1. Defer to Tomorrow
  const btnTaskTomorrow = document.getElementById('ctx-task-defer-tomorrow');
  if (btnTaskTomorrow) {
    btnTaskTomorrow.addEventListener('click', () => {
      const tid = state.contextMenuTaskId;
      hideAllContextMenus();
      if (!tid) return;
      const targetDate = getTomorrowDateKey();
      const [, m, d] = targetDate.split('-');
      deferTask(tid, targetDate, 'today', `明日 (${parseInt(m, 10)}/${parseInt(d, 10)})`);
    });
  }

  // 2. Defer to Day After Tomorrow
  const btnTaskDayAfter = document.getElementById('ctx-task-defer-day-after');
  if (btnTaskDayAfter) {
    btnTaskDayAfter.addEventListener('click', () => {
      const tid = state.contextMenuTaskId;
      hideAllContextMenus();
      if (!tid) return;
      const targetDate = getDayAfterTomorrowDateKey();
      const [, m, d] = targetDate.split('-');
      deferTask(tid, targetDate, 'today', `明後日 (${parseInt(m, 10)}/${parseInt(d, 10)})`);
    });
  }

  // 3. Defer to Next Weekday
  const btnTaskNextWeekday = document.getElementById('ctx-task-defer-next-weekday');
  if (btnTaskNextWeekday) {
    btnTaskNextWeekday.addEventListener('click', () => {
      const tid = state.contextMenuTaskId;
      hideAllContextMenus();
      if (!tid) return;
      const targetDate = getNextWeekdayDateKey();
      const [, m, d] = targetDate.split('-');
      deferTask(tid, targetDate, 'today', `次の平日 (${parseInt(m, 10)}/${parseInt(d, 10)})`);
    });
  }

  // 4. Defer to Custom Date
  const btnTaskCustom = document.getElementById('ctx-task-defer-custom');
  if (btnTaskCustom) {
    btnTaskCustom.addEventListener('click', () => {
      const tid = state.contextMenuTaskId;
      hideAllContextMenus();
      if (!tid) return;
      const defaultDate = getTomorrowDateKey();
      const inputDate = prompt('実行予定日を入力してください (YYYY-MM-DD):', defaultDate);
      if (inputDate && /^\d{4}-\d{2}-\d{2}$/.test(inputDate.trim())) {
        const targetDate = inputDate.trim();
        const [, m, d] = targetDate.split('-');
        deferTask(tid, targetDate, 'today', `指定日 (${parseInt(m, 10)}/${parseInt(d, 10)})`);
      }
    });
  }

  // 5. Move to Inbox (No Date)
  const btnTaskInbox = document.getElementById('ctx-task-defer-inbox');
  if (btnTaskInbox) {
    btnTaskInbox.addEventListener('click', () => {
      const tid = state.contextMenuTaskId;
      hideAllContextMenus();
      if (!tid) return;
      deferTask(tid, null, 'inbox', 'Inbox (日付なし)');
    });
  }

  // 6. Edit Task Modal
  const btnTaskEdit = document.getElementById('ctx-task-edit');
  if (btnTaskEdit) {
    btnTaskEdit.addEventListener('click', () => {
      const tid = state.contextMenuTaskId;
      hideAllContextMenus();
      if (tid) openEditTaskModal(tid);
    });
  }

  // 7. Delete Task
  const btnTaskDelete = document.getElementById('ctx-task-delete');
  if (btnTaskDelete) {
    btnTaskDelete.addEventListener('click', () => {
      const tid = state.contextMenuTaskId;
      hideAllContextMenus();
      if (!tid) return;
      const task = state.tasks.find(t => t.id === tid);
      if (task && confirm(`タスク「${task.title}」を完全に削除してもよろしいですか？`)) {
        state.tasks = state.tasks.filter(t => t.id !== tid);
        if (state.activeTaskId === tid) state.activeTaskId = null;
        saveTasks();
        renderApp();
      }
    });
  }
}

// Date Navigation Listeners
function setupDateNavHandlers() {
  const btnPrev = document.getElementById('btn-date-prev');
  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      state.selectedDateOffset++;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - state.selectedDateOffset);
      state.calendarViewYear = targetDate.getFullYear();
      state.calendarViewMonth = targetDate.getMonth();
      renderApp();
    });
  }

  const btnNext = document.getElementById('btn-date-next');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      state.selectedDateOffset--;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - state.selectedDateOffset);
      state.calendarViewYear = targetDate.getFullYear();
      state.calendarViewMonth = targetDate.getMonth();
      renderApp();
    });
  }

  const btnToday = document.getElementById('btn-date-today');
  if (btnToday) {
    btnToday.addEventListener('click', () => {
      resetToToday();
    });
  }

  const btnBannerReset = document.getElementById('btn-banner-reset');
  if (btnBannerReset) {
    btnBannerReset.addEventListener('click', () => {
      resetToToday();
    });
  }

  const btnQuickReload = document.getElementById('btn-quick-reload');
  if (btnQuickReload) {
    btnQuickReload.addEventListener('click', () => {
      reloadAppData();
    });
  }

  // --- Sidebar Mini Calendar Widget Listeners (Amazing Marvin Style) ---
  const btnCalPrev = document.getElementById('btn-cal-prev');
  if (btnCalPrev) {
    btnCalPrev.addEventListener('click', (e) => {
      e.stopPropagation();
      state.calendarViewMonth--;
      if (state.calendarViewMonth < 0) {
        state.calendarViewMonth = 11;
        state.calendarViewYear--;
      }
      renderSidebarCalendar();
    });
  }

  const btnCalNext = document.getElementById('btn-cal-next');
  if (btnCalNext) {
    btnCalNext.addEventListener('click', (e) => {
      e.stopPropagation();
      state.calendarViewMonth++;
      if (state.calendarViewMonth > 11) {
        state.calendarViewMonth = 0;
        state.calendarViewYear++;
      }
      renderSidebarCalendar();
    });
  }

  const btnCalPrevYear = document.getElementById('btn-cal-prev-year');
  if (btnCalPrevYear) {
    btnCalPrevYear.addEventListener('click', (e) => {
      e.stopPropagation();
      state.calendarViewYear--;
      renderSidebarCalendar();
    });
  }

  const btnCalNextYear = document.getElementById('btn-cal-next-year');
  if (btnCalNextYear) {
    btnCalNextYear.addEventListener('click', (e) => {
      e.stopPropagation();
      state.calendarViewYear++;
      renderSidebarCalendar();
    });
  }

  const titleWrap = document.getElementById('sidebar-cal-title');
  if (titleWrap) {
    titleWrap.addEventListener('click', () => {
      const now = new Date();
      state.calendarViewYear = now.getFullYear();
      state.calendarViewMonth = now.getMonth();
      renderSidebarCalendar();
    });
  }

  const btnCalToday = document.getElementById('btn-cal-today');
  if (btnCalToday) {
    btnCalToday.addEventListener('click', () => {
      resetToToday();
    });
  }

  // Carryover Banner & Modal Event Listeners
  const btnCarryoverAll = document.getElementById('btn-carryover-all');
  if (btnCarryoverAll) {
    btnCarryoverAll.addEventListener('click', () => {
      carryoverAllPastTasksToCurrentSection();
    });
  }

  const btnCarryoverReview = document.getElementById('btn-carryover-review');
  if (btnCarryoverReview) {
    btnCarryoverReview.addEventListener('click', () => {
      openCarryoverModal();
    });
  }

  const btnCarryoverDismiss = document.getElementById('btn-carryover-dismiss');
  if (btnCarryoverDismiss) {
    btnCarryoverDismiss.addEventListener('click', () => {
      isCarryoverBannerDismissed = true;
      updateCarryoverBanner();
    });
  }

  const btnCloseCarryover = document.getElementById('btn-close-carryover');
  if (btnCloseCarryover) {
    btnCloseCarryover.addEventListener('click', () => {
      closeCarryoverModal();
    });
  }

  const btnModalCarryoverAll = document.getElementById('btn-carryover-modal-all-sec');
  if (btnModalCarryoverAll) {
    btnModalCarryoverAll.addEventListener('click', () => {
      carryoverAllPastTasksToCurrentSection();
      closeCarryoverModal();
    });
  }

  const btnModalCarryoverInbox = document.getElementById('btn-carryover-move-inbox');
  if (btnModalCarryoverInbox) {
    btnModalCarryoverInbox.addEventListener('click', () => {
      const pastTasks = getPastIncompleteTasks();
      pastTasks.forEach(t => {
        t.bucket = 'inbox';
        t.scheduledDate = null;
      });
      saveTasks();
      closeCarryoverModal();
      updateCarryoverBanner();
      renderApp();
      showCarryoverToast(`過去の未完了タスク ${pastTasks.length}件 を【Inbox】へ移動しました`);
    });
  }
}

// =========================================================================
// 11. Task Management, TaskChute Timer, Interruption Presets & D&D Handlers
// =========================================================================



// Sidebar Click Handling
function setupSidebarClicks() {
  // Buckets
  document.querySelectorAll('.bucket-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const bucketId = btn.dataset.bucket;
      state.currentBucketFilter = { type: 'bucket', id: bucketId };
      setMode('bucket');
    });
  });

  // Labels
  document.querySelectorAll('.label-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const labelId = btn.dataset.label;
      state.currentBucketFilter = { type: 'label', id: labelId };
      setMode('bucket');
    });
  });
}

function setupTaskFormHandlers() {
  // Add Task Button in Header
  const btnAddTask = document.getElementById('btn-add-task');
  if (btnAddTask) btnAddTask.addEventListener('click', () => openAddTaskModal());

  // Add Habit Button in Header
  const btnAddHabit = document.getElementById('btn-add-habit');
  if (btnAddHabit) btnAddHabit.addEventListener('click', () => openAddModal());

  // Close Add Task
  const btnCloseAdd = document.getElementById('btn-close-add-task');
  if (btnCloseAdd) btnCloseAdd.addEventListener('click', closeModal);
  const btnCancelAdd = document.getElementById('btn-cancel-add-task');
  if (btnCancelAdd) btnCancelAdd.addEventListener('click', closeModal);

  // Tag Input Real-Time Suggestion Updaters
  const addTagsInput = document.getElementById('add-task-tags');
  if (addTagsInput) addTagsInput.addEventListener('input', () => renderTagSuggestions('add-task-tag-suggestions', 'add-task-tags'));
  const editTagsInput = document.getElementById('edit-task-tags');
  if (editTagsInput) editTagsInput.addEventListener('input', () => renderTagSuggestions('edit-task-tag-suggestions', 'edit-task-tags'));
  const addHabitTagsInput = document.getElementById('add-habit-tags');
  if (addHabitTagsInput) addHabitTagsInput.addEventListener('input', () => renderTagSuggestions('add-habit-tag-suggestions', 'add-habit-tags'));
  const editHabitTagsInput = document.getElementById('edit-habit-tags');
  if (editHabitTagsInput) editHabitTagsInput.addEventListener('input', () => renderTagSuggestions('edit-habit-tag-suggestions', 'edit-habit-tags'));
  const presetTagsInput = document.getElementById('preset-tags');
  if (presetTagsInput) presetTagsInput.addEventListener('input', () => renderTagSuggestions('preset-tag-suggestions', 'preset-tags'));

  // Auto-calculate & fill moving average duration on Title input (Task Add)
  const addTaskTitleInput = document.getElementById('add-task-title');
  if (addTaskTitleInput) {
    addTaskTitleInput.addEventListener('blur', () => {
      const title = addTaskTitleInput.value.trim();
      if (!title) return;
      const matched = state.tasks.find(t => t.title.trim().toLowerCase() === title.toLowerCase() && ((Array.isArray(t.executionLogs) && t.executionLogs.length > 0) || (Array.isArray(t.history) && t.history.length > 0) || (t.status === 'completed' && t.actMin > 0)));
      if (matched) {
        const avg = calculateMovingAverageDuration(matched, 'task');
        const estEl = document.getElementById('add-task-est-min');
        if (estEl) estEl.value = avg;
      }
    });
  }

  // Auto-calculate & fill moving average duration on Name input (Habit Add)
  const addHabitNameInput = document.getElementById('add-habit-name');
  if (addHabitNameInput) {
    addHabitNameInput.addEventListener('blur', () => {
      const name = addHabitNameInput.value.trim();
      if (!name) return;
      const matched = state.habits.find(h => h.name.trim().toLowerCase() === name.toLowerCase() && ((Array.isArray(h.executionLogs) && h.executionLogs.length > 0) || (h.history && Object.keys(h.history).length > 0)));
      if (matched) {
        const avg = calculateMovingAverageDuration(matched, 'habit');
        const minEl = document.getElementById('add-habit-min');
        if (minEl) minEl.value = avg;
      }
    });
  }

  // Close Edit Task
  const btnCloseEdit = document.getElementById('btn-close-edit-task');
  if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeModal);
  const btnCancelEdit = document.getElementById('btn-cancel-edit-task');
  if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeModal);

  // Timing Type Selector in Add Form
  document.querySelectorAll('#add-task-timing-type-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#add-task-timing-type-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedAddTaskTimingType = btn.dataset.type;
      
      const panelSec = document.getElementById('add-task-panel-timing-section');
      const panelCustom = document.getElementById('add-task-panel-timing-custom');
      if (panelSec) panelSec.classList.toggle('hidden', state.selectedAddTaskTimingType !== 'section');
      if (panelCustom) panelCustom.classList.toggle('hidden', state.selectedAddTaskTimingType !== 'custom');
    });
  });

  // Timing Type Selector in Edit Form
  document.querySelectorAll('#edit-task-timing-type-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#edit-task-timing-type-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedEditTaskTimingType = btn.dataset.type;
      
      const panelSec = document.getElementById('edit-task-panel-timing-section');
      const panelCustom = document.getElementById('edit-task-panel-timing-custom');
      if (panelSec) panelSec.classList.toggle('hidden', state.selectedEditTaskTimingType !== 'section');
      if (panelCustom) panelCustom.classList.toggle('hidden', state.selectedEditTaskTimingType !== 'custom');
    });
  });

  // Bucket Selector in Add Form
  document.querySelectorAll('#add-task-bucket-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#add-task-bucket-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedAddTaskBucket = btn.dataset.bucket;
      const dateInput = document.getElementById('add-task-scheduled-date');
      if (dateInput) {
        if (state.selectedAddTaskBucket !== 'today') {
          dateInput.value = '';
        } else if (!dateInput.value) {
          dateInput.value = getSelectedDateKey();
        }
      }
    });
  });

  // Label Selector in Add Form
  document.querySelectorAll('#add-task-label-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#add-task-label-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedAddTaskLabel = btn.dataset.label;
    });
  });

  // Type Selector in Add Form
  document.querySelectorAll('#add-task-type-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#add-task-type-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedAddTaskType = btn.dataset.taskType;
      const panelRec = document.getElementById('add-task-panel-recurrence');
      if (panelRec) panelRec.classList.toggle('hidden', state.selectedAddTaskType !== 'recurring');
    });
  });

  // Edit Task Status Selector
  document.querySelectorAll('#edit-task-status-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#edit-task-status-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedEditTaskStatus = btn.dataset.status;
    });
  });

  // Edit Task Bucket Selector
  document.querySelectorAll('#edit-task-bucket-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#edit-task-bucket-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedEditTaskBucket = btn.dataset.bucket;
    });
  });

  // Edit Task Label Selector
  document.querySelectorAll('#edit-task-label-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#edit-task-label-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.selectedEditTaskLabel = btn.dataset.label;
    });
  });

  // Submit Add Task
  const formAdd = document.getElementById('form-add-task');
  if (formAdd) {
    formAdd.addEventListener('submit', (e) => {
      e.preventDefault();
      const maxIdNum = state.tasks.reduce((max, t) => {
        const num = parseInt(t.id.replace('T', ''), 10);
        return isNaN(num) ? max : Math.max(max, num);
      }, 0);
      const newId = 'T' + String(maxIdNum + 1).padStart(3, '0');
      const title = document.getElementById('add-task-title').value.trim();
      const estMin = parseInt(document.getElementById('add-task-est-min').value, 10) || 15;
      const section = document.getElementById('add-task-section')?.value || state.currentSection || '第2セッション';
      const customStart = document.getElementById('add-task-custom-start')?.value || null;
      const customEnd = document.getElementById('add-task-custom-end')?.value || null;
      const notes = document.getElementById('add-task-notes').value.trim();
      const tags = normalizeTags(document.getElementById('add-task-tags')?.value);
      const timingType = state.selectedAddTaskTimingType || 'section';
      const bucket = state.selectedAddTaskBucket || 'today';
      const scheduledDate = document.getElementById('add-task-scheduled-date')?.value || (bucket === 'today' ? getSelectedDateKey() : null);
      const actualTaskType = state.selectedAddTaskType || 'single';
      const recType = actualTaskType === 'recurring' ? (state.selectedAddTaskRecType || 'everyday') : null;

      // Load Matrix Values
      const matrixVals = getMatrixValues('add-task');

      const domainMajor = document.getElementById('add-task-domain-major')?.value || null;
      const domainMinor = document.getElementById('add-task-domain-minor')?.value || (domainMajor ? DOMAINS_DATA[domainMajor]?.name : null);
      const deptMajor = document.getElementById('add-task-dept-major')?.value || null;
      const deptMinor = document.getElementById('add-task-dept-minor')?.value || (deptMajor ? DEPTS_DATA[deptMajor]?.name : null);
      const projMajor = document.getElementById('add-task-proj-major')?.value || null;
      const projMinor = document.getElementById('add-task-proj-minor')?.value || (projMajor ? PROJECTS_DATA[projMajor]?.name : null);

      const newTask = {
        id: newId,
        title,
        scheduledDate: bucket === 'today' ? (scheduledDate || getSelectedDateKey()) : scheduledDate,
        bucket,
        label: state.selectedAddTaskLabel === 'none' ? null : (state.selectedAddTaskLabel || 'p1'),
        type: actualTaskType,
        taskType: actualTaskType,
        recType: recType,
        timingType,
        section: timingType === 'section' ? section : null,
        customStart: timingType === 'custom' ? customStart : null,
        customEnd: timingType === 'custom' ? customEnd : null,
        estMin,
        actStart: null,
        actEnd: null,
        actMin: 0,
        ...matrixVals,
        domainMajor,
        domainMinor,
        deptMajor,
        deptMinor,
        projMajor,
        projMinor,
        status: 'uncompleted',
        notes,
        tags,
        createdAt: new Date().toISOString()
      };

      // Remember sticky defaults for next fast continuous entry
      lastTaskDefaults = {
        bucket,
        label: state.selectedAddTaskLabel || 'p1',
        taskType: actualTaskType,
        timingType,
        section,
        customStart,
        customEnd,
        estMin,
        recType: recType || 'everyday',
        domainMajor,
        domainMinor,
        deptMajor,
        deptMinor,
        projMajor,
        projMinor,
        tags,
        matrix: { ...matrixVals }
      };

      state.tasks.push(newTask);
      pushUndoAction({
        description: `タスク「${newTask.title}」を追加`,
        undo: () => {
          state.tasks = state.tasks.filter(t => t.id !== newId);
        }
      });

      saveTasks();

      if (state.currentMode === 'section' && timingType === 'section' && section) {
        state.currentSection = section;
      }
      if (state.currentMode === 'table') {
        state.masterSubtab = actualTaskType === 'recurring' ? 'tasks' : 'single_tasks';
      }

      closeModal();
      renderApp();
    });
  }

  // Submit Edit Task
  const formEdit = document.getElementById('form-edit-task');
  if (formEdit) {
    formEdit.addEventListener('submit', (e) => {
      e.preventDefault();
      const taskId = document.getElementById('edit-task-id').value;
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;

      const prevSnapshot = { ...task };

      task.title = document.getElementById('edit-task-title').value.trim();
      task.estMin = parseInt(document.getElementById('edit-task-est-min').value, 10) || 25;
      task.notes = document.getElementById('edit-task-notes').value.trim();
      task.tags = normalizeTags(document.getElementById('edit-task-tags')?.value);
      task.status = state.selectedEditTaskStatus || task.status;
      task.bucket = state.selectedEditTaskBucket || task.bucket;
      task.label = state.selectedEditTaskLabel === 'none' ? null : state.selectedEditTaskLabel;

      const editDate = document.getElementById('edit-task-scheduled-date')?.value;
      task.scheduledDate = editDate || null;

      const timing = state.selectedEditTaskTimingType || 'section';
      task.timingType = timing;
      if (timing === 'section') {
        task.section = document.getElementById('edit-task-section')?.value || state.currentSection;
      } else if (timing === 'custom') {
        task.customStart = document.getElementById('edit-task-custom-start')?.value || null;
        task.customEnd = document.getElementById('edit-task-custom-end')?.value || null;
      } else {
        task.section = null;
      }

      // Matrix Values
      const matrixVals = getMatrixValues('edit-task');
      Object.assign(task, matrixVals);

      const domainMajor = document.getElementById('edit-task-domain-major')?.value || null;
      task.domainMajor = domainMajor;
      task.domainMinor = document.getElementById('edit-task-domain-minor')?.value || (domainMajor ? DOMAINS_DATA[domainMajor]?.name : null);

      const deptMajor = document.getElementById('edit-task-dept-major')?.value || null;
      task.deptMajor = deptMajor;
      task.deptMinor = document.getElementById('edit-task-dept-minor')?.value || (deptMajor ? DEPTS_DATA[deptMajor]?.name : null);

      const projMajor = document.getElementById('edit-task-proj-major')?.value || null;
      task.projMajor = projMajor;
      task.projMinor = document.getElementById('edit-task-proj-minor')?.value || (projMajor ? PROJECTS_DATA[projMajor]?.name : null);

      pushUndoAction({
        description: `タスク「${task.title}」の変更を保存`,
        undo: () => {
          Object.assign(task, prevSnapshot);
        }
      });

      saveTasks();
      closeModal();
      renderApp();
    });
  }

  // Delete Task
  const btnDelete = document.getElementById('btn-delete-task');
  if (btnDelete) {
    btnDelete.addEventListener('click', () => {
      const taskId = document.getElementById('edit-task-id').value;
      const task = state.tasks.find(t => t.id === taskId);
      if (task && confirm(`タスク「${task.title}」を完全に削除してもよろしいですか？`)) {
        const deletedTask = { ...task };
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        if (state.activeTaskId === taskId) state.activeTaskId = null;

        pushUndoAction({
          description: `タスク「${deletedTask.title}」を削除`,
          undo: () => {
            state.tasks.push(deletedTask);
          }
        });

        saveTasks();
        closeModal();
        renderApp();
      }
    });
  }

  // Quick Complete Modal Handlers
  const formQC = document.getElementById('form-quick-complete');
  if (formQC) {
    formQC.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = document.getElementById('quick-complete-type').value;
      const id = document.getElementById('quick-complete-id').value;
      const note = document.getElementById('quick-complete-note')?.value || '';
      const count = document.getElementById('quick-complete-count')?.value ? parseInt(document.getElementById('quick-complete-count').value, 10) : 1;
      const duration = document.getElementById('quick-complete-duration')?.value ? parseInt(document.getElementById('quick-complete-duration').value, 10) : null;

      closeModal();
      if (type === 'habit') {
        completeHabit(id, note, count, duration);
      } else {
        completeTask(id, note, duration);
      }
    });
  }

  const btnSkipQC = document.getElementById('btn-skip-quick-complete');
  if (btnSkipQC) {
    btnSkipQC.addEventListener('click', () => {
      const type = document.getElementById('quick-complete-type').value;
      const id = document.getElementById('quick-complete-id').value;
      const count = document.getElementById('quick-complete-count')?.value ? parseInt(document.getElementById('quick-complete-count').value, 10) : 1;
      const duration = document.getElementById('quick-complete-duration')?.value ? parseInt(document.getElementById('quick-complete-duration').value, 10) : null;

      closeModal();
      if (type === 'habit') {
        completeHabit(id, '', count, duration);
      } else {
        completeTask(id, '', duration);
      }
    });
  }

  const btnCloseQC = document.getElementById('btn-close-quick-complete');
  if (btnCloseQC) {
    btnCloseQC.addEventListener('click', closeModal);
  }

  // Master Table Subtabs
  const subtabHabits = document.getElementById('subtab-habits');
  const subtabTasks = document.getElementById('subtab-tasks');
  const subtabSingleTasks = document.getElementById('subtab-single-tasks');
  if (subtabHabits) {
    subtabHabits.addEventListener('click', () => {
      state.masterSubtab = 'habits';
      renderTableView();
    });
  }
  if (subtabTasks) {
    subtabTasks.addEventListener('click', () => {
      state.masterSubtab = 'tasks';
      renderTableView();
    });
  }
  if (subtabSingleTasks) {
    subtabSingleTasks.addEventListener('click', () => {
      state.masterSubtab = 'single_tasks';
      renderTableView();
    });
  }

  // Focus Navigation for Tasks
  const btnFocusTaskPrev = document.getElementById('btn-focus-task-prev');
  if (btnFocusTaskPrev) {
    btnFocusTaskPrev.addEventListener('click', () => {
      if (state.focusTaskIndex > 0) state.focusTaskIndex--;
      renderFocusView();
    });
  }
  const btnFocusTaskNext = document.getElementById('btn-focus-task-next');
  if (btnFocusTaskNext) {
    btnFocusTaskNext.addEventListener('click', () => {
      state.focusTaskIndex++;
      renderFocusView();
    });
  }
}

// Habit Add Form Handler with Matrix & Display Period
function setupAddFormHandlers() {
  const formAddHabit = document.getElementById('form-add-habit');
  if (!formAddHabit) return;

  // Timing Selector
  document.querySelectorAll('#timing-type-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#timing-type-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.type;
      state.selectedAddTimingType = type;

      const panelSec = document.getElementById('panel-timing-section');
      const panelCustom = document.getElementById('panel-timing-custom');
      if (panelSec) panelSec.classList.toggle('hidden', type !== 'section');
      if (panelCustom) panelCustom.classList.toggle('hidden', type !== 'custom');
    });
  });

  // Recurrence Selector
  const recPanels = {
    daily_times: document.getElementById('add-panel-rec-daily-times'),
    custom_days: document.getElementById('add-panel-rec-custom-days'),
    weekly_goal: document.getElementById('add-panel-rec-weekly-goal'),
    interval: document.getElementById('add-panel-rec-interval'),
    monthly: document.getElementById('add-panel-rec-monthly')
  };

  document.querySelectorAll('#add-recurrence-type-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#add-recurrence-type-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const recType = btn.dataset.type;
      state.selectedAddRecType = recType;

      if (recPanels.daily_times) recPanels.daily_times.classList.toggle('hidden', recType !== 'daily_times');
      if (recPanels.custom_days) recPanels.custom_days.classList.toggle('hidden', recType !== 'custom_days');
      if (recPanels.weekly_goal) recPanels.weekly_goal.classList.toggle('hidden', recType !== 'weekly_goal');
      if (recPanels.interval) recPanels.interval.classList.toggle('hidden', recType !== 'interval');
      if (recPanels.monthly) recPanels.monthly.classList.toggle('hidden', recType !== 'monthly');
    });
  });

  document.querySelectorAll('#add-weekday-pills .weekday-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
    });
  });

  const monthTimingSelect = document.getElementById('add-rec-month-timing-type');
  const monthDayInput = document.getElementById('add-panel-month-day-input');
  if (monthTimingSelect && monthDayInput) {
    monthTimingSelect.addEventListener('change', () => {
      monthDayInput.classList.toggle('hidden', monthTimingSelect.value !== 'specific_day');
    });
  }

  // Submit Habit Add
  formAddHabit.addEventListener('submit', (e) => {
    e.preventDefault();
    const maxIdNum = state.habits.reduce((max, h) => {
      const num = parseInt(h.id.replace('H', ''), 10);
      return isNaN(num) ? max : Math.max(max, num);
    }, 0);
    const newId = 'H' + String(maxIdNum + 1).padStart(3, '0');
    const name = document.getElementById('add-habit-name').value.trim();
    const timingType = state.selectedAddTimingType || 'section';
    let sectionVal = null;
    let customStartVal = null;
    let customEndVal = null;

    if (timingType === 'section') {
      sectionVal = document.getElementById('add-habit-section').value;
    } else if (timingType === 'custom') {
      customStartVal = document.getElementById('add-custom-start').value;
      customEndVal = document.getElementById('add-custom-end').value;
      const [sH] = (customStartVal || '12:00').split(':').map(Number);
      for (const s of SECTIONS_CONFIG) {
        if (sH >= s.start && sH < s.end) { sectionVal = s.name; break; }
      }
    }

    // Recurrence Object
    let recObj = { type: state.selectedAddRecType || 'everyday' };
    if (recObj.type === 'daily_times') {
      recObj.timesPerDay = parseInt(document.getElementById('add-rec-daily-times')?.value, 10) || 2;
    } else if (recObj.type === 'custom_days') {
      const days = [];
      document.querySelectorAll('#add-weekday-pills .weekday-pill.active').forEach(p => {
        days.push(Number(p.dataset.day));
      });
      recObj.days = days.length > 0 ? days : [1, 2, 3, 4, 5];
    } else if (recObj.type === 'weekly_goal') {
      recObj.timesPerWeek = parseInt(document.getElementById('add-rec-weekly-times')?.value, 10) || 3;
    } else if (recObj.type === 'interval') {
      recObj.intervalDays = parseInt(document.getElementById('add-rec-interval-days')?.value, 10) || 2;
    } else if (recObj.type === 'monthly') {
      recObj.monthInterval = parseInt(document.getElementById('add-rec-month-interval')?.value, 10) || 1;
      recObj.timingType = document.getElementById('add-rec-month-timing-type')?.value || 'specific_day';
      recObj.monthDay = parseInt(document.getElementById('add-rec-month-day')?.value, 10) || 1;
    }

    const domainMajor = document.getElementById('add-domain-major')?.value || null;
    const domainMinor = document.getElementById('add-domain-minor')?.value || (domainMajor ? DOMAINS_DATA[domainMajor]?.name : null);
    const deptMajor = document.getElementById('add-dept-major')?.value || null;
    const deptMinor = document.getElementById('add-dept-minor')?.value || (deptMajor ? DEPTS_DATA[deptMajor]?.name : null);
    const projMajor = document.getElementById('add-proj-major')?.value || null;
    const projMinor = document.getElementById('add-proj-minor')?.value || (projMajor ? PROJECTS_DATA[projMajor]?.name : null);

    const displayStartDate = document.getElementById('add-habit-display-start')?.value || null;
    const displayEndDate = document.getElementById('add-habit-display-end')?.value || null;
    const matrixVals = getMatrixValues('add-habit');
    const tags = normalizeTags(document.getElementById('add-habit-tags')?.value);
    const notes = document.getElementById('add-habit-notes')?.value.trim() || '';

    const newHabit = {
      id: newId,
      name,
      displayType: timingType,
      section: sectionVal,
      customStart: customStartVal,
      customEnd: customEndVal,
      displayStartDate,
      displayEndDate,
      tags,
      notes,
      ...matrixVals,
      domain: domainMinor,
      domainMajor,
      dept: deptMinor,
      deptMajor,
      proj: projMinor,
      projMajor,
      repeatType: recObj.type,
      targetMin: parseInt(document.getElementById('add-habit-min')?.value, 10) || 5,
      recurrence: recObj,
      status: 'uncompleted',
      createdAt: new Date().toISOString(),
      stats: { d3: 0, d7: 0, d30: 0, d90: 0, sevenDay: 0, thirtyDay: 0, ninetyDay: 0, tier: '🌱 Developing' }
    };

    // Remember sticky defaults for next fast continuous habit entry
    lastHabitDefaults = {
      displayType: timingType,
      section: sectionVal,
      customStart: customStartVal,
      customEnd: customEndVal,
      recType: recObj.type,
      dailyTimes: recObj.timesPerDay || 2,
      weeklyTimes: recObj.timesPerWeek || 3,
      intervalDays: recObj.intervalDays || 2,
      monthInterval: recObj.monthInterval || 1,
      monthTiming: recObj.timingType || 'specific_day',
      monthDay: recObj.monthDay || 1,
      weekdays: recObj.days || [1, 2, 3, 4, 5],
      targetMin: parseInt(document.getElementById('add-habit-min')?.value, 10) || 5,
      domainMajor,
      domainMinor,
      deptMajor,
      deptMinor,
      projMajor,
      projMinor,
      matrix: { ...matrixVals }
    };

    state.habits.push(newHabit);
    pushUndoAction({
      description: `ハビット「${newHabit.name}」を追加`,
      undo: () => {
        state.habits = state.habits.filter(h => h.id !== newId);
      }
    });

    saveHabits();
    closeModal();
    renderApp();
  });
}

// Habit Edit Form Handler
function setupEditFormHandlers() {
  const formEditHabit = document.getElementById('form-edit-habit');
  if (!formEditHabit) return;

  // Recurrence Selector in Edit Form
  const editRecPanels = {
    daily_times: document.getElementById('edit-panel-rec-daily-times'),
    custom_days: document.getElementById('edit-panel-rec-custom-days'),
    weekly_goal: document.getElementById('edit-panel-rec-weekly-goal'),
    interval: document.getElementById('edit-panel-rec-interval'),
    monthly: document.getElementById('edit-panel-rec-monthly')
  };

  document.querySelectorAll('#edit-recurrence-type-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#edit-recurrence-type-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const recType = btn.dataset.type;
      state.selectedEditRecType = recType;

      if (editRecPanels.daily_times) editRecPanels.daily_times.classList.toggle('hidden', recType !== 'daily_times');
      if (editRecPanels.custom_days) editRecPanels.custom_days.classList.toggle('hidden', recType !== 'custom_days');
      if (editRecPanels.weekly_goal) editRecPanels.weekly_goal.classList.toggle('hidden', recType !== 'weekly_goal');
      if (editRecPanels.interval) editRecPanels.interval.classList.toggle('hidden', recType !== 'interval');
      if (editRecPanels.monthly) editRecPanels.monthly.classList.toggle('hidden', recType !== 'monthly');
    });
  });

  document.querySelectorAll('#edit-weekday-pills .weekday-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
    });
  });

  const editMonthTimingSelect = document.getElementById('edit-rec-month-timing-type');
  const editMonthDayInput = document.getElementById('edit-panel-month-day-input');
  if (editMonthTimingSelect && editMonthDayInput) {
    editMonthTimingSelect.addEventListener('change', () => {
      editMonthDayInput.classList.toggle('hidden', editMonthTimingSelect.value !== 'specific_day');
    });
  }

  formEditHabit.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-habit-id').value;
    const habit = state.habits.find(h => h.id === id);
    if (!habit) return;

    const prevSnapshot = { ...habit };
    const timingType = state.selectedEditTimingType;
    let sectionVal = null;
    let customStartVal = null;
    let customEndVal = null;

    if (timingType === 'section') {
      sectionVal = document.getElementById('edit-habit-section').value;
    } else if (timingType === 'custom') {
      customStartVal = document.getElementById('edit-custom-start').value;
      customEndVal = document.getElementById('edit-custom-end').value;
      const [sH] = (customStartVal || '12:00').split(':').map(Number);
      for (const s of SECTIONS_CONFIG) {
        if (sH >= s.start && sH < s.end) { sectionVal = s.name; break; }
      }
    }

    // Recurrence
    let recObj = { type: state.selectedEditRecType || 'everyday' };
    if (recObj.type === 'daily_times') {
      recObj.timesPerDay = parseInt(document.getElementById('edit-rec-daily-times')?.value, 10) || 2;
    } else if (recObj.type === 'custom_days') {
      const days = [];
      document.querySelectorAll('#edit-weekday-pills .weekday-pill.active').forEach(p => {
        days.push(Number(p.dataset.day));
      });
      recObj.days = days.length > 0 ? days : [1, 2, 3, 4, 5];
    } else if (recObj.type === 'weekly_goal') {
      recObj.timesPerWeek = parseInt(document.getElementById('edit-rec-weekly-times')?.value, 10) || 3;
    } else if (recObj.type === 'interval') {
      recObj.intervalDays = parseInt(document.getElementById('edit-rec-interval-days')?.value, 10) || 2;
    } else if (recObj.type === 'monthly') {
      recObj.monthInterval = parseInt(document.getElementById('edit-rec-month-interval')?.value, 10) || 1;
      recObj.timingType = document.getElementById('edit-rec-month-timing-type')?.value || 'specific_day';
      recObj.monthDay = parseInt(document.getElementById('edit-rec-month-day')?.value, 10) || 1;
    }

    const domainMajor = document.getElementById('edit-domain-major')?.value || null;
    const domainMinor = document.getElementById('edit-domain-minor')?.value || (domainMajor ? DOMAINS_DATA[domainMajor]?.name : null);
    const deptMajor = document.getElementById('edit-dept-major')?.value || null;
    const deptMinor = document.getElementById('edit-dept-minor')?.value || (deptMajor ? DEPTS_DATA[deptMajor]?.name : null);
    const projMajor = document.getElementById('edit-proj-major')?.value || null;
    const projMinor = document.getElementById('edit-proj-minor')?.value || (projMajor ? PROJECTS_DATA[projMajor]?.name : null);

    const displayStartDate = document.getElementById('edit-habit-display-start')?.value || null;
    const displayEndDate = document.getElementById('edit-habit-display-end')?.value || null;
    const matrixVals = getMatrixValues('edit-habit');

    habit.name = document.getElementById('edit-habit-name').value.trim();
    habit.displayType = timingType;
    habit.section = sectionVal;
    habit.customStart = customStartVal;
    habit.customEnd = customEndVal;
    habit.displayStartDate = displayStartDate;
    habit.displayEndDate = displayEndDate;
    habit.tags = normalizeTags(document.getElementById('edit-habit-tags')?.value);
    habit.notes = document.getElementById('edit-habit-notes')?.value.trim() || '';
    Object.assign(habit, matrixVals);
    habit.domain = domainMinor;
    habit.domainMajor = domainMajor;
    habit.dept = deptMinor;
    habit.deptMajor = deptMajor;
    habit.proj = projMinor;
    habit.projMajor = projMajor;
    habit.targetMin = parseInt(document.getElementById('edit-habit-min')?.value, 10) || 10;
    habit.recurrence = recObj;

    pushUndoAction({
      description: `ハビット「${habit.name}」の変更を保存`,
      undo: () => {
        Object.assign(habit, prevSnapshot);
      }
    });

    saveHabits();
    closeModal();
    renderApp();
  });
}

// Setup UNDO Events & Global Shortcuts


// Setup View Type Filter Click Handlers
function setupViewTypeFilterHandlers() {
  document.querySelectorAll('#filter-view-type .view-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setViewType(btn.dataset.type);
    });
  });
}

// Multi-Tab & Multi-Window Real-Time Instant Sync Engine
window.addEventListener('storage', (e) => {
  if (['habit_flow_tasks_v3', 'habit_flow_data_v3', 'habit_flow_goals_v1', 'habit_flow_manifesto_v1', 'habit_flow_task_presets_v1'].includes(e.key)) {
    state.habits = loadHabits();
    state.tasks = loadTasks();
    state.goals = loadGoals();
    state.manifesto = loadManifesto();
    state.taskPresets = loadTaskPresets();
    renderApp();
  }
});

// Clean up any ghost completions created on today by the previous bug
const cleanFixKey = 'habit_flow_ghost_fix_20260819_v1';
if (!localStorage.getItem(cleanFixKey)) {
  const todayKey = getTodayKey();
  let modified = false;
  if (Array.isArray(state.habits)) {
    state.habits.forEach(h => {
      if (h.history && h.history[todayKey]) {
        delete h.history[todayKey];
        modified = true;
      }
      h.status = 'uncompleted';
      h.startTimestamp = null;
      recalculateHabitRates(h);
    });
  }
  if (modified) {
    saveHabits();
  }
  localStorage.setItem(cleanFixKey, 'true');
}

// Init Application safely
function safeInit(fnName, fn) {
  try {
    if (typeof fn === 'function') {
      fn();
    }
  } catch (e) {
    console.error(`Error during ${fnName}:`, e);
  }
}

try {
  state.currentSection = detectCurrentSection();
  document.body.dataset.mode = state.currentMode;
} catch (e) {
  console.error('Error initializing state/mode:', e);
}

safeInit('setupAddFormHandlers', setupAddFormHandlers);
safeInit('setupEditFormHandlers', setupEditFormHandlers);
safeInit('setupTaskFormHandlers', setupTaskFormHandlers);
safeInit('setupGoalsFormHandlers', setupGoalsFormHandlers);
safeInit('setupManifestoHandlers', setupManifestoHandlers);
safeInit('setupContextMenuHandlers', setupContextMenuHandlers);
safeInit('setupDateNavHandlers', setupDateNavHandlers);
safeInit('setupDragAndDrop', setupDragAndDrop);
safeInit('setupSidebarClicks', setupSidebarClicks);
safeInit('setupViewTypeFilterHandlers', setupViewTypeFilterHandlers);
safeInit('setupCascadeSelects', setupCascadeSelects);
safeInit('setupLoadMatrixEvents', setupLoadMatrixEvents);
safeInit('setupTaskPresetsHandlers', setupTaskPresetsHandlers);
safeInit('setupUndoEvents', setupUndoEvents);
safeInit('setupKeyboardShortcuts', setupKeyboardShortcuts);

try {
  setInterval(updateHeaderAndStatus, 60000);
  setInterval(updateLiveFocusProgress, 1000);
} catch (e) {
  console.error('Error setting intervals:', e);
}

safeInit('renderApp', renderApp);





