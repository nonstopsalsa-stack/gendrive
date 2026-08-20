/**
 * Gendrive - Modal Management & Form Handler Service
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. General Modal Controls & Cascade Filters
// =========================================================================

function closeModal() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  if (typeof hideContextMenu === 'function') hideContextMenu();
}

function openShortcutsModal() {
  const modal = document.getElementById('modal-shortcuts');
  if (modal) modal.classList.add('active');
}

function openCascadeFilterModal(type, title, hierarchyData) {
  const modal = document.getElementById('modal-filter');
  if (!modal) return;
  document.getElementById('modal-filter-title').textContent = `🔍 ${title} 絞り込み`;

  const majorListEl = document.getElementById('filter-major-list');
  const minorListEl = document.getElementById('filter-minor-list');

  let majorHtml = `
    <button class="cascade-btn ${!state.filters[type] ? 'active' : ''}" onclick="selectFilter('${type}', null)">
      ✨ すべて (解除)
    </button>
  `;

  Object.keys(hierarchyData).forEach(majorKey => {
    const isSelected = state.filters[type] === majorKey;
    majorHtml += `
      <button class="cascade-btn ${isSelected ? 'active' : ''}" onclick="selectMajorFilter('${type}', '${majorKey}')">
        ${hierarchyData[majorKey].name}
      </button>
    `;
  });
  majorListEl.innerHTML = majorHtml;
  minorListEl.innerHTML = `<div style="padding:10px; color:var(--text-dim); font-size:12px;">左の大分類を選択してください</div>`;

  modal.classList.add('active');
}

function selectMajorFilter(type, majorKey) {
  let dataMap = null;
  if (type === 'domain') dataMap = DOMAINS_DATA;
  if (type === 'dept') dataMap = DEPTS_DATA;
  if (type === 'proj') dataMap = PROJECTS_DATA;

  document.querySelectorAll('#filter-major-list .cascade-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.includes(dataMap[majorKey].name));
  });

  const minorListEl = document.getElementById('filter-minor-list');
  const items = dataMap[majorKey].items;

  let minorHtml = `
    <button class="cascade-btn ${state.filters[type] === majorKey ? 'active' : ''}" onclick="selectFilter('${type}', '${majorKey}')">
      👉 ${dataMap[majorKey].name} 全体
    </button>
  `;

  items.forEach(item => {
    const isSelected = state.filters[type] === item;
    minorHtml += `
      <button class="cascade-btn ${isSelected ? 'active' : ''}" onclick="selectFilter('${type}', '${item}')">
        ${item}
      </button>
    `;
  });

  minorListEl.innerHTML = minorHtml;
}

function selectFilter(type, value) {
  state.filters[type] = value;
  closeModal();
  renderApp();
}

function openTagFilterModal() {
  const modal = document.getElementById('modal-filter');
  if (!modal) return;
  document.getElementById('modal-filter-title').textContent = '🏷️ タグ絞り込み（含む／除外）';

  const majorListEl = document.getElementById('filter-major-list');
  const minorListEl = document.getElementById('filter-minor-list');

  const allTags = getAllRegisteredTags();
  const incList = state.filters.includeTags || [];
  const excList = state.filters.excludeTags || [];

  // Left Column: Filter Actions & Interactive Guide
  majorListEl.innerHTML = `
    <button class="cascade-btn ${incList.length === 0 && excList.length === 0 ? 'active' : ''}" onclick="clearAllTagFilters()">
      ✨ すべてのタグ条件を解除
    </button>
    <div style="padding: 10px 4px 6px; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 10px;">
      <label style="font-size: 11px; font-weight: 700; color: var(--text-dim); display: block; margin-bottom: 4px;">🔍 タグ名を手入力で指定</label>
      <div style="display: flex; gap: 4px;">
        <input type="text" id="input-custom-filter-tag" placeholder="例: 筋トレ, 経理" style="font-size: 11.5px; padding: 4px 8px; flex: 1; min-width: 0;" onkeydown="if(event.key==='Enter'){event.preventDefault();addCustomFilterTag();}">
        <button type="button" class="btn-subtle" onclick="addCustomFilterTag()" style="padding: 4px 8px; font-size: 11px;">追加</button>
      </div>
    </div>
    <div style="padding: 10px 4px; font-size: 11px; color: var(--text-muted); line-height: 1.5; border-top: 1px solid rgba(255,255,255,0.06); margin-top: 8px;">
      <b style="color: var(--text-main);">💡 タグの絞り込み方:</b><br>
      タグをクリックするたびに切り替わります：<br>
      <span style="color: #38bdf8; font-weight: bold;">1回目: ✓ 含む（青）</span><br>
      <span style="color: #ef4444; font-weight: bold;">2回目: 🚫 除外（赤）</span><br>
      <span style="color: #94a3b8;">3回目: ⚪ 解除（指定なし）</span>
    </div>
    <button class="cascade-btn" style="margin-top: 6px; background: rgba(56,189,248,0.2); border-color: #38bdf8; color: #fff; font-weight: 700;" onclick="closeModal()">
      ✓ 閉じる
    </button>
  `;

  // Right Column: Interactive Tag Badges Grid
  const includeSet = new Set(incList);
  const excludeSet = new Set(excList);

  const displayTagsMap = new Map();
  allTags.forEach(t => displayTagsMap.set(t.name, t.count));
  includeSet.forEach(t => { if (!displayTagsMap.has(t)) displayTagsMap.set(t, 0); });
  excludeSet.forEach(t => { if (!displayTagsMap.has(t)) displayTagsMap.set(t, 0); });

  if (displayTagsMap.size === 0) {
    minorListEl.innerHTML = `
      <div style="padding: 24px 10px; text-align: center; color: var(--text-dim); font-size: 12px;">
        🏷️ 登録されているタグはまだありません。<br>左側の入力欄からタグ名を入力して追加するか、タスク・ハビット作成時にタグを登録するとワンクリックで絞り込めます。
      </div>
    `;
  } else {
    minorListEl.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; gap: 8px; padding: 6px;">
        ${Array.from(displayTagsMap.entries()).map(([name, count]) => {
          const isInc = includeSet.has(name);
          const isExc = excludeSet.has(name);
          let tagClass = '';
          let stateLabel = '';
          if (isInc) {
            tagClass = 'tag-chip-included';
            stateLabel = '✓ 含む';
          } else if (isExc) {
            tagClass = 'tag-chip-excluded';
            stateLabel = '🚫 除外';
          }

          return `
            <button type="button" class="tag-filter-modal-chip ${tagClass}" onclick="handleModalTagClick('${name}')">
              <span class="tag-chip-name">#${name}</span>
              ${count > 0 ? `<span class="tag-chip-count">${count}件</span>` : ''}
              ${stateLabel ? `<span class="tag-chip-state">${stateLabel}</span>` : ''}
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  modal.classList.add('active');
  setTimeout(() => {
    const input = document.getElementById('input-custom-filter-tag');
    if (input) input.focus();
  }, 50);
}

function addCustomFilterTag() {
  const input = document.getElementById('input-custom-filter-tag');
  if (!input || !input.value.trim()) return;
  const tag = input.value.trim().replace(/^#/, '');
  if (!state.filters.includeTags) state.filters.includeTags = [];
  if (!state.filters.includeTags.includes(tag)) {
    state.filters.includeTags.push(tag);
  }
  renderApp();
  openTagFilterModal();
}

function handleModalTagClick(tagName) {
  toggleTagFilter(tagName);
  openTagFilterModal();
}

function clearAllTagFilters() {
  state.filters.includeTags = [];
  state.filters.excludeTags = [];
  renderApp();
  openTagFilterModal();
}

// =========================================================================
// 2. Quick Complete Record Modal (Habit & Task)
// =========================================================================

function promptCompleteHabit(id, event) {
  if (event) event.stopPropagation();
  if (event && event.shiftKey) {
    completeHabit(id);
    return;
  }

  const habit = state.habits.find(h => String(h.id) === String(id));
  if (!habit) {
    completeHabit(id);
    return;
  }

  const modal = document.getElementById('modal-quick-complete');
  if (!modal) {
    completeHabit(id);
    return;
  }

  const dateKey = getSelectedDateKey();
  const curCount = getHabitDayCount(habit, dateKey);
  const targetTimes = getHabitTargetTimes(habit);
  const nextCount = curCount + 1;

  let elapsedMin = habit.targetMin || 10;
  if (habit.startTimestamp) {
    const elapsedSec = Math.max(1, Math.round((Date.now() - habit.startTimestamp) / 1000));
    elapsedMin = Math.max(1, Math.round(elapsedSec / 60));
  }

  document.getElementById('quick-complete-type').value = 'habit';
  document.getElementById('quick-complete-id').value = habit.id;
  document.getElementById('quick-complete-title').textContent = '🌿 習慣の完了を記録';
  document.getElementById('quick-complete-icon').textContent = '🌿';
  document.getElementById('quick-complete-icon').style.color = '#10b981';
  
  const typeBadge = document.getElementById('quick-complete-type-badge');
  if (typeBadge) {
    typeBadge.textContent = '🌿 ハビット';
    typeBadge.className = 'qc-target-type';
  }
  document.getElementById('quick-complete-item-name').textContent = habit.name;
  document.getElementById('quick-complete-duration-badge').textContent = `⏱️ 計測: ${elapsedMin}分`;
  
  const countGroup = document.getElementById('quick-complete-count-group');
  if (countGroup) countGroup.style.display = 'flex';
  document.getElementById('quick-complete-count').value = nextCount;
  document.getElementById('quick-complete-unit-label').textContent = targetTimes > 1 ? `回目 (目標${targetTimes}回)` : '回目';
  document.getElementById('quick-complete-duration').value = elapsedMin;
  
  const noteInput = document.getElementById('quick-complete-note');
  if (noteInput) {
    noteInput.value = '';
    noteInput.placeholder = '例: 30回×3セット達成！インターバル45秒、腰の調子良好';
  }

  modal.classList.add('active');
  setTimeout(() => {
    if (noteInput) noteInput.focus();
  }, 50);
}

function promptCompleteTask(taskId, event) {
  if (event) event.stopPropagation();
  if (event && event.shiftKey) {
    completeTask(taskId);
    return;
  }

  const task = state.tasks.find(t => t.id === taskId);
  if (!task) {
    completeTask(taskId);
    return;
  }

  const modal = document.getElementById('modal-quick-complete');
  if (!modal) {
    completeTask(taskId);
    return;
  }

  let finalSec = task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0);
  if (task.startTimestamp) {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000));
    finalSec += elapsedSec;
  }
  const elapsedMin = Math.max(1, Math.round((finalSec || (task.estMin || 25) * 60) / 60));

  document.getElementById('quick-complete-type').value = 'task';
  document.getElementById('quick-complete-id').value = task.id;
  document.getElementById('quick-complete-title').textContent = '🎯 タスクの完了を記録';
  document.getElementById('quick-complete-icon').textContent = '🎯';
  document.getElementById('quick-complete-icon').style.color = '#38bdf8';
  
  const typeBadge = document.getElementById('quick-complete-type-badge');
  if (typeBadge) {
    typeBadge.textContent = '🎯 タスク';
    typeBadge.className = 'qc-target-type task-type';
  }
  document.getElementById('quick-complete-item-name').textContent = task.title;
  document.getElementById('quick-complete-duration-badge').textContent = `⏱️ 実績: ${elapsedMin}分`;
  
  const countGroup = document.getElementById('quick-complete-count-group');
  if (countGroup) countGroup.style.display = 'none';
  document.getElementById('quick-complete-duration').value = elapsedMin;
  
  const noteInput = document.getElementById('quick-complete-note');
  if (noteInput) {
    noteInput.value = '';
    noteInput.placeholder = '例: レビュー完了、クライアントにメール送付済み';
  }

  modal.classList.add('active');
  setTimeout(() => {
    if (noteInput) noteInput.focus();
  }, 50);
}

// =========================================================================
// 3. Task Add & Edit Modals
// =========================================================================

function openAddTaskModal(sectionName = null, scheduledDate = null, bucket = null, timingType = null, isRecurring = null) {
  try {
    const modal = document.getElementById('modal-add-task');
    if (!modal) return;

    const d = (typeof lastTaskDefaults !== 'undefined' && lastTaskDefaults) ? lastTaskDefaults : (typeof DEFAULT_TASK_DEFAULTS !== 'undefined' ? DEFAULT_TASK_DEFAULTS : {});

    // Clear Title & Notes & Tags
    const titleInput = document.getElementById('add-task-title');
    if (titleInput) titleInput.value = '';
    const notesInput = document.getElementById('add-task-notes');
    if (notesInput) notesInput.value = '';

    const addTagsInput = document.getElementById('add-task-tags');
    if (addTagsInput) {
      addTagsInput.value = (d.tags && Array.isArray(d.tags)) ? d.tags.join(', ') : '';
      if (typeof renderTagSuggestions === 'function') {
        renderTagSuggestions('add-task-tag-suggestions', 'add-task-tags');
      }
    }
    const estInput = document.getElementById('add-task-est-min');
    if (estInput) estInput.value = d.estMin || 15;

    const actualBucket = bucket || d.bucket || 'today';
    if (typeof state !== 'undefined' && state) state.selectedAddTaskBucket = actualBucket;
    document.querySelectorAll('#add-task-bucket-selector .segment-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.bucket === actualBucket);
    });

    const dateInput = document.getElementById('add-task-scheduled-date');
    if (dateInput) {
      if (actualBucket !== 'today') {
        dateInput.value = '';
      } else {
        const curDateKey = (typeof getSelectedDateKey === 'function') ? getSelectedDateKey() : (typeof getTodayKey === 'function' ? getTodayKey() : '');
        dateInput.value = scheduledDate || curDateKey;
      }
    }

    // Timing
    const actualTiming = timingType || d.timingType || (sectionName ? 'section' : 'anytime');
    if (typeof state !== 'undefined' && state) state.selectedAddTaskTimingType = actualTiming;
    document.querySelectorAll('#add-task-timing-type-selector .segment-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === actualTiming);
    });
    const panelSec = document.getElementById('add-task-panel-timing-section');
    const panelCustom = document.getElementById('add-task-panel-timing-custom');
    if (panelSec) panelSec.classList.toggle('hidden', actualTiming !== 'section');
    if (panelCustom) panelCustom.classList.toggle('hidden', actualTiming !== 'custom');

    const curSec = (typeof state !== 'undefined' && state && state.currentSection) ? state.currentSection : '第2セッション';
    const targetSection = (sectionName && sectionName !== 'section') ? sectionName : (d.section || curSec);
    const secSelect = document.getElementById('add-task-section');
    if (secSelect) secSelect.value = targetSection;

    const startInput = document.getElementById('add-task-custom-start');
    if (startInput) startInput.value = d.customStart || '13:00';
    const endInput = document.getElementById('add-task-custom-end');
    if (endInput) endInput.value = d.customEnd || '15:00';

    // Label segment
    const actualLabel = d.label || 'p1';
    if (typeof state !== 'undefined' && state) state.selectedAddTaskLabel = actualLabel;
    document.querySelectorAll('#add-task-label-selector .segment-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.label === actualLabel);
    });

    // Task Type
    const actualType = isRecurring !== null ? (isRecurring ? 'recurring' : 'single') : (d.taskType || 'single');
    if (typeof state !== 'undefined' && state) state.selectedAddTaskType = actualType;
    document.querySelectorAll('#add-task-type-selector .segment-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.taskType === actualType);
    });
    const panelRec = document.getElementById('add-task-panel-recurrence');
    if (panelRec) panelRec.classList.toggle('hidden', actualType !== 'recurring');

    // Recurrence selector inside Task Add
    if (typeof state !== 'undefined' && state) state.selectedAddTaskRecType = d.recType || 'everyday';
    document.querySelectorAll('#add-task-rec-type-selector .segment-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === (d.recType || 'everyday'));
    });

    // 6-Axis Load Matrix
    if (typeof setMatrixValues === 'function') {
      const mat = d.matrix || (typeof DEFAULT_MATRIX !== 'undefined' ? DEFAULT_MATRIX : {});
      setMatrixValues('add-task', mat);
    }

    // 2-Step Cascade Selects
    if (typeof updateMinorSelectOptions === 'function') {
      const domMaj = document.getElementById('add-task-domain-major');
      if (domMaj) {
        domMaj.value = d.domainMajor || '';
        updateMinorSelectOptions('add-task-domain-major', 'add-task-domain-minor', DOMAINS_DATA, d.domainMinor);
      }
      const deptMaj = document.getElementById('add-task-dept-major');
      if (deptMaj) {
        deptMaj.value = d.deptMajor || '';
        updateMinorSelectOptions('add-task-dept-major', 'add-task-dept-minor', DEPTS_DATA, d.deptMinor);
      }
      const projMaj = document.getElementById('add-task-proj-major');
      if (projMaj) {
        projMaj.value = d.projMajor || '';
        updateMinorSelectOptions('add-task-proj-major', 'add-task-proj-minor', PROJECTS_DATA, d.projMinor);
      }
    }

    modal.classList.add('active');
    setTimeout(() => {
      const titleInput = document.getElementById('add-task-title');
      if (titleInput) titleInput.focus();
    }, 50);
  } catch (err) {
    console.error('Error in openAddTaskModal:', err);
    const modal = document.getElementById('modal-add-task');
    if (modal) modal.classList.add('active');
  }
}

function openEditTaskModal(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const modal = document.getElementById('modal-edit-task');
  if (!modal) return;

  document.getElementById('edit-task-id').value = task.id;
  document.getElementById('edit-task-id-badge').textContent = task.id;
  const movingAvgMin = (typeof calculateMovingAverageDuration === 'function') ? calculateMovingAverageDuration(task, 'task') : (task.estMin || 15);
  document.getElementById('edit-task-est-min').value = task.estMin || movingAvgMin;
  document.getElementById('edit-task-notes').value = task.notes || '';
  const editTagsInput = document.getElementById('edit-task-tags');
  if (editTagsInput) {
    editTagsInput.value = normalizeTags(task.tags).join(', ');
    if (typeof renderTagSuggestions === 'function') {
      renderTagSuggestions('edit-task-tag-suggestions', 'edit-task-tags');
    }
  }

  const dateInput = document.getElementById('edit-task-scheduled-date');
  if (dateInput) dateInput.value = task.scheduledDate || '';

  // TaskChute display
  document.getElementById('edit-task-est-display').textContent = `${task.estMin || movingAvgMin}分`;
  document.getElementById('edit-task-act-start-display').textContent = task.actStart || '--:--';
  document.getElementById('edit-task-act-end-display').textContent = task.actEnd || '--:--';
  document.getElementById('edit-task-act-min-display').textContent = `${task.actMin || 0}分`;

  // Status Selector
  state.selectedEditTaskStatus = task.status || 'uncompleted';
  document.querySelectorAll('#edit-task-status-selector .segment-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.status === state.selectedEditTaskStatus);
  });

  // Bucket Selector
  state.selectedEditTaskBucket = task.bucket || 'today';
  document.querySelectorAll('#edit-task-bucket-selector .segment-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.bucket === state.selectedEditTaskBucket);
  });

  // Label Selector
  state.selectedEditTaskLabel = task.label || 'none';
  document.querySelectorAll('#edit-task-label-selector .segment-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.label === state.selectedEditTaskLabel);
  });

  // Timing
  const timing = task.timingType || (task.section ? 'section' : 'anytime');
  state.selectedEditTaskTimingType = timing;
  document.querySelectorAll('#edit-task-timing-type-selector .segment-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === timing);
  });
  const panelSec = document.getElementById('edit-task-panel-timing-section');
  const panelCustom = document.getElementById('edit-task-panel-timing-custom');
  if (panelSec) panelSec.classList.toggle('hidden', timing !== 'section');
  if (panelCustom) panelCustom.classList.toggle('hidden', timing !== 'custom');

  if (task.section) document.getElementById('edit-task-section').value = task.section;
  if (task.customStart) document.getElementById('edit-task-custom-start').value = task.customStart;
  if (task.customEnd) document.getElementById('edit-task-custom-end').value = task.customEnd;

  // Recurrence
  const isRec = task.type === 'recurring';
  state.selectedEditTaskType = isRec ? 'recurring' : 'single';
  document.querySelectorAll('#edit-task-type-selector .segment-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.taskType === (isRec ? 'recurring' : 'single'));
  });
  const panelRec = document.getElementById('edit-task-panel-recurrence');
  if (panelRec) panelRec.classList.toggle('hidden', !isRec);

  const rec = task.recurrence || { type: 'everyday' };
  state.selectedEditTaskRecType = rec.type || 'everyday';
  document.querySelectorAll('#edit-task-rec-type-selector .segment-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === (rec.type || 'everyday'));
  });

  // 6-Axis Matrix
  if (typeof setMatrixValues === 'function') {
    setMatrixValues('edit-task', task.matrix || DEFAULT_MATRIX);
  }

  // Cascade selects
  const domMaj = document.getElementById('edit-task-domain-major');
  if (domMaj) {
    domMaj.value = task.domainMajor || '';
    updateMinorSelectOptions('edit-task-domain-major', 'edit-task-domain-minor', DOMAINS_DATA, task.domainMinor);
  }
  const deptMaj = document.getElementById('edit-task-dept-major');
  if (deptMaj) {
    deptMaj.value = task.deptMajor || '';
    updateMinorSelectOptions('edit-task-dept-major', 'edit-task-dept-minor', DEPTS_DATA, task.deptMinor);
  }
  const projMaj = document.getElementById('edit-task-proj-major');
  if (projMaj) {
    projMaj.value = task.projMajor || '';
    updateMinorSelectOptions('edit-task-proj-major', 'edit-task-proj-minor', PROJECTS_DATA, task.projMinor);
  }

  modal.classList.add('active');
}

// =========================================================================
// 4. Habit Add & Edit Modals
// =========================================================================

function openAddModal(sectionName = null, timingType = null) {
  try {
    const modal = document.getElementById('modal-add-habit');
    if (!modal) return;

    const d = (typeof lastHabitDefaults !== 'undefined' && lastHabitDefaults) ? lastHabitDefaults : (typeof DEFAULT_HABIT_DEFAULTS !== 'undefined' ? DEFAULT_HABIT_DEFAULTS : {});

    const nameInput = document.getElementById('add-habit-name');
    if (nameInput) nameInput.value = '';
    const minInput = document.getElementById('add-habit-min');
    if (minInput) minInput.value = d.targetMin || 5;
    
    const startEl = document.getElementById('add-habit-display-start');
    const endEl = document.getElementById('add-habit-display-end');
    if (startEl) startEl.value = '';
    if (endEl) endEl.value = '';

    const actualTiming = timingType || d.displayType || 'section';
    if (typeof state !== 'undefined' && state) state.selectedAddTimingType = actualTiming;
    document.querySelectorAll('#timing-type-selector .segment-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === actualTiming);
    });
    const panelSec = document.getElementById('panel-timing-section');
    const panelCustom = document.getElementById('panel-timing-custom');
    if (panelSec) panelSec.classList.toggle('hidden', actualTiming !== 'section');
    if (panelCustom) panelCustom.classList.toggle('hidden', actualTiming !== 'custom');

    const curSec = (typeof state !== 'undefined' && state && state.currentSection) ? state.currentSection : '第2セッション';
    const targetSection = (sectionName && sectionName !== 'section') ? sectionName : (d.section || curSec);
    const secSelect = document.getElementById('add-habit-section');
    if (secSelect) secSelect.value = targetSection;

    const startInput = document.getElementById('add-custom-start');
    if (startInput) startInput.value = d.customStart || '13:00';
    const endInput = document.getElementById('add-custom-end');
    if (endInput) endInput.value = d.customEnd || '17:00';

    // Recurrence
    const actualRec = d.recType || 'everyday';
    if (typeof state !== 'undefined' && state) state.selectedAddRecType = actualRec;
    document.querySelectorAll('#add-recurrence-type-selector .segment-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.type === actualRec);
    });
    const recPanels = {
      daily_times: document.getElementById('add-panel-rec-daily-times'),
      custom_days: document.getElementById('add-panel-rec-custom-days'),
      weekly_goal: document.getElementById('add-panel-rec-weekly-goal'),
      interval: document.getElementById('add-panel-rec-interval'),
      monthly: document.getElementById('add-panel-rec-monthly')
    };
    Object.entries(recPanels).forEach(([k, p]) => {
      if (p) p.classList.toggle('hidden', k !== actualRec);
    });

    const dailyTimesInput = document.getElementById('add-rec-daily-times');
    if (dailyTimesInput) dailyTimesInput.value = d.dailyTimes || 2;
    const weeklyTimesInput = document.getElementById('add-rec-weekly-times');
    if (weeklyTimesInput) weeklyTimesInput.value = d.weeklyTimes || 3;
    const intervalInput = document.getElementById('add-rec-interval-days');
    if (intervalInput) intervalInput.value = d.intervalDays || 2;
    const monthIntInput = document.getElementById('add-rec-month-interval');
    if (monthIntInput) monthIntInput.value = d.monthInterval || 1;
    const monthTimingSelect = document.getElementById('add-rec-month-timing-type');
    if (monthTimingSelect) monthTimingSelect.value = d.monthTiming || 'specific_day';
    const monthDayInput = document.getElementById('add-rec-month-day');
    if (monthDayInput) monthDayInput.value = d.monthDay || 1;

    // Restore Weekday pills
    if (d.weekdays && Array.isArray(d.weekdays)) {
      document.querySelectorAll('#add-weekday-pills .weekday-pill').forEach(p => {
        p.classList.toggle('active', d.weekdays.includes(Number(p.dataset.day)));
      });
    }

    // 6-Axis Matrix
    if (typeof setMatrixValues === 'function') {
      const mat = d.matrix || (typeof DEFAULT_MATRIX !== 'undefined' ? DEFAULT_MATRIX : {});
      setMatrixValues('add-habit', mat);
    }

    // Cascade Selects
    if (typeof updateMinorSelectOptions === 'function') {
      const domMaj = document.getElementById('add-domain-major');
      if (domMaj) {
        domMaj.value = d.domainMajor || '';
        updateMinorSelectOptions('add-domain-major', 'add-domain-minor', DOMAINS_DATA, d.domainMinor);
      }
      const deptMaj = document.getElementById('add-dept-major');
      if (deptMaj) {
        deptMaj.value = d.deptMajor || '';
        updateMinorSelectOptions('add-dept-major', 'add-dept-minor', DEPTS_DATA, d.deptMinor);
      }
      const projMaj = document.getElementById('add-proj-major');
      if (projMaj) {
        projMaj.value = d.projMajor || '';
        updateMinorSelectOptions('add-proj-major', 'add-proj-minor', PROJECTS_DATA, d.projMinor);
      }
    }

    // Tags & Notes
    const addHabitTagsInput = document.getElementById('add-habit-tags');
    if (addHabitTagsInput) {
      addHabitTagsInput.value = '';
      if (typeof renderTagSuggestions === 'function') {
        renderTagSuggestions('add-habit-tag-suggestions', 'add-habit-tags');
      }
    }
    const addHabitNotesInput = document.getElementById('add-habit-notes');
    if (addHabitNotesInput) addHabitNotesInput.value = '';

    modal.classList.add('active');
    setTimeout(() => {
      if (nameInput) nameInput.focus();
    }, 50);
  } catch (err) {
    console.error('Error in openAddModal:', err);
    const modal = document.getElementById('modal-add-habit');
    if (modal) modal.classList.add('active');
  }
}

function openEditModal(habitId) {
  const habit = state.habits.find(h => h.id === habitId);
  if (!habit) return;

  const modal = document.getElementById('modal-edit-habit');
  if (!modal) return;

  document.getElementById('edit-habit-id').value = habit.id;
  document.getElementById('edit-habit-id-badge').textContent = habit.id;
  const movingAvgMin = (typeof calculateMovingAverageDuration === 'function') ? calculateMovingAverageDuration(habit, 'habit') : (habit.targetMin || 5);
  document.getElementById('edit-habit-min').value = habit.targetMin || movingAvgMin;
  const editHabitTagsInput = document.getElementById('edit-habit-tags');
  if (editHabitTagsInput) {
    editHabitTagsInput.value = normalizeTags(habit.tags).join(', ');
    if (typeof renderTagSuggestions === 'function') {
      renderTagSuggestions('edit-habit-tag-suggestions', 'edit-habit-tags');
    }
  }
  const editHabitNotesInput = document.getElementById('edit-habit-notes');
  if (editHabitNotesInput) {
    editHabitNotesInput.value = habit.notes || '';
  }

  // Display Period
  const startEl = document.getElementById('edit-habit-display-start');
  const endEl = document.getElementById('edit-habit-display-end');
  if (startEl) startEl.value = habit.displayStartDate || '';
  if (endEl) endEl.value = habit.displayEndDate || '';

  // Timing
  const type = habit.displayType || 'section';
  state.selectedEditTimingType = type;
  document.querySelectorAll('#edit-timing-type-selector .segment-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === type);
  });
  const panelSec = document.getElementById('edit-panel-timing-section');
  const panelCustom = document.getElementById('edit-panel-timing-custom');
  if (panelSec) panelSec.classList.toggle('hidden', type !== 'section');
  if (panelCustom) panelCustom.classList.toggle('hidden', type !== 'custom');

  if (habit.section && document.getElementById('edit-habit-section')) {
    document.getElementById('edit-habit-section').value = habit.section;
  }
  if (habit.customStart && document.getElementById('edit-custom-start')) {
    document.getElementById('edit-custom-start').value = habit.customStart;
  }
  if (habit.customEnd && document.getElementById('edit-custom-end')) {
    document.getElementById('edit-custom-end').value = habit.customEnd;
  }

  // Recurrence
  const rec = habit.recurrence || { type: 'everyday' };
  const recType = rec.type || 'everyday';
  state.selectedEditRecType = recType;
  document.querySelectorAll('#edit-recurrence-type-selector .segment-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.type === recType);
  });

  const editRecPanels = {
    daily_times: document.getElementById('edit-panel-rec-daily-times'),
    custom_days: document.getElementById('edit-panel-rec-custom-days'),
    weekly_goal: document.getElementById('edit-panel-rec-weekly-goal'),
    interval: document.getElementById('edit-panel-rec-interval'),
    monthly: document.getElementById('edit-panel-rec-monthly')
  };
  Object.entries(editRecPanels).forEach(([k, p]) => {
    if (p) p.classList.toggle('hidden', k !== recType);
  });

  if (recType === 'daily_times') {
    const editDailyTimesEl = document.getElementById('edit-rec-daily-times');
    if (editDailyTimesEl) editDailyTimesEl.value = rec.timesPerDay || 2;
  } else if (recType === 'weekly_goal') {
    const editWeeklyTimesEl = document.getElementById('edit-rec-weekly-times');
    if (editWeeklyTimesEl) editWeeklyTimesEl.value = rec.timesPerWeek || 3;
  } else if (recType === 'interval') {
    const editIntervalEl = document.getElementById('edit-rec-interval-days');
    if (editIntervalEl) editIntervalEl.value = rec.intervalDays || 2;
  } else if (recType === 'monthly') {
    const editMonthInt = document.getElementById('edit-rec-month-interval');
    if (editMonthInt) editMonthInt.value = rec.monthInterval || 1;
    const editMonthTiming = document.getElementById('edit-rec-month-timing-type');
    if (editMonthTiming) editMonthTiming.value = rec.timingType || 'specific_day';
    const editMonthDay = document.getElementById('edit-rec-month-day');
    if (editMonthDay) editMonthDay.value = rec.monthDay || 1;
  }

  // 6-Axis Load Matrix
  if (typeof setMatrixValues === 'function') {
    setMatrixValues('edit-habit', {
      importance: habit.importance || 'mid',
      urgency: habit.urgency || 'mid',
      mentalLoad: habit.mentalLoad || 'mid',
      physicalLoad: habit.physicalLoad || 'mid',
      frogLevel: habit.frogLevel || (habit.frogLevel ? (habit.frogLevel >= 4 ? 'high' : habit.frogLevel <= 2 ? 'low' : 'mid') : 'mid'),
      interestLevel: habit.interestLevel || 'mid'
    });
  }

  // Cascade Selects
  const domMaj = document.getElementById('edit-domain-major');
  if (domMaj) {
    domMaj.value = habit.domainMajor || '';
    updateMinorSelectOptions('edit-domain-major', 'edit-domain-minor', DOMAINS_DATA, habit.domainMinor || habit.domain);
  }
  const deptMaj = document.getElementById('edit-dept-major');
  if (deptMaj) {
    deptMaj.value = habit.deptMajor || '';
    updateMinorSelectOptions('edit-dept-major', 'edit-dept-minor', DEPTS_DATA, habit.deptMinor || habit.dept);
  }
  const projMaj = document.getElementById('edit-proj-major');
  if (projMaj) {
    projMaj.value = habit.projMajor || '';
    updateMinorSelectOptions('edit-proj-major', 'edit-proj-minor', PROJECTS_DATA, habit.projMinor || habit.proj);
  }

  modal.classList.add('active');
}

// =========================================================================
// 8. Cloud Sync Modal Handlers
// =========================================================================

function openCloudSyncModal() {
  const modal = document.getElementById('modal-cloud-sync');
  if (!modal) return;

  const urlInput = document.getElementById('cloud-sync-gas-url');
  const statusEl = document.getElementById('cloud-sync-modal-status');
  const curUrl = getGasApiUrl();

  if (urlInput) {
    urlInput.value = curUrl;
  }
  if (statusEl) {
    if (curUrl) {
      const meta = getSyncMetadata();
      statusEl.textContent = `🟢 接続設定済 (最終更新: ${meta.lastUpdatedAt ? new Date(meta.lastUpdatedAt).toLocaleString() : '未同期'})`;
      statusEl.style.color = '#4ade80';
    } else {
      statusEl.textContent = 'ステータス: 未設定（ローカル単体動作中）';
      statusEl.style.color = 'var(--text-dim)';
    }
  }

  modal.classList.add('active');
}

function saveCloudSyncSettings() {
  const urlInput = document.getElementById('cloud-sync-gas-url');
  const statusEl = document.getElementById('cloud-sync-modal-status');
  if (!urlInput) return;

  const newUrl = urlInput.value.trim();
  setGasApiUrl(newUrl);

  if (newUrl) {
    if (statusEl) {
      statusEl.textContent = '🔄 クラウドへPCのデータを送信中...';
      statusEl.style.color = '#38bdf8';
    }
    pushDataToCloud().then(() => {
      if (statusEl) {
        statusEl.textContent = '🟢 送信成功！PCのデータがクラウドに保存されました';
        statusEl.style.color = '#4ade80';
      }
      setTimeout(() => closeModal(), 1500);
    }).catch(err => {
      console.error(err);
      if (statusEl) {
        statusEl.textContent = '⚠️ 接続エラー: URLを確認してください';
        statusEl.style.color = '#f87171';
      }
    });
  } else {
    if (statusEl) {
      statusEl.textContent = 'ステータス: URLが解除されました';
      statusEl.style.color = 'var(--text-dim)';
    }
    updateSyncStatus('local');
  }
}

function testCloudSyncPull() {
  const statusEl = document.getElementById('cloud-sync-modal-status');
  if (!getGasApiUrl()) {
    alert('先にGASウェブアプリURLを入力してください');
    return;
  }
  if (statusEl) {
    statusEl.textContent = '📥 クラウドから最新データを取得中...';
    statusEl.style.color = '#38bdf8';
  }
  pullDataFromCloud(true).then(() => {
    if (statusEl) {
      statusEl.textContent = '🟢 クラウドから最新データを取得しました！';
      statusEl.style.color = '#4ade80';
    }
  });
}

function testCloudSyncPush() {
  const statusEl = document.getElementById('cloud-sync-modal-status');
  if (!getGasApiUrl()) {
    alert('先にGASウェブアプリURLを入力してください');
    return;
  }
  if (statusEl) {
    statusEl.textContent = '📤 クラウドへデータを送信中...';
    statusEl.style.color = '#38bdf8';
  }
  pushDataToCloud().then(() => {
    if (statusEl) {
      statusEl.textContent = '🟢 クラウドへ正常に送信完了しました！';
      statusEl.style.color = '#4ade80';
    }
  });
}

function clearCloudSyncSettings() {
  if (confirm('クラウド同期URLの設定を解除しますか？（ローカルデータはそのまま保持されます）')) {
    setGasApiUrl('');
    const urlInput = document.getElementById('cloud-sync-gas-url');
    const statusEl = document.getElementById('cloud-sync-modal-status');
    if (urlInput) urlInput.value = '';
    if (statusEl) {
      statusEl.textContent = 'ステータス: 未設定（ローカル単体動作中）';
      statusEl.style.color = 'var(--text-dim)';
    }
    updateSyncStatus('local');
  }
}

