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
  { id: 'sec_1', name: '🌅 第1', match: ['第1セッション', '第1', '早朝', '朝'] },
  { id: 'sec_2', name: '🍳 朝オペ', match: ['朝オペ', '家事', '育児'] },
  { id: 'sec_3', name: '⚡ 第2', match: ['第2セッション', '第2', '午前'] },
  { id: 'sec_4', name: '🛠️ 第3', match: ['第3セッション', '第3', '午後'] },
  { id: 'sec_5', name: '🍲 夜オペ', match: ['夜オペ', '夕食', '団らん'] },
  { id: 'sec_6', name: '🌙 第4', match: ['第4セッション', '第4', '夜'] }
];

let mState = {
  tasks: [],
  habits: [],
  selectedDateOffset: 0,
  activeMode: 'section', // 'section' | 'daily' | 'task' | 'habit'
  activeTaskId: null,
  isSyncing: false
};

let activeTimerInterval = null;
let cloudDebounceTimeout = null;

function switchMode(mode) {
  try {
    haptic(12);
  } catch (e) {}

  mState.activeMode = mode;
  document.body.className = `theme-${mode}`;

  // Dynamically update Android status bar theme-color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    let barColor = '#070b14';
    if (mode === 'daily') barColor = '#0a0817';
    else if (mode === 'task') barColor = '#060b17';
    else if (mode === 'habit') barColor = '#04120b';
    metaTheme.setAttribute('content', barColor);
  }

  const modes = ['section', 'daily', 'task', 'habit'];
  modes.forEach(m => {
    const btn = document.getElementById(`btn-mode-${m}`);
    if (btn) btn.classList.toggle('active', mode === m);
  });

  renderMobileApp();
}

function switchItemType(type) {
  switchMode(type);
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

function saveLocalTasks(instant = true) {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(mState.tasks));
  updateMetadata({ lastUpdatedDevice: 'MOBILE' });
  if (instant) pushToCloud();
  else triggerCloudPush();
}

function saveLocalHabits(instant = true) {
  localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(mState.habits));
  updateMetadata({ lastUpdatedDevice: 'MOBILE' });
  if (instant) pushToCloud();
  else triggerCloudPush();
}

function getSectionOrder(secStr) {
  if (!secStr) return 4;
  if (secStr.includes('第1') || secStr.includes('早朝') || secStr.includes('朝') && !secStr.includes('朝オペ')) return 1;
  if (secStr.includes('朝オペ') || secStr.includes('家事') || secStr.includes('育児')) return 2;
  if (secStr.includes('第2') || secStr.includes('午前')) return 3;
  if (secStr.includes('第3') || secStr.includes('午後')) return 4;
  if (secStr.includes('夜オペ') || secStr.includes('夕食') || secStr.includes('団らん')) return 5;
  if (secStr.includes('第4') || secStr.includes('夜')) return 6;
  return 4;
}

function autoCarryoverPastSessionTasks() {
  // Pure non-destructive function: do not mutate task.section so that section/daily/task/habit modes work accurately.
}

// =========================================================================
// 3. Autonomous Day-Rollover & Carryover Engine (Midnight Bed Support)
// =========================================================================

function checkAndRunDayRollover() {
  const todayKey = getTodayDateString(0);
  const meta = getMetadata();

  if (meta.lastProcessedDate !== todayKey) {
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
    pushToCloud();
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
  }, 500);
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
      if (data && data.status === 'success') {
        isSuccess = true;
        if (data.lastUpdatedAt) {
          updateMetadata({ lastUpdatedAt: data.lastUpdatedAt });
        }
      }
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

let lastUndoAction = null;
let undoTimeout = null;

function showMobileUndoToast(message, undoCallback) {
  lastUndoAction = undoCallback;
  const toast = document.getElementById('m-undo-toast');
  const text = document.getElementById('m-undo-text');
  if (!toast || !text) return;

  text.textContent = message;
  toast.classList.remove('hidden');

  if (undoTimeout) clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => {
    toast.classList.add('hidden');
    lastUndoAction = null;
  }, 5000);
}

function executeMobileUndo() {
  if (typeof lastUndoAction === 'function') {
    haptic([20, 20]);
    lastUndoAction();
    const toast = document.getElementById('m-undo-toast');
    if (toast) toast.classList.add('hidden');
    lastUndoAction = null;
  }
}

async function pullFromCloud(force = false, isSilent = false) {
  const gasUrl = getGasUrl();
  if (!gasUrl) {
    if (force) alert('⚠️ GAS URLが未設定です。右上の ⚙️（歯車アイコン）からURLを設定してください。');
    return;
  }
  if (mState.isSyncing) return;

  if (!isSilent) {
    mState.isSyncing = true;
    updateSyncUI('syncing');
  }

  try {
    const res = await fetch(`${gasUrl}?t=${Date.now()}`);
    const data = await res.json();
    if (data.status === 'success' && data.data) {
      const cloud = data.data;
      const cloudMeta = cloud.metadata || {};
      const localMeta = getMetadata();

      const cloudTime = new Date(cloudMeta.lastUpdatedAt || 0).getTime();
      const localTime = new Date(localMeta.lastUpdatedAt || 0).getTime();

      // ONLY overwrite if cloud is strictly newer OR force requested
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
        if (force && !isSilent) showMobileUndoToast(`✅ 最新データを同期しました（${mState.tasks.length}件）`);
      } else if (localTime > cloudTime) {
        // Local is newer, push our changes to cloud!
        pushToCloud();
      } else {
        updateSyncUI('success');
      }
    }
  } catch (err) {
    if (!isSilent) console.error('Mobile cloud pull failed:', err);
    updateSyncUI('offline');
    if (force && !isSilent) alert('クラウドからの取得に失敗しました。URLまたはネット接続を確認してください。');
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
// 5. Touch Action Handlers (Task & Habit State Transitions)
// =========================================================================

function startTask(taskId) {
  haptic(20);
  const targetTask = mState.tasks.find(t => t.id === taskId);
  if (!targetTask) return;

  mState.tasks.forEach(t => {
    if (t.id === taskId) {
      t.status = 'in_progress';
      t.startTimestamp = Date.now();
      mState.activeTaskId = t.id;
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

function completeTask(taskId) {
  haptic([20, 50, 20]);
  const task = mState.tasks.find(t => t.id === taskId);
  if (!task) return;

  const backupTask = JSON.parse(JSON.stringify(task));

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

  showMobileUndoToast(`⚡ 「${task.title}」を完了しました`, () => {
    Object.assign(task, backupTask);
    if (backupTask.status === 'in_progress') mState.activeTaskId = task.id;
    saveLocalTasks();
    renderMobileApp();
  });
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

  const backupHistory = JSON.parse(JSON.stringify(habit.history));
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
  autoCarryoverPastSessionTasks();
  document.body.className = `theme-${mState.activeMode || 'section'}`;
  renderHeaderDateAndETA();
  renderStickyActiveBar();
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

  // Today's Uncompleted Tasks
  const todayTasks = mState.tasks.filter(t => (t.scheduledDate === targetDateKey || (!t.scheduledDate && mState.selectedDateOffset === 0)) && t.bucket !== 'someday' && t.bucket !== 'vault' && t.status !== 'completed' && t.status !== 'skipped');

  // Today's Uncompleted Habits
  const todayHabits = mState.habits.filter(h => {
    const entry = (h.history && h.history[targetDateKey]) ? h.history[targetDateKey] : null;
    return !(entry && entry.done);
  });

  // Current Section Tasks & Habits
  const currentSecId = detectCurrentSectionId();
  const currentSecObj = SECTIONS.find(s => s.id === currentSecId) || SECTIONS[4];
  const sectionTasks = todayTasks.filter(t => currentSecObj.match.some(m => (t.section || '').includes(m)));
  const sectionHabits = todayHabits.filter(h => currentSecObj.match.some(m => (h.section || '').includes(m)));

  // Update 4-Button Counts (Pure numbers for sleek pill badge)
  const sectionCountEl = document.getElementById('m-section-count');
  const dailyCountEl = document.getElementById('m-daily-count');
  const taskCountEl = document.getElementById('m-task-count');
  const habitCountEl = document.getElementById('m-habit-count');

  if (sectionCountEl) sectionCountEl.textContent = sectionTasks.length + sectionHabits.length;
  if (dailyCountEl) dailyCountEl.textContent = todayTasks.length + todayHabits.length;
  if (taskCountEl) taskCountEl.textContent = todayTasks.length;
  if (habitCountEl) habitCountEl.textContent = todayHabits.length;

  // Calculate ETA for Tasks
  let remainingMinutes = 0;
  todayTasks.forEach(t => {
    remainingMinutes += (t.estMin || 25);
  });

  const etaTimeEl = document.getElementById('m-eta-time-val');
  const etaRemainEl = document.getElementById('m-eta-remain-info');

  if (etaTimeEl && etaRemainEl) {
    if (todayTasks.length === 0) {
      etaTimeEl.textContent = 'ALL DONE! ⚡';
      etaRemainEl.textContent = '全完了';
    } else {
      const finishTime = new Date(Date.now() + remainingMinutes * 60000);
      etaTimeEl.textContent = `${String(finishTime.getHours()).padStart(2, '0')}:${String(finishTime.getMinutes()).padStart(2, '0')}`;
      etaRemainEl.textContent = `残 ${Math.round(remainingMinutes / 60 * 10) / 10}h (${todayTasks.length}件)`;
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

function renderList() {
  const container = document.getElementById('m-cards-list');
  if (!container) return;

  const targetDateKey = getTodayDateString(mState.selectedDateOffset);
  const currentSecId = detectCurrentSectionId();
  const currentSecObj = SECTIONS.find(s => s.id === currentSecId) || SECTIONS[4];

  // 1. Get Today's Uncompleted Tasks
  const todayTasks = mState.tasks.filter(t => {
    if (t.bucket === 'someday' || t.bucket === 'vault') return false;
    if (t.status === 'completed' || t.status === 'skipped') return false;
    return (t.scheduledDate === targetDateKey) || (!t.scheduledDate && mState.selectedDateOffset === 0);
  });

  // 2. Get Today's Uncompleted Habits
  const todayHabits = mState.habits.filter(h => {
    const entry = (h.history && h.history[targetDateKey]) ? h.history[targetDateKey] : null;
    return !(entry && entry.done);
  });

  const mode = mState.activeMode || 'section';

  if (mode === 'section') {
    // Current Section Tasks + Habits
    const secTasks = todayTasks.filter(t => currentSecObj.match.some(m => (t.section || '').includes(m)));
    const secHabits = todayHabits.filter(h => currentSecObj.match.some(m => (h.section || '').includes(m)));

    const secHeaderHtml = `
      <div class="m-section-indicator">
        <span class="m-sec-left">⚡ <b>${currentSecObj.name}</b> (現在セクション)</span>
        <span class="m-sec-count-tag">${secTasks.length + secHabits.length}件</span>
      </div>
    `;

    if (secTasks.length === 0 && secHabits.length === 0) {
      container.innerHTML = `
        ${secHeaderHtml}
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">✨</span>
          <b style="color: var(--text-muted); font-size: 14px;">現在セクション（${currentSecObj.name}）の未完了項目はありません</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">このセクションのタスク・ハビットは全完了です！</p>
        </div>
      `;
      return;
    }

    const tasksHtml = secTasks.map(t => renderSlimTaskCard(t)).join('');
    const habitsHtml = secHabits.map(h => renderSlimHabitCard(h)).join('');
    container.innerHTML = secHeaderHtml + tasksHtml + habitsHtml;

  } else if (mode === 'daily') {
    // All Today Tasks + Habits (Flat list, no section partitions)
    const sortedTasks = secSortedTasks(todayTasks);
    const sortedHabits = secSortedHabits(todayHabits);

    const dailyHeaderHtml = `
      <div class="m-section-indicator daily-indicator">
        <span class="m-sec-left">📅 <b>本日の全アイテム</b> (フラット表示)</span>
        <span class="m-sec-count-tag">${sortedTasks.length + sortedHabits.length}件</span>
      </div>
    `;

    if (sortedTasks.length === 0 && sortedHabits.length === 0) {
      container.innerHTML = `
        ${dailyHeaderHtml}
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">🎉</span>
          <b style="color: var(--text-muted); font-size: 14px;">本日のタスク・習慣はすべて完了しました！</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">素晴らしい一日です⚡</p>
        </div>
      `;
      return;
    }

    const tasksHtml = sortedTasks.map(t => renderSlimTaskCard(t)).join('');
    const habitsHtml = sortedHabits.map(h => renderSlimHabitCard(h)).join('');
    container.innerHTML = dailyHeaderHtml + tasksHtml + habitsHtml;

  } else if (mode === 'task') {
    // Today's Tasks Only (Flat list)
    const sortedTasks = secSortedTasks(todayTasks);

    const taskHeaderHtml = `
      <div class="m-section-indicator task-indicator">
        <span class="m-sec-left">🎯 <b>本日のタスク一覧</b></span>
        <span class="m-sec-count-tag">${sortedTasks.length}件</span>
      </div>
    `;

    if (sortedTasks.length === 0) {
      container.innerHTML = `
        ${taskHeaderHtml}
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">⚡</span>
          <b style="color: var(--text-muted); font-size: 14px;">未完了のタスクはありません</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">本日のタスクは全完了です！</p>
        </div>
      `;
      return;
    }

    container.innerHTML = taskHeaderHtml + sortedTasks.map(t => renderSlimTaskCard(t)).join('');

  } else if (mode === 'habit') {
    // Today's Habits Only (Flat list)
    const sortedHabits = secSortedHabits(todayHabits);

    const habitHeaderHtml = `
      <div class="m-section-indicator habit-indicator">
        <span class="m-sec-left">🌿 <b>本日のハビット一覧</b></span>
        <span class="m-sec-count-tag">${sortedHabits.length}件</span>
      </div>
    `;

    if (sortedHabits.length === 0) {
      container.innerHTML = `
        ${habitHeaderHtml}
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">🌿</span>
          <b style="color: var(--text-muted); font-size: 14px;">未完了のハビットはありません</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">今日の習慣はすべて達成済みです！</p>
        </div>
      `;
      return;
    }

    container.innerHTML = habitHeaderHtml + sortedHabits.map(h => renderSlimHabitCard(h)).join('');
  }
}

function secSortedTasks(tasks) {
  return tasks.slice().sort((a, b) => getSectionOrder(a.section) - getSectionOrder(b.section));
}

function secSortedHabits(habits) {
  return habits.slice().sort((a, b) => getSectionOrder(a.section) - getSectionOrder(b.section));
}

function renderSlimHabitCard(habit) {
  return `
    <div class="m-card-slim" id="h-card-${habit.id}">
      <div class="m-card-left" onclick="toggleHabit('${habit.id}')" style="cursor:pointer;">
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
      <div class="m-card-left" onclick="${isInProgress ? `completeTask('${task.id}')` : `startTask('${task.id}')`}" style="cursor:pointer;">
        <span class="m-slim-icon">${isInProgress ? '⚡' : isPaused ? '⏸' : '🎯'}</span>
        <span class="m-slim-title">${task.title}</span>
        ${isInProgress ? `<span class="m-slim-timer-badge" id="timer-badge-${task.id}">00:00</span>` : ''}
      </div>
      <div class="m-card-actions-slim">
        ${isInProgress ? `
          <button class="btn-slim btn-slim-success" onclick="completeTask('${task.id}')">
            ✔ 完了
          </button>
        ` : isPaused ? `
          <button class="btn-slim btn-slim-pause-resume" onclick="startTask('${task.id}')">
            ▶ 再開
          </button>
        ` : `
          <button class="btn-slim btn-slim-primary" onclick="startTask('${task.id}')">
            ▶ 開始
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
  renderMobileApp();
}

function toggleCompletedAccordion() {
  haptic(10);
  const acc = document.getElementById('m-completed-accordion');
  if (!acc) return;
  mState.isCompletedAccordionOpen = !mState.isCompletedAccordionOpen;
  acc.classList.toggle('open', mState.isCompletedAccordionOpen);
}

function openQuickAddModal() {
  haptic(10);
  const modal = document.getElementById('m-quick-add-modal');
  const titleInput = document.getElementById('m-quick-task-title');
  const secSelect = document.getElementById('m-quick-task-section');

  // Set current active section as default in select
  const currentSecId = detectCurrentSectionId();
  const currentSecObj = SECTIONS.find(s => s.id === currentSecId);
  if (secSelect && currentSecObj) {
    secSelect.value = currentSecObj.match[0];
  }

  if (modal) {
    modal.classList.add('active');
    try {
      history.pushState({ modalOpen: 'quickAdd' }, '');
    } catch (e) {}
    if (titleInput) {
      titleInput.value = '';
      setTimeout(() => titleInput.focus(), 150);
    }
  }
}

function closeQuickAddModal(fromHistory = false) {
  const modal = document.getElementById('m-quick-add-modal');
  if (modal && modal.classList.contains('active')) {
    modal.classList.remove('active');
    if (!fromHistory && history.state && history.state.modalOpen) {
      try { history.back(); } catch (e) {}
    }
  }
}

function handleQuickAddTask(e) {
  if (e) e.preventDefault();
  haptic([15, 30]);

  const titleInput = document.getElementById('m-quick-task-title');
  const secSelect = document.getElementById('m-quick-task-section');
  const estSelect = document.getElementById('m-quick-task-est');

  const title = (titleInput ? titleInput.value : '').trim();
  if (!title) return;

  const section = secSelect ? secSelect.value : '第3セッション';
  const estMin = parseInt(estSelect ? estSelect.value : '25', 10) || 25;

  const newTask = {
    id: `m_task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    title: title,
    status: 'uncompleted',
    section: section,
    estMin: estMin,
    actMin: 0,
    scheduledDate: getTodayDateString(mState.selectedDateOffset),
    timingType: 'scheduled',
    bucket: 'today',
    label: 'p1',
    createdAt: new Date().toISOString()
  };

  mState.tasks.push(newTask);
  saveLocalTasks(true); // Save & Push to Cloud immediately!
  closeQuickAddModal();
  renderMobileApp();

  showMobileUndoToast(`⚡ 「${title}」を追加しました`, () => {
    mState.tasks = mState.tasks.filter(t => t.id !== newTask.id);
    saveLocalTasks(true);
    renderMobileApp();
  });
}

function openSettingsModal() {
  haptic(10);
  const modal = document.getElementById('m-settings-modal');
  const input = document.getElementById('m-gas-url-input');
  if (input) input.value = getGasUrl();
  if (modal) {
    modal.classList.add('active');
    // Android Back Stack Push
    try {
      history.pushState({ modalOpen: 'settings' }, '');
    } catch (e) {}
  }
}

function closeSettingsModal(fromHistory = false) {
  const modal = document.getElementById('m-settings-modal');
  if (modal && modal.classList.contains('active')) {
    modal.classList.remove('active');
    if (!fromHistory && history.state && history.state.modalOpen) {
      try { history.back(); } catch (e) {}
    }
  }
}

// Android Hardware Back Button & Gesture Navigation Listener
window.addEventListener('popstate', (e) => {
  const settingsModal = document.getElementById('m-settings-modal');
  const quickAddModal = document.getElementById('m-quick-add-modal');

  if (quickAddModal && quickAddModal.classList.contains('active')) {
    closeQuickAddModal(true);
  }
  if (settingsModal && settingsModal.classList.contains('active')) {
    closeSettingsModal(true);
  }
});

function saveSettings() {
  haptic(15);
  const input = document.getElementById('m-gas-url-input');
  if (input) {
    setGasUrl(input.value);
    pullFromCloud(true);
  }
  closeSettingsModal();
}

window.addEventListener('DOMContentLoaded', () => {
  loadLocalData();
  checkAndRunDayRollover();
  renderMobileApp();

  // Attach safe explicit listeners to the 4 mode switch buttons
  ['section', 'daily', 'task', 'habit'].forEach(m => {
    const btn = document.getElementById(`btn-mode-${m}`);
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        switchMode(m);
      });
    }
  });

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

  // 15-Second Silent Heartbeat Sync Loop
  setInterval(() => {
    if (getGasUrl() && !mState.isSyncing) {
      pullFromCloud(false, true); // Silent background check
    }
  }, 15000);

  // Auto-sync when app comes to foreground (tab focus or PWA resume)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && getGasUrl()) {
      pullFromCloud(false, true);
    }
  });

  window.addEventListener('focus', () => {
    if (getGasUrl()) {
      pullFromCloud(false, true);
    }
  });

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.log('SW registration skipped:', err);
    });
  }
});
