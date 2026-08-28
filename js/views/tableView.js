/**
 * Gendrive - Master Data Editor & Multi-Key Sorting Engine
 * 哲生 (AI Company OS & Personal OS Engine)
 * High-Performance Grid Editor with Bulk Operations & Drag & Drop Reordering
 */

// Selected Item IDs for Table Bulk Operations (Safe Lazy Init)
function getSelectedTableItemIds() {
  if (typeof state === 'undefined' || !state) return new Set();
  if (!state.selectedTableItemIds) state.selectedTableItemIds = new Set();
  return state.selectedTableItemIds;
}

// =========================================================================
// 1. Multi-Column & Multi-Key Sorting Engine
// =========================================================================

function sortHabits(habits, sortKey, sortOrder = 'asc') {
  const list = [...habits];
  const mult = sortOrder === 'asc' ? 1 : -1;

  const getTimeVal = (h) => {
    if (h.displayType === 'anytime') return 99;
    if (h.displayType === 'custom' && h.customStart) {
      const [hh, mm] = h.customStart.split(':').map(Number);
      return hh + mm / 60;
    }
    const s = SECTIONS_CONFIG.find(sec => sec.name === h.section);
    return s ? s.start : 50;
  };

  const getCreatedTime = (h) => {
    if (!h.createdAt) return 0;
    return new Date(h.createdAt).getTime() || 0;
  };

  list.sort((a, b) => {
    if (sortKey === 'created_desc') {
      return (getCreatedTime(b) - getCreatedTime(a)) * mult;
    }
    if (sortKey === 'created_asc' || sortKey === 'created') {
      return (getCreatedTime(a) - getCreatedTime(b)) * mult;
    }

    if (sortKey === 'default') {
      // 順序未指定時は sortOrder（ドラッグ順序）を維持
      const orderA = typeof a.sortOrder === 'number' ? a.sortOrder : 9999;
      const orderB = typeof b.sortOrder === 'number' ? b.sortOrder : 9999;
      return (orderA - orderB) * mult;
    }

    if (sortKey === 'domain') {
      const domA = (a.domainMajor || '') + (a.domain || '');
      const domB = (b.domainMajor || '') + (b.domain || '');
      const domCmp = domA.localeCompare(domB, 'ja');
      if (domCmp !== 0) return domCmp * mult;
      return (getTimeVal(a) - getTimeVal(b)) * mult;
    }

    if (sortKey === 'proj') {
      const projA = (a.projMajor || '') + (a.proj || '');
      const projB = (b.projMajor || '') + (b.proj || '');
      const projCmp = projA.localeCompare(projB, 'ja');
      if (projCmp !== 0) return projCmp * mult;
      return (getTimeVal(a) - getTimeVal(b)) * mult;
    }

    if (sortKey === 'dept') {
      const deptA = (a.deptMajor || '') + (a.dept || '');
      const deptB = (b.deptMajor || '') + (b.dept || '');
      const deptCmp = deptA.localeCompare(deptB, 'ja');
      if (deptCmp !== 0) return deptCmp * mult;
      return (getTimeVal(a) - getTimeVal(b)) * mult;
    }

    if (sortKey === 'time') {
      return (getTimeVal(a) - getTimeVal(b)) * mult;
    }

    if (sortKey === 'name') {
      const nameA = String(a.name || '');
      const nameB = String(b.name || '');
      return nameA.localeCompare(nameB, 'ja') * mult;
    }

    if (sortKey === 'rate7') {
      return (getHabitRate(a, 7) - getHabitRate(b, 7)) * mult;
    }

    if (sortKey === 'rate30') {
      return (getHabitRate(a, 30) - getHabitRate(b, 30)) * mult;
    }

    return (getCreatedTime(a) - getCreatedTime(b)) * mult;
  });

  return list;
}

function getSingleTaskDateBadge(task) {
  const isCompleted = task.status === 'completed';
  const todayKey = typeof getTodayKey === 'function' ? getTodayKey() : new Date().toISOString().split('T')[0];
  let dateKey = task.scheduledDate;

  if (isCompleted) {
    if (Array.isArray(task.executionLogs) && task.executionLogs[0]?.dateKey) {
      dateKey = task.executionLogs[0].dateKey;
    } else if (Array.isArray(task.history) && task.history[task.history.length - 1]?.date) {
      dateKey = task.history[task.history.length - 1].date;
    } else if (task.completedAt) {
      dateKey = task.completedAt.split('T')[0];
    } else if (!dateKey && task.createdAt) {
      dateKey = task.createdAt.split('T')[0];
    }
  }

  if (!dateKey) {
    return `<span class="col-date-badge nodate">📅 日付未定</span>`;
  }

  const parts = dateKey.split('-');
  const shortDate = parts.length === 3 ? `${parts[1]}/${parts[2]}` : dateKey;

  if (isCompleted) {
    return `<span class="col-date-badge completed-date" title="完了日: ${dateKey}">✓ ${shortDate}</span>`;
  } else if (dateKey === todayKey) {
    return `<span class="col-date-badge today-date" title="本日予定: ${dateKey}">⚡ 今日</span>`;
  } else if (dateKey > todayKey) {
    return `<span class="col-date-badge future-date" title="実行予定日: ${dateKey}">📅 ${shortDate}</span>`;
  } else {
    return `<span class="col-date-badge today-date" title="予定日: ${dateKey}">⏳ ${shortDate}</span>`;
  }
}

function sortSingleTasks(tasks) {
  const getTaskDateInfo = (t) => {
    const isCompleted = t.status === 'completed';
    let dateKey = t.scheduledDate;

    if (isCompleted) {
      if (Array.isArray(t.executionLogs) && t.executionLogs[0]?.dateKey) {
        dateKey = t.executionLogs[0].dateKey;
      } else if (Array.isArray(t.history) && t.history[t.history.length - 1]?.date) {
        dateKey = t.history[t.history.length - 1].date;
      } else if (t.completedAt) {
        dateKey = t.completedAt.split('T')[0];
      } else if (!dateKey && t.createdAt) {
        dateKey = t.createdAt.split('T')[0];
      }
    }

    dateKey = dateKey || (isCompleted ? '1970-01-01' : '9999-12-31');
    return { dateKey, isCompleted };
  };

  return [...tasks].sort((a, b) => {
    const infoA = getTaskDateInfo(a);
    const infoB = getTaskDateInfo(b);

    const cmp = infoB.dateKey.localeCompare(infoA.dateKey);
    if (cmp !== 0) return cmp;

    if (infoA.isCompleted !== infoB.isCompleted) {
      return infoA.isCompleted ? 1 : -1;
    }

    return (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0));
  });
}

// =========================================================================
// 2. Selection & Bulk Action Bar Engine
// =========================================================================

function toggleShowDisabledItems(checked) {
  state.showDisabledInTable = checked;
  renderTableView();
}

function toggleTableSelectAll(checked) {
  const curSubtab = state.masterSubtab || 'habits';
  let targetList = [];

  if (curSubtab === 'habits') {
    targetList = state.habits.filter(h => state.showDisabledInTable || !h.isDisabled);
  } else if (curSubtab === 'tasks' || curSubtab === 'recurring_tasks') {
    targetList = state.tasks.filter(t => (t.taskType === 'recurring' || t.recType) && (state.showDisabledInTable || !t.isDisabled));
  } else {
    targetList = state.tasks.filter(t => t.taskType !== 'recurring' && !t.recType && (state.showDisabledInTable || !t.isDisabled));
  }

  if (checked) {
    targetList.forEach(item => state.selectedTableItemIds.add(String(item.id)));
  } else {
    targetList.forEach(item => state.selectedTableItemIds.delete(String(item.id)));
  }

  updateBulkActionBar();
  renderTableView();
}

function toggleTableSelectItem(id, checked, event) {
  if (event) event.stopPropagation();
  const strId = String(id);
  if (checked) {
    state.selectedTableItemIds.add(strId);
  } else {
    state.selectedTableItemIds.delete(strId);
  }
  updateBulkActionBar();
  renderTableView();
}

function clearTableSelection() {
  state.selectedTableItemIds.clear();
  updateBulkActionBar();
  renderTableView();
}

function updateBulkActionBar() {
  const bar = document.getElementById('master-bulk-bar');
  const countEl = document.getElementById('bulk-selected-count');
  const count = state.selectedTableItemIds.size;

  if (countEl) countEl.textContent = count;
  if (bar) {
    bar.classList.toggle('hidden', count === 0);
  }
}

// =========================================================================
// 3. Render Table Views (Habits, Recurring Tasks, Single Tasks) - Full Inline Direct Editor
// =========================================================================

function handleMasterAddNewItem() {
  const curSubtab = state.masterSubtab || 'habits';
  if (curSubtab === 'habits') {
    openAddModal();
  } else if (curSubtab === 'tasks' || curSubtab === 'recurring_tasks') {
    openAddTaskModal('section', true);
  } else {
    openAddTaskModal();
  }
}

function toggleItemDisabledInline(id, type, event) {
  if (event) event.stopPropagation();
  const strId = String(id);

  if (type === 'habit') {
    const habit = state.habits.find(h => String(h.id) === strId);
    if (habit) {
      habit.isDisabled = !habit.isDisabled;
      saveHabits();
    }
  } else {
    const task = state.tasks.find(t => String(t.id) === strId);
    if (task) {
      task.isDisabled = !task.isDisabled;
      saveTasks();
    }
  }
  renderApp();
}

function duplicateSingleItem(id, type, event) {
  if (event) event.stopPropagation();
  const strId = String(id);

  if (type === 'habit') {
    const original = state.habits.find(h => String(h.id) === strId);
    if (original) {
      const copy = JSON.parse(JSON.stringify(original));
      copy.id = `H_${Date.now()}_copy`;
      copy.name = `${copy.name} (コピー)`;
      copy.createdAt = new Date().toISOString();
      copy.history = {};
      copy.executionLogs = [];
      state.habits.unshift(copy);
      saveHabits();
    }
  } else {
    const original = state.tasks.find(t => String(t.id) === strId);
    if (original) {
      const copy = JSON.parse(JSON.stringify(original));
      copy.id = `T_${Date.now()}_copy`;
      copy.title = `${copy.title} (コピー)`;
      copy.createdAt = new Date().toISOString();
      copy.history = [];
      copy.executionLogs = [];
      state.tasks.unshift(copy);
      saveTasks();
    }
  }
  renderApp();
}

function deleteSingleItem(id, type, event) {
  if (event) event.stopPropagation();
  const strId = String(id);

  if (type === 'habit') {
    const h = state.habits.find(item => String(item.id) === strId);
    if (!h) return;
    if (confirm(`🌿 ハビット「${h.name}」を削除しますか？`)) {
      state.habits = state.habits.filter(item => String(item.id) !== strId);
      state.selectedTableItemIds.delete(strId);
      saveHabits();
      renderApp();
    }
  } else {
    const t = state.tasks.find(item => String(item.id) === strId);
    if (!t) return;
    if (confirm(`🎯 タスク「${t.title}」を削除しますか？`)) {
      state.tasks = state.tasks.filter(item => String(item.id) !== strId);
      state.selectedTableItemIds.delete(strId);
      saveTasks();
      renderApp();
    }
  }
}

function isRecurringTaskItem(t) {
  if (!t) return false;
  return t.taskType === 'recurring' || t.type === 'recurring' || Boolean(t.recType) || (Boolean(t.recurrence) && t.recurrence.type && t.recurrence.type !== 'none');
}

function switchMasterSubtab(subtab) {
  state.masterSubtab = subtab;
  clearTableSelection();
  renderTableView();
  setTimeout(() => {
    initMasterScrollScale();
  }, 50);
}

// -------------------------------------------------------------------------
// Inline Editing Helper Generators (Dropdowns, Cascades, Matrix Chips)
// -------------------------------------------------------------------------

function buildInlineDomainHtml(item, type) {
  const currentMajor = item.domainMajor || 'PN1';
  const currentMinor = item.domainMinor || item.domain || '';

  const majorOptions = Object.keys(DOMAINS_DATA).map(k => `
    <option value="${k}" ${currentMajor === k ? 'selected' : ''}>${DOMAINS_DATA[k].name}</option>
  `).join('');

  const minorList = (DOMAINS_DATA[currentMajor] && DOMAINS_DATA[currentMajor].items) || [];
  const minorOptions = minorList.map(m => `
    <option value="${m}" ${currentMinor === m ? 'selected' : ''}>${m}</option>
  `).join('');

  return `
    <div class="col-grid-domain">
      <select class="table-inline-select" onchange="handleInlineCascadeChange('${item.id}', '${type}', 'domain', 'major', this.value)" title="ドメイン大分類">
        ${majorOptions}
      </select>
      <select class="table-inline-select" onchange="handleInlineCascadeChange('${item.id}', '${type}', 'domain', 'minor', this.value)" title="ドメイン詳細">
        <option value="">(詳細未選択)</option>
        ${minorOptions}
      </select>
    </div>
  `;
}

function buildInlineDeptHtml(item, type) {
  const currentMajor = item.deptMajor || 'CEO直轄';
  const currentMinor = item.deptMinor || item.dept || '';

  const majorOptions = Object.keys(DEPTS_DATA).map(k => `
    <option value="${k}" ${currentMajor === k ? 'selected' : ''}>${DEPTS_DATA[k].name}</option>
  `).join('');

  const minorList = (DEPTS_DATA[currentMajor] && DEPTS_DATA[currentMajor].items) || [];
  const minorOptions = minorList.map(m => `
    <option value="${m}" ${currentMinor === m ? 'selected' : ''}>${m}</option>
  `).join('');

  return `
    <div class="col-grid-dept">
      <select class="table-inline-select" onchange="handleInlineCascadeChange('${item.id}', '${type}', 'dept', 'major', this.value)" title="部門大分類">
        ${majorOptions}
      </select>
      <select class="table-inline-select" onchange="handleInlineCascadeChange('${item.id}', '${type}', 'dept', 'minor', this.value)" title="部門詳細">
        <option value="">(詳細未選択)</option>
        ${minorOptions}
      </select>
    </div>
  `;
}

function buildInlineProjHtml(item, type) {
  const currentMajor = item.projMajor || 'ビジネス';
  const currentMinor = item.projMinor || item.proj || '';

  const majorOptions = Object.keys(PROJECTS_DATA).map(k => `
    <option value="${k}" ${currentMajor === k ? 'selected' : ''}>${PROJECTS_DATA[k].name}</option>
  `).join('');

  const minorList = (PROJECTS_DATA[currentMajor] && PROJECTS_DATA[currentMajor].items) || [];
  const minorOptions = minorList.map(m => `
    <option value="${m}" ${currentMinor === m ? 'selected' : ''}>${m}</option>
  `).join('');

  return `
    <div class="col-grid-proj">
      <select class="table-inline-select" onchange="handleInlineCascadeChange('${item.id}', '${type}', 'proj', 'major', this.value)" title="プロジェクト大分類">
        ${majorOptions}
      </select>
      <select class="table-inline-select" onchange="handleInlineCascadeChange('${item.id}', '${type}', 'proj', 'minor', this.value)" title="プロジェクト詳細">
        <option value="">(詳細未選択)</option>
        ${minorOptions}
      </select>
    </div>
  `;
}

function buildInlineTimingHtml(item, type) {
  const curSection = item.section || '第2セッション';
  const curType = item.displayType || item.timingType || 'section';
  const start = item.customStart || '13:00';
  const end = item.customEnd || '17:00';

  const sectionOptions = SECTIONS_CONFIG.map(s => `
    <option value="${s.name}" ${curSection === s.name && curType === 'section' ? 'selected' : ''}>⏱️ ${s.name}</option>
  `).join('');

  return `
    <div class="col-grid-timing" style="display: flex; flex-direction: column; gap: 2px;">
      <select class="table-inline-select" onchange="handleInlineTimingChange('${item.id}', '${type}', this.value)" title="実行タイミング">
        <option value="anytime" ${curType === 'anytime' ? 'selected' : ''}>🌐 いつでも (終日)</option>
        ${sectionOptions}
        <option value="custom" ${curType === 'custom' ? 'selected' : ''}>⏰ 時間指定 (${start}~${end})</option>
      </select>
    </div>
  `;
}

function buildInlineRecurrenceHtml(item, type) {
  const recType = item.recType || (item.recurrence && item.recurrence.type) || 'everyday';
  return `
    <div class="col-grid-rec">
      <select class="table-inline-select" onchange="handleInlineFieldChange('${item.id}', '${type}', 'recType', this.value, event)" title="定期配信ルール">
        <option value="everyday" ${recType === 'everyday' ? 'selected' : ''}>🌐 毎日</option>
        <option value="business_days" ${recType === 'business_days' ? 'selected' : ''}>💼 平日 (月〜金)</option>
        <option value="weekends" ${recType === 'weekends' ? 'selected' : ''}>🌴 週末 (土日)</option>
        <option value="custom_days" ${recType === 'custom_days' ? 'selected' : ''}>🗓️ 曜日指定</option>
        <option value="weekly_goal" ${recType === 'weekly_goal' ? 'selected' : ''}>🎯 週N回</option>
        <option value="interval" ${recType === 'interval' ? 'selected' : ''}>⏳ 間隔配信</option>
        <option value="monthly" ${recType === 'monthly' ? 'selected' : ''}>📅 月次配信</option>
        <option value="daily_times" ${recType === 'daily_times' ? 'selected' : ''}>⚡ 1日〜回</option>
      </select>
    </div>
  `;
}

function buildInlineEisenhowerHtml(task) {
  const curLabel = task.label || 'none';
  return `
    <div class="col-grid-eisenhower">
      <select class="table-inline-select" onchange="handleInlineFieldChange('${task.id}', 'task', 'label', this.value, event)" title="アイゼンハワー分類">
        <option value="iron_rule" ${curLabel === 'iron_rule' ? 'selected' : ''}>🔥 ALL-IN</option>
        <option value="frog0" ${curLabel === 'frog0' ? 'selected' : ''}>🐸 第0 (カエル)</option>
        <option value="p1" ${curLabel === 'p1' ? 'selected' : ''}>💼 第1 (緊急重要)</option>
        <option value="p2" ${curLabel === 'p2' ? 'selected' : ''}>🌱 第2 (非緊重要)</option>
        <option value="p3" ${curLabel === 'p3' ? 'selected' : ''}>🧺 第3 (緊急非重)</option>
        <option value="p4" ${curLabel === 'p4' ? 'selected' : ''}>🎮 第4 (非緊非重)</option>
        <option value="none" ${curLabel === 'none' ? 'selected' : ''}>⚪ なし</option>
      </select>
    </div>
  `;
}

function buildInlineBucketHtml(task) {
  const curBucket = task.bucket || 'today';
  return `
    <div class="col-grid-bucket">
      <select class="table-inline-select" onchange="handleInlineFieldChange('${task.id}', 'task', 'bucket', this.value, event)" title="GTD投入バケット">
        <option value="today" ${curBucket === 'today' ? 'selected' : ''}>⚡ Today</option>
        <option value="inbox" ${curBucket === 'inbox' ? 'selected' : ''}>📥 Inbox</option>
        <option value="this_week" ${curBucket === 'this_week' ? 'selected' : ''}>📅 今週</option>
        <option value="next_week" ${curBucket === 'next_week' ? 'selected' : ''}>🗓️ 来週</option>
        <option value="genius" ${curBucket === 'genius' ? 'selected' : ''}>💡 Genius</option>
        <option value="someday" ${curBucket === 'someday' ? 'selected' : ''}>⏳ Someday</option>
        <option value="vault" ${curBucket === 'vault' ? 'selected' : ''}>🗄️ Vault</option>
      </select>
    </div>
  `;
}

function buildInlineMatrixChipsHtml(item, type) {
  const m = item.matrix || { ...DEFAULT_MATRIX };
  const axes = [
    { key: 'importance', label: '重', icon: '🎯', title: '重要度' },
    { key: 'urgency', label: '緊', icon: '⏰', title: '緊急度' },
    { key: 'mentalLoad', label: '認', icon: '🧠', title: '認知負荷' },
    { key: 'physicalLoad', label: '体', icon: '🏃', title: '体力負荷' },
    { key: 'frogLevel', label: '蛙', icon: '🐸', title: 'カエル度' },
    { key: 'interestLevel', label: '興', icon: '💡', title: '興味・関心' }
  ];

  return `
    <div class="col-grid-matrix">
      <div class="matrix-chips-group">
        ${axes.map(ax => {
          const val = m[ax.key] || 'mid';
          return `
            <div class="matrix-mini-chip val-${val}"
                 onclick="handleInlineMatrixCycle('${item.id}', '${type}', '${ax.key}', event)"
                 title="${ax.title}: ${val.toUpperCase()} (クリックで Low ➔ Mid ➔ High ➔ Most)">
              <span class="chip-axis-icon">${ax.icon}</span>
              <span class="chip-val-text">${val}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// -------------------------------------------------------------------------
// Dynamic Inline Update Handlers
// -------------------------------------------------------------------------

function handleInlineFieldChange(id, type, field, value, event) {
  if (event) event.stopPropagation();
  const strId = String(id);

  if (type === 'habit') {
    const habit = state.habits.find(h => String(h.id) === strId);
    if (!habit) return;

    if (field === 'name') habit.name = value;
    else if (field === 'targetMin') habit.targetMin = Number(value) || 5;
    else if (field === 'displayStart') habit.displayStart = value;
    else if (field === 'displayEnd') habit.displayEnd = value;
    else if (field === 'recType') habit.recType = value;
    else if (field === 'notes') habit.notes = value;
    else if (field === 'obsidianUri') habit.obsidianUri = value;
    else if (field === 'tags') {
      habit.tags = value.split(',').map(s => s.trim().replace(/^#/, '')).filter(Boolean);
    }
    saveHabits();
  } else {
    const task = state.tasks.find(t => String(t.id) === strId);
    if (!task) return;

    if (field === 'title') task.title = value;
    else if (field === 'estMin') task.estMin = Number(value) || 15;
    else if (field === 'actMin') task.actMin = Number(value) || 0;
    else if (field === 'scheduledDate') task.scheduledDate = value;
    else if (field === 'status') {
      task.status = value;
      if (value === 'completed' && !task.completedAt) {
        task.completedAt = new Date().toISOString();
      }
    }
    else if (field === 'label') task.label = value;
    else if (field === 'bucket') task.bucket = value;
    else if (field === 'recType') {
      task.recType = value;
      task.taskType = (value && value !== 'none') ? 'recurring' : 'single';
    }
    else if (field === 'notes') task.notes = value;
    else if (field === 'obsidianUri') task.obsidianUri = value;
    else if (field === 'tags') {
      task.tags = value.split(',').map(s => s.trim().replace(/^#/, '')).filter(Boolean);
    }
    saveTasks();
  }

  if (event && event.target) {
    event.target.classList.add('cell-saved-flash');
    setTimeout(() => event.target.classList.remove('cell-saved-flash'), 800);
  }
}

function handleInlineCascadeChange(id, type, kind, level, value) {
  const strId = String(id);
  const isHabit = type === 'habit';
  const item = isHabit
    ? state.habits.find(h => String(h.id) === strId)
    : state.tasks.find(t => String(t.id) === strId);

  if (!item) return;

  if (kind === 'domain') {
    if (level === 'major') {
      item.domainMajor = value;
      const minors = (DOMAINS_DATA[value] && DOMAINS_DATA[value].items) || [];
      item.domainMinor = minors[0] || '';
      item.domain = item.domainMinor || value;
    } else {
      item.domainMinor = value;
      item.domain = value || item.domainMajor || '';
    }
  } else if (kind === 'dept') {
    if (level === 'major') {
      item.deptMajor = value;
      const minors = (DEPTS_DATA[value] && DEPTS_DATA[value].items) || [];
      item.deptMinor = minors[0] || '';
      item.dept = item.deptMinor || value;
    } else {
      item.deptMinor = value;
      item.dept = value || item.deptMajor || '';
    }
  } else if (kind === 'proj') {
    if (level === 'major') {
      item.projMajor = value;
      const minors = (PROJECTS_DATA[value] && PROJECTS_DATA[value].items) || [];
      item.projMinor = minors[0] || '';
      item.proj = item.projMinor || value;
    } else {
      item.projMinor = value;
      item.proj = value || item.projMajor || '';
    }
  }

  if (isHabit) saveHabits();
  else saveTasks();

  renderTableView();
}

function handleInlineTimingChange(id, type, value) {
  const strId = String(id);
  const isHabit = type === 'habit';
  const item = isHabit
    ? state.habits.find(h => String(h.id) === strId)
    : state.tasks.find(t => String(t.id) === strId);

  if (!item) return;

  if (value === 'anytime') {
    item.displayType = 'anytime';
    item.timingType = 'anytime';
  } else if (value === 'custom') {
    item.displayType = 'custom';
    item.timingType = 'custom';
    if (!item.customStart) item.customStart = '13:00';
    if (!item.customEnd) item.customEnd = '17:00';
  } else {
    item.displayType = 'section';
    item.timingType = 'section';
    item.section = value;
  }

  if (isHabit) saveHabits();
  else saveTasks();

  renderTableView();
}

function handleInlineMatrixCycle(id, type, axisKey, event) {
  if (event) event.stopPropagation();
  const strId = String(id);
  const isHabit = type === 'habit';
  const item = isHabit
    ? state.habits.find(h => String(h.id) === strId)
    : state.tasks.find(t => String(t.id) === strId);

  if (!item) return;
  if (!item.matrix) item.matrix = { ...DEFAULT_MATRIX };

  const cycleOrder = ['low', 'mid', 'high', 'most'];
  const curVal = item.matrix[axisKey] || 'mid';
  const nextIdx = (cycleOrder.indexOf(curVal) + 1) % cycleOrder.length;
  const nextVal = cycleOrder[nextIdx];

  item.matrix[axisKey] = nextVal;

  if (isHabit) saveHabits();
  else saveTasks();

  // Instant visual update without full rerender
  if (event && event.currentTarget) {
    const chip = event.currentTarget;
    cycleOrder.forEach(c => chip.classList.remove(`val-${c}`));
    chip.classList.add(`val-${nextVal}`);
    const valTextEl = chip.querySelector('.chip-val-text');
    if (valTextEl) valTextEl.textContent = nextVal;
    chip.classList.add('cell-saved-flash');
    setTimeout(() => chip.classList.remove('cell-saved-flash'), 600);
  } else {
    renderTableView();
  }
}

// -------------------------------------------------------------------------
// Master Table Views Main Render Function
// -------------------------------------------------------------------------

function renderTableView() {
  if (typeof state === 'undefined' || !state) return;
  if (!state.selectedTableItemIds) state.selectedTableItemIds = new Set();
  if (typeof state.showDisabledInTable === 'undefined') state.showDisabledInTable = false;

  const habitsView = document.getElementById('master-habits-view');
  const tasksView = document.getElementById('master-tasks-view');
  const singleTasksView = document.getElementById('master-single-tasks-view');
  const analyticsView = document.getElementById('master-analytics-view');

  const subtabHabits = document.getElementById('subtab-habits');
  const subtabTasks = document.getElementById('subtab-tasks');
  const subtabSingleTasks = document.getElementById('subtab-single-tasks');
  const subtabAnalytics = document.getElementById('subtab-analytics');

  // Recalculate stats safely
  try {
    if (Array.isArray(state.habits)) {
      state.habits.forEach(h => {
        try { recalculateHabitRates(h); } catch(err) {}
      });
    }
  } catch(e) {}

  const curSubtab = state.masterSubtab || 'habits';

  // Toggle subviews
  if (habitsView) habitsView.classList.toggle('hidden', curSubtab !== 'habits');
  if (tasksView) tasksView.classList.toggle('hidden', curSubtab !== 'tasks' && curSubtab !== 'recurring_tasks');
  if (singleTasksView) singleTasksView.classList.toggle('hidden', curSubtab !== 'single_tasks');
  if (analyticsView) analyticsView.classList.toggle('hidden', curSubtab !== 'analytics');

  // Toggle subtab buttons
  if (subtabHabits) subtabHabits.classList.toggle('active', curSubtab === 'habits');
  if (subtabTasks) subtabTasks.classList.toggle('active', curSubtab === 'tasks' || curSubtab === 'recurring_tasks');
  if (subtabSingleTasks) subtabSingleTasks.classList.toggle('active', curSubtab === 'single_tasks');
  if (subtabAnalytics) subtabAnalytics.classList.toggle('active', curSubtab === 'analytics');

  updateBulkActionBar();

  // -----------------------------------------------------------------------
  // 4. Analytics Scoreboard (Habits & Recurring Tasks Continuation Analytics)
  // -----------------------------------------------------------------------
  if (curSubtab === 'analytics') {
    renderTableAnalyticsView();
    return;
  }

  // -----------------------------------------------------------------------
  // 1. Habits Master Table (Full Inline Ultra-Wide)
  // -----------------------------------------------------------------------
  if (curSubtab === 'habits') {
    const container = document.getElementById('habit-table-body');
    const headContainer = document.getElementById('habits-table-head');
    let allHabits = state.habits || [];
    if (!state.showDisabledInTable) {
      allHabits = allHabits.filter(h => !h.isDisabled);
    }
    if (typeof matchesTagFilters === 'function') {
      allHabits = allHabits.filter(matchesTagFilters);
    }
    const sorted = sortHabits(allHabits, state.tableSort?.key || 'default', state.tableSort?.order || 'asc');

    const totalCountEl = document.getElementById('table-total-count');
    if (totalCountEl) totalCountEl.textContent = `${sorted.length} 件`;

    const allSelected = sorted.length > 0 && sorted.every(h => state.selectedTableItemIds.has(String(h.id)));

    if (headContainer) {
      headContainer.innerHTML = `
        <div class="master-sticky-left-panel">
          <div class="col-sub-select">
            <input type="checkbox" ${allSelected ? 'checked' : ''} onchange="toggleTableSelectAll(this.checked)" title="全選択 / 全解除">
          </div>
          <div class="col-sub-drag">⠿</div>
          <div class="col-sub-num">No.</div>
          <div class="col-sub-disabled" title="無効/有効フラグ">無効</div>
          <div class="col-sub-name">🌿 ハビット名（直接編集・詳細⚙️）</div>
        </div>
        <div class="master-scrollable-right-cells">
          <div class="col-head col-grid-period">📅 表示期間 (開始〜終了)</div>
          <div class="col-head col-grid-domain">🌐 ドメイン (大分類 / 詳細)</div>
          <div class="col-head col-grid-dept">🏢 部門 (大分類 / 詳細)</div>
          <div class="col-head col-grid-proj">💼 プロジェクト (大分類 / 詳細)</div>
          <div class="col-head col-grid-timing">⏰ タイミング / セクション</div>
          <div class="col-head col-grid-min">⏱️ 目安</div>
          <div class="col-head col-grid-rec">🔄 定期配信</div>
          <div class="col-head col-grid-matrix">📊 6軸マトリクス (重・緊・認・体・蛙・興 / クリック切替)</div>
          <div class="col-head col-grid-tags">🏷️ タグ (カンマ区切り)</div>
          <div class="col-head col-grid-notes">📝 メモ・備考</div>
          <div class="col-head col-grid-obsidian">🟣 Obsidianノート</div>
          <div class="col-head col-grid-actions">操作</div>
        </div>
      `;
    }

    if (sorted.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-dim);"><p>該当するハビットがありません</p></div>`;
      return;
    }

    container.innerHTML = sorted.map((habit, index) => {
      const isSelected = state.selectedTableItemIds.has(String(habit.id));
      const isDisabled = !!habit.isDisabled;
      const tagsStr = (habit.tags || []).join(', ');

      return `
        <div class="master-row-grid ${isSelected ? 'row-selected' : ''} ${isDisabled ? 'row-disabled' : ''}"
             data-id="${habit.id}"
             draggable="true"
             ondragstart="handleTableDragStart(event, '${habit.id}', 'habit')"
             ondragover="handleTableDragOver(event)"
             ondrop="handleTableDrop(event, '${habit.id}', 'habit')">
          <div class="master-sticky-left-panel">
            <div class="col-sub-select">
              <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleTableSelectItem('${habit.id}', this.checked, event)">
            </div>
            <div class="col-sub-drag" title="ドラッグして並び替え">⠿</div>
            <div class="col-sub-num">${index + 1}</div>
            <div class="col-sub-disabled" title="無効/有効切替">
              <input type="checkbox" ${isDisabled ? 'checked' : ''} onchange="toggleItemDisabledInline('${habit.id}', 'habit', event)">
            </div>
            <div class="col-sub-name">
              <input type="text" class="table-name-input" value="${habit.name || ''}"
                     onblur="handleInlineFieldChange('${habit.id}', 'habit', 'name', this.value, event)"
                     onkeydown="if(event.key==='Enter'){this.blur();}"
                     title="クリックして名前を直接編集">
              <button type="button" class="btn-cell-icon" onclick="openEditModal('${habit.id}')" title="ハビット詳細・履歴モーダルを開く">⚙️</button>
            </div>
          </div>
          <div class="master-scrollable-right-cells">
            <div class="col-grid-period">
              <div style="display: flex; gap: 4px; align-items: center; width: 100%;">
                <input type="date" class="table-inline-input" value="${habit.displayStart || ''}"
                       onchange="handleInlineFieldChange('${habit.id}', 'habit', 'displayStart', this.value, event)" title="開始日">
                <span style="color: var(--text-dim); font-size: 11px; flex-shrink: 0;">〜</span>
                <input type="date" class="table-inline-input" value="${habit.displayEnd || ''}"
                       onchange="handleInlineFieldChange('${habit.id}', 'habit', 'displayEnd', this.value, event)" title="終了日">
              </div>
            </div>
            ${buildInlineDomainHtml(habit, 'habit')}
            ${buildInlineDeptHtml(habit, 'habit')}
            ${buildInlineProjHtml(habit, 'habit')}
            ${buildInlineTimingHtml(habit, 'habit')}
            <div class="col-grid-min">
              <div style="display: flex; align-items: center; gap: 2px;">
                <input type="number" class="table-inline-input" min="1" max="480" value="${habit.targetMin || 5}"
                       onchange="handleInlineFieldChange('${habit.id}', 'habit', 'targetMin', this.value, event)">
                <span style="color: var(--text-muted); font-size: 10px;">分</span>
              </div>
            </div>
            ${buildInlineRecurrenceHtml(habit, 'habit')}
            ${buildInlineMatrixChipsHtml(habit, 'habit')}
            <div class="col-grid-tags">
              <input type="text" class="table-inline-input" placeholder="#タグ1, #タグ2" value="${tagsStr}"
                     onblur="handleInlineFieldChange('${habit.id}', 'habit', 'tags', this.value, event)"
                     onkeydown="if(event.key==='Enter'){this.blur();}">
            </div>
            <div class="col-grid-notes">
              <input type="text" class="table-inline-input" placeholder="メモ・備考..." value="${habit.notes || ''}"
                     onblur="handleInlineFieldChange('${habit.id}', 'habit', 'notes', this.value, event)"
                     onkeydown="if(event.key==='Enter'){this.blur();}">
            </div>
            <div class="col-grid-obsidian">
              <div class="table-obsidian-cell">
                <input type="text" class="table-inline-input" placeholder="Obsidianリンク..." value="${habit.obsidianUri || ''}"
                       onblur="handleInlineFieldChange('${habit.id}', 'habit', 'obsidianUri', this.value, event)"
                       onkeydown="if(event.key==='Enter'){this.blur();}"
                       title="Obsidianノートリンクまたはパス">
                <button type="button" 
                        class="btn-cell-obsidian ${habit.obsidianUri ? 'active' : 'disabled'}"
                        onclick="${habit.obsidianUri ? `openObsidianLink('${habit.obsidianUri.replace(/'/g, "\\'")}', event)` : `openEditModal('${habit.id}')`}"
                        title="${habit.obsidianUri ? 'Obsidianで開く: ' + habit.obsidianUri : 'リンク未設定（クリックして設定）'}">
                  <svg class="obsidian-svg-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                    <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5L18 8l-6 3.5L6 8l6-3.5zm-6.5 5.5l5.5 3.2v6.8L5.5 16V10zm13 6l-5.5 3.5v-6.8l5.5-3.2v6.5z"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="col-grid-actions">
              <button type="button" class="btn-cell-icon" onclick="duplicateSingleItem('${habit.id}', 'habit', event)" title="複製">📋</button>
              <button type="button" class="btn-cell-icon danger" onclick="deleteSingleItem('${habit.id}', 'habit', event)" title="削除">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // -----------------------------------------------------------------------
  // 2. Recurring Tasks Master Table (Full Inline Ultra-Wide)
  // -----------------------------------------------------------------------
  if (curSubtab === 'tasks' || curSubtab === 'recurring_tasks') {
    const container = document.getElementById('recurring-task-table-body');
    const headContainer = document.getElementById('recurring-table-head');
    let recTasks = (state.tasks || []).filter(t => isRecurringTaskItem(t));
    if (!state.showDisabledInTable) {
      recTasks = recTasks.filter(t => !t.isDisabled);
    }
    if (typeof matchesTagFilters === 'function') {
      recTasks = recTasks.filter(matchesTagFilters);
    }

    const countEl = document.getElementById('table-recurring-tasks-count');
    if (countEl) countEl.textContent = `${recTasks.length} 件`;

    const allSelected = recTasks.length > 0 && recTasks.every(t => state.selectedTableItemIds.has(String(t.id)));

    if (headContainer) {
      headContainer.innerHTML = `
        <div class="master-sticky-left-panel">
          <div class="col-sub-select">
            <input type="checkbox" ${allSelected ? 'checked' : ''} onchange="toggleTableSelectAll(this.checked)" title="全選択 / 全解除">
          </div>
          <div class="col-sub-drag">⠿</div>
          <div class="col-sub-num">No.</div>
          <div class="col-sub-disabled" title="無効/有効フラグ">無効</div>
          <div class="col-sub-name">🎯 定期タスク名（直接編集・詳細⚙️）</div>
        </div>
        <div class="master-scrollable-right-cells">
          <div class="col-head col-grid-eisenhower">🏷️ アイゼンハワー</div>
          <div class="col-head col-grid-domain">🌐 ドメイン (大分類 / 詳細)</div>
          <div class="col-head col-grid-dept">🏢 部門 (大分類 / 詳細)</div>
          <div class="col-head col-grid-proj">💼 プロジェクト (大分類 / 詳細)</div>
          <div class="col-head col-grid-rec">🔄 配信定期</div>
          <div class="col-head col-grid-timing">⏰ セクション / 時間</div>
          <div class="col-head col-grid-min">⏱️ 見積</div>
          <div class="col-head col-grid-matrix">📊 6軸マトリクス (重・緊・認・体・蛙・興 / クリック切替)</div>
          <div class="col-head col-grid-tags">🏷️ タグ (カンマ区切り)</div>
          <div class="col-head col-grid-notes">📝 メモ・備考</div>
          <div class="col-head col-grid-obsidian">🟣 Obsidianノート</div>
          <div class="col-head col-grid-actions">操作</div>
        </div>
      `;
    }

    if (recTasks.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-dim);"><p>定期タスクがありません</p></div>`;
      return;
    }

    container.innerHTML = recTasks.map((task, index) => {
      const isSelected = state.selectedTableItemIds.has(String(task.id));
      const isDisabled = !!task.isDisabled;
      const tagsStr = (task.tags || []).join(', ');

      return `
        <div class="master-row-grid ${isSelected ? 'row-selected' : ''} ${isDisabled ? 'row-disabled' : ''}"
             data-id="${task.id}"
             draggable="true"
             ondragstart="handleTableDragStart(event, '${task.id}', 'task')"
             ondragover="handleTableDragOver(event)"
             ondrop="handleTableDrop(event, '${task.id}', 'task')">
          <div class="master-sticky-left-panel">
            <div class="col-sub-select">
              <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleTableSelectItem('${task.id}', this.checked, event)">
            </div>
            <div class="col-sub-drag" title="ドラッグして並び替え">⠿</div>
            <div class="col-sub-num">${index + 1}</div>
            <div class="col-sub-disabled" title="無効/有効切替">
              <input type="checkbox" ${isDisabled ? 'checked' : ''} onchange="toggleItemDisabledInline('${task.id}', 'task', event)">
            </div>
            <div class="col-sub-name">
              <input type="text" class="table-name-input" value="${task.title || ''}"
                     onblur="handleInlineFieldChange('${task.id}', 'task', 'title', this.value, event)"
                     onkeydown="if(event.key==='Enter'){this.blur();}"
                     title="クリックして名前を直接編集">
              <button type="button" class="btn-cell-icon" onclick="openEditTaskModal('${task.id}')" title="タスク詳細モーダルを開く">⚙️</button>
            </div>
          </div>
          <div class="master-scrollable-right-cells">
            ${buildInlineEisenhowerHtml(task)}
            ${buildInlineDomainHtml(task, 'task')}
            ${buildInlineDeptHtml(task, 'task')}
            ${buildInlineProjHtml(task, 'task')}
            ${buildInlineRecurrenceHtml(task, 'task')}
            ${buildInlineTimingHtml(task, 'task')}
            <div class="col-grid-min">
              <div style="display: flex; align-items: center; gap: 2px;">
                <input type="number" class="table-inline-input" min="1" max="600" value="${task.estMin || 15}"
                       onchange="handleInlineFieldChange('${task.id}', 'task', 'estMin', this.value, event)">
                <span style="color: var(--text-muted); font-size: 10px;">分</span>
              </div>
            </div>
            ${buildInlineMatrixChipsHtml(task, 'task')}
            <div class="col-grid-tags">
              <input type="text" class="table-inline-input" placeholder="#タグ1, #タグ2" value="${tagsStr}"
                     onblur="handleInlineFieldChange('${task.id}', 'task', 'tags', this.value, event)"
                     onkeydown="if(event.key==='Enter'){this.blur();}">
            </div>
            <div class="col-grid-notes">
              <input type="text" class="table-inline-input" placeholder="メモ・備考..." value="${task.notes || ''}"
                     onblur="handleInlineFieldChange('${task.id}', 'task', 'notes', this.value, event)"
                     onkeydown="if(event.key==='Enter'){this.blur();}">
            </div>
            <div class="col-grid-obsidian">
              <div class="table-obsidian-cell">
                <input type="text" class="table-inline-input" placeholder="Obsidianリンク..." value="${task.obsidianUri || ''}"
                       onblur="handleInlineFieldChange('${task.id}', 'task', 'obsidianUri', this.value, event)"
                       onkeydown="if(event.key==='Enter'){this.blur();}"
                       title="Obsidianノートリンクまたはパス">
                <button type="button" 
                        class="btn-cell-obsidian ${task.obsidianUri ? 'active' : 'disabled'}"
                        onclick="${task.obsidianUri ? `openObsidianLink('${task.obsidianUri.replace(/'/g, "\\'")}', event)` : `openEditTaskModal('${task.id}')`}"
                        title="${task.obsidianUri ? 'Obsidianで開く: ' + task.obsidianUri : 'リンク未設定（クリックして設定）'}">
                  <svg class="obsidian-svg-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                    <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5L18 8l-6 3.5L6 8l6-3.5zm-6.5 5.5l5.5 3.2v6.8L5.5 16V10zm13 6l-5.5 3.5v-6.8l5.5-3.2v6.5z"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="col-grid-actions">
              <button type="button" class="btn-cell-icon" onclick="duplicateSingleItem('${task.id}', 'task', event)" title="複製">📋</button>
              <button type="button" class="btn-cell-icon danger" onclick="deleteSingleItem('${task.id}', 'task', event)" title="削除">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // -----------------------------------------------------------------------
  // 3. Single Tasks Master Table (Full Inline Ultra-Wide)
  // -----------------------------------------------------------------------
  if (curSubtab === 'single_tasks') {
    const container = document.getElementById('single-task-table-body');
    const headContainer = document.getElementById('single-tasks-table-head');
    let singleTasks = (state.tasks || []).filter(t => !isRecurringTaskItem(t));
    if (!state.showDisabledInTable) {
      singleTasks = singleTasks.filter(t => !t.isDisabled);
    }
    if (typeof matchesTagFilters === 'function') {
      singleTasks = singleTasks.filter(matchesTagFilters);
    }
    const sorted = sortSingleTasks(singleTasks);

    const countEl = document.getElementById('table-single-tasks-count');
    if (countEl) countEl.textContent = `${sorted.length} 件`;

    const allSelected = sorted.length > 0 && sorted.every(t => state.selectedTableItemIds.has(String(t.id)));

    if (headContainer) {
      headContainer.innerHTML = `
        <div class="master-sticky-left-panel">
          <div class="col-sub-select">
            <input type="checkbox" ${allSelected ? 'checked' : ''} onchange="toggleTableSelectAll(this.checked)" title="全選択 / 全解除">
          </div>
          <div class="col-sub-drag">⠿</div>
          <div class="col-sub-num">No.</div>
          <div class="col-sub-disabled" title="無効/有効フラグ">無効</div>
          <div class="col-sub-name">📋 単発タスク名（直接編集・詳細⚙️）</div>
        </div>
        <div class="master-scrollable-right-cells">
          <div class="col-head col-grid-date">📅 予定日 / 日付</div>
          <div class="col-head col-grid-status">状態</div>
          <div class="col-head col-grid-bucket">📦 バケット</div>
          <div class="col-head col-grid-eisenhower">🏷️ アイゼンハワー</div>
          <div class="col-head col-grid-domain">🌐 ドメイン (大分類 / 詳細)</div>
          <div class="col-head col-grid-dept">🏢 部門 (大分類 / 詳細)</div>
          <div class="col-head col-grid-proj">💼 プロジェクト (大分類 / 詳細)</div>
          <div class="col-head col-grid-timing">⏰ セクション</div>
          <div class="col-head col-grid-min">⏱️ 見積</div>
          <div class="col-head col-grid-act">実働</div>
          <div class="col-head col-grid-matrix">📊 6軸マトリクス (重・緊・認・体・蛙・興 / クリック切替)</div>
          <div class="col-head col-grid-tags">🏷️ タグ (カンマ区切り)</div>
          <div class="col-head col-grid-notes">📝 メモ・備考</div>
          <div class="col-head col-grid-obsidian">🟣 Obsidianノート</div>
          <div class="col-head col-grid-actions">操作</div>
        </div>
      `;
    }

    if (sorted.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-dim);"><p>単発タスクがありません</p></div>`;
      return;
    }

    container.innerHTML = sorted.map((task, index) => {
      const isSelected = state.selectedTableItemIds.has(String(task.id));
      const isDisabled = !!task.isDisabled;
      const isCompleted = task.status === 'completed';
      const tagsStr = (task.tags || []).join(', ');

      return `
        <div class="master-row-grid ${isSelected ? 'row-selected' : ''} ${isDisabled ? 'row-disabled' : ''} ${isCompleted ? 'row-completed' : ''}"
             data-id="${task.id}"
             draggable="true"
             ondragstart="handleTableDragStart(event, '${task.id}', 'task')"
             ondragover="handleTableDragOver(event)"
             ondrop="handleTableDrop(event, '${task.id}', 'task')">
          <div class="master-sticky-left-panel">
            <div class="col-sub-select">
              <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleTableSelectItem('${task.id}', this.checked, event)">
            </div>
            <div class="col-sub-drag" title="ドラッグして並び替え">⠿</div>
            <div class="col-sub-num">${index + 1}</div>
            <div class="col-sub-disabled" title="無効/有効切替">
              <input type="checkbox" ${isDisabled ? 'checked' : ''} onchange="toggleItemDisabledInline('${task.id}', 'task', event)">
            </div>
            <div class="col-sub-name">
              <input type="text" class="table-name-input" value="${task.title || ''}"
                     onblur="handleInlineFieldChange('${task.id}', 'task', 'title', this.value, event)"
                     onkeydown="if(event.key==='Enter'){this.blur();}"
                     title="クリックして名前を直接編集">
              <button type="button" class="btn-cell-icon" onclick="openEditTaskModal('${task.id}')" title="タスク詳細モーダルを開く">⚙️</button>
            </div>
          </div>
          <div class="master-scrollable-right-cells">
            <div class="col-grid-date">
              <input type="date" class="table-inline-input" value="${task.scheduledDate || ''}"
                     onchange="handleInlineFieldChange('${task.id}', 'task', 'scheduledDate', this.value, event)" title="実施予定日">
            </div>
            <div class="col-grid-status">
              <select class="table-inline-select" onchange="handleInlineFieldChange('${task.id}', 'task', 'status', this.value, event)" title="実行状態">
                <option value="uncompleted" ${task.status !== 'completed' ? 'selected' : ''}>⏳ 未完了</option>
                <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>✓ 完了</option>
              </select>
            </div>
            ${buildInlineBucketHtml(task)}
            ${buildInlineEisenhowerHtml(task)}
            ${buildInlineDomainHtml(task, 'task')}
            ${buildInlineDeptHtml(task, 'task')}
            ${buildInlineProjHtml(task, 'task')}
            <div class="col-grid-timing">
              <select class="table-inline-select" onchange="handleInlineFieldChange('${task.id}', 'task', 'section', this.value, event)" title="セクション">
                ${SECTIONS_CONFIG.map(s => `<option value="${s.name}" ${task.section === s.name ? 'selected' : ''}>⏱️ ${s.name}</option>`).join('')}
              </select>
            </div>
            <div class="col-grid-min">
              <div style="display: flex; align-items: center; gap: 2px;">
                <input type="number" class="table-inline-input" min="1" max="600" value="${task.estMin || 15}"
                       onchange="handleInlineFieldChange('${task.id}', 'task', 'estMin', this.value, event)">
                <span style="color: var(--text-muted); font-size: 10px;">分</span>
              </div>
            </div>
            <div class="col-grid-act">
              <div style="display: flex; align-items: center; gap: 2px;">
                <input type="number" class="table-inline-input" min="0" max="600" value="${task.actMin || 0}"
                       onchange="handleInlineFieldChange('${task.id}', 'task', 'actMin', this.value, event)" title="実働時間 (分)">
                <span style="color: var(--text-muted); font-size: 10px;">分</span>
              </div>
            </div>
            ${buildInlineMatrixChipsHtml(task, 'task')}
            <div class="col-grid-tags">
              <input type="text" class="table-inline-input" placeholder="#タグ1, #タグ2" value="${tagsStr}"
                     onblur="handleInlineFieldChange('${task.id}', 'task', 'tags', this.value, event)"
                     onkeydown="if(event.key==='Enter'){this.blur();}">
            </div>
            <div class="col-grid-notes">
              <input type="text" class="table-inline-input" placeholder="メモ・備考..." value="${task.notes || ''}"
                     onblur="handleInlineFieldChange('${task.id}', 'task', 'notes', this.value, event)"
                     onkeydown="if(event.key==='Enter'){this.blur();}">
            </div>
            <div class="col-grid-obsidian">
              <div class="table-obsidian-cell">
                <input type="text" class="table-inline-input" placeholder="Obsidianリンク..." value="${task.obsidianUri || ''}"
                       onblur="handleInlineFieldChange('${task.id}', 'task', 'obsidianUri', this.value, event)"
                       onkeydown="if(event.key==='Enter'){this.blur();}"
                       title="Obsidianノートリンクまたはパス">
                <button type="button" 
                        class="btn-cell-obsidian ${task.obsidianUri ? 'active' : 'disabled'}"
                        onclick="${task.obsidianUri ? `openObsidianLink('${task.obsidianUri.replace(/'/g, "\\'")}', event)` : `openEditTaskModal('${task.id}')`}"
                        title="${task.obsidianUri ? 'Obsidianで開く: ' + task.obsidianUri : 'リンク未設定（クリックして設定）'}">
                  <svg class="obsidian-svg-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                    <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5L18 8l-6 3.5L6 8l6-3.5zm-6.5 5.5l5.5 3.2v6.8L5.5 16V10zm13 6l-5.5 3.5v-6.8l5.5-3.2v6.5z"/>
                  </svg>
                </button>
              </div>
            </div>
            <div class="col-grid-actions">
              <button type="button" class="btn-cell-icon" onclick="duplicateSingleItem('${task.id}', 'task', event)" title="複製">📋</button>
              <button type="button" class="btn-cell-icon danger" onclick="deleteSingleItem('${task.id}', 'task', event)" title="削除">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Auto-init scale bar synchronization
  setTimeout(() => {
    initMasterScrollScale();
  }, 30);
}

// -------------------------------------------------------------------------
// 4. Horizontal & Vertical Custom Scroll Scale Synchronization Engine
// -------------------------------------------------------------------------

function getActiveMasterTableWrapper() {
  const curSubtab = (typeof state !== 'undefined' && state.masterSubtab) || 'habits';
  if (curSubtab === 'habits') return document.getElementById('master-habits-wrapper');
  if (curSubtab === 'tasks' || curSubtab === 'recurring_tasks') return document.getElementById('master-tasks-wrapper');
  if (curSubtab === 'single_tasks') return document.getElementById('single-task-table-wrapper');
  if (curSubtab === 'analytics') return document.getElementById('master-analytics-wrapper');
  return document.getElementById('master-habits-wrapper');
}

function getActiveMasterVertScalePanel() {
  const curSubtab = (typeof state !== 'undefined' && state.masterSubtab) || 'habits';
  if (curSubtab === 'habits') return document.getElementById('vert-scale-habits');
  if (curSubtab === 'tasks' || curSubtab === 'recurring_tasks') return document.getElementById('vert-scale-tasks');
  if (curSubtab === 'single_tasks') return document.getElementById('vert-scale-single-tasks');
  if (curSubtab === 'analytics') return document.getElementById('vert-scale-analytics');
  return document.getElementById('vert-scale-habits');
}

let isScaleDragging = false;
let scaleStartX = 0;
let scaleStartScrollLeft = 0;

let isVertScaleDragging = false;
let vertScaleStartY = 0;
let vertScaleStartScrollTop = 0;

function updateMasterTableScales() {
  const pairs = [
    { wrapperId: 'master-habits-wrapper', vertPanelId: 'vert-scale-habits' },
    { wrapperId: 'master-tasks-wrapper', vertPanelId: 'vert-scale-tasks' },
    { wrapperId: 'single-task-table-wrapper', vertPanelId: 'vert-scale-single-tasks' },
    { wrapperId: 'master-analytics-wrapper', vertPanelId: 'vert-scale-analytics' },
  ];

  const curWrapper = getActiveMasterTableWrapper();
  const horizPanel = document.getElementById('master-scroll-scale-panel');
  const hThumb = document.getElementById('scale-thumb-bar');
  const hTrackInner = document.getElementById('scale-track-inner');

  // 1. Update Horizontal Scale for Active Table
  if (curWrapper && horizPanel && hThumb && hTrackInner) {
    const scrollWidth = curWrapper.scrollWidth;
    const clientWidth = curWrapper.clientWidth;
    const scrollLeft = curWrapper.scrollLeft;

    if (scrollWidth <= clientWidth + 2) {
      horizPanel.classList.add('hidden');
    } else {
      horizPanel.classList.remove('hidden');
      const trackWidth = hTrackInner.clientWidth || 200;
      const thumbWidth = Math.max(50, Math.round(trackWidth * (clientWidth / scrollWidth)));
      const maxScrollLeft = scrollWidth - clientWidth;
      const maxThumbLeft = Math.max(0, trackWidth - thumbWidth);
      const thumbLeft = maxScrollLeft > 0 ? Math.round((scrollLeft / maxScrollLeft) * maxThumbLeft) : 0;

      hThumb.style.width = `${thumbWidth}px`;
      hThumb.style.left = `${Math.min(maxThumbLeft, Math.max(0, thumbLeft))}px`;
    }
  }

  // 2. Update Vertical Scales for each table wrapper
  pairs.forEach(({ wrapperId, vertPanelId }) => {
    const wrapper = document.getElementById(wrapperId);
    const vertPanel = document.getElementById(vertPanelId);
    if (!wrapper || !vertPanel) return;

    const vThumb = vertPanel.querySelector('.scale-vert-thumb-bar');
    const vTrackInner = vertPanel.querySelector('.scale-vert-track-inner');
    if (!vThumb || !vTrackInner) return;

    const scrollHeight = wrapper.scrollHeight;
    const clientHeight = wrapper.clientHeight;
    const scrollTop = wrapper.scrollTop;

    // If content does not overflow vertically, completely hide the vertical panel
    if (scrollHeight <= clientHeight + 4) {
      vertPanel.classList.add('hidden');
      return;
    }

    vertPanel.classList.remove('hidden');
    const trackHeight = vTrackInner.clientHeight || 200;
    const thumbHeight = Math.max(32, Math.round(trackHeight * (clientHeight / scrollHeight)));
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const thumbTop = maxScrollTop > 0 ? Math.round((scrollTop / maxScrollTop) * maxThumbTop) : 0;

    vThumb.style.height = `${thumbHeight}px`;
    vThumb.style.top = `${Math.min(maxThumbTop, Math.max(0, thumbTop))}px`;
  });
}

function initMasterScrollScale() {
  updateMasterTableScales();

  const pairs = [
    { wrapperId: 'master-habits-wrapper', vertPanelId: 'vert-scale-habits' },
    { wrapperId: 'master-tasks-wrapper', vertPanelId: 'vert-scale-tasks' },
    { wrapperId: 'single-task-table-wrapper', vertPanelId: 'vert-scale-single-tasks' },
    { wrapperId: 'master-analytics-wrapper', vertPanelId: 'vert-scale-analytics' },
  ];

  // Setup scroll event listeners on wrappers
  pairs.forEach(({ wrapperId, vertPanelId }) => {
    const wrapper = document.getElementById(wrapperId);
    const vertPanel = document.getElementById(vertPanelId);
    if (!wrapper) return;

    if (!wrapper._masterScaleBound) {
      wrapper._masterScaleBound = true;
      wrapper.addEventListener('scroll', () => {
        updateMasterTableScales();
      }, { passive: true });
    }

    if (vertPanel && !vertPanel._masterScaleBound) {
      vertPanel._masterScaleBound = true;
      const vThumb = vertPanel.querySelector('.scale-vert-thumb-bar');
      const vTrackInner = vertPanel.querySelector('.scale-vert-track-inner');

      if (vThumb && vTrackInner) {
        vThumb.onmousedown = (e) => {
          e.preventDefault();
          e.stopPropagation();
          isVertScaleDragging = true;
          vertScaleStartY = e.clientY;
          vertScaleStartScrollTop = wrapper.scrollTop;

          document.body.style.userSelect = 'none';

          const onMouseMove = (moveEvent) => {
            if (!isVertScaleDragging) return;
            const trackHeight = vTrackInner.clientHeight || 200;
            const thumbHeight = vThumb.offsetHeight || 32;
            const maxThumbTop = Math.max(1, trackHeight - thumbHeight);
            const maxScrollTop = wrapper.scrollHeight - wrapper.clientHeight;

            const deltaY = moveEvent.clientY - vertScaleStartY;
            const scrollDelta = (deltaY / maxThumbTop) * maxScrollTop;
            wrapper.scrollTop = Math.max(0, Math.min(maxScrollTop, vertScaleStartScrollTop + scrollDelta));
          };

          const onMouseUp = () => {
            isVertScaleDragging = false;
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
          };

          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        };
      }
    }
  });

  // Setup horizontal thumb drag listener
  const hThumb = document.getElementById('scale-thumb-bar');
  const hTrackInner = document.getElementById('scale-track-inner');

  if (hThumb && hTrackInner && !hThumb._masterScaleBound) {
    hThumb._masterScaleBound = true;
    hThumb.onmousedown = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const wrapper = getActiveMasterTableWrapper();
      if (!wrapper) return;

      isScaleDragging = true;
      scaleStartX = e.clientX;
      scaleStartScrollLeft = wrapper.scrollLeft;

      document.body.style.userSelect = 'none';

      const onMouseMove = (moveEvent) => {
        if (!isScaleDragging) return;
        const trackWidth = hTrackInner.clientWidth || 200;
        const thumbWidth = hThumb.offsetWidth || 50;
        const maxThumbLeft = Math.max(1, trackWidth - thumbWidth);
        const maxScrollLeft = wrapper.scrollWidth - wrapper.clientWidth;

        const deltaX = moveEvent.clientX - scaleStartX;
        const scrollDelta = (deltaX / maxThumbLeft) * maxScrollLeft;
        wrapper.scrollLeft = Math.max(0, Math.min(maxScrollLeft, scaleStartScrollLeft + scrollDelta));
      };

      const onMouseUp = () => {
        isScaleDragging = false;
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    };
  }
}

function handleScaleTrackClick(event) {
  if (event.target.closest('#scale-thumb-bar') || event.target.closest('.btn-scale-nav')) return;
  const wrapper = getActiveMasterTableWrapper();
  const trackInner = document.getElementById('scale-track-inner');
  if (!wrapper || !trackInner) return;

  const rect = trackInner.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const ratio = Math.max(0, Math.min(1, clickX / rect.width));

  const maxScrollLeft = wrapper.scrollWidth - wrapper.clientWidth;
  wrapper.scrollTo({
    left: ratio * maxScrollLeft,
    behavior: 'smooth'
  });
}

function handleVerticalScaleTrackClick(event) {
  if (event.target.closest('.scale-vert-thumb-bar') || event.target.closest('.btn-scale-vert-nav')) return;
  const wrapper = getActiveMasterTableWrapper();
  const vertPanel = getActiveMasterVertScalePanel();
  if (!wrapper || !vertPanel) return;

  const trackInner = vertPanel.querySelector('.scale-vert-track-inner');
  if (!trackInner) return;

  const rect = trackInner.getBoundingClientRect();
  const clickY = event.clientY - rect.top;
  const ratio = Math.max(0, Math.min(1, clickY / rect.height));

  const maxScrollTop = wrapper.scrollHeight - wrapper.clientHeight;
  wrapper.scrollTo({
    top: ratio * maxScrollTop,
    behavior: 'smooth'
  });
}

function scrollMasterActiveTable(direction) {
  const wrapper = getActiveMasterTableWrapper();
  if (!wrapper) return;

  if (direction === 'left') {
    wrapper.scrollTo({ left: 0, behavior: 'smooth' });
  } else {
    wrapper.scrollTo({ left: wrapper.scrollWidth, behavior: 'smooth' });
  }
}

function scrollMasterActiveTableVertical(direction) {
  const wrapper = getActiveMasterTableWrapper();
  if (!wrapper) return;

  if (direction === 'top') {
    wrapper.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    wrapper.scrollTo({ top: wrapper.scrollHeight, behavior: 'smooth' });
  }
}


// =========================================================================
// 4. Drag & Drop Reordering in Table Views
// =========================================================================

let tableDragSourceId = null;
let tableDragType = null;

function handleTableDragStart(event, id, type) {
  tableDragSourceId = String(id);
  tableDragType = type;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', id);
  if (event.target.classList) {
    event.target.classList.add('table-dragging');
  }
}

function handleTableDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
}

function handleTableDrop(event, targetId, type) {
  event.preventDefault();
  const sourceId = tableDragSourceId;
  const tId = String(targetId);

  if (!sourceId || sourceId === tId || tableDragType !== type) return;

  if (type === 'habit') {
    const list = [...state.habits].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const fromIdx = list.findIndex(h => String(h.id) === sourceId);
    const toIdx = list.findIndex(h => String(h.id) === tId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      // 移動後の並び順に基づき全ハビットに 1〜N の sortOrder を再採番
      list.forEach((h, idx) => {
        h.sortOrder = idx + 1;
      });
      state.habits = list;
      saveHabits();
    }
  } else {
    const list = [...state.tasks];
    const fromIdx = list.findIndex(t => String(t.id) === sourceId);
    const toIdx = list.findIndex(t => String(t.id) === tId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      state.tasks = list;
      saveTasks();
    }
  }

  tableDragSourceId = null;
  tableDragType = null;
  renderTableView();
}

// =========================================================================
// 5. Bulk Operations Engine (Modal, Serial Rename, Bulk Update, Delete)
// =========================================================================

function openBulkEditModal() {
  if (state.selectedTableItemIds.size === 0) {
    alert('⚠️ 変更対象のアイテムをチェックボックスで選択してください。');
    return;
  }

  const modal = document.getElementById('modal-bulk-edit');
  const countEl = document.getElementById('bulk-modal-target-count');
  if (countEl) countEl.textContent = state.selectedTableItemIds.size;

  const fieldSelect = document.getElementById('bulk-edit-field-select');
  if (fieldSelect) {
    renderBulkEditFormFields(fieldSelect.value);
  }

  if (modal) modal.classList.add('active');
}

function renderBulkEditFormFields(fieldKey) {
  const container = document.getElementById('bulk-edit-dynamic-inputs');
  if (!container) return;

  let html = '';

  if (fieldKey === 'section') {
    html = `
      <label style="font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px;">⏱️ 新しいセクション</label>
      <select id="bulk-input-section" style="width: 100%; padding: 8px; border-radius: 6px; background: #0f172a; border: 1px solid var(--border-color); color: var(--text-main);">
        ${SECTIONS_CONFIG.map(s => `<option value="${s.name}">${s.name} (${s.startStr} - ${s.endStr})</option>`).join('')}
      </select>
    `;
  } else if (fieldKey === 'duration') {
    html = `
      <label style="font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px;">⌛ 目標時間 / 見積時間 (分)</label>
      <input type="number" id="bulk-input-duration" min="1" max="480" value="25" style="width: 100%; padding: 8px; border-radius: 6px; background: #0f172a; border: 1px solid var(--border-color); color: var(--text-main);">
    `;
  } else if (fieldKey === 'domain') {
    html = `
      <label style="font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px;">🌐 ドメイン大分類</label>
      <select id="bulk-input-domain-major" onchange="updateBulkMinorSelect('domain')" style="width: 100%; padding: 8px; border-radius: 6px; background: #0f172a; border: 1px solid var(--border-color); color: var(--text-main); margin-bottom: 8px;">
        ${Object.keys(DOMAINS_DATA).map(k => `<option value="${k}">${DOMAINS_DATA[k].name}</option>`).join('')}
      </select>
      <label style="font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px;">ドメイン小分類</label>
      <select id="bulk-input-domain-minor" style="width: 100%; padding: 8px; border-radius: 6px; background: #0f172a; border: 1px solid var(--border-color); color: var(--text-main);"></select>
    `;
  } else if (fieldKey === 'proj') {
    html = `
      <label style="font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px;">💼 プロジェクト大分類</label>
      <select id="bulk-input-proj-major" onchange="updateBulkMinorSelect('proj')" style="width: 100%; padding: 8px; border-radius: 6px; background: #0f172a; border: 1px solid var(--border-color); color: var(--text-main); margin-bottom: 8px;">
        ${Object.keys(PROJECTS_DATA).map(k => `<option value="${k}">${PROJECTS_DATA[k].name}</option>`).join('')}
      </select>
      <label style="font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px;">プロジェクト小分類</label>
      <select id="bulk-input-proj-minor" style="width: 100%; padding: 8px; border-radius: 6px; background: #0f172a; border: 1px solid var(--border-color); color: var(--text-main);"></select>
    `;
  } else if (fieldKey === 'dept') {
    html = `
      <label style="font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px;">🏢 部門大分類</label>
      <select id="bulk-input-dept-major" onchange="updateBulkMinorSelect('dept')" style="width: 100%; padding: 8px; border-radius: 6px; background: #0f172a; border: 1px solid var(--border-color); color: var(--text-main); margin-bottom: 8px;">
        ${Object.keys(DEPTS_DATA).map(k => `<option value="${k}">${DEPTS_DATA[k].name}</option>`).join('')}
      </select>
      <label style="font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px;">部門小分類</label>
      <select id="bulk-input-dept-minor" style="width: 100%; padding: 8px; border-radius: 6px; background: #0f172a; border: 1px solid var(--border-color); color: var(--text-main);"></select>
    `;
  } else if (fieldKey === 'tags') {
    html = `
      <label style="font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px;">🏷️ タグ (カンマ区切りで入力)</label>
      <input type="text" id="bulk-input-tags" placeholder="例: 動画編集, 集中, レビュー" style="width: 100%; padding: 8px; border-radius: 6px; background: #0f172a; border: 1px solid var(--border-color); color: var(--text-main); margin-bottom: 8px;">
      <div style="display: flex; gap: 12px; font-size: 12px; color: var(--text-dim);">
        <label><input type="radio" name="bulk-tags-mode" value="append" checked> 既存タグに追加</label>
        <label><input type="radio" name="bulk-tags-mode" value="replace"> 既存タグを完全置換</label>
      </div>
    `;
  } else if (fieldKey === 'name') {
    html = `
      <label style="font-weight: 600; font-size: 12px; display: block; margin-bottom: 6px;">📝 新しい名前 / タイトル（連番マクロ対応）</label>
      <input type="text" id="bulk-input-name" placeholder="例: 動画制作_{n}" style="width: 100%; padding: 8px; border-radius: 6px; background: #0f172a; border: 1px solid var(--border-color); color: var(--text-main); margin-bottom: 6px;">
      <span style="font-size: 11px; color: var(--accent-cyan); display: block; line-height: 1.5;">
        💡 <b>連番テクニック:</b>「<code>{n}</code>」を含めると、選択順に「動画制作_1」「動画制作_2」... と自動で連番が振られます。
      </span>
    `;
  }

  container.innerHTML = html;

  if (fieldKey === 'domain') updateBulkMinorSelect('domain');
  if (fieldKey === 'proj') updateBulkMinorSelect('proj');
  if (fieldKey === 'dept') updateBulkMinorSelect('dept');
}

function updateBulkMinorSelect(type) {
  let majorKey = '', dataMap = null, minorSelectId = '';
  if (type === 'domain') {
    majorKey = document.getElementById('bulk-input-domain-major')?.value;
    dataMap = DOMAINS_DATA;
    minorSelectId = 'bulk-input-domain-minor';
  } else if (type === 'proj') {
    majorKey = document.getElementById('bulk-input-proj-major')?.value;
    dataMap = PROJECTS_DATA;
    minorSelectId = 'bulk-input-proj-minor';
  } else if (type === 'dept') {
    majorKey = document.getElementById('bulk-input-dept-major')?.value;
    dataMap = DEPTS_DATA;
    minorSelectId = 'bulk-input-dept-minor';
  }

  const minorEl = document.getElementById(minorSelectId);
  if (!minorEl || !dataMap || !dataMap[majorKey]) return;

  minorEl.innerHTML = dataMap[majorKey].items.map(item => `<option value="${item}">${item}</option>`).join('');
}

function executeBulkApply() {
  const fieldKey = document.getElementById('bulk-edit-field-select')?.value;
  if (!fieldKey || state.selectedTableItemIds.size === 0) return;

  const targetIds = Array.from(state.selectedTableItemIds);
  let serialIndex = 1;

  targetIds.forEach(id => {
    const habit = state.habits.find(h => String(h.id) === id);
    const task = state.tasks.find(t => String(t.id) === id);

    if (fieldKey === 'section') {
      const val = document.getElementById('bulk-input-section')?.value;
      if (habit) habit.section = val;
      if (task) task.section = val;
    } else if (fieldKey === 'duration') {
      const val = Number(document.getElementById('bulk-input-duration')?.value) || 25;
      if (habit) habit.targetMin = val;
      if (task) task.estMin = val;
    } else if (fieldKey === 'domain') {
      const maj = document.getElementById('bulk-input-domain-major')?.value || '';
      const min = document.getElementById('bulk-input-domain-minor')?.value || '';
      if (habit) { habit.domainMajor = maj; habit.domainMinor = min; habit.domain = min || maj; }
      if (task) { task.domainMajor = maj; task.domainMinor = min; task.domain = min || maj; }
    } else if (fieldKey === 'proj') {
      const maj = document.getElementById('bulk-input-proj-major')?.value || '';
      const min = document.getElementById('bulk-input-proj-minor')?.value || '';
      if (habit) { habit.projMajor = maj; habit.projMinor = min; habit.proj = min || maj; }
      if (task) { task.projMajor = maj; task.projMinor = min; task.proj = min || maj; }
    } else if (fieldKey === 'dept') {
      const maj = document.getElementById('bulk-input-dept-major')?.value || '';
      const min = document.getElementById('bulk-input-dept-minor')?.value || '';
      if (habit) { habit.deptMajor = maj; habit.deptMinor = min; habit.dept = min || maj; }
      if (task) { task.deptMajor = maj; task.deptMinor = min; task.dept = min || maj; }
    } else if (fieldKey === 'tags') {
      const tagsRaw = document.getElementById('bulk-input-tags')?.value || '';
      const newTags = tagsRaw.split(',').map(s => s.trim()).filter(Boolean);
      const mode = document.querySelector('input[name="bulk-tags-mode"]:checked')?.value || 'append';

      if (habit) {
        habit.tags = mode === 'replace' ? newTags : Array.from(new Set([...(habit.tags || []), ...newTags]));
      }
      if (task) {
        task.tags = mode === 'replace' ? newTags : Array.from(new Set([...(task.tags || []), ...newTags]));
      }
    } else if (fieldKey === 'name') {
      const tpl = document.getElementById('bulk-input-name')?.value || '';
      if (tpl) {
        const finalName = tpl.includes('{n}') ? tpl.replace('{n}', serialIndex) : tpl;
        if (habit) habit.name = finalName;
        if (task) task.title = finalName;
        serialIndex++;
      }
    }
  });

  saveHabits();
  saveTasks();
  closeModal();
  clearTableSelection();
  renderApp();
  alert(`✅ 選択した ${targetIds.length} 件のアイテムを一括変更しました！`);
}

function applyBulkToggleDisabled(forceDisabled) {
  if (state.selectedTableItemIds.size === 0) return;
  const targetIds = Array.from(state.selectedTableItemIds);

  targetIds.forEach(id => {
    const habit = state.habits.find(h => String(h.id) === id);
    if (habit) habit.isDisabled = forceDisabled;

    const task = state.tasks.find(t => String(t.id) === id);
    if (task) task.isDisabled = forceDisabled;
  });

  saveHabits();
  saveTasks();
  clearTableSelection();
  renderApp();
}

function applyBulkDuplicate() {
  if (state.selectedTableItemIds.size === 0) return;
  const targetIds = Array.from(state.selectedTableItemIds);

  targetIds.forEach(id => {
    const originalHabit = state.habits.find(h => String(h.id) === id);
    if (originalHabit) {
      const copy = JSON.parse(JSON.stringify(originalHabit));
      copy.id = `H_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      copy.name = `${copy.name} (コピー)`;
      copy.createdAt = new Date().toISOString();
      copy.history = {};
      copy.executionLogs = [];
      state.habits.unshift(copy);
    }

    const originalTask = state.tasks.find(t => String(t.id) === id);
    if (originalTask) {
      const copy = JSON.parse(JSON.stringify(originalTask));
      copy.id = `T_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      copy.title = `${copy.title} (コピー)`;
      copy.createdAt = new Date().toISOString();
      copy.history = [];
      copy.executionLogs = [];
      state.tasks.unshift(copy);
    }
  });

  saveHabits();
  saveTasks();
  clearTableSelection();
  renderApp();
  alert(`✅ ${targetIds.length} 件のアイテムを複製しました！`);
}

function applyBulkDelete() {
  if (state.selectedTableItemIds.size === 0) return;
  const count = state.selectedTableItemIds.size;

  if (!confirm(`⚠️ 選択した ${count} 件のアイテムを一括削除しますか？\n（この操作は取り消せません）`)) {
    return;
  }

  const targetIds = state.selectedTableItemIds;
  state.habits = state.habits.filter(h => !targetIds.has(String(h.id)));
  state.tasks = state.tasks.filter(t => !targetIds.has(String(t.id)));

  saveHabits();
  saveTasks();
  clearTableSelection();
  renderApp();
  alert(`✅ ${count} 件のアイテムを削除しました。`);
}

// Bind subtab switch clicks
document.addEventListener('DOMContentLoaded', () => {
  const subtabs = document.querySelectorAll('.table-subtab');
  subtabs.forEach(tab => {
    tab.addEventListener('click', () => {
      state.masterSubtab = tab.dataset.subtab;
      clearTableSelection();
      renderTableView();
    });
  });
});

// =========================================================================
// 8. Analytics Scoreboard (Habits & Recurring Tasks Continuation Engine)
// =========================================================================

function getHabitCurrentStreak(habit) {
  if (!habit) return 0;

  const isDoneOnDate = (targetDateKey) => {
    if (!targetDateKey) return false;
    const targetNorm = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(targetDateKey) : targetDateKey;

    // 1. habit.history (オブジェクト形式)
    if (habit.history && typeof habit.history === 'object' && !Array.isArray(habit.history)) {
      const entry = habit.history[targetDateKey] || habit.history[targetNorm];
      if (entry === true) return true;
      if (typeof entry === 'object' && entry !== null) {
        if (entry.done || (entry.count && entry.count > 0) || entry.status === 'completed') return true;
      }
      for (const k of Object.keys(habit.history)) {
        const kNorm = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(k) : k;
        if (kNorm === targetNorm) {
          const val = habit.history[k];
          if (val === true) return true;
          if (typeof val === 'object' && val !== null) {
            if (val.done || (val.count && val.count > 0) || val.status === 'completed') return true;
          }
        }
      }
    }

    // 2. habit.history (配列形式)
    if (Array.isArray(habit.history)) {
      const found = habit.history.some(item => {
        if (typeof item === 'string') {
          const itemNorm = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(item) : item;
          return itemNorm === targetNorm;
        }
        if (typeof item === 'object' && item !== null) {
          const rawD = item.date || item.dateKey || item.completedAt;
          const dNorm = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(rawD) : rawD;
          return dNorm === targetNorm && (item.done || item.count > 0 || item.status === 'completed');
        }
        return false;
      });
      if (found) return true;
    }

    // 3. habit.executionLogs (実行タイムライン履歴)
    if (Array.isArray(habit.executionLogs)) {
      const foundLog = habit.executionLogs.some(log => {
        const rawD = log.dateKey || log.date;
        const dNorm = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(rawD) : rawD;
        if (dNorm === targetNorm) {
          return log.status === 'completed' || (log.count && log.count > 0) || !log.status;
        }
        if (log.completedAt) {
          const compNorm = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(log.completedAt) : null;
          if (compNorm === targetNorm) {
            return log.status === 'completed' || (log.count && log.count > 0) || !log.status;
          }
        }
        return false;
      });
      if (foundLog) return true;
    }

    return false;
  };

  let streak = 0;
  const todayKey = typeof getTodayKey === 'function' ? getTodayKey() : (typeof getDateKeyOffset === 'function' ? getDateKeyOffset(0) : '2026-08-27');
  const isTodayDone = isDoneOnDate(todayKey);

  let startOffset = isTodayDone ? 0 : 1;

  for (let i = startOffset; i < 365; i++) {
    const key = typeof getDateKeyOffset === 'function' ? getDateKeyOffset(i) : todayKey;
    if (isDoneOnDate(key)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function getTaskCurrentStreak(task) {
  if (!task || !Array.isArray(task.history) || task.history.length === 0) {
    return task.status === 'completed' ? 1 : 0;
  }
  const isDoneOnDate = (dateKey) => {
    const targetNorm = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(dateKey) : dateKey;
    return task.history.some(h => {
      if (typeof h === 'object' && h !== null) {
        const rawD = h.date || h.dateKey;
        const dNorm = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(rawD) : rawD;
        return dNorm === targetNorm;
      }
      return false;
    });
  };

  let streak = 0;
  const todayKey = typeof getTodayKey === 'function' ? getTodayKey() : (typeof getDateKeyOffset === 'function' ? getDateKeyOffset(0) : '2026-08-27');
  const isTodayDone = isDoneOnDate(todayKey);

  let startOffset = isTodayDone ? 0 : 1;

  for (let i = startOffset; i < 365; i++) {
    const key = typeof getDateKeyOffset === 'function' ? getDateKeyOffset(i) : todayKey;
    if (isDoneOnDate(key)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

function getTaskPeriodRate(task, days) {
  if (!task) return 0;
  if (!Array.isArray(task.history) || task.history.length === 0) {
    return task.status === 'completed' ? 100 : 0;
  }
  let completedDays = 0;
  for (let i = 0; i < days; i++) {
    const key = typeof getDateKeyOffset === 'function' ? getDateKeyOffset(i) : null;
    const targetNorm = key && (typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(key) : key);
    if (targetNorm && task.history.some(h => {
      if (typeof h === 'object' && h !== null) {
        const rawD = h.date || h.dateKey;
        return (typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(rawD) : rawD) === targetNorm;
      }
      return false;
    })) {
      completedDays++;
    }
  }
  return Math.min(100, Math.round((completedDays / days) * 100));
}

  function toggleAnalyticsVisualMode() {
    if (!state.analyticsVisualMode) {
      state.analyticsVisualMode = localStorage.getItem('gendrive_analytics_visual_mode') || 'bar';
    }
    state.analyticsVisualMode = (state.analyticsVisualMode === 'smiley') ? 'bar' : 'smiley';
    localStorage.setItem('gendrive_analytics_visual_mode', state.analyticsVisualMode);
    renderTableAnalyticsView();
    if (typeof showUndoToast === 'function') {
      showUndoToast(state.analyticsVisualMode === 'smiley' ? '😊 達成度表示: ニコちゃんマークモード [V]' : '📊 達成度表示: 棒グラフモード [V]', true);
    }
  }

  function renderTableAnalyticsView() {
    const container = document.getElementById('analytics-scoreboard-container');
    const kpiContainer = document.getElementById('analytics-kpi-row');
    const countEl = document.getElementById('table-analytics-count');
    if (!container) return;

    if (!state.analyticsVisualMode) {
      state.analyticsVisualMode = localStorage.getItem('gendrive_analytics_visual_mode') || 'bar';
    }
    const visualMode = state.analyticsVisualMode;

    const toggleIconEl = document.getElementById('visual-mode-toggle-icon');
    const toggleTextEl = document.getElementById('visual-mode-toggle-text');
    if (toggleIconEl && toggleTextEl) {
      if (visualMode === 'smiley') {
        toggleIconEl.textContent = '😊';
        toggleTextEl.textContent = 'ニコちゃん';
      } else {
        toggleIconEl.textContent = '📊';
        toggleTextEl.textContent = '棒グラフ';
      }
    }

    const filterTypeEl = document.getElementById('analytics-filter-type');
    const sortSelectEl = document.getElementById('analytics-sort-select');
    const filterType = filterTypeEl ? filterTypeEl.value : 'all';
    const sortKey = sortSelectEl ? sortSelectEl.value : 'streak_desc';

    let rawHabits = state.habits || [];
    let rawTasks = (state.tasks || []).filter(isRecurringTaskItem);

    if (!state.showDisabledInTable) {
      rawHabits = rawHabits.filter(h => !h.isDisabled);
      rawTasks = rawTasks.filter(t => !t.isDisabled);
    }

    if (typeof matchesTagFilters === 'function') {
      rawHabits = rawHabits.filter(matchesTagFilters);
      rawTasks = rawTasks.filter(matchesTagFilters);
    }

    let items = [];

    if (filterType === 'all' || filterType === 'habits') {
      rawHabits.forEach(h => {
        try { recalculateHabitRates(h); } catch(e) {}

        const timingType = h.displayType || h.timingType || 'section';
        let timingStr = '';
        if (timingType === 'anytime') {
          timingStr = '🌐 いつでも';
        } else if (timingType === 'custom') {
          const timeSpan = [h.customStart, h.customEnd].filter(Boolean).join('〜');
          timingStr = timeSpan ? `⏰ ${timeSpan}` : '⏰ 時間指定';
        } else {
          timingStr = h.section ? `🗂️ ${h.section}` : '🗂️ セクション未設定';
        }

        items.push({
          id: h.id,
          name: h.name || '名称未設定',
          type: 'habit',
          typeLabel: '🌿 ハビット',
          domain: h.domain || h.domainMajor || '',
          dept: h.dept || h.deptMajor || '',
          timingStr: timingStr,
          obsidianUri: h.obsidianUri || '',
          streak: getHabitCurrentStreak(h),
          r3: typeof getHabitRate === 'function' ? getHabitRate(h, 3) : 0,
          r7: typeof getHabitRate === 'function' ? getHabitRate(h, 7) : 0,
          r30: typeof getHabitRate === 'function' ? getHabitRate(h, 30) : 0,
          r90: typeof getHabitRate === 'function' ? getHabitRate(h, 90) : 0,
          tags: typeof normalizeTags === 'function' ? normalizeTags(h.tags) : [],
          rawItem: h
        });
      });
    }

    if (filterType === 'all' || filterType === 'tasks') {
      rawTasks.forEach(t => {
        const timingType = t.timingType || (t.section ? 'section' : 'anytime');
        let timingStr = '';
        if (timingType === 'anytime') {
          timingStr = '🌐 いつでも';
        } else if (timingType === 'custom' || (t.customStart && t.customEnd)) {
          const timeSpan = [t.customStart, t.customEnd].filter(Boolean).join('〜');
          timingStr = timeSpan ? `⏰ ${timeSpan}` : '⏰ 時間指定';
        } else {
          timingStr = t.section ? `🗂️ ${t.section}` : '🗂️ セクション未設定';
        }

        items.push({
          id: t.id,
          name: t.title || '名称未設定',
          type: 'task',
          typeLabel: '🎯 定期タスク',
          domain: t.domain || t.domainMajor || '',
          dept: t.dept || t.deptMajor || '',
          timingStr: timingStr,
          obsidianUri: t.obsidianUri || '',
          streak: getTaskCurrentStreak(t),
          r3: getTaskPeriodRate(t, 3),
          r7: getTaskPeriodRate(t, 7),
          r30: getTaskPeriodRate(t, 30),
          r90: getTaskPeriodRate(t, 90),
          tags: typeof normalizeTags === 'function' ? normalizeTags(t.tags) : [],
          rawItem: t
        });
      });
    }

    items.sort((a, b) => {
      if (sortKey === 'streak_desc') return b.streak - a.streak || b.r7 - a.r7;
      if (sortKey === 'rate7_desc') return b.r7 - a.r7 || b.streak - a.streak;
      if (sortKey === 'rate30_desc') return b.r30 - a.r30 || b.r7 - a.r7;
      if (sortKey === 'rate90_desc') return b.r90 - a.r90 || b.r30 - a.r30;
      if (sortKey === 'rate7_asc') return a.r7 - b.r7 || a.streak - b.streak;
      if (sortKey === 'name_asc') return a.name.localeCompare(b.name, 'ja');
      return b.streak - a.streak;
    });

    if (countEl) countEl.textContent = `${items.length} 件`;

    const avgR7 = items.length > 0 ? Math.round(items.reduce((sum, item) => sum + item.r7, 0) / items.length) : 0;
    const maxStreakItem = items.length > 0 ? [...items].sort((a, b) => b.streak - a.streak)[0] : null;
    const excellentCount = items.filter(item => item.r7 >= 80).length;
    const attentionCount = items.filter(item => item.r7 < 50).length;

    if (kpiContainer) {
      kpiContainer.innerHTML = `
        <div class="analytics-kpi-card">
          <div class="kpi-icon">📊</div>
          <div class="kpi-content">
            <div class="kpi-label">全体平均 7日達成率</div>
            <div class="kpi-value ${avgR7 >= 80 ? 'text-emerald' : avgR7 >= 50 ? 'text-cyan' : 'text-amber'}">${avgR7}%</div>
          </div>
        </div>
        <div class="analytics-kpi-card">
          <div class="kpi-icon">🔥</div>
          <div class="kpi-content">
            <div class="kpi-label">最高ストリーク（連続日数）</div>
            <div class="kpi-value text-orange">${maxStreakItem && maxStreakItem.streak > 0 ? `${maxStreakItem.streak} 日連続` : '0 日'}</div>
            <div class="kpi-sub" title="${maxStreakItem ? maxStreakItem.name : ''}">${maxStreakItem && maxStreakItem.streak > 0 ? maxStreakItem.name : '今日から開始'}</div>
          </div>
        </div>
        <div class="analytics-kpi-card">
          <div class="kpi-icon">💎</div>
          <div class="kpi-content">
            <div class="kpi-label">絶好調 (80%超)</div>
            <div class="kpi-value text-emerald">${excellentCount} <span class="kpi-unit">/ ${items.length}件</span></div>
          </div>
        </div>
        <div class="analytics-kpi-card">
          <div class="kpi-icon">⚠️</div>
          <div class="kpi-content">
            <div class="kpi-label">要テコ入れ (50%未満)</div>
            <div class="kpi-value ${attentionCount > 0 ? 'text-rose' : 'text-muted'}">${attentionCount} <span class="kpi-unit">件</span></div>
          </div>
        </div>
      `;
    }

    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px; text-align: center; color: var(--text-dim);">
          <p style="font-size: 16px; margin-bottom: 8px;">該当する習慣・定期タスクがありません</p>
          <p style="font-size: 12px;">フィルター条件を変更するか、新しい習慣を登録してください。</p>
        </div>
      `;
      return;
    }

    const renderRateDisplay = (rate) => {
      let colorName = 'emerald';
      if (rate < 40) colorName = 'rose';
      else if (rate < 65) colorName = 'amber';
      else if (rate < 80) colorName = 'cyan';

      if (visualMode === 'smiley') {
        return `
          <div class="analytics-rate-cell mode-smiley">
            <span class="score-rate-number">${rate}%</span>
            <div class="score-smiley-badge smile-${colorName}" title="達成率 ${rate}%">
              <svg class="smiley-svg" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14s1.5 2.2 4 2.2 4-2.2 4-2.2"></path>
                <circle cx="9" cy="9" r="1.5" fill="currentColor"></circle>
                <circle cx="15" cy="9" r="1.5" fill="currentColor"></circle>
              </svg>
            </div>
          </div>
        `;
      }

      return `
        <div class="analytics-rate-cell mode-bar">
          <span class="score-rate-number">${rate}%</span>
          <div class="score-progress-track">
            <div class="score-progress-fill bar-${colorName}" style="width: ${rate}%;"></div>
          </div>
        </div>
      `;
    };

    const getStatusBadge = (r7, streak) => {
      if (streak >= 7 && r7 >= 80) {
        return '<span class="analytics-status-badge badge-super">🔥 絶好調</span>';
      } else if (r7 >= 70) {
        return '<span class="analytics-status-badge badge-good">🌿 安定</span>';
      } else if (r7 >= 40) {
        return '<span class="analytics-status-badge badge-neutral">🌱 成長中</span>';
      } else {
        return '<span class="analytics-status-badge badge-danger">⚠️ 要テコ入れ</span>';
      }
    };

    const rowsHtml = items.map((item, idx) => {
      const isHabit = item.type === 'habit';
      const clickDetail = isHabit
        ? `openEditModal('${item.id}')`
        : `openEditTaskModal('${item.id}')`;

      return `
        <div class="analytics-score-row">
          <div class="col-ana-num">${idx + 1}</div>
          <div class="col-ana-name">
            <div class="ana-name-main">
              <span class="ana-type-icon">${isHabit ? '🌿' : '🎯'}</span>
              <span class="ana-title-text" onclick="${clickDetail}" title="クリックして詳細・履歴モーダルを開く">${item.name}</span>
              ${item.timingStr ? `<span class="ana-timing-sub" title="やる時間: ${item.timingStr}">${item.timingStr}</span>` : ''}
            </div>
            <div class="ana-meta-tags">
              ${item.domain ? `<span class="ana-meta-badge domain">🌐 ${item.domain}</span>` : ''}
              ${item.dept ? `<span class="ana-meta-badge dept">🏢 ${item.dept}</span>` : ''}
              ${item.tags.slice(0, 3).map(t => `<span class="ana-meta-badge tag">#${t}</span>`).join('')}
            </div>
          </div>
          <div class="col-ana-streak">
            ${item.streak > 0 ? `<span class="streak-flame-pill">🔥 <b>${item.streak}</b> 日連続</span>` : '<span class="text-dim">-</span>'}
          </div>
          <div class="col-ana-rate">${renderRateDisplay(item.r3)}</div>
          <div class="col-ana-rate">${renderRateDisplay(item.r7)}</div>
          <div class="col-ana-rate">${renderRateDisplay(item.r30)}</div>
          <div class="col-ana-rate">${renderRateDisplay(item.r90)}</div>
          <div class="col-ana-status">${getStatusBadge(item.r7, item.streak)}</div>
          <div class="col-ana-actions" style="display: flex; gap: 4px; align-items: center; justify-content: center;">
            <button type="button" 
                    class="btn-cell-obsidian ${item.obsidianUri ? 'active' : 'disabled'}"
                    onclick="${item.obsidianUri ? `openObsidianLink('${item.obsidianUri.replace(/'/g, "\\'")}', event)` : clickDetail}"
                    title="${item.obsidianUri ? 'Obsidianノートを開く: ' + item.obsidianUri : 'Obsidianリンク未設定（クリックして設定）'}">
              <svg class="obsidian-svg-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5L18 8l-6 3.5L6 8l6-3.5zm-6.5 5.5l5.5 3.2v6.8L5.5 16V10zm13 6l-5.5 3.5v-6.8l5.5-3.2v6.5z"/>
              </svg>
            </button>
            <button type="button" class="btn-cell-icon" onclick="${clickDetail}" title="詳細・履歴モーダルを開く">⚙️</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="analytics-score-table">
        <div class="analytics-score-head">
          <div class="col-ana-num">No.</div>
          <div class="col-ana-name">🌿 習慣・定期タスク名 / 分類</div>
          <div class="col-ana-streak">🔥 連続日数</div>
          <div class="col-ana-rate">⚡ 3日達成度</div>
          <div class="col-ana-rate">📅 7日(週)達成度</div>
          <div class="col-ana-rate">🌕 30日(月)達成度</div>
          <div class="col-ana-rate">🏆 90日達成度</div>
          <div class="col-ana-status">状態評価</div>
          <div class="col-ana-actions">操作</div>
        </div>
        <div class="analytics-score-body">
          ${rowsHtml}
        </div>
      </div>
    `;

    setTimeout(() => {
      initMasterScrollScale();
    }, 30);
  }
