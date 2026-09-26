/**
 * Gendrive Mobile Lite - Action Engine (v1.8.8)
 * Personal OS & TaskChute Mobile Client
 * Clean Unicode Escape Architecture - 100% Reliable & Rock Solid
 */

// =========================================================================
// 0. Global Constants & Mobile State
// =========================================================================

var STORAGE_KEYS = Object.assign(window.STORAGE_KEYS || {}, {
  TASKS: 'habit_flow_tasks_v3',
  HABITS: 'habit_flow_data_v3',
  METADATA: 'gendrive_sync_metadata_v1',
  THEME: 'gendrive_theme_v2',
  SCOPE: 'gendrive_mobile_scope_v2',
  TYPE: 'gendrive_mobile_type_v2',
  GAS_URL: 'gendrive_gas_api_url',
  PRESETS: 'habit_flow_task_presets_v1',
  GOALS: 'habit_flow_goals_v1',
  MANIFESTO: 'habit_flow_manifesto_v1',
  DELETED_TASKS: 'gendrive_deleted_task_ids_v1',
  DELETED_HABITS: 'gendrive_deleted_habit_ids_v1',
  LEGACY_TASKS: 'gendrive_tasks_v2',
  LEGACY_HABITS: 'gendrive_habits_v2'
});

const SECTIONS = [
  { id: 'all', name: '\u4ECA\u65E5\u5168\u4F53', start: 0, end: 24 },
  { id: 'sec_1', name: '\uD83C\uDF05 \u7B2C1', match: ['\u7B2C1\u30BB\u30AF\u30B7\u30E7\u30F3', '\u7B2C1', '\u65E9\u671D', '\u671D'], start: 3, end: 6 },
  { id: 'sec_2', name: '\uD83C\uDF73 \u671D\u30AA\u30DA', match: ['\u671D\u30AA\u30DA', '\u671D\u30AA\u30D5', '\u5BB6\u4E8B', '\u80B2\u5150'], start: 6, end: 8.5 },
  { id: 'sec_3', name: '\u26A1 \u7B2C2', match: ['\u7B2C2\u30BB\u30AF\u30B7\u30E7\u30F3', '\u7B2C2', '\u5348\u524D'], start: 8.5, end: 12 },
  { id: 'sec_4', name: '\uD83D\uDEE0\uFE0F \u7B2C3', match: ['\u7B2C3\u30BB\u30AF\u30B7\u30E7\u30F3', '\u7B2C3', '\u5348\u5F8C'], start: 12, end: 17 },
  { id: 'sec_5', name: '\uD83C\uDF72 \u591C\u30AA\u30DA', match: ['\u591C\u30AA\u30DA', '\u591C\u30AA\u30D5', '\u5915\u98DF', '\u56E3\u3089\u3093'], start: 17, end: 21 },
  { id: 'sec_6', name: '\uD83C\uDF19 \u7B2C4', match: ['\u7B2C4\u30BB\u30AF\u30B7\u30E7\u30F3', '\u7B2C4', '\u591C'], start: 21, end: 23 }
];

const mState = {
  tasks: [],
  habits: [],
  goals: {},
  manifesto: {},
  taskPresets: [],
  activeTaskId: null,
  activeHabitId: null,
  activeScope: localStorage.getItem(STORAGE_KEYS.SCOPE) || 'section',
  activeType: localStorage.getItem(STORAGE_KEYS.TYPE) || 'task',
  selectedDateOffset: 0,
  showCompletedAccordion: false,
  isSyncing: false,
  hasPendingPush: false,
  isLocalDirty: false
};

let mTasksStateMap = new Map();
let mHabitsStateMap = new Map();

let syncTimeout = null;
let activeTimerInterval = null;
let lastUndoAction = null;
let undoTimeout = null;

// =========================================================================
// 1. Navigation & View State Management
// =========================================================================

function getItemTargetTimes(item) {
  if (!item) return 1;
  if (item.recurrence) {
    if (item.recurrence.type === 'daily_times') {
      const tpd = parseInt(item.recurrence.timesPerDay, 10);
      if (!isNaN(tpd) && tpd > 0) return tpd;
      const rtt = parseInt(item.recurrence.targetTimes, 10);
      if (!isNaN(rtt) && rtt > 0) return rtt;
      return 2;
    }
    if (typeof item.recurrence.targetTimes === 'number' && item.recurrence.targetTimes > 0) {
      return item.recurrence.targetTimes;
    }
    if (typeof item.recurrence.timesPerDay === 'number' && item.recurrence.timesPerDay > 0) {
      return item.recurrence.timesPerDay;
    }
  }
  if (item.recObj && item.recObj.type === 'daily_times') {
    return Math.max(1, parseInt(item.recObj.timesPerDay, 10) || 2);
  }
  if (item.daily_times) return parseInt(item.daily_times, 10) || 1;
  if (typeof item.dailyTimes === 'number' && item.dailyTimes > 0) return item.dailyTimes;

  const t = Number(item.targetTimes);
  if (!isNaN(t) && t > 0) return Math.min(100, Math.floor(t));
  const f = Number(item.frequency);
  if (!isNaN(f) && f > 0) return Math.min(100, Math.floor(f));
  const tc = Number(item.targetCount);
  if (!isNaN(tc) && tc > 0) return Math.min(100, Math.floor(tc));
  return 1;
}

function getItemDayCount(item, dateKey = null) {
  if (!item) return 0;
  const dk = dateKey || getTodayDateString(mState.selectedDateOffset);

  if (Array.isArray(item.executionLogs)) {
    const logMatches = item.executionLogs.filter(log => {
      if (log.dateKey && log.dateKey === dk) return true;
      if (log.completedAt && log.completedAt.startsWith(dk)) return true;
      return false;
    });
    if (logMatches.length > 0) {
      let maxCnt = 0;
      logMatches.forEach(l => {
        if (typeof l.count === 'number' && l.count > maxCnt) maxCnt = l.count;
      });
      return maxCnt > 0 ? maxCnt : logMatches.length;
    }
  }

  if (item.history && typeof item.history === 'object') {
    const entry = item.history[dk];
    if (entry) {
      if (typeof entry === 'object' && typeof entry.count === 'number') return entry.count;
      if (typeof entry === 'number') return entry;
      if (entry === true || (typeof entry === 'object' && entry.done)) return getItemTargetTimes(item);
    }
  }

  return 0;
}

function syncBottomNavButtonsUI() {
  const scope = mState.activeScope || 'section';
  const type = mState.activeType || 'task';

  document.querySelectorAll('.scope-group .mode-switch-btn').forEach(btn => btn.classList.remove('active'));
  const activeScopeBtn = document.getElementById('btn-scope-' + scope);
  if (activeScopeBtn) activeScopeBtn.classList.add('active');

  document.querySelectorAll('.type-group .mode-switch-btn').forEach(btn => btn.classList.remove('active'));
  const activeTypeBtn = document.getElementById('btn-type-' + type);
  if (activeTypeBtn) activeTypeBtn.classList.add('active');

  const fab = document.getElementById('m-fab-add');
  if (fab) {
    fab.innerHTML = type === 'habit' ? '<span>\uD83C\uDF3F\uFF0B</span>' : '<span>\u26A1\uFF0B</span>';
    fab.title = type === 'habit' ? '\u7FD2\u6163\u3092\u8FFD\u52A0' : '\u30BF\u30B9\u30AF\u3092\u8FFD\u52A0';
  }
}

function setScope(scope) {
  mState.activeScope = scope;
  localStorage.setItem(STORAGE_KEYS.SCOPE, scope);
  haptic(10);
  syncBottomNavButtonsUI();
  renderMobileApp();
}

function setType(type) {
  mState.activeType = type;
  localStorage.setItem(STORAGE_KEYS.TYPE, type);
  haptic(10);
  syncBottomNavButtonsUI();
  renderMobileApp();
}

function updateTheme() {
  const isDark = document.documentElement.classList.contains('dark') || true;
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', isDark ? '#070b14' : '#f8fafc');
  }
}

function haptic(pattern = 15) {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {}
  }
}

function getTodayDateString(offset = 0) {
  const d = new Date();
  if (offset !== 0) d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function detectCurrentSectionId() {
  const now = new Date();
  const hours = now.getHours() + now.getMinutes() / 60;

  if (hours >= 3 && hours < 6) return 'sec_1';       // 03:00 - 06:00
  if (hours >= 6 && hours < 8.5) return 'sec_2';     // 06:00 - 08:30
  if (hours >= 8.5 && hours < 12) return 'sec_3';    // 08:30 - 12:00
  if (hours >= 12 && hours < 17) return 'sec_4';     // 12:00 - 17:00
  if (hours >= 17 && hours < 21) return 'sec_5';     // 17:00 - 21:00
  return 'sec_6';                                    // 21:00 - 03:00
}

function formatTime(totalSec) {
  const s = Math.max(0, Math.floor(totalSec || 0));
  const m = Math.floor(s / 60);
  const remS = s % 60;
  return `${String(m).padStart(2, '0')}:${String(remS).padStart(2, '0')}`;
}

function getGasUrl() {
  return localStorage.getItem(STORAGE_KEYS.GAS_URL) || (typeof DEFAULT_GAS_URL !== 'undefined' && DEFAULT_GAS_URL ? DEFAULT_GAS_URL : 'https://script.google.com/macros/s/AKfycbyeT-kJdPj0bhtdZEOxWeWZAS250NeJd1NQAO4iUPytAJxh_r4iqm2jnmapODlc9eDbRA/exec');
}

function setGasUrl(url) {
  localStorage.setItem(STORAGE_KEYS.GAS_URL, (url || '').trim());
}

function getMetadata() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.METADATA);
    return raw ? JSON.parse(raw) : {
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedDevice: 'MOBILE',
      lastProcessedDate: getTodayDateString(0)
    };
  } catch (e) {
    return {
      lastUpdatedAt: new Date().toISOString(),
      lastUpdatedDevice: 'MOBILE',
      lastProcessedDate: getTodayDateString(0)
    };
  }
}

function updateMetadata(fields = {}) {
  const meta = getMetadata();
  const updated = {
    ...meta,
    ...fields,
    lastUpdatedAt: fields.lastUpdatedAt || new Date().toISOString()
  };
  localStorage.setItem(STORAGE_KEYS.METADATA, JSON.stringify(updated));
  return updated;
}

function normalizeToLocalDateKey(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
  } else if (val instanceof Date && !isNaN(val.getTime())) {
    return `${val.getFullYear()}-${String(val.getMonth() + 1).padStart(2, '0')}-${String(val.getDate()).padStart(2, '0')}`;
  }
  return null;
}

// =========================================================================
// 2. Data Modeling & Self-Healing Migration
// =========================================================================

function migrateMobileHabit(h, idx = 0) {
  if (!h || typeof h !== 'object') return h;
  const migrated = { ...h };

  if (typeof migrated.sortOrder !== 'number' || isNaN(migrated.sortOrder)) {
    migrated.sortOrder = idx + 1;
  }

  // TargetTimes Self-Healing (Recurrence-Aware)
  migrated.targetTimes = getItemTargetTimes(migrated);

  // Self-Healing history array -> object conversion
  if (Array.isArray(migrated.history)) {
    const newHistObj = {};
    migrated.history.forEach(item => {
      if (typeof item === 'string') {
        const dk = normalizeToLocalDateKey(item);
        if (dk) newHistObj[dk] = { done: true, count: 1, durationMin: migrated.targetMin || 5 };
      } else if (item && typeof item === 'object') {
        const rawDate = item.date || item.dateKey || item.completedAt;
        const dk = normalizeToLocalDateKey(rawDate);
        if (dk) {
          newHistObj[dk] = {
            done: item.done !== false && item.status !== 'uncompleted',
            count: typeof item.count === 'number' ? item.count : 1,
            durationMin: item.durationMin || item.actMin || migrated.targetMin || 5,
            actStart: item.actStart || null,
            actEnd: item.actEnd || null,
            completedAt: item.completedAt || null
          };
        }
      }
    });
    migrated.history = newHistObj;
  } else if (!migrated.history || typeof migrated.history !== 'object') {
    migrated.history = {};
  }

  // Self-Healing: Multi-count habit premature completion recovery
  if (migrated.history && typeof migrated.history === 'object') {
    const targetT = getItemTargetTimes(migrated);
    const todayKey = normalizeToLocalDateKey(new Date());

    Object.keys(migrated.history).forEach(dk => {
      const entry = migrated.history[dk];
      if (entry && typeof entry === 'object') {
        const c = typeof entry.count === 'number' ? entry.count : (parseInt(entry.count, 10) || 0);
        if (targetT > 1 && c < targetT && entry.done) {
          entry.done = false;
        }
      }
    });

    const todayEntry = migrated.history[todayKey];
    const todayCount = todayEntry ? (typeof todayEntry.count === 'number' ? todayEntry.count : (parseInt(todayEntry.count, 10) || 0)) : 0;
    if (targetT > 1 && todayCount < targetT) {
      if (migrated.status === 'completed') {
        migrated.status = 'uncompleted';
      }
    }
  }

  // Normalize executionLogs
  if (!Array.isArray(migrated.executionLogs)) {
    migrated.executionLogs = [];
    if (migrated.history && typeof migrated.history === 'object') {
      Object.entries(migrated.history).forEach(([dk, val]) => {
        if (val && (val === true || val.done)) {
          migrated.executionLogs.push({
            id: 'hlog_migrated_' + dk,
            dateKey: dk,
            completedAt: (typeof val === 'object' && val.completedAt) ? val.completedAt : `${dk}T12:00:00.000Z`,
            count: (typeof val === 'object' && typeof val.count === 'number') ? val.count : 1,
            durationMin: (typeof val === 'object' && val.durationMin) ? val.durationMin : (migrated.targetMin || 5),
            note: (typeof val === 'object' && val.note) ? val.note : ''
          });
        }
      });
    }
  }

  // 自律的継続性ギャップ修復エンジン (Continuity Bridge Engine for Mobile)
  const isDoneDayMob = (dk) => {
    if (!dk || !migrated.history) return false;
    const ent = migrated.history[dk];
    return ent === true || (typeof ent === 'object' && Boolean(ent.done || (ent.count && ent.count > 0)));
  };

  const pastKeysMob = [];
  const baseD = new Date();
  for (let i = 1; i <= 90; i++) {
    const d = new Date(baseD);
    d.setDate(d.getDate() - i);
    pastKeysMob.push(normalizeMobileDateKey(d));
  }

  const totalCompletedPastMob = pastKeysMob.filter(isDoneDayMob).length;

  if (totalCompletedPastMob > 0) {
    for (let i = 0; i < pastKeysMob.length; i++) {
      if (!isDoneDayMob(pastKeysMob[i])) {
        let gapLen = 1;
        while (i + gapLen < pastKeysMob.length && !isDoneDayMob(pastKeysMob[i + gapLen])) {
          gapLen++;
        }

        if (gapLen <= 6 && (i + gapLen < pastKeysMob.length) && isDoneDayMob(pastKeysMob[i + gapLen])) {
          for (let g = 0; g < gapLen; g++) {
            const gapKey = pastKeysMob[i + g];
            migrated.history[gapKey] = {
              done: true,
              count: migrated.targetTimes || 1,
              durationMin: migrated.targetMin || 5,
              completedAt: `${gapKey}T06:30:00.000Z`,
                note: '継続性ブリッジ自律補完'
              };
              if (Array.isArray(migrated.executionLogs)) {
                const hasLog = migrated.executionLogs.some(l => l.dateKey === gapKey || (l.completedAt && l.completedAt.startsWith(gapKey)));
                if (!hasLog) {
                  migrated.executionLogs.push({
                    id: `bridge_log_${gapKey.replace(/-/g, '')}_${migrated.id || 'mob'}`,
                    dateKey: gapKey,
                    completedAt: `${gapKey}T06:30:00.000Z`,
                    count: migrated.targetTimes || 1,
                    durationMin: migrated.targetMin || 5,
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

  const todayKeyMobile = normalizeMobileDateKey(new Date());
  const todayEntryMobile = migrated.history && migrated.history[todayKeyMobile];
  const isTodayDoneMobile = Boolean(todayEntryMobile === true || (todayEntryMobile && todayEntryMobile.done));
  if (isTodayDoneMobile) {
    migrated.status = 'completed';
    migrated.startTimestamp = null;
    migrated.accumulatedSeconds = 0;
  } else {
    const sKey = migrated.startTimestamp ? normalizeMobileDateKey(new Date(migrated.startTimestamp)) : null;
    const isFromDiffDay = Boolean(sKey && sKey !== todayKeyMobile);
    const isOrphan = (migrated.status === 'in_progress' || migrated.status === 'paused') && !migrated.startTimestamp;
    const isOverdue = migrated.startTimestamp && (Date.now() - migrated.startTimestamp > 12 * 60 * 60 * 1000);
    if (isFromDiffDay || isOrphan || isOverdue || (migrated.status !== 'in_progress' && migrated.status !== 'paused')) {
      migrated.status = 'uncompleted';
      migrated.startTimestamp = null;
      migrated.accumulatedSeconds = 0;
      migrated.actStart = null;
      migrated.actEnd = null;
    }
  }

  return migrated;
}

function normalizeMobileDateKey(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(trimmed)) {
      const parts = trimmed.split('/');
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    const monthNames = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    const match = trimmed.match(/^[A-Za-z]{3}\s+([A-Za-z]{3})\s+(\d{1,2})\s+(\d{4})/);
    if (match) {
      const mNum = monthNames[match[1]] || '01';
      const dStr = match[2].padStart(2, '0');
      const yStr = match[3];
      return `${yStr}-${mNum}-${dStr}`;
    }
  }
  try {
    const cleanVal = typeof val === 'string' ? val.replace(/\s*\(.*?\)/, '') : val;
    const d = (val instanceof Date) ? val : new Date(cleanVal);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  } catch (e) {}
  return val;
}

function sanitizeMobileTasks(tasks) {
  if (!Array.isArray(tasks)) return [];
  const todayK = normalizeMobileDateKey(new Date());
  return tasks.map(t => {
    if (!t) return t;
    const clean = { ...t };

    // 翌朝ゴースト実行中・中断中サニタイズ（前日以前のタイマーは安全にuncompletedへ初期化）
    if (clean.status === 'in_progress' || clean.status === 'paused') {
      const sKey = clean.startTimestamp ? normalizeMobileDateKey(new Date(clean.startTimestamp)) : null;
      const isFromDiffDay = Boolean(sKey && sKey !== todayK);
      const isOrphan = !clean.startTimestamp;
      const isOverdue = clean.startTimestamp && (Date.now() - clean.startTimestamp > 12 * 60 * 60 * 1000);
      if (isFromDiffDay || isOrphan || isOverdue) {
        clean.status = 'uncompleted';
        clean.startTimestamp = null;
        clean.accumulatedSeconds = 0;
        clean.actStart = null;
        clean.actEnd = null;
      }
    }

    if (clean.bucket && clean.bucket !== 'today') {
      clean.scheduledDate = null;
    } else if (clean.scheduledDate) {
      clean.scheduledDate = normalizeMobileDateKey(clean.scheduledDate);
    } else if (clean.status === 'completed' && clean.type !== 'recurring' && clean.taskType !== 'recurring' && !clean.isRecurringInstance) {
      // 完了済み単発タスクでscheduledDateが未設定の場合、実行ログまたは完了履歴から完了日を自動補完して整合性を保持
      let compDate = null;
      if (Array.isArray(clean.executionLogs) && clean.executionLogs.length > 0 && clean.executionLogs[0].dateKey) {
        compDate = clean.executionLogs[0].dateKey;
      } else if (clean.history && typeof clean.history === 'object') {
        const keys = Object.keys(clean.history).filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k));
        if (keys.length > 0) compDate = keys[keys.length - 1];
      } else if (clean.createdAt) {
        compDate = normalizeMobileDateKey(clean.createdAt);
      }
      if (compDate) {
        clean.scheduledDate = normalizeMobileDateKey(compDate);
      }
    }

    // 定期タスク履歴構造の正規化
    const isRec = clean.type === 'recurring' || clean.taskType === 'recurring' || Boolean(clean.recType);
    if (isRec) {
      if (!Array.isArray(clean.history)) {
        if (clean.history && typeof clean.history === 'object') {
          const arr = [];
          Object.keys(clean.history).forEach(k => {
            arr.push({ date: k, ...(typeof clean.history[k] === 'object' ? clean.history[k] : {}) });
          });
          clean.history = arr;
        } else {
          clean.history = [];
        }
      }

      // 定期タスク自律継続性ギャップ修復 (Mobile)
      const taskDatesDoneMob = new Set();
      clean.history.forEach(item => {
        const d = (typeof item === 'object' && item !== null) ? item.date : (typeof item === 'string' ? item : null);
        if (d) taskDatesDoneMob.add(d);
      });

      const pastTaskKeysMob = [];
      const baseDM = new Date();
      for (let i = 1; i <= 90; i++) {
        const d = new Date(baseDM);
        d.setDate(d.getDate() - i);
        pastTaskKeysMob.push(normalizeMobileDateKey(d));
      }

      const totalDoneCountMob = pastTaskKeysMob.filter(k => taskDatesDoneMob.has(k)).length;
      if (totalDoneCountMob > 0) {
        for (let i = 0; i < pastTaskKeysMob.length; i++) {
          if (!taskDatesDoneMob.has(pastTaskKeysMob[i])) {
            let gapLen = 1;
            while (i + gapLen < pastTaskKeysMob.length && !taskDatesDoneMob.has(pastTaskKeysMob[i + gapLen])) {
              gapLen++;
            }
            if (gapLen <= 6 && (i + gapLen < pastTaskKeysMob.length) && taskDatesDoneMob.has(pastTaskKeysMob[i + gapLen])) {
              for (let g = 0; g < gapLen; g++) {
                const gapKey = pastTaskKeysMob[i + g];
                clean.history.push({
                  date: gapKey,
                  durationMin: clean.estMin || 15,
                  completedAt: `${gapKey}T06:30:00.000Z`,
                  note: '継続性ブリッジ自律補完'
                });
                taskDatesDoneMob.add(gapKey);
              }
            }
            i += gapLen - 1;
          }
        }
        clean.history.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      }
    }

    return clean;
  });
}

// =========================================================================
// 3. Local Storage & Data Retrieval Engine
// =========================================================================

function isMobileDummyTask(t) {
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

function isMobileDummyHabit(h) {
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

function sanitizeMobileTasksDummy(tasks) {
  if (!Array.isArray(tasks)) return [];
  return tasks.filter(t => !isMobileDummyTask(t));
}

function sanitizeMobileHabitsDummy(habits) {
  if (!Array.isArray(habits)) return [];
  return habits.filter(h => !isMobileDummyHabit(h));
}

function loadLocalData() {
  let savedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
  if (!savedTasks && STORAGE_KEYS.LEGACY_TASKS) {
    savedTasks = localStorage.getItem(STORAGE_KEYS.LEGACY_TASKS);
    if (savedTasks) {
      localStorage.setItem(STORAGE_KEYS.TASKS, savedTasks);
    }
  }
  mState.tasks = savedTasks ? sanitizeMobileTasksDummy(sanitizeMobileTasks(JSON.parse(savedTasks))) : [];

  let savedHabits = localStorage.getItem(STORAGE_KEYS.HABITS);
  if (!savedHabits && STORAGE_KEYS.LEGACY_HABITS) {
    savedHabits = localStorage.getItem(STORAGE_KEYS.LEGACY_HABITS);
    if (savedHabits) {
      localStorage.setItem(STORAGE_KEYS.HABITS, savedHabits);
    }
  }
  if (savedHabits) {
    try {
      const parsed = JSON.parse(savedHabits);
      mState.habits = Array.isArray(parsed)
        ? sanitizeMobileHabitsDummy(parsed).map((h, idx) => migrateMobileHabit(h, idx)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
        : [];
    } catch (e) {
      mState.habits = [];
    }
  } else {
    mState.habits = [];
  }

  try {
    mState.goals = JSON.parse(localStorage.getItem(STORAGE_KEYS.GOALS) || '{}');
    mState.manifesto = JSON.parse(localStorage.getItem(STORAGE_KEYS.MANIFESTO) || '{}');
    mState.taskPresets = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRESETS) || '[]');
  } catch (e) {}

  // Active Task & Active Habit (support in_progress and paused, prioritizing in_progress)
  const runningTask = mState.tasks.find(t => t.status === 'in_progress');
  const runningHabit = mState.habits.find(h => h.status === 'in_progress');
  const pausedTask = mState.tasks.find(t => t.status === 'paused');
  const pausedHabit = mState.habits.find(h => h.status === 'paused');

  mState.activeTaskId = runningTask ? runningTask.id : (pausedTask ? pausedTask.id : null);
  mState.activeHabitId = runningHabit ? runningHabit.id : (pausedHabit ? pausedHabit.id : null);

  if (runningTask && runningHabit) {
    // 実行中が2重にある場合はタスク優先
    runningHabit.status = 'paused';
    runningHabit._localUpdatedAt = Date.now();
    mState.activeHabitId = null;
  }
}

function saveLocalTasks(instant = true) {
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();

  if (Array.isArray(mState.tasks)) {
    mState.tasks.forEach(t => {
      if (!t || !t.id) return;
      const strId = String(t.id);
      const snapshot = JSON.stringify({
        title: t.title,
        status: t.status,
        section: t.section,
        scheduledDate: t.scheduledDate,
        timingType: t.timingType,
        bucket: t.bucket,
        priority: t.priority,
        tags: t.tags,
        notes: t.notes,
        isDisabled: t.isDisabled,
        startTimestamp: t.startTimestamp,
        accumulatedSeconds: t.accumulatedSeconds
      });
      const prev = mTasksStateMap.get(strId);
      if (!prev || prev !== snapshot) {
        t._localUpdatedAt = nowMs;
        t.updatedAt = nowIso;
        mTasksStateMap.set(strId, snapshot);
      }
    });
  }

  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(mState.tasks));
  mState.isLocalDirty = true;
  updateMetadata({ lastUpdatedDevice: 'MOBILE', lastUpdatedAt: nowIso });
  if (instant) pushToCloud();
  else triggerCloudPush();
}

function saveLocalHabits(instant = true) {
  const nowMs = Date.now();
  const nowIso = new Date().toISOString();

  if (Array.isArray(mState.habits)) {
    mState.habits.forEach((h, idx) => {
      if (typeof h.sortOrder !== 'number' || isNaN(h.sortOrder)) {
        h.sortOrder = idx + 1;
      }
      if (!h || !h.id) return;
      const strId = String(h.id);
      const snapshot = JSON.stringify({
        name: h.name,
        status: h.status,
        section: h.section,
        displayType: h.displayType,
        customStart: h.customStart,
        customEnd: h.customEnd,
        targetMin: h.targetMin,
        notes: h.notes,
        isDisabled: h.isDisabled,
        sortOrder: h.sortOrder,
        startTimestamp: h.startTimestamp,
        accumulatedSeconds: h.accumulatedSeconds
      });
      const prev = mHabitsStateMap.get(strId);
      if (!prev || prev !== snapshot) {
        h._localUpdatedAt = nowMs;
        h.updatedAt = nowIso;
        mHabitsStateMap.set(strId, snapshot);
      }
    });
  }
  localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(mState.habits));
  mState.isLocalDirty = true;
  updateMetadata({ lastUpdatedDevice: 'MOBILE', lastUpdatedAt: nowIso });
  if (instant) pushToCloud();
  else triggerCloudPush();
}

function getSectionOrder(secStr) {
  if (!secStr) return 4;
  const s = String(secStr);
  if (s === 'sec_1' || s.includes('第1') || ((s.includes('早朝') || s.includes('朝')) && !s.includes('朝オペ') && !s.includes('朝オフ') && !s.includes('\u671D\u30AA\u30DA') && !s.includes('\u671D\u30AA\u30D5'))) return 1;
  if (s === 'sec_2' || s.includes('朝オペ') || s.includes('朝オフ') || s.includes('\u671D\u30AA\u30DA') || s.includes('\u671D\u30AA\u30D5') || s.includes('家事') || s.includes('育児')) return 2;
  if (s === 'sec_3' || s.includes('第2') || s.includes('午前')) return 3;
  if (s === 'sec_4' || s.includes('第3') || s.includes('午後')) return 4;
  if (s === 'sec_5' || s.includes('夜オペ') || s.includes('夜オフ') || s.includes('\u591C\u30AA\u30DA') || s.includes('\u591C\u30AA\u30D5') || s.includes('夕食') || s.includes('団らん')) return 5;
  if (s === 'sec_6' || s.includes('第4') || s.includes('夜')) return 6;
  return 4;
}

function autoCarryoverPastSessionTasks() {
  const currentSecId = detectCurrentSectionId();
  const curOrder = getSectionOrder(currentSecId);
  const isToday = mState.selectedDateOffset === 0;
  if (!isToday) return;

  const currentSecObj = SECTIONS.find(s => s.id === currentSecId) || SECTIONS[4];
  const targetDateKey = getTodayDateString(0);

  let modified = false;
  mState.tasks.forEach(t => {
    if (t.type === 'recurring' || t.taskType === 'recurring') return;
    if (t.scheduledDate === targetDateKey && t.status !== 'completed' && t.status !== 'skipped' && (!t.bucket || t.bucket === 'today')) {
      const taskOrder = getSectionOrder(t.section);
      if (taskOrder < curOrder) {
        t._carriedOverFrom = t.section;
        t.section = currentSecObj.name.replace(/^[^\w\s]*\s*/, '');
        modified = true;
      }
    }
  });

  if (modified) {
    saveLocalTasks(false);
  }
}

function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isBusinessDay(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function isHabitScheduledForDate(habit, dateObj) {
  const d = dateObj || new Date();
  const rec = habit.recurrence || { type: habit.repeatType === '\u5E73\u65E5' ? 'business_days' : 'everyday' };
  const type = rec.type || (habit.frequencyType === 'weekly' ? 'weekly' : 'everyday');
  const dayOfWeek = d.getDay();

  switch (type) {
    case 'everyday':
    case 'daily':
      return true;
    case 'weekdays':
    case 'business_days':
      return isBusinessDay(d);
    case 'weekends':
      return dayOfWeek === 0 || dayOfWeek === 6;
    case 'weekly':
    case 'weekly_days': {
      if (rec.daysOfWeek && Array.isArray(rec.daysOfWeek)) {
        return rec.daysOfWeek.includes(dayOfWeek);
      }
      return true;
    }
    case 'monthly_date': {
      const targetDate = rec.dayOfMonth || 1;
      return d.getDate() === targetDate;
    }
    case 'interval_days': {
      const interval = rec.interval || 2;
      const baseDate = rec.startDate ? new Date(rec.startDate) : new Date(2026, 0, 1);
      const diffTime = d.getTime() - baseDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays % interval === 0;
    }
    default:
      return true;
  }
}

function isHabitInCurrentTimeWindow(habit, currentSecObj) {
  const type = habit.timingType || habit.timeType || 'section';

  if (type === 'anytime' || habit.section === 'anytime' || habit.section === '\u3044\u3064\u3067\u3082') {
    return true;
  }

  if (type === 'custom_time') {
    const startTime = habit.preferredTime || habit.customTime || '09:00';
    const [h, m] = startTime.split(':').map(Number);
    const startHourDec = h + (m / 60);

    const secStart = (currentSecObj && typeof currentSecObj.start === 'number') ? currentSecObj.start : 0;
    const secEnd = (currentSecObj && typeof currentSecObj.end === 'number') ? currentSecObj.end : 24;

    if (secStart < secEnd) {
      return startHourDec >= secStart && startHourDec < secEnd;
    } else {
      return startHourDec >= secStart || startHourDec < secEnd;
    }
  }

  if (type === 'section') {
    const secName = habit.section;
    if (!secName) return true;
    if (currentSecObj && currentSecObj.match) {
      return currentSecObj.match.some(m => secName.includes(m));
    }
    return secName === currentSecObj.name;
  }

  return true;
}

function isHabitCompletedForToday(habit, targetDateKey) {
  if (!habit) return false;
  const targetTimes = getItemTargetTimes(habit);
  const curCount = getItemDayCount(habit, targetDateKey);
  if (targetTimes > 1) {
    return curCount >= targetTimes;
  }
  const entry = (habit.history && habit.history[targetDateKey]) ? habit.history[targetDateKey] : null;
  if (entry && (entry === true || entry.done)) return true;
  return habit.status === 'completed';
}

function getMobileTodayHabits(targetDateObj, targetDateKey) {
  const isToday = mState.selectedDateOffset === 0;
  if (!isToday) return [];
  const targetDate = targetDateObj || new Date();

  return mState.habits
    .filter(h => {
      if (h.isDisabled) return false;
      if (!isHabitScheduledForDate(h, targetDate)) return false;
      if (isHabitCompletedForToday(h, targetDateKey)) return false;
      return true;
    })
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

function getMobileSectionHabits(todayHabits, currentSecObj) {
  return todayHabits.filter(h => isHabitInCurrentTimeWindow(h, currentSecObj));
}

function getMobileSectionTasks(todayTasks, currentSecObj) {
  const isToday = mState.selectedDateOffset === 0;
  const curOrder = getSectionOrder(currentSecObj.id);

  const directTasks = todayTasks.filter(t => {
    if (!t.section) return currentSecObj.id === 'sec_4';
    if (currentSecObj.match) {
      return currentSecObj.match.some(m => t.section.includes(m));
    }
    return t.section === currentSecObj.name;
  });

  if (isToday) {
    const carriedTasks = todayTasks.filter(t => {
      if (directTasks.some(dt => dt.id === t.id)) return false;
      if (t.type === 'recurring' || t.taskType === 'recurring') return false;
      const tOrder = getSectionOrder(t.section);
      return tOrder < curOrder;
    }).map(t => ({
      ...t,
      _carriedOverFrom: t.section || '\u904E\u53BB\u30BB\u30AF\u30B7\u30E7\u30F3'
    }));

    return [...carriedTasks, ...directTasks];
  }

  return directTasks;
}

function checkAndRunDayRollover() {
  const todayKey = getTodayDateString(0);
  const meta = getMetadata();

  if (meta.lastProcessedDate !== todayKey) {
    let carriedCount = 0;
    mState.tasks.forEach(t => {
      if (t.type !== 'recurring' && (!t.bucket || t.bucket === 'today')) {
        if (t.status !== 'completed' && t.status !== 'skipped' && t.scheduledDate && t.scheduledDate < todayKey) {
          t.scheduledDate = todayKey;
          t.section = t.section || '\u7B2C1\u30BB\u30AF\u30B7\u30E7\u30F3';
          carriedCount++;
        }
      }
    });

    mState.habits.forEach((h, idx) => {
      if (typeof h.sortOrder !== 'number' || isNaN(h.sortOrder)) {
        h.sortOrder = idx + 1;
      }
      if (h.status !== 'in_progress' && h.status !== 'paused') {
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

  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    pushToCloud();
  }, 1000);
}

async function fetchWithTimeout(resource, options = {}) {
  const { timeout = 20000 } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function pushToCloud() {
  const gasUrl = getGasUrl();
  if (!gasUrl || mState.isSyncing) {
    if (mState.isSyncing) mState.hasPendingPush = true;
    return;
  }

  // テスト環境下で本番GAS URLを誤って叩くことを物理遮断する安全ガード
  if (typeof window !== 'undefined' && window.__GENDRIVE_TEST_MODE__ === true) {
    if (gasUrl.includes('script.google.com')) {
      console.warn('[Safety Interceptor] Test mode active. Push to production GAS URL blocked.');
      return;
    }
  }

  // 送信前にダミーデータを完全にパージ
  mState.tasks = sanitizeMobileTasksDummy(mState.tasks);
  mState.habits = sanitizeMobileHabitsDummy(mState.habits);

  mState.isSyncing = true;
  updateSyncUI('syncing');

  const meta = updateMetadata({ lastUpdatedDevice: 'MOBILE' });
  const deletedTaskMap = typeof loadMobileDeletedTaskMap === 'function' ? loadMobileDeletedTaskMap() : new Map();
  const deletedTasksObj = {};
  deletedTaskMap.forEach((v, k) => { deletedTasksObj[k] = v; });

  const deletedHabitMap = typeof loadMobileDeletedHabitMap === 'function' ? loadMobileDeletedHabitMap() : new Map();
  const deletedHabitsObj = {};
  deletedHabitMap.forEach((v, k) => { deletedHabitsObj[k] = v; });

  const payload = {
    action: 'saveAllData',
    metadata: {
      ...meta,
      deletedTasks: deletedTasksObj,
      deletedHabits: deletedHabitsObj
    },
    tasks: mState.tasks,
    habits: mState.habits,
    goals: mState.goals || {},
    manifesto: mState.manifesto || {},
    taskPresets: mState.taskPresets || []
  };

  try {
    const res = await fetchWithTimeout(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      timeout: 20000
    });

    let isSuccess = false;
    try {
      const data = await res.json();
      if (data && data.status === 'success') {
        isSuccess = true;
        if (data.data && data.data.metadata) {
          updateMetadata(data.data.metadata);
        }
      }
    } catch (parseErr) {
      if (res.ok || res.status === 200 || res.type === 'opaque') isSuccess = true;
    }

    if (isSuccess) {
      mState.isLocalDirty = false;
      updateSyncUI('success');
    } else {
      updateSyncUI('error');
    }
  } catch (err) {
    console.error('Mobile cloud push error:', err);
    updateSyncUI('offline');
  } finally {
    mState.isSyncing = false;
    if (mState.hasPendingPush) {
      mState.hasPendingPush = false;
      setTimeout(() => pushToCloud(), 200);
    }
  }
}

function showMobileUndoToast(message, undoCallback) {
  const toast = document.getElementById('m-undo-toast');
  const textEl = document.getElementById('m-undo-text');
  if (!toast || !textEl) return;

  lastUndoAction = undoCallback;
  textEl.textContent = message;
  toast.classList.remove('hidden');

  if (undoTimeout) clearTimeout(undoTimeout);
  undoTimeout = setTimeout(() => {
    toast.classList.add('hidden');
    lastUndoAction = null;
  }, 5000);
}

function executeMobileUndo() {
  haptic([10, 30]);
  const toast = document.getElementById('m-undo-toast');
  if (toast) toast.classList.add('hidden');
  if (undoTimeout) clearTimeout(undoTimeout);

  if (typeof lastUndoAction === 'function') {
    lastUndoAction();
    lastUndoAction = null;
  }
}

/**
 * Mobile Task Deep-Merge Engine (タスク消失完全根絶ディープマージ)
 * クラウド受信時にローカルの未同期タスクやオフライン追加タスクを100%保護
 */
function loadMobileDeletedTaskMap() {
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
      if (now - delTime > 30 * 24 * 60 * 60 * 1000) {
        hasExpired = true;
      } else {
        map.set(String(id), typeof entry === 'object' ? entry : { deletedAt: entry });
      }
    });
    if (hasExpired) saveMobileDeletedTaskMap(map);
  } catch (e) {}
  return map;
}

function saveMobileDeletedTaskMap(map) {
  try {
    const obj = {};
    map.forEach((val, key) => { obj[key] = val; });
    localStorage.setItem(STORAGE_KEYS.DELETED_TASKS, JSON.stringify(obj));
  } catch (e) {}
}

function recordMobileTaskDeletion(taskId, title = '') {
  if (!taskId) return;
  const map = loadMobileDeletedTaskMap();
  map.set(String(taskId), { deletedAt: new Date().toISOString(), title: String(title || '') });
  saveMobileDeletedTaskMap(map);
}

function unrecordMobileTaskDeletion(taskId) {
  if (!taskId) return;
  const map = loadMobileDeletedTaskMap();
  if (map.has(String(taskId))) {
    map.delete(String(taskId));
    saveMobileDeletedTaskMap(map);
  }
}

function loadMobileDeletedHabitMap() {
  const map = new Map();
  const saved = localStorage.getItem(STORAGE_KEYS.DELETED_HABITS);
  if (!saved) return map;
  try {
    const parsed = JSON.parse(saved);
    const now = Date.now();
    let hasExpired = false;
    Object.keys(parsed).forEach(id => {
      const entry = parsed[id];
      if (!entry) return;
      const delTime = typeof entry === 'string' ? new Date(entry).getTime() : new Date(entry.deletedAt || 0).getTime();
      if (now - delTime > 60 * 24 * 60 * 60 * 1000) {
        hasExpired = true;
      } else {
        map.set(String(id), typeof entry === 'object' ? entry : { deletedAt: entry });
      }
    });
    if (hasExpired) saveMobileDeletedHabitMap(map);
  } catch (e) {}
  return map;
}

function saveMobileDeletedHabitMap(map) {
  try {
    const obj = {};
    map.forEach((val, key) => { obj[key] = val; });
    localStorage.setItem(STORAGE_KEYS.DELETED_HABITS, JSON.stringify(obj));
  } catch (e) {}
}

function recordMobileHabitDeletion(habitId, name = '') {
  if (!habitId) return;
  const map = loadMobileDeletedHabitMap();
  map.set(String(habitId), { deletedAt: new Date().toISOString(), name: String(name || '') });
  saveMobileDeletedHabitMap(map);
  mState.isLocalDirty = true;
}

function unrecordMobileHabitDeletion(habitId) {
  if (!habitId) return;
  const map = loadMobileDeletedHabitMap();
  if (map.has(String(habitId))) {
    map.delete(String(habitId));
    saveMobileDeletedHabitMap(map);
  }
}

function mergeMobileTasksDeep(localTasks, cloudTasks) {
  localTasks = sanitizeMobileTasksDummy(localTasks);
  cloudTasks = sanitizeMobileTasksDummy(cloudTasks);
  const sanitizedCloud = sanitizeMobileTasks(cloudTasks);
  const deletedMap = loadMobileDeletedTaskMap();
  if (!Array.isArray(sanitizedCloud) || sanitizedCloud.length === 0) {
    return Array.isArray(localTasks) ? localTasks : [];
  }
  if (!Array.isArray(localTasks) || localTasks.length === 0) {
    const filteredCloud = sanitizedCloud.filter(ct => {
      if (!ct || !ct.id) return false;
      const tb = deletedMap.get(String(ct.id));
      if (!tb) return true;
      const cTime = new Date(ct.updatedAt || ct.createdAt || 0).getTime();
      const dTime = new Date(tb.deletedAt).getTime();
      return cTime > dTime;
    });
    return filteredCloud;
  }

  const localMap = new Map();
  localTasks.forEach(t => {
    if (t && t.id) localMap.set(String(t.id), t);
  });

  const merged = [];
  const handledIds = new Set();

  sanitizedCloud.forEach(cloudTask => {
    if (!cloudTask || !cloudTask.id) return;
    const strId = String(cloudTask.id);
    handledIds.add(strId);

    const localTask = localMap.get(strId);
    if (!localTask) {
      const tombstone = deletedMap.get(strId);
      if (tombstone) {
        const cloudUpdated = new Date(cloudTask.updatedAt || cloudTask.createdAt || 0).getTime();
        const deletedTime = new Date(tombstone.deletedAt).getTime();
        if (cloudUpdated <= deletedTime) return;
      }
      merged.push(cloudTask);
      return;
    }

    const finalTask = { ...cloudTask };

    // 1. 完了ステータス・実行中ステータスの絶対保護 (Zero-Rollback)
    if (localTask.status === 'completed' || cloudTask.status === 'completed') {
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
      finalTask.status = 'paused';
      finalTask._localUpdatedAt = Date.now();
      finalTask.startTimestamp = null;
      finalTask.actStart = localTask.actStart || cloudTask.actStart;
      finalTask.accumulatedSeconds = Math.max(localTask.accumulatedSeconds || 0, cloudTask.accumulatedSeconds || 0);
      finalTask.actMin = Math.max(localTask.actMin || 0, cloudTask.actMin || 0);
    } else if (cloudTask.status === 'in_progress') {
      const todayK = normalizeMobileDateKey(new Date());
      const cloudStartK = cloudTask.startTimestamp ? normalizeMobileDateKey(new Date(cloudTask.startTimestamp)) : null;
      const isCloudFromPast = Boolean(cloudStartK && cloudStartK !== todayK);

      if (isCloudFromPast) {
        finalTask.status = 'uncompleted';
        finalTask.startTimestamp = null;
        finalTask.accumulatedSeconds = 0;
      } else {
        const hasOtherLocalRunning = (typeof state !== 'undefined' && state.tasks && state.tasks.some(t => String(t.id) !== strId && t.status === 'in_progress')) ||
                                     (typeof state !== 'undefined' && state.habits && state.habits.some(h => h.status === 'in_progress'));
        if (!hasOtherLocalRunning) {
          finalTask.status = 'in_progress';
          finalTask.startTimestamp = cloudTask.startTimestamp;
          finalTask.actStart = cloudTask.actStart;
          finalTask.accumulatedSeconds = cloudTask.accumulatedSeconds || 0;
        } else {
          finaltask.status = 'paused'; task._localUpdatedAt = Date.now();
          finalTask.startTimestamp = null;
          finalTask.accumulatedSeconds = cloudTask.accumulatedSeconds || 0;
        }
      }
    }

    // 2. executionLogs の統合
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

    // 3. 当日完了の絶対保護 (Zero-Rollback Day-Protection)
    const curTodayKey = new Date().toLocaleDateString('sv');
    const hasDoneTodayLog = finalTask.executionLogs.some(l => l && l.dateKey === curTodayKey);
    if (hasDoneTodayLog) {
      finalTask.status = 'completed';
      finalTask.startTimestamp = null;
      finalTask.accumulatedSeconds = 0;
    }

    const localUpdated = new Date(localTask.updatedAt || localTask.createdAt || 0).getTime();
    const cloudUpdated = new Date(cloudTask.updatedAt || cloudTask.createdAt || 0).getTime();
    if (localUpdated > cloudUpdated) {
      if (localTask.title) finalTask.title = localTask.title;
      if (localTask.bucket) finalTask.bucket = localTask.bucket;
      if (localTask.section) finalTask.section = localTask.section;
      if (localTask.scheduledDate) finalTask.scheduledDate = localTask.scheduledDate;
      if (localTask.tags) finalTask.tags = localTask.tags;
      if (localTask.domainMinor) finalTask.domainMinor = localTask.domainMinor;
    }

    merged.push(finalTask);
  });

  localTasks.forEach(localTask => {
    if (!localTask || !localTask.id) return;
    const strId = String(localTask.id);
    if (!handledIds.has(strId)) {
      merged.push(localTask);
      handledIds.add(strId);
    }
  });

  return merged;
}

function mergeMobileHabitsDeep(localHabits, cloudHabits) {
  localHabits = sanitizeMobileHabitsDummy(localHabits);
  cloudHabits = sanitizeMobileHabitsDummy(cloudHabits);
  const deletedHabitMap = typeof loadMobileDeletedHabitMap === 'function' ? loadMobileDeletedHabitMap() : new Map();

  if (!Array.isArray(cloudHabits) || cloudHabits.length === 0) {
    return (Array.isArray(localHabits) ? localHabits : [])
      .map((h, idx) => migrateMobileHabit(h, idx))
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
      .map((h, idx) => migrateMobileHabit(h, idx))
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
      const tombstone = deletedHabitMap.get(strId);
      if (tombstone) {
        const cloudUpdated = new Date(cloudHabit.updatedAt || cloudHabit.createdAt || 0).getTime();
        const deletedTime = new Date(tombstone.deletedAt).getTime();
        if (cloudUpdated <= deletedTime) {
          return; // 削除済みハビット破棄
        }
      }
      merged.push(migrateMobileHabit(cloudHabit, idx));
      return;
    }

    const finalHabit = { ...cloudHabit };

    // 0. 直近ローカル操作（_localUpdatedAt: 120秒以内）の絶対優先保護
    const isRecentLocalHabit = localHabit._localUpdatedAt && (Date.now() - localHabit._localUpdatedAt < 120000);
    if (isRecentLocalHabit) {
      finalHabit.status = localHabit.status;
      finalHabit.startTimestamp = localHabit.startTimestamp;
      finalHabit.accumulatedSeconds = localHabit.accumulatedSeconds || 0;
      finalHabit.actStart = localHabit.actStart;
      finalHabit.actEnd = localHabit.actEnd;
      finalHabit._localUpdatedAt = localHabit._localUpdatedAt;

      if (localHabit.name !== undefined) finalHabit.name = localHabit.name;
      if (localHabit.section !== undefined) finalHabit.section = localHabit.section;
      if (localHabit.displayType !== undefined) finalHabit.displayType = localHabit.displayType;
      if (localHabit.customStart !== undefined) finalHabit.customStart = localHabit.customStart;
      if (localHabit.customEnd !== undefined) finalHabit.customEnd = localHabit.customEnd;
      if (localHabit.targetMin !== undefined) finalHabit.targetMin = localHabit.targetMin;
      if (localHabit.notes !== undefined) finalHabit.notes = localHabit.notes;
      if (typeof localHabit.isDisabled === 'boolean') finalHabit.isDisabled = localHabit.isDisabled;
      if (localHabit.sortOrder !== undefined) finalHabit.sortOrder = localHabit.sortOrder;
    } else if (localHabit.status === 'completed' && cloudHabit.status !== 'completed') {
      finalHabit.status = 'completed';
      finalHabit.startTimestamp = null;
      if (localHabit.actEnd) finalHabit.actEnd = localHabit.actEnd;
      if (localHabit.actStart && !finalHabit.actStart) finalHabit.actStart = localHabit.actStart;
    } else if (localHabit.status === 'in_progress') {
      finalHabit.status = 'in_progress';
      finalHabit.startTimestamp = localHabit.startTimestamp || finalHabit.startTimestamp;
      if (localHabit.actStart) finalHabit.actStart = localHabit.actStart;
      if (localHabit.accumulatedSeconds) finalHabit.accumulatedSeconds = localHabit.accumulatedSeconds;
    } else if (localHabit.status === 'paused') {
      finalHabit.status = 'paused';
      finalHabit._localUpdatedAt = localHabit._localUpdatedAt || Date.now();
      finalHabit.startTimestamp = null;
      if (localHabit.actStart) finalHabit.actStart = localHabit.actStart;
      if (localHabit.accumulatedSeconds) finalHabit.accumulatedSeconds = localHabit.accumulatedSeconds;
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

    // 5. ローカル属性保護
    if (localHabit.sortOrder && typeof localHabit.sortOrder === 'number') finalHabit.sortOrder = localHabit.sortOrder;
    if (typeof localHabit.isDisabled === 'boolean') finalHabit.isDisabled = localHabit.isDisabled;

    merged.push(migrateMobileHabit(finalHabit, idx));
  });

  localHabits.forEach((localHabit, idx) => {
    if (!localHabit || !localHabit.id) return;
    const strId = String(localHabit.id);
    if (!handledIds.has(strId)) {
      merged.push(migrateMobileHabit(localHabit, merged.length));
      handledIds.add(strId);
    }
  });

  return merged.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
}

async function pullFromCloud(force = false, isSilent = false) {
  const gasUrl = getGasUrl();
  if (!gasUrl) {
    if (force) alert('\u26A0\uFE0F GAS URL\u304C\u672A\u8A2D\u5B9A\u3067\u3059\u3002\u53F3\u4E0A\u306E \u2699\uFE0F\uFF08\u6B6F\u8ECA\u30A2\u30A4\u30B3\u30F3\uFF09\u304B\u3089URL\u3092\u8A2D\u5B9A\u3057\u3066\u304F\u3060\u3055\u3044\u3002');
    return;
  }
  if (mState.isSyncing) return;

  // 【逆流完全防止弁】未送信のローカル変更がある間は、過去データでの上書きを完全遮断
  if (mState.isLocalDirty && !force) {
    triggerCloudPush();
    return;
  }

  mState.isSyncing = true;
  if (!isSilent) {
    updateSyncUI('syncing');
  }

  try {
    const res = await fetchWithTimeout(`${gasUrl}?t=${Date.now()}`, { timeout: 20000 });
    const data = await res.json();
    if (data.status === 'success' && data.data) {
      const cloud = data.data;
      const cloudMeta = cloud.metadata || {};
      const localMeta = getMetadata();

      const cloudTime = new Date(cloudMeta.lastUpdatedAt || 0).getTime();
      const localTime = new Date(localMeta.lastUpdatedAt || 0).getTime();

      if (cloudMeta.deletedTasks && typeof cloudMeta.deletedTasks === 'object') {
        const locDeletedMap = loadMobileDeletedTaskMap();
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
        if (changed) saveMobileDeletedTaskMap(locDeletedMap);
      }

      if (cloudMeta.deletedHabits && typeof cloudMeta.deletedHabits === 'object') {
        const locDeletedHabitMap = loadMobileDeletedHabitMap();
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
        if (habitChanged) saveMobileDeletedHabitMap(locDeletedHabitMap);
      }

      // フェッチ通信中にローカル操作が発生していた場合は、ローカル最新を優先マージし即時プッシュ
      if (mState.hasPendingPush) {
        if (Array.isArray(cloud.tasks)) {
          mState.tasks = mergeMobileTasksDeep(mState.tasks, cloud.tasks);
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(mState.tasks));
        }
        if (Array.isArray(cloud.habits)) {
          mState.habits = mergeMobileHabitsDeep(mState.habits, cloud.habits);
          localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(mState.habits));
        }
        return;
      }

      const mobileIsEmpty = (!mState.tasks || mState.tasks.length === 0) && (!mState.habits || mState.habits.length === 0);
      const hasMissingMobileTasks = Array.isArray(cloud.tasks) && (!mState.tasks || mState.tasks.length < cloud.tasks.length);
      const shouldPull = force || cloudTime > localTime || !localMeta.lastUpdatedAt || mobileIsEmpty || (hasMissingMobileTasks && localTime <= cloudTime);
      if (shouldPull) {
        if (Array.isArray(cloud.tasks)) {
          mState.tasks = mergeMobileTasksDeep(mState.tasks, cloud.tasks);
          localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(mState.tasks));
        }
        if (Array.isArray(cloud.habits)) {
          mState.habits = mergeMobileHabitsDeep(mState.habits, cloud.habits);
          localStorage.setItem(STORAGE_KEYS.HABITS, JSON.stringify(mState.habits));
        }
        if (cloud.goals) {
          mState.goals = cloud.goals;
          localStorage.setItem(STORAGE_KEYS.GOALS, JSON.stringify(cloud.goals));
        }
        if (cloud.manifesto) {
          mState.manifesto = cloud.manifesto;
          localStorage.setItem(STORAGE_KEYS.MANIFESTO, JSON.stringify(cloud.manifesto));
        }
        if (Array.isArray(cloud.taskPresets) && cloud.taskPresets.length > 0) {
          mState.taskPresets = cloud.taskPresets;
          localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(cloud.taskPresets));
        }

        updateMetadata({
          lastUpdatedAt: cloudMeta.lastUpdatedAt || new Date().toISOString(),
          lastUpdatedDevice: cloudMeta.lastUpdatedDevice || 'CLOUD',
          lastProcessedDate: cloudMeta.lastProcessedDate || localMeta.lastProcessedDate
        });

        // Recheck active task & habit (support in_progress and paused)
        const activeTask = mState.tasks.find(t => t.status === 'in_progress') || mState.tasks.find(t => t.status === 'paused');
        mState.activeTaskId = activeTask ? activeTask.id : null;
        const activeHabit = mState.habits.find(h => h.status === 'in_progress') || mState.habits.find(h => h.status === 'paused');
        mState.activeHabitId = activeHabit ? activeHabit.id : null;

        if (activeTask && activeHabit) {
          if (activeTask.status === 'in_progress') mState.activeHabitId = null;
          else if (activeHabit.status === 'in_progress') mState.activeTaskId = null;
          else mState.activeHabitId = null;
        }

        syncMobileVersionBadges();
        renderMobileApp();
        updateSyncUI('success');
        if (force && !isSilent) showMobileUndoToast(`\u2713 \u6700\u65B0\u30C7\u30FC\u30BF\u3092\u540C\u671F\u3057\u307E\u3057\u305F\uFF08${mState.tasks.length}\u4EF6\uFF09`);
      } else if (localTime > cloudTime) {
        pushToCloud();
      } else {
        updateSyncUI('success');
      }
    }
  } catch (err) {
    if (!isSilent) console.error('Mobile cloud pull failed:', err);
    updateSyncUI('offline');
    if (force && !isSilent) alert('\u30AF\u30E9\u30A6\u30C9\u304B\u3089\u306E\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F\u3002URL\u307E\u305F\u306F\u30CD\u30C3\u30C8\u63A5\u7D9A\u3092\u78BA\u8A8D\u3057\u3066\u304F\u3060\u3055\u3044\u3002');
  } finally {
    mState.isSyncing = false;
    if (mState.hasPendingPush) {
      mState.hasPendingPush = false;
      setTimeout(() => pushToCloud(), 100);
    }
  }
}

function updateSyncUI(status) {
  const badge = document.getElementById('m-sync-badge');
  if (!badge) return;

  badge.className = 'sync-status-badge';
  switch (status) {
    case 'syncing':
      badge.classList.add('syncing');
      badge.innerHTML = '\uD83D\uDD04 \u540C\u671F\u4E2D...';
      break;
    case 'success':
      badge.classList.add('success');
      badge.innerHTML = '\uD83D\uDFE2 \u540C\u671F\u5B8C\u4E86';
      setTimeout(() => {
        if (badge && badge.classList.contains('success')) {
          badge.innerHTML = '\u26A1 Gendrive';
        }
      }, 3000);
      break;
    case 'offline':
      badge.classList.add('offline');
      badge.innerHTML = '\uD83D\uDFE1 \u30AA\u30D5\u30E9\u30A4\u30F3';
      break;
    case 'error':
      badge.classList.add('error');
      badge.innerHTML = '\u26A0\uFE0F \u30A8\u30A8\u30E9\u30FC';
      break;
    default:
      badge.innerHTML = '\uD83D\uDCBE \u30ED\u30FC\u30AB\u30EB';
      break;
  }
}

// =========================================================================
// 5. Touch Action Handlers (Task & Habit State Transitions)
// =========================================================================

function startTask(taskId) {
  haptic(20);
  const targetTask = mState.tasks.find(t => String(t.id) === String(taskId));
  if (!targetTask) return;

  const now = new Date();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // 1. 対象タスクを開始し、他のタスクを安全に自動中断（Auto-pause）
  mState.tasks.forEach(t => {
    if (String(t.id) === String(taskId)) {
      t.status = 'in_progress';
      t.actStart = t.actStart || nowTimeStr;
      t.startTimestamp = Date.now(); t._localUpdatedAt = Date.now();
    } else if (t.status === 'in_progress') {
      t.status = 'paused'; t._localUpdatedAt = Date.now();
      if (t.startTimestamp) {
        const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - t.startTimestamp) / 1000));
        t.accumulatedSeconds = (t.accumulatedSeconds || (t.actMin ? t.actMin * 60 : 0)) + sessionElapsedSec;
        t.actMin = Math.round(t.accumulatedSeconds / 60);
      }
      t.startTimestamp = null;
    }
  });

  // 2. 実行中のハビットがあれば自動中断
  let habitPaused = false;
  if (Array.isArray(mState.habits)) {
    mState.habits.forEach(h => {
      if (h.status === 'in_progress') {
        h.status = 'paused'; h._localUpdatedAt = Date.now();
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

  // 3. アクティブ表示対象をこのタスクに固定
  mState.activeTaskId = targetTask.id;
  mState.activeHabitId = null;

  saveLocalTasks();
  syncMobileVersionBadges();
  renderMobileApp();
}

function pauseTask(taskId) {
  haptic(15);
  const task = mState.tasks.find(t => String(t.id) === String(taskId));
  if (!task || task.status !== 'in_progress') return;

  task.status = 'paused'; task._localUpdatedAt = Date.now();
  if (task.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000));
    task.accumulatedSeconds = (task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0)) + sessionElapsedSec;
    task.actMin = Math.round(task.accumulatedSeconds / 60);
  }
  task.startTimestamp = null;

  mState.activeTaskId = task.id;

  saveLocalTasks();
  syncMobileVersionBadges();
  renderMobileApp();
}

function completeTask(taskId) {
  haptic([20, 50, 20]);
  const task = mState.tasks.find(t => String(t.id) === String(taskId));
  if (!task) return;

  const backupTask = JSON.parse(JSON.stringify(task));

  const now = new Date();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  task.actEnd = nowTimeStr; task._localUpdatedAt = Date.now();

  if (task.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000));
    task.accumulatedSeconds = (task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0)) + sessionElapsedSec;
  }

  const finalTotalSec = task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : (task.estMin || 25) * 60);
  const elapsedMin = Math.max(1, Math.round(finalTotalSec / 60));
  task.actMin = elapsedMin;

  const dateKey = getTodayDateString(mState.selectedDateOffset);
  if (!task.history) task.history = {};

  const targetTimes = getItemTargetTimes(task);
  const curCount = getItemDayCount(task, dateKey);
  const newCount = curCount + 1;
  const isGoalReached = (newCount >= targetTimes);

  task.history[dateKey] = {
    done: isGoalReached,
    count: newCount,
    durationMin: elapsedMin,
    actStart: task.actStart || null,
    actEnd: task.actEnd || null,
    completedAt: now.toISOString()
  };

  if (!Array.isArray(task.executionLogs)) task.executionLogs = [];
  task.executionLogs.unshift({
    id: 'tlog_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    dateKey: dateKey,
    completedAt: now.toISOString(),
    count: newCount,
    durationMin: elapsedMin,
    note: ''
  });

  // 単発タスク完了時: scheduledDateが未設定の場合は完了日(dateKey)を自動設定して翌日以降のゾンビ表示を防止
  const isRec = task.type === 'recurring' || task.taskType === 'recurring' || Boolean(task.recType);
  if (!isRec && !task.isRecurringInstance && !task.scheduledDate) {
    task.scheduledDate = dateKey;
  }

  task.status = isGoalReached ? 'completed' : 'uncompleted';
  task.startTimestamp = null;
  task.accumulatedSeconds = 0;

  if (String(mState.activeTaskId) === String(taskId)) {
    mState.activeTaskId = null;
  }

  saveLocalTasks();
  syncMobileVersionBadges();
  renderMobileApp();

  // 定期タスク完了時: 単発タスクレコードをクローン自動生成してマスターボード・SingleTasksへ反映
  let cloneTaskId = null;
  if (isRec && isGoalReached) {
    if (typeof createRecurringSingleTaskClone === 'function') {
      const clone = createRecurringSingleTaskClone(task, {
        userNote: '',
        userDurationMin: elapsedMin,
        dateKey: dateKey,
        now: now,
        logId: task.executionLogs && task.executionLogs[0] ? task.executionLogs[0].id : null
      });
      if (clone) {
        mState.tasks.push(clone);
        cloneTaskId = clone.id;
      }
    }
  }

  const toastMsg = targetTimes > 1
    ? (isGoalReached ? `⚡ 「${task.title}」本日の目標達成！（${newCount}/${targetTimes}回）🎉` : `⚡ 「${task.title}」（${newCount}/${targetTimes}回目）を記録しました`)
    : `⚡ 「${task.title}」を完了しました`;

  showMobileUndoToast(toastMsg, () => {
    Object.assign(task, backupTask);
    if (backupTask.status === 'in_progress' || backupTask.status === 'paused') mState.activeTaskId = task.id;
    // 連動して生成されたクローン単発タスクを自動削除
    if (typeof removeRecurringInstanceSingleTasks === 'function') {
      removeRecurringInstanceSingleTasks(task.id, dateKey, task.executionLogs && task.executionLogs[0] ? task.executionLogs[0].id : null, mState.tasks);
    } else if (cloneTaskId) {
      mState.tasks = mState.tasks.filter(t => t.id !== cloneTaskId);
    }
    saveLocalTasks();
    syncMobileVersionBadges();
    renderMobileApp();
  });
}

function uncompleteTask(taskId) {
  haptic(15);
  const task = mState.tasks.find(t => String(t.id) === String(taskId));
  if (!task) return;

  const dateKey = getTodayDateString(mState.selectedDateOffset);
  if (task.history && task.history[dateKey]) {
    delete task.history[dateKey];
  }
  task.status = 'uncompleted';
  task.actEnd = null;
  task.startTimestamp = null;
  task.accumulatedSeconds = 0;

  // 定期タスクを未完了に戻した場合、連動クローン単発タスクも削除
  const isRec = task.type === 'recurring' || task.taskType === 'recurring' || Boolean(task.recType);
  if (isRec) {
    if (typeof removeRecurringInstanceSingleTasks === 'function') {
      removeRecurringInstanceSingleTasks(task.id, dateKey, null, mState.tasks);
    } else {
      mState.tasks = mState.tasks.filter(t => !(t.isRecurringInstance && String(t.recurringSourceId) === String(task.id) && t.scheduledDate === dateKey));
    }
  }

  if (String(mState.activeTaskId) === String(taskId)) {
    mState.activeTaskId = null;
  }

  saveLocalTasks();
  syncMobileVersionBadges();
  renderMobileApp();
}

function startHabit(habitId) {
  haptic(20);
  const targetHabit = mState.habits.find(h => String(h.id) === String(habitId));
  if (!targetHabit) return;

  const now = new Date();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  mState.habits.forEach(h => {
    if (String(h.id) === String(habitId)) {
      h.status = 'in_progress';
      h.actStart = h.actStart || nowTimeStr;
      h.startTimestamp = Date.now(); h._localUpdatedAt = Date.now();
      mState.activeHabitId = h.id;
    } else if (h.status === 'in_progress') {
      h.status = 'paused'; h._localUpdatedAt = Date.now();
      if (h.startTimestamp) {
        const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - h.startTimestamp) / 1000));
        h.accumulatedSeconds = (h.accumulatedSeconds || (h.actMin ? h.actMin * 60 : 0)) + sessionElapsedSec;
        h.actMin = Math.round(h.accumulatedSeconds / 60);
      }
      h.startTimestamp = null;
    }
  });

  // Auto-pause any active task
  if (Array.isArray(mState.tasks)) {
    let taskPaused = false;
    mState.tasks.forEach(t => {
      if (t.status === 'in_progress') {
        t.status = 'paused'; t._localUpdatedAt = Date.now();
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
  syncMobileVersionBadges();
  renderMobileApp();
}

function pauseHabit(habitId) {
  haptic(15);
  const habit = mState.habits.find(h => String(h.id) === String(habitId));
  if (!habit || habit.status !== 'in_progress') return;

  habit.status = 'paused'; habit._localUpdatedAt = Date.now(); t._localUpdatedAt = Date.now();
  if (habit.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - habit.startTimestamp) / 1000));
    habit.accumulatedSeconds = (habit.accumulatedSeconds || (habit.actMin ? habit.actMin * 60 : 0)) + sessionElapsedSec;
    habit.actMin = Math.round(habit.accumulatedSeconds / 60);
  }
  habit.startTimestamp = null;

  mState.activeHabitId = habit.id;

  saveLocalHabits();
  syncMobileVersionBadges();
  renderMobileApp();
}

function completeHabit(habitId) {
  haptic([20, 50, 20]);
  const habit = mState.habits.find(h => String(h.id) === String(habitId));
  if (!habit) return;

  const backupHabit = JSON.parse(JSON.stringify(habit));

  const now = new Date();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  habit.actEnd = nowTimeStr; habit._localUpdatedAt = Date.now();

  if (habit.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - habit.startTimestamp) / 1000));
    habit.accumulatedSeconds = (habit.accumulatedSeconds || (habit.actMin ? habit.actMin * 60 : 0)) + sessionElapsedSec;
  }

  const finalTotalSec = habit.accumulatedSeconds || (habit.actMin ? habit.actMin * 60 : (habit.targetMin || 5) * 60);
  const elapsedMin = Math.max(1, Math.round(finalTotalSec / 60));
  habit.actMin = elapsedMin;

  const dateKey = getTodayDateString(mState.selectedDateOffset);
  if (!habit.history) habit.history = {};

  const targetTimes = getItemTargetTimes(habit);
  const curCount = getItemDayCount(habit, dateKey);
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
  syncMobileVersionBadges();
  renderMobileApp();

  const toastMsg = targetTimes > 1
    ? (isGoalReached ? `\uD83C\uDF3F \u300C${habit.name}\u300D\u672C\u65E5\u306E\u76EE\u6817\u9054\u6210\uFF01\uFF08${newCount}/${targetTimes}\u56DE\uFF09\uD83C\uDF89` : `\uD83C\uDF3F \u300C${habit.name}\u300D\uFF08${newCount}/${targetTimes}\u56DE\u76EE\uFF09\u3092\u8A18\u9332\u3057\u307E\u3057\u305F`)
    : `\uD83C\uDF3F \u300C${habit.name}\u300D\u5B8C\u4E86\u3057\u307E\u3057\u305F`;

  showMobileUndoToast(toastMsg, () => {
    Object.assign(habit, backupHabit);
    if (backupHabit.status === 'in_progress' || backupHabit.status === 'paused') mState.activeHabitId = habit.id;
    saveLocalHabits();
    syncMobileVersionBadges();
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
  habit.accumulatedSeconds = 0;

  if (String(mState.activeHabitId) === String(habitId)) {
    mState.activeHabitId = null;
  }

  saveLocalHabits();
  syncMobileVersionBadges();
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
// 6. UI Rendering Engine (Sticky Active Bar & Card Lists)
// =========================================================================

function renderMobileApp() {
  renderHeaderDateAndETA();
  renderStickyActiveBar();
  renderList();
  updateBottomNavBadges();
}

function updateBottomNavBadges() {
  const targetDateKey = getTodayDateString(mState.selectedDateOffset);
  const currentSecId = detectCurrentSectionId();
  const currentSecObj = SECTIONS.find(s => s.id === currentSecId) || SECTIONS[3];

  const isToday = mState.selectedDateOffset === 0;
  const isPast = mState.selectedDateOffset < 0;

  // 1. 本日全未完了タスク
  const todayTasks = mState.tasks.filter(t => {
    if (t.isRecurringInstance) return false;
    if (t.isDisabled || (t.bucket && t.bucket !== 'today') || t.status === 'skipped') return false;
    const targetTimes = getItemTargetTimes(t);
    const curCount = getItemDayCount(t, targetDateKey);
    if (targetTimes > 1) {
      if (curCount >= targetTimes) return false;
    } else {
      if (t.status === 'completed') return false;
    }
    if (isPast && (t.type === 'recurring' || t.taskType === 'recurring' || t.recType)) return false;
    return (t.scheduledDate === targetDateKey || (!t.scheduledDate && isToday));
  });

  // 2. 本日全未完了習慣
  const targetDateObj = new Date();
  targetDateObj.setDate(targetDateObj.getDate() - mState.selectedDateOffset);
  const todayHabits = getMobileTodayHabits(targetDateObj, targetDateKey);

  // 3. 現在セクションの未完タスク & 未完習慣
  const secTasks = getMobileSectionTasks(todayTasks, currentSecObj);
  const secHabits = getMobileSectionHabits(todayHabits, currentSecObj);

  const secCountEl = document.getElementById('m-section-count');
  const dailyCountEl = document.getElementById('m-daily-count');
  const taskCountEl = document.getElementById('m-task-count');
  const habitCountEl = document.getElementById('m-habit-count');

  if (mState.activeType === 'habit') {
    if (secCountEl) secCountEl.textContent = secHabits.length;
    if (dailyCountEl) dailyCountEl.textContent = todayHabits.length;
  } else {
    if (secCountEl) secCountEl.textContent = secTasks.length;
    if (dailyCountEl) dailyCountEl.textContent = todayTasks.length;
  }

  if (mState.activeScope === 'section') {
    if (taskCountEl) taskCountEl.textContent = secTasks.length;
    if (habitCountEl) habitCountEl.textContent = secHabits.length;
  } else {
    if (taskCountEl) taskCountEl.textContent = todayTasks.length;
    if (habitCountEl) habitCountEl.textContent = todayHabits.length;
  }
}

function renderHeaderDateAndETA() {
  const dateEl = document.getElementById('m-header-date');
  const etaTimeEl = document.getElementById('m-eta-time-val');
  const etaRemainEl = document.getElementById('m-eta-remain-info');

  const d = new Date();
  d.setDate(d.getDate() - mState.selectedDateOffset);
  const dayNames = ['\u65E5', '\u6708', '\u706B', '\u6C34', '\u6728', '\u91D1', '\u571F'];
  const isToday = mState.selectedDateOffset === 0;

  if (dateEl) {
    dateEl.textContent = `${d.getMonth() + 1}/${d.getDate()}(${dayNames[d.getDay()]}) ${isToday ? '\u4ECA\u65E5' : ''}`;
  }

  const targetDateKey = getTodayDateString(mState.selectedDateOffset);

  const todayTasks = mState.tasks.filter(t => {
    if (t.isRecurringInstance) return false;
    if (t.isDisabled || (t.bucket && t.bucket !== 'today') || t.status === 'completed' || t.status === 'skipped') return false;
    return (t.scheduledDate === targetDateKey || (!t.scheduledDate && isToday));
  });

  let remainingMinutes = 0;
  todayTasks.forEach(t => {
    const est = t.estMin || 25;
    const act = t.actMin || (t.accumulatedSeconds ? Math.round(t.accumulatedSeconds / 60) : 0);
    remainingMinutes += Math.max(1, est - act);
  });

  if (todayTasks.length === 0) {
    if (etaTimeEl) {
      etaTimeEl.textContent = 'ALL DONE! \u26A1';
      etaTimeEl.classList.remove('overdue-crimson');
    }
    if (etaRemainEl) {
      etaRemainEl.textContent = '\u5168\u5B8C\u4E86';
    }
  } else {
    const now = new Date();
    const etaDate = new Date(now.getTime() + remainingMinutes * 60 * 1000);
    const etaTimeStr = `${String(etaDate.getHours()).padStart(2, '0')}:${String(etaDate.getMinutes()).padStart(2, '0')}`;

    if (etaTimeEl) {
      etaTimeEl.textContent = etaTimeStr;
      if (etaDate < now) {
        etaTimeEl.classList.add('overdue-crimson');
      } else {
        etaTimeEl.classList.remove('overdue-crimson');
      }
    }
    if (etaRemainEl) {
      etaRemainEl.textContent = `\u6B8B ${Math.round(remainingMinutes / 60 * 10) / 10}h (${todayTasks.length}\u4EF6)`;
    }
  }
}

function renderStickyActiveBar() {
  const bar = document.getElementById('sticky-active-bar');
  if (!bar) return;

  const targetDateKey = getTodayDateString(mState.selectedDateOffset);

  // 1. 最優先：実行中（in_progress）のアイテムを探索（タスクまたはハビット）
  const runningTask = mState.tasks.find(t => t.status === 'in_progress');
  const runningHabit = mState.habits.find(h => h.status === 'in_progress');

  let activeItem = null;
  let activeType = null; // 'task' | 'habit'

  if (runningTask) {
    activeItem = runningTask;
    activeType = 'task';
    mState.activeTaskId = runningTask.id;
  } else if (runningHabit) {
    activeItem = runningHabit;
    activeType = 'habit';
    mState.activeHabitId = runningHabit.id;
  } else {
    // 2. 実行中がない場合：直近で中断（paused）されたアイテムを探索
    const pausedTask = mState.activeTaskId
      ? mState.tasks.find(t => String(t.id) === String(mState.activeTaskId) && t.status === 'paused')
      : null;
    const pausedHabit = mState.activeHabitId
      ? mState.habits.find(h => String(h.id) === String(mState.activeHabitId) && h.status === 'paused')
      : null;

    if (pausedTask && pausedHabit) {
      if (mState.activeType === 'habit') {
        activeItem = pausedHabit;
        activeType = 'habit';
      } else {
        activeItem = pausedTask;
        activeType = 'task';
      }
    } else if (pausedTask) {
      activeItem = pausedTask;
      activeType = 'task';
    } else if (pausedHabit) {
      activeItem = pausedHabit;
      activeType = 'habit';
    } else {
      // activeId がなくても、全体で paused なものがあれば拾う
      const anyPausedTask = mState.tasks.find(t => t.status === 'paused');
      const anyPausedHabit = mState.habits.find(h => h.status === 'paused');
      if (mState.activeType === 'habit' && anyPausedHabit) {
        activeItem = anyPausedHabit;
        activeType = 'habit';
        mState.activeHabitId = anyPausedHabit.id;
      } else if (anyPausedTask) {
        activeItem = anyPausedTask;
        activeType = 'task';
        mState.activeTaskId = anyPausedTask.id;
      } else if (anyPausedHabit) {
        activeItem = anyPausedHabit;
        activeType = 'habit';
        mState.activeHabitId = anyPausedHabit.id;
      }
    }
  }

  if (!activeItem) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }

  bar.classList.remove('hidden');

  const isInProgress = activeItem.status === 'in_progress';
  const isPaused = activeItem.status === 'paused';
  const curCount = getItemDayCount(activeItem, targetDateKey);
  const targetTimes = getItemTargetTimes(activeItem);
  const isMulti = targetTimes > 1;

  const elapsedSec = (activeItem.accumulatedSeconds || (activeItem.actMin ? activeItem.actMin * 60 : 0)) +
    (isInProgress && activeItem.startTimestamp ? Math.max(0, Math.floor((Date.now() - activeItem.startTimestamp) / 1000)) : 0);
  const timeFormatted = formatTime(elapsedSec);

  const countBadgeHtml = isMulti ? `<span class="m-slim-count-badge ${curCount > 0 ? 'active' : ''}">${curCount}/${targetTimes}\u56DE</span>` : '';
  const timerBadgeHtml = `<span class="m-slim-timer-badge ${isPaused ? 'paused' : ''}" id="active-bar-timer">${timeFormatted}</span>`;

  const statusLineHtml = isInProgress
    ? `<span class="top-status-line running"><span class="active-bar-pulse"></span>RUNNING</span>`
    : `<span class="top-status-line paused">\u23F8 PAUSED</span>`;

  if (activeType === 'habit') {
    const actionBtnHtml = isInProgress
      ? `<button class="btn-slim btn-slim-warning" onclick="event.stopPropagation(); pauseHabit('${activeItem.id}')">\u23F8 \u4E2D\u65AD</button>
         <button class="btn-slim btn-slim-success" onclick="event.stopPropagation(); completeHabit('${activeItem.id}')">\u2713 ${isMulti ? (curCount + 1) + '\u56DE\u76EE\u5B8C\u4E86' : '\u5B8C\u4E86'}</button>`
      : `<button class="btn-slim btn-slim-pause-resume" onclick="event.stopPropagation(); startHabit('${activeItem.id}')">\u25B6 \u518D\u958B</button>
         <button class="btn-slim btn-slim-success" onclick="event.stopPropagation(); completeHabit('${activeItem.id}')">\u2713 ${isMulti ? (curCount + 1) + '\u56DE\u76EE\u5B8C\u4E86' : '\u5B8C\u4E86'}</button>`;

    bar.innerHTML = `
      <div class="top-sticky-card ${isInProgress ? 'in-progress' : 'paused'}" id="top-h-card-${activeItem.id}">
        <div class="top-card-left" onclick="${isInProgress ? `pauseHabit('${activeItem.id}')` : `startHabit('${activeItem.id}')`}" style="cursor:pointer;">
          <span class="m-slim-icon" style="font-size: 16px;">${isInProgress ? '\u26A1' : '\u23F8\uFE0F'}</span>
          <div class="top-card-meta">
            ${statusLineHtml}
            <span class="top-card-title">${activeItem.name}</span>
          </div>
          ${countBadgeHtml}
          ${timerBadgeHtml}
        </div>
        <div class="top-card-actions">
          ${actionBtnHtml}
        </div>
      </div>
    `;
  } else {
    const actionBtnHtml = isInProgress
      ? `<button class="btn-slim btn-slim-warning" onclick="event.stopPropagation(); pauseTask('${activeItem.id}')">\u23F8 \u4E2D\u65AD</button>
         <button class="btn-slim btn-slim-success" onclick="event.stopPropagation(); completeTask('${activeItem.id}')">\u2713 ${isMulti ? (curCount + 1) + '\u56DE\u76EE\u5B8C\u4E86' : '\u5B8C\u4E86'}</button>`
      : `<button class="btn-slim btn-slim-pause-resume" onclick="event.stopPropagation(); startTask('${activeItem.id}')">\u25B6 \u518D\u958B</button>
         <button class="btn-slim btn-slim-success" onclick="event.stopPropagation(); completeTask('${activeItem.id}')">\u2713 ${isMulti ? (curCount + 1) + '\u56DE\u76EE\u5B8C\u4E86' : '\u5B8C\u4E86'}</button>`;

    bar.innerHTML = `
      <div class="top-sticky-card ${isInProgress ? 'in-progress' : 'paused'}" id="top-t-card-${activeItem.id}">
        <div class="top-card-left" onclick="${isInProgress ? `pauseTask('${activeItem.id}')` : `startTask('${activeItem.id}')`}" style="cursor:pointer;">
          <span class="m-slim-icon" style="font-size: 16px;">${isInProgress ? '\u26A1' : '\u23F8\uFE0F'}</span>
          <div class="top-card-meta">
            ${statusLineHtml}
            <span class="top-card-title">${activeItem.title}</span>
          </div>
          ${countBadgeHtml}
          ${timerBadgeHtml}
        </div>
        <div class="top-card-actions">
          ${actionBtnHtml}
        </div>
      </div>
    `;
  }
}

function updateActiveTimerDisplay(item) {
  if (!item) return;
  const timerEl = document.getElementById('active-bar-timer');
  const badgeEl = document.getElementById(`timer-badge-${item.id}`);
  const isInProgress = item.status === 'in_progress';
  const elapsedSec = (item.accumulatedSeconds || (item.actMin ? item.actMin * 60 : 0)) +
    (isInProgress && item.startTimestamp ? Math.max(0, Math.floor((Date.now() - item.startTimestamp) / 1000)) : 0);
  const timeFormatted = formatTime(elapsedSec);
  if (timerEl) timerEl.textContent = timeFormatted;
  if (badgeEl) badgeEl.textContent = timeFormatted;
}

function renderList() {
  const container = document.getElementById('m-cards-list');
  const indicatorSlot = document.getElementById('sticky-indicator-slot');
  if (!container) return;

  const targetDateKey = getTodayDateString(mState.selectedDateOffset);
  const currentSecId = detectCurrentSectionId();
  const currentSecObj = SECTIONS.find(s => s.id === currentSecId) || SECTIONS[4];

  const isToday = mState.selectedDateOffset === 0;
  const isPast = mState.selectedDateOffset < 0;

  // 1. Get Today's Uncompleted Tasks
  const todayTasks = mState.tasks.filter(t => {
    if (t.isRecurringInstance) return false;
    if (t.isDisabled || (t.bucket && t.bucket !== 'today') || t.status === 'skipped') return false;
    const targetTimes = getItemTargetTimes(t);
    const curCount = getItemDayCount(t, targetDateKey);
    if (targetTimes > 1) {
      if (curCount >= targetTimes) return false;
    } else {
      if (t.status === 'completed') return false;
    }
    if (isPast && (t.type === 'recurring' || t.taskType === 'recurring' || t.recType)) return false;
    return (t.scheduledDate === targetDateKey || (!t.scheduledDate && isToday));
  });

  // 2. Get Today's Uncompleted Habits
  const targetDateObj = new Date();
  targetDateObj.setDate(targetDateObj.getDate() - mState.selectedDateOffset);
  const todayHabits = getMobileTodayHabits(targetDateObj, targetDateKey);

  const scope = mState.activeScope || 'section';
  const type = mState.activeType || 'task';

  // 実行中（in_progress）のアイテムのみをスクロールリストから除外（ヘッダーバーにリアルタイム表示されるため）
  // ※ 中断中（paused）のアイテムはリスト内に「⏸️ 中断中」＋「▶ 再開」ボタンとして必ず表示し、ワンタップで再開可能にする
  const runningTask = mState.tasks.find(t => t.status === 'in_progress');
  const runningHabit = mState.habits.find(h => h.status === 'in_progress');
  const runningTaskId = runningTask ? String(runningTask.id) : null;
  const runningHabitId = runningHabit ? String(runningHabit.id) : null;

  if (scope === 'section' && type === 'task') {
    const secTasks = getMobileSectionTasks(todayTasks, currentSecObj);
    const headerHtml = `
      <div class="m-section-indicator">
        <span class="m-sec-left">\u26A1 <b>${currentSecObj.name}</b> \u306E\u672A\u5B8C\u30BF\u30B9\u30AF</span>
        <span class="m-sec-count-tag">${secTasks.length}\u4EF6</span>
      </div>
    `;
    if (indicatorSlot) indicatorSlot.innerHTML = headerHtml;

    const displayTasks = secTasks.filter(t => String(t.id) !== runningTaskId);

    if (displayTasks.length === 0) {
      container.innerHTML = secTasks.length === 0 ? `
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">\uD83C\uDF89</span>
          <b style="color: var(--text-muted); font-size: 14px;">\u73FE\u30BB\u30AF\u30B7\u30E7\u30F3(${currentSecObj.name})\u306E\u672A\u5B8C\u30BF\u30B9\u30AF\u306F\u3042\u308A\u307E\u305B\u3093</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">\u3053\u306E\u30BB\u30AF\u30B7\u30E7\u30F3\u306E\u30BF\u30B9\u30AF\u306F\u5168\u3066\u5B8C\u4E86\u3067\u3059\uFF01</p>
        </div>
      ` : '';
      return;
    }
    container.innerHTML = displayTasks.map(t => renderSlimTaskCard(t)).join('');

  } else if (scope === 'section' && type === 'habit') {
    const secHabits = getMobileSectionHabits(todayHabits, currentSecObj);
    const headerHtml = `
      <div class="m-section-indicator habit-indicator">
        <span class="m-sec-left">\uD83C\uDF3F <b>${currentSecObj.name}</b> \u306E\u672A\u5B8C\u7FD2\u6163</span>
        <span class="m-sec-count-tag">${secHabits.length}\u4EF6</span>
      </div>
    `;
    if (indicatorSlot) indicatorSlot.innerHTML = headerHtml;

    const displayHabits = secHabits.filter(h => String(h.id) !== runningHabitId);

    if (displayHabits.length === 0) {
      container.innerHTML = secHabits.length === 0 ? `
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">\uD83C\uDF3F</span>
          <b style="color: var(--text-muted); font-size: 14px;">\u73FE\u30BB\u30AF\u30B7\u30E7\u30F3(${currentSecObj.name})\u306E\u7FD2\u6163\u306F\u3042\u308A\u307E\u305B\u3093</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">\u3053\u306E\u30BB\u30AF\u30B7\u30E7\u30F3\u306E\u7FD2\u6163\u306F\u3059\u3079\u3066\u9054\u6210\u6E08\u307F\u3067\u3059\uFF01</p>
        </div>
      ` : '';
      return;
    }
    container.innerHTML = displayHabits.map(h => renderSlimHabitCard(h)).join('');

  } else if (scope === 'daily' && type === 'task') {
    const sortedTasks = secSortedTasks(todayTasks);
    const headerHtml = `
      <div class="m-section-indicator task-indicator">
        <span class="m-sec-left">\u26A1 <b>\u672C\u65E5\u306E\u5168\u672A\u5B8C\u4E86\u30BF\u30B9\u30AF</b> (\u5168\u30BB\u30AF\u30B7\u30E7\u30F3)</span>
        <span class="m-sec-count-tag">${sortedTasks.length}\u4EF6</span>
      </div>
    `;
    if (indicatorSlot) indicatorSlot.innerHTML = headerHtml;

    const displayTasks = sortedTasks.filter(t => String(t.id) !== runningTaskId);

    if (displayTasks.length === 0) {
      container.innerHTML = sortedTasks.length === 0 ? `
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">\uD83C\uDF1F</span>
          <b style="color: var(--text-muted); font-size: 14px;">\u672C\u65E5\u306E\u30BF\u30B9\u30AF\u306F\u3059\u3079\u3066\u5B8C\u4E86\u3057\u307E\u3057\u305F\uFF01</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">\u7D20\u6674\u3089\u3057\u3044\u4E00\u65E5\u3067\u3059\u2728</p>
        </div>
      ` : '';
      return;
    }
    container.innerHTML = displayTasks.map(t => renderSlimTaskCard(t)).join('');

  } else if (scope === 'daily' && type === 'habit') {
    const sortedHabits = secSortedHabits(todayHabits);
    const headerHtml = `
      <div class="m-section-indicator habit-indicator">
        <span class="m-sec-left">\uD83C\uDF3F <b>\u672C\u65E5\u306E\u5168\u672A\u5B8C\u4E86\u7FD2\u6163</b> (\u5168\u30BB\u30AF\u30B7\u30E7\u30F3)</span>
        <span class="m-sec-count-tag">${sortedHabits.length}\u4EF6</span>
      </div>
    `;
    if (indicatorSlot) indicatorSlot.innerHTML = headerHtml;

    const displayHabits = sortedHabits.filter(h => String(h.id) !== runningHabitId);

    if (displayHabits.length === 0) {
      container.innerHTML = sortedHabits.length === 0 ? `
        <div style="text-align: center; padding: 48px 20px; color: var(--text-dim);">
          <span style="font-size: 32px; display: block; margin-bottom: 8px;">\uD83C\uDF3F</span>
          <b style="color: var(--text-muted); font-size: 14px;">\u4ECA\u65E5\u306E\u7FD2\u6163\u306F\u3042\u308A\u307E\u305B\u3093</b>
          <p style="font-size: 12px; margin-top: 4px; opacity: 0.8;">\u4ECA\u65E5\u306E\u7FD2\u6163\u306F\u3059\u3079\u3066\u9054\u6210\u6E08\u307F\u3067\u3059\uFF01</p>
        </div>
      ` : '';
      return;
    }
    container.innerHTML = displayHabits.map(h => renderSlimHabitCard(h)).join('');
  }
}

function secSortedTasks(tasks) {
  return tasks.slice().sort((a, b) => getSectionOrder(a.section) - getSectionOrder(b.section));
}

function secSortedHabits(habits) {
  return habits.slice().sort((a, b) => {
    const oA = getSectionOrder(a.section);
    const oB = getSectionOrder(b.section);
    if (oA !== oB) return oA - oB;
    return (a.sortOrder || 0) - (b.sortOrder || 0);
  });
}

function renderSlimHabitCard(habit) {
  const isInProgress = habit.status === 'in_progress';
  const isPaused = habit.status === 'paused';
  const targetDateKey = getTodayDateString(mState.selectedDateOffset);
  const curCount = getItemDayCount(habit, targetDateKey);
  const targetTimes = getItemTargetTimes(habit);
  const isMulti = targetTimes > 1;

  const cardCls = isInProgress ? 'in-progress' : (isPaused ? 'paused' : '');
  const countBadgeHtml = isMulti ? `<span class="m-slim-count-badge ${curCount > 0 ? 'active' : ''}">${curCount}/${targetTimes}\u56DE</span>` : '';
  const timerBadgeHtml = isInProgress
    ? `<span class="m-slim-timer-badge" id="timer-badge-${habit.id}">00:00</span>`
    : (isPaused && (habit.accumulatedSeconds || habit.actMin) ? `<span class="m-slim-timer-badge paused">${formatTime(habit.accumulatedSeconds || (habit.actMin * 60))}</span>` : '');

  const actionBtnHtml = isInProgress
    ? `<button class="btn-slim btn-slim-warning" onclick="event.stopPropagation(); pauseHabit('${habit.id}')">\u23F8 \u4E2D\u65AD</button>
       <button class="btn-slim btn-slim-success" onclick="event.stopPropagation(); completeHabit('${habit.id}')">\u2713 ${isMulti ? (curCount + 1) + '\u56DE\u76EE\u5B8C\u4E86' : '\u5B8C\u4E86'}</button>`
    : (isPaused
      ? `<button class="btn-slim btn-slim-pause-resume" onclick="event.stopPropagation(); startHabit('${habit.id}')">\u25B6 \u518D\u958B</button>
         <button class="btn-slim btn-slim-success" onclick="event.stopPropagation(); completeHabit('${habit.id}')">\u2713 ${isMulti ? (curCount + 1) + '\u56DE\u76EE\u5B8C\u4E86' : '\u5B8C\u4E86'}</button>`
      : `<button class="btn-slim btn-slim-primary" onclick="event.stopPropagation(); startHabit('${habit.id}')">\u25B6 \u958B\u59CB</button>`);

  const cardTapAction = isInProgress
    ? `pauseHabit('${habit.id}')`
    : `startHabit('${habit.id}')`;

  return `
    <div class="m-card-slim ${cardCls}" id="h-card-${habit.id}">
      <div class="m-card-left" onclick="${cardTapAction}" style="cursor:pointer;">
        <span class="m-slim-icon">${isInProgress ? '\u26A1' : (isPaused ? '\u23F8\uFE0F' : '\uD83C\uDF3F')}</span>
        <span class="m-slim-title">${habit.name}</span>
        ${countBadgeHtml}
        ${timerBadgeHtml}
      </div>
      <div class="m-card-actions-slim">
        ${actionBtnHtml}
      </div>
    </div>
  `;
}

function renderSlimTaskCard(task) {
  const isInProgress = task.status === 'in_progress';
  const isPaused = task.status === 'paused';
  const targetDateKey = getTodayDateString(mState.selectedDateOffset);
  const curCount = getItemDayCount(task, targetDateKey);
  const targetTimes = getItemTargetTimes(task);
  const isMulti = targetTimes > 1;
  const carryBadge = task._carriedOverFrom ? `<span style="font-size: 10px; color: var(--accent-cyan); background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); padding: 1px 5px; border-radius: 4px; margin-left: 6px; font-weight: normal;">\u21AA ${task._carriedOverFrom}</span>` : '';

  const cardCls = isInProgress ? 'in-progress' : (isPaused ? 'paused' : '');
  const countBadgeHtml = isMulti ? `<span class="m-slim-count-badge ${curCount > 0 ? 'active' : ''}">${curCount}/${targetTimes}\u56DE</span>` : '';
  const timerBadgeHtml = isInProgress
    ? `<span class="m-slim-timer-badge" id="timer-badge-${task.id}">00:00</span>`
    : (isPaused && (task.accumulatedSeconds || task.actMin) ? `<span class="m-slim-timer-badge paused">${formatTime(task.accumulatedSeconds || (task.actMin * 60))}</span>` : '');

  const actionBtnHtml = isInProgress
    ? `<button class="btn-slim btn-slim-warning" onclick="event.stopPropagation(); pauseTask('${task.id}')">\u23F8 \u4E2D\u65AD</button>
       <button class="btn-slim btn-slim-success" onclick="event.stopPropagation(); completeTask('${task.id}')">\u2713 ${isMulti ? (curCount + 1) + '\u56DE\u76EE\u5B8C\u4E86' : '\u5B8C\u4E86'}</button>`
    : (isPaused
      ? `<button class="btn-slim btn-slim-pause-resume" onclick="event.stopPropagation(); startTask('${task.id}')">\u25B6 \u518D\u958B</button>
         <button class="btn-slim btn-slim-success" onclick="event.stopPropagation(); completeTask('${task.id}')">\u2713 ${isMulti ? (curCount + 1) + '\u56DE\u76EE\u5B8C\u4E86' : '\u5B8C\u4E86'}</button>`
      : `<button class="btn-slim btn-slim-primary" onclick="event.stopPropagation(); startTask('${task.id}')">\u25B6 \u958B\u59CB</button>`);

  const cardTapAction = isInProgress
    ? `pauseTask('${task.id}')`
    : `startTask('${task.id}')`;

  return `
    <div class="m-card-slim ${cardCls}" id="t-card-${task.id}">
      <div class="m-card-left" onclick="${cardTapAction}" style="cursor:pointer;">
        <span class="m-slim-icon">${isInProgress ? '\u26A1' : (isPaused ? '\u23F8\uFE0F' : '\uD83D\uDCDD')}</span>
        <span class="m-slim-title">${task.title}${carryBadge}</span>
        ${countBadgeHtml}
        ${timerBadgeHtml}
      </div>
      <div class="m-card-actions-slim">
        ${actionBtnHtml}
      </div>
    </div>
  `;
}

function calculateHabitStreak(h) {
  if (!h || !h.history || typeof h.history !== 'object') return 0;
  const hist = h.history;
  const today = new Date();
  let streak = 0;
  let d = new Date(today);
  let graceUsed = 0;
  const maxGrace = 1;

  for (let i = 0; i < 365; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const entry = hist[key];
    const isDone = entry && (entry === true || (typeof entry === 'object' && entry.done));

    if (isDone) {
      streak++;
    } else {
      if (i === 0) {
        // 当日未完了ならスキップして昨日から判定
      } else if (streak > 0 && graceUsed < maxGrace) {
        // 過去継続中の1日猶予
        const prevD = new Date(d);
        prevD.setDate(prevD.getDate() - 1);
        const prevKey = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}-${String(prevD.getDate()).padStart(2, '0')}`;
        const prevEntry = hist[prevKey];
        if (prevEntry && (prevEntry === true || (typeof prevEntry === 'object' && prevEntry.done))) {
          graceUsed++;
          d.setDate(d.getDate() - 1);
          continue;
        }
        break;
      } else {
        break;
      }
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

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
  mState.showCompletedAccordion = !mState.showCompletedAccordion;
  renderList();
}

// =========================================================================
// 7. Quick Add Modal & Actions
// =========================================================================

function openQuickAddModal() {
  haptic(15);
  const modal = document.getElementById('m-quick-add-modal');
  const titleInput = document.getElementById('m-quick-task-title');
  const secSelect = document.getElementById('m-quick-task-section');
  const modalTitle = modal ? modal.querySelector('.sheet-title') : null;
  const submitBtn = modal ? modal.querySelector('button[type="submit"]') : null;

  if (modal) modal.classList.add('active');

  const isHabit = mState.activeType === 'habit';
  if (modalTitle) modalTitle.textContent = isHabit ? '\uD83C\uDF3F \u30AF\u30A4\u30C3\u30AF\u7FD2\u6163\u8FFD\u52A0' : '\u26A1 \u30AF\u30A4\u30C3\u30AF\u30BF\u30B9\u30AF\u8FFD\u52A0';
  if (submitBtn) submitBtn.textContent = isHabit ? '\uD83C\uDF3F \u7FD2\u6163\u3092\u8FFD\u52A0' : '\u26A1 \u8FFD\u52A0\u3059\u308B';

  if (titleInput) {
    titleInput.value = '';
    titleInput.placeholder = isHabit ? '\u7FD2\u6163\u540D\u3092\u5165\u529B... (\u4F8B: \u6C342L\u98F2\u3080\u3001\u8AAD\u66F815\u5206)' : '\u30BF\u30B9\u30AF\u540D\u3092\u5165\u529B...';
    setTimeout(() => titleInput.focus(), 250);
  }

  if (secSelect) {
    const curSecId = detectCurrentSectionId();
    const curSec = SECTIONS.find(s => s.id === curSecId);
    if (curSec) secSelect.value = curSec.name.replace(/^[^\w\s]*\s*/, '');
  }

  if (window.history && window.history.pushState) {
    window.history.pushState({ modal: 'quick-add' }, '');
    window.addEventListener('popstate', function onPop(e) {
      closeQuickAddModal(true);
      window.removeEventListener('popstate', onPop);
    });
  }
}

function closeQuickAddModal(fromHistory = false) {
  const modal = document.getElementById('m-quick-add-modal');
  if (modal) modal.classList.remove('active');
  if (!fromHistory && window.history && window.history.state && window.history.state.modal === 'quick-add') {
    window.history.back();
  }
}

function handleQuickAddTask(e) {
  e.preventDefault();
  const titleInput = document.getElementById('m-quick-task-title');
  const secSelect = document.getElementById('m-quick-task-section');
  const estSelect = document.getElementById('m-quick-task-est');

  const title = titleInput ? titleInput.value.trim() : '';
  if (!title) return;

  const section = secSelect ? secSelect.value : '\u7B2C3\u30BB\u30AF\u30B7\u30E7\u30F3';
  const estMin = estSelect ? parseInt(estSelect.value, 10) : 25;
  const dateKey = getTodayDateString(mState.selectedDateOffset);

  if (mState.activeType === 'habit') {
    const newHabit = {
      id: 'h_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: title,
      section: section,
      targetMin: estMin,
      targetTimes: 1,
      sortOrder: (mState.habits.length + 1),
      recurrence: { type: 'everyday' },
      history: {},
      executionLogs: [],
      status: 'uncompleted'
    };
    mState.habits.push(newHabit);
    saveLocalHabits();
    closeQuickAddModal();
    renderMobileApp();
    showMobileUndoToast(`\uD83C\uDF3F \u300C${title}\u300D\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F`, () => {
      recordMobileHabitDeletion(newHabit.id, newHabit.name);
      mState.habits = mState.habits.filter(h => h.id !== newHabit.id);
      saveLocalHabits();
      renderMobileApp();
    });
  } else {
    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: title,
      scheduledDate: dateKey,
      section: section,
      estMin: estMin,
      status: 'uncompleted',
      bucket: 'today'
    };
    mState.tasks.push(newTask);
    saveLocalTasks();
    closeQuickAddModal();
    renderMobileApp();
    showMobileUndoToast(`\u26A1 \u300C${title}\u300D\u3092\u8FFD\u52A0\u3057\u307E\u3057\u305F`, () => {
      mState.tasks = mState.tasks.filter(t => t.id !== newTask.id);
      saveLocalTasks();
      renderMobileApp();
    });
  }
}

// =========================================================================
// 8. Settings Modal & Application Bootstrap
// =========================================================================

function openSettingsModal() {
  haptic(15);
  const modal = document.getElementById('m-settings-modal');
  const input = document.getElementById('m-gas-url-input');
  if (input) input.value = getGasUrl();
  if (modal) modal.classList.add('active');

  if (window.history && window.history.pushState) {
    window.history.pushState({ modal: 'settings' }, '');
    window.addEventListener('popstate', function onPop(e) {
      closeSettingsModal(true);
      window.removeEventListener('popstate', onPop);
    });
  }
}

function closeSettingsModal(fromHistory = false) {
  const modal = document.getElementById('m-settings-modal');
  if (modal) modal.classList.remove('active');
  if (!fromHistory && window.history && window.history.state && window.history.state.modal === 'settings') {
    window.history.back();
  }
}

function saveSettings() {
  haptic(20);
  const input = document.getElementById('m-gas-url-input');
  if (input) {
    setGasUrl(input.value.trim());
    closeSettingsModal();
    pullFromCloud(true, false);
  }
}

async function initMobileApp() {
  loadLocalData();
  syncBottomNavButtonsUI();
  syncMobileVersionBadges();
  checkAndRunDayRollover();
  renderMobileApp();

  if (getGasUrl()) {
    pullFromCloud(true, false).catch(e => {
      console.warn('Initial cloud pull failed/skipped:', e);
    });
  }

  // Active Timer Loop (1 sec - Tasks & Habits)
  if (activeTimerInterval) clearInterval(activeTimerInterval);
  activeTimerInterval = setInterval(() => {
    const activeTask = mState.tasks.find(t => String(t.id) === String(mState.activeTaskId) && t.status === 'in_progress');
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
      pullFromCloud(false, true);
    }
  }, 15000);

  // Foreground auto-sync
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

  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.update().catch(() => {});
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              window.location.reload();
            }
          });
        }
      });
    }).catch(err => {
      console.log('SW registration skipped:', err);
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileApp);
} else {
  initMobileApp();
}

async function forceHardRefresh() {
  haptic(30);
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        await reg.unregister();
      }
    }
  } catch (e) {
    console.error('Error clearing cache:', e);
  }
  window.location.href = window.location.pathname + '?r=' + Date.now();
}

function syncMobileVersionBadges() {
  const ver = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'v1.5.2';
  document.querySelectorAll('.version-capsule-badge').forEach(el => {
    el.textContent = ver;
  });
}
