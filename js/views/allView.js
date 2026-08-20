// =========================================================================
// 1. Render All View (Today Screen with Robust Flat Mode & Section Groups)
// =========================================================================

function isFlatDailyViewActive() {
  if (typeof state.isFlatDailyView === 'undefined') {
    state.isFlatDailyView = localStorage.getItem('gendrive_flat_daily_view') === 'true';
  }
  return state.isFlatDailyView;
}

function toggleDailyFlatView() {
  state.isFlatDailyView = !isFlatDailyViewActive();
  localStorage.setItem('gendrive_flat_daily_view', state.isFlatDailyView ? 'true' : 'false');
  if (typeof renderApp === 'function') {
    renderApp();
  }
  if (typeof showFloatingUndoToast === 'function') {
    showFloatingUndoToast(state.isFlatDailyView ? '📑 デイリー: セクションバー非表示（フラット表示）' : '📑 デイリー: セクションバー表示（通常）');
  }
}

function renderAllView() {
  const isFlat = isFlatDailyViewActive();
  const anytimeDailyBlock = document.getElementById('anytime-daily-block');

  if (anytimeDailyBlock) {
    anytimeDailyBlock.style.display = isFlat ? 'none' : 'block';
  }
  if (!isFlat) {
    renderAnytimeBlock();
  }

  const container = document.getElementById('all-today-groups');
  if (!container) return;

  const todayTasks = state.tasks.filter(isTaskForSelectedDate);
  const allHabits = state.habits;

  const doneTasks = todayTasks.filter(t => t.status === 'completed').length;
  const doneHabits = allHabits.filter(h => h.status === 'completed').length;

  const totalAll = todayTasks.length + allHabits.length;
  const totalDoneAll = doneTasks + doneHabits;
  const totalRate = totalAll ? Math.round((totalDoneAll / totalAll) * 100) : 0;

  const statTasksEl = document.getElementById('stat-tasks-summary');
  const statHabitsEl = document.getElementById('stat-habits-summary');
  const statRateEl = document.getElementById('stat-rate-text');
  if (statTasksEl) statTasksEl.textContent = `${doneTasks} / ${todayTasks.length}`;
  if (statHabitsEl) statHabitsEl.textContent = `${doneHabits} / ${allHabits.length}`;
  if (statRateEl) statRateEl.textContent = `${totalRate}%`;

  const showTasks = state.viewType === 'all' || state.viewType === 'task';
  const showHabits = state.viewType === 'all' || state.viewType === 'habit';

  // Toolbar Banner with Flat Mode Toggle Button
  const toolbarHtml = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; padding: 8px 14px; background: rgba(15, 23, 42, 0.6); border-radius: 8px; border: 1px solid var(--border-subtle);">
      <div style="font-size: 12.5px; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
        <span>📅 <b>1日全体フルビュー</b></span>
        <span style="font-size: 11px; padding: 2px 6px; border-radius: 4px; background: ${isFlat ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255,255,255,0.06)'}; color: ${isFlat ? 'var(--accent-cyan)' : 'var(--text-muted)'}; font-weight: 700;">
          ${isFlat ? '📑 フラット表示 (バーOFF)' : '🗂️ セクション別表示 (バーON)'}
        </span>
      </div>
      <button type="button" class="btn-secondary" onclick="toggleDailyFlatView()" style="font-size: 11.5px; height: 30px; padding: 0 12px; font-weight: 700; color: ${isFlat ? 'var(--accent-cyan)' : 'var(--text-main)'}; border-color: ${isFlat ? 'var(--accent-cyan)' : 'var(--border-subtle)'}; display: flex; align-items: center; gap: 6px; cursor: pointer;" title="セクションの区切りバーの表示/非表示を切り替えます (ショートカット: F)">
        <span>${isFlat ? '📑 セクションバー: OFF' : '🗂️ セクションバー: ON'}</span>
        <kbd style="font-size: 10px; padding: 2px 5px; background: rgba(255,255,255,0.12); border-radius: 3px; font-family: monospace;">F</kbd>
      </button>
    </div>
  `;

  // =========================================================================
  // CASE A: FLAT MODE (All Tasks & Habits Cleanly Listed Without Section Bars)
  // =========================================================================
  if (isFlat) {
    // 1. Collect ALL Today's Tasks in Section Order (第1 ➔ 朝オペ ➔ 第2 ➔ 第3 ➔ 夜オペ ➔ 第4 ➔ 未設定)
    const allTodayTasksRaw = state.tasks.filter(isTaskForSelectedDate);
    
    // Sort tasks by section order
    const sectionOrderMap = {
      '第1セッション': 1, '第1': 1, '早朝': 1,
      '朝オペ': 2, '家事': 2, '育児': 2,
      '第2セッション': 3, '第2': 3, '午前': 3,
      '第3セッション': 4, '第3': 4, '午後': 4,
      '夜オペ': 5, '夕食': 5, '団らん': 5,
      '第4セッション': 6, '第4': 6, '夜': 6
    };

    const sortedTasks = [...allTodayTasksRaw].sort((a, b) => {
      const orderA = sectionOrderMap[a.section] || 99;
      const orderB = sectionOrderMap[b.section] || 99;
      return orderA - orderB;
    });

    const flatTasks = sortedTasks.filter(t => {
      if (state.filters.status === 'uncompleted') return t.status !== 'completed' && t.status !== 'skipped';
      if (state.filters.status === 'completed') return t.status === 'completed';
      if (state.filters.domain && t.domainMajor !== state.filters.domain && t.domainMinor !== state.filters.domain) return false;
      if (state.filters.dept && t.deptMajor !== state.filters.dept && t.deptMinor !== state.filters.dept) return false;
      if (state.filters.proj && t.projMajor !== state.filters.proj && t.projMinor !== state.filters.proj) return false;
      if (!matchesTagFilters(t)) return false;
      return true;
    });

    // 2. Collect ALL Habits
    const flatHabits = getFilteredHabits('all');

    let flatContentHtml = `
      ${toolbarHtml}
      <div class="section-group" style="margin-bottom: 20px; border: 1px solid rgba(56, 189, 248, 0.2); background: rgba(15, 23, 42, 0.45); padding: 14px; border-radius: 10px;">
        <div class="section-split-container ${showTasks && showHabits ? '' : 'grid-single'}">
          ${showTasks ? `
            <div class="section-subgroup">
              <div style="font-size: 13px; font-weight: 700; color: var(--accent-cyan); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 6px;">
                <span>🎯 今日の全タスク (${flatTasks.length}件)</span>
                <button class="btn-banner-add btn-banner-add-task" onclick="openAddTaskModal()" style="font-size: 11px; padding: 3px 8px;">＋ タスク追加</button>
              </div>
              <div class="cards-list">
                ${flatTasks.length > 0 ? flatTasks.map(renderTaskCardHtml).join('') : '<p style="font-size: 12px; color: var(--text-dim); padding: 12px;">🎯 未完了のタスクはありません</p>'}
              </div>
            </div>
          ` : ''}
          ${showHabits ? `
            <div class="section-subgroup">
              <div style="font-size: 13px; font-weight: 700; color: var(--accent-emerald); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(52, 211, 153, 0.2); padding-bottom: 6px;">
                <span>🌿 今日の全ハビット (${flatHabits.length}件)</span>
                <button class="btn-banner-add btn-banner-add-habit" onclick="openAddModal()" style="font-size: 11px; padding: 3px 8px;">＋ ハビット追加</button>
              </div>
              <div class="cards-list">
                ${flatHabits.length > 0 ? flatHabits.map(renderHabitCardHtml).join('') : '<p style="font-size: 12px; color: var(--text-dim); padding: 12px;">🌿 未完了のハビットはありません</p>'}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    container.innerHTML = flatContentHtml;
    return;
  }

  // =========================================================================
  // CASE B: STANDARD SECTIONED MODE (With Section Bars)
  // =========================================================================
  let html = toolbarHtml;

  for (const s of SECTIONS_CONFIG) {
    const secTasksAll = getTasksForSection(s.name);
    const secTasks = secTasksAll.filter(t => {
      if (state.filters.status === 'uncompleted') return t.status !== 'completed' && t.status !== 'skipped';
      if (state.filters.status === 'completed') return t.status === 'completed';
      if (state.filters.domain && t.domainMajor !== state.filters.domain && t.domainMinor !== state.filters.domain) return false;
      if (state.filters.dept && t.deptMajor !== state.filters.dept && t.deptMinor !== state.filters.dept) return false;
      if (state.filters.proj && t.projMajor !== state.filters.proj && t.projMinor !== state.filters.proj) return false;
      if (!matchesTagFilters(t)) return false;
      return true;
    });

    const secHabits = getFilteredHabits('all').filter(h => isHabitInDailySection(h, s.name));

    if (state.filters.status !== 'all' && secTasks.length === 0 && secHabits.length === 0) {
      continue;
    }

    const isToday = state.selectedDateOffset === 0;
    const isPast = state.selectedDateOffset > 0;
    const isFuture = state.selectedDateOffset < 0;

    let secEtaBadgeHtml = '';

    if (isToday) {
      let secRemainMin = 0;
      let secRemainCount = 0;
      secTasksAll.forEach(t => {
        const st = getTaskStatusForSelectedDate(t);
        if (st !== 'completed' && st !== 'skipped') {
          secRemainMin += getItemRemainingMinutes(t, 'task');
          secRemainCount++;
        }
      });
      secHabits.forEach(h => {
        const st = getHabitStatusForSelectedDate(h);
        if (st !== 'completed' && st !== 'skipped') {
          secRemainMin += getItemRemainingMinutes(h, 'habit');
          secRemainCount++;
        }
      });
      const now = new Date();
      const secEtaDate = new Date(now.getTime() + secRemainMin * 60000);
      const secEtaTimeStr = `${String(secEtaDate.getHours()).padStart(2, '0')}:${String(secEtaDate.getMinutes()).padStart(2, '0')}`;
      const sH = Math.floor(secRemainMin / 60);
      const sM = secRemainMin % 60;
      const secRemainFormatted = sH > 0 ? `${sH}h${sM}m` : `${sM}分`;

      secEtaBadgeHtml = secRemainCount > 0
        ? `<span class="section-group-eta" style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(0, 0, 0, 0.35); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.35); font-family: 'JetBrains Mono', monospace;" title="このセクションの未完了アイテムを今すぐ順に実行した場合の終了見込み">⏱️ 残り ${secRemainFormatted} ➔ 見込み ${secEtaTimeStr}</span>`
        : `<span style="font-size: 10.5px; font-weight: 700; color: #34d399; background: rgba(16, 185, 129, 0.2); padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(52, 211, 153, 0.4);">✓ 全完了</span>`;
    } else if (isPast) {
      let secActMins = 0;
      let secDoneCount = 0;
      secTasksAll.forEach(t => {
        if (getTaskStatusForSelectedDate(t) === 'completed') {
          secDoneCount++;
          secActMins += t.actMin || t.estMin || 25;
        }
      });
      const k = getSelectedDateKey();
      secHabits.forEach(h => {
        if (getHabitStatusForSelectedDate(h) === 'completed') {
          secDoneCount++;
          secActMins += (h.history && typeof h.history[k] === 'object' && h.history[k]?.durationMin) ? h.history[k].durationMin : (h.targetMin || 15);
        }
      });
      const sH = Math.floor(secActMins / 60);
      const sM = secActMins % 60;
      const actFormatted = sH > 0 ? `${sH}h${sM}m` : `${sM}分`;

      secEtaBadgeHtml = `<span class="section-group-eta" style="font-size: 11px; font-weight: 700; color: #fbbf24; background: rgba(0, 0, 0, 0.35); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(251, 191, 36, 0.35); font-family: 'JetBrains Mono', monospace;">📜 実績: ${secDoneCount}/${secTasksAll.length + secHabits.length}件 (${actFormatted})</span>`;
    } else if (isFuture) {
      let secPlanMins = 0;
      secTasksAll.forEach(t => { secPlanMins += getEstimatedDuration(t, 'task').targetMin; });
      secHabits.forEach(h => { secPlanMins += getEstimatedDuration(h, 'habit').targetMin; });
      const sH = Math.floor(secPlanMins / 60);
      const sM = secPlanMins % 60;
      const planFormatted = sH > 0 ? `${sH}h${sM}m` : `${sM}分`;

      secEtaBadgeHtml = `<span class="section-group-eta" style="font-size: 11px; font-weight: 700; color: #38bdf8; background: rgba(0, 0, 0, 0.35); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.35); font-family: 'JetBrains Mono', monospace;">📅 予定: 全${secTasksAll.length + secHabits.length}件 (${planFormatted})</span>`;
    }

    const secPct = (typeof getSectionTimeProgress === 'function') ? getSectionTimeProgress(s.name) : null;
    const isActiveSec = secPct !== null;
    const isWarningSec = isActiveSec && secPct >= 70;
    const secStyleAttr = isActiveSec ? `style="--section-timescale-pct: ${secPct}%; margin-bottom: 20px;"` : 'style="margin-bottom: 20px;"';

    html += `
      <div class="section-group ${isActiveSec ? 'is-active-section is-timescale-active' : ''} ${isWarningSec ? 'is-timescale-warning' : ''}" ${secStyleAttr}>
        <div class="section-group-title">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span>${s.label}</span>
            ${secEtaBadgeHtml}
          </div>
          <div class="section-group-right">
            <div class="banner-actions">
              ${showTasks ? `
                <button class="btn-banner-add btn-banner-add-task btn-group-add" onclick="openAddTaskModal('${s.name}')" title="${s.label}にタスクを追加">
                  <span class="btn-icon">🎯</span> ＋ タスク追加
                </button>
              ` : ''}
              ${showHabits ? `
                <button class="btn-banner-add btn-banner-add-habit btn-group-add" onclick="openAddModal('${s.name}')" title="${s.label}にハビットを追加">
                  <span class="btn-icon">🌿</span> ＋ ハビット追加
                </button>
              ` : ''}
            </div>
            <span class="section-group-stats">
              ${showTasks ? `🎯 タスク ${secTasksAll.filter(t=>t.status==='completed').length}/${secTasksAll.length}` : ''}
              ${showTasks && showHabits ? ' &nbsp;|&nbsp; ' : ''}
              ${showHabits ? `🌿 ハビット ${secHabits.filter(h=>h.status==='completed').length}/${secHabits.length}` : ''}
            </span>
          </div>
        </div>
        <div class="section-split-container ${showTasks && showHabits ? '' : 'grid-single'}">
          ${showTasks ? `
            <div class="section-subgroup">
              <div class="cards-list"
                   ondragover="handleContainerDragOver(event)"
                   ondragleave="handleContainerDragLeave(event)"
                   ondrop="handleContainerDrop(event, '${s.name}', 'task')">
                ${secTasks.length > 0 ? secTasks.map(renderTaskCardHtml).join('') : '<p style="font-size: 11.5px; color: var(--text-dim); padding: 8px 12px; margin: 0;">🎯 このセクションのタスクはすべて完了しました！</p>'}
                ${renderGhostAddTaskHtml(s.name)}
              </div>
            </div>
          ` : ''}
          ${showHabits ? `
            <div class="section-subgroup">
              <div class="cards-list"
                   ondragover="handleContainerDragOver(event)"
                   ondragleave="handleContainerDragLeave(event)"
                   ondrop="handleContainerDrop(event, '${s.name}', 'habit')">
                ${secHabits.length > 0 ? secHabits.map(renderHabitCardHtml).join('') : '<p style="font-size: 11.5px; color: var(--text-dim); padding: 8px 12px; margin: 0;">🌿 このセクションのハビットはすべて完了しました！</p>'}
                ${renderGhostAddHabitHtml(s.name)}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  container.innerHTML = html || '<div class="empty-state"><p>表示条件に該当するタスク・ハビットはありません</p></div>';
}
