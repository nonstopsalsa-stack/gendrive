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
    const container = document.getElementById('habit-table-body');
    const headContainer = document.getElementById('habits-table-head');
    let allHabits = state.habits || [];
    if (!state.showDisabledInTable) {
      allHabits = allHabits.filter(h => !h.isDisabled);
    }
        if (typeof matchesTagFilters === 'function' && state.filters && ((state.filters.includeTags && state.filters.includeTags.length > 0) || (state.filters.excludeTags && state.filters.excludeTags.length > 0))) {
      allHabits = allHabits.filter(matchesTagFilters);
    }
    const sorted = sortHabits(allHabits, state.tableSort?.key || 'default', state.tableSort?.order || 'asc');

    const totalCountEl = document.getElementById('table-total-count');
    if (totalCountEl) totalCountEl.textContent = `${sorted.length} \u4EF6`;

    const allSelected = sorted.length > 0 && sorted.every(h => state.selectedTableItemIds.has(String(h.id)));

    if (headContainer) {
      headContainer.innerHTML = `
        <div class="master-sticky-left-panel">
          <div class="col-sub-select">
            <input type="checkbox" ${allSelected ? 'checked' : ''} onchange="toggleTableSelectAll(this.checked)" title="\u5168\u9078\u629E / \u5168\u89E3\u9664">
          </div>
          <div class="col-sub-drag">\u2807</div>
          <div class="col-sub-num">No.</div>
          <div class="col-sub-disabled" title="\u7121\u52B9\u531F\u30D5\u30E9\u30B0">\uD83D\uDEAB</div>
          <div class="col-sub-name">\uD83C\uDF3F \u30CF\u30D3\u30C3\u30C8\u540D (\u76F4\u63A5\u7DE8\u96C6\u30FB\u8A73\u7D30\u2699\uFE0F)</div>
        </div>
        <div class="master-scrollable-right-cells">
          <div class="col-head col-grid-period">\uD83D\uDCC5 \u671F\u9593 (\u958B\u59CB\uFF5E\u7D42\u4E86)</div>
          <div class="col-head col-grid-domain">\uD83C\uDF10 \u30C9\u30E1\u30A4\u30F3 (\u5927\u5206\u985E / \u8A73\u7D30)</div>
          <div class="col-head col-grid-dept">\uD83C\uDFE2 \u90E8\u9580 (\u5927\u5206\u985E / \u8A73\u7D30)</div>
          <div class="col-head col-grid-proj">\uD83D\uDCC1 \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8 (\u5927\u5206\u985E / \u8A73\u7D30)</div>
          <div class="col-head col-grid-timing">\u23F1 \u30BF\u30A4\u30DF\u30F3\u30B0 / \u30BB\u30AF\u30B7\u30E7\u30F3</div>
          <div class="col-head col-grid-min">\u23F3 \u76EE\u5B89\u5206</div>
          <div class="col-head col-grid-rec">\uD83D\uDD01 \u914D\u4FE1\u983B\u5EA6</div>
          <div class="col-head col-grid-matrix">\uD83C\uDFAF 6\u8EF8\u30DE\u30C8\u30EA\u30AF\u30B9 (\u91CD\u30FB\u6025\u30FB\u8133\u30FB\u4F53\u30FB\u86D9\u30FB\u5FC3 / \u30AF\u30EA\u30C3\u30AF\u5207\u66FF)</div>
          <div class="col-head col-grid-tags">\uD83C\uDFF7\uFE0F \u30BF\u30B0 (\u30AB\u30F3\u30DE\u533A\u5207\u308A)</div>
          <div class="col-head col-grid-notes">\uD83D\uDCDD \u898F\u5247\u30FB\u5099\u8003</div>
          <div class="col-head col-grid-obsidian">\uD83D\uDC8E Obsidian\u30CE\u30FC\u30C8</div>
          <div class="col-head col-grid-actions">\u64CD\u4F5C</div>
        </div>
      `;
    }

    if (sorted.length === 0) {
      if (container) container.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-dim);"><p>\u8A72\u5F53\u3059\u308B\u30CF\u30D3\u30C3\u30C8\u304C\u3042\u308A\u307E\u305B\u3093</p></div>`;
      return;
    }

    if (container) {
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
              <div class="col-sub-drag" title="\u30C9\u30E9\u30C3\u30B0\u3057\u3066\u4E26\u3073\u66FF\u3048">\u2807</div>
              <div class="col-sub-num">${index + 1}</div>
              <div class="col-sub-disabled" title="\u6709\u52B9/\u7121\u52B9\u5207\u66FF">
                <input type="checkbox" ${isDisabled ? 'checked' : ''} onchange="toggleItemDisabledInline('${habit.id}', 'habit', event)">
              </div>
              <div class="col-sub-name">
                <input type="text" class="table-name-input" value="${habit.name || ''}"
                       onblur="handleInlineFieldChange('${habit.id}', 'habit', 'name', this.value, event)"
                       onkeydown="if(event.key==='Enter'){this.blur();}"
                       title="\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u540D\u79F0\u3092\u76F4\u63A5\u7DE8\u96C6">
                <button type="button" class="btn-cell-icon" onclick="openEditModal('${habit.id}')" title="\u30CF\u30D3\u30C3\u30C8\u8A73\u7D30\u30E2\u30FC\u30C0\u30EB\u3092\u958B\u304F">\u2699\uFE0F</button>
              </div>
            </div>
            <div class="master-scrollable-right-cells">
              <div class="col-grid-period">
                <div style="display: flex; gap: 4px; align-items: center; width: 100%;">
                  <input type="date" class="table-inline-input" value="${habit.displayStart || ''}"
                         onchange="handleInlineFieldChange('${habit.id}', 'habit', 'displayStart', this.value, event)" title="\u958B\u59CB\u65E5">
                  <span style="color: var(--text-dim); font-size: 11px; flex-shrink: 0;">\uFF5E</span>
                  <input type="date" class="table-inline-input" value="${habit.displayEnd || ''}"
                         onchange="handleInlineFieldChange('${habit.id}', 'habit', 'displayEnd', this.value, event)" title="\u7D42\u4E86\u65E5">
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
                  <span style="color: var(--text-muted); font-size: 10px;">\u5206</span>
                </div>
              </div>
              ${buildInlineRecurrenceHtml(habit, 'habit')}
              ${buildInlineMatrixChipsHtml(habit, 'habit')}
              <div class="col-grid-tags">
                <input type="text" class="table-inline-input" placeholder="#\u30BF\u30B01, #\u30BF\u30B02" value="${tagsStr}"
                       onblur="handleInlineFieldChange('${habit.id}', 'habit', 'tags', this.value, event)"
                       onkeydown="if(event.key==='Enter'){this.blur();}">
              </div>
              <div class="col-grid-notes">
                <input type="text" class="table-inline-input" placeholder="\u898F\u5247\u30FB\u5099\u8003..." value="${habit.notes || ''}"
                       onblur="handleInlineFieldChange('${habit.id}', 'habit', 'notes', this.value, event)"
                       onkeydown="if(event.key==='Enter'){this.blur();}">
              </div>
              <div class="col-grid-obsidian">
                <div class="table-obsidian-cell">
                  <input type="text" class="table-inline-input" placeholder="Obsidian\u30EA\u30F3\u30AF..." value="${habit.obsidianUri || ''}"
                         onblur="handleInlineFieldChange('${habit.id}', 'habit', 'obsidianUri', this.value, event)"
                         onkeydown="if(event.key==='Enter'){this.blur();}"
                         title="Obsidian\u30CE\u30FC\u30C8\u30EA\u30F3\u30AF\u307E\u305F\u306F\u30D1\u30B9">
                  <button type="button" 
                          class="btn-cell-obsidian ${habit.obsidianUri ? 'active' : 'disabled'}"
                          onclick="${habit.obsidianUri ? `openObsidianLink('${habit.obsidianUri.replace(/'/g, "\\'")}', event)` : `openEditModal('${habit.id}')`}"
                          title="${habit.obsidianUri ? 'Obsidian\u3067\u958B\u304F: ' + habit.obsidianUri : '\u672A\u8A2D\u5B9A(\u30AF\u30EA\u30C3\u30AF\u3067\u8A2D\u5B9A)'}">
                    <svg class="obsidian-svg-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5L18 8l-6 3.5L6 8l6-3.5zm-6.5 5.5l5.5 3.2v6.8L5.5 16V10zm13 6l-5.5 3.5v-6.8l5.5-3.2v6.5z"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="col-grid-actions">
                <button type="button" class="btn-cell-icon" onclick="duplicateSingleItem('${habit.id}', 'habit', event)" title="\u8907\u88FD">\uD83D\uDCCB</button>
                <button type="button" class="btn-cell-icon danger" onclick="deleteSingleItem('${habit.id}', 'habit', event)" title="\u524A\u9664">\uD83D\uDDD1\uFE0F</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  if (curSubtab === 'tasks' || curSubtab === 'recurring_tasks') {
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
  if (!state.selectedTableItemIds) {
    state.selectedTableItemIds = new Set();
  } else {
    state.selectedTableItemIds.clear();
  }
  updateBulkActionBar();
}

function updateBulkActionBar() {
  if (!state.selectedTableItemIds) {
    state.selectedTableItemIds = new Set();
  }
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
    const container = document.getElementById('habit-table-body');
    const headContainer = document.getElementById('habits-table-head');
    let allHabits = state.habits || [];
    if (!state.showDisabledInTable) {
      allHabits = allHabits.filter(h => !h.isDisabled);
    }
        if (typeof matchesTagFilters === 'function' && state.filters && ((state.filters.includeTags && state.filters.includeTags.length > 0) || (state.filters.excludeTags && state.filters.excludeTags.length > 0))) {
      allHabits = allHabits.filter(matchesTagFilters);
    }
    const sorted = sortHabits(allHabits, state.tableSort?.key || 'default', state.tableSort?.order || 'asc');

    const totalCountEl = document.getElementById('table-total-count');
    if (totalCountEl) totalCountEl.textContent = `${sorted.length} \u4EF6`;

    const allSelected = sorted.length > 0 && sorted.every(h => state.selectedTableItemIds.has(String(h.id)));

    if (headContainer) {
      headContainer.innerHTML = `
        <div class="master-sticky-left-panel">
          <div class="col-sub-select">
            <input type="checkbox" ${allSelected ? 'checked' : ''} onchange="toggleTableSelectAll(this.checked)" title="\u5168\u9078\u629E / \u5168\u89E3\u9664">
          </div>
          <div class="col-sub-drag">\u2807</div>
          <div class="col-sub-num">No.</div>
          <div class="col-sub-disabled" title="\u7121\u52B9\u531F\u30D5\u30E9\u30B0">\uD83D\uDEAB</div>
          <div class="col-sub-name">\uD83C\uDF3F \u30CF\u30D3\u30C3\u30C8\u540D (\u76F4\u63A5\u7DE8\u96C6\u30FB\u8A73\u7D30\u2699\uFE0F)</div>
        </div>
        <div class="master-scrollable-right-cells">
          <div class="col-head col-grid-period">\uD83D\uDCC5 \u671F\u9593 (\u958B\u59CB\uFF5E\u7D42\u4E86)</div>
          <div class="col-head col-grid-domain">\uD83C\uDF10 \u30C9\u30E1\u30A4\u30F3 (\u5927\u5206\u985E / \u8A73\u7D30)</div>
          <div class="col-head col-grid-dept">\uD83C\uDFE2 \u90E8\u9580 (\u5927\u5206\u985E / \u8A73\u7D30)</div>
          <div class="col-head col-grid-proj">\uD83D\uDCC1 \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8 (\u5927\u5206\u985E / \u8A73\u7D30)</div>
          <div class="col-head col-grid-timing">\u23F1 \u30BF\u30A4\u30DF\u30F3\u30B0 / \u30BB\u30AF\u30B7\u30E7\u30F3</div>
          <div class="col-head col-grid-min">\u23F3 \u76EE\u5B89\u5206</div>
          <div class="col-head col-grid-rec">\uD83D\uDD01 \u914D\u4FE1\u983B\u5EA6</div>
          <div class="col-head col-grid-matrix">\uD83C\uDFAF 6\u8EF8\u30DE\u30C8\u30EA\u30AF\u30B9 (\u91CD\u30FB\u6025\u30FB\u8133\u30FB\u4F53\u30FB\u86D9\u30FB\u5FC3 / \u30AF\u30EA\u30C3\u30AF\u5207\u66FF)</div>
          <div class="col-head col-grid-tags">\uD83C\uDFF7\uFE0F \u30BF\u30B0 (\u30AB\u30F3\u30DE\u533A\u5207\u308A)</div>
          <div class="col-head col-grid-notes">\uD83D\uDCDD \u898F\u5247\u30FB\u5099\u8003</div>
          <div class="col-head col-grid-obsidian">\uD83D\uDC8E Obsidian\u30CE\u30FC\u30C8</div>
          <div class="col-head col-grid-actions">\u64CD\u4F5C</div>
        </div>
      `;
    }

    if (sorted.length === 0) {
      if (container) container.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-dim);"><p>\u8A72\u5F53\u3059\u308B\u30CF\u30D3\u30C3\u30C8\u304C\u3042\u308A\u307E\u305B\u3093</p></div>`;
      return;
    }

    if (container) {
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
              <div class="col-sub-drag" title="\u30C9\u30E9\u30C3\u30B0\u3057\u3066\u4E26\u3073\u66FF\u3048">\u2807</div>
              <div class="col-sub-num">${index + 1}</div>
              <div class="col-sub-disabled" title="\u6709\u52B9/\u7121\u52B9\u5207\u66FF">
                <input type="checkbox" ${isDisabled ? 'checked' : ''} onchange="toggleItemDisabledInline('${habit.id}', 'habit', event)">
              </div>
              <div class="col-sub-name">
                <input type="text" class="table-name-input" value="${habit.name || ''}"
                       onblur="handleInlineFieldChange('${habit.id}', 'habit', 'name', this.value, event)"
                       onkeydown="if(event.key==='Enter'){this.blur();}"
                       title="\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u540D\u79F0\u3092\u76F4\u63A5\u7DE8\u96C6">
                <button type="button" class="btn-cell-icon" onclick="openEditModal('${habit.id}')" title="\u30CF\u30D3\u30C3\u30C8\u8A73\u7D30\u30E2\u30FC\u30C0\u30EB\u3092\u958B\u304F">\u2699\uFE0F</button>
              </div>
            </div>
            <div class="master-scrollable-right-cells">
              <div class="col-grid-period">
                <div style="display: flex; gap: 4px; align-items: center; width: 100%;">
                  <input type="date" class="table-inline-input" value="${habit.displayStart || ''}"
                         onchange="handleInlineFieldChange('${habit.id}', 'habit', 'displayStart', this.value, event)" title="\u958B\u59CB\u65E5">
                  <span style="color: var(--text-dim); font-size: 11px; flex-shrink: 0;">\uFF5E</span>
                  <input type="date" class="table-inline-input" value="${habit.displayEnd || ''}"
                         onchange="handleInlineFieldChange('${habit.id}', 'habit', 'displayEnd', this.value, event)" title="\u7D42\u4E86\u65E5">
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
                  <span style="color: var(--text-muted); font-size: 10px;">\u5206</span>
                </div>
              </div>
              ${buildInlineRecurrenceHtml(habit, 'habit')}
              ${buildInlineMatrixChipsHtml(habit, 'habit')}
              <div class="col-grid-tags">
                <input type="text" class="table-inline-input" placeholder="#\u30BF\u30B01, #\u30BF\u30B02" value="${tagsStr}"
                       onblur="handleInlineFieldChange('${habit.id}', 'habit', 'tags', this.value, event)"
                       onkeydown="if(event.key==='Enter'){this.blur();}">
              </div>
              <div class="col-grid-notes">
                <input type="text" class="table-inline-input" placeholder="\u898F\u5247\u30FB\u5099\u8003..." value="${habit.notes || ''}"
                       onblur="handleInlineFieldChange('${habit.id}', 'habit', 'notes', this.value, event)"
                       onkeydown="if(event.key==='Enter'){this.blur();}">
              </div>
              <div class="col-grid-obsidian">
                <div class="table-obsidian-cell">
                  <input type="text" class="table-inline-input" placeholder="Obsidian\u30EA\u30F3\u30AF..." value="${habit.obsidianUri || ''}"
                         onblur="handleInlineFieldChange('${habit.id}', 'habit', 'obsidianUri', this.value, event)"
                         onkeydown="if(event.key==='Enter'){this.blur();}"
                         title="Obsidian\u30CE\u30FC\u30C8\u30EA\u30F3\u30AF\u307E\u305F\u306F\u30D1\u30B9">
                  <button type="button" 
                          class="btn-cell-obsidian ${habit.obsidianUri ? 'active' : 'disabled'}"
                          onclick="${habit.obsidianUri ? `openObsidianLink('${habit.obsidianUri.replace(/'/g, "\\'")}', event)` : `openEditModal('${habit.id}')`}"
                          title="${habit.obsidianUri ? 'Obsidian\u3067\u958B\u304F: ' + habit.obsidianUri : '\u672A\u8A2D\u5B9A(\u30AF\u30EA\u30C3\u30AF\u3067\u8A2D\u5B9A)'}">
                    <svg class="obsidian-svg-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5L18 8l-6 3.5L6 8l6-3.5zm-6.5 5.5l5.5 3.2v6.8L5.5 16V10zm13 6l-5.5 3.5v-6.8l5.5-3.2v6.5z"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="col-grid-actions">
                <button type="button" class="btn-cell-icon" onclick="duplicateSingleItem('${habit.id}', 'habit', event)" title="\u8907\u88FD">\uD83D\uDCCB</button>
                <button type="button" class="btn-cell-icon danger" onclick="deleteSingleItem('${habit.id}', 'habit', event)" title="\u524A\u9664">\uD83D\uDDD1\uFE0F</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  if (curSubtab === 'tasks' || curSubtab === 'recurring_tasks') {
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

  const domainsData = (typeof DOMAINS_DATA !== 'undefined' && DOMAINS_DATA) ? DOMAINS_DATA : {};
  const majorOptions = Object.keys(domainsData).map(k => `
    <option value="${k}" ${currentMajor === k ? 'selected' : ''}>${domainsData[k]?.name || k}</option>
  `).join('');

  const minorList = (domainsData[currentMajor] && domainsData[currentMajor].items) || [];
  const minorOptions = minorList.map(m => `
    <option value="${m}" ${currentMinor === m ? 'selected' : ''}>${m}</option>
  `).join('');

  return `
    <div class="col-grid-domain">
      <select class="table-inline-select" onchange="handleInlineCascadeChange('${item.id}', '${type}', 'domain', 'major', this.value)" title="\u30C9\u30E1\u30A4\u30F3\u5927\u5206\u985E">
        ${majorOptions}
      </select>
      <select class="table-inline-select" onchange="handleInlineCascadeChange('${item.id}', '${type}', 'domain', 'minor', this.value)" title="\u30C9\u30E1\u30A4\u30F3\u8A73\u7D30">
        <option value="">(\u8A73\u7D30\u672A\u9078\u629E)</option>
        ${minorOptions}
      </select>
    </div>
  `;
}

function buildInlineDeptHtml(item, type) {
  const currentMajor = item.deptMajor || 'CEO螳､';
  const currentMinor = item.deptMinor || item.dept || '';

  const deptsData = (typeof DEPTS_DATA !== 'undefined' && DEPTS_DATA) ? DEPTS_DATA : {};
  const majorOptions = Object.keys(deptsData).map(k => `
    <option value="${k}" ${currentMajor === k ? 'selected' : ''}>${deptsData[k]?.name || k}</option>
  `).join('');

  const minorList = (deptsData[currentMajor] && deptsData[currentMajor].items) || [];
  const minorOptions = minorList.map(m => `
    <option value="${m}" ${currentMinor === m ? 'selected' : ''}>${m}</option>
  `).join('');

  return `
    <div class="col-grid-dept">
      <select class="table-inline-select" onchange="handleInlineCascadeChange('${item.id}', '${type}', 'dept', 'major', this.value)" title="\u90E8\u9580\u5927\u5206\u985E">
        ${majorOptions}
      </select>
      <select class="table-inline-select" onchange="handleInlineCascadeChange('${item.id}', '${type}', 'dept', 'minor', this.value)" title="\u90E8\u9580\u8A73\u7D30">
        <option value="">(\u8A73\u7D30\u672A\u9078\u629E)</option>
        ${minorOptions}
      </select>
    </div>
  `;
}

function buildInlineProjHtml(item, type) {
  const currentMajor = item.projMajor || '繝薙ず繝阪せ';
  const currentMinor = item.projMinor || item.proj || '';

  const projsData = (typeof PROJECTS_DATA !== 'undefined' && PROJECTS_DATA) ? PROJECTS_DATA : {};
  const majorOptions = Object.keys(projsData).map(k => `
    <option value="${k}" ${currentMajor === k ? 'selected' : ''}>${projsData[k]?.name || k}</option>
  `).join('');

  const minorList = (projsData[currentMajor] && projsData[currentMajor].items) || [];
  const minorOptions = minorList.map(m => `
    <option value="${m}" ${currentMinor === m ? 'selected' : ''}>${m}</option>
  `).join('');

  return `
    <div class="col-grid-proj">
      <select class="table-inline-select" onchange="handleInlineCascadeChange('${item.id}', '${type}', 'proj', 'major', this.value)" title="\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u5927\u5206\u985E">
        ${majorOptions}
      </select>
      <select class="table-inline-select" onchange="handleInlineCascadeChange('${item.id}', '${type}', 'proj', 'minor', this.value)" title="\u30D7\u30ED\u30B8\u30A7\u30AF\u30C8\u8A73\u7D30">
        <option value="">(\u8A73\u7D30\u672A\u9078\u629E)</option>
        ${minorOptions}
      </select>
    </div>
  `;
}

function buildInlineTimingHtml(item, type) {
  const curSection = item.section || '隨ｬ2繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ';
  const curType = item.displayType || item.timingType || 'section';
  const start = item.customStart || '13:00';
  const end = item.customEnd || '17:00';

  const sectionsConfig = (typeof SECTIONS_CONFIG !== 'undefined' && Array.isArray(SECTIONS_CONFIG)) ? SECTIONS_CONFIG : [];
  const sectionOptions = sectionsConfig.map(s => `
    <option value="${s.name}" ${curSection === s.name && curType === 'section' ? 'selected' : ''}>\uD83D\uDCC2 ${s.name}</option>
  `).join('');

  return `
    <div class="col-grid-timing" style="display: flex; flex-direction: column; gap: 2px;">
      <select class="table-inline-select" onchange="handleInlineTimingChange('${item.id}', '${type}', this.value)" title="\u5B9F\u884C\u30BF\u30A4\u30DF\u30F3\u30B0">
        <option value="anytime" ${curType === 'anytime' ? 'selected' : ''}>\uD83C\uDF10 \u3044\u3064\u3067\u3082 (\u7121\u6307\u5B9A)</option>
        ${sectionOptions}
        <option value="custom" ${curType === 'custom' ? 'selected' : ''}>\u23F1 \u6642\u9593\u6307\u5B9A (${start}\uFF5E${end})</option>
      </select>
    </div>
  `;
}

function buildInlineRecurrenceHtml(item, type) {
  const recType = item.recType || (item.recurrence && item.recurrence.type) || 'everyday';
  return `
    <div class="col-grid-rec">
      <select class="table-inline-select" onchange="handleInlineFieldChange('${item.id}', '${type}', 'recType', this.value, event)" title="\u914D\u4FE1\u983B\u5EA6">
        <option value="everyday" ${recType === 'everyday' ? 'selected' : ''}>\uD83D\uDD01 \u6BCE\u65E5</option>
        <option value="weekdays" ${recType === 'weekdays' ? 'selected' : ''}>\uD83D\uDCBC \u5E73\u65E5(\u6708\uFF5E\u91D1)</option>
        <option value="weekends" ${recType === 'weekends' ? 'selected' : ''}>\uD83C\uDFD6\uFE0F \u4F11\u65E5(\u571F\u65E5)</option>
        <option value="custom_days" ${recType === 'custom_days' ? 'selected' : ''}>\uD83D\uDCC5 \u66DC\u65E5\u6307\u5B9A</option>
        <option value="weekly_goal" ${recType === 'weekly_goal' ? 'selected' : ''}>\uD83C\uDFAF \u9031X\u56DE</option>
        <option value="interval" ${recType === 'interval' ? 'selected' : ''}>\u23F3 N\u65E5\u304A\u304D</option>
        <option value="monthly" ${recType === 'monthly' ? 'selected' : ''}>\uD83D\uDCC6 \u6BCE\u6708</option>
        <option value="daily_times" ${recType === 'daily_times' ? 'selected' : ''}>\uD83D\uDD22 1\u65E5N\u56DE</option>
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
  const m = item.matrix || (typeof DEFAULT_MATRIX !== 'undefined' ? { ...DEFAULT_MATRIX } : { importance: 'mid', urgency: 'mid', mentalLoad: 'mid', physicalLoad: 'mid', frogLevel: 'mid', interestLevel: 'mid' });
  const axes = [
    { key: 'importance', label: '\u91CD', icon: '\uD83D\uDD11', title: '\u91CD\u8981\u5EA6' },
    { key: 'urgency', label: '\u6025', icon: '\u26A1', title: '\u7DCA\u6025\u5EA6' },
    { key: 'mentalLoad', label: '\u8133', icon: '\uD83E\uDDE0', title: '\u8133\u8CA0\u8377' },
    { key: 'physicalLoad', label: '\u4F53', icon: '\uD83D\uDCAA', title: '\u4F53\u529B\u8CA0\u8377' },
    { key: 'frogLevel', label: '\u86D9', icon: '\uD83D\uDC38', title: '\u30AB\u30A8\u30EB\u5EA6' },
    { key: 'interestLevel', label: '\u5FC3', icon: '\u2764\uFE0F', title: '\u597D\u30FB\u95A2\u5FC3' }
  ];

  return `
    <div class="col-grid-matrix">
      <div class="matrix-chips-group">
        ${axes.map(ax => {
          const val = m[ax.key] || 'mid';
          return `
            <div class="matrix-mini-chip val-${val}"
                 onclick="handleInlineMatrixCycle('${item.id}', '${type}', '${ax.key}', event)"
                 title="${ax.title}: ${val.toUpperCase()} (\u30AF\u30EA\u30C3\u30AF\u3067 Low \u2192 Mid \u2192 High \u2192 Most)">
              <span class="chip-axis-icon">${ax.icon}</span>
              <span class="chip-val-text">${val}</span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

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
        if (typeof matchesTagFilters === 'function' && state.filters && ((state.filters.includeTags && state.filters.includeTags.length > 0) || (state.filters.excludeTags && state.filters.excludeTags.length > 0))) {
      allHabits = allHabits.filter(matchesTagFilters);
    }
    const sorted = sortHabits(allHabits, state.tableSort?.key || 'default', state.tableSort?.order || 'asc');

    const totalCountEl = document.getElementById('table-total-count');
    if (totalCountEl) totalCountEl.textContent = `${sorted.length} \u4EF6`;

    const allSelected = sorted.length > 0 && sorted.every(h => state.selectedTableItemIds.has(String(h.id)));

    if (headContainer) {
      headContainer.innerHTML = `
        <div class="master-sticky-left-panel">
          <div class="col-sub-select">
            <input type="checkbox" ${allSelected ? 'checked' : ''} onchange="toggleTableSelectAll(this.checked)" title="\u5168\u9078\u629E / \u5168\u89E3\u9664">
          </div>
          <div class="col-sub-drag">\u2807</div>
          <div class="col-sub-num">No.</div>
          <div class="col-sub-disabled" title="\u7121\u52B9\u531F\u30D5\u30E9\u30B0">\uD83D\uDEAB</div>
          <div class="col-sub-name">\uD83C\uDF3F \u30CF\u30D3\u30C3\u30C8\u540D (\u76F4\u63A5\u7DE8\u96C6\u30FB\u8A73\u7D30\u2699\uFE0F)</div>
        </div>
        <div class="master-scrollable-right-cells">
          <div class="col-head col-grid-period">\uD83D\uDCC5 \u671F\u9593 (\u958B\u59CB\uFF5E\u7D42\u4E86)</div>
          <div class="col-head col-grid-domain">\uD83C\uDF10 \u30C9\u30E1\u30A4\u30F3 (\u5927\u5206\u985E / \u8A73\u7D30)</div>
          <div class="col-head col-grid-dept">\uD83C\uDFE2 \u90E8\u9580 (\u5927\u5206\u985E / \u8A73\u7D30)</div>
          <div class="col-head col-grid-proj">\uD83D\uDCC1 \u30D7\u30ED\u30B8\u30A7\u30AF\u30C8 (\u5927\u5206\u985E / \u8A73\u7D30)</div>
          <div class="col-head col-grid-timing">\u23F1 \u30BF\u30A4\u30DF\u30F3\u30B0 / \u30BB\u30AF\u30B7\u30E7\u30F3</div>
          <div class="col-head col-grid-min">\u23F3 \u76EE\u5B89\u5206</div>
          <div class="col-head col-grid-rec">\uD83D\uDD01 \u914D\u4FE1\u983B\u5EA6</div>
          <div class="col-head col-grid-matrix">\uD83C\uDFAF 6\u8EF8\u30DE\u30C8\u30EA\u30AF\u30B9 (\u91CD\u30FB\u6025\u30FB\u8133\u30FB\u4F53\u30FB\u86D9\u30FB\u5FC3 / \u30AF\u30EA\u30C3\u30AF\u5207\u66FF)</div>
          <div class="col-head col-grid-tags">\uD83C\uDFF7\uFE0F \u30BF\u30B0 (\u30AB\u30F3\u30DE\u533A\u5207\u308A)</div>
          <div class="col-head col-grid-notes">\uD83D\uDCDD \u898F\u5247\u30FB\u5099\u8003</div>
          <div class="col-head col-grid-obsidian">\uD83D\uDC8E Obsidian\u30CE\u30FC\u30C8</div>
          <div class="col-head col-grid-actions">\u64CD\u4F5C</div>
        </div>
      `;
    }

    if (sorted.length === 0) {
      if (container) container.innerHTML = `<div class="empty-state" style="padding: 40px; text-align: center; color: var(--text-dim);"><p>\u8A72\u5F53\u3059\u308B\u30CF\u30D3\u30C3\u30C8\u304C\u3042\u308A\u307E\u305B\u3093</p></div>`;
      return;
    }

    if (container) {
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
              <div class="col-sub-drag" title="\u30C9\u30E9\u30C3\u30B0\u3057\u3066\u4E26\u3073\u66FF\u3048">\u2807</div>
              <div class="col-sub-num">${index + 1}</div>
              <div class="col-sub-disabled" title="\u6709\u52B9/\u7121\u52B9\u5207\u66FF">
                <input type="checkbox" ${isDisabled ? 'checked' : ''} onchange="toggleItemDisabledInline('${habit.id}', 'habit', event)">
              </div>
              <div class="col-sub-name">
                <input type="text" class="table-name-input" value="${habit.name || ''}"
                       onblur="handleInlineFieldChange('${habit.id}', 'habit', 'name', this.value, event)"
                       onkeydown="if(event.key==='Enter'){this.blur();}"
                       title="\u30AF\u30EA\u30C3\u30AF\u3057\u3066\u540D\u79F0\u3092\u76F4\u63A5\u7DE8\u96C6">
                <button type="button" class="btn-cell-icon" onclick="openEditModal('${habit.id}')" title="\u30CF\u30D3\u30C3\u30C8\u8A73\u7D30\u30E2\u30FC\u30C0\u30EB\u3092\u958B\u304F">\u2699\uFE0F</button>
              </div>
            </div>
            <div class="master-scrollable-right-cells">
              <div class="col-grid-period">
                <div style="display: flex; gap: 4px; align-items: center; width: 100%;">
                  <input type="date" class="table-inline-input" value="${habit.displayStart || ''}"
                         onchange="handleInlineFieldChange('${habit.id}', 'habit', 'displayStart', this.value, event)" title="\u958B\u59CB\u65E5">
                  <span style="color: var(--text-dim); font-size: 11px; flex-shrink: 0;">\uFF5E</span>
                  <input type="date" class="table-inline-input" value="${habit.displayEnd || ''}"
                         onchange="handleInlineFieldChange('${habit.id}', 'habit', 'displayEnd', this.value, event)" title="\u7D42\u4E86\u65E5">
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
                  <span style="color: var(--text-muted); font-size: 10px;">\u5206</span>
                </div>
              </div>
              ${buildInlineRecurrenceHtml(habit, 'habit')}
              ${buildInlineMatrixChipsHtml(habit, 'habit')}
              <div class="col-grid-tags">
                <input type="text" class="table-inline-input" placeholder="#\u30BF\u30B01, #\u30BF\u30B02" value="${tagsStr}"
                       onblur="handleInlineFieldChange('${habit.id}', 'habit', 'tags', this.value, event)"
                       onkeydown="if(event.key==='Enter'){this.blur();}">
              </div>
              <div class="col-grid-notes">
                <input type="text" class="table-inline-input" placeholder="\u898F\u5247\u30FB\u5099\u8003..." value="${habit.notes || ''}"
                       onblur="handleInlineFieldChange('${habit.id}', 'habit', 'notes', this.value, event)"
                       onkeydown="if(event.key==='Enter'){this.blur();}">
              </div>
              <div class="col-grid-obsidian">
                <div class="table-obsidian-cell">
                  <input type="text" class="table-inline-input" placeholder="Obsidian\u30EA\u30F3\u30AF..." value="${habit.obsidianUri || ''}"
                         onblur="handleInlineFieldChange('${habit.id}', 'habit', 'obsidianUri', this.value, event)"
                         onkeydown="if(event.key==='Enter'){this.blur();}"
                         title="Obsidian\u30CE\u30FC\u30C8\u30EA\u30F3\u30AF\u307E\u305F\u306F\u30D1\u30B9">
                  <button type="button" 
                          class="btn-cell-obsidian ${habit.obsidianUri ? 'active' : 'disabled'}"
                          onclick="${habit.obsidianUri ? `openObsidianLink('${habit.obsidianUri.replace(/'/g, "\\'")}', event)` : `openEditModal('${habit.id}')`}"
                          title="${habit.obsidianUri ? 'Obsidian\u3067\u958B\u304F: ' + habit.obsidianUri : '\u672A\u8A2D\u5B9A(\u30AF\u30EA\u30C3\u30AF\u3067\u8A2D\u5B9A)'}">
                    <svg class="obsidian-svg-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5L18 8l-6 3.5L6 8l6-3.5zm-6.5 5.5l5.5 3.2v6.8L5.5 16V10zm13 6l-5.5 3.5v-6.8l5.5-3.2v6.5z"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div class="col-grid-actions">
                <button type="button" class="btn-cell-icon" onclick="duplicateSingleItem('${habit.id}', 'habit', event)" title="\u8907\u88FD">\uD83D\uDCCB</button>
                <button type="button" class="btn-cell-icon danger" onclick="deleteSingleItem('${habit.id}', 'habit', event)" title="\u524A\u9664">\uD83D\uDDD1\uFE0F</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

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

  function handleAnalyticsHeaderSort(key) {
  if (!state.analyticsSortKey) {
    state.analyticsSortKey = 'master';
  }
  if (state.analyticsSortKey === key) {
    // Pattern 1: Clicking already sorted column resets back to master list order
    state.analyticsSortKey = 'master';
  } else {
    state.analyticsSortKey = key;
  }
  const sortSelectEl = document.getElementById('analytics-sort-select');
  if (sortSelectEl) {
    sortSelectEl.value = state.analyticsSortKey;
  }
  renderTableAnalyticsView();
}

function handleAnalyticsSortSelectChange(val) {
  state.analyticsSortKey = val;
  renderTableAnalyticsView();
}

function toggleAnalyticsVisualMode() {
  if (!state.analyticsVisualMode) {
    state.analyticsVisualMode = localStorage.getItem('gendrive_analytics_visual_mode') || 'bar';
  }
  state.analyticsVisualMode = (state.analyticsVisualMode === 'smiley') ? 'bar' : 'smiley';
  localStorage.setItem('gendrive_analytics_visual_mode', state.analyticsVisualMode);
  renderTableAnalyticsView();
  if (typeof showUndoToast === 'function') {
    showUndoToast(state.analyticsVisualMode === 'smiley' ? '\uD83D\uDE0A \u9054\u6210\u5EA6\u8868\u793A: \u30CB\u30B3\u3061\u3083\u3093\u30DE\u30FC\u30AF\u30E2\u30FC\u30C9 [V]' : '\uD83D\uDCCA \u9054\u6210\u5EA6\u8868\u793A: \u30D0\u30FC\u30B0\u30E9\u30D5\u30E2\u30FC\u30C9 [V]', true);
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
      toggleIconEl.textContent = '\uD83D\uDE0A';
      toggleTextEl.textContent = '\u30CB\u30B3\u3061\u3083\u3093';
    } else {
      toggleIconEl.textContent = '\uD83D\uDCCA';
      toggleTextEl.textContent = '\u30D0\u30FC\u30B0\u30E9\u30D5';
    }
  }

  const filterTypeEl = document.getElementById('analytics-filter-type');
  const sortSelectEl = document.getElementById('analytics-sort-select');
  const filterType = filterTypeEl ? filterTypeEl.value : 'all';

  if (!state.analyticsSortKey) {
    state.analyticsSortKey = 'master';
  }
  const sortKey = state.analyticsSortKey;
  if (sortSelectEl && sortSelectEl.value !== sortKey) {
    sortSelectEl.value = sortKey;
  }

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
        timingStr = '\uD83C\uDF10 \u3044\u3064\u3067\u3082';
      } else if (timingType === 'custom') {
        const timeSpan = [h.customStart, h.customEnd].filter(Boolean).join('\u301C');
        timingStr = timeSpan ? `\u23F1 ${timeSpan}` : '\u23F1 \u6642\u9593\u6307\u5B9A';
      } else {
        timingStr = h.section ? `\uD83D\uDCC2 ${h.section}` : '\uD83D\uDCC2 \u30BB\u30AF\u30B7\u30E7\u30F3\u672A\u8A2D\u5B9A';
      }

      items.push({
        id: h.id,
        name: h.name || '\u540D\u79F0\u672A\u8A2D\u5B9A',
        type: 'habit',
        typeLabel: '\uD83C\uDF3F \u30CF\u30D3\u30C3\u30C8',
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
        timingStr = '\uD83C\uDF10 \u3044\u3064\u3067\u3082';
      } else if (timingType === 'custom' || (t.customStart && t.customEnd)) {
        const timeSpan = [t.customStart, t.customEnd].filter(Boolean).join('\u301C');
        timingStr = timeSpan ? `\u23F1 ${timeSpan}` : '\u23F1 \u6642\u9593\u6307\u5B9A';
      } else {
        timingStr = t.section ? `\uD83D\uDCC2 ${t.section}` : '\uD83D\uDCC2 \u30BB\u30AF\u30B7\u30E7\u30F3\u672A\u8A2D\u5B9A';
      }

      items.push({
        id: t.id,
        name: t.title || '\u540D\u79F0\u672A\u8A2D\u5B9A',
        type: 'task',
        typeLabel: '\uD83C\uDFAF \u30BF\u30B9\u30AF',
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

  // ---------------------------------------------------------------------------
  // 5-Stage Trend Status Evaluation Engine (30d -> 7d -> 3d dynamics)
  // ---------------------------------------------------------------------------
    const getStatusInfo = (r3, r7, r30, streak) => {
    // 1. Super / 邨ｶ螂ｽ隱ｿ (score: 5)
    if ((r7 >= 80 && r3 >= 67 && (r30 >= 70 || r30 === 0)) || (r7 >= 85 && streak >= 5)) {
      return {
        score: 5,
        badgeHtml: '<span class="analytics-status-badge badge-super" title="\u7D76\u597D\u8ABF: \u5168\u4F53\u30FB\u76F4\u8FD1\u3068\u3082\u306B80%\u4EE5\u4E0A\u3092\u7DAD\u6301">\uD83D\uDD25 \u7D76\u597D\u8ABF</span>'
      };
    }

    // 2. Growth / 謌宣聞荳ｭ (score: 4)
    const isRising = (r3 > r7 && r7 >= r30 && r3 >= 67) || (r3 >= 67 && r3 >= r30 + 15) || (r7 >= 60 && r7 >= r30 + 15);
    if (isRising) {
      return {
        score: 4,
        badgeHtml: '<span class="analytics-status-badge badge-growth" title="\u6210\u9577\u4E2D: \u76F4\u8FD1\u306E\u9054\u6210\u5EA6\u304C\u6025\u4E0A\u6607\u4E2D\uFF01\u6CE2\u306B\u4E57\u3063\u3066\u3044\u307E\u3059">\uD83D\uDCC8 \u6210\u9577\u4E2D</span>'
      };
    }

    // 3. Decline / 荳矩剄荳ｭ (score: 2)
    const isFalling = (r30 >= 55 && (r7 <= r30 - 15 || r3 <= r30 - 25)) || (r7 >= 60 && r3 <= 33);
    if (isFalling) {
      return {
        score: 2,
        badgeHtml: '<span class="analytics-status-badge badge-decline" title="\u4E0B\u964D\u4E2D: \u4EE5\u524D\u3088\u308A\u76F4\u8FD1\u304C\u4F4E\u4E0B\u6C17\u5473\uFF01\u9014\u5207\u308C\u308B\u524D\u306B\u5BFE\u7B56\u3092">\uD83D\uDCC9 \u4E0B\u964D\u4E2D</span>'
      };
    }

    // 4. Good / 鬆・ｪｿ (score: 3)
    if (r7 >= 60 && r30 >= 50 && r3 >= 50) {
      return {
        score: 3,
        badgeHtml: '<span class="analytics-status-badge badge-good" title="\u9806\u8ABF: \u5B89\u5B9A\u3057\u3066\u7D99\u7D9A\u3067\u304D\u3066\u3044\u307E\u3059">\uD83C\uDF3F \u9806\u8ABF</span>'
      };
    }

    // 5. Danger / 隕√ユ繧ｳ蜈･繧・(score: 1)
    return {
      score: 1,
      badgeHtml: '<span class="analytics-status-badge badge-danger" title="\u8981\u30C6\u30B3\u5165\u308C: \u9054\u6210\u5EA6\u304C\u4F4E\u8FF7\u4E2D\u3002\u76EE\u6A19\u3084\u624B\u9806\u306E\u898B\u76F4\u3057\u3092\u63A8\u5968">\u26A0\uFE0F \u8981\u30C6\u30B3\u5165\u308C</span>'
    };
  };

  const getMasterOrder = (item) => {
    if (item.type === 'habit') {
      const so = item.rawItem && item.rawItem.sortOrder;
      return (typeof so === 'number' && !isNaN(so)) ? so : 99999;
    }
    const tIdx = Array.isArray(state.tasks) ? state.tasks.indexOf(item.rawItem) : 99999;
    return tIdx >= 0 ? 10000 + tIdx : 99999;
  };

  items.sort((a, b) => {
    let diff = 0;
    if (sortKey === 'streak' || sortKey === 'streak_desc') {
      diff = (b.streak - a.streak);
    } else if (sortKey === 'r3' || sortKey === 'rate3_desc') {
      diff = (b.r3 - a.r3);
    } else if (sortKey === 'r7' || sortKey === 'rate7_desc') {
      diff = (b.r7 - a.r7);
    } else if (sortKey === 'r30' || sortKey === 'rate30_desc') {
      diff = (b.r30 - a.r30);
    } else if (sortKey === 'r90' || sortKey === 'rate90_desc') {
      diff = (b.r90 - a.r90);
    } else if (sortKey === 'status' || sortKey === 'status_desc') {
      const scoreA = getStatusInfo(a.r3, a.r7, a.r30, a.streak).score;
      const scoreB = getStatusInfo(b.r3, b.r7, b.r30, b.streak).score;
      diff = (scoreB - scoreA);
    } else if (sortKey === 'name' || sortKey === 'name_asc') {
      const nameCmp = a.name.localeCompare(b.name, 'ja');
      if (nameCmp !== 0) return nameCmp;
      return getMasterOrder(a) - getMasterOrder(b);
    }

    if (diff !== 0) return diff;
    return getMasterOrder(a) - getMasterOrder(b);
  });

  if (countEl) countEl.textContent = `${items.length} \u4EF6`;

  const avgR7 = items.length > 0 ? Math.round(items.reduce((sum, item) => sum + item.r7, 0) / items.length) : 0;
  const maxStreakItem = items.length > 0 ? [...items].sort((a, b) => b.streak - a.streak)[0] : null;
  const excellentCount = items.filter(item => item.r7 >= 80).length;
  const attentionCount = items.filter(item => item.r7 < 50).length;

  if (kpiContainer) {
    kpiContainer.innerHTML = `
      <div class="analytics-kpi-card">
        <div class="kpi-icon">\uD83D\uDCCA</div>
        <div class="kpi-content">
          <div class="kpi-label">\u5168\u4F53\u306E\u5E73\u5747 7\u65E5\u9054\u6210\u7387</div>
          <div class="kpi-value ${avgR7 >= 80 ? 'text-emerald' : avgR7 >= 50 ? 'text-cyan' : 'text-amber'}">${avgR7}%</div>
        </div>
      </div>
      <div class="analytics-kpi-card">
        <div class="kpi-icon">\uD83D\uDD25</div>
        <div class="kpi-content">
          <div class="kpi-label">\u6700\u9AD8\u30B9\u30C8\u30EA\u30FC\u30AF (\u9023\u7D9A\u65E5\u6570)</div>
          <div class="kpi-value text-orange">${maxStreakItem && maxStreakItem.streak > 0 ? `${maxStreakItem.streak} \u65E5\u9023\u7D9A` : '0 \u65E5'}</div>
          <div class="kpi-sub" title="${maxStreakItem ? maxStreakItem.name : ''}">${maxStreakItem && maxStreakItem.streak > 0 ? maxStreakItem.name : '\u30C7\u30A4\u30EA\u30FC\u30CE\u30FC\u30C8\u8D77\u7968'}</div>
        </div>
      </div>
      <div class="analytics-kpi-card">
        <div class="kpi-icon">\uD83D\uDC8E</div>
        <div class="kpi-content">
          <div class="kpi-label">\u7D76\u597D\u8ABF (80%\u8D85)</div>
          <div class="kpi-value text-emerald">${excellentCount} <span class="kpi-unit">/ ${items.length}\u4EF6</span></div>
        </div>
      </div>
      <div class="analytics-kpi-card">
        <div class="kpi-icon">\u26A0\uFE0F</div>
        <div class="kpi-content">
          <div class="kpi-label">\u8981\u30C6\u30B3\u5165\u308C (50%\u672A\u6E80)</div>
          <div class="kpi-value ${attentionCount > 0 ? 'text-rose' : 'text-muted'}">${attentionCount} <span class="kpi-unit">\u4EF6</span></div>
        </div>
      </div>
    `;
  }

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 60px 20px; text-align: center; color: var(--text-dim);">
        <p style="font-size: 16px; margin-bottom: 8px;">\u8A72\u5F53\u3059\u308B\u7FD2\u6163\u30FB\u30BF\u30B9\u30AF\u304C\u3042\u308A\u307E\u305B\u3093</p>
        <p style="font-size: 12px;">\u30D5\u30A3\u30EB\u30BF\u30FC\u3092\u5909\u66F4\u3059\u308B\u304B\u3001\u65B0\u898F\u767B\u9332\u3057\u3066\u304F\u3060\u3055\u3044\u3002</p>
      </div>
    `;
    return;
  }

  const renderRateDisplay = (rate) => {
    let colorName = 'emerald';
    if (rate < 40) colorName = 'rose';
    else if (rate < 65) colorName = 'amber';
    else if (rate < 80) colorName = 'cyan';

    const isPerfect = (rate === 100);
    const perfectClass = isPerfect ? ' is-perfect' : '';

    if (visualMode === 'smiley') {
      return `
        <div class="analytics-rate-cell mode-smiley">
          <span class="score-rate-number">${rate}%</span>
          <div class="score-smiley-badge smile-${colorName}${perfectClass}" title="\u9054\u6210\u7387 ${rate}%${isPerfect ? ' (100% PERFECT!)' : ''}">
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
          <div class="score-progress-fill bar-${colorName}${isPerfect ? ' bar-perfect' : ''}" style="width: ${rate}%;"></div>
        </div>
      </div>
    `;
  };

  const rowsHtml = items.map((item, idx) => {
    const isHabit = item.type === 'habit';
    const clickDetail = isHabit
      ? `openEditModal('${item.id}')`
      : `openEditTaskModal('${item.id}')`;

    const statusInfo = getStatusInfo(item.r3, item.r7, item.r30, item.streak);

    return `
      <div class="analytics-score-row" data-id="${item.id}">
        <div class="col-ana-num">${idx + 1}</div>
        <div class="col-ana-name">
          <div class="ana-name-main">
            <span class="ana-type-tag ${isHabit ? 'type-habit' : 'type-task'}">${isHabit ? '\uD83C\uDF3F' : '\uD83C\uDFAF'}</span>
            <span class="ana-name-text" onclick="${clickDetail}" title="${item.name}">${item.name}</span>
            ${item.timingStr ? `<span class="ana-timing-sub">${item.timingStr}</span>` : ''}
          </div>
          <div class="ana-meta-tags">
            ${item.domain ? `<span class="ana-meta-badge domain">\uD83C\uDF10 ${item.domain}</span>` : ''}
            ${item.dept ? `<span class="ana-meta-badge dept">\uD83C\uDFE2 ${item.dept}</span>` : ''}
            ${item.tags.slice(0, 3).map(t => `<span class="ana-meta-badge tag">#${t}</span>`).join('')}
          </div>
        </div>
        <div class="col-ana-streak">
          ${item.streak > 0 ? `<span class="streak-flame-pill">\uD83D\uDD25 <b>${item.streak}</b> \u65E5\u9023\u7D9A</span>` : '<span class="text-dim">-</span>'}
        </div>
        <div class="col-ana-rate">${renderRateDisplay(item.r3)}</div>
        <div class="col-ana-rate">${renderRateDisplay(item.r7)}</div>
        <div class="col-ana-rate">${renderRateDisplay(item.r30)}</div>
        <div class="col-ana-rate">${renderRateDisplay(item.r90)}</div>
        <div class="col-ana-status">${statusInfo.badgeHtml}</div>
        <div class="col-ana-actions" style="display: flex; gap: 4px; align-items: center; justify-content: center;">
          <button type="button" 
                  class="btn-cell-obsidian ${item.obsidianUri ? 'active' : 'disabled'}"
                  onclick="${item.obsidianUri ? `openObsidianLink('${item.obsidianUri.replace(/'/g, "\\'")}', event)` : clickDetail}"
                  title="${item.obsidianUri ? 'Obsidian' : ''}">
            <svg class="obsidian-svg-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
              <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5L18 8l-6 3.5L6 8l6-3.5zm-6.5 5.5l5.5 3.2v6.8L5.5 16V10zm13 6l-5.5 3.5v-6.8l5.5-3.2v6.5z"/>
            </svg>
          </button>
          <button type="button" class="btn-cell-icon" onclick="${clickDetail}" title="\u8A73\u7D30\u30E2\u30FC\u30C0\u30EB">\u2699\uFE0F</button>
        </div>
      </div>
    `;
  }).join('');

  const getSortIndicator = (key) => {
    if (sortKey === key) {
      return '<span class="sort-indicator-active"> \u25BC</span>';
    }
    return '<span class="sort-indicator-idle"> \u25BD</span>';
  };

  const getSortClass = (key) => {
    if (sortKey === key) {
      return 'col-sortable is-sorted';
    }
    return 'col-sortable';
  };

  container.innerHTML = `
    <div class="analytics-score-table">
      <div class="analytics-score-head">
        <div class="col-ana-num col-sortable ${sortKey === 'master' ? 'is-sorted' : ''}" onclick="handleAnalyticsHeaderSort('master')" title="\u30DE\u30B9\u30BF\u30FC\u9806">No.${sortKey === 'master' ? '<span class="sort-indicator-active"> \u25CF</span>' : ''}</div>
        <div class="col-ana-name ${getSortClass('name')}" onclick="handleAnalyticsHeaderSort('name')">\uD83C\uDF3F \u7FD2\u6163\u30FB\u30BF\u30B9\u30AF\u540D / \u6240\u5C5E${getSortIndicator('name')}</div>
        <div class="col-ana-streak ${getSortClass('streak')}" onclick="handleAnalyticsHeaderSort('streak')">\uD83D\uDD25 \u9023\u7D9A\u65E5\u6570${getSortIndicator('streak')}</div>
        <div class="col-ana-rate ${getSortClass('r3')}" onclick="handleAnalyticsHeaderSort('r3')">\u26A1 3\u65E5\u9054\u6210\u5EA6${getSortIndicator('r3')}</div>
        <div class="col-ana-rate ${getSortClass('r7')}" onclick="handleAnalyticsHeaderSort('r7')">\uD83D\uDCC5 7\u65E5(\u9031)\u9054\u6210\u5EA6${getSortIndicator('r7')}</div>
        <div class="col-ana-rate ${getSortClass('r30')}" onclick="handleAnalyticsHeaderSort('r30')">\uD83E\uDE99 30\u65E5(\u6708)\u9054\u6210\u5EA6${getSortIndicator('r30')}</div>
        <div class="col-ana-rate ${getSortClass('r90')}" onclick="handleAnalyticsHeaderSort('r90')">\uD83C\uDFC6 90\u65E5\u9054\u6210\u5EA6${getSortIndicator('r90')}</div>
        <div class="col-ana-status ${getSortClass('status')}" onclick="handleAnalyticsHeaderSort('status')">\u72B6\u614B\u8A55\u4FA1${getSortIndicator('status')}</div>
        <div class="col-ana-actions">\u64CD\u4F5C</div>
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
