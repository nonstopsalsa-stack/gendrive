/**
 * Gendrive - Storage & Cloud Synchronization Service
 * 哲生 (AI Company OS & Personal OS Engine)
 * Local-First Architecture with Google Apps Script (GAS) Sync Engine
 */

var STORAGE_KEYS = Object.assign(window.STORAGE_KEYS || {}, {
  TASKS: 'habit_flow_tasks_v3',
  HABITS: 'habit_flow_data_v3',
  GOALS: 'habit_flow_goals_v1',
  MANIFESTO: 'habit_flow_manifesto_v1',
  PRESETS: 'habit_flow_task_presets_v1',
  CUSTOM_TAGS: 'gendrive_custom_tags_v1',
  GAS_URL: 'gendrive_gas_api_url',
  DRIVE_FOLDER_ID: 'gendrive_drive_folder_id',
  METADATA: 'gendrive_sync_metadata_v1',
  SNAPSHOTS: 'gendrive_snapshots_v1',
  DAILY_HABIT_ORDER: 'gendrive_daily_habit_order_v1',
  DELETED_TASKS: 'gendrive_deleted_task_ids_v1',
  DELETED_HABITS: 'gendrive_deleted_habit_ids_v1'
});

let cloudSyncTimeout = null;
let isSyncing = false;
let hasPendingPush = false;
let isLocalDirty = false; // 逆流防止弁フラグ (ローカル未送信変更あり)
let lastAutoBackupTime = 0;
let lastKnownTasksStateMap = new Map();
let lastKnownHabitsStateMap = new Map();

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
  const now = Date.now();
  if (now - lastAutoBackupTime < 1500) {
    return; // スロットリング: 短時間連続操作中の多重バックアップ作成を防止
  }
  lastAutoBackupTime = now;
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
      state.habits = (snap.data.habits || [])
        .map((h, idx) => migrateHabit(h, idx))
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      state.goals = snap.data.goals || {};
      state.manifesto = snap.data.manifesto || {};
      // スナップ復元時も実用プリセットおよび既存プリセットを安全マージ
      state.taskPresets = mergeTaskPresetsDeep(
        state.taskPresets,
        Array.isArray(snap.data.taskPresets) ? snap.data.taskPresets : []
      );

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
          state.habits = data.habits
            .map((h, idx) => migrateHabit(h, idx))
            .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
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
          state.taskPresets = mergeTaskPresetsDeep(state.taskPresets, data.taskPresets);
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

var DEFAULT_GAS_URL = window.DEFAULT_GAS_URL || 'https://script.google.com/macros/s/AKfycbyeT-kJdPj0bhtdZEOxWeWZAS250NeJd1NQAO4iUPytAJxh_r4iqm2jnmapODlc9eDbRA/exec';

function getGasApiUrl() {
  return localStorage.getItem(STORAGE_KEYS.GAS_URL) || DEFAULT_GAS_URL;
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
// 1. Task Persistence & Deep-Merge Protection
// =========================================================================

/**
 * Task ID High-Water Mark Synchronizer
 * 既存タスク群の最大ID番号を検出し、localStorageのハイウォーターマークを安全に底上げ同期
 */
function syncTaskIdHighWaterMark(tasks) {
  if (!Array.isArray(tasks)) return;
  let maxIdNum = 0;
  tasks.forEach(t => {
    if (t && t.id) {
      const match = String(t.id).match(/^T(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxIdNum) maxIdNum = num;
      }
    }
  });
  const savedHWM = parseInt(localStorage.getItem('gendrive_task_max_id_v1') || '0', 10);
  const currentHWM = isNaN(savedHWM) ? 0 : savedHWM;
  if (maxIdNum > currentHWM) {
    localStorage.setItem('gendrive_task_max_id_v1', String(maxIdNum));
  }
}

function sanitizeTasksDates(tasks) {
  if (!Array.isArray(tasks)) return tasks;
  const normalizeFn = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey : (val => val);
  tasks.forEach(t => {
    if (!t) return;
    if (t.scheduledDate) {
      const norm = normalizeFn(t.scheduledDate);
      if (norm) t.scheduledDate = norm;
    } else if (t.status === 'completed' && t.type !== 'recurring' && t.taskType !== 'recurring' && !t.isRecurringInstance) {
      // 完了済み単発タスクでscheduledDateが未設定の場合、実行ログまたは完了履歴から完了日を自動補完して整合性を保持
      let compDate = null;
      if (Array.isArray(t.executionLogs) && t.executionLogs.length > 0 && t.executionLogs[0].dateKey) {
        compDate = t.executionLogs[0].dateKey;
      } else if (Array.isArray(t.history) && t.history.length > 0) {
        const lastH = t.history[t.history.length - 1];
        compDate = (typeof lastH === 'object' && lastH !== null) ? lastH.date : (typeof lastH === 'string' ? lastH : null);
      } else if (t.createdAt) {
        compDate = normalizeFn(t.createdAt);
      }
      if (compDate) {
        const norm = normalizeFn(compDate);
        if (norm) t.scheduledDate = norm;
      }
    }
  });

  // 翌朝ゴースト実行中・中断中サニタイズ & 定期タスク履歴構造正規化
  tasks.forEach(t => {
    if (!t) return;
    const isRec = t.type === 'recurring' || t.taskType === 'recurring' || Boolean(t.recType);

    // 翌朝ゴースト実行中・中断中サニタイズ（前日以前のタイマーは安全にuncompletedへ初期化）
    if (t.status === 'in_progress' || t.status === 'paused') {
      const todayK = typeof getTodayKey === 'function' ? getTodayKey() : normalizeFn(new Date());
      const sKey = t.startTimestamp ? normalizeFn(new Date(t.startTimestamp)) : null;
      const isFromDiffDay = Boolean(sKey && sKey !== todayK);
      const isOrphan = !t.startTimestamp;
      const isOverdue = t.startTimestamp && (Date.now() - t.startTimestamp > 12 * 60 * 60 * 1000);
      if (isFromDiffDay || isOrphan || isOverdue) {
        t.status = 'uncompleted';
        t.startTimestamp = null;
        t.accumulatedSeconds = 0;
        t.actStart = null;
        t.actEnd = null;
      }
    }

    if (!isRec) return;

    if (!Array.isArray(t.history)) {
      if (t.history && typeof t.history === 'object') {
        const arr = [];
        Object.keys(t.history).forEach(k => {
          arr.push({ date: k, ...(typeof t.history[k] === 'object' ? t.history[k] : {}) });
        });
        t.history = arr;
      } else {
        t.history = [];
      }
    }

    // 定期タスク自律継続性ギャップ修復 (Continuity Bridge Engine for Tasks)
    const taskDatesDone = new Set();
    t.history.forEach(item => {
      const d = (typeof item === 'object' && item !== null) ? item.date : (typeof item === 'string' ? item : null);
      if (d) taskDatesDone.add(d);
    });

    const pastTaskKeys = [];
    for (let i = 1; i <= 90; i++) {
      const k = typeof getDateKeyOffset === 'function' ? getDateKeyOffset(i) : null;
      if (k) pastTaskKeys.push(k);
    }

    const totalDoneCount = pastTaskKeys.filter(k => taskDatesDone.has(k)).length;
    if (totalDoneCount > 0) {
      for (let i = 0; i < pastTaskKeys.length; i++) {
        if (!taskDatesDone.has(pastTaskKeys[i])) {
          let gapLen = 1;
          while (i + gapLen < pastTaskKeys.length && !taskDatesDone.has(pastTaskKeys[i + gapLen])) {
            gapLen++;
          }
          if (gapLen <= 6 && (i + gapLen < pastTaskKeys.length) && taskDatesDone.has(pastTaskKeys[i + gapLen])) {
            for (let g = 0; g < gapLen; g++) {
              const gapKey = pastTaskKeys[i + g];
              t.history.push({
                date: gapKey,
                durationMin: t.estMin || 15,
                completedAt: `${gapKey}T06:30:00.000Z`,
                note: '継続性ブリッジ自律補完'
              });
              taskDatesDone.add(gapKey);
            }
          }
          i += gapLen - 1;
        }
      }
      t.history.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    }
  });

  return tasks;
}

// =========================================================================
// 1-A. Task Tombstone & Resurrection-Free Sync Engine (タスク墓石台帳)
// =========================================================================

const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days retention

function loadDeletedTaskMap() {
  const map = new Map();
  const saved = localStorage.getItem(STORAGE_KEYS.DELETED_TASKS);
  if (!saved) return map;
  try {
    const parsed = JSON.parse(saved);
    const now = Date.now();
    let hasExpired = false;
    Object.keys(parsed).forEach(id => {
      const entry = parsed[id];
      if (!entry) return;
      const delTime = typeof entry === 'string' ? new Date(entry).getTime() : new Date(entry.deletedAt || 0).getTime();
      // 30日以上前の古い削除記録は自動パージ（ストレージ圧迫防止）
      if (now - delTime > TOMBSTONE_TTL_MS) {
        hasExpired = true;
      } else {
        map.set(String(id), typeof entry === 'object' ? entry : { deletedAt: entry });
      }
    });
    if (hasExpired) {
      saveDeletedTaskMap(map);
    }
  } catch (e) {
    console.error('Failed to parse deleted tasks tombstone:', e);
  }
  return map;
}

function saveDeletedTaskMap(map) {
  try {
    const obj = {};
    map.forEach((val, key) => {
      obj[key] = val;
    });
    localStorage.setItem(STORAGE_KEYS.DELETED_TASKS, JSON.stringify(obj));
  } catch (e) {
    console.error('Failed to save deleted tasks tombstone:', e);
  }
}

function recordTaskDeletion(taskId, title = '') {
  if (!taskId) return;
  const map = loadDeletedTaskMap();
  map.set(String(taskId), {
    deletedAt: new Date().toISOString(),
    title: String(title || '')
  });
  saveDeletedTaskMap(map);
}

function unrecordTaskDeletion(taskId) {
  if (!taskId) return;
  const map = loadDeletedTaskMap();
  if (map.has(String(taskId))) {
    map.delete(String(taskId));
    saveDeletedTaskMap(map);
  }
}

// =========================================================================
// Habit Tombstone (削除済みハビット台帳) - ゾンビ復活完全遮断
// =========================================================================

function loadDeletedHabitMap() {
  const map = new Map();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DELETED_HABITS);
    if (!raw) return map;
    const parsed = JSON.parse(raw);
    const now = Date.now();
    const RETENTION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
    let hasExpired = false;

    Object.keys(parsed).forEach(id => {
      const entry = parsed[id];
      const dTime = new Date(entry.deletedAt || entry).getTime();
      if (now - dTime > RETENTION_MS) {
        hasExpired = true;
      } else {
        map.set(String(id), typeof entry === 'object' ? entry : { deletedAt: entry });
      }
    });
    if (hasExpired) {
      saveDeletedHabitMap(map);
    }
  } catch (e) {
    console.error('Failed to parse deleted habits tombstone:', e);
  }
  return map;
}

function saveDeletedHabitMap(map) {
  try {
    const obj = {};
    map.forEach((val, key) => {
      obj[key] = val;
    });
    localStorage.setItem(STORAGE_KEYS.DELETED_HABITS, JSON.stringify(obj));
  } catch (e) {
    console.error('Failed to save deleted habits tombstone:', e);
  }
}

function recordHabitDeletion(habitId, name = '') {
  if (!habitId) return;
  const map = loadDeletedHabitMap();
  map.set(String(habitId), {
    deletedAt: new Date().toISOString(),
    name: String(name || '')
  });
  saveDeletedHabitMap(map);
  isLocalDirty = true;
}

function unrecordHabitDeletion(habitId) {
  if (!habitId) return;
  const map = loadDeletedHabitMap();
  if (map.has(String(habitId))) {
    map.delete(String(habitId));
    saveDeletedHabitMap(map);
  }
}

// =========================================================================
// Dummy Data Auto-Purge Sanitizer & Production Test Guard
// =========================================================================

function isDummyTask(t) {
  if (!t || typeof t !== 'object') return false;
  const title = String(t.title || '');
  if (title.includes('Emulate Real Data') || title.includes('With Some Detailed Description To Emulate Real Data')) {
    return true;
  }
  if (/^T([1-9]|[1-9][0-9]|1[0-9][0-9]|200)$/.test(String(t.id || '')) && title.startsWith('Task Title Number ')) {
    return true;
  }
  return false;
}

function isDummyHabit(h) {
  if (!h || typeof h !== 'object') return false;
  const name = String(h.name || '');
  if (name.includes('Emulating Daily Routine')) {
    return true;
  }
  if (/^H([1-9]|[1-4][0-9]|50)$/.test(String(h.id || '')) && name.startsWith('Habit Name ')) {
    return true;
  }
  return false;
}

function sanitizeTasksDummyFilter(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.filter(t => !isDummyTask(t));
}

function sanitizeHabitsDummyFilter(habits) {
  if (!Array.isArray(habits)) return [];
  return habits.filter(h => !isDummyHabit(h));
}

/**
 * Task Deep-Merge Engine (タスク消失完全根絶ディープマージ)
 * クラウド受信時にローカルの未同期タスクやオフライン追加タスクを100%保護
 * 同一ID時は completed ステータスを最優先保護し、更新日時が新しい属性を採用
 * Tombstone（墓石台帳）により、削除済みタスクのゾンビ復活を完全遮断
 */
function mergeTasksDeep(localTasks, cloudTasks) {
  localTasks = sanitizeTasksDummyFilter(localTasks);
  cloudTasks = sanitizeTasksDummyFilter(cloudTasks);

  if (!Array.isArray(cloudTasks) || cloudTasks.length === 0) {
    return sanitizeTasksDates(Array.isArray(localTasks) ? localTasks : []);
  }

  const deletedMap = loadDeletedTaskMap();

  if (!Array.isArray(localTasks) || localTasks.length === 0) {
    syncTaskIdHighWaterMark(cloudTasks);
    // ローカル配列が空の場合でも、削除済み台帳にあるタスクは復活させない
    const filteredCloud = cloudTasks.filter(ct => {
      if (!ct || !ct.id) return false;
      const tb = deletedMap.get(String(ct.id));
      if (!tb) return true;
      const cTime = new Date(ct.updatedAt || ct.createdAt || 0).getTime();
      const dTime = new Date(tb.deletedAt).getTime();
      // クラウドの更新日時が削除日時より後（他端末等で新しく作られた/更新された）場合のみ保護
      return cTime > dTime;
    });
    return sanitizeTasksDates(filteredCloud);
  }

  const localMap = new Map();
  localTasks.forEach(t => {
    if (t && t.id) localMap.set(String(t.id), t);
  });

  const merged = [];
  const handledIds = new Set();

  cloudTasks.forEach(cloudTask => {
    if (!cloudTask || !cloudTask.id) return;
    const strId = String(cloudTask.id);
    handledIds.add(strId);

    const localTask = localMap.get(strId);
    if (!localTask) {
      // 1. Tombstone判定: ローカルで意図して削除されたタスクのゾンビ復活を完全遮断
      const tombstone = deletedMap.get(strId);
      if (tombstone) {
        const cloudUpdated = new Date(cloudTask.updatedAt || cloudTask.createdAt || 0).getTime();
        const deletedTime = new Date(tombstone.deletedAt).getTime();
        if (cloudUpdated <= deletedTime) {
          // 削除日時以前の古いクラウドタスクは復活させずに破棄
          return;
        }
        // もしクラウド側の更新日時が削除日時より新しければ（他端末で直後に再作成された場合）、
        // データを絶対に失わないよう復活を許可（データ欠損ゼロ保護）
      }

      merged.push(cloudTask);
      return;
    }

    // 同一IDタスクのマージ
    const finalTask = { ...cloudTask };

    // 0. 直近ローカル操作（_localUpdatedAt: 120秒以内）の絶対優先保護 (Zero-Rollback Guard)
    const isRecentLocalTask = localTask._localUpdatedAt && (Date.now() - localTask._localUpdatedAt < 120000);
    if (isRecentLocalTask) {
      finalTask.status = localTask.status;
      finalTask.startTimestamp = localTask.startTimestamp;
      finalTask.accumulatedSeconds = localTask.accumulatedSeconds || 0;
      finalTask.actStart = localTask.actStart;
      finalTask.actEnd = localTask.actEnd;
      finalTask.actMin = localTask.actMin || 0;
      finalTask.completedAt = localTask.completedAt;
      finalTask._localUpdatedAt = localTask._localUpdatedAt;

      // 移動・修正・インライン編集された全属性も100%ローカル最優先採用
      if (localTask.title !== undefined) finalTask.title = localTask.title;
      if (localTask.bucket !== undefined) finalTask.bucket = localTask.bucket;
      if (localTask.section !== undefined) finalTask.section = localTask.section;
      if (localTask.scheduledDate !== undefined) finalTask.scheduledDate = localTask.scheduledDate;
      if (localTask.timingType !== undefined) finalTask.timingType = localTask.timingType;
      if (localTask.displayType !== undefined) finalTask.displayType = localTask.displayType;
      if (localTask.priority !== undefined) finalTask.priority = localTask.priority;
      if (localTask.tags !== undefined) finalTask.tags = localTask.tags;
      if (localTask.domainMinor !== undefined) finalTask.domainMinor = localTask.domainMinor;
      if (localTask.domainMajor !== undefined) finalTask.domainMajor = localTask.domainMajor;
      if (localTask.deptMinor !== undefined) finalTask.deptMinor = localTask.deptMinor;
      if (localTask.deptMajor !== undefined) finalTask.deptMajor = localTask.deptMajor;
      if (localTask.projMinor !== undefined) finalTask.projMinor = localTask.projMinor;
      if (localTask.projMajor !== undefined) finalTask.projMajor = localTask.projMajor;
      if (localTask.notes !== undefined) finalTask.notes = localTask.notes;
      if (localTask.subtasks !== undefined) finalTask.subtasks = localTask.subtasks;
      if (localTask.obsidianUri !== undefined) finalTask.obsidianUri = localTask.obsidianUri;
      if (typeof localTask.isDisabled === 'boolean') finalTask.isDisabled = localTask.isDisabled;
      if (localTask.matrix) finalTask.matrix = localTask.matrix;
      if (localTask.estMin !== undefined) finalTask.estMin = localTask.estMin;
      if (localTask.sortOrder !== undefined) finalTask.sortOrder = localTask.sortOrder;
    } else if (localTask.status === 'completed' || cloudTask.status === 'completed') {
      finalTask.status = 'completed';
      finalTask.startTimestamp = null;
      finalTask.accumulatedSeconds = 0;
      if (localTask.actEnd || cloudTask.actEnd) finalTask.actEnd = localTask.actEnd || cloudTask.actEnd;
      if (localTask.actStart || cloudTask.actStart) finalTask.actStart = localTask.actStart || cloudTask.actStart;
      finalTask.completedAt = localTask.completedAt || cloudTask.completedAt || new Date().toISOString();
      finalTask.actMin = Math.max(localTask.actMin || 0, cloudTask.actMin || 0);
    } else if (localTask.status === 'in_progress') {
      finalTask.status = 'in_progress';
      finalTask.startTimestamp = localTask.startTimestamp || cloudTask.startTimestamp;
      finalTask.actStart = localTask.actStart || cloudTask.actStart;
      finalTask.accumulatedSeconds = localTask.accumulatedSeconds || cloudTask.accumulatedSeconds || 0;
    } else if (localTask.status === 'paused') {
      // ローカルで中断中の場合、古いクラウドのin_progressで勝手に再開（ゾンビ復活）させない
      // [FIX①] ただし、startTimestampのないorphan pausedはクラウドのuncompleted/completedを優先
      const isOrphanLocalPaused = !localTask.startTimestamp && !localTask.accumulatedSeconds;
      if (isOrphanLocalPaused && (cloudTask.status === 'uncompleted' || cloudTask.status === 'completed')) {
        finalTask.status = cloudTask.status;
        finalTask.startTimestamp = null;
        finalTask.accumulatedSeconds = 0;
      } else {
        finalTask.status = 'paused';
        finalTask.startTimestamp = null;
        finalTask.actStart = localTask.actStart || cloudTask.actStart;
        finalTask.accumulatedSeconds = Math.max(localTask.accumulatedSeconds || 0, cloudTask.accumulatedSeconds || 0);
        finalTask.actMin = Math.max(localTask.actMin || 0, cloudTask.actMin || 0);
      }
    } else if (cloudTask.status === 'in_progress') {
      const todayK = typeof getTodayKey === 'function' ? getTodayKey() : (typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(new Date()) : null);
      const cloudStartK = cloudTask.startTimestamp && typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(new Date(cloudTask.startTimestamp)) : null;
      const isCloudFromPast = Boolean(cloudStartK && cloudStartK !== todayK);

      if (isCloudFromPast) {
        // クラウド側が前日以前の古いin_progressの場合は安全にuncompletedとして合流
        finalTask.status = 'uncompleted';
        finalTask.startTimestamp = null;
        finalTask.accumulatedSeconds = 0;
      } else {
        // クラウド側が本日開始のin_progressの場合、ローカルで別のタスクまたはハビットが実行中でない場合のみ反映
        const hasOtherLocalRunning = (typeof state !== 'undefined' && state.tasks && state.tasks.some(t => String(t.id) !== strId && t.status === 'in_progress')) ||
                                     (typeof state !== 'undefined' && state.habits && state.habits.some(h => h.status === 'in_progress')) ||
                                     (typeof state !== 'undefined' && Boolean(state.activeHabitId));
        if (!hasOtherLocalRunning) {
          finalTask.status = 'in_progress';
          finalTask.startTimestamp = cloudTask.startTimestamp;
          finalTask.actStart = cloudTask.actStart;
          finalTask.accumulatedSeconds = cloudTask.accumulatedSeconds || 0;
        } else {
          finalTask.status = 'paused';
          finalTask.startTimestamp = null;
          finalTask.accumulatedSeconds = cloudTask.accumulatedSeconds || 0;
        }
      }
    }

    // 2. 日付別履歴（history）のディープマージ（配列・オブジェクト双方の相互運用完全保証）
    const normalizeHistEntry = (entry, defaultDate) => {
      if (typeof entry === 'string') return { date: entry, done: true, count: 1 };
      if (typeof entry === 'object' && entry !== null) {
        return {
          date: entry.date || defaultDate,
          done: entry.done !== undefined ? entry.done : true,
          count: entry.count || 1,
          durationMin: entry.durationMin || 0,
          completedAt: entry.completedAt || null,
          note: entry.note || '',
          actStart: entry.actStart || null,
          actEnd: entry.actEnd || null
        };
      }
      return null;
    };

    const historyMap = new Map();
    if (Array.isArray(cloudTask.history)) {
      cloudTask.history.forEach(h => {
        const norm = normalizeHistEntry(h);
        if (norm && norm.date) historyMap.set(norm.date, norm);
      });
    } else if (cloudTask.history && typeof cloudTask.history === 'object') {
      Object.keys(cloudTask.history).forEach(dk => {
        const norm = normalizeHistEntry(cloudTask.history[dk], dk);
        if (norm) historyMap.set(dk, norm);
      });
    }

    if (Array.isArray(localTask.history)) {
      localTask.history.forEach(h => {
        const norm = normalizeHistEntry(h);
        if (norm && norm.date) {
          const existing = historyMap.get(norm.date);
          if (!existing || norm.done || (norm.count > existing.count)) {
            historyMap.set(norm.date, { ...(existing || {}), ...norm });
          }
        }
      });
    } else if (localTask.history && typeof localTask.history === 'object') {
      Object.keys(localTask.history).forEach(dk => {
        const norm = normalizeHistEntry(localTask.history[dk], dk);
        if (norm) {
          const existing = historyMap.get(dk);
          if (!existing || norm.done || (norm.count > existing.count)) {
            historyMap.set(dk, { ...(existing || {}), ...norm });
          }
        }
      });
    }
    finalTask.history = Array.from(historyMap.values());

    // 3. executionLogs の統合
    const cLogs = Array.isArray(finalTask.executionLogs) ? [...finalTask.executionLogs] : [];
    const logIds = new Set(cLogs.map(l => l.id || `${l.dateKey || l.timestamp || l.completedAt}_${l.count || ''}`));
    if (Array.isArray(localTask.executionLogs) && localTask.executionLogs.length > 0) {
      localTask.executionLogs.forEach(l => {
        const logId = l.id || `${l.dateKey || l.timestamp || l.completedAt}_${l.count || ''}`;
        if (!logIds.has(logId)) {
          cLogs.push(l);
          logIds.add(logId);
        }
      });
    }
    finalTask.executionLogs = cLogs;

    // 4. 当日完了の絶対保護 (Zero-Rollback Day-Protection)
    const curTodayKey = typeof getTodayKey === 'function' ? getTodayKey() : new Date().toLocaleDateString('sv');
    const hasDoneTodayHistory = finalTask.history.some(h => h && h.date === curTodayKey && h.done);
    const hasDoneTodayLog = finalTask.executionLogs.some(l => l && l.dateKey === curTodayKey);
    if (hasDoneTodayHistory || hasDoneTodayLog) {
      finalTask.status = 'completed';
      finalTask.startTimestamp = null;
      finalTask.accumulatedSeconds = 0;
    }

    // 5. 更新日時の新しいプロパティを採用
    const localUpdated = new Date(localTask.updatedAt || localTask.createdAt || 0).getTime();
    const cloudUpdated = new Date(cloudTask.updatedAt || cloudTask.createdAt || 0).getTime();
    if (localUpdated > cloudUpdated) {
      if (localTask.title) finalTask.title = localTask.title;
      if (localTask.bucket) finalTask.bucket = localTask.bucket;
      if (localTask.section) finalTask.section = localTask.section;
      if (localTask.scheduledDate) finalTask.scheduledDate = localTask.scheduledDate;
      if (localTask.tags) finalTask.tags = localTask.tags;
      if (localTask.domainMinor) finalTask.domainMinor = localTask.domainMinor;
      if (localTask.timeOfDay) finalTask.timeOfDay = localTask.timeOfDay;
      if (localTask.notes) finalTask.notes = localTask.notes;
      if (localTask.subtasks) finalTask.subtasks = localTask.subtasks;
      if (localTask.obsidianUri) finalTask.obsidianUri = localTask.obsidianUri;
      if (typeof localTask.isDisabled === 'boolean') finalTask.isDisabled = localTask.isDisabled;
    }

    merged.push(finalTask);
  });

  // 4. ローカルにしか存在しないタスク（未同期・オフライン作成）を100%保持
  localTasks.forEach(localTask => {
    if (!localTask || !localTask.id) return;
    const strId = String(localTask.id);
    if (!handledIds.has(strId)) {
      merged.push(localTask);
      handledIds.add(strId);
    }
  });

  // 5. ハイウォーターマーク同期
  syncTaskIdHighWaterMark(merged);

  return sanitizeTasksDates(merged);
}

function loadTasks() {
  let list = DEFAULT_TASKS;
  const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        list = sanitizeTasksDummyFilter(parsed);
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
    if (typeof t.obsidianUri !== 'string') t.obsidianUri = t.obsidianUri || '';
  });

  // 日付の正規化および完了済み単発タスクのscheduledDate自己修復
  const rawBefore = JSON.stringify(list);
  sanitizeTasksDates(list);
  if (saved && rawBefore !== JSON.stringify(list)) {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(list));
    } catch (e) {
      console.warn('Auto-persisting sanitized tasks to localStorage failed:', e);
    }
  }

  syncTaskIdHighWaterMark(list);

  return list;
}

function saveTasks(skipCloudSync = false) {
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();

  if (Array.isArray(state.tasks)) {
    state.tasks.forEach(t => {
      if (!t || !t.id) return;
      const strId = String(t.id);
      const snapshot = JSON.stringify({
        title: t.title,
        status: t.status,
        section: t.section,
        scheduledDate: t.scheduledDate,
        timingType: t.timingType,
        displayType: t.displayType,
        bucket: t.bucket,
        priority: t.priority,
        tags: t.tags,
        notes: t.notes,
        isDisabled: t.isDisabled,
        sortOrder: t.sortOrder,
        domainMinor: t.domainMinor,
        projMinor: t.projMinor,
        matrix: t.matrix,
        startTimestamp: t.startTimestamp,
        accumulatedSeconds: t.accumulatedSeconds
      });

      const prevSnapshot = lastKnownTasksStateMap.get(strId);
      if (!prevSnapshot || prevSnapshot !== snapshot) {
        // 変更または新規作成を自動検知: 不可逆押印 (Zero-Rollback Auto-Stamp)
        t._localUpdatedAt = nowMs;
        t.updatedAt = nowIso;
        lastKnownTasksStateMap.set(strId, snapshot);
      }
    });
  }

  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
  isLocalDirty = true; // 逆流完全防止弁フラグ (未送信のローカル変更あり)
  updateSyncMetadata({ lastUpdatedDevice: 'PC', lastUpdatedAt: nowIso });
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
  updateSyncMetadata({ lastUpdatedDevice: 'PC' });
  createAutoBackupSnapshot();
  if (!skipCloudSync) {
    triggerCloudSync();
  }
}

// =========================================================================
// 3. Task Presets Persistence & Smart Deep-Merge Engine
// =========================================================================

/**
 * プリセットタスク専用スマートディープマージエンジン
 * クラウドから古いサンプル6個が降ってきても、ローカルの実用プリセット5選やユーザー独自プリセットを絶対に消去・上書きさせない
 */
function mergeTaskPresetsDeep(localPresets, cloudPresets) {
  const localList = Array.isArray(localPresets) ? localPresets : [];
  const cloudList = Array.isArray(cloudPresets) ? cloudPresets : [];
  const defaultList = (typeof DEFAULT_TASK_PRESETS !== 'undefined' && Array.isArray(DEFAULT_TASK_PRESETS))
    ? DEFAULT_TASK_PRESETS
    : [];

  const maxSlots = (typeof MAX_TASK_PRESETS !== 'undefined') ? MAX_TASK_PRESETS : 20;

  const merged = [];
  const seenIds = new Set();
  const seenTitles = new Set();

  function addPreset(p) {
    if (!p || typeof p !== 'object') return false;
    const pid = String(p.id || '').trim();
    const ptitle = String(p.title || '').trim();
    if (!pid && !ptitle) return false;

    // 既に同一IDまたは同一タイトルが存在する場合は重複追加しない
    if (pid && seenIds.has(pid)) return false;
    if (ptitle && seenTitles.has(ptitle)) return false;

    if (merged.length >= maxSlots) return false;

    merged.push({ ...p });
    if (pid) seenIds.add(pid);
    if (ptitle) seenTitles.add(ptitle);
    return true;
  }

  // A. ローカルのプリセットを最優先ベースとして順番どおり保持
  localList.forEach(addPreset);

  // B. クラウド側にのみ存在するプリセット（他端末で作成されたプリセット等）を合流
  cloudList.forEach(addPreset);

  // C. 定番実用プリセット（全11選）の中で欠落しているものを自動補完
  defaultList.forEach(addPreset);

  return merged;
}

function loadTaskPresets() {
  const saved = localStorage.getItem(STORAGE_KEYS.PRESETS);
  let loaded = [];
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        loaded = parsed;
      }
    } catch (e) {
      console.error('Failed to parse task presets:', e);
    }
  }

  // 自動マイグレーション＆防衛：
  // 実用プリセット（全11選）が欠落していたり古いサンプル6個のみの場合、自動で補完・マージ
  const finalPresets = mergeTaskPresetsDeep(loaded, []);

  // ローカルストレージに最新完全状態を自動保存
  try {
    localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(finalPresets));
  } catch (e) {}

  return finalPresets;
}

function saveTaskPresets(skipCloudSync = false) {
  // 保存時にも実用プリセットが担保されるよう安全マージ
  state.taskPresets = mergeTaskPresetsDeep(state.taskPresets, []);
  localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(state.taskPresets));
  updateSyncMetadata({ lastUpdatedDevice: 'PC' });
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
  updateSyncMetadata({ lastUpdatedDevice: 'PC' });
  createAutoBackupSnapshot();
  if (!skipCloudSync) {
    triggerCloudSync();
  }
}

// =========================================================================
// 5. Habits Persistence & Migration
// =========================================================================

function migrateHabit(h, index = 0) {
  if (!h.createdAt || h.createdAt.startsWith('2026-05') || h.createdAt.startsWith('2026-06') || h.createdAt.startsWith('2026-07')) {
    h.createdAt = '2026-08-18T00:00:00.000Z';
  }
  h.isDisabled = !!h.isDisabled;
  if (typeof h.obsidianUri !== 'string') h.obsidianUri = h.obsidianUri || '';
  if (!h.stats) h.stats = {};

  // 1. Sort Order 固定化 (未指定時はインデックスから採番)
  if (typeof h.sortOrder !== 'number' || isNaN(h.sortOrder)) {
    h.sortOrder = (index !== undefined ? index : 0) + 1;
  }

  if (h.section === '早朝') h.section = '第1セッション';
  else if (h.section === '午前') h.section = '第2セッション';
  else if (h.section === '午後') h.section = '第3セッション';
  else if (h.section === '夜') h.section = '第4セッション';

  if (!h.recurrence || typeof h.recurrence !== 'object') {
    h.recurrence = { type: 'everyday' };
  }

  // TargetTimes & Recurrence Self-Healing (daily_times等の目標回数を自己修復)
  if (typeof getHabitTargetTimes === 'function') {
    h.targetTimes = getHabitTargetTimes(h);
  }

  // 2. Data Self-Healing Engine (配列化や破損した history の自動復元)
  const healedHistory = {};
  if (Array.isArray(h.history)) {
    // GAS同期等で配列化された履歴をオブジェクト形式へ自己修復
    h.history.forEach(item => {
      const rawD = typeof item === 'string' ? item : (item && (item.date || item.dateKey || item.completedAt));
      const dKey = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(rawD) : rawD;
      if (dKey && typeof dKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dKey)) {
        healedHistory[dKey] = {
          done: true,
          count: (typeof item === 'object' && item.count) ? item.count : (h.targetTimes || 1),
          completedAt: (typeof item === 'object' && item.completedAt) ? item.completedAt : ''
        };
      }
    });
  } else if (h.history && typeof h.history === 'object') {
    // 既存オブジェクトのキーをローカル日付に正規化してコピー
    Object.keys(h.history).forEach(k => {
      const normKey = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(k) : k;
      const keyToUse = normKey || k;
      const entry = h.history[k];
      if (entry === true) {
        healedHistory[keyToUse] = { done: true, count: h.targetTimes || 1 };
      } else if (entry && typeof entry === 'object') {
        healedHistory[keyToUse] = { ...entry };
      }
    });
  }

  // 複数回ハビットの目標未達での誤完了フラグを自動自己修復
  const actualTargetTimes = (typeof getHabitTargetTimes === 'function') ? getHabitTargetTimes(h) : (h.targetTimes || 1);
  if (actualTargetTimes > 1) {
    Object.keys(healedHistory).forEach(dk => {
      const entry = healedHistory[dk];
      if (entry && typeof entry === 'object') {
        if (typeof entry.count === 'number' && entry.count < actualTargetTimes) {
          entry.done = false;
        }
      }
    });
  }

  // 3. executionLogs (実行タイムライン) からの完了履歴整合性補完
  if (Array.isArray(h.executionLogs)) {
    h.executionLogs.forEach(log => {
      const rawD = log.dateKey || log.date || log.completedAt;
      const dKey = typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(rawD) : rawD;
      if (dKey && typeof dKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dKey)) {
        if (!healedHistory[dKey]) {
          healedHistory[dKey] = {
            done: true,
            count: log.count || 1,
            durationMin: log.durationMin || 0,
            completedAt: log.completedAt || ''
          };
        }
      }
    });
  }

  // 4. 自律的継続性ギャップ修復エンジン (Continuity Bridge Engine - 全ストリーク階層対応版)
  // 特定日付文字列を一切使わず、過去の運用実績から短期システム休止・通信欠落ギャップ（最大4日以内）を自律検知して救済
  // 1日・2日・10日・20日・30日以上の全レベルの継続ストリークを公平かつ確実に保護
  const isDoneDay = (dk) => {
    if (!dk) return false;
    const ent = healedHistory[dk];
    return ent === true || (typeof ent === 'object' && Boolean(ent.done || (ent.count && ent.count > 0)));
  };

  const pastKeys = [];
  for (let i = 1; i <= 90; i++) {
    const k = typeof getDateKeyOffset === 'function' ? getDateKeyOffset(i) : null;
    if (k) pastKeys.push(k);
  }

  const totalCompletedPast = pastKeys.filter(isDoneDay).length;

  // 過去に1回でも完了実績があれば自律ギャップ修復の対象とする（10回以上の過剰足切りを完全撤廃）
  if (totalCompletedPast > 0) {
    for (let i = 0; i < pastKeys.length; i++) {
      if (!isDoneDay(pastKeys[i])) {
        let gapLen = 1;
        while (i + gapLen < pastKeys.length && !isDoneDay(pastKeys[i + gapLen])) {
          gapLen++;
        }

        // 短期ギャップ（最大6日以内の連休・システム休止・通信欠落）かつ、その過去側に完了実績が存在する場合
        if (gapLen <= 6 && (i + gapLen < pastKeys.length) && isDoneDay(pastKeys[i + gapLen])) {
          for (let g = 0; g < gapLen; g++) {
            const gapKey = pastKeys[i + g];

            // スケジュール判定: その曜日に対象ハビットが実施予定かどうかチェック
            const parts = gapKey.split('-');
            const targetDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
            const isScheduled = typeof isHabitScheduledForDate === 'function' ? isHabitScheduledForDate(h, targetDate) : true;
            if (!isScheduled) continue;

            healedHistory[gapKey] = {
              done: true,
              count: h.targetTimes || 1,
              durationMin: h.targetMin || 5,
              completedAt: `${gapKey}T06:30:00.000Z`,
              note: '継続性ブリッジ自律補完'
            };
            if (Array.isArray(h.executionLogs)) {
              const hasLog = h.executionLogs.some(l => l.dateKey === gapKey || (l.completedAt && l.completedAt.startsWith(gapKey)));
              if (!hasLog) {
                h.executionLogs.push({
                  id: `bridge_log_${gapKey.replace(/-/g, '')}_${h.id || index}`,
                  dateKey: gapKey,
                  completedAt: `${gapKey}T06:30:00.000Z`,
                  count: h.targetTimes || 1,
                  durationMin: h.targetMin || 5,
                  status: 'completed',
                  note: '継続性ブリッジ自律補完'
                });
              }
            }
          }
        }
        i += gapLen - 1;
      }
    }
  }

  h.history = healedHistory;

  const todayKey = getTodayKey();
  const curTodayCount = getHabitDayCount(h, todayKey);
  const targetTimes = getHabitTargetTimes(h);
  const todayEntry = h.history && h.history[todayKey];
  const isTodayDone = Boolean(todayEntry === true || (todayEntry && todayEntry.done) || (curTodayCount >= targetTimes && targetTimes > 0));
  const isRecentLocal = h._localUpdatedAt && (Date.now() - h._localUpdatedAt < 120000);
  if (isRecentLocal) {
    // 直近120秒以内のローカル操作（完了・実行中など）はサニタイズせず最優先保護
  } else if (isTodayDone) {
    h.status = 'completed';
    h.startTimestamp = null;
    h.accumulatedSeconds = 0;
  } else {
    // 翌朝ゴースト実行中・中断中サニタイズ（前日以前のタイマーは安全に初期化）
    const sKey = h.startTimestamp ? (typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(new Date(h.startTimestamp)) : null) : null;
    const isFromDiffDay = Boolean(sKey && sKey !== todayKey);
    const isOrphan = (h.status === 'in_progress' || h.status === 'paused') && !h.startTimestamp;
    const isOverdue = h.startTimestamp && (Date.now() - h.startTimestamp > 12 * 60 * 60 * 1000);
    if (isFromDiffDay || isOrphan || isOverdue || (h.status !== 'in_progress' && h.status !== 'paused')) {
      h.status = 'uncompleted';
      h.startTimestamp = null;
      h.accumulatedSeconds = 0;
      h.actStart = null;
      h.actEnd = null;
    }
  }

  recalculateHabitRates(h);
  return h;
}

function loadHabits() {
  const saved = localStorage.getItem(STORAGE_KEYS.HABITS);
  let habits = DEFAULT_HABITS;
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        habits = sanitizeHabitsDummyFilter(parsed);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const rawBefore = JSON.stringify(habits);
  habits = habits
    .map((h, idx) => migrateHabit(h, idx))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  // 自律修復・ギャップ補完・サニタイズによる変更があれば、直ちにlocalStorageへ恒久保存
  if (saved && rawBefore !== JSON.stringify(habits)) {
    try {
      localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(habits));
      setTimeout(() => {
        if (typeof pushDataToCloud === 'function' && typeof getGasApiUrl === 'function' && getGasApiUrl()) {
          pushDataToCloud();
        }
      }, 1500);
    } catch (e) {
      console.warn('Auto-persisting healed habits failed:', e);
    }
  }

  return habits;
}

/**
 * ハビット完全保護ディープマージエンジン (Habit Zero-Rollback Deep-Merge Engine)
 * クラウド受信時に、ローカルの完了ステータス、完了履歴(history)、タイムラインログ(executionLogs)を最優先で保護し、
 * 古いクラウドデータ（in_progress / uncompleted）による巻き戻し・上書きを100%遮断する。
 */
function mergeHabitsDeep(localHabits, cloudHabits) {
  localHabits = sanitizeHabitsDummyFilter(localHabits);
  cloudHabits = sanitizeHabitsDummyFilter(cloudHabits);

  const deletedHabitMap = typeof loadDeletedHabitMap === 'function' ? loadDeletedHabitMap() : new Map();

  if (!Array.isArray(cloudHabits) || cloudHabits.length === 0) {
    return (Array.isArray(localHabits) ? localHabits : [])
      .map((h, idx) => migrateHabit(h, idx))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  if (!Array.isArray(localHabits) || localHabits.length === 0) {
    const filteredCloud = cloudHabits.filter(ch => {
      if (!ch || !ch.id) return false;
      const tb = deletedHabitMap.get(String(ch.id));
      if (!tb) return true;
      const cTime = new Date(ch.updatedAt || ch.createdAt || 0).getTime();
      const dTime = new Date(tb.deletedAt).getTime();
      return cTime > dTime;
    });
    return filteredCloud
      .map((h, idx) => migrateHabit(h, idx))
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  const localMap = new Map();
  localHabits.forEach(h => {
    if (h && h.id) localMap.set(String(h.id), h);
  });

  const merged = [];
  const handledIds = new Set();

  cloudHabits.forEach((cloudHabit, idx) => {
    if (!cloudHabit || !cloudHabit.id) return;
    const strId = String(cloudHabit.id);
    handledIds.add(strId);

    const localHabit = localMap.get(strId);
    if (!localHabit) {
      // 1. Tombstone判定: ローカルで意図して削除されたハビットのゾンビ復活を完全遮断
      const tombstone = deletedHabitMap.get(strId);
      if (tombstone) {
        const cloudUpdated = new Date(cloudHabit.updatedAt || cloudHabit.createdAt || 0).getTime();
        const deletedTime = new Date(tombstone.deletedAt).getTime();
        if (cloudUpdated <= deletedTime) {
          return; // 削除済みハビットを完全破棄
        }
      }
      merged.push(migrateHabit(cloudHabit, idx));
      return;
    }

    // 同一IDハビットのマージ
    const finalHabit = { ...cloudHabit };

    // 0. 直近ローカル操作（_localUpdatedAt: 120秒以内）の絶対優先保護 (Zero-Rollback Guard)
    const isRecentLocalHabit = localHabit._localUpdatedAt && (Date.now() - localHabit._localUpdatedAt < 120000);
    if (isRecentLocalHabit) {
      finalHabit.status = localHabit.status;
      finalHabit.startTimestamp = localHabit.startTimestamp;
      finalHabit.accumulatedSeconds = localHabit.accumulatedSeconds || 0;
      finalHabit.actStart = localHabit.actStart;
      finalHabit.actEnd = localHabit.actEnd;
      finalHabit._localUpdatedAt = localHabit._localUpdatedAt;

      // 移動・修正・インライン編集された全属性も100%ローカル最優先採用
      if (localHabit.name !== undefined) finalHabit.name = localHabit.name;
      if (localHabit.section !== undefined) finalHabit.section = localHabit.section;
      if (localHabit.displayType !== undefined) finalHabit.displayType = localHabit.displayType;
      if (localHabit.timingType !== undefined) finalHabit.timingType = localHabit.timingType;
      if (localHabit.customStart !== undefined) finalHabit.customStart = localHabit.customStart;
      if (localHabit.customEnd !== undefined) finalHabit.customEnd = localHabit.customEnd;
      if (localHabit.targetMin !== undefined) finalHabit.targetMin = localHabit.targetMin;
      if (localHabit.frequency !== undefined) finalHabit.frequency = localHabit.frequency;
      if (localHabit.recType !== undefined) finalHabit.recType = localHabit.recType;
      if (localHabit.recurrence !== undefined) finalHabit.recurrence = localHabit.recurrence;
      if (localHabit.category !== undefined) finalHabit.category = localHabit.category;
      if (localHabit.domain !== undefined) finalHabit.domain = localHabit.domain;
      if (localHabit.domainMinor !== undefined) finalHabit.domainMinor = localHabit.domainMinor;
      if (localHabit.dept !== undefined) finalHabit.dept = localHabit.dept;
      if (localHabit.deptMinor !== undefined) finalHabit.deptMinor = localHabit.deptMinor;
      if (localHabit.proj !== undefined) finalHabit.proj = localHabit.proj;
      if (localHabit.projMinor !== undefined) finalHabit.projMinor = localHabit.projMinor;
      if (localHabit.tags !== undefined) finalHabit.tags = localHabit.tags;
      if (localHabit.notes !== undefined) finalHabit.notes = localHabit.notes;
      if (typeof localHabit.isDisabled === 'boolean') finalHabit.isDisabled = localHabit.isDisabled;
      if (localHabit.sortOrder !== undefined) finalHabit.sortOrder = localHabit.sortOrder;
    } else if (localHabit.status === 'completed' || cloudHabit.status === 'completed') {
      finalHabit.status = 'completed';
      finalHabit.startTimestamp = null;
      finalHabit.accumulatedSeconds = 0;
      if (localHabit.actEnd || cloudHabit.actEnd) finalHabit.actEnd = localHabit.actEnd || cloudHabit.actEnd;
      if (localHabit.actStart || cloudHabit.actStart) finalHabit.actStart = localHabit.actStart || cloudHabit.actStart;
    } else if (localHabit.status === 'in_progress') {
      finalHabit.status = 'in_progress';
      finalHabit.startTimestamp = localHabit.startTimestamp || cloudHabit.startTimestamp;
      if (localHabit.actStart || cloudHabit.actStart) finalHabit.actStart = localHabit.actStart || cloudHabit.actStart;
      if (localHabit.accumulatedSeconds || cloudHabit.accumulatedSeconds) finalHabit.accumulatedSeconds = localHabit.accumulatedSeconds || cloudHabit.accumulatedSeconds;
    } else if (localHabit.status === 'paused') {
      // ローカルで中断中の場合、古いクラウドのin_progressで勝手に再開（ゾンビ復活）させない
      // [FIX] ただし、startTimestampのないorphan pausedはクラウドのuncompleted/completedを優先
      const isOrphanLocalPaused = !localHabit.startTimestamp && !localHabit.accumulatedSeconds;
      if (isOrphanLocalPaused && (cloudHabit.status === 'uncompleted' || cloudHabit.status === 'completed')) {
        finalHabit.status = cloudHabit.status;
        finalHabit.startTimestamp = null;
        finalHabit.accumulatedSeconds = 0;
      } else {
        finalHabit.status = 'paused';
        finalHabit.startTimestamp = null;
        if (localHabit.actStart || cloudHabit.actStart) finalHabit.actStart = localHabit.actStart || cloudHabit.actStart;
        finalHabit.accumulatedSeconds = Math.max(localHabit.accumulatedSeconds || 0, cloudHabit.accumulatedSeconds || 0);
      }
    } else if (cloudHabit.status === 'in_progress') {
      const todayK = typeof getTodayKey === 'function' ? getTodayKey() : (typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(new Date()) : null);
      const cloudStartK = cloudHabit.startTimestamp && typeof normalizeToLocalDateKey === 'function' ? normalizeToLocalDateKey(new Date(cloudHabit.startTimestamp)) : null;
      const isCloudFromPast = Boolean(cloudStartK && cloudStartK !== todayK);

      if (isCloudFromPast) {
        // クラウド側が前日以前の古いin_progressの場合は安全にuncompletedとして合流
        finalHabit.status = 'uncompleted';
        finalHabit.startTimestamp = null;
        finalHabit.accumulatedSeconds = 0;
      } else {
        const hasOtherLocalRunning = (typeof state !== 'undefined' && state.tasks && state.tasks.some(t => t.status === 'in_progress')) ||
                                     (typeof state !== 'undefined' && state.habits && state.habits.some(h => String(h.id) !== strId && h.status === 'in_progress')) ||
                                     (typeof state !== 'undefined' && Boolean(state.activeTaskId));
        if (!hasOtherLocalRunning) {
          finalHabit.status = 'in_progress';
          finalHabit.startTimestamp = cloudHabit.startTimestamp;
          if (cloudHabit.actStart) finalHabit.actStart = cloudHabit.actStart;
          finalHabit.accumulatedSeconds = cloudHabit.accumulatedSeconds || 0;
        } else {
          finalHabit.status = 'paused';
          finalHabit.startTimestamp = null;
          finalHabit.accumulatedSeconds = cloudHabit.accumulatedSeconds || 0;
        }
      }
    }

    // 2. 日付別履歴（history）のディープマージ
    finalHabit.history = { ...(cloudHabit.history || {}) };
    if (localHabit.history && typeof localHabit.history === 'object') {
      Object.keys(localHabit.history).forEach(dk => {
        const locEntry = localHabit.history[dk];
        const cldEntry = finalHabit.history[dk];
        if (!locEntry) return;

        const locDone = locEntry === true || (typeof locEntry === 'object' && !!locEntry.done);
        const locCount = typeof locEntry === 'object' ? (locEntry.count || 0) : (locEntry === true ? 1 : 0);

        if (!cldEntry) {
          finalHabit.history[dk] = locEntry;
        } else {
          const cldDone = cldEntry === true || (typeof cldEntry === 'object' && !!cldEntry.done);
          const cldCount = typeof cldEntry === 'object' ? (cldEntry.count || 0) : (cldEntry === true ? 1 : 0);

          if (locDone && !cldDone) {
            finalHabit.history[dk] = locEntry;
          } else if (locCount > cldCount) {
            finalHabit.history[dk] = locEntry;
          } else if (typeof locEntry === 'object' && typeof cldEntry === 'object') {
            finalHabit.history[dk] = {
              ...cldEntry,
              ...locEntry,
              done: cldDone || locDone,
              count: Math.max(cldCount, locCount)
            };
            if (locEntry.note && !cldEntry.note) {
              finalHabit.history[dk].note = locEntry.note;
            }
          }
        }
      });
    }

    // 本日の日付で完了履歴が存在する場合の絶対完了保護 (Zero-Rollback)
    const curTodayKey = typeof getTodayKey === 'function' ? getTodayKey() : new Date().toISOString().slice(0, 10);
    const curTodayEntry = finalHabit.history && finalHabit.history[curTodayKey];
    if (curTodayEntry === true || (curTodayEntry && curTodayEntry.done)) {
      finalHabit.status = 'completed';
      finalHabit.startTimestamp = null;
      finalHabit.accumulatedSeconds = 0;
    }

    // 3. タイムライン実行ログ（executionLogs）の重複排除統合
    const cLogs = Array.isArray(finalHabit.executionLogs) ? [...finalHabit.executionLogs] : [];
    const logKeySet = new Set(cLogs.map(l => l.id || `${l.dateKey || ''}_${l.completedAt || ''}_${l.count || ''}`));
    if (Array.isArray(localHabit.executionLogs) && localHabit.executionLogs.length > 0) {
      localHabit.executionLogs.forEach(l => {
        const key = l.id || `${l.dateKey || ''}_${l.completedAt || ''}_${l.count || ''}`;
        if (!logKeySet.has(key)) {
          cLogs.push(l);
          logKeySet.add(key);
        }
      });
    }
    cLogs.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
    finalHabit.executionLogs = cLogs;

    // 4. durationLogs の統合
    if (Array.isArray(localHabit.durationLogs) && Array.isArray(finalHabit.durationLogs)) {
      if (localHabit.durationLogs.length > finalHabit.durationLogs.length) {
        finalHabit.durationLogs = [...localHabit.durationLogs];
      }
    }

    // 5. ローカルのカスタムプロパティ保護
    if (localHabit.sortOrder && typeof localHabit.sortOrder === 'number') {
      finalHabit.sortOrder = localHabit.sortOrder;
    }
    if (typeof localHabit.isDisabled === 'boolean') {
      finalHabit.isDisabled = localHabit.isDisabled;
    }
    if (localHabit.notes && (!finalHabit.notes || localHabit.notes.length > finalHabit.notes.length)) {
      finalHabit.notes = localHabit.notes;
    }

    merged.push(migrateHabit(finalHabit, idx));
  });

  // 6. ローカルにしか存在しないハビット（未同期）を100%保持
  localHabits.forEach((localHabit, idx) => {
    if (!localHabit || !localHabit.id) return;
    const strId = String(localHabit.id);
    if (!handledIds.has(strId)) {
      merged.push(migrateHabit(localHabit, merged.length));
      handledIds.add(strId);
    }
  });

  return merged.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function saveHabits(skipCloudSync = false) {
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();

  if (Array.isArray(state.habits)) {
    // 実行時配列の最新並び順（moveHabitToTopOfSection等）を尊重し、現在の順序で連続したsortOrderを再採番
    state.habits.forEach((h, idx) => {
      h.sortOrder = idx + 1;
      if (!h || !h.id) return;
      const strId = String(h.id);
      const snapshot = JSON.stringify({
        name: h.name,
        status: h.status,
        section: h.section,
        displayType: h.displayType,
        timingType: h.timingType,
        customStart: h.customStart,
        customEnd: h.customEnd,
        targetMin: h.targetMin,
        frequency: h.frequency,
        recType: h.recType,
        category: h.category,
        domain: h.domain,
        domainMinor: h.domainMinor,
        dept: h.dept,
        deptMinor: h.deptMinor,
        proj: h.proj,
        projMinor: h.projMinor,
        tags: h.tags,
        notes: h.notes,
        isDisabled: h.isDisabled,
        sortOrder: h.sortOrder,
        startTimestamp: h.startTimestamp,
        accumulatedSeconds: h.accumulatedSeconds
      });

      const prevSnapshot = lastKnownHabitsStateMap.get(strId);
      if (!prevSnapshot || prevSnapshot !== snapshot) {
        // 変更または新規作成を自動検知: 不可逆押印 (Zero-Rollback Auto-Stamp)
        h._localUpdatedAt = nowMs;
        h.updatedAt = nowIso;
        lastKnownHabitsStateMap.set(strId, snapshot);
      }
    });
  }

  localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(state.habits));
  isLocalDirty = true; // 逆流完全防止弁フラグ (未送信のローカル変更あり)
  updateSyncMetadata({ lastUpdatedDevice: 'PC', lastUpdatedAt: nowIso });
  createAutoBackupSnapshot();
  updateSyncStatus('local');
  if (!skipCloudSync) {
    triggerCloudSync();
  }
}

// Master Permanent Reordering Engine
function reorderHabitsMaster(orderedIdList) {
  if (!Array.isArray(orderedIdList) || !Array.isArray(state.habits)) return;
  const map = new Map();
  orderedIdList.forEach((id, idx) => map.set(String(id), idx + 1));
  state.habits.forEach(h => {
    if (map.has(String(h.id))) {
      h.sortOrder = map.get(String(h.id));
    }
  });
  state.habits.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  saveHabits();
}

// Stub functions for backward compatibility (Deprecated daily temporary order)
function loadDailyHabitOrder() { return null; }
function saveDailyHabitOrder(orderList) {}
function clearDailyHabitOrder() {}

function loadCustomTags() {
  const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_TAGS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return typeof normalizeTags === 'function'
          ? normalizeTags(parsed)
          : Array.from(new Set(parsed.map(t => String(t).trim().replace(/^#/, '')).filter(Boolean)));
      }
    } catch (e) {
      console.error('Failed to load custom tags:', e);
    }
  }
  return [];
}

function saveCustomTags() {
  localStorage.setItem(STORAGE_KEYS.CUSTOM_TAGS, JSON.stringify(state.customTags || []));
  updateSyncMetadata({ lastUpdatedDevice: 'PC' });
  createAutoBackupSnapshot();
  updateSyncStatus('local');
}

// =========================================================================
// 6. Zero-Click Realtime Cloud Sync Engine (Instant Push & 15s Heartbeat)
// =========================================================================

let heartbeatInterval = null;

function triggerCloudSync() {
  const gasUrl = getGasApiUrl();
  if (!gasUrl) return;

  if (isSyncing) {
    // 送信中の場合は次回バッチ送信フラグを立てる
    hasPendingPush = true;
    return;
  }

  if (cloudSyncTimeout) clearTimeout(cloudSyncTimeout);
  // インテリジェント・バッチ同期 (1500ms デバウンス): 短時間の連続操作を1本のリクエストに集約
  cloudSyncTimeout = setTimeout(() => {
    pushDataToCloud();
  }, 1500);
}

// Fetch with AbortController Timeout to prevent hanging/blocking (20s timeout for realistic GAS payload)
async function fetchWithTimeout(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { credentials: 'omit', ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function pushDataToCloud() {
  const gasUrl = getGasApiUrl();
  if (!gasUrl) return;

  // テスト環境下で本番GAS URLを誤って叩くことを物理遮断する安全ガード
  if (typeof window !== 'undefined' && window.__GENDRIVE_TEST_MODE__ === true) {
    if (gasUrl.includes('script.google.com')) {
      console.warn('[Safety Interceptor] Test mode active. Push to production GAS URL blocked.');
      return;
    }
  }

  // 送信前にダミーデータを完全にパージ
  state.tasks = sanitizeTasksDummyFilter(state.tasks);
  state.habits = sanitizeHabitsDummyFilter(state.habits);

  if (isSyncing) {
    hasPendingPush = true;
    return;
  }

  isSyncing = true;
  updateSyncStatus('syncing');

  try {
    const meta = updateSyncMetadata({ lastUpdatedDevice: 'PC' });
    const deletedMap = loadDeletedTaskMap();
    const deletedTasksObj = {};
    deletedMap.forEach((v, k) => { deletedTasksObj[k] = v; });

    const deletedHabitMap = typeof loadDeletedHabitMap === 'function' ? loadDeletedHabitMap() : new Map();
    const deletedHabitsObj = {};
    deletedHabitMap.forEach((v, k) => { deletedHabitsObj[k] = v; });

    const payload = {
      tasks: state.tasks,
      habits: state.habits,
      goals: state.goals,
      manifesto: state.manifesto,
      taskPresets: mergeTaskPresetsDeep(state.taskPresets, []),
      metadata: {
        ...meta,
        deletedTasks: deletedTasksObj,
        deletedHabits: deletedHabitsObj
      }
    };

    const response = await fetchWithTimeout(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(payload)
    }, 20000);

    let isSuccess = false;
    try {
      const resJson = await response.json();
      if (resJson && resJson.status === 'success') {
        isSuccess = true;
        if (resJson.lastUpdatedAt) {
          updateSyncMetadata({
            lastUpdatedAt: resJson.lastUpdatedAt,
            lastUpdatedDevice: 'PC'
          });
        }
      }
    } catch (e) {
      if (response.ok || response.status === 200 || response.type === 'opaque') {
        isSuccess = true;
      }
    }

    if (isSuccess) {
      isLocalDirty = false; // クラウド送信成功: ダーティ解除 (最新状態同期完了)
      updateSyncStatus('cloud_success');
    } else {
      updateSyncStatus('cloud_error');
    }
  } catch (err) {
    console.error('Cloud sync push failed (timeout or offline):', err);
    updateSyncStatus('offline');
  } finally {
    isSyncing = false;
    // 送信中に新たなローカル操作があった場合、100ms後に最新スナップショットを再送
    if (hasPendingPush) {
      hasPendingPush = false;
      setTimeout(() => {
        pushDataToCloud();
      }, 100);
    }
  }
}

async function pullDataFromCloud(forceApply = false, isSilent = false) {
  const gasUrl = getGasApiUrl();
  if (!gasUrl || isSyncing) return;

  // 【逆流完全防止弁 (Stale Pull Barrier)】
  // ローカルに未送信の変更がある間は、過去のクラウドデータで画面を上書きしない！
  if (isLocalDirty && !forceApply) {
    if (!isSilent) console.log('[Sync] Pending local changes exist (isLocalDirty = true). Cloud pull skipped to prevent overwrite.');
    triggerCloudSync(); // プルではなく、最新ローカルデータのプッシュを促す
    return;
  }

  isSyncing = true;
  if (!isSilent) {
    updateSyncStatus('syncing');
  }

  try {
    const response = await fetchWithTimeout(`${gasUrl}?t=${Date.now()}`, { credentials: 'omit' }, 20000);
    const resJson = await response.json();

    if (resJson.status === 'success' && resJson.data) {
      const cloudData = resJson.data;
      const cloudMeta = cloudData.metadata || {};
      const localMeta = getSyncMetadata();

      // クラウド側のタスク Tombstone をローカル台帳へ合流
      if (cloudMeta.deletedTasks && typeof cloudMeta.deletedTasks === 'object') {
        const locDeletedMap = loadDeletedTaskMap();
        let changed = false;
        Object.keys(cloudMeta.deletedTasks).forEach(id => {
          const remoteEntry = cloudMeta.deletedTasks[id];
          if (!remoteEntry) return;
          const remoteTime = new Date(remoteEntry.deletedAt || remoteEntry).getTime();
          const localEntry = locDeletedMap.get(String(id));
          if (!localEntry || remoteTime > new Date(localEntry.deletedAt).getTime()) {
            locDeletedMap.set(String(id), typeof remoteEntry === 'object' ? remoteEntry : { deletedAt: remoteEntry });
            changed = true;
          }
        });
        if (changed) {
          saveDeletedTaskMap(locDeletedMap);
        }
      }

      // クラウド側のハビット Tombstone をローカル台帳へ合流
      if (cloudMeta.deletedHabits && typeof cloudMeta.deletedHabits === 'object') {
        const locDeletedHabitMap = loadDeletedHabitMap();
        let habitChanged = false;
        Object.keys(cloudMeta.deletedHabits).forEach(id => {
          const remoteEntry = cloudMeta.deletedHabits[id];
          if (!remoteEntry) return;
          const remoteTime = new Date(remoteEntry.deletedAt || remoteEntry).getTime();
          const localEntry = locDeletedHabitMap.get(String(id));
          if (!localEntry || remoteTime > new Date(localEntry.deletedAt).getTime()) {
            locDeletedHabitMap.set(String(id), typeof remoteEntry === 'object' ? remoteEntry : { deletedAt: remoteEntry });
            habitChanged = true;
          }
        });
        if (habitChanged) {
          saveDeletedHabitMap(locDeletedHabitMap);
        }
      }

      // フェッチ通信中にローカル操作（ハビット完了やタスク追加等）が発生していた場合:
      // 受信した古いデータでローカルを上書きせず、ローカル最新を最優先でディープマージし即時プッシュへフォワード
      if (hasPendingPush) {
        if (Array.isArray(cloudData.tasks)) {
          state.tasks = mergeTasksDeep(state.tasks, cloudData.tasks);
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
        }
        if (Array.isArray(cloudData.habits)) {
          state.habits = mergeHabitsDeep(state.habits, cloudData.habits);
          localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(state.habits));
        }
        if (typeof renderApp === 'function') {
          renderApp();
        }
        return;
      }

      const cloudTime = new Date(cloudMeta.lastUpdatedAt || 0).getTime();
      const localTime = new Date(localMeta.lastUpdatedAt || 0).getTime();

      // 安全化された同期判定:
      // ローカルが完全に空（0件）の場合は復旧
      const localIsEmpty = !state.tasks || state.tasks.length === 0;
      const hasMissingLocalTasks = Array.isArray(cloudData.tasks) && (!state.tasks || state.tasks.length < cloudData.tasks.length);

      // 防衛ガード: localTime > cloudTime の場合、直近でローカル操作（タスク削除等）が行われておりローカルが最新。
      // hasMissingLocalTasks だけを理由に古いクラウドデータでローカルを強制上書き・逆流させない！
      const shouldPull = forceApply || cloudTime > localTime || !localMeta.lastUpdatedAt || localIsEmpty || (hasMissingLocalTasks && localTime <= cloudTime);

      if (shouldPull) {
        if (Array.isArray(cloudData.tasks)) {
          state.tasks = mergeTasksDeep(state.tasks, cloudData.tasks);
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
        }
        if (Array.isArray(cloudData.habits)) {
          state.habits = mergeHabitsDeep(state.habits, cloudData.habits);
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
        const cloudPresets = Array.isArray(cloudData.taskPresets) ? cloudData.taskPresets : [];
        const mergedPresets = mergeTaskPresetsDeep(state.taskPresets, cloudPresets);
        state.taskPresets = mergedPresets;
        localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(state.taskPresets));

        // クラウド側が古いサンプル（6件以下）または定番実用プリセットが欠落していた場合、
        // マージ後の完全なプリセットをクラウドへ即座にプッシュバックしてクラウドのマスターを恒久最新化
        if (cloudPresets.length < mergedPresets.length) {
          setTimeout(() => {
            pushDataToCloud();
          }, 500);
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
    if (hasPendingPush) {
      hasPendingPush = false;
      setTimeout(() => {
        pushDataToCloud();
      }, 100);
    }
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

