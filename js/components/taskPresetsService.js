/**
 * Gendrive - Task Presets & Quick Launcher Service
 * 哲生 (AI Company OS & Personal OS Engine)
 */

let statePresetTimingType = 'current';
let statePresetBucket = 'today';
let statePresetLabel = 'p3';

function openTaskPresetsModal() {
  const modal = document.getElementById('modal-task-presets');
  if (!modal) return;

  // Initialize cascade selects for preset form
  updateMinorSelectOptions('select-preset-domain-major', 'select-preset-domain-minor', DOMAINS_DATA);
  updateMinorSelectOptions('select-preset-dept-major', 'select-preset-dept-minor', DEPTS_DATA);
  updateMinorSelectOptions('select-preset-proj-major', 'select-preset-proj-minor', PROJECTS_DATA);

  // Always show clean card list view on open
  showPresetListView();
  modal.classList.add('active');
}

function showPresetListView() {
  const listView = document.getElementById('preset-list-view');
  const editView = document.getElementById('preset-edit-view');
  if (listView) listView.classList.remove('hidden');
  if (editView) editView.classList.add('hidden');
  renderTaskPresetsCards();
}

function showPresetEditView(isNew = true, preset = null) {
  const listView = document.getElementById('preset-list-view');
  const editView = document.getElementById('preset-edit-view');
  if (listView) listView.classList.add('hidden');
  if (editView) editView.classList.remove('hidden');

  // Update cascade selects
  updateMinorSelectOptions('select-preset-domain-major', 'select-preset-domain-minor', DOMAINS_DATA);
  updateMinorSelectOptions('select-preset-dept-major', 'select-preset-dept-minor', DEPTS_DATA);
  updateMinorSelectOptions('select-preset-proj-major', 'select-preset-proj-minor', PROJECTS_DATA);

  if (isNew || !preset) {
    // New Preset Setup
    document.getElementById('input-preset-id').value = '';
    document.getElementById('preset-edit-modal-title').textContent = '➕ 新規プリセットタスク登録';
    document.getElementById('input-preset-icon').value = '⚡';
    document.getElementById('input-preset-title').value = '';
    document.getElementById('input-preset-est-min').value = 15;
    
    // Bucket Segmented
    statePresetBucket = 'today';
    document.querySelectorAll('#preset-bucket-selector .segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.bucket === 'today');
    });

    // Timing Segmented
    statePresetTimingType = 'current';
    document.querySelectorAll('#preset-timing-type-selector .segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.timing === 'current');
    });
    const panelSec = document.getElementById('preset-panel-timing-section');
    if (panelSec) panelSec.classList.add('hidden');

    // Label Segmented
    statePresetLabel = 'p3';
    document.querySelectorAll('#preset-label-selector .segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.label === 'p3');
    });

    // Cascades
    const domMaj = document.getElementById('select-preset-domain-major');
    if (domMaj) domMaj.value = 'PN5';
    updateMinorSelectOptions('select-preset-domain-major', 'select-preset-domain-minor', DOMAINS_DATA);

    const deptMaj = document.getElementById('select-preset-dept-major');
    if (deptMaj) deptMaj.value = 'HONBU';
    updateMinorSelectOptions('select-preset-dept-major', 'select-preset-dept-minor', DEPTS_DATA);

    const projMaj = document.getElementById('select-preset-proj-major');
    if (projMaj) projMaj.value = 'LIFE';
    updateMinorSelectOptions('select-preset-proj-major', 'select-preset-proj-minor', PROJECTS_DATA);

    // Notes & Tags
    const notesArea = document.getElementById('textarea-preset-notes');
    if (notesArea) notesArea.value = '';
    const tagsInput = document.getElementById('preset-tags');
    if (tagsInput) {
      tagsInput.value = '';
      if (typeof renderTagSuggestions === 'function') {
        renderTagSuggestions('preset-tag-suggestions', 'preset-tags');
      }
    }

    // 6-Axis Matrix Default
    if (typeof setMatrixValues === 'function') {
      setMatrixValues('preset', {
        importance: 'mid',
        urgency: 'mid',
        mentalLoad: 'mid',
        physicalLoad: 'mid',
        frogLevel: 'mid',
        interestLevel: 'mid'
      });
    }
  } else {
    // Edit Existing Preset
    document.getElementById('input-preset-id').value = preset.id;
    document.getElementById('preset-edit-modal-title').textContent = `✏️ プリセット「${preset.title}」を編集`;
    document.getElementById('input-preset-icon').value = preset.icon || '⚡';
    document.getElementById('input-preset-title').value = preset.title || '';
    document.getElementById('input-preset-est-min').value = preset.estMin || 15;

    // Bucket Segmented
    statePresetBucket = preset.bucket || 'today';
    document.querySelectorAll('#preset-bucket-selector .segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.bucket === statePresetBucket);
    });

    // Timing Segmented
    const timingType = preset.timingType || (preset.section === 'anytime' ? 'anytime' : (preset.section && preset.section !== 'current' ? 'section' : 'current'));
    statePresetTimingType = timingType;
    document.querySelectorAll('#preset-timing-type-selector .segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.timing === timingType);
    });
    const panelSec = document.getElementById('preset-panel-timing-section');
    if (panelSec) {
      panelSec.classList.toggle('hidden', timingType !== 'section');
      if (preset.section && preset.section !== 'current' && preset.section !== 'anytime') {
        document.getElementById('select-preset-section').value = preset.section;
      }
    }

    // Label Segmented
    statePresetLabel = preset.label || 'p3';
    document.querySelectorAll('#preset-label-selector .segment-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.label === statePresetLabel);
    });

    // Cascades
    const domMaj = document.getElementById('select-preset-domain-major');
    if (domMaj) domMaj.value = preset.domainMajor || 'PN5';
    updateMinorSelectOptions('select-preset-domain-major', 'select-preset-domain-minor', DOMAINS_DATA, preset.domainMinor || '');

    const deptMaj = document.getElementById('select-preset-dept-major');
    if (deptMaj) deptMaj.value = preset.deptMajor || 'HONBU';
    updateMinorSelectOptions('select-preset-dept-major', 'select-preset-dept-minor', DEPTS_DATA, preset.deptMinor || '');

    const projMaj = document.getElementById('select-preset-proj-major');
    if (projMaj) projMaj.value = preset.projMajor || 'LIFE';
    updateMinorSelectOptions('select-preset-proj-major', 'select-preset-proj-minor', PROJECTS_DATA, preset.projMinor || '');

    // Notes & Tags
    const notesArea = document.getElementById('textarea-preset-notes');
    if (notesArea) notesArea.value = preset.notes || '';
    const tagsInput = document.getElementById('preset-tags');
    if (tagsInput) {
      tagsInput.value = normalizeTags(preset.tags).join(', ');
      if (typeof renderTagSuggestions === 'function') {
        renderTagSuggestions('preset-tag-suggestions', 'preset-tags');
      }
    }

    // 6-Axis Matrix
    if (typeof setMatrixValues === 'function') {
      setMatrixValues('preset', preset.matrix || {
        importance: 'mid',
        urgency: 'mid',
        mentalLoad: 'mid',
        physicalLoad: 'mid',
        frogLevel: preset.frog ? (preset.frog >= 4 ? 'most' : preset.frog === 3 ? 'high' : preset.frog === 1 ? 'low' : 'mid') : 'mid',
        interestLevel: 'mid'
      });
    }
  }

  const titleInput = document.getElementById('input-preset-title');
  if (titleInput) titleInput.focus();
}

function renderTaskPresetsCards() {
  const container = document.getElementById('preset-cards-grid');
  if (!container) return;

  const presets = state.taskPresets || DEFAULT_TASK_PRESETS;
  if (presets.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; padding: 20px;"><p>登録されているプリセットはありません。「➕ 新規プリセット作成 (P)」から作成できます。</p></div>`;
    return;
  }

  container.innerHTML = presets.map((p, idx) => {
    const labelBadge = getEisenhowerLabelBadge(p.label);
    const secLabel = p.section === 'anytime' ? '🌐 終日' : (p.section && p.section !== 'current' ? `⏰ ${p.section}` : '⚡ 現セクション');
    
    // Shortcut number key assignment (1~9 for idx 0..8, 0 for idx 9)
    let keyBadgeHtml = '';
    if (idx < 9) {
      keyBadgeHtml = `<span class="preset-kbd-badge" title="ショートカットキー [${idx + 1}]">${idx + 1}</span>`;
    } else if (idx === 9) {
      keyBadgeHtml = `<span class="preset-kbd-badge" title="ショートカットキー [0]">0</span>`;
    }

    return `
      <div class="preset-card-item" onclick="executePresetTask('${p.id}')" title="クリック (または [${idx < 9 ? idx + 1 : (idx === 9 ? '0' : '')}] キー) で今すぐタスクを追加＆即座に開始！">
        <div class="preset-card-top">
          <div class="preset-card-icon-title">
            <span class="preset-card-icon">${p.icon || '⚡'}</span>
            <span class="preset-card-title">${p.title}</span>
          </div>
          ${keyBadgeHtml}
        </div>
        <div class="preset-card-meta">
          ${labelBadge ? `<span class="badge-eisenhower ${labelBadge.cls}" style="font-size: 9.5px; padding: 1px 5px;">${labelBadge.text}</span>` : ''}
          <span class="preset-card-time">⏱️ ${p.estMin || 15}分</span>
          <span class="meta-tag" style="font-size: 9.5px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3);">${secLabel}</span>
          ${p.domainMinor ? `<span class="meta-tag domain" style="font-size: 9.5px;">${p.domainMinor}</span>` : ''}
          ${p.deptMinor ? `<span class="meta-tag dept" style="font-size: 9.5px;">${p.deptMinor}</span>` : ''}
          ${p.projMinor ? `<span class="meta-tag proj" style="font-size: 9.5px;">${p.projMinor}</span>` : ''}
        </div>
        ${p.notes ? `<div class="preset-card-notes" style="font-size: 10.5px; color: var(--text-muted); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">📝 ${p.notes}</div>` : ''}
        <div class="preset-card-actions" onclick="event.stopPropagation()">
          <button type="button" class="btn-preset-edit" onclick="editPresetTask('${p.id}')" title="プリセットを修正・編集">✏️ 編集</button>
          <button type="button" class="btn-preset-delete" onclick="deletePresetTask('${p.id}')" title="プリセットを削除">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

function editPresetTask(presetId) {
  const presets = state.taskPresets || loadTaskPresets();
  const preset = presets.find(p => p.id === presetId);
  if (!preset) return;
  showPresetEditView(false, preset);
}

function savePresetFromForm() {
  const titleInput = document.getElementById('input-preset-title');
  const title = titleInput ? titleInput.value.trim() : '';
  if (!title) {
    alert('タスク名（プリセット名）を入力してください');
    return;
  }

  const editId = document.getElementById('input-preset-id')?.value;
  const icon = document.getElementById('input-preset-icon')?.value.trim() || '⚡';
  const bucket = statePresetBucket || 'today';
  const estMin = parseInt(document.getElementById('input-preset-est-min')?.value, 10) || 15;
  const label = statePresetLabel || 'p3';
  const timingType = statePresetTimingType || 'current';
  const section = timingType === 'section' ? (document.getElementById('select-preset-section')?.value || '第2セッション') : (timingType === 'anytime' ? 'anytime' : 'current');

  const domainMajor = document.getElementById('select-preset-domain-major')?.value || 'PN5';
  const domainMinor = document.getElementById('select-preset-domain-minor')?.value || '';
  const deptMajor = document.getElementById('select-preset-dept-major')?.value || 'HONBU';
  const deptMinor = document.getElementById('select-preset-dept-minor')?.value || '';
  const projMajor = document.getElementById('select-preset-proj-major')?.value || 'LIFE';
  const projMinor = document.getElementById('select-preset-proj-minor')?.value || '';
  const notes = document.getElementById('textarea-preset-notes')?.value || '';
  const tags = normalizeTags(document.getElementById('preset-tags')?.value);

  // Get 6-Axis Matrix Values
  const matrixVals = typeof getMatrixValues === 'function' ? getMatrixValues('preset') : {};

  if (editId) {
    // Update existing preset
    const existing = state.taskPresets.find(p => p.id === editId);
    if (existing) {
      existing.icon = icon;
      existing.title = title;
      existing.bucket = bucket;
      existing.timingType = timingType;
      existing.section = section;
      existing.estMin = estMin;
      existing.label = label;
      existing.domainMajor = domainMajor;
      existing.domainMinor = domainMinor;
      existing.deptMajor = deptMajor;
      existing.deptMinor = deptMinor;
      existing.projMajor = projMajor;
      existing.projMinor = projMinor;
      existing.notes = notes;
      existing.tags = tags;
      existing.matrix = matrixVals;
    }
  } else {
    // Create new preset
    const newPreset = {
      id: 'preset_' + Date.now(),
      icon,
      title,
      bucket,
      timingType,
      section,
      estMin,
      label,
      domainMajor,
      domainMinor,
      deptMajor,
      deptMinor,
      projMajor,
      projMinor,
      tags,
      matrix: matrixVals
    };
    if (!state.taskPresets) state.taskPresets = [];
    state.taskPresets.push(newPreset);
  }

  saveTaskPresets();
  showPresetListView();
}

function executePresetTask(presetId) {
  const presets = state.taskPresets || loadTaskPresets();
  const preset = presets.find(p => p.id === presetId);
  if (!preset) return;

  const newId = 'T_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  const now = new Date();
  
  // Section resolution
  let targetSection = state.currentSection || detectCurrentSection() || '第2セッション';
  let timingType = 'section';
  if (preset.section === 'anytime' || preset.timingType === 'anytime') {
    timingType = 'anytime';
    targetSection = null;
  } else if (preset.section && preset.section !== 'current') {
    targetSection = preset.section;
    timingType = 'section';
  }

  const matrixVals = preset.matrix || {
    importance: 'mid',
    urgency: 'mid',
    mentalLoad: 'mid',
    physicalLoad: 'mid',
    frogLevel: 'mid',
    interestLevel: 'mid'
  };

  const newTask = {
    id: newId,
    title: preset.icon ? `${preset.icon} ${preset.title}` : preset.title,
    scheduledDate: getSelectedDateKey(),
    bucket: preset.bucket || 'today',
    label: preset.label === 'none' ? null : (preset.label || 'p3'),
    type: 'single',
    timingType: timingType,
    section: targetSection,
    customStart: null,
    customEnd: null,
    estMin: (typeof calculateMovingAverageDuration === 'function') ? calculateMovingAverageDuration(preset, 'task') : (preset.estMin || 15),
    actStart: null,
    actEnd: null,
    actMin: 0,
    accumulatedSeconds: 0,
    ...matrixVals,
    domainMajor: preset.domainMajor || 'PN5',
    domainMinor: preset.domainMinor || '',
    deptMajor: preset.deptMajor || 'HONBU',
    deptMinor: preset.deptMinor || '',
    projMajor: preset.projMajor || 'LIFE',
    projMinor: preset.projMinor || '',
    tags: normalizeTags(preset.tags),
    status: 'uncompleted',
    notes: preset.notes || '⚡ プリセットタスクから即時実行',
    createdAt: now.toISOString()
  };

  state.tasks.push(newTask);
  saveTasks();

  // Instantly start this task (which automatically pauses any other task!)
  startTask(newId);

  pushUndoAction({
    description: `プリセットタスク「${newTask.title}」を【${targetSection || '終日'}】に即時開始`,
    undo: () => {
      state.tasks = state.tasks.filter(t => t.id !== newId);
      if (state.activeTaskId === newId) state.activeTaskId = null;
      saveTasks();
      renderApp();
    }
  });

  closeModal();
  renderApp();
}

function deletePresetTask(presetId) {
  const preset = state.taskPresets.find(p => p.id === presetId);
  if (!preset) return;
  if (confirm(`プリセット「${preset.title}」を削除してもよろしいですか？`)) {
    state.taskPresets = state.taskPresets.filter(p => p.id !== presetId);
    saveTaskPresets();
    renderTaskPresetsCards();
  }
}

function setPresetEmoji(emoji) {
  const input = document.getElementById('input-preset-icon');
  if (input) {
    input.value = emoji;
    input.focus();
  }
}

function setupTaskPresetsHandlers() {
  const btnTrigger = document.getElementById('btn-task-presets');
  if (btnTrigger) {
    btnTrigger.addEventListener('click', openTaskPresetsModal);
  }

  const btnClose = document.getElementById('btn-close-task-presets');
  if (btnClose) {
    btnClose.addEventListener('click', closeModal);
  }

  // Switch to New Preset View
  const btnToggleForm = document.getElementById('btn-toggle-add-preset');
  if (btnToggleForm) {
    btnToggleForm.addEventListener('click', () => {
      showPresetEditView(true);
    });
  }

  // Cancel / Return to List View
  const btnCancelForm = document.getElementById('btn-cancel-preset-form');
  if (btnCancelForm) {
    btnCancelForm.addEventListener('click', () => {
      showPresetListView();
    });
  }

  const btnCancelFormBottom = document.getElementById('btn-cancel-preset-form-bottom');
  if (btnCancelFormBottom) {
    btnCancelFormBottom.addEventListener('click', () => {
      showPresetListView();
    });
  }

  // Save Buttons
  const btnSavePreset = document.getElementById('btn-save-new-preset');
  if (btnSavePreset) {
    btnSavePreset.addEventListener('click', savePresetFromForm);
  }

  const btnSavePresetBottom = document.getElementById('btn-save-new-preset-bottom');
  if (btnSavePresetBottom) {
    btnSavePresetBottom.addEventListener('click', savePresetFromForm);
  }

  // Segmented: Bucket Selector
  document.querySelectorAll('#preset-bucket-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#preset-bucket-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      statePresetBucket = btn.dataset.bucket;
    });
  });

  // Segmented: Timing Type Selector
  document.querySelectorAll('#preset-timing-type-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#preset-timing-type-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      statePresetTimingType = btn.dataset.timing;
      
      const panelSec = document.getElementById('preset-panel-timing-section');
      if (panelSec) {
        panelSec.classList.toggle('hidden', statePresetTimingType !== 'section');
      }
    });
  });

  // Segmented: Label Selector
  document.querySelectorAll('#preset-label-selector .segment-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#preset-label-selector .segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      statePresetLabel = btn.dataset.label;
    });
  });

  // Cascade selects for Preset Form
  const preDomMaj = document.getElementById('select-preset-domain-major');
  if (preDomMaj) preDomMaj.addEventListener('change', () => updateMinorSelectOptions('select-preset-domain-major', 'select-preset-domain-minor', DOMAINS_DATA));

  const preDeptMaj = document.getElementById('select-preset-dept-major');
  if (preDeptMaj) preDeptMaj.addEventListener('change', () => updateMinorSelectOptions('select-preset-dept-major', 'select-preset-dept-minor', DEPTS_DATA));

  const preProjMaj = document.getElementById('select-preset-proj-major');
  if (preProjMaj) preProjMaj.addEventListener('change', () => updateMinorSelectOptions('select-preset-proj-major', 'select-preset-proj-minor', PROJECTS_DATA));
}
