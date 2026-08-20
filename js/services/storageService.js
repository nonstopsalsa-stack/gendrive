/**
 * Gendrive - Storage & Cloud Synchronization Service
 * 哲生 (AI Company OS & Personal OS Engine)
 * Local-First Architecture with Google Apps Script (GAS) Sync Engine
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

let cloudSyncTimeout = null;
let isSyncing = false;

// =========================================================================
// 0. Metadata & Settings Management
// =========================================================================

function getGasApiUrl() {
  return localStorage.getItem(STORAGE_KEYS.GAS_URL) || '';
}

function setGasApiUrl(url) {
  if (url) {
    localStorage.setItem(STORAGE_KEYS.GAS_URL, url.trim());
  } else {
    localStorage.removeItem(STORAGE_KEYS.GAS_URL);
  }
}

function getSyncMetadata() {
  const saved = localStorage.getItem(STORAGE_KEYS.METADATA);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse sync metadata:', e);
    }
  }
  return {
    lastUpdatedAt: new Date(0).toISOString(),
    lastUpdatedDevice: 'PC',
    lastProcessedDate: '',
    version: '1.0'
  };
}

function updateSyncMetadata(fields = {}) {
  const meta = getSyncMetadata();
  const updated = {
    ...meta,
    ...fields,
    lastUpdatedAt: fields.lastUpdatedAt || new Date().toISOString(),
    lastUpdatedDevice: fields.lastUpdatedDevice || 'PC'
  };
  localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(updated));
  return updated;
}

// =========================================================================
// 1. Task Persistence
// =========================================================================

function loadTasks() {
  let list = DEFAULT_TASKS;
  const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = parsed;
      }
    } catch (e) {
      console.error('Failed to parse saved tasks:', e);
    }
  }

  // Sanitize task IDs to prevent collision
  const seenIds = new Set();
  list.forEach((t, idx) => {
    if (!t.id || seenIds.has(t.id)) {
      t.id = `T_${Date.now()}_${idx}`;
    }
    seenIds.add(t.id);
  });

  return list;
}

function saveTasks(skipCloudSync = false) {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
  if (typeof updateSidebarBadges === 'function') {
    updateSidebarBadges();
  }
  updateSyncStatus('local');
  if (!skipCloudSync) {
    triggerCloudSync();
  }
}

// =========================================================================
// 2. Goal Persistence
// =========================================================================

function loadGoals() {
  const saved = localStorage.getItem(STORAGE_KEYS.GOALS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      return {
        weekly: {
          ...DEFAULT_GOALS.weekly,
          ...(parsed.weekly || {}),
          obsidianUri: parsed.weekly?.obsidianUri || DEFAULT_GOALS.weekly.obsidianUri
        },
        monthly: {
          ...DEFAULT_GOALS.monthly,
          ...(parsed.monthly || {}),
          obsidianUri: parsed.monthly?.obsidianUri || DEFAULT_GOALS.monthly.obsidianUri
        },
        half: {
          ...DEFAULT_GOALS.half,
          ...(parsed.half || {}),
          obsidianUri: parsed.half?.obsidianUri || DEFAULT_GOALS.half.obsidianUri
        },
        phase: {
          ...DEFAULT_GOALS.phase,
          ...(parsed.phase || {}),
          obsidianUri: parsed.phase?.obsidianUri || DEFAULT_GOALS.phase.obsidianUri
        }
      };
    } catch (e) {
      console.error('Failed to parse saved goals:', e);
    }
  }
  return DEFAULT_GOALS;
}

function saveGoals(skipCloudSync = false) {
  localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(state.goals));
  if (!skipCloudSync) {
    triggerCloudSync();
  }
}

// =========================================================================
// 3. Task Presets Persistence
// =========================================================================

function loadTaskPresets() {
  const saved = localStorage.getItem(STORAGE_KEYS.PRESETS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {
      console.error('Failed to parse task presets:', e);
    }
  }
  return DEFAULT_TASK_PRESETS;
}

function saveTaskPresets(skipCloudSync = false) {
  localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(state.taskPresets));
  if (!skipCloudSync) {
    triggerCloudSync();
  }
}

// =========================================================================
// 4. Core Manifesto Persistence
// =========================================================================

function loadManifesto() {
  const saved = localStorage.getItem(STORAGE_KEYS.MANIFESTO);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.body) {
        return {
          ...DEFAULT_MANIFESTO,
          ...parsed
        };
      }
    } catch (e) {
      console.error('Failed to parse saved manifesto:', e);
    }
  }
  return DEFAULT_MANIFESTO;
}

function saveManifesto(skipCloudSync = false) {
  localStorage.setItem(STORAGE_KEYS.MANIFESTO, JSON.stringify(state.manifesto));
  if (!skipCloudSync) {
    triggerCloudSync();
  }
}

// =========================================================================
// 5. Habits Persistence & Migration
// =========================================================================

function migrateHabit(h) {
  if (!h.createdAt || h.createdAt.startsWith('2026-05') || h.createdAt.startsWith('2026-06') || h.createdAt.startsWith('2026-07')) {
    h.createdAt = '2026-08-18T00:00:00.000Z';
  }
  if (!h.stats) h.stats = {};

  if (h.section === '早朝') h.section = '第1セッション';
  else if (h.section === '午前') h.section = '第2セッション';
  else if (h.section === '午後') h.section = '第3セッション';
  else if (h.section === '夜') h.section = '第4セッション';

  if (!h.recurrence || typeof h.recurrence !== 'object') {
    h.recurrence = { type: 'everyday' };
  }

  if (!h.history || typeof h.history !== 'object') {
    h.history = {};
  }

  const todayKey = getTodayKey();
  const curTodayCount = getHabitDayCount(h, todayKey);
  const targetTimes = getHabitTargetTimes(h);
  if (curTodayCount >= targetTimes && targetTimes > 0) {
    h.status = 'completed';
  } else if (h.status !== 'in_progress') {
    h.status = 'uncompleted';
  }

  recalculateHabitRates(h);
  return h;
}

function loadHabits() {
  const saved = localStorage.getItem(STORAGE_KEYS.HABITS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(migrateHabit);
      }
    } catch (e) {
      console.error(e);
    }
  }
  return DEFAULT_HABITS.map(migrateHabit);
}

function saveHabits(skipCloudSync = false) {
  localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(state.habits));
  updateSyncStatus('local');
  if (!skipCloudSync) {
    triggerCloudSync();
  }
}

// =========================================================================
// 6. Cloud Sync Engine (Google Apps Script / Spreadsheet API)
// =========================================================================

function triggerCloudSync() {
  const gasUrl = getGasApiUrl();
  if (!gasUrl) return;

  if (cloudSyncTimeout) {
    clearTimeout(cloudSyncTimeout);
  }

  cloudSyncTimeout = setTimeout(() => {
    pushDataToCloud();
  }, 1000);
}

async function pushDataToCloud() {
  const gasUrl = getGasApiUrl();
  if (!gasUrl || isSyncing) return;

  isSyncing = true;
  updateSyncStatus('syncing');

  try {
    const meta = updateSyncMetadata({ lastUpdatedDevice: 'PC' });
    const payload = {
      tasks: state.tasks,
      habits: state.habits,
      goals: state.goals,
      manifesto: state.manifesto,
      taskPresets: state.taskPresets,
      metadata: meta
    };

    const response = await fetch(gasUrl, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    const resJson = await response.json();
    if (resJson.status === 'success') {
      updateSyncStatus('cloud_success');
    } else {
      console.warn('Cloud sync returned error:', resJson);
      updateSyncStatus('cloud_error');
    }
  } catch (err) {
    console.error('Cloud sync push failed (offline or network error):', err);
    updateSyncStatus('offline');
  } finally {
    isSyncing = false;
  }
}

async function pullDataFromCloud(forceApply = false) {
  const gasUrl = getGasApiUrl();
  if (!gasUrl || isSyncing) return;

  isSyncing = true;
  updateSyncStatus('syncing');

  try {
    const response = await fetch(`${gasUrl}?t=${Date.now()}`, {
      method: 'GET',
      mode: 'cors'
    });

    const resJson = await response.json();
    if (resJson.status === 'success' && resJson.data) {
      const cloudData = resJson.data;
      const cloudMeta = cloudData.metadata || {};
      const localMeta = getSyncMetadata();

      const cloudTime = new Date(cloudMeta.lastUpdatedAt || 0).getTime();
      const localTime = new Date(localMeta.lastUpdatedAt || 0).getTime();

      // If cloud is newer or forceApply requested, update local state
      if (forceApply || cloudTime > localTime) {
        if (Array.isArray(cloudData.tasks)) {
          state.tasks = cloudData.tasks;
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
        }
        if (Array.isArray(cloudData.habits)) {
          state.habits = cloudData.habits.map(migrateHabit);
          localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(state.habits));
        }
        if (cloudData.goals) {
          state.goals = cloudData.goals;
          localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(state.goals));
        }
        if (cloudData.manifesto) {
          state.manifesto = cloudData.manifesto;
          localStorage.setItem(STORAGE_KEYS.MANIFESTO, JSON.stringify(state.manifesto));
        }
        if (Array.isArray(cloudData.taskPresets)) {
          state.taskPresets = cloudData.taskPresets;
          localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(state.taskPresets));
        }

        updateSyncMetadata({
          lastUpdatedAt: cloudMeta.lastUpdatedAt || new Date().toISOString(),
          lastUpdatedDevice: cloudMeta.lastUpdatedDevice || 'CLOUD',
          lastProcessedDate: cloudMeta.lastProcessedDate || localMeta.lastProcessedDate
        });

        if (typeof renderApp === 'function') {
          renderApp();
        }
        updateSyncStatus('cloud_success', '☁️ クラウド最新同期完了');
      } else if (localTime > cloudTime) {
        // Local is newer, push to cloud
        pushDataToCloud();
      } else {
        updateSyncStatus('cloud_success');
      }
    }
  } catch (err) {
    console.error('Cloud pull failed (offline or network error):', err);
    updateSyncStatus('offline');
  } finally {
    isSyncing = false;
  }
}

function updateSyncStatus(type = 'local', customText = null) {
  const el = document.getElementById('sync-status');
  if (!el) return;

  const timeStr = new Date().toLocaleTimeString();
  const gasConfigured = !!getGasApiUrl();

  if (type === 'syncing') {
    el.textContent = '🔄 クラウド同期中...';
    el.style.color = '#38bdf8';
  } else if (type === 'cloud_success') {
    el.textContent = customText || `🟢 クラウド同期済 (${timeStr})`;
    el.style.color = '#4ade80';
  } else if (type === 'offline') {
    el.textContent = `🟡 ローカル保存済 (オフライン ${timeStr})`;
    el.style.color = '#facc15';
  } else if (type === 'cloud_error') {
    el.textContent = `⚠️ 同期エラー (${timeStr})`;
    el.style.color = '#f87171';
  } else {
    if (gasConfigured) {
      el.textContent = `🟢 保存完了 (${timeStr})`;
      el.style.color = '#4ade80';
    } else {
      el.textContent = `💾 ローカル保存 (${timeStr})`;
      el.style.color = '#94a3b8';
    }
  }
}

// Instant Data Reload & Re-synchronization Engine (R Key / Quick Reload Button)
function reloadAppData() {
  const gasUrl = getGasApiUrl();
  if (gasUrl) {
    pullDataFromCloud(true);
  } else {
    state.habits = loadHabits();
    state.tasks = loadTasks();
    state.goals = loadGoals();
    state.manifesto = loadManifesto();
    state.taskPresets = loadTaskPresets();
    state.habits.forEach(recalculateHabitRates);
    renderApp();
    updateSyncStatus('local', '🔄 ローカル再読み込み完了');
  }
}

// Setup Auto-Sync Listeners
window.addEventListener('DOMContentLoaded', () => {
  const gasUrl = getGasApiUrl();
  if (gasUrl) {
    pullDataFromCloud(false);
  }
});

// Sync when switching back to this tab
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && getGasApiUrl()) {
    pullDataFromCloud(false);
  }
});

// Periodic background sync check (every 2 minutes)
setInterval(() => {
  if (getGasApiUrl() && !isSyncing) {
    pullDataFromCloud(false);
  }
}, 120000);
