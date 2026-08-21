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
  DRIVE_FOLDER_ID: 'gendrive_drive_folder_id',
  METADATA: 'gendrive_sync_metadata_v1',
  SNAPSHOTS: 'gendrive_snapshots_v1'
};

let cloudSyncTimeout = null;
let isSyncing = false;

// =========================================================================
// 0. Multi-Generation Local Auto-Backup Engine (10-Snapshot Rollback System)
// =========================================================================

let vaultFileHandle = null;

// IndexedDB Helper for Storing File Handle
const IDB_CONFIG = { dbName: 'gendrive_idb', storeName: 'handles', key: 'vault_backup_file' };

function openIdb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_CONFIG.dbName, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_CONFIG.storeName);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveFileHandleToIdb(handle) {
  try {
    const db = await openIdb();
    const tx = db.transaction(IDB_CONFIG.storeName, 'readwrite');
    tx.objectStore(IDB_CONFIG.storeName).put(handle, IDB_CONFIG.key);
  } catch (e) {
    console.error('Failed to save file handle to IDB:', e);
  }
}

async function loadFileHandleFromIdb() {
  try {
    const db = await openIdb();
    return new Promise((resolve) => {
      const tx = db.transaction(IDB_CONFIG.storeName, 'readonly');
      const req = tx.objectStore(IDB_CONFIG.storeName).get(IDB_CONFIG.key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

async function setupVaultAutoSyncFile() {
  try {
    if (!('showSaveFilePicker' in window)) {
      alert('⚠️ お使いのブラウザはローカルファイル自動書き込みAPIに対応していません。');
      return;
    }

    const handle = await window.showSaveFilePicker({
      suggestedName: 'gendrive_backup.json',
      types: [{
        description: 'JSON Backup File',
        accept: { 'application/json': ['.json'] }
      }]
    });

    if (handle) {
      vaultFileHandle = handle;
      await saveFileHandleToIdb(handle);
      await writeToVaultBackupFile();
      updateVaultSyncUI(true, handle.name);
      alert(`✅ Vault自動バックアップ先を設定しました！\nファイル: ${handle.name}\n今後はタスク操作や日跨ぎのたびに完全自動で上書き保存されます。`);
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      alert('設定中にエラーが発生しました: ' + err.message);
    }
  }
}

async function writeToVaultBackupFile() {
  if (!vaultFileHandle) {
    vaultFileHandle = await loadFileHandleFromIdb();
  }
  if (!vaultFileHandle) return;

  try {
    const backupData = {
      exportDate: new Date().toISOString(),
      displayDate: new Date().toLocaleString(),
      version: '1.0',
      tasks: state.tasks || [],
      habits: state.habits || [],
      goals: state.goals || {},
      manifesto: state.manifesto || {},
      taskPresets: state.taskPresets || []
    };

    const writable = await vaultFileHandle.createWritable();
    await writable.write(JSON.stringify(backupData, null, 2));
    await writable.close();
    updateVaultSyncUI(true, vaultFileHandle.name);
  } catch (e) {
    console.warn('Vault auto-sync write failed (permissions may need re-granting on click):', e);
  }
}

function updateVaultSyncUI(isActive, filename = 'gendrive_backup.json') {
  const statusEl = document.getElementById('vault-sync-status-badge');
  if (statusEl) {
    if (isActive) {
      statusEl.innerHTML = `🟢 自動同期中 (${filename})`;
      statusEl.style.color = 'var(--accent-emerald)';
    } else {
      statusEl.innerHTML = `⚪ 未設定 (クリックして設定)`;
      statusEl.style.color = 'var(--text-muted)';
    }
  }
}

function createAutoBackupSnapshot() {
  try {
    const rawSnapshots = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
    let snapshots = rawSnapshots ? JSON.parse(rawSnapshots) : [];

    const newSnapshot = {
      timestamp: new Date().toISOString(),
      displayTime: new Date().toLocaleString(),
      taskCount: (state.tasks || []).length,
      habitCount: (state.habits || []).length,
      data: {
        tasks: state.tasks || [],
        habits: state.habits || [],
        goals: state.goals || {},
        manifesto: state.manifesto || {},
        taskPresets: state.taskPresets || []
      }
    };

    // Keep last 10 snapshots max
    snapshots.unshift(newSnapshot);
    if (snapshots.length > 10) snapshots = snapshots.slice(0, 10);

    localStorage.setItem(STORAGE_KEYS.SNAPSHOTS, JSON.stringify(snapshots));

    // Also trigger Vault physical file auto-write in background
    writeToVaultBackupFile();
  } catch (e) {
    console.error('Failed to create auto backup snapshot:', e);
  }
}

function restoreFromSnapshot(snapshotIndex = 0) {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SNAPSHOTS);
    if (!raw) {
      alert('⚠️ バックアップ履歴が見つかりません。');
      return;
    }
    const snapshots = JSON.parse(raw);
    if (!snapshots[snapshotIndex]) {
      alert('⚠️ 指定されたバックアップが存在しません。');
      return;
    }

    const snap = snapshots[snapshotIndex];
    if (confirm(`【安全復元】${snap.displayTime} の自動バックアップ（タスク ${snap.taskCount}件 / ハビット ${snap.habitCount}件）へ復元しますか？`)) {
      state.tasks = snap.data.tasks || [];
      state.habits = (snap.data.habits || []).map(migrateHabit);
      state.goals = snap.data.goals || {};
      state.manifesto = snap.data.manifesto || {};
      state.taskPresets = snap.data.taskPresets || [];

      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
      localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(state.habits));
      localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(state.goals));
      localStorage.setItem(STORAGE_KEYS.MANIFESTO, JSON.stringify(state.manifesto));
      localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(state.taskPresets));

      if (typeof renderApp === 'function') renderApp();
      if (getGasApiUrl()) pushDataToCloud();

      alert(`✅ ${snap.displayTime} の状態に完全復元しました！`);
    }
  } catch (e) {
    alert('復元中にエラーが発生しました: ' + e.message);
  }
}

function exportFullBackupJSON() {
  const backupData = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    tasks: state.tasks,
    habits: state.habits,
    goals: state.goals,
    manifesto: state.manifesto,
    taskPresets: state.taskPresets
  };

  const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  a.href = url;
  a.download = `Gendrive_Backup_${dateStr}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importFullBackupJSON(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data.tasks) && !Array.isArray(data.habits)) {
        throw new Error('有効なGendriveバックアップファイルではありません。');
      }

      if (confirm(`【バックアップ復元】ファイルから全データ（タスク ${(data.tasks||[]).length}件 / ハビット ${(data.habits||[]).length}件）を読み込みますか？`)) {
        createAutoBackupSnapshot(); // Save current before overwriting

        if (Array.isArray(data.tasks)) {
          state.tasks = data.tasks;
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
        }
        if (Array.isArray(data.habits)) {
          state.habits = data.habits.map(migrateHabit);
          localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(state.habits));
        }
        if (data.goals) {
          state.goals = data.goals;
          localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(state.goals));
        }
        if (data.manifesto) {
          state.manifesto = data.manifesto;
          localStorage.setItem(STORAGE_KEYS.MANIFESTO, JSON.stringify(state.manifesto));
        }
        if (Array.isArray(data.taskPresets)) {
          state.taskPresets = data.taskPresets;
          localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(state.taskPresets));
        }

        if (typeof renderApp === 'function') renderApp();
        if (getGasApiUrl()) pushDataToCloud();

        alert('✅ バックアップファイルからの復元が完了しました！');
      }
    } catch (err) {
      alert('ファイルの読み込みに失敗しました: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// =========================================================================
// 0-B. Metadata & Settings Management
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

  // Sanitize task IDs to prevent collision and ensure isDisabled is boolean
  const seenIds = new Set();
  list.forEach((t, idx) => {
    if (!t.id || seenIds.has(t.id)) {
      t.id = `T_${Date.now()}_${idx}`;
    }
    seenIds.add(t.id);
    t.isDisabled = !!t.isDisabled;
  });

  return list;
}

function saveTasks(skipCloudSync = false) {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
  createAutoBackupSnapshot();
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
  createAutoBackupSnapshot();
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
  createAutoBackupSnapshot();
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
  createAutoBackupSnapshot();
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
  h.isDisabled = !!h.isDisabled;
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
  createAutoBackupSnapshot();
  updateSyncStatus('local');
  if (!skipCloudSync) {
    triggerCloudSync();
  }
}

// =========================================================================
// 6. Zero-Click Realtime Cloud Sync Engine (Instant Push & 15s Heartbeat)
// =========================================================================

let heartbeatInterval = null;

function triggerCloudSync() {
  const gasUrl = getGasApiUrl();
  if (!gasUrl) return;

  if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
  cloudSyncTimeout = setTimeout(() => {
    pushDataToCloud();
  }, 300); // 300ms instant push
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
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    let isSuccess = false;
    try {
      const resJson = await response.json();
      if (resJson && resJson.status === 'success') {
        isSuccess = true;
      }
    } catch (e) {
      if (response.ok || response.status === 200 || response.type === 'opaque') {
        isSuccess = true;
      }
    }

    if (isSuccess) {
      updateSyncStatus('cloud_success');
    } else {
      updateSyncStatus('cloud_error');
    }
  } catch (err) {
    console.error('Cloud sync push failed:', err);
    updateSyncStatus('offline');
  } finally {
    isSyncing = false;
  }
}

async function pullDataFromCloud(forceApply = false, isSilent = false) {
  const gasUrl = getGasApiUrl();
  if (!gasUrl || isSyncing) return;

  if (!isSilent) {
    isSyncing = true;
    updateSyncStatus('syncing');
  }

  try {
    const response = await fetch(`${gasUrl}?t=${Date.now()}`);
    const resJson = await response.json();

    if (resJson.status === 'success' && resJson.data) {
      const cloudData = resJson.data;
      const cloudMeta = cloudData.metadata || {};
      const localMeta = getSyncMetadata();

      const cloudTime = new Date(cloudMeta.lastUpdatedAt || 0).getTime();
      const localTime = new Date(localMeta.lastUpdatedAt || 0).getTime();

      // If cloud is newer or forceApply requested, update local state
      if (forceApply || cloudTime > localTime) {
        if (Array.isArray(cloudData.tasks) && cloudData.tasks.length > 0) {
          state.tasks = cloudData.tasks;
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
        }
        if (Array.isArray(cloudData.habits) && cloudData.habits.length > 0) {
          state.habits = cloudData.habits.map(migrateHabit);
          localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(state.habits));
        }
        if (cloudData.goals && Object.keys(cloudData.goals).length > 0) {
          state.goals = cloudData.goals;
          localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(state.goals));
        }
        if (cloudData.manifesto && cloudData.manifesto.body) {
          state.manifesto = cloudData.manifesto;
          localStorage.setItem(STORAGE_KEYS.MANIFESTO, JSON.stringify(state.manifesto));
        }
        if (Array.isArray(cloudData.taskPresets) && cloudData.taskPresets.length > 0) {
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
    if (!isSilent) console.error('Cloud pull failed (offline or network error):', err);
    updateSyncStatus('offline');
  } finally {
    isSyncing = false;
  }
}

// 15-Second Silent Heartbeat Sync & Focus Resume Loop
function initRealtimeSyncHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (getGasApiUrl() && !isSyncing) {
      pullDataFromCloud(false, true); // Silent background sync
    }
  }, 15000); // Poll every 15s

  window.addEventListener('focus', () => {
    if (getGasApiUrl() && !isSyncing) {
      pullDataFromCloud(false, true);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && getGasApiUrl() && !isSyncing) {
      pullDataFromCloud(false, true);
    }
  });
}

if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    initRealtimeSyncHeartbeat();
  });
}

/**
 * 哲生さんの全マスターデータ（ハビット・タスク・目標）を一発で完全復元する関数
 */
function restoreDefaultMasterData() {
  localStorage.removeItem(STORAGE_KEYS.TASKS);
  localStorage.removeItem(STORAGE_KEYS.HABITS);
  localStorage.removeItem(STORAGE_KEYS.GOALS);
  localStorage.removeItem(STORAGE_KEYS.MANIFESTO);
  localStorage.removeItem(STORAGE_KEYS.PRESETS);

  state.habits = loadHabits();
  state.tasks = loadTasks();
  state.goals = loadGoals();
  state.manifesto = loadManifesto();
  state.taskPresets = loadTaskPresets();

  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
  localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(state.habits));
  localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(state.goals));
  localStorage.setItem(STORAGE_KEYS.MANIFESTO, JSON.stringify(state.manifesto));
  localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(state.taskPresets));

  updateSyncMetadata({ lastUpdatedDevice: 'PC', lastUpdatedAt: new Date().toISOString() });

  if (typeof renderApp === 'function') {
    renderApp();
  }

  // クラウドにも即時プッシュ
  if (getGasApiUrl()) {
    pushDataToCloud();
  }

  alert('⚡ 哲生さんのマスターデータ（全ハビット・タスク・目標）を完全に復元しました！');
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

// =========================================================================
// 7. Google Drive Time-Machine Backup & Rollback Engine (5-Sheet Full Export)
// =========================================================================

function getDriveFolderId() {
  return localStorage.getItem(STORAGE_KEYS.DRIVE_FOLDER_ID) || '';
}

function setDriveFolderId(id) {
  if (id) {
    localStorage.setItem(STORAGE_KEYS.DRIVE_FOLDER_ID, id.trim());
  } else {
    localStorage.removeItem(STORAGE_KEYS.DRIVE_FOLDER_ID);
  }
}

/**
 * Google Driveの指定フォルダへタイムスタンプ付き5シートスプレッドシートを新規エクスポート
 */
async function exportToDriveFolder(isAutoBackup = false) {
  const gasUrl = getGasApiUrl();
  const folderId = getDriveFolderId();

  if (!gasUrl) {
    throw new Error('GASのウェブアプリURLが未設定です。「クラウド同期設定」でURLを入力してください。');
  }
  if (!folderId) {
    throw new Error('Google Driveのバックアップ先フォルダIDが未設定です。');
  }

  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  const prefix = isAutoBackup ? 'AUTO_BACKUP_' : 'HABIT_EXPORT_';
  const fileName = `${prefix}${dateStr}`;

  const payload = {
    action: 'export_to_folder',
    folderId: folderId,
    fileName: fileName,
    data: {
      habits: state.habits || [],
      tasks: state.tasks || [],
      goals: state.goals || {},
      manifesto: state.manifesto || {},
      taskPresets: state.taskPresets || []
    }
  };

  const response = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  });

  const resJson = await response.json();
  if (resJson.status !== 'success') {
    throw new Error(resJson.message || 'エクスポートに失敗しました');
  }

  return resJson;
}

/**
 * Google Driveフォルダ内のバックアップスプレッドシート一覧を取得
 */
async function fetchDriveBackupsList() {
  const gasUrl = getGasApiUrl();
  const folderId = getDriveFolderId();

  if (!gasUrl || !folderId) return [];

  const response = await fetch(`${gasUrl}?action=list_backups&folderId=${folderId}&t=${Date.now()}`);
  const resJson = await response.json();

  if (resJson.status === 'success' && Array.isArray(resJson.backups)) {
    return resJson.backups;
  }
  return [];
}

/**
 * Google Driveの指定スプレッドシートから5シート全データを完全復元（インポート前に自動退避）
 */
async function importFromDriveBackup(fileId, fileName = '選択したバックアップ') {
  const gasUrl = getGasApiUrl();
  if (!gasUrl) throw new Error('GASのURLが設定されていません');

  // 1. 安全のための直前自動退避（DriveへのAUTO_BACKUP保存 & ローカルスナップショット）
  createAutoBackupSnapshot();
  try {
    if (getDriveFolderId()) {
      await exportToDriveFolder(true); // 自動バックアップ
    }
  } catch (backupErr) {
    console.warn('インポート直前Drive自動退避に失敗しましたが、ローカルスナップショットは保存されました:', backupErr);
  }

  // 2. 指定スプレッドシートからデータを取得
  const response = await fetch(`${gasUrl}?action=import_sheet&fileId=${fileId}&t=${Date.now()}`);
  const resJson = await response.json();

  if (resJson.status !== 'success' || !resJson.data) {
    throw new Error(resJson.message || 'データの読み込みに失敗しました');
  }

  const restored = resJson.data;

  // 3. データリプレース & サニタイズ
  if (Array.isArray(restored.tasks)) {
    const seenIds = new Set();
    restored.tasks.forEach((t, idx) => {
      if (!t.id || seenIds.has(t.id)) {
        t.id = `T_${Date.now()}_${idx}`;
      }
      seenIds.add(t.id);
      t.isDisabled = !!t.isDisabled;
    });
    state.tasks = restored.tasks;
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
  }

  if (Array.isArray(restored.habits)) {
    state.habits = restored.habits.map(migrateHabit);
    localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(state.habits));
  }

  updateSyncMetadata({
    lastUpdatedDevice: 'PC_DRIVE_ROLLBACK',
    lastUpdatedAt: new Date().toISOString()
  });

  // 4. 再描画 & 通常同期
  if (typeof renderApp === 'function') {
    renderApp();
  }
  if (getGasApiUrl()) {
    pushDataToCloud();
  }

  return {
    tasksCount: (state.tasks || []).length,
    habitsCount: (state.habits || []).length
  };
}

