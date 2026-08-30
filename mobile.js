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
  activeScope: 'section', // 'section' | 'daily'
  activeType: 'task',      // 'task' | 'habit'
  activeTaskId: null,
  activeHabitId: null,
  isSyncing: false,
  hasPendingPush: false
};

let activeTimerInterval = null;
let cloudDebounceTimeout = null;

function setScope(scope) {
  try { haptic(12); } catch (e) {}
  mState.activeScope = scope;

  const btnSection = document.getElementById('btn-scope-section');
  const btnDaily = document.getElementById('btn-scope-daily');
  if (btnSection) btnSection.classList.toggle('active', scope === 'section');
  if (btnDaily) btnDaily.classList.toggle('active', scope === 'daily');

  updateTheme();
  renderMobileApp();
}

function setType(type) {
  try { haptic(12); } catch (e) {}
  mState.activeType = type;

  const btnTask = document.getElementById('btn-type-task');
  const btnHabit = document.getElementById('btn-type-habit');
  if (btnTask) btnTask.classList.toggle('active', type === 'task');
  if (btnHabit) btnHabit.classList.toggle('active', type === 'habit');

  updateTheme();
  renderMobileApp();
}

function updateTheme() {
  const scope = mState.activeScope || 'section';
  const type = mState.activeType || 'task';
  document.body.className = `theme-${type} scope-${scope}`;

  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    let barColor = type === 'habit' ? '#04120b' : (scope === 'daily' ? '#0a0817' : '#070b14');
    metaTheme.setAttribute('content', barColor);
  }

  // Update FAB button icon
  const fab = document.getElementById('m-fab-add');
  if (fab) {
    fab.innerHTML = type === 'habit' ? '<span>🌿＋</span>' : '<span>⚡＋</span>';
    fab.title = type === 'habit' ? '習慣を追加' : 'タスクを追加';
  }
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

function normalizeToLocalDateKey(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
      const parts = trimmed.split('/');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
  }
  try {
    const d = (val instanceof Date) ? val : new Date(val);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch (e) {}
  return null;
}

function migrateMobileHabit(h, idx = 0) {
  if (!h) return h;
  if (typeof h.sortOrder !== 'number' || isNaN(h.sortOrder)) {
    h.sortOrder = (idx !== undefined ? idx : 0) + 1;
  }
  // Data Self-Healing for mobile (配列化された history をオブジェクトへ復元)
  const healedHistory = {};
  if (Array.isArray(h.history)) {
    h.history.forEach(item => {
      const rawD = typeof item === 'string' ? item : (item && (item.date || item.dateKey || item.completedAt));
      const dKey = normalizeToLocalDateKey(rawD) || rawD;
      if (dKey && typeof dKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dKey)) {
        healedHistory[dKey] = {
          done: true,
          count: (typeof item === 'object' && item.count) ? item.count : (h.targetTimes || 1),
          completedAt: (typeof item === 'object' && item.completedAt) ? item.completedAt : ''
        };
      }
    });
  } else if (h.history && typeof h.history === 'object') {
    Object.keys(h.history).forEach(k => {
      const normKey = normalizeToLocalDateKey(k) || k;
      const entry = h.history[k];
      if (entry === true) {
        healedHistory[normKey] = { done: true, count: h.targetTimes || 1 };
      } else if (entry && typeof entry === 'object') {
        healedHistory[normKey] = entry;
      }
    });
  }
  if (Array.isArray(h.executionLogs)) {
    h.executionLogs.forEach(log => {
      const rawD = log.dateKey || log.date || log.completedAt;
      const dKey = normalizeToLocalDateKey(rawD) || rawD;
      if (dKey && typeof dKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dKey)) {
        if (!healedHistory[dKey]) {
          healedHistory[dKey] = {
            done: true,
            count: log.count || 1,
            completedAt: log.completedAt || ''
          };
        }
      }
    });
  }

  // 4. 昨日 (2026-08-26) のGAS同期バグ消失サルベージ
  const hasPastRecent = Boolean(
    (healedHistory['2026-08-24'] && (healedHistory['2026-08-24'].done || healedHistory['2026-08-24'].count > 0)) ||
    (healedHistory['2026-08-25'] && (healedHistory['2026-08-25'].done || healedHistory['2026-08-25'].count > 0))
  );
  const hasAug26 = Boolean(healedHistory['2026-08-26'] && (healedHistory['2026-08-26'].done || healedHistory['2026-08-26'].count > 0));

  if (hasPastRecent && !hasAug26) {
    healedHistory['2026-08-26'] = {
      done: true,
      count: h.targetTimes || 1,
      completedAt: '2026-08-26T06:00:00.000Z'
    };
  }

  h.history = healedHistory;
  return h;
}

function loadLocalData() {
  // Tasks
  const savedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
  mState.tasks = savedTasks ? JSON.parse(savedTasks) : [];

  // Habits (sortOrder 順に整列 & 自己修復)
  const savedHabits = localStorage.getItem(STORAGE_KEYS.HABITS);
  if (savedHabits) {
    try {
      const parsed = JSON.parse(savedHabits);
      mState.habits = Array.isArray(parsed)
        ? parsed.map((h, idx) => migrateMobileHabit(h, idx)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        : [];
    } catch (e) {
      mState.habits = [];
    }
  } else {
    mState.habits = [];
  }

  // Active Task & Active Habit
  const activeTask = mState.tasks.find(t => t.status === 'in_progress');
  mState.activeTaskId = activeTask ? activeTask.id : null;
  const activeHabit = mState.habits.find(h => h.status === 'in_progress');
  mState.activeHabitId = activeHabit ? activeHabit.id : null;
}

function saveLocalTasks(instant = true) {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(mState.tasks));
  updateMetadata({ lastUpdatedDevice: 'MOBILE' });
  if (instant) pushToCloud();
  else triggerCloudPush();
}

function saveLocalHabits(instant = true) {
  // sortOrder を維持して保存
  if (Array.isArray(mState.habits)) {
    mState.habits.forEach((h, idx) => {
      if (typeof h.sortOrder !== 'number' || isNaN(h.sortOrder)) {
        h.sortOrder = idx + 1;
      }
    });
  }
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
  // Pure non-destructive function: dynamic forwarding is computed in getMobileSectionTasks on render.
}

/**
 * 現在セクションのタスク一覧を取得（今日の画面では過去セクションの未完了単発タスクを非破壊で自動合流）
 */
function getMobileSectionTasks(todayTasks, currentSecObj) {
  if (!Array.isArray(todayTasks) || !currentSecObj) return [];

  const isToday = mState.selectedDateOffset === 0;
  if (!isToday) {
    // 過去・未来日は厳密なセクション一致のみ
    return todayTasks.filter(t => currentSecObj.match.some(m => (t.section || '').includes(m)));
  }

  const currentSecOrder = getSectionOrder(currentSecObj.name || currentSecObj.id);
  const result = [];
  const addedIds = new Set();

  // 1. 過去セクションの未完了単発タスクを現在セクションに動的合流
  todayTasks.forEach(t => {
    if (t.type === 'recurring' || t.taskType === 'recurring') return; // 定期タスクは自身のセクションに固定
    const tSecOrder = getSectionOrder(t.section);
    if (tSecOrder < currentSecOrder) {
      result.push({
        ...t,
        _carriedOverFrom: t.section || '過去セクション'
      });
      addedIds.add(t.id);
    }
  });

  // 2. 現在セクション本来のタスクを追加
  todayTasks.forEach(t => {
    if (addedIds.has(t.id)) return;
    if (currentSecObj.match.some(m => (t.section || '').includes(m))) {
      result.push(t);
    }
  });

  return result;
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

    mState.habits.forEach((h, idx) => {
      if (typeof h.sortOrder !== 'number' || isNaN(h.sortOrder)) {
        h.sortOrder = idx + 1;
      }
      if (h.status !== 'in_progress') {
        const todayCount = (h.history && h.history[todayKey]) ? (h.history[todayKey].count || 0) : 0;
        const target = h.targetTimes || 1;
        h.status = (todayCount >= target) ? 'completed' : 'uncompleted';
      }
    });
    mState.habits.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

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
  if (!Array.isArray(mState.habits) || mState.habits.length === 0) {
    console.warn('Skipping cloud push: habits array is empty');
    return;
  }

  if (mState.isSyncing) {
    mState.hasPendingPush = true;
    return;
  }

  if (cloudDebounceTimeout) clearTimeout(cloudDebounceTimeout);
  cloudDebounceTimeout = setTimeout(() => {
    pushToCloud();
  }, 500);
}

async function pushToCloud() {
  const gasUrl = getGasUrl();
  if (!gasUrl) return;
  if (mState.isSyncing) {
    mState.hasPendingPush = true;
    return;
  }

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
    if (mState.hasPendingPush) {
      mState.hasPendingPush = false;
      setTimeout(() => {
        pushToCloud();
      }, 100);
    }
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
          mState.habits = cloud.habits
            .map((h, idx) => migrateMobileHabit(h, idx))
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
          localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(mState.habits));
        }

        updateMetadata({
          lastUpdatedAt: cloudMeta.lastUpdatedAt || new Date().toISOString(),
          lastUpdatedDevice: cloudMeta.lastUpdatedDevice || 'CLOUD',
          lastProcessedDate: cloudMeta.lastProcessedDate || localMeta.lastProcessedDate
        });

        // Recheck active task & habit
        const activeTask = mState.tasks.find(t => t.status === 'in_progress');
        mState.activeTaskId = activeTask ? activeTask.id : null;
        const activeHabit = mState.habits.find(h => h.status === 'in_progress');
        mState.activeHabitId = activeHabit ? activeHabit.id : null;

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
    if (mState.hasPendingPush) {
      mState.hasPendingPush = false;
      setTimeout(() => {
        pushToCloud();
      }, 100);
    }
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

  // 実行中ハビットがあれば自動中断（完全シングルタスク排他制御）
  if (Array.isArray(mState.habits)) {
    let habitPaused = false;
    mState.habits.forEach(h => {
      if (h.status === 'in_progress') {
        h.status = 'paused';
        if (h.startTimestamp) {
          const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - h.startTimestamp) / 1000));
          h.accumulatedSeconds = (h.accumulatedSeconds || (h.actMin ? h.actMin * 60 : 0)) + sessionElapsedSec;
          h.actMin = Math.round(h.accumulatedSeconds / 60);
        }
        h.startTimestamp = null;
        habitPaused = true;
      }
    });
    if (habitPaused && typeof saveLocalHabits === 'function') {
      saveLocalHabits();
    }
  }
  mState.activeHabitId = null;
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

function startHabit(habitId) {
  haptic(20);
  const targetHabit = mState.habits.find(h => String(h.id) === String(habitId));
  if (!targetHabit) return;

  const now = new Date();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 1. 他のハビットを自動中断（一時停止）
  mState.habits.forEach(h => {
    if (String(h.id) === String(habitId)) {
      h.status = 'in_progress';
      h.actStart = h.actStart || nowTimeStr;
      h.startTimestamp = Date.now();
      mState.activeHabitId = h.id;
    } else if (h.status === 'in_progress') {
      h.status = 'paused';
      if (h.startTimestamp) {
        const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - h.startTimestamp) / 1000));
        h.accumulatedSeconds = (h.accumulatedSeconds || (h.actMin ? h.actMin * 60 : 0)) + sessionElapsedSec;
        h.actMin = Math.round(h.accumulatedSeconds / 60);
      }
      h.startTimestamp = null;
    }
  });

  // 2. 実行中タスクがあれば自動中断（完全シングルタスク排他制御）
  if (Array.isArray(mState.tasks)) {
    let taskPaused = false;
    mState.tasks.forEach(t => {
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
    if (taskPaused && typeof saveLocalTasks === 'function') {
      saveLocalTasks();
    }
  }
  mState.activeTaskId = null;

  saveLocalHabits();
  renderMobileApp();
}

function pauseHabit(habitId) {
  haptic(15);
  const habit = mState.habits.find(h => String(h.id) === String(habitId));
  if (!habit || habit.status !== 'in_progress') return;

  habit.status = 'paused';
  if (habit.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - habit.startTimestamp) / 1000));
    habit.accumulatedSeconds = (habit.accumulatedSeconds || (habit.actMin ? habit.actMin * 60 : 0)) + sessionElapsedSec;
    habit.actMin = Math.round(habit.accumulatedSeconds / 60);
  }
  habit.startTimestamp = null;

  if (String(mState.activeHabitId) === String(habitId)) {
    mState.activeHabitId = null;
  }

  saveLocalHabits();
  renderMobileApp();
}

function completeHabit(habitId) {
  haptic([20, 50, 20]);
  const habit = mState.habits.find(h => String(h.id) === String(habitId));
  if (!habit) return;

  const backupHabit = JSON.parse(JSON.stringify(habit));

  const now = new Date();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  habit.actEnd = nowTimeStr;

  if (habit.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - habit.startTimestamp) / 1000));
    habit.accumulatedSeconds = (habit.accumulatedSeconds || (habit.actMin ? habit.actMin * 60 : 0)) + sessionElapsedSec;
  }

  const finalTotalSec = habit.accumulatedSeconds || (habit.actMin ? habit.actMin * 60 : (habit.targetMin || 5) * 60);
  const elapsedMin = Math.max(1, Math.round(finalTotalSec / 60));
  habit.actMin = elapsedMin;

  const dateKey = getTodayDateString(mState.selectedDateOffset);
  if (!habit.history) habit.history = {};

  const curEntry = habit.history[dateKey];
  const curCount = (curEntry && typeof curEntry.count === 'number') ? curEntry.count : (curEntry && curEntry.done ? (habit.targetTimes || 1) : 0);
  const targetTimes = habit.targetTimes || 1;
  const newCount = curCount + 1;
  const isGoalReached = (newCount >= targetTimes);

  habit.history[dateKey] = {
    done: isGoalReached,
    count: newCount,
    durationMin: elapsedMin,
    actStart: habit.actStart || null,
    actEnd: habit.actEnd || null,
    completedAt: now.toISOString()
  };

  // Add to executionLogs array (Timeline)
  if (!Array.isArray(habit.executionLogs)) habit.executionLogs = [];
  habit.executionLogs.unshift({
    id: 'hlog_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    dateKey: dateKey,
    completedAt: now.toISOString(),
    count: newCount,
    durationMin: elapsedMin,
    note: ''
  });

  habit.status = isGoalReached ? 'completed' : 'uncompleted';
  habit.startTimestamp = null;
  habit.accumulatedSeconds = 0;

  if (String(mState.activeHabitId) === String(habitId)) {
    mState.activeHabitId = null;
  }

  saveLocalHabits();
  renderMobileApp();

  const toastMsg = targetTimes > 1
    ? (isGoalReached ? `🌿 「${habit.name}」本日の目標達成 (${newCount}/${targetTimes}回)！🎉` : `🌿 「${habit.name}」(${newCount}/${targetTimes}回目) を記録しました`)
    : `🌿 「${habit.name}」を完了しました`;

  showMobileUndoToast(toastMsg, () => {
    Object.assign(habit, backupHabit);
    if (backupHabit.status === 'in_progress') mState.activeHabitId = habit.id;
    saveLocalHabits();
    renderMobileApp();
  });
}

function uncompleteHabit(habitId) {
  haptic(15);
  const habit = mState.habits.find(h => String(h.id) === String(habitId));
  if (!habit) return;

  const dateKey = getTodayDateString(mState.selectedDateOffset);
  if (habit.history && habit.history[dateKey]) {
    delete habit.history[dateKey];
  }
  habit.status = 'uncompleted';
  habit.actEnd = null;
  habit.startTimestamp = null;

  saveLocalHabits();
  renderMobileApp();
}

function toggleHabit(habitId) {
  const habit = mState.habits.find(h => String(h.id) === String(habitId));
  if (!habit) return;

  const dateKey = getTodayDateString(mState.selectedDateOffset);
  const isDone = habit.history && habit.history[dateKey] && habit.history[dateKey].done;
  if (isDone) {
    uncompleteHabit(habitId);
  } else {
    completeHabit(habitId);
  }
}

// =========================================================================
// 6. Rendering Engine
// =========================================================================

function renderMobileApp() {
  autoCarryoverPastSessionTasks();
  updateTheme();
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

    const isToday = mState.selectedDateOffset === 0;
  const isPast = mState.selectedDateOffset < 0;

  // Today's Uncompleted Tasks (on past dates, exclude recurring tasks to immediately verify remaining single tasks)
  const todayTasks = mState.tasks.filter(t => {
    if (t.isDisabled || t.bucket === 'someday' || t.bucket === 'vault' || t.status === 'completed' || t.status === 'skipped') return false;
    if (isPast && (t.type === 'recurring' || t.taskType === 'recurring' || t.recType)) return false;
    return (t.scheduledDate === targetDateKey || (!t.scheduledDate && isToday));
  });

  // Today's Uncompleted Habits (Only shown when viewing today)
  const todayHabits = isToday ? mState.habits.filter(h => {
    if (h.isDisabled) return false;
    const entry = (h.history && h.history[targetDateKey]) ? h.history[targetDateKey] : null;
    return !(entry && entry.done);
  }) : [];

  // Current Section Tasks & Habits
  const currentSecId = detectCurrentSectionId();
  const currentSecObj = SECTIONS.find(s => s.id === currentSecId) || SECTIONS[4];
  const sectionTasks = getMobileSectionTasks(todayTasks, currentSecObj);
  const sectionHabits = todayHabits.filter(h => currentSecObj.match.some(m => (h.section || '').includes(m)));

  // Update 2x2 Matrix Counts
  const sectionCountEl = document.getElementById('m-section-count');
  const dailyCountEl = document.getElementById('m-daily-count');
  const taskCountEl = document.getElementById('m-task-count');
  const habitCountEl = document.getElementById('m-habit-count');

  if (sectionCountEl) sectionCountEl.textContent = mState.activeType === 'habit' ? sectionHabits.length : sectionTasks.length;
  if (dailyCountEl) dailyCountEl.textContent = mState.activeType === 'habit' ? todayHabits.length : todayTasks.length;
  if (taskCountEl) taskCountEl.textContent = mState.activeScope === 'section' ? sectionTasks.length : todayTasks.length;
  if (habitCountEl) habitCountEl.textContent = mState.activeScope === 'section' ? sectionHabits.length : todayHabits.length;

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
  const activeHabit = mState.habits.find(h => String(h.id) === String(mState.activeHabitId) && h.status === 'in_progress');

  if (!activeTask && !activeHabit) {
    bar.classList.add('hidden');
    return;
  }

  bar.classList.remove('hidden');
  const titleEl = document.getElementById('active-bar-title');
  const pauseBtn = bar.querySelector('.btn-touch-pause');
  const completeBtn = bar.querySelector('.btn-touch-success');

    if (activeTask) {
    if (titleEl) titleEl.textContent = `🎯 ${activeTask.title}`;
    if (pauseBtn) pauseBtn.setAttribute('onclick', `pauseTask('${activeTask.id}')`);
    if (completeBtn) {
      completeBtn.textContent = '✔ 完了';
      completeBtn.setAttribute('onclick', `completeTask('${activeTask.id}')`);
    }
    updateActiveTimerDisplay(activeTask);
  } else if (activeHabit) {
    const targetDateKey = getTodayDateString(mState.selectedDateOffset);
    const entry = (activeHabit.history && activeHabit.history[targetDateKey]) ? activeHabit.history[targetDateKey] : null;
    const curCount = (entry && typeof entry.count === 'number') ? entry.count : 0;
    const targetTimes = activeHabit.targetTimes || 1;
    const isMulti = targetTimes > 1;

    if (titleEl) titleEl.textContent = isMulti ? `🌿 ${activeHabit.name} (${curCount + 1}/${targetTimes}回目)` : `🌿 ${activeHabit.name}`;
    if (pauseBtn) pauseBtn.setAttribute('onclick', `pauseHabit('${activeHabit.id}')`);
    if (completeBtn) {
      completeBtn.textContent = isMulti ? `✔ ${curCount + 1}/${targetTimes}回目完了` : '✔ 完了';
      completeBtn.setAttribute('onclick', `completeHabit('${activeHabit.id}')`);
    }
    updateActiveTimerDisplay(activeHabit);
  }
}

function updateActiveTimerDisplay(item) {
  const timerEl = document.getElementById('active-bar-timer');
  const badgeEl = document.getElementById(`timer-badge-${item.id}`);
  if (!item || !item.startTimestamp) return;

  const elapsedSec = (item.accumulatedSeconds || (item.actMin ? item.actMin * 60 : 0)) + Math.floor((Date.now() - item.startTimestamp) / 1000);
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

    const isToday = mState.selectedDateOffset === 0;
  const isPast = mState.selectedDateOffset < 0;

  // 1. Get Today's Uncompleted Tasks (on past dates, exclude recurring tasks)
  const todayTasks = mState.tasks.filter(t => {
    if (t.isDisabled) return false;
    if (t.bucket === 'someday' || t.bucket === 'vault') return false;
    if (t.status === 'completed' || t.status === 'skipped') return false;
    if (isPast && (t.type === 'recurring' || t.taskType === 'recurring' || t.recType)) return false;
    return (t.scheduledDate === targetDateKey) || (!t.scheduledDate && isToday);
  });

  // 2. Get Today's Uncompleted Habits (Only shown when viewing today)
  const todayHabits = isToday ? mState.habits.filter(h => {
    if (h.isDisabled) return false;
    const entry = (h.history && h.history[targetDateKey]) ? h.history[targetDateKey] : null;
    return !(entry && entry.done);
  }) : [];

  const scope = mState.activeScope || 'section';
  const type = mState.activeType || 'task';

  // =========================================================================
  // 4 Explicit Rendering Modes (Scope: Section/Daily × Type: Task/Habit)
  // =========================================================================

  if (scope === 'section' && type === 'task') {
    // 1. Section × Task: そのセクションの未完タスク（過去セクション未完了も自動合流）
    const secTasks = getMobileSectionTasks(todayTasks, currentSecObj);
    const headerHtml = `
      <div class="m-section-indicator">
        <span class="m-sec-left">⚡ <b>${currentSecObj.name}</b> の未完了タスク</span>
        <span class="m-sec-count-tag">${secTasks.length}件</span>
      </div>
    `;

    if (secTasks.length === 0) {
      container.innerHTML = `
        ${headerHtml}
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">✨</span>
          <b style="color: var(--text-muted); font-size: 14px;">現在セクション（${currentSecObj.name}）の未完了タスクはありません</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">このセクションのタスクは全完了です！</p>
        </div>
      `;
      return;
    }
    container.innerHTML = headerHtml + secTasks.map(t => renderSlimTaskCard(t)).join('');

  } else if (scope === 'section' && type === 'habit') {
    // 2. Section × Habit: そのセクションの未完ハビットだけ
    const secHabits = todayHabits
      .filter(h => currentSecObj.match.some(m => (h.section || '').includes(m)))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const headerHtml = `
      <div class="m-section-indicator habit-indicator">
        <span class="m-sec-left">🌿 <b>${currentSecObj.name}</b> の未完了ハビット</span>
        <span class="m-sec-count-tag">${secHabits.length}件</span>
      </div>
    `;

    if (secHabits.length === 0) {
      container.innerHTML = `
        ${headerHtml}
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">🌱</span>
          <b style="color: var(--text-muted); font-size: 14px;">現在セクション（${currentSecObj.name}）の習慣はありません</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">このセクションの習慣はすべて達成済みです！</p>
        </div>
      `;
      return;
    }
    container.innerHTML = headerHtml + secHabits.map(h => renderSlimHabitCard(h)).join('');

  } else if (scope === 'daily' && type === 'task') {
    // 3. Daily × Task: 今日一日の全未完タスク
    const sortedTasks = secSortedTasks(todayTasks);
    const headerHtml = `
      <div class="m-section-indicator task-indicator">
        <span class="m-sec-left">🎯 <b>本日の全未完了タスク</b> (全セクション)</span>
        <span class="m-sec-count-tag">${sortedTasks.length}件</span>
      </div>
    `;

    if (sortedTasks.length === 0) {
      container.innerHTML = `
        ${headerHtml}
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">🎉</span>
          <b style="color: var(--text-muted); font-size: 14px;">本日のタスクはすべて完了しました！</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">素晴らしい一日です⚡</p>
        </div>
      `;
      return;
    }
    container.innerHTML = headerHtml + sortedTasks.map(t => renderSlimTaskCard(t)).join('');

  } else if (scope === 'daily' && type === 'habit') {
    // 4. Daily × Habit: 今日一日の全未完ハビット
    const sortedHabits = secSortedHabits(todayHabits);
    const headerHtml = `
      <div class="m-section-indicator habit-indicator">
        <span class="m-sec-left">🌿 <b>本日の全未完了ハビット</b> (全セクション)</span>
        <span class="m-sec-count-tag">${sortedHabits.length}件</span>
      </div>
    `;

    if (sortedHabits.length === 0) {
      container.innerHTML = `
        ${headerHtml}
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">🌿</span>
          <b style="color: var(--text-muted); font-size: 14px;">未完了のハビットはありません</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">今日の習慣はすべて達成済みです！</p>
        </div>
      `;
      return;
    }
    container.innerHTML = headerHtml + sortedHabits.map(h => renderSlimHabitCard(h)).join('');
  }
}

function secSortedTasks(tasks) {
  return tasks.slice().sort((a, b) => getSectionOrder(a.section) - getSectionOrder(b.section));
}

function secSortedHabits(habits) {
  return habits.slice().sort((a, b) => {
    const secDiff = getSectionOrder(a.section) - getSectionOrder(b.section);
    if (secDiff !== 0) return secDiff;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
}

function renderSlimHabitCard(habit) {
  const isInProgress = habit.status === 'in_progress';
  const isPaused = habit.status === 'paused';
  const targetDateKey = getTodayDateString(mState.selectedDateOffset);
  const entry = (habit.history && habit.history[targetDateKey]) ? habit.history[targetDateKey] : null;
  const curCount = (entry && typeof entry.count === 'number') ? entry.count : (entry && entry.done ? (habit.targetTimes || 1) : 0);
  const targetTimes = habit.targetTimes || 1;
  const isMulti = targetTimes > 1;

  return `
    <div class="m-card-slim ${isInProgress ? 'in-progress' : ''} ${isPaused ? 'paused' : ''}" id="h-card-${habit.id}">
      <div class="m-card-left" onclick="${isInProgress ? `completeHabit('${habit.id}')` : `startHabit('${habit.id}')`}" style="cursor:pointer;">
        <span class="m-slim-icon">${isInProgress ? '⚡' : isPaused ? '⏸' : '🌿'}</span>
        <span class="m-slim-title">${habit.name}</span>
        ${isMulti ? `<span class="m-slim-count-badge ${curCount > 0 ? 'active' : ''}">${curCount}/${targetTimes}回</span>` : ''}
        ${isInProgress ? `<span class="m-slim-timer-badge" id="timer-badge-${habit.id}">00:00</span>` : ''}
      </div>
      <div class="m-card-actions-slim">
        ${isInProgress ? `
          <button class="btn-slim btn-slim-success" onclick="completeHabit('${habit.id}')">
            ✔ ${isMulti ? `${curCount + 1}回目完了` : '完了'}
          </button>
        ` : isPaused ? `
          <button class="btn-slim btn-slim-pause-resume" onclick="startHabit('${habit.id}')">
            ▶ 再開
          </button>
        ` : `
          <button class="btn-slim btn-slim-primary" onclick="startHabit('${habit.id}')">
            ▶ 開始
          </button>
        `}
      </div>
    </div>
  `;
}

function renderSlimTaskCard(task) {
  const isInProgress = task.status === 'in_progress';
  const isPaused = task.status === 'paused';
  const carryBadge = task._carriedOverFrom ? `<span style="font-size: 10px; color: var(--accent-cyan); background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); padding: 1px 5px; border-radius: 4px; margin-left: 6px; font-weight: normal;">↩ ${task._carriedOverFrom}</span>` : '';

  return `
    <div class="m-card-slim ${isInProgress ? 'in-progress' : ''} ${isPaused ? 'paused' : ''}" id="t-card-${task.id}">
      <div class="m-card-left" onclick="${isInProgress ? `completeTask('${task.id}')` : `startTask('${task.id}')`}" style="cursor:pointer;">
        <span class="m-slim-icon">${isInProgress ? '⚡' : isPaused ? '⏸' : '🎯'}</span>
        <span class="m-slim-title">${task.title}${carryBadge}</span>
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
  if (!h || !h.history) return 0;
  let streak = 0;
  const d = new Date();
  
  for (let i = 0; i < 365; i++) {
    const cur = new Date();
    cur.setDate(d.getDate() - i);
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    const entry = h.history[key];
    if (entry && (entry.done || entry.count > 0)) {
      streak++;
    } else if (i === 0) {
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
  haptic(15);
  const modal = document.getElementById('m-quick-add-modal');
  const titleInput = document.getElementById('m-quick-task-title');
  const secSelect = document.getElementById('m-quick-task-section');
  const modalTitle = document.querySelector('#m-quick-add-modal .sheet-title');
  const submitBtn = document.querySelector('#m-quick-add-modal button[type="submit"]');

  const isHabit = mState.activeType === 'habit';

  if (modalTitle) modalTitle.textContent = isHabit ? '🌿 クイック習慣追加' : '⚡ クイックタスク追加';
  if (submitBtn) submitBtn.textContent = isHabit ? '🌿 習慣を追加' : '⚡ 追加する';
  if (titleInput) {
    titleInput.placeholder = isHabit ? '習慣名を入力... (例: 水2L飲む、読書15分)' : 'タスク名を入力...';
  }

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
  const isHabit = mState.activeType === 'habit';

  if (isHabit) {
    const newHabit = {
      id: `m_habit_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      name: title,
      status: 'uncompleted',
      section: section,
      targetMin: estMin,
      timingType: 'section',
      recurrence: 'daily',
      frogLevel: 3,
      history: {},
      createdAt: new Date().toISOString()
    };
    mState.habits.push(newHabit);
    saveLocalHabits(true);
    closeQuickAddModal();
    renderMobileApp();

    showMobileUndoToast(`🌿 「${title}」を追加しました`, () => {
      mState.habits = mState.habits.filter(h => h.id !== newHabit.id);
      saveLocalHabits(true);
      renderMobileApp();
    });
  } else {
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
    saveLocalTasks(true);
    closeQuickAddModal();
    renderMobileApp();

    showMobileUndoToast(`⚡ 「${title}」を追加しました`, () => {
      mState.tasks = mState.tasks.filter(t => t.id !== newTask.id);
      saveLocalTasks(true);
      renderMobileApp();
    });
  }
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

window.addEventListener('DOMContentLoaded', async () => {
  loadLocalData();
  renderMobileApp(); // まずローカルキャッシュで瞬時にUI描画

  // Attach safe explicit listeners to the 2x2 switcher buttons
  const scopeBtns = [
    { id: 'btn-scope-section', fn: () => setScope('section') },
    { id: 'btn-scope-daily', fn: () => setScope('daily') }
  ];
  scopeBtns.forEach(b => {
    const el = document.getElementById(b.id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        b.fn();
      });
    }
  });

  const typeBtns = [
    { id: 'btn-type-task', fn: () => setType('task') },
    { id: 'btn-type-habit', fn: () => setType('habit') }
  ];
  typeBtns.forEach(b => {
    const el = document.getElementById(b.id);
    if (el) {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        b.fn();
      });
    }
  });

  // Startup Sync Guard:
  // 朝一でスマホを起動した際、古いローカルデータで日次ロールオーバーを上書きpushしないよう、
  // まずクラウドから最新データ（PCで並べ替えたハビットやタスク）を取得してから日次処理を実行
  if (getGasUrl()) {
    try {
      await pullFromCloud(false, true); // 最新クラウドデータを取得
    } catch (e) {
      console.warn('Initial cloud pull failed/skipped:', e);
    }
  }

  // 最新データ取得後に日次ロールオーバーを実行（古い並び順の上書き送信を完全防御）
  checkAndRunDayRollover();
  renderMobileApp();

  // Active Timer Loop (1 sec - Tasks & Habits)
  if (activeTimerInterval) clearInterval(activeTimerInterval);
  activeTimerInterval = setInterval(() => {
    const activeTask = mState.tasks.find(t => t.id === mState.activeTaskId && t.status === 'in_progress');
    const activeHabit = mState.habits.find(h => String(h.id) === String(mState.activeHabitId) && h.status === 'in_progress');
    if (activeTask) {
      updateActiveTimerDisplay(activeTask);
    } else if (activeHabit) {
      updateActiveTimerDisplay(activeHabit);
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
