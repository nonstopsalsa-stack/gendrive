/**
 * Gendrive - Master Configuration & Hierarchical Definitions
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Hierarchical Master Definitions
// =========================================================================

const SECTIONS_CONFIG = [
  { id: 'sec_1', name: '第1セッション', start: 3, end: 6, label: '🌅 第1セッション (03:00 - 06:00)', desc: '起床・静寂の自己投資・思考整理', startStr: '03:00', endStr: '06:00' },
  { id: 'sec_2', name: '朝オペ', start: 6, end: 8.5, label: '🍳 朝オペ (06:00 - 08:30)', desc: '家事・育児・家族タイム (タスク不可 / 家事ハビット実行)', startStr: '06:00', endStr: '08:30' },
  { id: 'sec_3', name: '第2セッション', start: 8.5, end: 12, label: '⚡ 第2セッション (08:30 - 12:00)', desc: '最重要ワーク・動画制作・クリエイティブ実務', startStr: '08:30', endStr: '12:00' },
  { id: 'sec_4', name: '第3セッション', start: 12, end: 17, label: '🛠️ 第3セッション (12:00 - 17:00)', desc: '編集実務・品質チェック・外注管理・クライアント対応', startStr: '12:00', endStr: '17:00' },
  { id: 'sec_5', name: '夜オペ', start: 17, end: 21, label: '🍲 夜オペ (17:00 - 21:00)', desc: '夕食・家事・育児・家族団らん (タスク不可 / 家事ハビット実行)', startStr: '17:00', endStr: '21:00' },
  { id: 'sec_6', name: '第4セッション', start: 21, end: 23, label: '🌙 第4セッション (21:00 - 23:00)', desc: '夜日記・今日の勝ち・感謝3つ・翌日準備', startStr: '21:00', endStr: '23:00' }
];

const DOMAINS_DATA = {
  'PN1': {
    name: 'PN1系 稼ぐ',
    items: ['資産', 'ビジネス (動画編集制作)', 'ビジネス (ライティング)', 'ビジネス (デザイン)', 'ビジネス (AI品質工学)', '習慣化', 'AI活用', 'SNS活用', 'ツール活用']
  },
  'PN2': {
    name: 'PN2系 動く',
    items: ['計画運用', 'アイテム', 'スキルアップ', 'インプット', 'アウトプット']
  },
  'PN3': {
    name: 'PN3系 ストレスを減らす',
    items: ['時間効率化', '健康管理', 'マインド管理', '住空間改善', '人間関係管理', '家事', '育児', 'その他家族関連タスク']
  },
  'PN4': {
    name: 'PN4系 夢中を増やす',
    items: ['GS', '音楽活動', 'サルサダンス', '格闘技', '料理', 'アウトドア']
  },
  'PN5': {
    name: 'PN5系 貢献する',
    items: ['家族支援', '寄付貢献', '事業貢献', '政治・経済']
  }
};

const DEPTS_DATA = {
  'CEO直轄': {
    name: 'CEO直轄 / 経営企画',
    items: ['秘書室', '経営戦略部', '新規事業部']
  },
  '制作本部': {
    name: '制作本部',
    items: ['企画部', '制作部', 'クリエイティブ部']
  },
  '営業マーケ本部': {
    name: '営業マーケ本部',
    items: ['営業部', 'マーケティング部', '広報部']
  },
  '管理本部': {
    name: '管理本部',
    items: ['経理部', '財務部', '人事部', '総務部', '購買部', '情シス部']
  },
  'ガバナンス本部': {
    name: 'ガバナンス本部',
    items: ['法務部', '知財部']
  },
  '開発・QA': {
    name: '開発 / 品質保証',
    items: ['開発部', '品質保証部']
  }
};

const PROJECTS_DATA = {
  'ビジネス': {
    name: '💼 ビジネス系',
    items: ['初案件獲得', '初期量産', '単価向上', 'ヒルウラ攻略', 'チーム構築', 'コミュニティ拡張', 'コンテンツ販売', '動画クリエイター', 'AI品質工学', '事業継続']
  },
  'プライベート': {
    name: '🏡 プライベート系',
    items: ['96ppk', 'Liberty seed', 'CONTINGENCY', 'EXODUS', 'エルグランド獲得', 'マンション移住', '断捨離', 'GSステップアップ', '緊急事態脱出', '100PayBack', '生活復旧', '2026夏休み', '恵蓮部屋整備', 'Roblox開発', 'PCスマホカメラ導入', '自己投資', '音楽機材', '音楽スキル向上', 'ラズパイPython']
  }
};

// =========================================================================
// 2. 6-Axis Load / Evaluation Matrix Definitions
// =========================================================================

const MATRIX_KEYS = ['importance', 'urgency', 'mentalLoad', 'physicalLoad', 'frogLevel', 'interestLevel'];

const DEFAULT_MATRIX = {
  importance: 'mid',
  urgency: 'mid',
  mentalLoad: 'mid',
  physicalLoad: 'mid',
  frogLevel: 'mid',
  interestLevel: 'mid'
};

// =========================================================================
// 3. Default Task & Habit Templates and Sticky States
// =========================================================================

const DEFAULT_TASK_DEFAULTS = {
  bucket: 'today',
  label: 'p1',
  taskType: 'single',
  timingType: 'section',
  section: '第2セッション',
  customStart: '13:00',
  customEnd: '15:00',
  estMin: 15,
  recType: 'everyday',
  domainMajor: 'PN2',
  domainMinor: '',
  deptMajor: 'HONBU',
  deptMinor: '',
  projMajor: 'BIZ',
  projMinor: '',
  tags: [],
  matrix: { ...DEFAULT_MATRIX }
};

const DEFAULT_HABIT_DEFAULTS = {
  displayType: 'section',
  section: '第2セッション',
  customStart: '13:00',
  customEnd: '17:00',
  recType: 'everyday',
  dailyTimes: 2,
  weeklyTimes: 3,
  intervalDays: 2,
  monthInterval: 1,
  monthTiming: 'specific_day',
  monthDay: 1,
  weekdays: [1, 2, 3, 4, 5],
  targetMin: 5,
  domainMajor: 'PN1',
  domainMinor: '',
  deptMajor: 'CEO直轄',
  deptMinor: '',
  projMajor: 'ビジネス',
  projMinor: '',
  tags: [],
  matrix: { ...DEFAULT_MATRIX }
};

let lastTaskDefaults = { ...DEFAULT_TASK_DEFAULTS };
let lastHabitDefaults = { ...DEFAULT_HABIT_DEFAULTS };

/**
 * ハビット・定期タスク・タスクの直近最大10回の実績平均所要時間（分）を自動計算
 * 10回未満（1回〜9回）はその回数分の実績平均値（1回のみならその1回の実績値）を算出
 * 1度も実績がない場合は新規デフォルト値（ハビット: 5分, タスク: 15分）を返す
 */
function calculateMovingAverageDuration(item, itemType = null) {
  if (!item) return 15;
  const isHabit = itemType === 'habit' || (item.id && String(item.id).startsWith('H')) || (!item.title && item.name);
  const defaultFallback = isHabit ? 5 : 15;

  const durations = [];

  // 1. executionLogs (完了ログ配列、新しい順)
  if (Array.isArray(item.executionLogs) && item.executionLogs.length > 0) {
    const sorted = [...item.executionLogs].sort((a, b) => new Date(b.completedAt || b.dateKey) - new Date(a.completedAt || a.dateKey));
    for (const log of sorted) {
      if (typeof log.durationMin === 'number' && log.durationMin > 0) {
        durations.push(log.durationMin);
        if (durations.length >= 10) break;
      }
    }
  }

  // 2. task.history (配列) または habit.history (オブジェクト) から補完
  if (durations.length < 10 && item.history) {
    if (Array.isArray(item.history)) {
      const reversed = [...item.history].reverse();
      for (const h of reversed) {
        if (durations.length >= 10) break;
        if (typeof h.durationMin === 'number' && h.durationMin > 0) {
          durations.push(h.durationMin);
        }
      }
    } else if (typeof item.history === 'object') {
      const entries = Object.entries(item.history)
        .sort((a, b) => b[0].localeCompare(a[0])); // 日付降順
      for (const [dk, val] of entries) {
        if (durations.length >= 10) break;
        if (typeof val === 'object' && val !== null && typeof val.durationMin === 'number' && val.durationMin > 0) {
          durations.push(val.durationMin);
        }
      }
    }
  }

  // 3. habit.durationLogs から補完
  if (durations.length < 10 && Array.isArray(item.durationLogs)) {
    const reversed = [...item.durationLogs].reverse();
    for (const d of reversed) {
      if (durations.length >= 10) break;
      if (typeof d === 'number' && d > 0) {
        durations.push(d);
      }
    }
  }

  // 4. 定期タスクで同じタイトルの過去完了タスクがあればそこからも集計
  if (durations.length < 10 && !isHabit && typeof state !== 'undefined' && state && Array.isArray(state.tasks)) {
    const pastSameTasks = state.tasks.filter(t => t.id !== item.id && t.title === item.title && t.status === 'completed' && t.actMin > 0);
    for (const pt of pastSameTasks) {
      if (durations.length >= 10) break;
      durations.push(pt.actMin);
    }
  }

  // 実績が1回以上ある場合はその平均値（四捨五入）
  if (durations.length > 0) {
    const sum = durations.reduce((acc, v) => acc + v, 0);
    return Math.max(1, Math.round(sum / durations.length));
  }

  // 1回も実績がない場合：ユーザー指定値があればそれ、なければデフォルト（ハビット:5分, タスク:15分）
  if (isHabit) {
    return item.targetMin || 5;
  } else {
    return item.estMin || 15;
  }
}

/**
 * セクションの現在時刻タイムスケール進捗率（0〜100%）を計算
 * セクション時間外や過去/未来日なら null を返す
 */
function getSectionTimeProgress(sectionName) {
  if (typeof state !== 'undefined' && state && state.selectedDateOffset !== 0) {
    return null; // 今日以外はセクションスケール非アクティブ
  }
  const s = SECTIONS_CONFIG.find(sec => sec.name === sectionName);
  if (!s) return null;

  const now = new Date();
  const curHours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;

  if (curHours >= s.start && curHours < s.end) {
    const totalDurationHours = s.end - s.start;
    const elapsedHours = curHours - s.start;
    const pct = Math.min(100, Math.max(0, (elapsedHours / totalDurationHours) * 100));
    return Math.round(pct * 10) / 10;
  }
  return null;
}

/**
 * タスクのリアルタイムタイムスケール進捗率（0〜100%）を計算
 */
function getTaskTimeProgress(task) {
  if (!task || (task.status !== 'in_progress' && task.status !== 'paused')) {
    return 0;
  }

  let totalSec = task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0);
  if (task.status === 'in_progress' && task.startTimestamp) {
    const sessionSec = Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000));
    totalSec += sessionSec;
  }

  const estMin = (typeof getEstimatedDuration === 'function')
    ? getEstimatedDuration(task, 'task').targetMin
    : (task.estMin || 15);
  const targetSec = Math.max(60, estMin * 60);

  const pct = Math.min(100, Math.max(0, (totalSec / targetSec) * 100));
  return Math.round(pct * 10) / 10;
}

/**
 * ハビットのリアルタイムタイムスケール進捗率（0〜100%）を計算
 */
function getHabitTimeProgress(habit) {
  if (!habit || (habit.status !== 'in_progress' && habit.status !== 'paused')) {
    return 0;
  }

  let totalSec = habit.accumulatedSeconds || (habit.actMin ? habit.actMin * 60 : 0);
  if (habit.status === 'in_progress' && habit.startTimestamp) {
    totalSec += Math.max(0, Math.floor((Date.now() - habit.startTimestamp) / 1000));
  }

  const targetMin = (typeof getEstimatedDuration === 'function')
    ? getEstimatedDuration(habit, 'habit').targetMin
    : (habit.targetMin || 5);
  const targetSec = Math.max(60, targetMin * 60);

  const pct = Math.min(100, Math.max(0, (totalSec / targetSec) * 100));
  return Math.round(pct * 10) / 10;
}



// Tag normalizer utility available globally
function normalizeTags(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return Array.from(new Set(raw.map(t => String(t).trim().replace(/^#/, '')).filter(Boolean)));
  }
  if (typeof raw === 'string') {
    return Array.from(new Set(raw.split(/[,、\s]+/).map(t => t.trim().replace(/^#/, '')).filter(Boolean)));
  }
  return [];
}

// 2-Step Cascade Select Helper available globally
function updateMinorSelectOptions(majorSelectId, minorSelectId, dataSource, selectedVal = null) {
  const majorSelect = document.getElementById(majorSelectId);
  const minorSelect = document.getElementById(minorSelectId);
  if (!majorSelect || !minorSelect) return;

  const majorKey = majorSelect.value;
  minorSelect.innerHTML = '<option value="">(未設定)</option>';

  if (majorKey && dataSource && dataSource[majorKey]) {
    const items = dataSource[majorKey].items || [];
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item;
      opt.textContent = item;
      if (selectedVal && selectedVal === item) {
        opt.selected = true;
      }
      minorSelect.appendChild(opt);
    });
  }
}

// Global Tag Suggestions Helpers
function getAllRegisteredTags() {
  const tagCounts = {};
  if (typeof state !== 'undefined' && state) {
    if (Array.isArray(state.habits)) {
      state.habits.forEach(h => {
        if (h.tags && Array.isArray(h.tags)) {
          h.tags.forEach(t => {
            const clean = String(t).trim().replace(/^#/, '');
            if (clean) tagCounts[clean] = (tagCounts[clean] || 0) + 1;
          });
        }
      });
    }
    if (Array.isArray(state.tasks)) {
      state.tasks.forEach(t => {
        if (t.tags && Array.isArray(t.tags)) {
          t.tags.forEach(tag => {
            const clean = String(tag).trim().replace(/^#/, '');
            if (clean) tagCounts[clean] = (tagCounts[clean] || 0) + 1;
          });
        }
      });
    }
  }
  return Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
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
        ${isSelected ? '✓ ' : '+ '}#${name}
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



