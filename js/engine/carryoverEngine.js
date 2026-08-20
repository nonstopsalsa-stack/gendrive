/**
 * Gendrive - Carryover & Dynamic Task Forwarding Engine
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// Intra-day Section Auto-Forwarding & Past-Day Smart Import
// =========================================================================

let isCarryoverBannerDismissed = false;

// 1. Get Past Incomplete Tasks (Candidates for Daily Carryover)
function getPastIncompleteTasks() {
  const todayKey = getTodayKey();
  return state.tasks.filter(t => {
    if (t.type === 'recurring') return false;
    if (['someday', 'vault'].includes(t.bucket)) return false;
    const st = t.status || 'uncompleted';
    if (st === 'completed' || st === 'skipped') return false;
    if (!t.scheduledDate) return false;
    return t.scheduledDate < todayKey;
  });
}

// 2. Get Tasks for a Section (with Smart Single Forwarding to Current Active Section on Today)
function getTasksForSection(sectionName) {
  const normSecName = normalizeSectionName(sectionName);
  const isToday = state.selectedDateOffset === 0;
  const targetSecIndex = SECTIONS_CONFIG.findIndex(s => s.name === normSecName);

  if (!isToday || targetSecIndex === -1) {
    // Past / Future: Strict section match
    return state.tasks.filter(t => {
      if (!isTaskForSelectedDate(t)) return false;
      return normalizeSectionName(t.section) === normSecName;
    });
  }

  // TODAY:
  const realCurrentSection = normalizeSectionName(detectCurrentSection());
  const realCurrentSecIndex = SECTIONS_CONFIG.findIndex(s => s.name === realCurrentSection);

  const result = [];
  const addedTaskIds = new Set();

  // A. Only when rendering the CURRENT ACTIVE REAL-TIME SECTION, import incomplete single tasks from earlier sections
  if (normSecName === realCurrentSection) {
    state.tasks.forEach(t => {
      if (!isTaskForSelectedDate(t)) return;
      if (t.timingType === 'anytime' || !t.section) return; // Handled in Anytime block
      if (t.type === 'recurring') return; // Recurring stays in its own scheduled section

      const taskSec = normalizeSectionName(t.section);
      const taskSecIndex = SECTIONS_CONFIG.findIndex(s => s.name === taskSec);
      if (taskSecIndex !== -1 && taskSecIndex < realCurrentSecIndex) {
        const st = getTaskStatusForSelectedDate(t);
        if (st !== 'completed' && st !== 'skipped') {
          result.push({
            ...t,
            _carriedOverFrom: t.section
          });
          addedTaskIds.add(t.id);
        }
      }
    });
  }

  // B. Native tasks belonging strictly to this section
  state.tasks.forEach(t => {
    if (!isTaskForSelectedDate(t)) return;
    if (addedTaskIds.has(t.id)) return;
    if (normalizeSectionName(t.section) === normSecName) {
      // 過去セクションの場合、未完了タスクは現在セクションに繰り越されたため過去セクションでは除外
      if (normSecName !== realCurrentSection && targetSecIndex < realCurrentSecIndex) {
        const st = getTaskStatusForSelectedDate(t);
        if (st !== 'completed' && st !== 'skipped' && t.type !== 'recurring') {
          return;
        }
      }
      result.push(t);
    }
  });

  return result;
}

// 3. Update Carryover Banner UI
function updateCarryoverBanner() {
  const banner = document.getElementById('carryover-banner');
  if (!banner) return;

  const isToday = state.selectedDateOffset === 0;
  if (!isToday || isCarryoverBannerDismissed) {
    banner.classList.add('hidden');
    return;
  }

  const pastTasks = getPastIncompleteTasks();
  if (pastTasks.length === 0) {
    banner.classList.add('hidden');
    return;
  }

  // Show banner with dynamic current section name
  banner.classList.remove('hidden');
  const countEl = document.getElementById('carryover-task-count');
  if (countEl) countEl.textContent = pastTasks.length;

  const targetSecEl = document.getElementById('carryover-target-sec-name');
  if (targetSecEl) targetSecEl.textContent = state.currentSection || '現在のセクション';
}

// 4. Carryover All Past Tasks into Current Section (One-Click)
function carryoverAllPastTasksToCurrentSection() {
  const pastTasks = getPastIncompleteTasks();
  if (pastTasks.length === 0) return;

  const todayKey = getTodayKey();
  const targetSection = state.currentSection || '第1セッション';

  pastTasks.forEach(t => {
    t.scheduledDate = todayKey;
    t.section = targetSection;
    if (t.timingType === 'anytime') t.timingType = 'section';
  });

  saveTasks();
  updateCarryoverBanner();
  renderApp();

  const msg = `📥 過去の未完了タスク ${pastTasks.length}件 を【${targetSection}】に取り込みました！⚡`;
  showCarryoverToast(msg);
}

// 5. Carryover Modal Controllers
function openCarryoverModal() {
  const modal = document.getElementById('modal-carryover');
  if (!modal) return;
  renderCarryoverModalList();
  modal.classList.add('active');
}

function closeCarryoverModal() {
  const modal = document.getElementById('modal-carryover');
  if (modal) modal.classList.remove('active');
}

function renderCarryoverModalList() {
  const listContainer = document.getElementById('carryover-tasks-list');
  if (!listContainer) return;

  const pastTasks = getPastIncompleteTasks();
  if (pastTasks.length === 0) {
    listContainer.innerHTML = '<div class="empty-state" style="padding: 24px;"><p>過去の未完了タスクはありません。</p></div>';
    return;
  }

  const curSec = state.currentSection || '第2セッション';

  listContainer.innerHTML = pastTasks.map(t => {
    const estInfo = getEstimatedDuration(t, 'task');
    return `
      <div class="carryover-item-row" data-id="${t.id}">
        <div class="carryover-item-info">
          <div class="carryover-item-title">${t.title}</div>
          <div class="carryover-item-meta">
            <span>📅 当初予定: ${t.scheduledDate || '未定'}</span>
            <span>⏱️ ${t.section || '終日'} (${estInfo.targetMin}分)</span>
            ${t.domainMinor ? `<span class="row-tag domain">${t.domainMinor}</span>` : ''}
          </div>
        </div>
        <div class="carryover-item-actions">
          <button class="btn-carryover-primary" onclick="carryoverSingleTask('${t.id}', '${curSec}')" title="今すぐ現在のセクションに取り込む">
            ⚡ ${curSec}へ
          </button>
          <button class="btn-carryover-subtle" onclick="carryoverSingleTask('${t.id}', 'anytime')" title="今日のいつでも枠に取り込む">
            🌐 Anytimeへ
          </button>
          <button class="btn-carryover-subtle" onclick="postponeTaskToTomorrow('${t.id}')" title="明日に延期">
            📅 明日へ
          </button>
          <button class="btn-carryover-subtle" onclick="moveTaskToBucket('${t.id}', 'inbox')" title="Inboxへ移動">
            📦 Inbox
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function carryoverSingleTask(taskId, targetSection) {
  const task = state.tasks.find(t => String(t.id) === String(taskId));
  if (!task) return;

  task.scheduledDate = getTodayKey();
  if (targetSection === 'anytime') {
    task.timingType = 'anytime';
    task.section = null;
  } else {
    task.timingType = 'section';
    task.section = targetSection;
  }

  saveTasks();
  renderCarryoverModalList();
  updateCarryoverBanner();
  renderApp();
  showCarryoverToast(`「${task.title}」を【${targetSection === 'anytime' ? 'Anytime' : targetSection}】に取り込みました`);
}

function postponeTaskToTomorrow(taskId) {
  const task = state.tasks.find(t => String(t.id) === String(taskId));
  if (!task) return;

  const d = new Date();
  d.setDate(d.getDate() + 1);
  task.scheduledDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  saveTasks();
  renderCarryoverModalList();
  updateCarryoverBanner();
  renderApp();
  showCarryoverToast(`「${task.title}」を明日に延期しました`);
}

function moveTaskToBucket(taskId, bucketName) {
  const task = state.tasks.find(t => String(t.id) === String(taskId));
  if (!task) return;

  task.bucket = bucketName;
  task.scheduledDate = null;

  saveTasks();
  renderCarryoverModalList();
  updateCarryoverBanner();
  renderApp();
  showCarryoverToast(`「${task.title}」を【${bucketName}】へ移動しました`);
}

function showCarryoverToast(message) {
  const el = document.getElementById('sync-status');
  if (el) {
    el.textContent = message;
    el.style.color = '#a5b4fc';
    setTimeout(() => {
      el.textContent = '🟢 保存完了 (' + new Date().toLocaleTimeString() + ')';
      el.style.color = '';
    }, 3000);
  }
}

function setAddTaskDate(type) {
  const d = new Date();
  if (type === 'tomorrow') d.setDate(d.getDate() + 1);
  else if (type === 'in_2_days') d.setDate(d.getDate() + 2);
  else if (type === 'next_monday') {
    const day = d.getDay();
    const diff = (day === 0 ? 1 : 8 - day);
    d.setDate(d.getDate() + diff);
  }
  const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const input = document.getElementById('add-task-scheduled-date');
  if (input) input.value = str;
}

function setEditTaskDate(type) {
  const d = new Date();
  if (type === 'tomorrow') d.setDate(d.getDate() + 1);
  else if (type === 'in_2_days') d.setDate(d.getDate() + 2);
  else if (type === 'next_monday') {
    const day = d.getDay();
    const diff = (day === 0 ? 1 : 8 - day);
    d.setDate(d.getDate() + diff);
  }
  const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const input = document.getElementById('edit-task-scheduled-date');
  if (input) input.value = str;
}
