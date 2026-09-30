/**
 * Habit Flow - Core Logic & Keyboard Engine
 * Fully customized for 蜩ｲ逕・(AI Company OS & Personal OS Engine)
 * Enhanced with 3-Way Timing Selector (Anytime / Section / Custom Range)
 */

// Master Definitions (SECTIONS_CONFIG, DOMAINS_DATA, DEPTS_DATA, PROJECTS_DATA, MATRIX_KEYS, DEFAULT_MATRIX)
// are loaded from js/config.js

// =========================================================================
// 1-B. UNDO History Engine & 6-Axis Load/Evaluation Matrix Helpers
// =========================================================================







// 2-Step Cascade Select Helpers
function openObsidianLink(rawUri, event) {
  if (event) event.stopPropagation();
  if (!rawUri || !String(rawUri).trim()) return;
  const uri = String(rawUri).trim();
  let targetUrl = uri;
  if (!uri.startsWith('obsidian://') && !uri.startsWith('http://') && !uri.startsWith('https://')) {
    const cleanPath = uri.replace(/\.md$/i, '');
    targetUrl = `obsidian://open?vault=obsidian%20folder&file=${encodeURIComponent(cleanPath)}`;
  }
  window.open(targetUrl, '_blank');
}

// [Removed duplicate updateMinorSelectOptions - delegated to profileMasterService.js]

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
var state = {
  habits: loadHabits(),
  tasks: loadTasks(),
  goals: loadGoals(),
  manifesto: loadManifesto(),
  goalsSubmode: 'front', // 'front' (4螟ｧ逶ｮ讓吶げ繝ｪ繝・ラ) | 'back' (鬲ゅ・螳｣隱薙・繝九ヵ繧ｧ繧ｹ繝・
  taskPresets: loadTaskPresets(),
  customTags: typeof loadCustomTags === 'function' ? loadCustomTags() : [],
  activeHabitId: null,
  activeTaskId: null,
  selectedIndex: 0,
  focusTaskIndex: 0,
  focusHabitIndex: 0,
  focusCount: (function() {
    try {
      const saved = parseInt(localStorage.getItem('gendrive_focus_count'), 10);
      return [1, 2, 3].includes(saved) ? saved : 1;
    } catch (e) {
      return 1;
    }
  })(),
  currentMode: 'section', // 'section' | 'focus' | 'all' | 'table' | 'bucket' | 'goals'
  currentBucketFilter: null, // { type: 'bucket' | 'label', id: string }
  viewType: 'all', // 'all' | 'task' | 'habit'
  masterSubtab: 'analytics', // 'analytics' | 'habits' | 'tasks' | 'single_tasks' | 'profiles'
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
    return Array.from(new Set(raw.split(/[,縲―s]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean)));
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

  // 繝ｦ繝ｼ繧ｶ繝ｼ縺御ｽ懈・縺励◆繧ｫ繧ｹ繧ｿ繝繧ｿ繧ｰ・医ち繧ｹ繧ｯ譛ｪ逋ｻ骭ｲ縺ｧ繧ゆｿ晄戟・・
  if (Array.isArray(state.customTags)) {
    state.customTags.forEach(t => {
      const clean = String(t).trim().replace(/^#/, '');
      if (clean && !tagCounts.hasOwnProperty(clean)) {
        tagCounts[clean] = 0;
      }
    });
  }

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

// -------------------------------------------------------------------------
// Tag Management Actions: Create, Rename, Delete & Right-Click Context Menu
// -------------------------------------------------------------------------

function updateAllItemsTag(oldTag, newTag, mode) {
  const cleanOld = oldTag ? String(oldTag).trim().replace(/^#/, '') : '';
  const cleanNew = newTag ? String(newTag).trim().replace(/^#/, '') : '';

  let affectedCount = 0;

  const updateItemTags = (item) => {
    if (!item) return;
    let tags = normalizeTags(item.tags);

    if (mode === 'rename') {
      if (tags.includes(cleanOld)) {
        tags = tags.map(t => (t === cleanOld ? cleanNew : t));
        tags = Array.from(new Set(tags));
        affectedCount++;
      }
    } else if (mode === 'delete') {
      if (tags.includes(cleanOld)) {
        tags = tags.filter(t => t !== cleanOld);
        affectedCount++;
      }
    } else if (mode === 'add') {
      if (!tags.includes(cleanNew)) {
        tags.push(cleanNew);
        affectedCount++;
      }
    }

    item.tags = tags;
  };

  if (Array.isArray(state.tasks)) state.tasks.forEach(updateItemTags);
  if (Array.isArray(state.habits)) state.habits.forEach(updateItemTags);
  if (Array.isArray(state.taskPresets)) state.taskPresets.forEach(updateItemTags);

  // 繧ｫ繧ｹ繧ｿ繝繧ｿ繧ｰ繝励・繝ｫ縺ｮ譖ｴ譁ｰ
  if (Array.isArray(state.customTags)) {
    if (mode === 'rename') {
      state.customTags = state.customTags.map(t => (t === cleanOld ? cleanNew : t));
    } else if (mode === 'delete') {
      state.customTags = state.customTags.filter(t => t !== cleanOld);
    } else if (mode === 'add') {
      if (!state.customTags.includes(cleanNew)) state.customTags.push(cleanNew);
    }
  }

  // 繝輔ぅ繝ｫ繧ｿ迥ｶ諷九・蜷梧悄
  if (state.filters) {
    if (state.filters.includeTags) {
      if (mode === 'rename') {
        state.filters.includeTags = state.filters.includeTags.map(t => (t === cleanOld ? cleanNew : t));
      } else if (mode === 'delete') {
        state.filters.includeTags = state.filters.includeTags.filter(t => t !== cleanOld);
      }
    }
    if (state.filters.excludeTags) {
      if (mode === 'rename') {
        state.filters.excludeTags = state.filters.excludeTags.map(t => (t === cleanOld ? cleanNew : t));
      } else if (mode === 'delete') {
        state.filters.excludeTags = state.filters.excludeTags.filter(t => t !== cleanOld);
      }
    }
  }

  // 豌ｸ邯壼喧菫晏ｭ・
  if (typeof saveTasks === 'function') saveTasks();
  if (typeof saveHabits === 'function') saveHabits();
  if (typeof saveTaskPresets === 'function') saveTaskPresets();
  if (typeof saveCustomTags === 'function') saveCustomTags();

  return affectedCount;
}

function promptCreateNewTag(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  closeTagContextMenu();

  const rawName = window.prompt('🏷️ 新しいタグ名を入力してください（例: 英語学習, 経理）:');
  if (!rawName) return;

  const cleanName = rawName.trim().replace(/^#/, '');
  if (!cleanName) return;

  if (!state.customTags) state.customTags = [];
  if (!state.customTags.includes(cleanName)) {
    state.customTags.push(cleanName);
  }
  if (typeof saveCustomTags === 'function') saveCustomTags();

  // もしマスター画面でアイテムが選択されていれば、それらに一括付与するか確認
  const selectedIds = state.selectedTableItemIds ? Array.from(state.selectedTableItemIds) : [];
  if (selectedIds.length > 0) {
    const shouldApply = window.confirm(`現在選択中の ${selectedIds.length} 件のデータに「${cleanName}」を一括付与しますか？`);
    if (shouldApply) {
      selectedIds.forEach(id => {
        const item = (state.tasks && state.tasks.find(t => String(t.id) === String(id))) ||
                     (state.habits && state.habits.find(h => String(h.id) === String(id)));
        if (item) {
          const current = normalizeTags(item.tags);
          if (!current.includes(cleanName)) {
            current.push(cleanName);
            item.tags = current;
          }
        }
      });
      if (typeof saveTasks === 'function') saveTasks();
      if (typeof saveHabits === 'function') saveHabits();
    }
  }

  renderApp();
  if (typeof showUndoToast === 'function') {
    showUndoToast(`🏷️ タグ「${cleanName}」を作成しました`, true);
  }
}

function promptRenameTag(tagName) {
  closeTagContextMenu();
  const cleanOld = tagName.trim().replace(/^#/, '');
  const rawNew = window.prompt(`✏️ タグ「${cleanOld}」の新しい名前を入力してください:`, cleanOld);
  if (!rawNew) return;

  const cleanNew = rawNew.trim().replace(/^#/, '');
  if (!cleanNew || cleanNew === cleanOld) return;

  const affectedCount = updateAllItemsTag(cleanOld, cleanNew, 'rename');

  renderApp();
  if (typeof showUndoToast === 'function') {
    showUndoToast(`✏️ タグ「${cleanOld}」を「${cleanNew}」に変更しました（${affectedCount}件反映）`, true);
  }
}

function promptDeleteTag(tagName) {
  closeTagContextMenu();
  const cleanTag = tagName.trim().replace(/^#/, '');

  let count = 0;
  const countInItem = (item) => {
    if (normalizeTags(item?.tags).includes(cleanTag)) count++;
  };
  if (Array.isArray(state.tasks)) state.tasks.forEach(countInItem);
  if (Array.isArray(state.habits)) state.habits.forEach(countInItem);
  if (Array.isArray(state.taskPresets)) state.taskPresets.forEach(countInItem);

  const confirmMsg = count > 0
    ? `🗑️ タグ「${cleanTag}」を登録中の全データ (${count}件) から削除しますか？\n（※タスク自体は消去されず、タグのみ外れます）`
    : `🗑️ タグ「${cleanTag}」を削除しますか？`;

  if (!window.confirm(confirmMsg)) return;

  updateAllItemsTag(cleanTag, '', 'delete');

  renderApp();
  if (typeof showUndoToast === 'function') {
    showUndoToast(`🗑️ タグ「${cleanTag}」を削除しました`, true);
  }
}

function showTagContextMenu(e, tagName) {
  e.preventDefault();
  e.stopPropagation();

  let menu = document.getElementById('tag-context-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'tag-context-menu';
    menu.className = 'tag-context-menu';
    document.body.appendChild(menu);
  }

  if (tagName) {
    menu.innerHTML = `
      <div class="tag-menu-header">🏷️ #${tagName}</div>
      <div class="tag-menu-item" onclick="promptRenameTag('${tagName}')">
        <span class="tag-menu-icon">✏️</span> タグ名を変更 (リネーム)
      </div>
      <div class="tag-menu-item danger" onclick="promptDeleteTag('${tagName}')">
        <span class="tag-menu-icon">🗑️</span> タグを一括削除 (全データから外す)
      </div>
      <div class="tag-menu-divider"></div>
      <div class="tag-menu-item" onclick="filterBySingleTag('${tagName}', 'include')">
        <span class="tag-menu-icon">🎯</span> このタグのみで絞り込み
      </div>
      <div class="tag-menu-item" onclick="filterBySingleTag('${tagName}', 'exclude')">
        <span class="tag-menu-icon">🚫</span> このタグを除外
      </div>
      <div class="tag-menu-divider"></div>
      <div class="tag-menu-item" onclick="promptCreateNewTag(event)">
        <span class="tag-menu-icon">➕</span> 新しいタグを作成
      </div>
    `;
  } else {
    menu.innerHTML = `
      <div class="tag-menu-header">🏷️ タグ管理</div>
      <div class="tag-menu-item" onclick="promptCreateNewTag(event)">
        <span class="tag-menu-icon">➕</span> 新しいタグを作成
      </div>
    `;
  }

  menu.style.display = 'block';
  const menuWidth = 220;
  const menuHeight = menu.offsetHeight || 160;
  let left = e.clientX;
  let top = e.clientY;

  if (left + menuWidth > window.innerWidth - 10) {
    left = window.innerWidth - menuWidth - 10;
  }
  if (top + menuHeight > window.innerHeight - 10) {
    top = window.innerHeight - menuHeight - 10;
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}
function closeTagContextMenu() {
  const menu = document.getElementById('tag-context-menu');
  if (menu) menu.style.display = 'none';
}

function filterBySingleTag(tagName, type) {
  closeTagContextMenu();
  const clean = tagName.trim().replace(/^#/, '');
  if (!state.filters) state.filters = {};
  if (type === 'include') {
    state.filters.includeTags = [clean];
    state.filters.excludeTags = [];
  } else {
    state.filters.includeTags = [];
    state.filters.excludeTags = [clean];
  }
  renderApp();
}

window.addEventListener('click', (e) => {
  if (!e.target.closest('#tag-context-menu')) {
    closeTagContextMenu();
  }
});

function renderSmartTagBar() {
  const container = document.getElementById('smart-tag-bar-container');
  const listEl = document.getElementById('smart-tag-chips-list');
  if (!container || !listEl) return;

  // 陦ｨ遉ｺ蟇ｾ雎｡繝｢繝ｼ繝・ section (1 繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ), all (3 繝・う繝ｪ繝ｼ), table (4 繝槭せ繧ｿ繝ｼ)
  // 髱櫁｡ｨ遉ｺ蟇ｾ雎｡繝｢繝ｼ繝・ focus (2 繝輔か繝ｼ繧ｫ繧ｹ), goals (5 繝薙ず繝ｧ繝ｳ), timer (6 繧ｿ繧､繝槭・)
  const isTagBarEnabled = state && ['section', 'all', 'table'].includes(state.currentMode);
  if (!isTagBarEnabled) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  // 遨ｺ縺埼伜沺蜿ｳ繧ｯ繝ｪ繝・け縺ｧ譁ｰ隕上ち繧ｰ菴懈・繝｡繝九Η繝ｼ
  container.oncontextmenu = (e) => {
    if (e.target.closest('.quick-tag-chip') || e.target.closest('.btn-add-tag-fixed')) return;
    showTagContextMenu(e, null);
  };

  const allTags = getAllRegisteredTags();
  const incList = state.filters.includeTags || [];
  const excList = state.filters.excludeTags || [];

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
    let hint = '蟾ｦ繧ｯ繝ｪ繝・け: 邨櫁ｾｼ / 蜿ｳ繧ｯ繝ｪ繝・け: 蜑企勁繝ｻ蜷榊燕螟画峩';
    if (isInc) {
      stateCls = 'include';
      icon = '<span class="chip-state-icon">笨・/span>';
      hint = '蟾ｦ繧ｯ繝ｪ繝・け: 髯､螟・/ 蜿ｳ繧ｯ繝ｪ繝・け: 蜑企勁繝ｻ蜷榊燕螟画峩';
    } else if (isExc) {
      stateCls = 'exclude';
      icon = '<span class="chip-state-icon">圻</span>';
      hint = '蟾ｦ繧ｯ繝ｪ繝・け: 隗｣髯､ / 蜿ｳ繧ｯ繝ｪ繝・け: 蜑企勁繝ｻ蜷榊燕螟画峩';
    }

    return `
      <div class="quick-tag-chip ${stateCls}"
           onclick="toggleTagFilter('${name}')"
           oncontextmenu="showTagContextMenu(event, '${name}')"
           title="#${name} (${hint})">
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
        ${isSelected ? '笨・' : '+ '}#${name}
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



function sanitizeDailyState() {
  const todayKey = typeof getTodayKey === 'function' ? getTodayKey() : new Date().toLocaleDateString('sv');
  let changed = false;

  (state.tasks || []).forEach(task => {
    const isRec = typeof isRecurringTaskItem === 'function' ? isRecurringTaskItem(task) : (task.type === 'recurring' || task.taskType === 'recurring' || Boolean(task.recType));
    
    // 鄙梧悃繧ｴ繝ｼ繧ｹ繝亥ｮ溯｡御ｸｭ繝ｻ荳ｭ譁ｭ荳ｭ繧ｵ繝九ち繧､繧ｺ: 蜑肴律莉･蜑阪↓髢句ｧ九＆繧後◆繧ｿ繧､繝槭・縲｛rphan縺ｪ繧ｿ繧､繝槭・縲・2譎る俣莉･荳翫・逡ｰ蟶ｸ邨碁℃繧貞ｮ牙・縺ｫuncompleted縺ｸ蛻晄悄蛹・
    if (task._localUpdatedAt && Date.now() - task._localUpdatedAt < 120000) return; if (task.status === 'in_progress' || task.status === 'paused') {
      const startKey = task.startTimestamp ? (typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(new Date(task.startTimestamp)) : null) : null;
      const isFromDifferentDay = Boolean(startKey && startKey !== todayKey);
      const isOrphan = !task.startTimestamp;
      const isOverdue = task.startTimestamp && (Date.now() - task.startTimestamp > 12 * 60 * 60 * 1000);
      const isAbnormalDuration = (task.accumulatedSeconds || 0) > 12 * 60 * 60;
      if (isFromDifferentDay || isOrphan || isOverdue || isAbnormalDuration) {
        task.status = 'uncompleted';
        task.startTimestamp = null;
        task.accumulatedSeconds = 0;
        task.actStart = null;
        task.actEnd = null;
        if (String(state.activeTaskId) === String(task.id)) {
          state.activeTaskId = null;
        }
        changed = true;
      }
    }

    if (isRec) {
      if (task.status === 'completed') {
        const hasTodayHistory = (Array.isArray(task.history) && task.history.some(h => h && (h.date === todayKey || h === todayKey))) ||
                                (task.history && typeof task.history === 'object' && (task.history[todayKey] === true || task.history[todayKey]?.done));
        const hasTodayLog = Array.isArray(task.executionLogs) && task.executionLogs.some(l => l && l.dateKey === todayKey);
        if (!hasTodayHistory && !hasTodayLog) {
          task.status = 'uncompleted';
          task.actEnd = null;
          task.accumulatedSeconds = 0;
          changed = true;
        }
      } else if (task.status === 'skipped') {
        // 鄙梧悃繧ｹ繧ｭ繝・・閾ｪ蜍募ｾｩ蜈・ 蠖捺律縺ｮ繧ｹ繧ｭ繝・・險倬鹸縺後↑縺代ｌ縺ｰuncompleted縺ｸ閾ｪ蟾ｱ菫ｮ蠕ｩ
        const isSkippedToday = (typeof isTaskSkippedForDate === 'function')
          ? isTaskSkippedForDate(task, todayKey)
          : (Array.isArray(task.skippedDates) ? task.skippedDates.includes(todayKey) : (task.skippedDateKey === todayKey));
        if (!isSkippedToday) {
          task.status = 'uncompleted';
          changed = true;
        }
      }
    }
  });

  (state.habits || []).forEach(habit => {
    // 鄙梧悃繧ｴ繝ｼ繧ｹ繝亥ｮ溯｡御ｸｭ繝ｻ荳ｭ譁ｭ荳ｭ繧ｵ繝九ち繧､繧ｺ: 蜑肴律莉･蜑阪↓髢句ｧ九＆繧後◆繧ｿ繧､繝槭・縲｛rphan縺ｪ繧ｿ繧､繝槭・縲・2譎る俣莉･荳翫・逡ｰ蟶ｸ邨碁℃繧貞ｮ牙・縺ｫuncompleted縺ｸ蛻晄悄蛹・
    if (habit._localUpdatedAt && Date.now() - habit._localUpdatedAt < 120000) return; if (habit.status === 'in_progress' || habit.status === 'paused') {
      const startKey = habit.startTimestamp ? (typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(new Date(habit.startTimestamp)) : null) : null;
      const isFromDifferentDay = Boolean(startKey && startKey !== todayKey);
      const isOrphan = !habit.startTimestamp;
      const isOverdue = habit.startTimestamp && (Date.now() - habit.startTimestamp > 12 * 60 * 60 * 1000);
      const isAbnormalDuration = (habit.accumulatedSeconds || 0) > 12 * 60 * 60; // 12譎る俣莉･荳翫・逡ｰ蟶ｸ遨咲ｮ・
      if (isFromDifferentDay || isOrphan || isOverdue || isAbnormalDuration) {
        habit.status = 'uncompleted';
        habit.startTimestamp = null;
        habit.accumulatedSeconds = 0;
        habit.actStart = null;
        habit.actEnd = null;
        if (String(state.activeHabitId) === String(habit.id)) {
          state.activeHabitId = null;
        }
        changed = true;
      }
    }

    const curCount = typeof getHabitDayCount === 'function' ? getHabitDayCount(habit, todayKey) : 0;
    const targetTimes = typeof getHabitTargetTimes === 'function' ? getHabitTargetTimes(habit) : 1;

    if (habit.status === 'skipped') {
      const hasTodayDone = Boolean(habit.history && (habit.history[todayKey] === true || habit.history[todayKey]?.done));
      if (!hasTodayDone && habit.skippedDateKey && habit.skippedDateKey !== todayKey) {
        habit.status = 'uncompleted';
        changed = true;
      }
    }

    // 当日完了実ログ絶対基準サニタイズ（実ログのない不正完了・汚染historyの自動即時正常化）
    const dayLogs = Array.isArray(habit.executionLogs)
      ? habit.executionLogs.filter(log => log && (log.dateKey === todayKey || (log.completedAt && log.completedAt.startsWith(todayKey))) && log.status !== 'cancelled')
      : [];
    const curTodayLogCount = dayLogs.length > 0 ? Math.max(...dayLogs.map(l => l.count || 1)) : 0;
    const hasLegitToday = curTodayLogCount >= targetTimes && targetTimes > 0;
    const isRecentLocal = habit._localUpdatedAt && (Date.now() - habit._localUpdatedAt < 120000);

    if (!isRecentLocal && !hasLegitToday) {
      if (habit.status === 'completed') {
        habit.status = 'uncompleted';
        habit.accumulatedSeconds = 0;
        habit.actMin = 0;
        changed = true;
      }
      if (habit.history && habit.history[todayKey]) {
        delete habit.history[todayKey];
        changed = true;
      }
      if (Array.isArray(habit.history) && habit.history.includes(todayKey)) {
        habit.history = habit.history.filter(d => d !== todayKey);
        changed = true;
      }
    }
  });

  if (changed) {
    saveTasks();
    saveHabits();
  }
}

function getHabitStatusForSelectedDate(habit) {
  if (!habit) return 'uncompleted';
  const k = getSelectedDateKey();

  // 1. 未来日は常に未完了
  if (state.selectedDateOffset < 0) return 'uncompleted';

  // 2. スキップ判定
  if (habit.status === 'skipped') {
    const todayKey = typeof getTodayKey === 'function' ? getTodayKey() : k;
    if (k === todayKey || habit.skippedDateKey === k) return 'skipped';
  }

  const targetTimes = (typeof getHabitTargetTimes === 'function') ? getHabitTargetTimes(habit) : (habit.targetTimes || 1);

  // 3. 有効な executionLogs の有無を厳格に照合（実ログ基準）
  const dayLogs = Array.isArray(habit.executionLogs)
    ? habit.executionLogs.filter(log => log && (log.dateKey === k || (log.completedAt && log.completedAt.startsWith(k))) && log.status !== 'cancelled')
    : [];
  const curLogCount = dayLogs.length > 0 ? Math.max(...dayLogs.map(l => l.count || 1)) : 0;

  if (curLogCount >= targetTimes && targetTimes > 0) {
    return 'completed';
  }

  // 過去日のレガシー履歴フォールバック（過去日かつ実ログがない場合のみhistoryを許容、今日(selectedDateOffset === 0)は実ログ絶対基準）
  if (state.selectedDateOffset > 0) {
    const hasHistoryDone = Array.isArray(habit.history) ? habit.history.includes(k) : Boolean(habit.history && (habit.history[k] === true || habit.history[k]?.done));
    if (hasHistoryDone) return 'completed';
  }

  // 4. 実行中・中断中判定（今日のみ）
  if (state.selectedDateOffset === 0) {
    if (habit.status === 'in_progress') return 'in_progress';
    if (habit.status === 'paused') return 'paused';
  }

  return 'uncompleted';
}

function getTaskStatusForSelectedDate(task) {
  if (!task) return 'uncompleted';
  const k = getSelectedDateKey();

  // 1. Future date is ALWAYS uncompleted (planning mode)
  if (state.selectedDateOffset < 0) {
    return 'uncompleted';
  }

  // 2. Check if task is skipped for this date
  if (typeof isTaskSkippedForDate === 'function' && isTaskSkippedForDate(task, k)) {
    return 'skipped';
  }
  if (task.status === 'skipped' && (!task.skippedDateKey || task.skippedDateKey === k)) {
    return 'skipped';
  }

  // 3. Recurring task: Check history array, history object, or execution logs for this date
  const isRec = typeof isRecurringTaskItem === 'function'
    ? isRecurringTaskItem(task)
    : (task.type === 'recurring' || task.taskType === 'recurring' || Boolean(task.recType));
  if (isRec) {
    if (Array.isArray(task.history)) {
      const hasDone = task.history.some(h => (typeof h === 'object' && h !== null && h.date === k && (h.done !== undefined ? h.done : true)) || (typeof h === 'string' && h === k));
      if (hasDone) return 'completed';
    } else if (task.history && typeof task.history === 'object') {
      const hEntry = task.history[k];
      if (hEntry === true || (hEntry && (hEntry.done !== undefined ? hEntry.done : true))) {
        return 'completed';
      }
    }
    if (Array.isArray(task.executionLogs)) {
      const hasLog = task.executionLogs.some(l => l && l.dateKey === k);
      if (hasLog) return 'completed';
    }
    if (task.status === 'completed') {
      return 'completed';
    }
    if (state.selectedDateOffset === 0) {
      if (task._localUpdatedAt && Date.now() - task._localUpdatedAt < 120000) return; if (task.status === 'in_progress' || task.status === 'paused') {
        return task.status;
      }
    }
    return 'uncompleted';
  }

  // 4. Single task
  if (state.selectedDateOffset === 0) {
    return task.status || 'uncompleted';
  }

  // 5. Past date: single task scheduled for that date
  return task.status || 'uncompleted';
}
function isTaskForSelectedDate(task, dateObj = null) {
  if (!task || task.isDisabled) return false;
  // 閾ｪ蜍慕函謌舌＆繧後◆螳壽悄繧ｿ繧ｹ繧ｯ縺ｮ繧ｯ繝ｭ繝ｼ繝ｳ蜊倡匱繧ｿ繧ｹ繧ｯ縺ｯ繝・う繝ｪ繝ｼ逕ｻ髱｢縺九ｉ髯､螟厄ｼ郁ｦｪ縺ｮ螳壽悄繧ｿ繧ｹ繧ｯ縺檎峩謗･陦ｨ遉ｺ繝ｻ邂｡逅・＆繧後ｋ縺溘ａ莠碁㍾陦ｨ遉ｺ繝ｻ莠碁㍾髮・ｨ医ｒ髦ｲ豁｢・・
  if (task.isRecurringInstance) return false;
  // Inbox, This Week, Next Week, Genius, Someday, Vault 縺ｪ縺ｩ縺ｮ蟆ら畑繝舌こ繝・ヨ縺ｮ繧ｿ繧ｹ繧ｯ縺ｯ繝・う繝ｪ繝ｼ逕ｻ髱｢縺九ｉ髯､螟・
  if (task.bucket && task.bucket !== 'today') return false;

  const isValidDateInput = (dateObj instanceof Date) || (typeof dateObj === 'string' && dateObj.length >= 8);
  const d = isValidDateInput ? new Date(dateObj) : (() => {
    const dt = new Date();
    dt.setDate(dt.getDate() - state.selectedDateOffset);
    return dt;
  })();
  const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayKey = getTodayKey();

  const isRec = task.type === 'recurring' || task.taskType === 'recurring' || Boolean(task.recType) || (Boolean(task.recurrence) && task.recurrence.type && task.recurrence.type !== 'none');

  // 1. 螳壽悄繧ｿ繧ｹ繧ｯ (Recurring Tasks)
  if (isRec) {
    // 驕主悉譌･・域乖譌･莉･蜑搾ｼ峨ｒ陦ｨ遉ｺ縺励※縺・ｋ蝣ｴ蜷医・縲∝ｮ壽悄繧ｿ繧ｹ繧ｯ縺ｯ髱櫁｡ｨ遉ｺ・域悴螳御ｺ・腰逋ｺ繧ｿ繧ｹ繧ｯ縺ｮ谿句ｭ倡｢ｺ隱阪ｒ荳逋ｺ縺ｧ謚頑升蜿ｯ閭ｽ縺ｫ縺吶ｋ縺溘ａ・・
    if (dateKey < todayKey) {
      return false;
    }
    return isHabitScheduledForDate(task, d);
  }

  // 2. 蜊倡匱繧ｿ繧ｹ繧ｯ (Single Tasks: bucket === 'today' 縺ｾ縺溘・ 譛ｪ謖・ｮ・
  if (task.scheduledDate) {
    const normDate = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(task.scheduledDate) : task.scheduledDate;
    return normDate === dateKey;
  }
  // scheduledDate縺梧悴謖・ｮ壹□縺悟ｮ御ｺ・ｸ医∩縺ｮ蝣ｴ蜷・ 螳御ｺ・Ο繧ｰ縺ｮ譌･莉倥ｒ蝓ｺ貅悶↓縺励※隧ｲ蠖捺律縺ｮ縺ｿ縺ｫ陦ｨ遉ｺ・井ｻ頑律縺ｸ縺ｮ繧ｾ繝ｳ繝捺ｵ∝・繧貞ｮ悟・驕ｮ譁ｭ・・
  if (task.status === 'completed') {
    let completedDate = null;
    if (Array.isArray(task.executionLogs) && task.executionLogs.length > 0 && task.executionLogs[0].dateKey) {
      completedDate = task.executionLogs[0].dateKey;
    } else if (Array.isArray(task.history) && task.history.length > 0) {
      const lastH = task.history[task.history.length - 1];
      completedDate = (typeof lastH === 'object' && lastH !== null) ? lastH.date : (typeof lastH === 'string' ? lastH : null);
    }
    if (completedDate) {
      const normCompDate = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(completedDate) : completedDate;
      return normCompDate === dateKey;
    }
    // 螳御ｺ・律繧ゆｸ肴・縺ｪ螳御ｺ・ｸ医∩繧ｿ繧ｹ繧ｯ縺ｯ繝・う繝ｪ繝ｼ逕ｻ髱｢縺ｫ縺ｯ陦ｨ遉ｺ縺励↑縺・ｼ医・繧ｹ繧ｿ繝ｼ繝懊・繝牙・縺ｧ邂｡逅・ｼ・
    return false;
  }
  // 譌･莉俶悴謖・ｮ壹・譛ｪ螳御ｺ・ち繧ｹ繧ｯ縺ｯ縲御ｻ頑律・・odayKey・峨阪↓陦ｨ遉ｺ
  return dateKey === todayKey;
}

function isHabitInCurrentTimeWindow(habit, targetSectionName = null) {
  if (!habit) return false;
  // targetSectionName縺梧枚蟄怜・莉･螟厄ｼ・ilter繧ｳ繝ｼ繝ｫ繝舌ャ繧ｯ縺ｮindex遲会ｼ峨・蝣ｴ蜷医・state.currentSection繧剃ｽｿ逕ｨ
  const actualTargetSec = (typeof targetSectionName === 'string') ? targetSectionName : state.currentSection;
  const normSecName = normalizeSectionName(actualTargetSec);
  const sectionConfig = SECTIONS_CONFIG.find(s => s.name === normSecName) || SECTIONS_CONFIG[0];
  const type = habit.displayType || habit.timingType || 'section';

  // 1. Anytime (1譌･荳ｭ陦ｨ遉ｺ): 縺ｩ縺ｮ繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ縺ｧ繧ょｸｸ縺ｫ陦ｨ遉ｺ
  if (type === 'anytime') {
    return true;
  }

  // 2. Section (繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ謖・ｮ・: 謖・ｮ壹そ繧ｯ繧ｷ繝ｧ繝ｳ縺ｨ螳悟・荳閾ｴ
  if (type === 'section') {
    return normalizeSectionName(habit.section) === normSecName;
  }

  // 3. Custom Time Range (蛟句挨譎る俣謖・ｮ・ 萓・11:00縲・2:00)
  if (type === 'custom') {
    if (!habit.customStart) return true; // 髢句ｧ区凾髢捺悴險ｭ螳壹↑繧牙ｸｸ譎り｡ｨ遉ｺ

    const [sH, sM] = String(habit.customStart).split(':').map(Number);
    const habitStart = (sH || 0) + (sM || 0) / 60;

    let habitEnd = habitStart + ((habit.targetMin || 30) / 60); // 邨ゆｺ・悴謖・ｮ壽凾縺ｮ繝輔か繝ｼ繝ｫ繝舌ャ繧ｯ
    if (habit.customEnd) {
      const [eH, eM] = String(habit.customEnd).split(':').map(Number);
      habitEnd = (eH || 0) + (eM || 0) / 60;
    }

    const isToday = state.selectedDateOffset === 0;

    if (isToday) {
      if (habit.status === 'in_progress' || habit.status === 'paused' || habit.status === 'completed') {
        return true;
      }
      const secStart = sectionConfig.start;
      const secEnd = sectionConfig.end;
      if (secStart <= secEnd) {
        if (habitStart <= habitEnd) {
          if (habitStart < secEnd && habitEnd > secStart) return true;
        } else {
          if (habitStart < secEnd || habitEnd > secStart) return true;
        }
      }

      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;

      if (habitStart <= habitEnd) {
        // 騾壼ｸｸ蛹ｺ髢・(萓・ 11:00 縲・12:00)
        return currentHour >= habitStart && currentHour < habitEnd;
      } else {
        // 譌･縺ｾ縺溘℃蛹ｺ髢・(萓・ 23:00 縲・01:00)
        return currentHour >= habitStart || currentHour < habitEnd;
      }
    }

    // B. 驕主悉譌･繝ｻ譛ｪ譚･譌･・郁ｨ育判遒ｺ隱阪・螻･豁ｴ遒ｺ隱肴凾・・
    // 繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ縺ｮ譎る俣譫縺ｨ譎る俣蟶ｯ縺碁㍾縺ｪ縺｣縺ｦ縺・ｋ縺句愛螳・
    const secStart = sectionConfig.start;
    const secEnd = sectionConfig.end;

    if (secStart <= secEnd) {
      if (habitStart <= habitEnd) {
        return habitStart < secEnd && habitEnd > secStart;
      } else {
        return habitStart < secEnd || habitEnd > secStart;
      }
    } else {
      if (habitStart <= habitEnd) {
        return habitEnd > secStart || habitStart < secEnd;
      } else {
        return true;
      }
    }
  }

  return false;
}

// 繝・う繝ｪ繝ｼ逕ｻ髱｢蟆ら畑: 髢句ｧ区凾髢薙′縺昴・繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ縺ｫ蜷ｫ縺ｾ繧後※縺・ｋ繝上ン繝・ヨ縺ｮ縺ｿ繧呈歓蜃ｺ・磯㍾隍・亟豁｢・・
function isHabitInDailySection(habit, sectionName) {
  if (!habit) return false;
  const normSecName = normalizeSectionName(sectionName);
  const sectionConfig = SECTIONS_CONFIG.find(s => s.name === normSecName) || SECTIONS_CONFIG[0];
  const type = habit.displayType || habit.timingType || 'section';

  // 1. Anytime: Anytime縺ｯ繝・う繝ｪ繝ｼ逕ｻ髱｢譛荳企Κ縺ｮ縲窟nytime繝悶Ο繝・け縲阪↓陦ｨ遉ｺ縺吶ｋ縺溘ａ縲∝推繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ縺ｫ縺ｯ驥崎､・｡ｨ遉ｺ縺励↑縺・
  if (type === 'anytime') {
    return false;
  }

  // 2. Section: 謖・ｮ壹そ繧ｯ繧ｷ繝ｧ繝ｳ縺ｨ螳悟・荳閾ｴ
  if (type === 'section') {
    return normalizeSectionName(habit.section) === normSecName;
  }

  // 3. Custom Time Range: 髢句ｧ区凾蛻ｻ・・ustomStart・峨′縺昴・繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ縺ｮ譎る俣蜀・↓縺ゅｋ蝣ｴ蜷医・縺ｿ陦ｨ遉ｺ
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
      // 譌･縺ｾ縺溘℃繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ
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

  // 1. Optimistic Direct DOM Mutation Guard (蜊ｳ譎・OM螳溯｡御ｸｭ驕ｷ遘ｻ繧ｬ繝ｼ繝・
  // 騾壻ｿ｡驕・ｻｶ繧・・逕ｻ髱｢renderApp()縺ｮ雋闕ｷ繧貞ｾ・◆縺壹・繝溘Μ遘偵〒蜊ｳ蠎ｧ縺ｫ繧ｫ繝ｼ繝峨ｒ繧ｨ繝｡繝ｩ繝ｫ繝峨げ繝ｪ繝ｼ繝ｳ縲娯酪 螳溯｡御ｸｭ縲阪∈蛻・ｊ譖ｿ縺医ｋ
  try {
    const cardEl = document.querySelector(`.habit-card[data-id="${targetId}"]`);
    if (cardEl) {
      cardEl.classList.remove('paused', 'completed', 'is-timescale-paused', 'dimmed-card');
      cardEl.classList.add('in-progress', 'is-timescale-active');
      cardEl.style.setProperty('--timescale-pct', '0%');
      
      const pill = cardEl.querySelector('.tc-status-pill');
      if (pill) {
        pill.className = 'tc-status-pill in-progress habit-pill clickable-pause';
        pill.setAttribute('onclick', `event.stopPropagation(); pauseHabit('${targetId}')`);
        pill.setAttribute('title', '繧ｯ繝ｪ繝・け縺励※荳譎ゆｸｭ譁ｭ [P]');
        pill.textContent = '笳・螳溯｡御ｸｭ';
      }

      const actionsDiv = cardEl.querySelector('.habit-actions');
      if (actionsDiv) {
        const actionBtn = actionsDiv.querySelector('.btn-habit-action.start, .btn-habit-action.resume, .btn-habit-action.revert');
        if (actionBtn) {
          actionBtn.className = 'btn-habit-action done';
          actionBtn.setAttribute('onclick', `event.stopPropagation(); promptCompleteHabit('${targetId}', event)`);
          actionBtn.removeAttribute('title');
          actionBtn.textContent = '✓ 完了';
        }
      }
    }

    // 先行タスクのDOM即時中断表示
    document.querySelectorAll('.task-card.in-progress').forEach(tCard => {
      const tId = tCard.getAttribute('data-id');
      tCard.classList.remove('in-progress', 'is-timescale-active');
      tCard.classList.add('paused', 'is-timescale-paused');
      const tPill = tCard.querySelector('.tc-status-pill');
      if (tPill) {
        tPill.className = 'tc-status-pill paused clickable-resume';
        tPill.setAttribute('onclick', `event.stopPropagation(); startTask('${tId}')`);
        tPill.setAttribute('title', 'クリックして作業を再開 [P]');
        tPill.textContent = '⏸️ 中断中';
      }
      const tActionBtn = tCard.querySelector('.btn-task-action.pause, .btn-task-action.done');
      if (tActionBtn) {
        tActionBtn.className = 'btn-task-action resume';
        tActionBtn.setAttribute('onclick', `event.stopPropagation(); startTask('${tId}')`);
        tActionBtn.setAttribute('title', '作業を再開');
        tActionBtn.textContent = '▶ 再開';
      }
    });

    // 先行ハビットのDOM即時中断表示
    document.querySelectorAll(`.habit-card.in-progress:not([data-id="${targetId}"])`).forEach(hCard => {
      const hId = hCard.getAttribute('data-id');
      hCard.classList.remove('in-progress', 'is-timescale-active');
      hCard.classList.add('paused', 'is-timescale-paused');
      const hPill = hCard.querySelector('.tc-status-pill');
      if (hPill) {
        hPill.className = 'tc-status-pill paused habit-pill clickable-resume';
        hPill.setAttribute('onclick', `event.stopPropagation(); startHabit('${hId}')`);
        hPill.setAttribute('title', 'クリックして作業を再開 [P]');
        hPill.textContent = '⏸️ 中断中';
      }
      const hActionBtn = hCard.querySelector('.btn-habit-action.done');
      if (hActionBtn) {
        hActionBtn.className = 'btn-habit-action resume';
        hActionBtn.setAttribute('onclick', `event.stopPropagation(); startHabit('${hId}')`);
        hActionBtn.setAttribute('title', '作業を再開');
        hActionBtn.textContent = '▶ 再開';
      }
    });
  } catch (domErr) {
    console.warn('[Optimistic DOM Mutation] Non-fatal error:', domErr);
  }

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

  const now = new Date();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (habit.status !== 'paused') { habit.accumulatedSeconds = 0; habit.actMin = 0; }
  habit.status = 'in_progress';
  habit.actStart = habit.actStart || nowTimeStr;
  habit.startTimestamp = Date.now(); habit._localUpdatedAt = Date.now();
  state.activeHabitId = habit.id;
  state.activeTaskId = null;

  // 螳溯｡御ｸｭ繧ｿ繧ｹ繧ｯ縺後≠繧後・閾ｪ蜍穂ｸｭ譁ｭ・亥ｮ悟・繧ｷ繝ｳ繧ｰ繝ｫ繧ｿ繧ｹ繧ｯ謗剃ｻ門宛蠕｡・・
  if (Array.isArray(state.tasks)) {
    let taskPaused = false;
    state.tasks.forEach(t => {
      if (t.status === 'in_progress') {
        t.status = 'paused';
        if (t.startTimestamp) {
          const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - t.startTimestamp) / 1000));
          t.accumulatedSeconds = (t.accumulatedSeconds || (t.actMin ? t.actMin * 60 : 0)) + sessionElapsedSec;
          t.actMin = Math.round(t.accumulatedSeconds / 60);
        }
        t.startTimestamp = null;
        taskPaused = true;
      }
    });
    if (taskPaused && typeof saveTasks === 'function') {
      saveTasks();
    }
  }
  saveHabits();
  renderApp();
}

function pauseHabit(id) {
  const targetId = String(id);
  const habit = state.habits.find(h => String(h.id) === targetId);
  if (!habit || habit.status !== 'in_progress') return;

  habit.status = 'paused'; habit._localUpdatedAt = Date.now();
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

  if (!Array.isArray(habit.history)) {
    if (habit.history && typeof habit.history === 'object') {
      const keys = Object.keys(habit.history).filter(k => habit.history[k] === true || habit.history[k]?.done);
      habit.history = keys.sort();
    } else {
      habit.history = [];
    }
  }

  const curCount = getHabitDayCount(habit, dateKey);
  const targetTimes = getHabitTargetTimes(habit);
  const newCount = userCount !== null ? Number(userCount) : (curCount + 1);
  const isGoalReached = newCount >= targetTimes;

  const prevHistoryList = [...habit.history];
  const prevStatus = habit.status;

  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  habit.actEnd = nowTimeStr; habit._localUpdatedAt = Date.now();

  // Event Sourcing: 完了目標達成時は YYYY-MM-DD 文字列配列に追加
  if (isGoalReached) {
    if (!habit.history.includes(dateKey)) {
      habit.history.push(dateKey);
      habit.history.sort();
    }
  } else {
    habit.history = habit.history.filter(d => d !== dateKey);
  }

  // Add to executionLogs array (Timeline / Event Sourcing)
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

  habit.todayCount = newCount;
  habit.status = isGoalReached ? 'completed' : 'uncompleted';
  habit.startTimestamp = null;
  habit.accumulatedSeconds = 0;
  if (String(state.activeHabitId) === targetId) {
    state.activeHabitId = null;
  }

  // Optimistic Direct DOM Mutation Guard
  if (isGoalReached) {
    const cardEls = document.querySelectorAll(`.habit-card[data-id="${targetId}"]`);
    cardEls.forEach(card => {
      if (state.filters.status === 'uncompleted') {
        card.style.transition = 'all 0.2s ease-out';
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        setTimeout(() => { if (card.parentNode) card.remove(); }, 200);
      }
    });
  } else {
    // 途中完了時（例: 2回中1回目完了）の即時DOMリセット（待機中モードへ復帰）
    const cardEls = document.querySelectorAll(`.habit-card[data-id="${targetId}"]`);
    cardEls.forEach(card => {
      // 1. クラスと属性のリセット
      card.classList.remove('in-progress', 'is-timescale-active', 'is-timescale-warning', 'paused', 'is-timescale-paused');
      card.style.removeProperty('--timescale-pct');

      // 2. ステータスピルを「⏳ 待機中」に復元
      const pill = card.querySelector('.tc-status-pill');
      if (pill) {
        pill.className = 'tc-status-pill wait habit-pill';
        pill.removeAttribute('onclick');
        pill.removeAttribute('title');
        pill.textContent = '⏳ 待機中';
      }

      // 3. 実績/目安時間の表示を待機中にリセット
      const estBadge = card.querySelector('.tc-est-badge.progress-mode');
      if (estBadge) {
        const estInfo = typeof getEstimatedDuration === 'function' ? getEstimatedDuration(habit, 'habit') : { targetMin: habit.targetMin || 5 };
        estBadge.innerHTML = `実績/目安: <span class="wait-dash">-</span> / ${estInfo.targetMin}分`;
      }

      // 4. アクションボタンを「▶ 開始」に復元
      const actionsDiv = card.querySelector('.habit-actions');
      if (actionsDiv) {
        const actionBtn = actionsDiv.querySelector('.btn-habit-action');
        if (actionBtn) {
          actionBtn.className = 'btn-habit-action start';
          actionBtn.setAttribute('onclick', `event.stopPropagation(); startHabit('${targetId}')`);
          actionBtn.removeAttribute('title');
          actionBtn.textContent = '▶ 開始';
        }
      }

      // 5. カウンターバッジ（⚡ 1/2回等）およびドットを最新状態に即座に更新
      const labelsRow = card.querySelector('.habit-labels-row');
      if (labelsRow) {
        const oldBadge = labelsRow.querySelector('.badge-daily-times');
        const newBadgeHtml = typeof getHabitCompletionProgressHtml === 'function' ? getHabitCompletionProgressHtml(habit, dateKey) : '';
        if (oldBadge) {
          if (newBadgeHtml) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = newBadgeHtml.trim();
            const newBadgeEl = tempDiv.firstElementChild;
            if (newBadgeEl) oldBadge.replaceWith(newBadgeEl);
          }
        } else if (newBadgeHtml) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = newBadgeHtml.trim();
          const newBadgeEl = tempDiv.firstElementChild;
          if (newBadgeEl) labelsRow.appendChild(newBadgeEl);
        }
      }
    });
  }

  // UNDO Action Recording
  const toastMsg = targetTimes > 1
    ? (isGoalReached ? `ハビット「${habit.name}」を本日の目標達成 (${newCount}/${targetTimes}回) 🎉` : `ハビット「${habit.name}」(${newCount}/${targetTimes}回目) を完了`)
    : `ハビット「${habit.name}」を完了`;

  pushUndoAction({
    description: toastMsg,
    undo: () => {
      habit.history = prevHistoryList;
      habit.executionLogs = habit.executionLogs.filter(l => l.id !== logId);
      habit.status = prevStatus;
      recalculateHabitRates(habit);
      saveHabits();
      renderApp();
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
    countBadge.textContent = `蜈ｨ${item.executionLogs.length}莉ｶ縺ｮ險倬鹸`;
  }

  if (item.executionLogs.length === 0) {
    container.innerHTML = `
      <div class="timeline-empty-state">
        <span>糖 縺ｾ縺螳溯｡瑚ｨ倬鹸縺ｯ縺ゅｊ縺ｾ縺帙ｓ縲ゅ娯恣 螳御ｺ・肴凾縺ｫ荳險繝｡繝｢繧呈ｮ九☆縺ｨ縲√％縺薙↓譎らｳｻ蛻励〒闢・ｩ阪＆繧後∪縺吶・/span>
      </div>
    `;
    return;
  }

  const isHabit = type === 'habit';
  container.innerHTML = item.executionLogs.map(log => {
    const d = new Date(log.completedAt || log.dateKey);
    const dateFormatted = isNaN(d.getTime()) ? (log.dateKey || '譌･莉俶悴險倬鹸') : `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const countText = (isHabit && log.count) ? `<span class="timeline-badge">${log.count}蝗樒岼</span>` : '';
    const durationText = log.durationMin ? `<span class="timeline-badge">竢ｱ・・${log.durationMin}蛻・/span>` : '';
    const noteText = log.note ? `<div class="timeline-note">${escapeHtml(log.note)}</div>` : `<div class="timeline-note" style="color: var(--text-dim); font-style: italic;">・医Γ繝｢縺ｪ縺怜ｮ御ｺ・ｼ・/div>`;

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
          <button type="button" class="timeline-btn-del" onclick="deleteExecutionLog('${type}', '${item.id}', '${log.id}')" title="縺薙・險倬鹸繧貞炎髯､">卵・・/button>
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

  const targetLog = item.executionLogs.find(l => l.id === logId);
  const logDateKey = targetLog ? targetLog.dateKey : null;

  item.executionLogs = item.executionLogs.filter(l => l.id !== logId);

  // 螳壽悄繧ｿ繧ｹ繧ｯ縺ｮ螳溯｡後Ο繧ｰ縺悟炎髯､縺輔ｌ縺溷ｴ蜷医・｣蜍輔☆繧九け繝ｭ繝ｼ繝ｳ蜊倡匱繧ｿ繧ｹ繧ｯ繧り・蜍募炎髯､
  if (type === 'task' && typeof removeRecurringInstanceSingleTasks === 'function') {
    removeRecurringInstanceSingleTasks(itemId, logDateKey, logId, state.tasks);
  }

  if (type === 'habit') {
    saveHabits();
  } else {
    saveTasks();
  }
  renderExecutionTimeline(type, item);
  renderApp();
}

function uncompleteHabit(id) {
  const targetId = String(id);
  const habit = state.habits.find(h => String(h.id) === targetId);
  if (!habit) return;

  const dateKey = getSelectedDateKey();
  if (!Array.isArray(habit.history)) habit.history = [];

  const prevHistoryList = [...habit.history];
  const prevStatus = habit.status;
  const prevLogs = Array.isArray(habit.executionLogs) ? [...habit.executionLogs] : [];

  // 縺昴・譌･縺ｮ螳溯｡瑚ｨ倬鹸繧貞ｮ悟・縺ｫ蜑企勁・亥屓謨ｰ0蝗槭・螳悟・譛ｪ螳御ｺ・↓繝ｪ繧ｻ繝・ヨ・・
  habit.history = habit.history.filter(d => d !== dateKey);

  if (state.selectedDateOffset === 0) {
    habit.status = 'uncompleted';
    habit.actEnd = null;
    habit.startTimestamp = null;
    habit.accumulatedSeconds = 0;
    if (String(state.activeHabitId) === targetId) {
      state.activeHabitId = null;
    }
  }

  // 繧ｿ繧､繝繝ｩ繧､繝ｳ繝ｭ繧ｰ縺九ｉ繧ょｽ捺律縺ｮ繝ｭ繧ｰ繧帝勁蜴ｻ
  if (Array.isArray(habit.executionLogs)) {
    habit.executionLogs = habit.executionLogs.filter(l => l.dateKey !== dateKey);
  }

  pushUndoAction({
    description: `ハビット「${habit.name}」を未完了に戻しました（-1回）`,
    undo: () => {
      habit.history = prevHistoryList;
      habit.status = prevStatus;
      habit.executionLogs = prevLogs;
      recalculateHabitRates(habit);
      saveHabits();
      renderApp();
    }
  });

  recalculateHabitRates(habit);
  saveHabits();
  renderApp();
}

function toggleHabit(id) {
  const targetId = String(id);
  const habit = state.habits.find(h => String(h.id) === targetId);
  if (!habit) return;

  const dateKey = typeof getSelectedDateKey === 'function' ? getSelectedDateKey() : '';
  const curStatus = getHabitStatusForSelectedDate(habit);
  const curCount = getHabitDayCount(habit, dateKey);

  if (habit.status === 'in_progress') {
    completeHabit(id);
    return;
  }

  // 完了状態または回数カウントが存在する場合は未完了（0回）に戻す
  if (curStatus === 'completed' || curCount > 0) {
    uncompleteHabit(id);
    return;
  }

  // 過去日なら完了にする、今日なら開始する
  if (state.selectedDateOffset > 0) {
    completeHabit(id);
  } else {
    startHabit(id);
  }
}
function skipHabit(id) {
  const targetId = String(id);
  const habit = state.habits.find(h => String(h.id) === targetId);
  if (!habit) return;

  const dateKey = getSelectedDateKey();
  if (!Array.isArray(habit.history)) habit.history = [];
  habit.history = habit.history.filter(d => d !== dateKey);

  habit.status = 'skipped';
  habit.skippedDateKey = dateKey;
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
  let list = [...state.habits].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // 驕主悉譌･縺ｮ陦ｨ遉ｺ譎ゅ・繝槭せ繧ｿ繝ｼ繝・・繝悶Ν莉･螟悶〒縺ｯ繝上ン繝・ヨ繧帝撼陦ｨ遉ｺ・域悴螳御ｺ・腰逋ｺ繧ｿ繧ｹ繧ｯ縺ｮ谿句ｭ倡｢ｺ隱阪ｒ螳ｹ譏薙↓縺吶ｋ縺溘ａ・・
  if (mode !== 'table' && state.selectedDateOffset > 0) {
    return [];
  }

  // Permanent sortOrder is always preserved
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

  // 3. Focus Mode: Purified for task execution (Habits handled in Section & Daily views)
  if (mode === 'focus') {
    return [];
  } else if (mode !== 'table') {
    if (state.filters.status === 'uncompleted') {
      list = list.filter(h => {
        const st = getHabitStatusForSelectedDate(h);
        return st !== 'completed' && st !== 'skipped';
      });
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
  const appVerEl = document.getElementById('app-version-badge');
  if (appVerEl) {
    appVerEl.textContent = (typeof APP_VERSION !== 'undefined') ? APP_VERSION : 'v1.9.18';
    appVerEl.title = '\u30D0\u30FC\u30B8\u30E7\u30F3 ' + ((typeof APP_VERSION !== 'undefined') ? APP_VERSION : 'v1.9.18') + ' (\u30AF\u30EA\u30C3\u30AF\u3067\u66F4\u65B0\u5C65\u6B74\u8868\u793A)';
  }
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
  // 翌朝自動ウェイクアップ・サニタイザー（Day-Rollover Auto-Sanitizer）
  const curTodayKey = typeof getTodayKey === 'function' ? getTodayKey() : new Date().toLocaleDateString('sv');
  if (state.lastProcessedDate && state.lastProcessedDate !== curTodayKey) {
    console.log(`[Day-Rollover] Date changed from ${state.lastProcessedDate} to ${curTodayKey}. Running auto-sanitizer...`);
    state.lastProcessedDate = curTodayKey;
    if (typeof sanitizeDailyState === 'function') sanitizeDailyState();
    // [FIX②] renderApp()の再帰呼び出しを削除。再描画は呼び出し元のrenderApp()が担当。
  } else if (!state.lastProcessedDate) {
    state.lastProcessedDate = curTodayKey;
  }

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
          <span class="banner-icon">📅</span>
          <span class="banner-text">過去日（<b>${m}月${d}日 (${tagText})</b>）の実行記録モードです。過去の完了実績を確認・修正できます。</span>
        </div>
        <button class="btn-banner-reset" id="btn-banner-reset" onclick="resetToToday()">⟲ 今日の画面に戻る</button>
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
          <span class="banner-icon">🗓️</span>
          <span class="banner-text">未来日（<b>${m}月${d}日 (${tagText})</b>）の事前計画モードです。予定タスクの確認・事前追加ができます。</span>
        </div>
        <button class="btn-banner-reset" id="btn-banner-reset" onclick="resetToToday()">⟲ 今日の画面に戻る</button>
      `;
    }
  }

  const activeHabit = state.habits.find(h =>
    (String(h.id) === String(state.activeHabitId) || h.status === 'in_progress') &&
    h.status !== 'completed' &&
    getHabitStatusForSelectedDate(h) !== 'completed' &&
    h.status !== 'skipped' &&
    !h.isDisabled
  );
  const activeTask = state.tasks.find(t =>
    (String(t.id) === String(state.activeTaskId) || t.status === 'in_progress') &&
    t.status !== 'completed' &&
    getTaskStatusForSelectedDate(t) !== 'completed' &&
    t.status !== 'skipped' &&
    !t.isDisabled
  );
  const activeNameEl = document.getElementById('active-habit-name');
  if (activeNameEl) {
    if (activeTask && state.selectedDateOffset === 0) {
      activeNameEl.textContent = `識 ${activeTask.title} (${activeTask.actStart || ''}~)`;
    } else if (activeHabit && state.selectedDateOffset === 0) {
      activeNameEl.textContent = `諺 ${activeHabit.name}`;
    } else {
      activeNameEl.textContent = 'なし';
    }
  }

  // Real-Time TaskChute Dynamic Estimates & ETAs calculation
  calculateTaskChuteEstimates();

  // 1蛻・＃縺ｨ縺ｮ螳壽悄譖ｴ譁ｰ譎・ 繧ｻ繧ｯ繧ｷ繝ｧ繝ｳ逕ｻ髱｢縺ｮ蛟句挨譎る俣繝上ン繝・ヨ縺ｮ蜍慕噪蜃ｺ迴ｾ繝ｻ豸域ｻ・ｒ蜿肴丐
  if (state.currentMode === 'section' && state.selectedDateOffset === 0) {
    const isModalOpen = Boolean(document.querySelector('.modal.active, .modal.show, .modal-overlay.active, .modal[style*="display: block"]'));
    if (!isModalOpen && typeof renderSectionView === 'function') {
      renderSectionView();
    }
  }
}

function updateFilterPillsUI() {
  const statusLabels = { uncompleted: '譛ｪ螳御ｺ・・縺ｿ', all: '蜈ｨ莉ｶ陦ｨ遉ｺ', completed: '螳御ｺ・・縺ｿ' };
  document.getElementById('filter-status-val').textContent = statusLabels[state.filters.status];
  document.getElementById('filter-domain-val').textContent = state.filters.domain || '縺吶∋縺ｦ';
  document.getElementById('filter-dept-val').textContent = state.filters.dept || '縺吶∋縺ｦ';
  document.getElementById('filter-proj-val').textContent = state.filters.proj || '縺吶∋縺ｦ';

  const tagValEl = document.getElementById('filter-tag-val');
  if (tagValEl) {
    const inc = state.filters.includeTags || [];
    const exc = state.filters.excludeTags || [];
    if (inc.length === 0 && exc.length === 0) {
      tagValEl.textContent = '縺吶∋縺ｦ';
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

// Focus Board Adaptive Loop Engine (focusCount: 1 -> 2 -> 3 -> 1)
function setFocusCount(count) {
  const valid = [1, 2, 3].includes(Number(count)) ? Number(count) : 1;
  state.focusCount = valid;
  try {
    localStorage.setItem('gendrive_focus_count', String(valid));
  } catch (e) {}

  document.querySelectorAll('#focus-count-selector .focus-count-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.count, 10) === valid);
  });

  renderFocusView();
}

function cycleFocusCount() {
  const counts = [1, 2, 3];
  const cur = [1, 2, 3].includes(state.focusCount) ? state.focusCount : 1;
  const nextIdx = (counts.indexOf(cur) + 1) % counts.length;
  setFocusCount(counts[nextIdx]);
}

function navigateFocusTask(delta) {
  const activeTodayTasks = state.tasks.filter(t => 
    isTaskForSelectedDate(t) && 
    t.status !== 'completed' && 
    t.status !== 'skipped' && 
    matchesTagFilters(t)
  );
  if (activeTodayTasks.length === 0) return;

  const total = activeTodayTasks.length;
  let newIdx = (state.focusTaskIndex || 0) + delta;

  if (newIdx >= total) {
    newIdx = 0;
  } else if (newIdx < 0) {
    newIdx = Math.max(0, total - 1);
  }

  state.focusTaskIndex = newIdx;
  renderFocusView(true);
}



// TaskChute Dynamic Estimates & ETAs Real-Time Calculation Engine (Date-Aware: Today, Past, Future)
// TaskChute Dynamic Estimates & ETAs Real-Time Calculation Engine (Date-Aware: Today, Past, Future)
// TaskChute Dynamic Estimates & ETAs Real-Time Calculation Engine (Date-Aware: Today, Past, Future)
function formatMinsUnified(mins) {
  if (!mins || mins <= 0) return "0\u5206";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return h + "h" + m + "m";
  if (h > 0) return h + "h";
  return m + "\u5206";
}

function calculateTaskChuteEstimates() {
  const now = new Date();
  const nowDay = now.getDate();
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - state.selectedDateOffset);

  const selectedDateTasks = state.tasks.filter(t => isTaskForSelectedDate(t));
  const selectedDateHabits = state.habits.filter(h => isHabitScheduledForDate(h, targetDate));

  const isToday = state.selectedDateOffset === 0;
  const isPast = state.selectedDateOffset > 0;
  const isFuture = state.selectedDateOffset < 0;

  // DOM elements - Day
  const dayEtaBadge = document.getElementById("header-daily-eta-badge");
  const dayRemainEl = document.getElementById("daily-remain-minutes");
  const dayEtaLabelEl = document.getElementById("daily-eta-label");
  const dayEtaTimeEl = document.getElementById("daily-eta-time-val");
  const dayTaskValEl = document.getElementById("daily-task-remain-val");
  const dayHabitValEl = document.getElementById("daily-habit-remain-val");
  const dayEtaInfoEl = document.getElementById("daily-eta-remain-info");

  // DOM elements - Section
  const secEtaBadge = document.getElementById("section-eta-badge");
  const secRemainMinEl = document.getElementById("section-remain-minutes");
  const secEtaLabelEl = document.getElementById("section-eta-label");
  const secEtaTimeEl = document.getElementById("section-eta-time");
  const secTaskValEl = document.getElementById("section-task-remain-val");
  const secHabitValEl = document.getElementById("section-habit-remain-val");

  // -------------------------------------------------------------
  // 1. TODAY: Real-Time Dynamic ETA Mode
  // -------------------------------------------------------------
  if (isToday) {
    if (dayEtaLabelEl) dayEtaLabelEl.textContent = "\u898B\u8FBC:";
    if (secEtaLabelEl) secEtaLabelEl.textContent = "\u898B\u8FBC:";

    // Day calculations
    let dayTaskRemainMin = 0;
    let dayTaskRemainCount = 0;
    selectedDateTasks.forEach(t => {
      if (t.isRecurringInstance) return;
      const status = getTaskStatusForSelectedDate(t);
      if (status !== "completed" && status !== "skipped") {
        dayTaskRemainMin += getItemRemainingMinutes(t, "task");
        dayTaskRemainCount++;
      }
    });

    let dayHabitRemainMin = 0;
    let dayHabitRemainCount = 0;
    selectedDateHabits.forEach(h => {
      if (typeof isHabitTimeExcluded === "function" && isHabitTimeExcluded(h)) return;
      const status = getHabitStatusForSelectedDate(h);
      if (status !== "completed" && status !== "skipped") {
        dayHabitRemainMin += getItemRemainingMinutes(h, "habit");
        dayHabitRemainCount++;
      }
    });

    const totalDayRemainMin = dayTaskRemainMin + dayHabitRemainMin;
    const totalDayRemainCount = dayTaskRemainCount + dayHabitRemainCount;
    const dayEtaDate = new Date(now.getTime() + totalDayRemainMin * 60000);

    const isDayOverdue = totalDayRemainCount > 0 && (
      dayEtaDate.getDate() !== nowDay ||
      (dayEtaDate.getTime() - now.getTime()) > ((24 * 60 - (now.getHours() * 60 + now.getMinutes())) * 60000)
    );

    const dH = String(dayEtaDate.getHours()).padStart(2, "0");
    const dM = String(dayEtaDate.getMinutes()).padStart(2, "0");
    let dayEtaTimeStr = dH + ":" + dM;
    if (isDayOverdue) {
      dayEtaTimeStr = "\u7FCC " + dayEtaTimeStr;
    }

    if (dayRemainEl) dayRemainEl.textContent = formatMinsUnified(totalDayRemainMin);
    if (dayEtaTimeEl) dayEtaTimeEl.textContent = totalDayRemainCount > 0 ? dayEtaTimeStr : "\u9054\u6210!\uD83C\uDF89";
    if (dayTaskValEl) dayTaskValEl.textContent = formatMinsUnified(dayTaskRemainMin) + " (" + dayTaskRemainCount + ")";
    if (dayHabitValEl) dayHabitValEl.textContent = formatMinsUnified(dayHabitRemainMin) + " (" + dayHabitRemainCount + ")";
    if (dayEtaInfoEl) dayEtaInfoEl.textContent = "\u6B8B " + formatMinsUnified(totalDayRemainMin) + " (" + totalDayRemainCount + "\u4EF6)";

    if (dayEtaBadge) {
      if (isDayOverdue) {
        dayEtaBadge.classList.add("eta-alert-overdue");
        dayEtaBadge.title = "\u26A0\uFE0F \u5B8C\u4E86\u898B\u8FBC\u307F\u304C\u7FCC\u65E5 (" + dayEtaTimeStr + ") \u306B\u7A81\u5165\u3057\u3066\u3044\u307E\u3059 (\u6B8B: " + formatMinsUnified(totalDayRemainMin) + ")";
      } else {
        dayEtaBadge.classList.remove("eta-alert-overdue");
        dayEtaBadge.title = "\u4eca\u65e5\u5168\u4f53\u306e\u6b8b\u308a\u6642\u9593: " + formatMinsUnified(totalDayRemainMin) + " / \u5b8c\u4e86\u898b\u8fbc\u307f: " + dayEtaTimeStr;
      }
    }

    // Section calculations
    const currentSec = state.currentSection || "\u7B2C2\u30BB\u30AF\u30B7\u30E7\u30F3";
    const currentSecConfig = (typeof SECTIONS_CONFIG !== "undefined") ? SECTIONS_CONFIG.find(s => s.name === currentSec) : null;
    const secTasks = getTasksForSection(currentSec);
    const secHabits = state.habits.filter(isHabitInCurrentTimeWindow);

    let secTaskRemainMin = 0;
    let secTaskRemainCount = 0;
    secTasks.forEach(t => {
      const status = getTaskStatusForSelectedDate(t);
      if (status !== "completed" && status !== "skipped") {
        secTaskRemainMin += getItemRemainingMinutes(t, "task");
        secTaskRemainCount++;
      }
    });

    let secHabitRemainMin = 0;
    let secHabitRemainCount = 0;
    secHabits.forEach(h => {
      if (typeof isHabitTimeExcluded === "function" && isHabitTimeExcluded(h)) return;
      const status = getHabitStatusForSelectedDate(h);
      if (status !== "completed" && status !== "skipped") {
        secHabitRemainMin += getItemRemainingMinutes(h, "habit");
        secHabitRemainCount++;
      }
    });

    const secRemainMin = secTaskRemainMin + secHabitRemainMin;
    const secRemainCount = secTaskRemainCount + secHabitRemainCount;
    const secEtaDate = new Date(now.getTime() + secRemainMin * 60000);

    const sH = String(secEtaDate.getHours()).padStart(2, "0");
    const sM = String(secEtaDate.getMinutes()).padStart(2, "0");
    const secEtaTimeStr = sH + ":" + sM;

    let isSecOverdue = false;
    if (currentSecConfig && secRemainCount > 0) {
      const secEndHourDec = currentSecConfig.end;
      const secEtaHourDec = secEtaDate.getHours() + (secEtaDate.getMinutes() / 60);
      const curHourDec = now.getHours() + (now.getMinutes() / 60);
      if (secEtaDate.getDate() !== nowDay || secEtaHourDec > secEndHourDec || curHourDec >= secEndHourDec) {
        isSecOverdue = true;
      }
    }

    if (secRemainMinEl) secRemainMinEl.textContent = formatMinsUnified(secRemainMin);
    if (secEtaTimeEl) secEtaTimeEl.textContent = secRemainCount > 0 ? secEtaTimeStr : "\u9054\u6210!\uD83C\uDF89";
    if (secTaskValEl) secTaskValEl.textContent = formatMinsUnified(secTaskRemainMin) + " (" + secTaskRemainCount + ")";
    if (secHabitValEl) secHabitValEl.textContent = formatMinsUnified(secHabitRemainMin) + " (" + secHabitRemainCount + ")";

    if (secEtaBadge) {
      if (isSecOverdue) {
        const endLabel = currentSecConfig ? currentSecConfig.endStr : "";
        secEtaBadge.classList.add("eta-alert-overdue");
        secEtaBadge.title = "\u26A0\uFE0F \u30BB\u30AF\u30B7\u30E7\u30F3\u7D42\u4E86\u67A0 (" + endLabel + ") \u3092\u8D85\u904E\u3059\u308B\u898B\u8FBC\u307F\u3067\u3059 (" + secEtaTimeStr + ")";
      } else {
        secEtaBadge.classList.remove("eta-alert-overdue");
        secEtaBadge.title = "\u5F53\u30BB\u30AF\u30B7\u30E7\u30F3\u6B8B\u308A\u6642\u9593: " + formatMinsUnified(secRemainMin) + " / \u5B8C\u4E86\u898B\u8FBC\u307F: " + secEtaTimeStr;
      }
    }

    return {
      totalDayRemainMin,
      dayEtaTimeStr,
      totalDayRemainCount,
      dayTaskRemainMin,
      dayTaskRemainCount,
      dayHabitRemainMin,
      dayHabitRemainCount,
      secRemainMin,
      secEtaTimeStr,
      secRemainCount,
      secTaskRemainMin,
      secTaskRemainCount,
      secHabitRemainMin,
      secHabitRemainCount
    };
  }

  // -------------------------------------------------------------
  // 2. PAST DATE: Historical Actual Work Summary Mode
  // -------------------------------------------------------------
  if (isPast) {
    if (dayEtaLabelEl) dayEtaLabelEl.textContent = "\u5B9F\u7E3E:";
    if (secEtaLabelEl) secEtaLabelEl.textContent = "\u5B9F\u7E3E:";

    let pastTaskMins = 0;
    let completedTaskCount = 0;
    selectedDateTasks.forEach(t => {
      if (t.isRecurringInstance) return;
      const status = getTaskStatusForSelectedDate(t);
      if (status === "completed") {
        completedTaskCount++;
        pastTaskMins += t.actMin || t.estMin || 15;
      }
    });

    let pastHabitMins = 0;
    let completedHabitCount = 0;
    const k = getSelectedDateKey();
    selectedDateHabits.forEach(h => {
      if (typeof isHabitTimeExcluded === "function" && isHabitTimeExcluded(h)) return;
      const status = getHabitStatusForSelectedDate(h);
      if (status === "completed") {
        completedHabitCount++;
        const logMin = (Array.isArray(h.executionLogs) && h.executionLogs.find(l => l.dateKey === k)?.durationMin) || (h.targetMin || 5);
        pastHabitMins += logMin;
      }
    });

    const pastActualMins = pastTaskMins + pastHabitMins;
    const completedCount = completedTaskCount + completedHabitCount;
    const countablePastHabits = selectedDateHabits.filter(h => !(typeof isHabitTimeExcluded === "function" && isHabitTimeExcluded(h)));
    const totalCount = selectedDateTasks.length + countablePastHabits.length;

    if (dayRemainEl) dayRemainEl.textContent = completedCount + "/" + totalCount + "\u4EF6";
    if (dayEtaTimeEl) dayEtaTimeEl.textContent = formatMinsUnified(pastActualMins);
    if (dayTaskValEl) dayTaskValEl.textContent = formatMinsUnified(pastTaskMins) + " (" + completedTaskCount + ")";
    if (dayHabitValEl) dayHabitValEl.textContent = formatMinsUnified(pastHabitMins) + " (" + completedHabitCount + ")";
    if (dayEtaBadge) {
      dayEtaBadge.classList.remove("eta-alert-overdue");
      dayEtaBadge.title = "\u904E\u53BB\u65E5\u306E\u4F5C\u696D\u5B9F\u7E3E\u30B5\u30DE\u30F8\u30FC";
    }

    // Section Summary for Past Date
    const currentSec = state.currentSection || "\u7B2C2\u30BB\u30AF\u30B7\u30E7\u30F3";
    const secTasks = selectedDateTasks.filter(t => (t.section === currentSec) || (!t.section && currentSec === "morning_prime"));
    const secHabits = selectedDateHabits.filter(h => h.displayType !== "anytime" && (h.section === currentSec || (h.displayType === "custom" && isHabitInTimeRange(h, SECTIONS_CONFIG.find(s => s.name === currentSec)))));

    let secTaskActMins = 0;
    let secDoneTaskCount = 0;
    secTasks.forEach(t => {
      if (t.isRecurringInstance) return;
      if (getTaskStatusForSelectedDate(t) === "completed") {
        secDoneTaskCount++;
        secTaskActMins += t.actMin || t.estMin || 15;
      }
    });

    let secHabitActMins = 0;
    let secDoneHabitCount = 0;
    secHabits.forEach(h => {
      if (typeof isHabitTimeExcluded === "function" && isHabitTimeExcluded(h)) return;
      if (getHabitStatusForSelectedDate(h) === "completed") {
        secDoneHabitCount++;
        const logMin = (Array.isArray(h.executionLogs) && h.executionLogs.find(l => l.dateKey === k)?.durationMin) || (h.targetMin || 5);
        secHabitActMins += logMin;
      }
    });

    const secActualMins = secTaskActMins + secHabitActMins;
    const secDoneCount = secDoneTaskCount + secDoneHabitCount;
    const countablePastSecHabits = secHabits.filter(h => !(typeof isHabitTimeExcluded === "function" && isHabitTimeExcluded(h)));

    if (secRemainMinEl) secRemainMinEl.textContent = secDoneCount + "/" + (secTasks.length + countablePastSecHabits.length) + "\u4EF6";
    if (secEtaTimeEl) secEtaTimeEl.textContent = formatMinsUnified(secActualMins);
    if (secTaskValEl) secTaskValEl.textContent = formatMinsUnified(secTaskActMins) + " (" + secDoneTaskCount + ")";
    if (secHabitValEl) secHabitValEl.textContent = formatMinsUnified(secHabitActMins) + " (" + secDoneHabitCount + ")";
    if (secEtaBadge) {
      secEtaBadge.classList.remove("eta-alert-overdue");
      secEtaBadge.title = "\u904E\u53BB\u30BB\u30AF\u30B7\u30E7\u30F3\u306E\u4F5C\u696D\u5B9F\u7E3E\u30B5\u30DE\u30F8\u30FC";
    }

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
    if (dayEtaLabelEl) dayEtaLabelEl.textContent = "\u4E88\u5B9A:";
    if (secEtaLabelEl) secEtaLabelEl.textContent = "\u4E88\u5B9A:";

    let futureTaskMins = 0;
    let futureTaskCount = 0;
    selectedDateTasks.forEach(t => {
      const estInfo = getEstimatedDuration(t, "task");
      futureTaskMins += estInfo.targetMin;
      futureTaskCount++;
    });

    let futureHabitMins = 0;
    let futureHabitCount = 0;
    selectedDateHabits.forEach(h => {
      if (typeof isHabitTimeExcluded === "function" && isHabitTimeExcluded(h)) return;
      const estInfo = getEstimatedDuration(h, "habit");
      futureHabitMins += estInfo.targetMin;
      futureHabitCount++;
    });

    const totalScheduledMins = futureTaskMins + futureHabitMins;
    const totalCount = futureTaskCount + futureHabitCount;

    if (dayRemainEl) dayRemainEl.textContent = totalCount + "\u4EF6";
    if (dayEtaTimeEl) dayEtaTimeEl.textContent = formatMinsUnified(totalScheduledMins);
    if (dayTaskValEl) dayTaskValEl.textContent = formatMinsUnified(futureTaskMins) + " (" + futureTaskCount + ")";
    if (dayHabitValEl) dayHabitValEl.textContent = formatMinsUnified(futureHabitMins) + " (" + futureHabitCount + ")";
    if (dayEtaBadge) {
      dayEtaBadge.classList.remove("eta-alert-overdue");
      dayEtaBadge.title = "\u672A\u6765\u65E5\u306E\u4E88\u5B9A\u7DCF\u6642\u9593\uFF08\u4E8B\u524D\u8A08\u753B\u30E2\u30FC\u30C9\uFF09";
    }

    // Section Summary for Future Date
    const currentSec = state.currentSection || "\u7B2C2\u30BB\u30AF\u30B7\u30E7\u30F3";
    const secTasks = selectedDateTasks.filter(t => (t.section === currentSec) || (!t.section && currentSec === "morning_prime"));
    const secHabits = selectedDateHabits.filter(h => h.displayType !== "anytime" && (h.section === currentSec || (h.displayType === "custom" && isHabitInTimeRange(h, SECTIONS_CONFIG.find(s => s.name === currentSec)))));

    let secTaskPlanMins = 0;
    secTasks.forEach(t => { secTaskPlanMins += getEstimatedDuration(t, "task").targetMin; });
    let secHabitPlanMins = 0;
    let secHabitPlanCount = 0;
    secHabits.forEach(h => {
      if (typeof isHabitTimeExcluded === "function" && isHabitTimeExcluded(h)) return;
      secHabitPlanMins += getEstimatedDuration(h, "habit").targetMin;
      secHabitPlanCount++;
    });

    const secPlanMins = secTaskPlanMins + secHabitPlanMins;
    const countableFutureSecHabits = secHabits.filter(h => !(typeof isHabitTimeExcluded === "function" && isHabitTimeExcluded(h)));

    if (secRemainMinEl) secRemainMinEl.textContent = (secTasks.length + countableFutureSecHabits.length) + "\u4EF6";
    if (secEtaTimeEl) secEtaTimeEl.textContent = formatMinsUnified(secPlanMins);
    if (secTaskValEl) secTaskValEl.textContent = formatMinsUnified(secTaskPlanMins) + " (" + secTasks.length + ")";
    if (secHabitValEl) secHabitValEl.textContent = formatMinsUnified(secHabitPlanMins) + " (" + countableFutureSecHabits.length + ")";
    if (secEtaBadge) {
      secEtaBadge.classList.remove("eta-alert-overdue");
      secEtaBadge.title = "\u672A\u6765\u30BB\u30AF\u30B7\u30E7\u30F3\u306E\u4E88\u5B9A\u7DCF\u6642\u9593";
    }

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



function setMode(mode, isReverse = false) {
  // Reset manual sidebar overrides on mode switch
  document.body.classList.remove('sidebar-force-open', 'sidebar-collapsed');

  if (state.currentMode === mode) {
    // Already in this mode: perform context-aware toggle!
    if (mode === 'section') {
      cycleStatusFilter(); // 1: Toggle 譛ｪ螳・竍・蜈ｨ莉ｶ 竍・螳御ｺ・
      return;
    }
    if (mode === 'focus') {
      cycleFocusCount(); // 2: Toggle 1蛟・(繧ｷ繝ｳ繧ｰ繝ｫ) 竍・2蛟・(2謚・ 竍・3蛟・(TOP 3)
      return;
    }
    if (mode === 'all') {
      cycleStatusFilter(); // 3: Toggle 譛ｪ螳・竍・蜈ｨ莉ｶ 竍・螳御ｺ・
      return;
    }
    if (mode === 'table') {
      // 4: Cycle Analytics Scoreboard (1) 竍・Habits (2) 竍・Recurring Tasks (3) 竍・Single Tasks (4) 竍・Profiles (5) (Reverse with Shift+4)
      const subtabs = ['analytics', 'habits', 'tasks', 'single_tasks', 'profiles'];
      let currentIndex = subtabs.indexOf(state.masterSubtab);
      if (currentIndex === -1) currentIndex = 0;
      if (isReverse) {
        currentIndex = (currentIndex - 1 + subtabs.length) % subtabs.length;
      } else {
        currentIndex = (currentIndex + 1) % subtabs.length;
      }
      state.masterSubtab = subtabs[currentIndex];
      clearTableSelection();
      renderTableView();
      setTimeout(() => {
        if (typeof initMasterScrollScale === 'function') initMasterScrollScale();
      }, 50);
      return;
    }
    if (mode === 'goals') {
      // 5: Toggle Front 4-Level Goals 竍・Back Core Manifesto (鬲ゅ・螳｣隱薙・譬ｹ譛ｬ豎ｺ諢・
      toggleGoalsSubmode();
      return;
    }
    if (mode === 'timer') {
      // 6: Already in timer mode -> maintain current view
      return;
    }
  }

  // Switching to new mode
  if (mode === 'table') {
    state.masterSubtab = 'analytics'; // 莉悶・繝ｼ繝峨°繧・縺ｧ蜈･縺｣縺溘→縺阪・蠢・★縲檎ｶ咏ｶ壹せ繧ｳ繧｢繝懊・繝峨阪′荳逡ｪ譛蛻昴↓髢九￥
  }
  const isEnteringFocus = (state.currentMode !== 'focus' && mode === 'focus');
  if (state.currentMode !== mode && state.currentMode !== 'timer') {
    state.previousMode = state.currentMode;
  }
  state.currentMode = mode;
  document.body.dataset.mode = mode;

  if (isEnteringFocus && typeof pickNextSoulQuote === 'function') {
    pickNextSoulQuote();
  }
  state.selectedIndex = 0; // reset selection on view switch
  document.querySelectorAll('.mode-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });
  document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
  document.getElementById(`view-${mode}`).classList.add('active');
  renderApp();
  if (mode === 'table' && typeof initMasterScrollScale === 'function') {
    setTimeout(initMasterScrollScale, 50);
  }
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
safeBindClick('filter-domain-pill', () => openCascadeFilterModal('domain', '繝峨Γ繧､繝ｳ (PN1縲弃N5)', DOMAINS_DATA));
safeBindClick('filter-dept-pill', () => openCascadeFilterModal('dept', '驛ｨ髢 (譛ｬ驛ｨ/逶ｴ霓・', DEPTS_DATA));
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
    const isCompleted = Array.isArray(habit.history) ? habit.history.includes(dateKey) : (habit.history && habit.history[dateKey] === true);
    const isToday = offset === 0;
    const m = d.getMonth() + 1;
    const dayNum = d.getDate();
    const w = weekdays[d.getDay()];

    const label = isToday ? '莉頑律' : `${m}/${dayNum}`;
    const statusIcon = isCompleted ? '✓' : '-';

    html += `
      <div class="history-day-tile ${isCompleted ? 'completed' : ''} ${isToday ? 'today' : ''}" 
           onclick="toggleHistoryTile('${habit.id}', '${dateKey}', ${offset})" 
           title="${m}譛・{dayNum}譌･(${w}) - 繧ｯ繝ｪ繝・け縺励※螳御ｺ・譛ｪ螳御ｺ・ｒ蛻・崛">
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
  if (!Array.isArray(habit.history)) habit.history = [];

  const idx = habit.history.indexOf(dateKey);
  const wasCompleted = idx >= 0;
  if (wasCompleted) {
    habit.history.splice(idx, 1);
    if (offset === 0) {
      habit.status = 'uncompleted';
      state.selectedEditStatus = 'uncompleted';
      document.querySelectorAll('#edit-status-selector .segment-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === 'uncompleted');
      });
    }
  } else {
    habit.history.push(dateKey);
    habit.history.sort();
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
  if (tierEl) tierEl.textContent = habit.stats?.tier || '験 Developing';

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
    addDays = 3; // 驥第屆 筐・譛域屆
  } else if (day === 6) {
    addDays = 2; // 蝨滓屆 筐・譛域屆
  } else if (day === 0) {
    addDays = 1; // 譌･譖・筐・譛域屆
  } else {
    addDays = 1; // 譛医懈惠 筐・鄙梧律
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
    showUndoToast(`笞｡ 縲・{task.title}縲阪ｒ ${actionLabel} 縺ｫ遘ｻ蜍輔＠縺ｾ縺励◆`, () => {
      task.scheduledDate = prevScheduledDate;
      task.bucket = prevBucket;
      task.section = prevSection;
      saveTasks();
      renderApp();
    });
  }
}

function removeSingleTaskFromBucket(taskId) {
  const task = (state.tasks || []).find(t => String(t.id) === String(taskId));
  if (!task) return;

  const prevBucket = task.bucket;
  const prevScheduledDate = task.scheduledDate;

  task.bucket = 'today';
  if (!task.scheduledDate) {
    const logDate = (task.executionLogs && task.executionLogs[0] && task.executionLogs[0].dateKey)
      || (task.history && task.history[0] && task.history[0].date)
      || getSelectedDateKey();
    task.scheduledDate = logDate;
  }

  saveTasks();

  if (typeof pushUndoAction === 'function') {
    pushUndoAction({
      description: `繧ｿ繧ｹ繧ｯ縲・{task.title}縲阪ｒ邂ｱ縺九ｉ螟悶＠縺ｾ縺励◆`,
      undo: () => {
        task.bucket = prevBucket;
        task.scheduledDate = prevScheduledDate;
        saveTasks();
        renderApp();
      }
    });
  }

  if (typeof showCarryoverToast === 'function') {
    showCarryoverToast(`タスク「${task.title}」を箱から外しました（マスターボードに保持）`);
  } else if (typeof showToast === 'function') {
    showToast(`タスク「${task.title}」を箱から外しました（マスターボードに保持）`);
  }

  renderApp();
  if (typeof updateSidebarCounters === 'function') {
    updateSidebarCounters();
  }
}

function showContextMenu(e, habitId) {
  e.preventDefault();
  hideAllContextMenus();
  const strId = String(habitId);
  const habit = (state.habits || []).find(h => String(h.id) === strId);
  if (!habit) return;

  state.contextMenuHabitId = habit.id;

  // Header Title
  const headerEl = document.getElementById('context-menu-habit-name');
  if (headerEl) headerEl.textContent = habit.name;

  // Dynamic Toggle Complete Button
  const toggleIcon = document.getElementById('ctx-toggle-icon');
  const toggleText = document.getElementById('ctx-toggle-text');
  const curStatus = getHabitStatusForSelectedDate(habit);
  const isCompleted = curStatus === 'completed';

  const dateLabel = state.selectedDateOffset === 0 ? '莉頑律' : '縺薙・譌･';
  if (isCompleted) {
    if (toggleIcon) toggleIcon.textContent = '竢ｳ';
    if (toggleText) toggleText.textContent = `${dateLabel}を未完了に戻す`;
  } else {
    if (toggleIcon) toggleIcon.textContent = '✓';
    if (toggleText) toggleText.textContent = `${dateLabel}を完了にする`;
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
  const strId = String(taskId);
  const task = (state.tasks || []).find(t => String(t.id) === strId);
  if (!task) return;

  state.contextMenuTaskId = task.id;

  // Header Title
  const headerEl = document.getElementById('context-menu-task-name');
  if (headerEl) headerEl.textContent = task.title;

  // Dynamic date labels (e.g. 譏取律 (8/21), 譏主ｾ梧律 (8/22), 谺｡縺ｮ蟷ｳ譌･ (8/21))
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

  // Toggle "Remove from Bucket" item visibility based on whether task has a bucket
  const btnRemoveBucket = document.getElementById('ctx-task-remove-bucket');
  if (btnRemoveBucket) {
    const hasBucket = task.bucket && task.bucket !== 'today';
    btnRemoveBucket.style.display = hasBucket ? 'flex' : 'none';
  }

  // Toggle "Skip Today" / "Unskip Today" visibility
  const curDateKey = typeof getSelectedDateKey === 'function' ? getSelectedDateKey() : new Date().toISOString().split('T')[0];
  const isSkipped = (typeof isTaskSkippedForDate === 'function' && isTaskSkippedForDate(task, curDateKey)) || task.status === 'skipped';
  const btnSkipToday = document.getElementById('ctx-task-skip-today');
  const btnUnskipToday = document.getElementById('ctx-task-unskip-today');
  if (btnSkipToday && btnUnskipToday) {
    if (isSkipped) {
      btnSkipToday.style.display = 'none';
      btnUnskipToday.style.display = 'flex';
    } else {
      btnSkipToday.style.display = 'flex';
      btnUnskipToday.style.display = 'none';
    }
  }

  // Positioning with viewport boundary clamp
  const menu = document.getElementById('task-context-menu');
  if (!menu) return;

  menu.classList.add('active');
  const menuWidth = 250;
  const menuHeight = 320;
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
      if (tid && (state.tasks || []).some(t => String(t.id) === String(tid))) {
        showTaskContextMenu(e, tid);
        return;
      }
    }

    // 2. Habit Card / Row Right Click
    const habitTarget = e.target.closest('[data-type="habit"], .habit-card, .habit-row');
    if (habitTarget) {
      const hid = habitTarget.dataset.id || habitTarget.dataset.habitId;
      if (hid && (state.habits || []).some(h => String(h.id) === String(hid))) {
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

      const habit = (state.habits || []).find(h => String(h.id) === String(hid));
      if (!habit) return;

      const curStatus = getHabitStatusForSelectedDate(habit);
      if (curStatus === 'completed') {
        uncompleteHabit(hid);
      } else {
        completeHabit(hid);
      }
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
      deferTask(tid, targetDate, 'today', `譏取律 (${parseInt(m, 10)}/${parseInt(d, 10)})`);
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
      deferTask(tid, targetDate, 'today', `譏主ｾ梧律 (${parseInt(m, 10)}/${parseInt(d, 10)})`);
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
      deferTask(tid, targetDate, 'today', `谺｡縺ｮ蟷ｳ譌･ (${parseInt(m, 10)}/${parseInt(d, 10)})`);
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
      const inputDate = prompt('螳溯｡御ｺ亥ｮ壽律繧貞・蜉帙＠縺ｦ縺上□縺輔＞ (YYYY-MM-DD):', defaultDate);
      if (inputDate && /^\d{4}-\d{2}-\d{2}$/.test(inputDate.trim())) {
        const targetDate = inputDate.trim();
        const [, m, d] = targetDate.split('-');
        deferTask(tid, targetDate, 'today', `謖・ｮ壽律 (${parseInt(m, 10)}/${parseInt(d, 10)})`);
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
      deferTask(tid, null, 'inbox', 'Inbox (譌･莉倥↑縺・');
    });
  }

  // 5.5. Remove from Bucket (Restore to Standard Task / today)
  const btnTaskRemoveBucket = document.getElementById('ctx-task-remove-bucket');
  if (btnTaskRemoveBucket) {
    btnTaskRemoveBucket.addEventListener('click', () => {
      const tid = state.contextMenuTaskId;
      hideAllContextMenus();
      if (!tid) return;
      removeSingleTaskFromBucket(tid);
    });
  }

  // 5.6. Skip Task for Today
  const btnTaskSkip = document.getElementById('ctx-task-skip-today');
  if (btnTaskSkip) {
    btnTaskSkip.addEventListener('click', () => {
      const tid = state.contextMenuTaskId;
      hideAllContextMenus();
      if (!tid) return;
      const task = state.tasks.find(t => String(t.id) === String(tid));
      if (!task) return;
      const curDateKey = typeof getSelectedDateKey === 'function' ? getSelectedDateKey() : new Date().toISOString().split('T')[0];
      const isRec = task.type === 'recurring' || task.taskType === 'recurring' || Boolean(task.recType);
      
      if (typeof skipTaskForToday === 'function') {
        skipTaskForToday(tid, curDateKey);
      } else {
        task.status = 'skipped';
        task.skippedDateKey = curDateKey;
        saveTasks();
        renderApp();
      }

      const msg = isRec
        ? `笞｡ 螳壽悄繧ｿ繧ｹ繧ｯ縲・{task.title}縲阪ｒ譛ｬ譌･縺ｯ繧ｹ繧ｭ繝・・縺励∪縺励◆ (譏取律縺ｾ縺溯・蜍戊｡ｨ遉ｺ縺輔ｌ縺ｾ縺・`
        : `笞｡ 繧ｿ繧ｹ繧ｯ縲・{task.title}縲阪ｒ譛ｬ譌･縺ｯ繧ｹ繧ｭ繝・・縺励∪縺励◆`;

      if (typeof showUndoToast === 'function') {
        showUndoToast(msg, () => {
          if (typeof unskipTaskForDate === 'function') {
            unskipTaskForDate(tid, curDateKey);
          } else {
            task.status = 'uncompleted';
            saveTasks();
            renderApp();
          }
        });
      }
    });
  }

  // 5.7. Unskip Task (Restore to uncompleted)
  const btnTaskUnskip = document.getElementById('ctx-task-unskip-today');
  if (btnTaskUnskip) {
    btnTaskUnskip.addEventListener('click', () => {
      const tid = state.contextMenuTaskId;
      hideAllContextMenus();
      if (!tid) return;
      const task = state.tasks.find(t => String(t.id) === String(tid));
      if (!task) return;
      const curDateKey = typeof getSelectedDateKey === 'function' ? getSelectedDateKey() : new Date().toISOString().split('T')[0];
      
      if (typeof unskipTaskForDate === 'function') {
        unskipTaskForDate(tid, curDateKey);
      } else {
        task.status = 'uncompleted';
        saveTasks();
        renderApp();
      }

      if (typeof showUndoToast === 'function') {
        showUndoToast(`売 縲・{task.title}縲阪・繧ｹ繧ｭ繝・・繧定ｧ｣髯､縺励∪縺励◆`, () => {
          if (typeof skipTaskForToday === 'function') {
            skipTaskForToday(tid, curDateKey);
          }
        });
      }
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
        const deletedTask = { ...task };
        if (typeof recordTaskDeletion === 'function') {
          recordTaskDeletion(tid, task.title);
        }
        state.tasks = state.tasks.filter(t => t.id !== tid);
        if (state.activeTaskId === tid) state.activeTaskId = null;

        if (typeof pushUndoAction === 'function') {
          pushUndoAction({
            description: `繧ｿ繧ｹ繧ｯ縲・{deletedTask.title}縲阪ｒ蜑企勁`,
            undo: () => {
              if (typeof unrecordTaskDeletion === 'function') {
                unrecordTaskDeletion(tid);
              }
              state.tasks.push(deletedTask);
            }
          });
        }

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
    const btnCarryoverInbox = document.getElementById('btn-carryover-inbox');
  if (btnCarryoverInbox) {
    btnCarryoverInbox.addEventListener('click', () => {
      carryoverAllPastTasksToInbox();
    });
  }

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
      showCarryoverToast(`驕主悉縺ｮ譛ｪ螳御ｺ・ち繧ｹ繧ｯ ${pastTasks.length}莉ｶ 繧偵蝕nbox縲代∈遘ｻ蜍輔＠縺ｾ縺励◆`);
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

  // Zero-Collision Unique Task ID Generator with High-Water Mark Protection
  function generateNextTaskId() {
    const existingIds = new Set((state.tasks || []).map(t => String(t.id)));
    let maxIdNum = 0;
    existingIds.forEach(id => {
      const match = id.match(/^T(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
      }
    });

    const savedHWM = parseInt(localStorage.getItem('gendrive_task_max_id_v1') || '0', 10);
    let nextNum = Math.max(maxIdNum, isNaN(savedHWM) ? 0 : savedHWM) + 1;

    while (existingIds.has('T' + String(nextNum).padStart(3, '0'))) {
      nextNum++;
    }

    localStorage.setItem('gendrive_task_max_id_v1', String(nextNum));
    return 'T' + String(nextNum).padStart(3, '0');
  }

  // Submit Add Task
  const formAdd = document.getElementById('form-add-task');
  if (formAdd) {
    formAdd.addEventListener('submit', (e) => {
      e.preventDefault();
      const newId = generateNextTaskId();
      const title = document.getElementById('add-task-title').value.trim();
      const estMin = parseInt(document.getElementById('add-task-est-min').value, 10) || 15;
      const section = document.getElementById('add-task-section')?.value || state.currentSection || '隨ｬ2繧ｻ繝・す繝ｧ繝ｳ';
      const customStart = document.getElementById('add-task-custom-start')?.value || null;
      const customEnd = document.getElementById('add-task-custom-end')?.value || null;
      const notes = document.getElementById('add-task-notes').value.trim();
      const obsidianUri = document.getElementById('add-task-obsidian-uri')?.value.trim() || '';
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
        obsidianUri,
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
        description: `繧ｿ繧ｹ繧ｯ縲・{newTask.title}縲阪ｒ霑ｽ蜉`,
        undo: () => {
          if (typeof recordTaskDeletion === 'function') {
            recordTaskDeletion(newId, newTask.title);
          }
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
      task.obsidianUri = document.getElementById('edit-task-obsidian-uri')?.value.trim() || '';
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
        if (typeof recordTaskDeletion === 'function') {
          recordTaskDeletion(taskId, task.title);
        }
        state.tasks = state.tasks.filter(t => t.id !== taskId);
        if (state.activeTaskId === taskId) state.activeTaskId = null;

        pushUndoAction({
          description: `繧ｿ繧ｹ繧ｯ縲・{deletedTask.title}縲阪ｒ蜑企勁`,
          undo: () => {
            if (typeof unrecordTaskDeletion === 'function') {
              unrecordTaskDeletion(taskId);
            }
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
  const subtabAnalytics = document.getElementById('subtab-analytics');
  if (subtabHabits) {
    subtabHabits.addEventListener('click', () => {
      switchMasterSubtab('habits');
    });
  }
  if (subtabTasks) {
    subtabTasks.addEventListener('click', () => {
      switchMasterSubtab('tasks');
    });
  }
  if (subtabSingleTasks) {
    subtabSingleTasks.addEventListener('click', () => {
      switchMasterSubtab('single_tasks');
    });
  }
  if (subtabAnalytics) {
    subtabAnalytics.addEventListener('click', () => {
      switchMasterSubtab('analytics');
    });
  }

  // Focus Navigation for Tasks
  const btnFocusTaskPrev = document.getElementById('btn-focus-task-prev');
  if (btnFocusTaskPrev && !btnFocusTaskPrev.dataset.bound) {
    btnFocusTaskPrev.dataset.bound = 'true';
    btnFocusTaskPrev.addEventListener('click', () => {
      navigateFocusTask(-1);
    });
  }
  const btnFocusTaskNext = document.getElementById('btn-focus-task-next');
  if (btnFocusTaskNext && !btnFocusTaskNext.dataset.bound) {
    btnFocusTaskNext.dataset.bound = 'true';
    btnFocusTaskNext.addEventListener('click', () => {
      navigateFocusTask(1);
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
    const obsidianUri = document.getElementById('add-habit-obsidian-uri')?.value.trim() || '';

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
      obsidianUri,
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
      stats: { d3: 0, d7: 0, d30: 0, d90: 0, sevenDay: 0, thirtyDay: 0, ninetyDay: 0, tier: '験 Developing' }
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
      description: `繝上ン繝・ヨ縲・{newHabit.name}縲阪ｒ霑ｽ蜉`,
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

  // Timing Selector in Edit Form
  document.querySelectorAll('#edit-timing-type-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#edit-timing-type-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.type;
      state.selectedEditTimingType = type;

      const panelSec = document.getElementById('edit-panel-timing-section');
      const panelCustom = document.getElementById('edit-panel-timing-custom');
      if (panelSec) panelSec.classList.toggle('hidden', type !== 'section');
      if (panelCustom) panelCustom.classList.toggle('hidden', type !== 'custom');
    });
  });

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
    const timingType = state.selectedEditTimingType || habit.displayType || 'section';
    let sectionVal = null;
    let customStartVal = null;
    let customEndVal = null;

    if (timingType === 'section') {
      sectionVal = document.getElementById('edit-habit-section')?.value || habit.section || '隨ｬ2繧ｻ繝・す繝ｧ繝ｳ';
    } else if (timingType === 'custom') {
      customStartVal = document.getElementById('edit-custom-start')?.value || habit.customStart || '13:00';
      customEndVal = document.getElementById('edit-custom-end')?.value || habit.customEnd || '17:00';
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
    habit.timingType = timingType;
    habit.section = sectionVal;
    habit.customStart = customStartVal;
    habit.customEnd = customEndVal;
    habit.displayStartDate = displayStartDate;
    habit.displayEndDate = displayEndDate;
    habit.tags = normalizeTags(document.getElementById('edit-habit-tags')?.value);
    habit.notes = document.getElementById('edit-habit-notes')?.value.trim() || '';
    habit.obsidianUri = document.getElementById('edit-habit-obsidian-uri')?.value.trim() || '';
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
      if (Array.isArray(h.history)) {
        if (h.history.includes(todayKey)) {
          h.history = h.history.filter(d => d !== todayKey);
          modified = true;
        }
      } else if (h.history && h.history[todayKey]) {
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
  setInterval(() => {
    if (typeof updateLiveTimers === 'function') {
      updateLiveTimers();
    } else if (typeof updateLiveFocusProgress === 'function') {
      updateLiveFocusProgress();
    }
  }, 1000);
} catch (e) {
  console.error('Error setting intervals:', e);
}

safeInit('sanitizeDailyState', sanitizeDailyState);
safeInit('renderApp', renderApp);

// 繧ｹ繝ｪ繝ｼ繝怜ｾｩ蟶ｰ譎ゅ・繧ｿ繝悶い繧ｯ繝・ぅ繝匁凾縺ｮ鄙梧悃譌･莉伜､画峩蜊ｳ譎ゅメ繧ｧ繝・け・・akeup Rollover Guard・・
function checkDayRolloverWakeup() {
  const curTodayKey = typeof getTodayKey === 'function' ? getTodayKey() : new Date().toLocaleDateString('sv');
  if (state.lastProcessedDate && state.lastProcessedDate !== curTodayKey) {
    console.log(`[Day-Rollover Wakeup] Running auto-sanitizer for new day: ${curTodayKey}`);
    state.lastProcessedDate = curTodayKey;
    if (typeof sanitizeDailyState === 'function') sanitizeDailyState();
    if (typeof renderApp === 'function') renderApp();
  }
}
window.addEventListener('focus', checkDayRolloverWakeup);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkDayRolloverWakeup();
});





