/**
 * Gendrive - Goals & Core Manifesto View Renderer
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Goal Date Range Progress Calculator
// =========================================================================

function calculateGoalProgress(startDateStr, endDateStr) {
  const now = new Date();
  // Apply selectedDateOffset if looking at past date
  if (typeof state !== 'undefined' && state && state.selectedDateOffset) {
    now.setDate(now.getDate() - state.selectedDateOffset);
  }

  // Parse YYYY-MM-DD cleanly as local midnight Date
  const parseDateOnly = (str) => {
    if (!str) return new Date();
    const parts = str.split('-').map(Number);
    if (parts.length === 3) {
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    const d = new Date(str);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  };

  const start = parseDateOnly(startDateStr);
  const end = parseDateOnly(endDateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const oneDayMs = 24 * 60 * 60 * 1000;
  
  // Total inclusive days in the period
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / oneDayMs) + 1);

  // Elapsed days (1-indexed inclusive)
  let elapsedDays = 0;
  if (today.getTime() < start.getTime()) {
    elapsedDays = 0;
  } else {
    const diffFromStart = Math.round((today.getTime() - start.getTime()) / oneDayMs);
    elapsedDays = Math.min(totalDays, diffFromStart + 1);
  }

  const remainingDays = Math.max(0, totalDays - elapsedDays);
  const percent = totalDays > 0 ? Math.min(100, Math.max(0, Math.round((elapsedDays / totalDays) * 100))) : 0;

  return { totalDays, elapsedDays, remainingDays, percent };
}

// Helper: Open Obsidian Note by Link or Name
function openObsidianNote(rawInput) {
  if (!rawInput || !rawInput.trim()) return;
  let input = rawInput.trim();

  let targetUri = input;
  if (!input.startsWith('obsidian://') && !input.startsWith('http://') && !input.startsWith('https://')) {
    let noteName = input;
    if (noteName.startsWith('[[') && noteName.endsWith(']]')) {
      noteName = noteName.slice(2, -2).trim();
    }
    if (noteName.includes('#')) {
      noteName = noteName.split('#')[0].trim();
    }
    const vaultName = encodeURIComponent('obsidian folder');
    const fileName = encodeURIComponent(noteName);
    targetUri = `obsidian://open?vault=${vaultName}&file=${fileName}`;
  }

  try {
    const a = document.createElement('a');
    a.href = targetUri;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
    }, 300);
  } catch (err) {
    console.error('Failed to trigger obsidian protocol link:', err);
    window.location.href = targetUri;
  }
}

// =========================================================================
// 2. Render Goals & Vision View (Mode 5)
// =========================================================================

function renderGoalsView() {
  const goals = state.goals || DEFAULT_GOALS;

  // Toggle Subview display (Front 4-Level Goals vs Back Core Manifesto)
  const frontView = document.getElementById('goals-front-view');
  const backView = document.getElementById('goals-back-view');
  const isBackMode = state.goalsSubmode === 'back';

  if (frontView && backView) {
    frontView.classList.toggle('active', !isBackMode);
    backView.classList.toggle('active', isBackMode);
  }

  // Always render Core Manifesto
  renderManifestoView();

  // 1. Weekly Goal
  const w = goals.weekly || DEFAULT_GOALS.weekly;
  const wProg = calculateGoalProgress(w.startDate, w.endDate);
  const wStartM = new Date(w.startDate).getMonth() + 1;
  const wStartD = new Date(w.startDate).getDate();
  const wEndM = new Date(w.endDate).getMonth() + 1;
  const wEndD = new Date(w.endDate).getDate();
  
  const elWeeklyPeriod = document.getElementById('goal-weekly-period');
  if (elWeeklyPeriod) elWeeklyPeriod.textContent = `今週 (${wStartM}/${wStartD} 〜 ${wEndM}/${wEndD})`;
  const elWeeklyDays = document.getElementById('goal-weekly-days-info');
  if (elWeeklyDays) elWeeklyDays.textContent = `${wProg.totalDays}日中 ${wProg.elapsedDays}日目`;
  const elWeeklyPct = document.getElementById('goal-weekly-percent');
  if (elWeeklyPct) elWeeklyPct.textContent = `${wProg.percent}% 経過 (残り ${wProg.remainingDays}日)`;
  const elWeeklyFill = document.getElementById('goal-weekly-scale-fill');
  if (elWeeklyFill) elWeeklyFill.style.width = `${wProg.percent}%`;
  
  const wContent = document.getElementById('goal-weekly-content');
  if (wContent) {
    wContent.innerHTML = (w.lines || []).map(line => `
      <div class="goal-line-item">
        <span class="goal-line-icon">🎯</span>
        <span class="goal-line-text">${line}</span>
      </div>
    `).join('');
  }

  // 2. Monthly Goal
  const m = goals.monthly || DEFAULT_GOALS.monthly;
  const mProg = calculateGoalProgress(m.startDate, m.endDate);
  const mStartM = new Date(m.startDate).getMonth() + 1;
  const mStartD = new Date(m.startDate).getDate();
  const mEndM = new Date(m.endDate).getMonth() + 1;
  const mEndD = new Date(m.endDate).getDate();

  const elMonthlyPeriod = document.getElementById('goal-monthly-period');
  if (elMonthlyPeriod) elMonthlyPeriod.textContent = `今月 (${mStartM}/${mStartD} 〜 ${mEndM}/${mEndD})`;
  const elMonthlyDays = document.getElementById('goal-monthly-days-info');
  if (elMonthlyDays) elMonthlyDays.textContent = `${mProg.totalDays}日中 ${mProg.elapsedDays}日目`;
  const elMonthlyPct = document.getElementById('goal-monthly-percent');
  if (elMonthlyPct) elMonthlyPct.textContent = `${mProg.percent}% 経過 (残り ${mProg.remainingDays}日)`;
  const elMonthlyFill = document.getElementById('goal-monthly-scale-fill');
  if (elMonthlyFill) elMonthlyFill.style.width = `${mProg.percent}%`;

  const mContent = document.getElementById('goal-monthly-content');
  if (mContent) {
    mContent.innerHTML = (m.lines || []).map(line => `
      <div class="goal-line-item">
        <span class="goal-line-icon">🌕</span>
        <span class="goal-line-text">${line}</span>
      </div>
    `).join('');
  }

  // 3. Half-Year Goal
  const h = goals.half || DEFAULT_GOALS.half;
  const hProg = calculateGoalProgress(h.startDate, h.endDate);
  const hStartM = new Date(h.startDate).getMonth() + 1;
  const hEndM = new Date(h.endDate).getMonth() + 1;

  const elHalfPeriod = document.getElementById('goal-half-period');
  if (elHalfPeriod) elHalfPeriod.textContent = `半期 (${hStartM}月 〜 ${hEndM}月)`;
  const elHalfDays = document.getElementById('goal-half-days-info');
  if (elHalfDays) elHalfDays.textContent = `${hProg.totalDays}日中 ${hProg.elapsedDays}日目`;
  const elHalfPct = document.getElementById('goal-half-percent');
  if (elHalfPct) elHalfPct.textContent = `${hProg.percent}% 経過 (残り ${hProg.remainingDays}日)`;
  const elHalfFill = document.getElementById('goal-half-scale-fill');
  if (elHalfFill) elHalfFill.style.width = `${hProg.percent}%`;

  const hContent = document.getElementById('goal-half-content');
  if (hContent) {
    hContent.innerHTML = (h.lines || []).map(line => `
      <div class="goal-line-item">
        <span class="goal-line-icon">⚡</span>
        <span class="goal-line-text">${line}</span>
      </div>
    `).join('');
  }

  // 4. 3-Year Phase Goal
  const p = goals.phase || DEFAULT_GOALS.phase;
  const pProg = calculateGoalProgress(p.startDate, p.endDate);
  const pStartY = new Date(p.startDate).getFullYear();
  const pEndY = new Date(p.endDate).getFullYear();

  const elPhasePeriod = document.getElementById('goal-phase-period');
  if (elPhasePeriod) elPhasePeriod.textContent = `${p.phaseName || '第1フェイズ'} (${pStartY}年 〜 ${pEndY}年)`;
  const elPhaseDays = document.getElementById('goal-phase-days-info');
  if (elPhaseDays) elPhaseDays.textContent = `${pProg.totalDays}日中 ${pProg.elapsedDays}日目`;
  const elPhasePct = document.getElementById('goal-phase-percent');
  if (elPhasePct) elPhasePct.textContent = `${pProg.percent}% 経過 (残り ${pProg.remainingDays}日)`;
  const elPhaseFill = document.getElementById('goal-phase-scale-fill');
  if (elPhaseFill) elPhaseFill.style.width = `${pProg.percent}%`;

  const pContent = document.getElementById('goal-phase-content');
  if (pContent) {
    pContent.innerHTML = (p.lines || []).map(line => `
      <div class="goal-line-item">
        <span class="goal-line-icon">🌌</span>
        <span class="goal-line-text">${line}</span>
      </div>
    `).join('');
  }

  // Obsidian Note Buttons Setup
  const setupObsidianBtn = (btnId, level, uri) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.classList.remove('hidden');
    
    if (uri && uri.trim()) {
      btn.title = `Obsidianノートを開く (${uri})`;
      btn.style.opacity = '1';
      btn.onclick = (e) => {
        e.stopPropagation();
        openObsidianNote(uri);
      };
    } else {
      btn.title = `Obsidianノートを設定・開く`;
      btn.style.opacity = '0.7';
      btn.onclick = (e) => {
        e.stopPropagation();
        openEditGoalsModal(level);
      };
    }
  };

  setupObsidianBtn('btn-goal-weekly-obsidian', 'weekly', w.obsidianUri);
  setupObsidianBtn('btn-goal-monthly-obsidian', 'monthly', m.obsidianUri);
  setupObsidianBtn('btn-goal-half-obsidian', 'half', h.obsidianUri);
  setupObsidianBtn('btn-goal-phase-obsidian', 'phase', p.obsidianUri);
}

// Helper: Toggle Goals Submode
function toggleGoalsSubmode() {
  state.goalsSubmode = state.goalsSubmode === 'front' ? 'back' : 'front';
  renderGoalsView();
}

// =========================================================================
// 3. Core Manifesto View Renderer & Modals
// =========================================================================

function renderManifestoView() {
  const manifesto = state.manifesto || DEFAULT_MANIFESTO;
  
  const titleEl = document.getElementById('manifesto-display-title');
  if (titleEl) titleEl.textContent = manifesto.title || DEFAULT_MANIFESTO.title;

  const mottoEl = document.getElementById('manifesto-display-motto');
  if (mottoEl) mottoEl.textContent = manifesto.motto || DEFAULT_MANIFESTO.motto;

  const bodyEl = document.getElementById('manifesto-display-body');
  if (!bodyEl) return;

  const rawBody = manifesto.body || DEFAULT_MANIFESTO.body;
  const lines = rawBody.split('\n');
  
  let html = '';
  let currentParagraph = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const pText = currentParagraph.join('<br>');
      html += `<p>${formatManifestoInline(pText)}</p>`;
      currentParagraph = [];
    }
  };

  lines.forEach(rawLine => {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      return;
    }

    if (line.startsWith('【') && line.endsWith('】')) {
      flushParagraph();
      html += `<div class="manifesto-heading">⚜️ ${formatManifestoInline(line.slice(1, -1))}</div>`;
      return;
    }
    if (line.startsWith('#')) {
      flushParagraph();
      const cleanH = line.replace(/^#+\s*/, '');
      html += `<div class="manifesto-heading">⚜️ ${formatManifestoInline(cleanH)}</div>`;
      return;
    }

    const numMatch = line.match(/^(\d+)[.、\)]\s*(.*)$/);
    if (numMatch) {
      flushParagraph();
      html += `
        <div class="manifesto-list-item">
          <span class="manifesto-list-num">${numMatch[1]}.</span>
          <span>${formatManifestoInline(numMatch[2])}</span>
        </div>
      `;
      return;
    }

    const bulletMatch = line.match(/^[・\-\*]\s*(.*)$/);
    if (bulletMatch) {
      flushParagraph();
      html += `
        <div class="manifesto-list-item">
          <span class="manifesto-list-num" style="font-size: 11px;">✦</span>
          <span>${formatManifestoInline(bulletMatch[1])}</span>
        </div>
      `;
      return;
    }

    currentParagraph.push(line);
  });

  flushParagraph();
  bodyEl.innerHTML = html;
}

function formatManifestoInline(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/「(.*?)」/g, '「<b>$1</b>」');
}

function openEditManifestoModal() {
  const modal = document.getElementById('modal-edit-manifesto');
  if (!modal) return;

  const manifesto = state.manifesto || DEFAULT_MANIFESTO;

  const titleInput = document.getElementById('input-manifesto-title');
  if (titleInput) titleInput.value = manifesto.title || DEFAULT_MANIFESTO.title;

  const mottoInput = document.getElementById('input-manifesto-motto');
  if (mottoInput) mottoInput.value = manifesto.motto || DEFAULT_MANIFESTO.motto;

  const bodyInput = document.getElementById('input-manifesto-body');
  if (bodyInput) bodyInput.value = manifesto.body || DEFAULT_MANIFESTO.body;

  modal.classList.add('active');
  if (bodyInput) bodyInput.focus();
}

function openEditGoalsModal(targetLevel = null) {
  const modal = document.getElementById('modal-edit-goals');
  if (!modal) return;

  const goals = state.goals || DEFAULT_GOALS;

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  // Weekly
  setVal('input-goal-weekly-start', goals.weekly?.startDate || '2026-08-17');
  setVal('input-goal-weekly-end', goals.weekly?.endDate || '2026-08-23');
  setVal('input-goal-weekly-obsidian', goals.weekly?.obsidianUri || '');
  setVal('input-goal-weekly-text', (goals.weekly?.lines || []).join('\n'));

  // Monthly
  setVal('input-goal-monthly-start', goals.monthly?.startDate || '2026-08-01');
  setVal('input-goal-monthly-end', goals.monthly?.endDate || '2026-08-31');
  setVal('input-goal-monthly-obsidian', goals.monthly?.obsidianUri || '');
  setVal('input-goal-monthly-text', (goals.monthly?.lines || []).join('\n'));

  // Half
  setVal('input-goal-half-start', goals.half?.startDate || '2026-07-01');
  setVal('input-goal-half-end', goals.half?.endDate || '2026-12-31');
  setVal('input-goal-half-obsidian', goals.half?.obsidianUri || '');
  setVal('input-goal-half-text', (goals.half?.lines || []).join('\n'));

  // Phase
  setVal('input-goal-phase-name', goals.phase?.phaseName || '第1フェイズ：圧倒的基盤構築と自立事業化');
  setVal('input-goal-phase-start', goals.phase?.startDate || '2025-01-01');
  setVal('input-goal-phase-end', goals.phase?.endDate || '2027-12-31');
  setVal('input-goal-phase-obsidian', goals.phase?.obsidianUri || '');
  setVal('input-goal-phase-text', (goals.phase?.lines || []).join('\n'));

  modal.classList.add('active');

  if (targetLevel) {
    const targetInput = document.getElementById(`input-goal-${targetLevel}-text`);
    if (targetInput) targetInput.focus();
  }
}

function setupManifestoHandlers() {
  const btnClose = document.getElementById('btn-close-edit-manifesto');
  if (btnClose) btnClose.addEventListener('click', closeModal);

  const btnCancel = document.getElementById('btn-cancel-edit-manifesto');
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  const form = document.getElementById('form-edit-manifesto');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      const title = document.getElementById('input-manifesto-title')?.value.trim() || DEFAULT_MANIFESTO.title;
      const motto = document.getElementById('input-manifesto-motto')?.value.trim() || DEFAULT_MANIFESTO.motto;
      const body = document.getElementById('input-manifesto-body')?.value.trim();

      if (!body) {
        alert('決意文の本文を入力してください');
        return;
      }

      state.manifesto = {
        title,
        motto,
        body,
        updatedAt: new Date().toISOString()
      };

      saveManifesto();
      closeModal();
      renderManifestoView();
    });
  }
}

function setupGoalsFormHandlers() {
  const btnClose = document.getElementById('btn-close-edit-goals');
  if (btnClose) btnClose.addEventListener('click', closeModal);

  const btnCancel = document.getElementById('btn-cancel-edit-goals');
  if (btnCancel) btnCancel.addEventListener('click', closeModal);

  const form = document.getElementById('form-edit-goals');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const parseLines = (text) => text.split('\n').map(l => l.trim()).filter(Boolean);

      state.goals = {
        weekly: {
          startDate: document.getElementById('input-goal-weekly-start').value,
          endDate: document.getElementById('input-goal-weekly-end').value,
          obsidianUri: document.getElementById('input-goal-weekly-obsidian').value.trim(),
          lines: parseLines(document.getElementById('input-goal-weekly-text').value)
        },
        monthly: {
          startDate: document.getElementById('input-goal-monthly-start').value,
          endDate: document.getElementById('input-goal-monthly-end').value,
          obsidianUri: document.getElementById('input-goal-monthly-obsidian').value.trim(),
          lines: parseLines(document.getElementById('input-goal-monthly-text').value)
        },
        half: {
          startDate: document.getElementById('input-goal-half-start').value,
          endDate: document.getElementById('input-goal-half-end').value,
          obsidianUri: document.getElementById('input-goal-half-obsidian').value.trim(),
          lines: parseLines(document.getElementById('input-goal-half-text').value)
        },
        phase: {
          phaseName: document.getElementById('input-goal-phase-name').value.trim() || '第1フェイズ',
          startDate: document.getElementById('input-goal-phase-start').value,
          endDate: document.getElementById('input-goal-phase-end').value,
          obsidianUri: document.getElementById('input-goal-phase-obsidian').value.trim(),
          lines: parseLines(document.getElementById('input-goal-phase-text').value)
        }
      };

      saveGoals();
      closeModal();
      renderApp();
    });
  }
}

