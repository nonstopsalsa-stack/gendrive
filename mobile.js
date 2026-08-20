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
  { id: 'sec_1', name: '第1セッション', match: ['第1セッション', '第1', '早朝', '朝'] },
  { id: 'sec_2', name: '朝オペ', match: ['朝オペ', '家事', '育児'] },
  { id: 'sec_3', name: '第2セッション', match: ['第2セッション', '第2', '午前'] },
  { id: 'sec_4', name: '第3セッション', match: ['第3セッション', '第3', '午後'] },
  { id: 'sec_5', name: '夜オペ', match: ['夜オペ', '夕食', '団らん'] },
  { id: 'sec_6', name: '第4セッション', match: ['第4セッション', '第4', '夜'] }
];

let mState = {
  tasks: [],
  habits: [],
  selectedDateOffset: 0,
  activeType: 'task', // 'task' | 'habit'
  activeSectionId: 'all',
  activeTaskId: null,
  isSyncing: false
};

let activeTimerInterval = null;
let cloudDebounceTimeout = null;

function switchItemType(type) {
  haptic(12);
  mState.activeType = type;
  document.body.className = type === 'task' ? 'theme-task' : 'theme-habit';

  const btnTask = document.getElementById('btn-mode-task');
  const btnHabit = document.getElementById('btn-mode-habit');
  if (btnTask && btnHabit) {
    btnTask.classList.toggle('active', type === 'task');
    btnHabit.classList.toggle('active', type === 'habit');
  }

  renderMobileApp();
}

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
  const hours = now.getHours() + now.getMinutes() / 60;

  if (hours >= 3 && hours < 6) return 'sec_1';       // 03:00 - 06:00 (第1セッション)
  if (hours >= 6 && hours < 8.5) return 'sec_2';     // 06:00 - 08:30 (朝オペ)
  if (hours >= 8.5 && hours < 12) return 'sec_3';    // 08:30 - 12:00 (第2セッション)
  if (hours >= 12 && hours < 17) return 'sec_4';     // 12:00 - 17:00 (第3セッション)
  if (hours >= 17 && hours < 21) return 'sec_5';     // 17:00 - 21:00 (夜オペ)
  return 'sec_6';                                    // 21:00 - 03:00 (第4セッション)
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
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });

    let isSuccess = false;
    try {
      const data = await res.json();
      if (data && data.status === 'success') isSuccess = true;
    } catch (e) {
      if (res.ok || res.status === 200 || res.type === 'opaque') isSuccess = true;
    }

    if (isSuccess) {
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
    const res = await fetch(`${gasUrl}?t=${Date.now()}`);
    const data = await res.json();
    if (data.status === 'success' && data.data) {
      const cloud = data.data;
      const cloudMeta = cloud.metadata || {};
      const localMeta = getMetadata();

      const cloudTime = new Date(cloudMeta.lastUpdatedAt || 0).getTime();
      const localTime = new Date(localMeta.lastUpdatedAt || 0).getTime();

      if (force || cloudTime > localTime || (Array.isArray(cloud.tasks) && cloud.tasks.length > 0)) {
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
  document.body.className = mState.activeType === 'task' ? 'theme-task' : 'theme-habit';
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

  // Count Uncompleted for Today
  const todayTasks = mState.tasks.filter(t => (t.scheduledDate === targetDateKey || (!t.scheduledDate && mState.selectedDateOffset === 0)) && t.bucket !== 'someday' && t.bucket !== 'vault');
  const uncompletedTasks = todayTasks.filter(t => t.status !== 'completed' && t.status !== 'skipped');

  const uncompletedHabits = mState.habits.filter(h => {
    const entry = (h.history && h.history[targetDateKey]) ? h.history[targetDateKey] : null;
    return !(entry && entry.done);
  });

  // Update Switcher Counts
  const taskCountEl = document.getElementById('m-task-count');
  const habitCountEl = document.getElementById('m-habit-count');
  if (taskCountEl) taskCountEl.textContent = `(${uncompletedTasks.length})`;
  if (habitCountEl) habitCountEl.textContent = `(${uncompletedHabits.length})`;

  // Calculate ETA for Tasks
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
  const badgeEl = document.getElementById(`timer-badge-${task.id}`);
  if (!task || !task.startTimestamp) return;

  const elapsedSec = (task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0)) + Math.floor((Date.now() - task.startTimestamp) / 1000);
  const timeFormatted = formatTime(elapsedSec);
  if (timerEl) timerEl.textContent = timeFormatted;
  if (badgeEl) badgeEl.textContent = timeFormatted;
}

function renderSectionTabs() {
  const container = document.getElementById('m-section-tabs');
  if (!container) return;

  const targetDateKey = getTodayDateString(mState.selectedDateOffset);

  container.innerHTML = SECTIONS.map(sec => {
    let count = 0;
    if (mState.activeType === 'task') {
      if (sec.id === 'all') {
        count = mState.tasks.filter(t => (t.scheduledDate === targetDateKey || (!t.scheduledDate && mState.selectedDateOffset === 0)) && t.status !== 'completed' && t.status !== 'skipped' && t.bucket !== 'someday' && t.bucket !== 'vault').length;
      } else {
        count = mState.tasks.filter(t => {
          if (t.scheduledDate !== targetDateKey && (t.scheduledDate || mState.selectedDateOffset !== 0)) return false;
          if (t.status === 'completed' || t.status === 'skipped' || t.bucket === 'someday' || t.bucket === 'vault') return false;
          return sec.match.some(m => (t.section || '').includes(m));
        }).length;
      }
    } else {
      // Habits count
      if (sec.id === 'all') {
        count = mState.habits.filter(h => {
          const entry = (h.history && h.history[targetDateKey]) ? h.history[targetDateKey] : null;
          return !(entry && entry.done);
        }).length;
      } else {
        count = mState.habits.filter(h => {
          const entry = (h.history && h.history[targetDateKey]) ? h.history[targetDateKey] : null;
          if (entry && entry.done) return false;
          return sec.match.some(m => (h.section || '').includes(m));
        }).length;
      }
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
  if (!container) return;

  const targetDateKey = getTodayDateString(mState.selectedDateOffset);
  const currentSecObj = SECTIONS.find(s => s.id === mState.activeSectionId);

  if (mState.activeType === 'task') {
    // 1. Filter Tasks (Uncompleted Only)
    let filteredTasks = mState.tasks.filter(t => {
      if (t.bucket === 'someday' || t.bucket === 'vault') return false;
      if (t.status === 'completed' || t.status === 'skipped') return false; // Hide Completed
      const isDateMatch = (t.scheduledDate === targetDateKey) || (!t.scheduledDate && mState.selectedDateOffset === 0);
      if (!isDateMatch) return false;

      if (mState.activeSectionId === 'all') return true;
      return currentSecObj.match.some(m => (t.section || '').includes(m));
    });

    if (filteredTasks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">✨</span>
          <b style="color: var(--text-muted); font-size: 14px;">未完了のタスクはありません</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">このセクションのタスクは全完了です！</p>
        </div>
      `;
    } else {
      container.innerHTML = filteredTasks.map(t => renderSlimTaskCard(t)).join('');
    }
  } else {
    // 2. Filter Habits (Uncompleted Only)
    let filteredHabits = mState.habits.filter(h => {
      const entry = (h.history && h.history[targetDateKey]) ? h.history[targetDateKey] : null;
      if (entry && entry.done) return false; // Hide Completed

      if (mState.activeSectionId === 'all') return true;
      return currentSecObj.match.some(m => (h.section || '').includes(m));
    });

    if (filteredHabits.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">🌿</span>
          <b style="color: var(--text-muted); font-size: 14px;">未完了のハビットはありません</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">今日の習慣はすべて達成済みです！</p>
        </div>
      `;
    } else {
      container.innerHTML = filteredHabits.map(h => renderSlimHabitCard(h)).join('');
    }
  }
}

function renderSlimHabitCard(habit) {
  return `
    <div class="m-card-slim" id="h-card-${habit.id}">
      <div class="m-card-left">
        <span class="m-slim-icon">🌿</span>
        <span class="m-slim-title">${habit.name}</span>
      </div>
      <div class="m-card-actions-slim">
        <button class="btn-slim btn-slim-success" onclick="toggleHabit('${habit.id}')">
          ✔ 完了
        </button>
      </div>
    </div>
  `;
}

function renderSlimTaskCard(task) {
  const isInProgress = task.status === 'in_progress';
  const isPaused = task.status === 'paused';

  return `
    <div class="m-card-slim ${isInProgress ? 'in-progress' : ''} ${isPaused ? 'paused' : ''}" id="t-card-${task.id}">
      <div class="m-card-left">
        <span class="m-slim-icon">${isInProgress ? '⚡' : isPaused ? '⏸' : '🎯'}</span>
        <span class="m-slim-title">${task.title}</span>
        ${isInProgress ? `<span class="m-slim-timer-badge" id="timer-badge-${task.id}">00:00</span>` : ''}
      </div>
      <div class="m-card-actions-slim">
        ${isInProgress ? `
          <button class="btn-slim btn-slim-pause" onclick="pauseTask('${task.id}')">
            ⏸ 中断
          </button>
          <button class="btn-slim btn-slim-success" onclick="completeTask('${task.id}')">
            ✔ 完了
          </button>
        ` : isPaused ? `
          <button class="btn-slim btn-slim-primary" onclick="startTask('${task.id}')">
            ▶ 再開
          </button>
          <button class="btn-slim btn-slim-success" onclick="completeTask('${task.id}')">
            ✔ 完了
          </button>
        ` : `
          <button class="btn-slim btn-slim-primary" onclick="startTask('${task.id}')">
            ▶ 開始
          </button>
          <button class="btn-slim btn-slim-success" onclick="completeTask('${task.id}')">
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
