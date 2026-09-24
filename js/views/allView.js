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

  const isToday = state.selectedDateOffset === 0;
  const isPast = state.selectedDateOffset > 0;
  const isFuture = state.selectedDateOffset < 0;
  const todayTasks = state.tasks.filter(isTaskForSelectedDate);
  const allHabits = isToday ? state.habits : [];

  const doneTasks = todayTasks.filter(t => t.status === 'completed').length;
  const doneHabits = allHabits.filter(h => h.status === 'completed').length;

  const totalAll = todayTasks.length + allHabits.length;
  const totalDoneAll = doneTasks + doneHabits;
  const totalRate = totalAll ? Math.round((totalDoneAll / totalAll) * 100) : 0;

  const statTasksEl = document.getElementById('stat-tasks-summary');
  const statHabitsEl = document.getElementById('stat-habits-summary');
  const statRateEl = document.getElementById('stat-rate-text');
  if (statTasksEl) statTasksEl.textContent = `${doneTasks} / ${todayTasks.length}`;
  if (statHabitsEl) {
    if (isToday) {
      if (statHabitsEl.parentElement) statHabitsEl.parentElement.style.display = '';
      statHabitsEl.textContent = `${doneHabits} / ${allHabits.length}`;
    } else {
      if (statHabitsEl.parentElement) statHabitsEl.parentElement.style.display = 'none';
    }
  }
  if (statRateEl) statRateEl.textContent = `${totalRate}%`;

  const showTasks = state.viewType === 'all' || state.viewType === 'task';
  const showHabits = isToday && (state.viewType === 'all' || state.viewType === 'habit');

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
    // 1. Collect ALL Today's Tasks (All Sections + Carried-Over + Anytime)
    const collectedTasks = [];
    const seenTaskIds = new Set();

    for (const s of SECTIONS_CONFIG) {
      const secTasks = getTasksForSection(s.name);
      secTasks.forEach(t => {
        if (!seenTaskIds.has(t.id)) {
          seenTaskIds.add(t.id);
          collectedTasks.push(t);
        }
      });
    }

    // Also include Anytime / Unassigned tasks scheduled for today
    const todayKeyStr = typeof getTodayKey === 'function' ? getTodayKey() : new Date().toISOString().split('T')[0];
    state.tasks.forEach(t => {
      const normSchedDate = (t.scheduledDate && typeof normalizeToLocalDateKey === 'function') ? normalizeToLocalDateKey(t.scheduledDate) : t.scheduledDate;
      const isCarriedOver = !t.isDisabled && t.type !== 'recurring' && t.status !== 'completed' && t.status !== 'skipped' && normSchedDate && normSchedDate < todayKeyStr;
      if ((isTaskForSelectedDate(t) || isCarriedOver) && (!t.section || t.timingType === 'anytime')) {
        if (!seenTaskIds.has(t.id)) {
          seenTaskIds.add(t.id);
          collectedTasks.push(t);
        }
      }
    });
    
    // Sort tasks by section order
    const sectionOrderMap = {
      '第1セッション': 1, '第1': 1, '早朝': 1,
      '朝オペ': 2, '家事': 2, '育児': 2,
      '第2セッション': 3, '第2': 3, '午前': 3,
      '第3セッション': 4, '第3': 4, '午後': 4,
      '夜オペ': 5, '夕食': 5, '団らん': 5,
      '第4セッション': 6, '第4': 6, '夜': 6
    };

    const sortedTasks = [...collectedTasks].sort((a, b) => {
      const orderA = sectionOrderMap[a.section] || 99;
      const orderB = sectionOrderMap[b.section] || 99;
      return orderA - orderB;
    });

    const flatTasks = sortedTasks.filter(t => {
      const st = getTaskStatusForSelectedDate(t);
      if (state.filters.status === 'uncompleted') {
        if (st === 'completed' || st === 'skipped') return false;
      } else if (state.filters.status === 'completed') {
        if (st !== 'completed') return false;
      }
      if (state.filters.domain && t.domainMajor !== state.filters.domain && t.domainMinor !== state.filters.domain) return false;
      if (state.filters.dept && t.deptMajor !== state.filters.dept && t.deptMinor !== state.filters.dept) return false;
      if (state.filters.proj && t.projMajor !== state.filters.proj && t.projMinor !== state.filters.proj) return false;
      if (!matchesTagFilters(t)) return false;
      return true;
    });

    // 2. Collect ALL Habits (Active only on Today)
    const flatHabits = isToday ? getFilteredHabits('all') : [];

    let flatContentHtml = `
      ${toolbarHtml}
      <div class="section-group" style="margin-bottom: 20px; border: 1px solid rgba(56, 189, 248, 0.2); background: rgba(15, 23, 42, 0.45); padding: 14px; border-radius: 10px;">
        <div class="section-split-container ${showTasks && showHabits ? '' : 'grid-single'}">
          ${showTasks ? `
            <div class="section-subgroup">
              <div style="font-size: 13px; font-weight: 700; color: var(--accent-cyan); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(56, 189, 248, 0.2); padding-bottom: 6px;">
                <span>🎯 ${isToday ? '今日の全タスク' : '対象日の全タスク'} (${flatTasks.length}件)</span>
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
      const st = getTaskStatusForSelectedDate(t);
      if (state.filters.status === 'uncompleted') {
        if (st === 'completed' || st === 'skipped') return false;
      } else if (state.filters.status === 'completed') {
        if (st !== 'completed') return false;
      }
      if (state.filters.domain && t.domainMajor !== state.filters.domain && t.domainMinor !== state.filters.domain) return false;
      if (state.filters.dept && t.deptMajor !== state.filters.dept && t.deptMinor !== state.filters.dept) return false;
      if (state.filters.proj && t.projMajor !== state.filters.proj && t.projMinor !== state.filters.proj) return false;
      if (!matchesTagFilters(t)) return false;
      return true;
    });

    const secHabits = isToday ? getFilteredHabits('all').filter(h => isHabitInDailySection(h, s.name)) : [];

    if (state.filters.status !== 'all' && secTasks.length === 0 && secHabits.length === 0) {
      continue;
    }

    let secEtaBadgeHtml = '';

    if (isToday) {
      let secTaskRemainMin = 0;
      let secTaskRemainCount = 0;
      secTasksAll.forEach(t => {
        const st = getTaskStatusForSelectedDate(t);
        if (st !== 'completed' && st !== 'skipped') {
          secTaskRemainMin += getItemRemainingMinutes(t, 'task');
          secTaskRemainCount++;
        }
      });

      let secHabitRemainMin = 0;
      let secHabitRemainCount = 0;
      secHabits.forEach(h => {
        if (typeof isHabitTimeExcluded === 'function' && isHabitTimeExcluded(h)) return;
        const st = getHabitStatusForSelectedDate(h);
        if (st !== 'completed' && st !== 'skipped') {
          secHabitRemainMin += getItemRemainingMinutes(h, 'habit');
          secHabitRemainCount++;
        }
      });

      const secRemainMin = secTaskRemainMin + secHabitRemainMin;
      const secRemainCount = secTaskRemainCount + secHabitRemainCount;
      const now = new Date();
      const secEtaDate = new Date(now.getTime() + secRemainMin * 60000);
      const sH = String(secEtaDate.getHours()).padStart(2, '0');
      const sM = String(secEtaDate.getMinutes()).padStart(2, '0');
      const secEtaTimeStr = sH + ':' + sM;

      let isSecOverdue = false;
      if (s && secRemainCount > 0) {
        const secEndHourDec = s.end;
        const secEtaHourDec = secEtaDate.getHours() + (secEtaDate.getMinutes() / 60);
        const curHourDec = now.getHours() + (now.getMinutes() / 60);
        if (secEtaDate.getDate() !== now.getDate() || secEtaHourDec > secEndHourDec || curHourDec >= secEndHourDec) {
          isSecOverdue = true;
        }
      }

      const secTaskFormatted = (typeof formatMinsUnified === 'function') ? formatMinsUnified(secTaskRemainMin) : (secTaskRemainMin + '\u5206');
      const secHabitFormatted = (typeof formatMinsUnified === 'function') ? formatMinsUnified(secHabitRemainMin) : (secHabitRemainMin + '\u5206');
      const secTotalFormatted = (typeof formatMinsUnified === 'function') ? formatMinsUnified(secRemainMin) : (secRemainMin + '\u5206');

      if (secRemainCount > 0) {
        const overdueCls = isSecOverdue ? ' eta-alert-overdue' : '';
        secEtaBadgeHtml = '<div class="tc-eta-unified-badge tc-eta-compact' + overdueCls + '" title="\u5F53\u30BB\u30AF\u30B7\u30E7\u30F3\u6B8B\u308A\u6642\u9593: ' + secTotalFormatted + ' / \u5B8C\u4E86\u898B\u8FBC\u307F: ' + secEtaTimeStr + '">' +
          '<div class="tc-eta-main-row">' +
            '<div class="tc-eta-item tc-eta-remain-item">' +
              '<span class="tc-eta-icon">&#x23F1;&#xFE0F;</span>' +
              '<span class="tc-eta-label">\u6B8B:</span>' +
              '<b class="tc-eta-val">' + secTotalFormatted + '</b>' +
            '</div>' +
            '<span class="tc-eta-arrow">&#x279C;</span>' +
            '<div class="tc-eta-item tc-eta-finish-item">' +
              '<span class="tc-eta-icon">&#x1F3C1;</span>' +
              '<span class="tc-eta-label">\u898B\u8FBC:</span>' +
              '<b class="tc-eta-val tc-eta-highlight">' + secEtaTimeStr + '</b>' +
            '</div>' +
          '</div>' +
          '<div class="tc-eta-sub-row">' +
            '<span class="tc-eta-breakdown-item">' +
              '<span class="tc-eta-sub-icon">&#x1F4CB;</span>' +
              '<span class="tc-eta-sub-label">\u30BF\u30B9\u30AF:</span>' +
              '<b class="tc-eta-sub-val">' + secTaskFormatted + ' (' + secTaskRemainCount + ')</b>' +
            '</span>' +
            '<span class="tc-eta-divider">|</span>' +
            '<span class="tc-eta-breakdown-item">' +
              '<span class="tc-eta-sub-icon">&#x1F504;</span>' +
              '<span class="tc-eta-sub-label">\u30CF\u30D3\u30C3\u30C8:</span>' +
              '<b class="tc-eta-sub-val">' + secHabitFormatted + ' (' + secHabitRemainCount + ')</b>' +
            '</span>' +
          '</div>' +
        '</div>';
      } else {
        secEtaBadgeHtml = '<span style="font-size: 10.5px; font-weight: 700; color: #34d399; background: rgba(16, 185, 129, 0.2); padding: 2px 7px; border-radius: 4px; border: 1px solid rgba(52, 211, 153, 0.4);">&#x2714;&#xFE0F; \u5168\u9054\u6210!\uD83C\uDF89</span>';
      }
    } else if (isPast) {
      let secTaskActMins = 0;
      let secDoneTaskCount = 0;
      secTasksAll.forEach(t => {
        if (getTaskStatusForSelectedDate(t) === 'completed') {
          secDoneTaskCount++;
          secTaskActMins += t.actMin || t.estMin || 15;
        }
      });
      const k = getSelectedDateKey();
      let secHabitActMins = 0;
      let secDoneHabitCount = 0;
      secHabits.forEach(h => {
        if (typeof isHabitTimeExcluded === 'function' && isHabitTimeExcluded(h)) return;
        if (getHabitStatusForSelectedDate(h) === 'completed') {
          secDoneHabitCount++;
          secHabitActMins += (h.history && typeof h.history[k] === 'object' && h.history[k]?.durationMin) ? h.history[k].durationMin : (h.targetMin || 5);
        }
      });

      const secActualMins = secTaskActMins + secHabitActMins;
      const secDoneCount = secDoneTaskCount + secDoneHabitCount;
      const countablePastSecHabits = secHabits.filter(h => !(typeof isHabitTimeExcluded === 'function' && isHabitTimeExcluded(h)));
      const totalCount = secTasksAll.length + countablePastSecHabits.length;
      const actFormatted = (typeof formatMinsUnified === 'function') ? formatMinsUnified(secActualMins) : (secActualMins + '\u5206');
      const taskActFormatted = (typeof formatMinsUnified === 'function') ? formatMinsUnified(secTaskActMins) : (secTaskActMins + '\u5206');
      const habitActFormatted = (typeof formatMinsUnified === 'function') ? formatMinsUnified(secHabitActMins) : (secHabitActMins + '\u5206');

      secEtaBadgeHtml = '<div class="tc-eta-unified-badge tc-eta-compact">' +
        '<div class="tc-eta-main-row">' +
          '<div class="tc-eta-item">' +
            '<span class="tc-eta-label">\u5B8C\u4E86:</span>' +
            '<b class="tc-eta-val">' + secDoneCount + '/' + totalCount + '\u4EF6</b>' +
          '</div>' +
          '<span class="tc-eta-arrow">&#x279C;</span>' +
          '<div class="tc-eta-item">' +
            '<span class="tc-eta-label">\u5B9F\u7E3E:</span>' +
            '<b class="tc-eta-val tc-eta-highlight">' + actFormatted + '</b>' +
          '</div>' +
        '</div>' +
        '<div class="tc-eta-sub-row">' +
          '<span class="tc-eta-breakdown-item">' +
            '<span class="tc-eta-sub-label">\u30BF\u30B9\u30AF:</span>' +
            '<b class="tc-eta-sub-val">' + taskActFormatted + ' (' + secDoneTaskCount + ')</b>' +
          '</span>' +
          '<span class="tc-eta-divider">|</span>' +
          '<span class="tc-eta-breakdown-item">' +
            '<span class="tc-eta-sub-label">\u30CF\u30D3\u30C3\u30C8:</span>' +
            '<b class="tc-eta-sub-val">' + habitActFormatted + ' (' + secDoneHabitCount + ')</b>' +
          '</span>' +
        '</div>' +
      '</div>';
    } else if (isFuture) {
      let secTaskPlanMins = 0;
      secTasksAll.forEach(t => { secTaskPlanMins += getEstimatedDuration(t, 'task').targetMin; });
      let secHabitPlanMins = 0;
      let secHabitPlanCount = 0;
      secHabits.forEach(h => {
        if (typeof isHabitTimeExcluded === 'function' && isHabitTimeExcluded(h)) return;
        secHabitPlanMins += getEstimatedDuration(h, 'habit').targetMin;
        secHabitPlanCount++;
      });
      const secPlanMins = secTaskPlanMins + secHabitPlanMins;
      const countableFutureSecHabits = secHabits.filter(h => !(typeof isHabitTimeExcluded === 'function' && isHabitTimeExcluded(h)));
      const planFormatted = (typeof formatMinsUnified === 'function') ? formatMinsUnified(secPlanMins) : (secPlanMins + '\u5206');
      const taskPlanFormatted = (typeof formatMinsUnified === 'function') ? formatMinsUnified(secTaskPlanMins) : (secTaskPlanMins + '\u5206');
      const habitPlanFormatted = (typeof formatMinsUnified === 'function') ? formatMinsUnified(secHabitPlanMins) : (secHabitPlanMins + '\u5206');

      secEtaBadgeHtml = '<div class="tc-eta-unified-badge tc-eta-compact">' +
        '<div class="tc-eta-main-row">' +
          '<div class="tc-eta-item">' +
            '<span class="tc-eta-label">\u4E88\u5B9A\u4EF6\u6570:</span>' +
            '<b class="tc-eta-val">' + (secTasksAll.length + countableFutureSecHabits.length) + '\u4EF6</b>' +
          '</div>' +
          '<span class="tc-eta-arrow">&#x279C;</span>' +
          '<div class="tc-eta-item">' +
            '<span class="tc-eta-label">\u7DCF\u6642\u9593:</span>' +
            '<b class="tc-eta-val tc-eta-highlight">' + planFormatted + '</b>' +
          '</div>' +
        '</div>' +
        '<div class="tc-eta-sub-row">' +
          '<span class="tc-eta-breakdown-item">' +
            '<span class="tc-eta-sub-label">\u30BF\u30B9\u30AF:</span>' +
            '<b class="tc-eta-sub-val">' + taskPlanFormatted + ' (' + secTasksAll.length + ')</b>' +
          '</span>' +
          '<span class="tc-eta-divider">|</span>' +
          '<span class="tc-eta-breakdown-item">' +
            '<span class="tc-eta-sub-label">\u30CF\u30D3\u30C3\u30C8:</span>' +
            '<b class="tc-eta-sub-val">' + habitPlanFormatted + ' (' + countableFutureSecHabits.length + ')</b>' +
          '</span>' +
        '</div>' +
      '</div>';
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
