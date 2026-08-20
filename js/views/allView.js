/**
 * Gendrive - All / Today Full Scroll View Renderer
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Render All View (Today Screen with Section Groups for both Tasks & Habits)
// =========================================================================

function renderAllView() {
  renderAnytimeBlock();

  const container = document.getElementById('all-today-groups');
  const todayTasks = state.tasks.filter(isTaskForSelectedDate);
  const allHabits = state.habits;

  const doneTasks = todayTasks.filter(t => t.status === 'completed').length;
  const doneHabits = allHabits.filter(h => h.status === 'completed').length;

  const totalAll = todayTasks.length + allHabits.length;
  const totalDoneAll = doneTasks + doneHabits;
  const totalRate = totalAll ? Math.round((totalDoneAll / totalAll) * 100) : 0;

  document.getElementById('stat-tasks-summary').textContent = `${doneTasks} / ${todayTasks.length}`;
  document.getElementById('stat-habits-summary').textContent = `${doneHabits} / ${allHabits.length}`;
  document.getElementById('stat-rate-text').textContent = `${totalRate}%`;

  const showTasks = state.viewType === 'all' || state.viewType === 'task';
  const showHabits = state.viewType === 'all' || state.viewType === 'habit';

  let html = '';

  for (const s of SECTIONS_CONFIG) {
    // 1. Filter Tasks for this Section
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

    // 2. Filter Habits for this Section
    const secHabits = getFilteredHabits('all').filter(h => isHabitInDailySection(h, s.name));

    const hasTasks = showTasks && (secTasks.length > 0 || (state.filters.status === 'all' && secTasksAll.length > 0) || state.filters.status === 'uncompleted');
    const hasHabits = showHabits && secHabits.length > 0;

    // In filtered mode, skip empty sections entirely
    if (state.filters.status !== 'all' && secTasks.length === 0 && secHabits.length === 0) {
      continue;
    }

    // Calculate Section Remaining Minutes & Dynamic ETA for this section (Date-Aware)
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
