/**
 * Gendrive Mobile Lite - Core Controller & Local-First Engine
 * 哲生 (AI Company OS & Personal OS Engine)
 */

const STORAGE_KEYS = {
  TASKS: 'habit_flow_tasks_v3',
  HABITS: 'habit_flow_data_v3',
  GOALS: 'habit_flow_goals_v1',
  MANIFESTO: 'habit_flow_manifesto_v1',
  PRESETS: 'habit_flow_task_presets_v1',
  GAS_URL: 'gendrive_gas_api_url',
  METADATA: 'gendrive_sync_metadata_v1'
};

const SECTIONS = [
  { id: 'all', name: '今日全体' },
  { id: 'sec_early', name: '早朝', match: ['第1セッション', '早朝'] },
  { id: 'sec_morning', name: '午前', match: ['第2セッション', '午前'] },
  { id: 'sec_afternoon', name: '午後', match: ['第3セッション', '午後'] },
  { id: 'sec_night', name: '夜', match: ['第4セッション', '夜'] }
];

let mState = {
  tasks: [],
  habits: [],
  selectedDateOffset: 0,
  activeSectionId: 'all',
  activeTaskId: null,
  isSyncing: false,
  isCompletedAccordionOpen: false
};

let activeTimerInterval = null;
let cloudDebounceTimeout = null;

// =========================================================================
// 1. Utilities & Haptic Feedback
// =========================================================================

function haptic(pattern = 15) {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
}

function getTodayDateString(offset = 0) {
  const d = new Date();
  if (offset !== 0) d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function detectCurrentSectionId() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();

  if (mins >= 180 && mins < 510) return 'sec_early';       // 03:00 - 08:30 (第1)
  if (mins >= 510 && mins < 720) return 'sec_morning';     // 08:30 - 12:00 (第2)
  if (mins >= 720 && mins < 1080) return 'sec_afternoon';  // 12:00 - 18:00 (第3)
  return 'sec_night';                                      // 18:00 - 03:00 (第4)
}

function formatTime(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// =========================================================================
// 2. Storage & Metadata Management
// =========================================================================

function getGasUrl() {
  return localStorage.getItem(STORAGE_KEYS.GAS_URL) || '';
}

function setGasUrl(url) {
  if (url) localStorage.setItem(STORAGE_KEYS.GAS_URL, url.trim());
  else localStorage.removeItem(STORAGE_KEYS.GAS_URL);
}

function getMetadata() {
  const saved = localStorage.getItem(STORAGE_KEYS.METADATA);
  if (saved) {
    try { return JSON.parse(saved); } catch (e) {}
  }
  return {
    lastUpdatedAt: new Date(0).toISOString(),
    lastUpdatedDevice: 'MOBILE',
    lastProcessedDate: '',
    version: '1.0'
  };
}

function updateMetadata(fields = {}) {
  const meta = getMetadata();
  const updated = {
    ...meta,
    ...fields,
    lastUpdatedAt: fields.lastUpdatedAt || new Date().toISOString(),
    lastUpdatedDevice: 'MOBILE'
  };
  localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(updated));
  return updated;
}

function loadLocalData() {
  // Tasks
  const savedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
  mState.tasks = savedTasks ? JSON.parse(savedTasks) : [];

  // Habits
  const savedHabits = localStorage.getItem(STORAGE_KEYS.HABITS);
  mState.habits = savedHabits ? JSON.parse(savedHabits) : [];

  // Active Task
  const activeTask = mState.tasks.find(t => t.status === 'in_progress');
  mState.activeTaskId = activeTask ? activeTask.id : null;
}

function saveLocalTasks() {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(mState.tasks));
  updateMetadata();
  triggerCloudPush();
}

function saveLocalHabits() {
  localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(mState.habits));
  updateMetadata();
  triggerCloudPush();
}

// =========================================================================
// 3. Autonomous Day-Rollover & Carryover Engine (Midnight Bed Support)
// =========================================================================

function checkAndRunDayRollover() {
  const todayKey = getTodayDateString(0);
  const meta = getMetadata();

  if (meta.lastProcessedDate !== todayKey) {
    // A new day has arrived while phone was open or just opened
    // 1. Auto carryover past incomplete tasks to today
    let carriedCount = 0;
    mState.tasks.forEach(t => {
      if (t.type !== 'recurring' && !['someday', 'vault'].includes(t.bucket)) {
        if (t.status !== 'completed' && t.status !== 'skipped' && t.scheduledDate && t.scheduledDate < todayKey) {
          t.scheduledDate = todayKey;
          t.section = t.section || '第1セッション';
          carriedCount++;
        }
      }
    });

    // 2. Reset daily habit statuses
    mState.habits.forEach(h => {
      if (h.status !== 'in_progress') {
        const todayCount = (h.history && h.history[todayKey]) ? (h.history[todayKey].count || 0) : 0;
        const target = h.targetTimes || 1;
        h.status = (todayCount >= target) ? 'completed' : 'uncompleted';
      }
    });

    updateMetadata({ lastProcessedDate: todayKey });
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(mState.tasks));
    localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(mState.habits));
    triggerCloudPush();
  }
}

// =========================================================================
// 4. Cloud Synchronization Engine (GAS API)
// =========================================================================

function triggerCloudPush() {
  const gasUrl = getGasUrl();
  if (!gasUrl) return;

  if (cloudDebounceTimeout) clearTimeout(cloudDebounceTimeout);
  cloudDebounceTimeout = setTimeout(() => {
    pushToCloud();
  }, 1000);
}

async function pushToCloud() {
  const gasUrl = getGasUrl();
  if (!gasUrl || mState.isSyncing) return;

  mState.isSyncing = true;
  updateSyncUI('syncing');

  try {
    const meta = updateMetadata({ lastUpdatedDevice: 'MOBILE' });
    const payload = {
      tasks: mState.tasks,
      habits: mState.habits,
      metadata: meta
    };

    const res = await fetch(gasUrl, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.status === 'success') {
      updateSyncUI('success');
    } else {
      updateSyncUI('error');
    }
  } catch (err) {
    console.error('Mobile cloud push failed:', err);
    updateSyncUI('offline');
  } finally {
    mState.isSyncing = false;
  }
}

async function pullFromCloud(force = false) {
  const gasUrl = getGasUrl();
  if (!gasUrl || mState.isSyncing) return;

  mState.isSyncing = true;
  updateSyncUI('syncing');

  try {
    const res = await fetch(`${gasUrl}?t=${Date.now()}`, {
      method: 'GET',
      mode: 'cors'
    });

    const data = await res.json();
    if (data.status === 'success' && data.data) {
      const cloud = data.data;
      const cloudMeta = cloud.metadata || {};
      const localMeta = getMetadata();

      const cloudTime = new Date(cloudMeta.lastUpdatedAt || 0).getTime();
      const localTime = new Date(localMeta.lastUpdatedAt || 0).getTime();

      if (force || cloudTime > localTime) {
        if (Array.isArray(cloud.tasks)) {
          mState.tasks = cloud.tasks;
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(mState.tasks));
        }
        if (Array.isArray(cloud.habits)) {
          mState.habits = cloud.habits;
          localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(mState.habits));
        }

        updateMetadata({
          lastUpdatedAt: cloudMeta.lastUpdatedAt || new Date().toISOString(),
          lastUpdatedDevice: cloudMeta.lastUpdatedDevice || 'CLOUD',
          lastProcessedDate: cloudMeta.lastProcessedDate || localMeta.lastProcessedDate
        });

        // Recheck active task
        const activeTask = mState.tasks.find(t => t.status === 'in_progress');
        mState.activeTaskId = activeTask ? activeTask.id : null;

        renderMobileApp();
        updateSyncUI('success');
      } else if (localTime > cloudTime) {
        pushToCloud();
      } else {
        updateSyncUI('success');
      }
    }
  } catch (err) {
    console.error('Mobile cloud pull failed:', err);
    updateSyncUI('offline');
  } finally {
    mState.isSyncing = false;
  }
}

function updateSyncUI(status) {
  const badge = document.getElementById('m-sync-badge');
  if (!badge) return;

  const gasSet = !!getGasUrl();
  if (!gasSet) {
    badge.innerHTML = '💾 ローカル';
    badge.style.color = '#94a3b8';
    return;
  }

  if (status === 'syncing') {
    badge.innerHTML = '🔄 同期中...';
    badge.style.color = '#38bdf8';
  } else if (status === 'success') {
    badge.innerHTML = '🟢 同期完了';
    badge.style.color = '#4ade80';
  } else if (status === 'offline') {
    badge.innerHTML = '🟡 オフライン';
    badge.style.color = '#facc15';
  } else if (status === 'error') {
    badge.innerHTML = '⚠️ エラー';
    badge.style.color = '#f87171';
  }
}

// =========================================================================
// 5. Task & Habit Actions
// =========================================================================

function startTask(taskId) {
  haptic(15);
  const now = new Date();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  mState.tasks.forEach(t => {
    if (t.id === taskId) {
      t.status = 'in_progress';
      t.actStart = t.actStart || nowTimeStr;
      t.startTimestamp = Date.now();
      mState.activeTaskId = taskId;
    } else if (t.status === 'in_progress') {
      t.status = 'paused';
      if (t.startTimestamp) {
        const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - t.startTimestamp) / 1000));
        t.accumulatedSeconds = (t.accumulatedSeconds || (t.actMin ? t.actMin * 60 : 0)) + sessionElapsedSec;
        t.actMin = Math.round(t.accumulatedSeconds / 60);
      }
      t.startTimestamp = null;
    }
  });

  saveLocalTasks();
  renderMobileApp();
}

function pauseTask(taskId) {
  haptic(15);
  const task = mState.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.status = 'paused';
  if (task.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000));
    task.accumulatedSeconds = (task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0)) + sessionElapsedSec;
    task.actMin = Math.round(task.accumulatedSeconds / 60);
  }
  task.startTimestamp = null;

  if (mState.activeTaskId === taskId) {
    mState.activeTaskId = null;
  }

  saveLocalTasks();
  renderMobileApp();
}

function completeTask(taskId) {
  haptic([20, 50, 20]);
  const task = mState.tasks.find(t => t.id === taskId);
  if (!task) return;

  const now = new Date();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  task.actEnd = nowTimeStr;

  if (task.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000));
    task.accumulatedSeconds = (task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0)) + sessionElapsedSec;
  }

  const finalTotalSec = task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : (task.estMin || 25) * 60);
  task.actMin = Math.max(1, Math.round(finalTotalSec / 60));
  task.status = 'completed';
  task.startTimestamp = null;

  if (mState.activeTaskId === taskId) {
    mState.activeTaskId = null;
  }

  saveLocalTasks();
  renderMobileApp();
}

function uncompleteTask(taskId) {
  haptic(15);
  const task = mState.tasks.find(t => t.id === taskId);
  if (!task) return;

  task.status = 'uncompleted';
  task.actEnd = null;
  task.startTimestamp = null;

  saveLocalTasks();
  renderMobileApp();
}

function toggleHabit(habitId) {
  haptic(20);
  const habit = mState.habits.find(h => String(h.id) === String(habitId));
  if (!habit) return;

  const dateKey = getTodayDateString(mState.selectedDateOffset);
  if (!habit.history) habit.history = {};

  const currentEntry = habit.history[dateKey] || { count: 0 };
  const targetTimes = habit.targetTimes || 1;

  if (currentEntry.count >= targetTimes) {
    // Reset to 0
    delete habit.history[dateKey];
    habit.status = 'uncompleted';
  } else {
    // Mark completed
    habit.history[dateKey] = {
      done: true,
      count: targetTimes,
      completedAt: new Date().toISOString()
    };
    habit.status = 'completed';
  }

  saveLocalHabits();
  renderMobileApp();
}

// =========================================================================
// 6. Rendering Engine
// =========================================================================

function renderMobileApp() {
  renderHeaderDateAndETA();
  renderStickyActiveBar();
  renderSectionTabs();
  renderList();
}

function renderHeaderDateAndETA() {
  const dateEl = document.getElementById('m-header-date');
  const targetDateKey = getTodayDateString(mState.selectedDateOffset);
  const d = new Date();
  d.setDate(d.getDate() + mState.selectedDateOffset);
  const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
  
  if (dateEl) {
    const isToday = mState.selectedDateOffset === 0;
    dateEl.textContent = `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]}) ${isToday ? '今日' : ''}`;
  }

  // Calculate ETA
  const todayTasks = mState.tasks.filter(t => (t.scheduledDate === targetDateKey || (!t.scheduledDate && mState.selectedDateOffset === 0)) && t.bucket !== 'someday' && t.bucket !== 'vault');
  const uncompletedTasks = todayTasks.filter(t => t.status !== 'completed' && t.status !== 'skipped');
  
  let remainingMinutes = 0;
  uncompletedTasks.forEach(t => {
    remainingMinutes += (t.estMin || 25);
  });

  const etaTimeEl = document.getElementById('m-eta-time-val');
  const etaRemainEl = document.getElementById('m-eta-remain-info');

  if (etaTimeEl && etaRemainEl) {
    if (uncompletedTasks.length === 0) {
      etaTimeEl.textContent = 'ALL DONE! ⚡';
      etaRemainEl.textContent = '全完了';
    } else {
      const finishTime = new Date(Date.now() + remainingMinutes * 60000);
      etaTimeEl.textContent = `${String(finishTime.getHours()).padStart(2, '0')}:${String(finishTime.getMinutes()).padStart(2, '0')}`;
      etaRemainEl.textContent = `残 ${Math.round(remainingMinutes / 60 * 10) / 10}h (${uncompletedTasks.length}件)`;
    }
  }
}

function renderStickyActiveBar() {
  const bar = document.getElementById('sticky-active-bar');
  if (!bar) return;

  const activeTask = mState.tasks.find(t => t.id === mState.activeTaskId && t.status === 'in_progress');
  if (!activeTask) {
    bar.classList.add('hidden');
    return;
  }

  bar.classList.remove('hidden');
  document.getElementById('active-bar-title').textContent = activeTask.title;

  updateActiveTimerDisplay(activeTask);
}

function updateActiveTimerDisplay(task) {
  const timerEl = document.getElementById('active-bar-timer');
  if (!timerEl || !task || !task.startTimestamp) return;

  const elapsedSec = (task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0)) + Math.floor((Date.now() - task.startTimestamp) / 1000);
  timerEl.textContent = formatTime(elapsedSec);
}

function renderSectionTabs() {
  const container = document.getElementById('m-section-tabs');
  if (!container) return;

  const targetDateKey = getTodayDateString(mState.selectedDateOffset);

  container.innerHTML = SECTIONS.map(sec => {
    let count = 0;
    if (sec.id === 'all') {
      count = mState.tasks.filter(t => (t.scheduledDate === targetDateKey || (!t.scheduledDate && mState.selectedDateOffset === 0)) && t.status !== 'completed' && t.status !== 'skipped').length;
    } else {
      count = mState.tasks.filter(t => {
        if (t.scheduledDate !== targetDateKey && (t.scheduledDate || mState.selectedDateOffset !== 0)) return false;
        if (t.status === 'completed' || t.status === 'skipped') return false;
        return sec.match.some(m => (t.section || '').includes(m));
      }).length;
    }

    const isActive = mState.activeSectionId === sec.id;
    return `
      <button class="sec-tab-btn ${isActive ? 'active' : ''}" onclick="selectSectionTab('${sec.id}')">
        ${sec.name} <span class="tab-count">(${count})</span>
      </button>
    `;
  }).join('');
}

function selectSectionTab(secId) {
  haptic(10);
  mState.activeSectionId = secId;
  renderMobileApp();
}

function renderList() {
  const container = document.getElementById('m-cards-list');
  const completedContainer = document.getElementById('m-completed-list');
  const completedCountEl = document.getElementById('m-completed-count');
  if (!container || !completedContainer) return;

  const targetDateKey = getTodayDateString(mState.selectedDateOffset);
  const currentSecObj = SECTIONS.find(s => s.id === mState.activeSectionId);

  // 1. Filter Tasks
  let filteredTasks = mState.tasks.filter(t => {
    if (t.bucket === 'someday' || t.bucket === 'vault') return false;
    const isDateMatch = (t.scheduledDate === targetDateKey) || (!t.scheduledDate && mState.selectedDateOffset === 0);
    if (!isDateMatch) return false;

    if (mState.activeSectionId === 'all') return true;
    return currentSecObj.match.some(m => (t.section || '').includes(m));
  });

  // 2. Filter Habits
  let filteredHabits = mState.habits.filter(h => {
    if (mState.activeSectionId === 'all') return true;
    return currentSecObj.match.some(m => (h.section || '').includes(m));
  });

  const uncompletedItems = [];
  const completedItems = [];

  // Separate Habits
  filteredHabits.forEach(h => {
    const entry = (h.history && h.history[targetDateKey]) ? h.history[targetDateKey] : null;
    const isDone = entry && entry.done;
    if (isDone) completedItems.push({ type: 'habit', data: h });
    else uncompletedItems.push({ type: 'habit', data: h });
  });

  // Separate Tasks
  filteredTasks.forEach(t => {
    if (t.status === 'completed' || t.status === 'skipped') {
      completedItems.push({ type: 'task', data: t });
    } else {
      uncompletedItems.push({ type: 'task', data: t });
    }
  });

  // Render Uncompleted
  if (uncompletedItems.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: var(--text-dim);">
        <span style="font-size: 32px; display: block; margin-bottom: 8px;">✨</span>
        <b style="color: var(--text-muted); font-size: 14px;">未完了のアイテムはありません</b>
        <p style="font-size: 12px; margin-top: 4px;">素晴らしい！このセクションはクリアです</p>
      </div>
    `;
  } else {
    container.innerHTML = uncompletedItems.map(item => {
      if (item.type === 'habit') return renderHabitCard(item.data);
      return renderTaskCard(item.data);
    }).join('');
  }

  // Render Completed
  if (completedCountEl) completedCountEl.textContent = completedItems.length;
  if (completedItems.length === 0) {
    completedContainer.innerHTML = '<div style="padding: 10px; color: var(--text-dim); font-size: 12px;">完了アイテムはありません</div>';
  } else {
    completedContainer.innerHTML = completedItems.map(item => {
      if (item.type === 'habit') return renderHabitCard(item.data, true);
      return renderTaskCard(item.data, true);
    }).join('');
  }
}

function renderHabitCard(habit, isCompleted = false) {
  const streak = calculateHabitStreak(habit);
  return `
    <div class="m-card ${isCompleted ? 'completed' : ''}" id="h-card-${habit.id}">
      <div class="m-card-top">
        <div class="m-card-title-row">
          <span class="m-card-type-icon">🌿</span>
          <span class="m-card-title">${habit.name}</span>
        </div>
      </div>
      <div class="m-card-meta">
        ${streak > 0 ? `<span class="m-meta-badge streak">🔥 ${streak}日連続</span>` : ''}
        <span class="m-meta-badge section">⏱️ ${habit.targetMin || 15}分</span>
        <span class="m-meta-badge">${habit.section || '日常'}</span>
      </div>
      <div class="m-card-actions">
        <button class="btn-touch ${isCompleted ? 'btn-touch-subtle' : 'btn-touch-success'}" onclick="toggleHabit('${habit.id}')">
          ${isCompleted ? '↩️ 未完了に戻す' : '✔ 完了する'}
        </button>
      </div>
    </div>
  `;
}

function renderTaskCard(task, isCompleted = false) {
  const isInProgress = task.status === 'in_progress';
  const isPaused = task.status === 'paused';

  return `
    <div class="m-card ${isInProgress ? 'in-progress' : ''} ${isPaused ? 'paused' : ''} ${isCompleted ? 'completed' : ''}" id="t-card-${task.id}">
      <div class="m-card-top">
        <div class="m-card-title-row">
          <span class="m-card-type-icon">🎯</span>
          <span class="m-card-title">${task.title}</span>
        </div>
      </div>
      <div class="m-card-meta">
        <span class="m-meta-badge section">⏱️ 予定 ${task.estMin || 25}分</span>
        ${task.actMin ? `<span class="m-meta-badge" style="color:var(--accent-emerald);">実績 ${task.actMin}分</span>` : ''}
        ${task.domainMinor ? `<span class="m-meta-badge">${task.domainMinor}</span>` : ''}
        ${task.section ? `<span class="m-meta-badge">${task.section}</span>` : ''}
      </div>
      <div class="m-card-actions">
        ${isCompleted ? `
          <button class="btn-touch btn-touch-subtle" onclick="uncompleteTask('${task.id}')">
            ↩️ 未完了に戻す
          </button>
        ` : isInProgress ? `
          <button class="btn-touch btn-touch-pause" onclick="pauseTask('${task.id}')">
            ⏸ 中断
          </button>
          <button class="btn-touch btn-touch-success" onclick="completeTask('${task.id}')">
            ✔ 完了
          </button>
        ` : isPaused ? `
          <button class="btn-touch btn-touch-primary" onclick="startTask('${task.id}')">
            ▶ 再開
          </button>
          <button class="btn-touch btn-touch-success" onclick="completeTask('${task.id}')">
            ✔ 完了
          </button>
        ` : `
          <button class="btn-touch btn-touch-primary" onclick="startTask('${task.id}')">
            ▶ 開始
          </button>
          <button class="btn-touch btn-touch-success" onclick="completeTask('${task.id}')">
            ✔ 完了
          </button>
        `}
      </div>
    </div>
  `;
}

function calculateHabitStreak(h) {
  if (!h.history) return 0;
  let streak = 0;
  const d = new Date();
  
  // Check today or yesterday as start
  for (let i = 0; i < 365; i++) {
    const cur = new Date();
    cur.setDate(d.getDate() - i);
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    const entry = h.history[key];
    if (entry && (entry.done || entry.count > 0)) {
      streak++;
    } else if (i === 0) {
      // today not done yet is fine, check yesterday
      continue;
    } else {
      break;
    }
  }
  return streak;
}

// =========================================================================
// 7. Navigation & Modal Controllers
// =========================================================================

function changeDate(delta) {
  haptic(10);
  mState.selectedDateOffset += delta;
  renderMobileApp();
}

function resetToToday() {
  haptic(10);
  mState.selectedDateOffset = 0;
  mState.activeSectionId = detectCurrentSectionId();
  renderMobileApp();
}

function toggleCompletedAccordion() {
  haptic(10);
  const acc = document.getElementById('m-completed-accordion');
  if (!acc) return;
  mState.isCompletedAccordionOpen = !mState.isCompletedAccordionOpen;
  acc.classList.toggle('open', mState.isCompletedAccordionOpen);
}

function openSettingsModal() {
  haptic(10);
  const modal = document.getElementById('m-settings-modal');
  const input = document.getElementById('m-gas-url-input');
  if (input) input.value = getGasUrl();
  if (modal) modal.classList.add('active');
}

function closeSettingsModal() {
  const modal = document.getElementById('m-settings-modal');
  if (modal) modal.classList.remove('active');
}

function saveSettings() {
  haptic(15);
  const input = document.getElementById('m-gas-url-input');
  if (input) {
    setGasUrl(input.value);
    pullFromCloud(true);
  }
  closeSettingsModal();
}

// =========================================================================
// 8. Initialization & Lifecycle
// =========================================================================

window.addEventListener('DOMContentLoaded', () => {
  loadLocalData();
  mState.activeSectionId = detectCurrentSectionId();
  checkAndRunDayRollover();
  renderMobileApp();

  // Pull fresh cloud data on startup
  if (getGasUrl()) {
    pullFromCloud(false);
  }

  // Active Timer Loop (1 sec)
  if (activeTimerInterval) clearInterval(activeTimerInterval);
  activeTimerInterval = setInterval(() => {
    const activeTask = mState.tasks.find(t => t.id === mState.activeTaskId && t.status === 'in_progress');
    if (activeTask) {
      updateActiveTimerDisplay(activeTask);
    }
  }, 1000);

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration skipped:', err);
    });
  }
});

// Auto-sync when switching back to phone app
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkAndRunDayRollover();
    if (getGasUrl()) {
      pullFromCloud(false);
    }
  }
});
