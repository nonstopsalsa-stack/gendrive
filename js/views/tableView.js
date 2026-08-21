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
      // 順序未指定時は配列本来の並び順（ドラッグ順）を維持
      return 0;
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
// 3. Render Table Views (Habits, Recurring Tasks, Single Tasks)
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

function renderTableView() {
  if (typeof state === 'undefined' || !state) return;
  if (!state.selectedTableItemIds) state.selectedTableItemIds = new Set();
  if (typeof state.showDisabledInTable === 'undefined') state.showDisabledInTable = false;

  const habitsView = document.getElementById('master-habits-view');
  const tasksView = document.getElementById('master-tasks-view');
  const singleTasksView = document.getElementById('master-single-tasks-view');

  const subtabHabits = document.getElementById('subtab-habits');
  const subtabTasks = document.getElementById('subtab-tasks');
  const subtabSingleTasks = document.getElementById('subtab-single-tasks');

  // Recalculate stats
  try {
    if (Array.isArray(state.habits)) {
      state.habits.forEach(h => {
        try { recalculateHabitRates(h); } catch(err) { console.warn('Rate calc error:', err); }
      });
    }
  } catch(e) {}

  const curSubtab = state.masterSubtab || 'habits';

  // Toggle subviews
  if (habitsView) habitsView.classList.toggle('hidden', curSubtab !== 'habits');
  if (tasksView) tasksView.classList.toggle('hidden', curSubtab !== 'tasks' && curSubtab !== 'recurring_tasks');
  if (singleTasksView) singleTasksView.classList.toggle('hidden', curSubtab !== 'single_tasks');

  // Toggle subtab buttons
  if (subtabHabits) subtabHabits.classList.toggle('active', curSubtab === 'habits');
  if (subtabTasks) subtabTasks.classList.toggle('active', curSubtab === 'tasks' || curSubtab === 'recurring_tasks');
  if (subtabSingleTasks) subtabSingleTasks.classList.toggle('active', curSubtab === 'single_tasks');

  updateBulkActionBar();

  // -----------------------------------------------------------------------
  // 1. Habits Master Table
  // -----------------------------------------------------------------------
  if (curSubtab === 'habits') {
    const container = document.getElementById('habit-table-body');
    let allHabits = state.habits;
    if (!state.showDisabledInTable) {
      allHabits = allHabits.filter(h => !h.isDisabled);
    }
    const sorted = sortHabits(allHabits, state.tableSort?.key || 'default', state.tableSort?.order || 'asc');

    const totalCountEl = document.getElementById('table-total-count');
    if (totalCountEl) totalCountEl.textContent = `${sorted.length} 件`;

    if (sorted.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-dim);"><p>該当するハビットがありません</p></div>`;
      return;
    }

    const allSelected = sorted.length > 0 && sorted.every(h => state.selectedTableItemIds.has(String(h.id)));

    // Header with Select All
    const headEl = document.querySelector('#master-habits-view .habit-table-head');
    if (headEl) {
      headEl.innerHTML = `
        <div class="col-head col-select" style="width: 36px; text-align: center;">
          <input type="checkbox" ${allSelected ? 'checked' : ''} onchange="toggleTableSelectAll(this.checked)" title="全選択 / 全解除">
        </div>
        <div class="col-head col-drag" style="width: 28px;">⠿</div>
        <div class="col-head col-num">No.</div>
        <div class="col-head col-disabled" style="width: 44px;" title="無効/休止フラグ">無効</div>
        <div class="col-head col-name">ハビット名</div>
        <div class="col-head col-domain">ドメイン</div>
        <div class="col-head col-proj">プロジェクト</div>
        <div class="col-head col-dept">部門</div>
        <div class="col-head col-rec">定期</div>
        <div class="col-head col-timing">タイミング</div>
        <div class="col-head col-min">目安</div>
        <div class="col-head col-stats">達成度 (7d/30d)</div>
        <div class="col-head col-actions" style="width: 70px; text-align: center;">操作</div>
      `;
    }

    container.innerHTML = sorted.map((habit, index) => {
      const isSelected = state.selectedTableItemIds.has(String(habit.id));
      const isDisabled = !!habit.isDisabled;

      let timingStr = '🌐 終日';
      if (habit.displayType === 'section') {
        timingStr = habit.section ? `⏱️ ${habit.section}` : '未定';
      } else if (habit.displayType === 'custom') {
        timingStr = `⏰ ${habit.customStart || '--'}~${habit.customEnd || '--'}`;
      }

      const rate7 = getHabitRate(habit, 7);
      const rate30 = getHabitRate(habit, 30);

      return `
        <div class="habit-row-grid ${isSelected ? 'row-selected' : ''} ${isDisabled ? 'row-disabled' : ''}"
             data-id="${habit.id}"
             draggable="true"
             ondragstart="handleTableDragStart(event, '${habit.id}', 'habit')"
             ondragover="handleTableDragOver(event)"
             ondrop="handleTableDrop(event, '${habit.id}', 'habit')">
          <div class="cell col-select" style="text-align: center;">
            <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleTableSelectItem('${habit.id}', this.checked, event)">
          </div>
          <div class="cell col-drag" style="cursor: grab;" title="ドラッグして並び替え">⠿</div>
          <div class="cell col-num">${index + 1}</div>
          <div class="cell col-disabled" style="text-align: center;" title="クリックで無効/有効切替">
            <input type="checkbox" ${isDisabled ? 'checked' : ''} onchange="toggleItemDisabledInline('${habit.id}', 'habit', event)">
          </div>
          <div class="cell col-name" onclick="openEditModal('${habit.id}')" title="クリックして編集">
            <b class="item-title-text">${habit.name}</b>
          </div>
          <div class="cell col-domain"><span class="row-tag domain">${habit.domain || habit.domainMajor || '-'}</span></div>
          <div class="cell col-proj"><span class="row-tag proj">${habit.proj || habit.projMajor || '-'}</span></div>
          <div class="cell col-dept"><span class="row-tag dept">${habit.dept || habit.deptMajor || '-'}</span></div>
          <div class="cell col-rec">${getRecurrenceBadgeHtml(habit)}</div>
          <div class="cell col-timing">${timingStr}</div>
          <div class="cell col-min">⏱️ ${habit.targetMin || 5}分</div>
          <div class="cell col-stats">
            <span class="rate-badge ${rate7 >= 80 ? 'high' : (rate7 >= 50 ? 'mid' : 'low')}">${rate7}% (7d)</span>
            <span class="rate-badge ${rate30 >= 80 ? 'high' : (rate30 >= 50 ? 'mid' : 'low')}">${rate30}% (30d)</span>
          </div>
          <div class="cell col-actions" style="display: flex; gap: 4px; justify-content: center;">
            <button type="button" class="btn-cell-icon" onclick="duplicateSingleItem('${habit.id}', 'habit', event)" title="複製">📋</button>
            <button type="button" class="btn-cell-icon danger" onclick="deleteSingleItem('${habit.id}', 'habit', event)" title="削除">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  }

function isRecurringTaskItem(t) {
  if (!t) return false;
  return t.taskType === 'recurring' || t.type === 'recurring' || Boolean(t.recType) || (Boolean(t.recurrence) && t.recurrence.type && t.recurrence.type !== 'none');
}

function switchMasterSubtab(subtab) {
  state.masterSubtab = subtab;
  clearTableSelection();
  renderTableView();
}

  // -----------------------------------------------------------------------
  // 2. Recurring Tasks Master Table
  // -----------------------------------------------------------------------
  if (curSubtab === 'tasks' || curSubtab === 'recurring_tasks') {
    const container = document.getElementById('recurring-task-table-body');
    let recTasks = state.tasks.filter(t => isRecurringTaskItem(t));
    if (!state.showDisabledInTable) {
      recTasks = recTasks.filter(t => !t.isDisabled);
    }

    const countEl = document.getElementById('table-recurring-tasks-count');
    if (countEl) countEl.textContent = `${recTasks.length} 件`;

    if (recTasks.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-dim);"><p>定期タスクがありません</p></div>`;
      return;
    }

    const allSelected = recTasks.length > 0 && recTasks.every(t => state.selectedTableItemIds.has(String(t.id)));

    const headEl = document.querySelector('#master-tasks-view .task-table-head');
    if (headEl) {
      headEl.innerHTML = `
        <div class="col-head col-select" style="text-align: center;">
          <input type="checkbox" ${allSelected ? 'checked' : ''} onchange="toggleTableSelectAll(this.checked)" title="全選択 / 全解除">
        </div>
        <div class="col-head col-drag">⠿</div>
        <div class="col-head col-num">No.</div>
        <div class="col-head col-disabled">無効</div>
        <div class="col-head col-name">タスク名</div>
        <div class="col-head col-label">アイゼンハワー</div>
        <div class="col-head col-domain">ドメイン / PJ</div>
        <div class="col-head col-rec">配信定期</div>
        <div class="col-head col-timing">セクション / 時間</div>
        <div class="col-head col-min">見積</div>
        <div class="col-head col-actions" style="text-align: center;">操作</div>
      `;
    }

    container.innerHTML = recTasks.map((task, index) => {
      try {
        const isSelected = state.selectedTableItemIds.has(String(task.id));
        const isDisabled = !!task.isDisabled;

        let timingStr = task.section ? `⏱️ ${task.section}` : '未定';
        if (task.timingType === 'custom') {
          timingStr = `⏰ ${task.customStart || '--'}~${task.customEnd || '--'}`;
        }

        const labelHtml = typeof getEisenhowerBadgeHtml === 'function' ? getEisenhowerBadgeHtml(task.label) : '';
        const recBadgeHtml = typeof getRecurrenceBadgeHtml === 'function' ? getRecurrenceBadgeHtml(task) : '';

        return `
          <div class="habit-row-grid task-row ${isSelected ? 'row-selected' : ''} ${isDisabled ? 'row-disabled' : ''}"
               data-id="${task.id}"
               draggable="true"
               ondragstart="handleTableDragStart(event, '${task.id}', 'task')"
               ondragover="handleTableDragOver(event)"
               ondrop="handleTableDrop(event, '${task.id}', 'task')">
            <div class="cell col-select" style="text-align: center;">
              <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleTableSelectItem('${task.id}', this.checked, event)">
            </div>
            <div class="cell col-drag" style="cursor: grab;" title="ドラッグして並び替え">⠿</div>
            <div class="cell col-num">${index + 1}</div>
            <div class="cell col-disabled" style="text-align: center;">
              <input type="checkbox" ${isDisabled ? 'checked' : ''} onchange="toggleItemDisabledInline('${task.id}', 'task', event)">
            </div>
            <div class="cell col-name" onclick="openEditTaskModal('${task.id}')" title="クリックして編集">
              <b class="item-title-text">${task.title || '(無題)'}</b>
            </div>
            <div class="cell col-label">${labelHtml}</div>
            <div class="cell col-domain">
              <span class="row-tag domain">${task.domainMajor || task.domain || '-'}</span>
              ${task.projMajor || task.proj ? `<span class="row-tag proj">${task.projMajor || task.proj}</span>` : ''}
            </div>
            <div class="cell col-rec">${recBadgeHtml}</div>
            <div class="cell col-timing">${timingStr}</div>
            <div class="cell col-min">⏱️ ${task.estMin || 15}分</div>
            <div class="cell col-actions" style="display: flex; gap: 4px; justify-content: center;">
              <button type="button" class="btn-cell-icon" onclick="duplicateSingleItem('${task.id}', 'task', event)" title="複製">📋</button>
              <button type="button" class="btn-cell-icon danger" onclick="deleteSingleItem('${task.id}', 'task', event)" title="削除">🗑️</button>
            </div>
          </div>
        `;
      } catch(e) {
        console.error('Row render error:', e);
        return '';
      }
    }).join('');
  }

  // -----------------------------------------------------------------------
  // 3. Single Tasks Master Table
  // -----------------------------------------------------------------------
  if (curSubtab === 'single_tasks') {
    const container = document.getElementById('single-task-table-body');
    let singleTasks = state.tasks.filter(t => !isRecurringTaskItem(t));
    if (!state.showDisabledInTable) {
      singleTasks = singleTasks.filter(t => !t.isDisabled);
    }
    const sorted = sortSingleTasks(singleTasks);

    const countEl = document.getElementById('table-single-tasks-count');
    if (countEl) countEl.textContent = `${sorted.length} 件`;

    if (sorted.length === 0) {
      container.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-dim);"><p>単発タスクがありません</p></div>`;
      return;
    }

    const allSelected = sorted.length > 0 && sorted.every(t => state.selectedTableItemIds.has(String(t.id)));

    const headEl = document.querySelector('#master-single-tasks-view .single-task-table-head');
    if (headEl) {
      headEl.innerHTML = `
        <div class="col-head col-select" style="text-align: center;">
          <input type="checkbox" ${allSelected ? 'checked' : ''} onchange="toggleTableSelectAll(this.checked)" title="全選択 / 全解除">
        </div>
        <div class="col-head col-drag">⠿</div>
        <div class="col-head col-date">予定日 / 完了日</div>
        <div class="col-head col-num">No.</div>
        <div class="col-head col-disabled">無効</div>
        <div class="col-head col-name">タスク名</div>
        <div class="col-head col-label">アイゼンハワー</div>
        <div class="col-head col-domain">ドメイン / PJ</div>
        <div class="col-head col-timing">セクション</div>
        <div class="col-head col-min">見積/実績</div>
        <div class="col-head col-status">状態</div>
        <div class="col-head col-actions" style="text-align: center;">操作</div>
      `;
    }

    container.innerHTML = sorted.map((task, index) => {
      try {
        const isSelected = state.selectedTableItemIds.has(String(task.id));
        const isDisabled = !!task.isDisabled;
        const isCompleted = task.status === 'completed';
        const labelHtml = typeof getEisenhowerBadgeHtml === 'function' ? getEisenhowerBadgeHtml(task.label) : '';

        return `
          <div class="habit-row-grid single-task-row ${isSelected ? 'row-selected' : ''} ${isDisabled ? 'row-disabled' : ''} ${isCompleted ? 'row-completed' : ''}"
               data-id="${task.id}"
               draggable="true"
               ondragstart="handleTableDragStart(event, '${task.id}', 'task')"
               ondragover="handleTableDragOver(event)"
               ondrop="handleTableDrop(event, '${task.id}', 'task')">
            <div class="cell col-select" style="text-align: center;">
              <input type="checkbox" ${isSelected ? 'checked' : ''} onchange="toggleTableSelectItem('${task.id}', this.checked, event)">
            </div>
            <div class="cell col-drag" style="cursor: grab;" title="ドラッグして並び替え">⠿</div>
            <div class="cell col-date">${getSingleTaskDateBadge(task)}</div>
            <div class="cell col-num">${index + 1}</div>
            <div class="cell col-disabled" style="text-align: center;">
              <input type="checkbox" ${isDisabled ? 'checked' : ''} onchange="toggleItemDisabledInline('${task.id}', 'task', event)">
            </div>
            <div class="cell col-name" onclick="openEditTaskModal('${task.id}')" title="クリックして編集">
              <b class="item-title-text">${task.title || '(無題)'}</b>
            </div>
            <div class="cell col-label">${labelHtml}</div>
            <div class="cell col-domain">
              <span class="row-tag domain">${task.domainMajor || task.domain || '-'}</span>
              ${task.projMajor || task.proj ? `<span class="row-tag proj">${task.projMajor || task.proj}</span>` : ''}
            </div>
            <div class="cell col-timing">${task.section || '未設定'}</div>
            <div class="cell col-min">⏱️ ${task.estMin || 15}分 ${task.actMin ? `(${task.actMin}分)` : ''}</div>
            <div class="cell col-status">
              <span class="status-pill ${task.status || 'uncompleted'}">${task.status === 'completed' ? '✓ 完了' : '未完了'}</span>
            </div>
            <div class="cell col-actions" style="display: flex; gap: 4px; justify-content: center;">
              <button type="button" class="btn-cell-icon" onclick="duplicateSingleItem('${task.id}', 'task', event)" title="複製">📋</button>
              <button type="button" class="btn-cell-icon danger" onclick="deleteSingleItem('${task.id}', 'task', event)" title="削除">🗑️</button>
            </div>
          </div>
        `;
      } catch(e) {
        console.error('Single task row render error:', e);
        return '';
      }
    }).join('');
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
    const list = [...state.habits];
    const fromIdx = list.findIndex(h => String(h.id) === sourceId);
    const toIdx = list.findIndex(h => String(h.id) === tId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
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
