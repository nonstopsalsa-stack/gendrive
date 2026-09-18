/**
 * Gendrive - Dynamic Profile Master Management Service
 * 哲生 (AI Company OS & Personal OS Engine)
 * Domain, Department, and Project Hierarchical Profiles CRUD & Visibility Engine
 */

const PROFILE_MASTERS_STORAGE_KEY = 'gendrive_profile_masters';

// In-Memory Profile Masters referencing global objects
let PROFILE_MASTERS = {
  domains: (typeof DOMAINS_DATA !== 'undefined') ? DOMAINS_DATA : {},
  depts: (typeof DEPTS_DATA !== 'undefined') ? DEPTS_DATA : {},
  projects: (typeof PROJECTS_DATA !== 'undefined') ? PROJECTS_DATA : {}
};

let DELETED_MAJORS = {
  domains: [],
  depts: [],
  projects: []
};

function ensureMasterNormalized(catObj) {
  if (!catObj || typeof catObj !== 'object') return;
  Object.keys(catObj).forEach(key => {
    const item = catObj[key];
    if (item && typeof item === 'object') {
      if (!Array.isArray(item.items)) item.items = [];
      if (!Array.isArray(item.disabledItems)) item.disabledItems = [];
      if (typeof item.enabled === 'undefined') item.enabled = true;
    }
  });
}

function syncProfileGlobals() {
  if (typeof window !== 'undefined') {
    window.PROFILE_MASTERS = PROFILE_MASTERS;
    window.DOMAINS_DATA = PROFILE_MASTERS.domains;
    window.DEPTS_DATA = PROFILE_MASTERS.depts;
    window.PROJECTS_DATA = PROFILE_MASTERS.projects;
  }
  if (typeof state !== 'undefined' && state) {
    state.profileMasters = PROFILE_MASTERS;
  }
}

/**
 * プロファイルマスターのロード
 */
function loadProfileMasters() {
  PROFILE_MASTERS.domains = (typeof DOMAINS_DATA !== 'undefined') ? DOMAINS_DATA : {};
  PROFILE_MASTERS.depts = (typeof DEPTS_DATA !== 'undefined') ? DEPTS_DATA : {};
  PROFILE_MASTERS.projects = (typeof PROJECTS_DATA !== 'undefined') ? PROJECTS_DATA : {};

  ensureMasterNormalized(PROFILE_MASTERS.domains);
  ensureMasterNormalized(PROFILE_MASTERS.depts);
  ensureMasterNormalized(PROFILE_MASTERS.projects);

  try {
    const raw = localStorage.getItem(PROFILE_MASTERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed._deletedMajors && typeof parsed._deletedMajors === 'object') {
          DELETED_MAJORS = { ...DELETED_MAJORS, ...parsed._deletedMajors };
        }

        ['domains', 'depts', 'projects'].forEach(cat => {
          if (parsed[cat] && typeof parsed[cat] === 'object') {
            const currentCatObj = PROFILE_MASTERS[cat];

            Object.keys(parsed[cat]).forEach(majorKey => {
              const savedRow = parsed[cat][majorKey];
              if (!currentCatObj[majorKey]) {
                currentCatObj[majorKey] = {
                  name: savedRow.name || majorKey,
                  enabled: savedRow.enabled !== false,
                  items: Array.isArray(savedRow.items) ? [...savedRow.items] : [],
                  disabledItems: Array.isArray(savedRow.disabledItems) ? [...savedRow.disabledItems] : []
                };
              } else {
                currentCatObj[majorKey].name = savedRow.name || currentCatObj[majorKey].name;
                currentCatObj[majorKey].enabled = savedRow.enabled !== false;
                currentCatObj[majorKey].disabledItems = Array.isArray(savedRow.disabledItems) ? [...savedRow.disabledItems] : [];
                if (Array.isArray(savedRow.items)) {
                  const mergedItems = [...savedRow.items];
                  currentCatObj[majorKey].items.forEach(dItem => {
                    if (!mergedItems.includes(dItem) && !currentCatObj[majorKey].disabledItems.includes(dItem)) {
                      mergedItems.push(dItem);
                    }
                  });
                  currentCatObj[majorKey].items = mergedItems;
                }
              }
            });

            // 削除された大分類の除去
            if (Array.isArray(DELETED_MAJORS[cat])) {
              DELETED_MAJORS[cat].forEach(delKey => {
                delete currentCatObj[delKey];
              });
            }
          }
        });
      }
    }
  } catch (e) {
    console.error('Failed to load profile masters from storage:', e);
  }

  syncProfileGlobals();
  return PROFILE_MASTERS;
}

/**
 * プロファイルマスターの保存
 */
function saveProfileMasters() {
  try {
    const payload = {
      domains: PROFILE_MASTERS.domains,
      depts: PROFILE_MASTERS.depts,
      projects: PROFILE_MASTERS.projects,
      _deletedMajors: DELETED_MAJORS
    };
    localStorage.setItem(PROFILE_MASTERS_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    console.error('Failed to save profile masters to storage:', e);
  }
  syncProfileGlobals();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gendrive:profiles-updated', { detail: PROFILE_MASTERS }));
  }
}

/**
 * プロファイル項目の使用中タスク・ハビット件数を集計
 */
function countProfileUsage(category, majorKey, minorName = null) {
  let count = 0;
  if (typeof state === 'undefined' || !state) return 0;

  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const habits = Array.isArray(state.habits) ? state.habits : [];

  const catKey = (category === 'domain' || category === 'domains') ? 'domain'
    : (category === 'dept' || category === 'depts') ? 'dept'
    : 'proj';

  if (catKey === 'domain') {
    tasks.forEach(t => {
      const matchMajor = t.domainMajor === majorKey;
      if (minorName) {
        if (matchMajor && (t.domainMinor === minorName || t.domain === minorName)) count++;
      } else if (matchMajor) {
        count++;
      }
    });
    habits.forEach(h => {
      const matchMajor = h.domainMajor === majorKey;
      if (minorName) {
        if (matchMajor && (h.domainMinor === minorName || h.domain === minorName)) count++;
      } else if (matchMajor) {
        count++;
      }
    });
  } else if (catKey === 'dept') {
    tasks.forEach(t => {
      const matchMajor = t.deptMajor === majorKey;
      if (minorName) {
        if (matchMajor && (t.deptMinor === minorName || t.dept === minorName)) count++;
      } else if (matchMajor) {
        count++;
      }
    });
    habits.forEach(h => {
      const matchMajor = h.deptMajor === majorKey;
      if (minorName) {
        if (matchMajor && (h.deptMinor === minorName || h.dept === minorName)) count++;
      } else if (matchMajor) {
        count++;
      }
    });
  } else if (catKey === 'proj') {
    tasks.forEach(t => {
      const matchMajor = t.projMajor === majorKey;
      if (minorName) {
        if (matchMajor && (t.projMinor === minorName || t.proj === minorName)) count++;
      } else if (matchMajor) {
        count++;
      }
    });
    habits.forEach(h => {
      const matchMajor = h.projMajor === majorKey;
      if (minorName) {
        if (matchMajor && (h.projMinor === minorName || h.proj === minorName)) count++;
      } else if (matchMajor) {
        count++;
      }
    });
  }

  return count;
}

/**
 * プロファイル操作ヘルパー
 */
function addProfileMinor(category, majorKey, minorName) {
  const cat = (category === 'domain') ? 'domains' : (category === 'dept') ? 'depts' : (category === 'proj') ? 'projects' : category;
  const cleanName = String(minorName || '').trim();
  if (!cleanName) return { success: false, message: '名前を入力してください' };

  const targetCat = PROFILE_MASTERS[cat];
  if (!targetCat || !targetCat[majorKey]) return { success: false, message: '大分類が見つかりません' };

  if (!Array.isArray(targetCat[majorKey].items)) targetCat[majorKey].items = [];
  if (targetCat[majorKey].items.includes(cleanName)) {
    return { success: false, message: 'すでに同じ名前の項目が存在します' };
  }

  targetCat[majorKey].items.push(cleanName);
  if (Array.isArray(targetCat[majorKey].disabledItems)) {
    targetCat[majorKey].disabledItems = targetCat[majorKey].disabledItems.filter(n => n !== cleanName);
  }
  saveProfileMasters();
  return { success: true };
}

function deleteProfileMinor(category, majorKey, minorName) {
  const cat = (category === 'domain') ? 'domains' : (category === 'dept') ? 'depts' : (category === 'proj') ? 'projects' : category;
  const targetCat = PROFILE_MASTERS[cat];
  if (!targetCat || !targetCat[majorKey]) return { success: false, message: '大分類が見つかりません' };

  const usageCount = countProfileUsage(cat, majorKey, minorName);
  if (usageCount > 0) {
    const label = cat === 'projects' ? 'プロジェクト' : cat === 'depts' ? '会社部門' : 'ドメイン';
    const confirmMsg = `⚠️ この${label}「${minorName}」は現在 ${usageCount} 件のタスクまたはハビットで使用されています！\n\n完全削除すると既存データの紐付けに影響が出る恐れがあります。\n削除ではなく「非表示（OFF）」にすることを強く推奨します。\n\nそれでも完全に削除しますか？`;
    if (!confirm(confirmMsg)) {
      return { success: false, cancelled: true };
    }
  }

  targetCat[majorKey].items = (targetCat[majorKey].items || []).filter(n => n !== minorName);
  if (Array.isArray(targetCat[majorKey].disabledItems)) {
    targetCat[majorKey].disabledItems = targetCat[majorKey].disabledItems.filter(n => n !== minorName);
  }
  saveProfileMasters();
  return { success: true };
}

function toggleProfileMinor(category, majorKey, minorName, enable) {
  const cat = (category === 'domain') ? 'domains' : (category === 'dept') ? 'depts' : (category === 'proj') ? 'projects' : category;
  const targetCat = PROFILE_MASTERS[cat];
  if (!targetCat || !targetCat[majorKey]) return { success: false };

  if (!Array.isArray(targetCat[majorKey].disabledItems)) {
    targetCat[majorKey].disabledItems = [];
  }

  if (enable) {
    targetCat[majorKey].disabledItems = targetCat[majorKey].disabledItems.filter(n => n !== minorName);
  } else {
    if (!targetCat[majorKey].disabledItems.includes(minorName)) {
      targetCat[majorKey].disabledItems.push(minorName);
    }
  }
  saveProfileMasters();
  return { success: true };
}

function addProfileMajor(category, majorKey, majorName) {
  const cat = (category === 'domain') ? 'domains' : (category === 'dept') ? 'depts' : (category === 'proj') ? 'projects' : category;
  const cleanKey = String(majorKey || '').trim();
  const cleanName = String(majorName || cleanKey).trim();
  if (!cleanKey) return { success: false, message: '大分類キーを入力してください' };

  const targetCat = PROFILE_MASTERS[cat];
  if (!targetCat) return { success: false, message: 'カテゴリが見つかりません' };
  if (targetCat[cleanKey]) return { success: false, message: 'すでに同じキーの大分類が存在します' };

  targetCat[cleanKey] = {
    name: cleanName,
    enabled: true,
    items: [],
    disabledItems: []
  };
  if (Array.isArray(DELETED_MAJORS[cat])) {
    DELETED_MAJORS[cat] = DELETED_MAJORS[cat].filter(k => k !== cleanKey);
  }
  saveProfileMasters();
  return { success: true };
}

function deleteProfileMajor(category, majorKey) {
  const cat = (category === 'domain') ? 'domains' : (category === 'dept') ? 'depts' : (category === 'proj') ? 'projects' : category;
  const targetCat = PROFILE_MASTERS[cat];
  if (!targetCat || !targetCat[majorKey]) return { success: false };

  const usageCount = countProfileUsage(cat, majorKey);
  if (usageCount > 0) {
    const label = cat === 'projects' ? 'プロジェクト大分類' : cat === 'depts' ? '会社部門本部' : 'ドメイン大分類';
    const confirmMsg = `⚠️ この${label}「${targetCat[majorKey].name || majorKey}」は現在 ${usageCount} 件のタスクまたはハビットで使用されています！\n\n完全削除すると配下の小分類も含め紐付けが解除されます。削除ではなく「非表示（OFF）」にすることを推奨します。\n\nそれでも完全に削除しますか？`;
    if (!confirm(confirmMsg)) {
      return { success: false, cancelled: true };
    }
  }

  delete targetCat[majorKey];
  if (!Array.isArray(DELETED_MAJORS[cat])) DELETED_MAJORS[cat] = [];
  if (!DELETED_MAJORS[cat].includes(majorKey)) DELETED_MAJORS[cat].push(majorKey);

  saveProfileMasters();
  return { success: true };
}

function toggleProfileMajor(category, majorKey, enable) {
  const cat = (category === 'domain') ? 'domains' : (category === 'dept') ? 'depts' : (category === 'proj') ? 'projects' : category;
  const targetCat = PROFILE_MASTERS[cat];
  if (!targetCat || !targetCat[majorKey]) return { success: false };
  targetCat[majorKey].enabled = Boolean(enable);
  saveProfileMasters();
  return { success: true };
}

/**
 * 2段階カスケード小分類セレクトボックスの動的更新（非表示項目の完全除外 ＆ 0件時ハイフン無効化）
 */
function updateMinorSelectOptions(majorSelectId, minorSelectId, dataSource, selectedVal = null) {
  const majorSelect = document.getElementById(majorSelectId);
  const minorSelect = document.getElementById(minorSelectId);
  if (!majorSelect || !minorSelect) return;

  const majorKey = majorSelect.value;

  const dataMap = dataSource || ((majorSelectId.includes('domain') || majorSelectId.includes('dom')) ? PROFILE_MASTERS.domains
    : (majorSelectId.includes('dept')) ? PROFILE_MASTERS.depts
    : PROFILE_MASTERS.projects);

  if (!majorKey || !dataMap || !dataMap[majorKey]) {
    minorSelect.innerHTML = '<option value="">ー</option>';
    minorSelect.disabled = true;
    return;
  }

  const data = dataMap[majorKey];
  const items = Array.isArray(data.items) ? data.items : [];
  const disabledItems = Array.isArray(data.disabledItems) ? data.disabledItems : [];

  // 有効な（非表示でない）項目のみを厳格に抽出（非表示項目は完全に見えなくする）
  const enabledItems = items.filter(item => {
    const name = (typeof item === 'object' && item !== null) ? item.name : item;
    const isExplicitlyDisabled = (typeof item === 'object' && item !== null && item.enabled === false);
    return !isExplicitlyDisabled && !disabledItems.includes(name);
  });

  // 全ての項目を非表示にして見せる項目がないときは、「ー」を表示してプルダウンも無効化
  if (enabledItems.length === 0) {
    minorSelect.innerHTML = '<option value="">ー</option>';
    minorSelect.disabled = true;
    return;
  }

  // 有効な項目が存在する場合
  minorSelect.disabled = false;
  minorSelect.innerHTML = '<option value="">(未設定)</option>';

  enabledItems.forEach(item => {
    const name = (typeof item === 'object' && item !== null) ? item.name : item;
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (selectedVal && selectedVal === name) {
      opt.selected = true;
    }
    minorSelect.appendChild(opt);
  });
}

/**
 * 大分類セレクトボックスの動的更新（非表示項目の完全除外 ＆ 0件時ハイフン無効化）
 */
function populateMajorSelectOptions(selectId, dataSource, placeholder = '(大分類を選択)', selectedVal = null) {
  const select = document.getElementById(selectId);
  if (!select) return;

  const dataMap = dataSource || ((selectId.includes('domain') || selectId.includes('dom')) ? PROFILE_MASTERS.domains
    : (selectId.includes('dept')) ? PROFILE_MASTERS.depts
    : PROFILE_MASTERS.projects);

  if (!dataMap) {
    select.innerHTML = '<option value="">ー</option>';
    select.disabled = true;
    return;
  }

  const enabledKeys = Object.keys(dataMap).filter(key => {
    const data = dataMap[key];
    return data && data.enabled !== false;
  });

  if (enabledKeys.length === 0) {
    select.innerHTML = '<option value="">ー</option>';
    select.disabled = true;
    return;
  }

  select.disabled = false;
  select.innerHTML = `<option value="">${placeholder}</option>`;

  enabledKeys.forEach(key => {
    const data = dataMap[key];
    const name = data.name || key;
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = name;
    if (selectedVal && selectedVal === key) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

// =========================================================================
// UI Rendering for Master Board Profiles Subtab
// =========================================================================

function switchProfileCategory(cat) {
  if (typeof state !== 'undefined' && state) {
    state.profileActiveCategory = cat;
  }
  document.querySelectorAll('.profile-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
  renderProfileMasterView();
}

function renderProfileMasterView() {
  const container = document.getElementById('profile-management-stage');
  if (!container) return;

  const currentCat = (typeof state !== 'undefined' && state && state.profileActiveCategory)
    ? state.profileActiveCategory
    : 'projects';

  document.querySelectorAll('.profile-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cat === currentCat);
  });

  const catData = PROFILE_MASTERS[currentCat] || {};
  const majorKeys = Object.keys(catData);

  const catMeta = {
    projects: { label: 'プロジェクト', majorName: 'プロジェクト大分類', minorName: 'プロジェクト名', icon: '💼' },
    depts: { label: '会社部門', majorName: '本部 / 統括', minorName: '部署 / 課', icon: '🏢' },
    domains: { label: 'ドメイン', majorName: '人生ドメイン', minorName: 'ドメイン詳細', icon: '🌐' }
  }[currentCat] || { label: '項目', majorName: '大分類', minorName: '小分類', icon: '🏷️' };

  let html = `
    <div class="profile-cards-grid">
  `;

  majorKeys.forEach(majorKey => {
    const majorObj = catData[majorKey];
    const isMajorEnabled = majorObj.enabled !== false;
    const items = Array.isArray(majorObj.items) ? majorObj.items : [];
    const disabledItems = Array.isArray(majorObj.disabledItems) ? majorObj.disabledItems : [];
    const activeItemsCount = items.filter(it => !disabledItems.includes(it)).length;

    html += `
      <div class="profile-major-card ${isMajorEnabled ? '' : 'is-disabled'}">
        <div class="profile-major-header">
          <div class="profile-major-title-wrap">
            <label class="profile-switch" title="大分類の表示/非表示を切り替え">
              <input type="checkbox" ${isMajorEnabled ? 'checked' : ''} onchange="handleToggleMajor('${currentCat}', '${majorKey}', this.checked)">
              <span class="profile-switch-slider"></span>
            </label>
            <div class="profile-major-names">
              <h3 class="profile-major-name">${majorObj.name || majorKey}</h3>
              <span class="profile-major-key">${majorKey}</span>
            </div>
          </div>
          <div class="profile-major-actions">
            <span class="profile-item-badge">${items.length}件 (有効: ${activeItemsCount})</span>
            <button type="button" class="btn-profile-del" onclick="handleDeleteMajor('${currentCat}', '${majorKey}')" title="この大分類を削除">🗑️</button>
          </div>
        </div>

        <div class="profile-minor-list">
    `;

    if (items.length === 0) {
      html += `
        <div class="profile-empty-minors">小分類がまだありません。下のフォームから追加してください。</div>
      `;
    } else {
      items.forEach(item => {
        const isDisabled = disabledItems.includes(item);
        const usageCount = countProfileUsage(currentCat, majorKey, item);

        html += `
          <div class="profile-minor-row ${isDisabled ? 'is-disabled' : ''}">
            <div class="profile-minor-left">
              <label class="profile-switch sm" title="${isDisabled ? '現在非表示中 (クリックして有効化)' : '現在表示中 (クリックして非表示)'}">
                <input type="checkbox" ${!isDisabled ? 'checked' : ''} onchange="handleToggleMinor('${currentCat}', '${majorKey}', '${item.replace(/'/g, "\\'")}', this.checked)">
                <span class="profile-switch-slider"></span>
              </label>
              <span class="profile-minor-name">${item}</span>
              ${isDisabled ? `<span class="profile-tag-hidden">🚫 非表示中</span>` : ''}
            </div>
            <div class="profile-minor-right">
              ${usageCount > 0
                ? `<span class="profile-usage-badge active" title="${usageCount}件のタスク/ハビットで使用中">🔥 ${usageCount}件使用</span>`
                : `<span class="profile-usage-badge zero" title="現在使用しているタスクはありません">未割当</span>`
              }
              <button type="button" class="btn-profile-del sm" onclick="handleDeleteMinor('${currentCat}', '${majorKey}', '${item.replace(/'/g, "\\'")}')" title="削除">🗑️</button>
            </div>
          </div>
        `;
      });
    }

    html += `
        </div>

        <!-- Add Minor Form -->
        <div class="profile-add-minor-bar">
          <input type="text" id="input-add-minor-${majorKey}" class="profile-input sm" placeholder="+ 新しい${catMeta.minorName}を追加..." onkeydown="if(event.key==='Enter') handleAddMinor('${currentCat}', '${majorKey}')">
          <button type="button" class="btn-profile-add-btn" onclick="handleAddMinor('${currentCat}', '${majorKey}')">追加</button>
        </div>
      </div>
    `;
  });

  // Add Major Card
  html += `
    <div class="profile-major-card add-new-major-card">
      <div class="profile-major-header">
        <h3 class="profile-major-name">＋ 新しい${catMeta.majorName}を作成</h3>
      </div>
      <div class="profile-add-major-form">
        <div class="form-group-compact">
          <label>大分類識別キー (英数字・日本語):</label>
          <input type="text" id="input-new-major-key" class="profile-input" placeholder="例: ${currentCat === 'domains' ? 'PN6' : currentCat === 'depts' ? 'AI推進室' : '新規事業'}">
        </div>
        <div class="form-group-compact">
          <label>大分類表示名 (ラベル):</label>
          <input type="text" id="input-new-major-name" class="profile-input" placeholder="例: ${currentCat === 'domains' ? 'PN6系 新領域' : currentCat === 'depts' ? 'AI推進室' : '🚀 新規事業系'}">
        </div>
        <button type="button" class="btn-add-primary" style="margin-top: 8px; width: 100%; justify-content: center;" onclick="handleAddMajor('${currentCat}')">＋ 大分類を作成</button>
      </div>
    </div>
  </div>`;

  container.innerHTML = html;
}

// Event Handlers
function handleAddMinor(cat, majorKey) {
  const input = document.getElementById(`input-add-minor-${majorKey}`);
  if (!input) return;
  const val = input.value.trim();
  if (!val) return;

  const res = addProfileMinor(cat, majorKey, val);
  if (res.success) {
    input.value = '';
    renderProfileMasterView();
  } else {
    alert(res.message || '追加に失敗しました');
  }
}

function handleDeleteMinor(cat, majorKey, item) {
  const res = deleteProfileMinor(cat, majorKey, item);
  if (res.success) {
    renderProfileMasterView();
  }
}

function handleToggleMinor(cat, majorKey, item, enabled) {
  toggleProfileMinor(cat, majorKey, item, enabled);
  renderProfileMasterView();
}

function handleAddMajor(cat) {
  const keyInput = document.getElementById('input-new-major-key');
  const nameInput = document.getElementById('input-new-major-name');
  if (!keyInput || !nameInput) return;

  const keyVal = keyInput.value.trim();
  const nameVal = nameInput.value.trim() || keyVal;
  if (!keyVal) {
    alert('大分類の識別キーを入力してください');
    return;
  }

  const res = addProfileMajor(cat, keyVal, nameVal);
  if (res.success) {
    keyInput.value = '';
    nameInput.value = '';
    renderProfileMasterView();
  } else {
    alert(res.message || '作成に失敗しました');
  }
}

function handleDeleteMajor(cat, majorKey) {
  const res = deleteProfileMajor(cat, majorKey);
  if (res.success) {
    renderProfileMasterView();
  }
}

function handleToggleMajor(cat, majorKey, enabled) {
  toggleProfileMajor(cat, majorKey, enabled);
  renderProfileMasterView();
}

// Global initialization
if (typeof window !== 'undefined') {
  loadProfileMasters();
}
