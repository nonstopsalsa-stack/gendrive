/**
 * Gendrive - Card & Item UI Renderers
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Badge & Meta Helpers
// =========================================================================

function getEisenhowerLabelBadge(labelKey) {
  const map = {
    'iron_rule': { text: '🔥 ALL - IN', cls: 'iron-rule' },
    'frog0': { text: '🐸 第0 (最優先カエル)', cls: 'frog0' },
    'p1': { text: '💼 第1 (緊急×重要)', cls: 'p1' },
    'p2': { text: '🌱 第2 (非緊急×重要)', cls: 'p2' },
    'p3': { text: '🧺 第3 (緊急×非重要)', cls: 'p3' },
    'p4': { text: '🎮 第4 (非緊急×非重要)', cls: 'p4' }
  };
  return map[labelKey] || null;
}

function getTimingBadgeHtml(habit) {
  const type = habit.displayType || 'section';
  if (type === 'anytime') {
    return `<span class="meta-tag" style="color: #38bdf8;">🌐 終日</span>`;
  }
  if (type === 'custom') {
    return `<span class="meta-tag" style="color: #f59e0b;">⏰ ${habit.customStart || ''}〜${habit.customEnd || ''}</span>`;
  }
  return `<span class="meta-tag">${habit.section || '未定'}</span>`;
}

// =========================================================================
// 2. Duration & Elapsed Time Calculations
// =========================================================================

function getEstimatedDuration(item, type = 'task') {
  const isHabit = type === 'habit' || (item.id && String(item.id).startsWith('H')) || (!item.title && item.name);
  const defaultFallback = isHabit ? (item.targetMin || 5) : (item.estMin || 15);

  const logs = [];

  // 1. executionLogs
  if (Array.isArray(item.executionLogs) && item.executionLogs.length > 0) {
    const sorted = [...item.executionLogs].sort((a, b) => new Date(b.completedAt || b.dateKey) - new Date(a.completedAt || a.dateKey));
    for (const log of sorted) {
      if (typeof log.durationMin === 'number' && log.durationMin > 0) {
        logs.push(log.durationMin);
        if (logs.length >= 10) break;
      }
    }
  }

  // 2. task.history / habit.history
  if (logs.length < 10 && item.history) {
    if (Array.isArray(item.history)) {
      const reversed = [...item.history].reverse();
      for (const h of reversed) {
        if (logs.length >= 10) break;
        const dur = typeof h === 'number' ? h : h.durationMin;
        if (typeof dur === 'number' && dur > 0) logs.push(dur);
      }
    } else if (typeof item.history === 'object') {
      const entries = Object.entries(item.history).sort((a, b) => b[0].localeCompare(a[0]));
      for (const [dk, val] of entries) {
        if (logs.length >= 10) break;
        if (typeof val === 'object' && val !== null && typeof val.durationMin === 'number' && val.durationMin > 0) {
          logs.push(val.durationMin);
        }
      }
    }
  }

  // 3. habit.durationLogs
  if (logs.length < 10 && Array.isArray(item.durationLogs)) {
    const reversed = [...item.durationLogs].reverse();
    for (const d of reversed) {
      if (logs.length >= 10) break;
      if (typeof d === 'number' && d > 0) logs.push(d);
    }
  }

  // 4. 定期タスクの同名過去実績
  if (logs.length < 10 && !isHabit && typeof state !== 'undefined' && state && Array.isArray(state.tasks)) {
    const pastSame = state.tasks.filter(t => t.id !== item.id && t.title === item.title && t.status === 'completed' && t.actMin > 0);
    for (const pt of pastSame) {
      if (logs.length >= 10) break;
      logs.push(pt.actMin);
    }
  }

  if (logs.length === 0) {
    return {
      targetMin: defaultFallback,
      count: 0,
      hasAverage: false,
      label: '目安時間'
    };
  }

  const sum = logs.reduce((acc, v) => acc + v, 0);
  const avg = Math.max(1, Math.round(sum / logs.length));

  return {
    targetMin: avg,
    count: logs.length,
    hasAverage: true,
    label: logs.length >= 10 ? '過去10回平均' : `過去${logs.length}回平均`
  };
}

function getItemRemainingMinutes(item, type = 'task') {
  if (item.status === 'completed' || item.status === 'skipped') return 0;

  const est = getEstimatedDuration(item, type).targetMin;
  if (item.status === 'in_progress') {
    if (type === 'task') {
      const elapsed = getTaskCurrentElapsedMin(item);
      return Math.max(1, est - elapsed);
    } else {
      const elapsedMin = item.startTimestamp ? Math.max(0, Math.floor((Date.now() - item.startTimestamp) / 60000)) : 0;
      return Math.max(1, est - elapsedMin);
    }
  }
  if (item.status === 'paused') {
    const elapsed = item.actMin || Math.floor((item.accumulatedSeconds || 0) / 60);
    return Math.max(1, est - elapsed);
  }
  return est;
}

function getTaskCurrentElapsedMin(task) {
  if (!task) return 0;
  const baseSec = task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0);
  const liveSec = (task.status === 'in_progress' && task.startTimestamp)
    ? Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000))
    : 0;
  return Math.floor((baseSec + liveSec) / 60);
}

// =========================================================================
// 3. Ghost (Quick Add) Cards
// =========================================================================

function renderGhostAddTaskHtml(sectionName) {
  const safeSection = sectionName || state.currentSection || '第2セッション';
  return `
    <div class="ghost-add-task-card" onclick="openAddTaskModal('${safeSection}')" title="${safeSection}にタスクを追加">
      <span class="ghost-add-icon">🎯</span>
      <span class="ghost-add-text">このセクションにタスクを追加...</span>
    </div>
  `;
}

function renderGhostAddHabitHtml(sectionName) {
  const safeSection = sectionName || state.currentSection || '第2セッション';
  return `
    <div class="ghost-add-habit-card" onclick="openAddModal('${safeSection}')" title="${safeSection}にハビットを追加">
      <span class="ghost-add-icon">🌿</span>
      <span class="ghost-add-text">このセクションにハビットを追加...</span>
    </div>
  `;
}

// =========================================================================
// 4. Habit Card Renderer
// =========================================================================

function renderHabitCardHtml(habit, index = 0) {
  const isToday = state.selectedDateOffset === 0;
  const isPast = state.selectedDateOffset > 0;
  const isFuture = state.selectedDateOffset < 0;

  const curStatus = getHabitStatusForSelectedDate(habit);
  const isCompleted = curStatus === 'completed';
  const isInProgress = isToday && habit.status === 'in_progress';
  const isPaused = isToday && habit.status === 'paused';

  const curCount = getHabitDayCount(habit);
  const targetTimes = getHabitTargetTimes(habit);
  const progressBadge = getHabitCompletionProgressHtml(habit);
  const estInfo = getEstimatedDuration(habit, 'habit');

  const timescalePct = getHabitTimeProgress(habit);
  let cardClasses = ['habit-card'];
  if (isInProgress) cardClasses.push('in-progress', 'is-timescale-active');
  if (isPaused) cardClasses.push('paused', 'is-timescale-paused');
  if ((isInProgress || isPaused) && timescalePct >= 70) cardClasses.push('is-timescale-warning');
  if (isCompleted) cardClasses.push('completed');
  const styleAttr = (isInProgress || isPaused) ? `style="--timescale-pct: ${timescalePct}%;"` : '';

  let timeDisplayHtml = '';
  if (isToday) {
    if (isInProgress) {
      const curElapsedMin = habit.startTimestamp ? Math.max(0, Math.floor((Date.now() - habit.startTimestamp) / 60000)) : 0;
      timeDisplayHtml = `
        <span class="tc-est-badge progress-mode" id="habit-progress-time-${habit.id}">実績/目安: <b>${curElapsedMin}分</b> / ${estInfo.targetMin}分</span>
        <button class="tc-status-pill in-progress habit-pill clickable-pause" onclick="event.stopPropagation(); pauseHabit('${habit.id}')" title="クリックして一時中断 [P]">● 実行中</button>
      `;
    } else if (isPaused) {
      const pausedElapsedMin = habit.actMin || Math.floor((habit.accumulatedSeconds || 0) / 60);
      timeDisplayHtml = `
        <span class="tc-est-badge progress-mode">実績/目安: <b>${pausedElapsedMin}分</b> / ${estInfo.targetMin}分</span>
        <button class="tc-status-pill paused habit-pill clickable-resume" onclick="event.stopPropagation(); startHabit('${habit.id}')" title="クリックして作業を再開 [P]">⏸️ 中断中</button>
      `;
    } else if (isCompleted) {
      const actMin = habit.actMin || estInfo.targetMin;
      timeDisplayHtml = `
        <span class="tc-est-badge progress-mode completed-mode">実績/目安: <b>${actMin}分</b> / ${estInfo.targetMin}分</span>
        <span class="tc-status-pill completed habit-pill">✓ 完了</span>
      `;
    } else {
      timeDisplayHtml = `
        <span class="tc-est-badge progress-mode">実績/目安: <span class="wait-dash">-</span> / ${estInfo.targetMin}分</span>
        <span class="tc-status-pill wait habit-pill">⏳ 待機中</span>
      `;
    }
  } else if (isPast) {
    if (isCompleted) {
      const actMin = habit.actMin || estInfo.targetMin;
      timeDisplayHtml = `
        <span class="tc-est-badge progress-mode completed-mode">実績/目安: <b>${actMin}分</b> / ${estInfo.targetMin}分</span>
        <span class="tc-status-pill completed habit-pill">✓ 完了</span>
      `;
    } else {
      timeDisplayHtml = `
        <span class="tc-est-badge progress-mode">実績/目安: <span class="wait-dash">-</span> / ${estInfo.targetMin}分</span>
        <span class="tc-status-pill unreached habit-pill">未達</span>
      `;
    }
  } else if (isFuture) {
    timeDisplayHtml = `
      <span class="tc-est-badge progress-mode">実績/目安: <span class="wait-dash">-</span> / ${estInfo.targetMin}分</span>
      <span class="tc-status-pill future habit-pill">📅 予定</span>
    `;
  }

  let actionBtnHtml = '';
  if (isToday) {
    if (isInProgress) {
      actionBtnHtml = `<button class="btn-habit-action done" onclick="promptCompleteHabit('${habit.id}', event)">✓ 完了</button>`;
    } else if (isPaused) {
      actionBtnHtml = `<button class="btn-habit-action resume" onclick="startHabit('${habit.id}')" title="作業を再開">▶ 再開</button>`;
    } else if (isCompleted) {
      actionBtnHtml = `<button class="btn-habit-action revert" onclick="toggleHabit('${habit.id}')" title="未達成に戻す">↩ 戻す</button>`;
    } else {
      actionBtnHtml = `<button class="btn-habit-action start" onclick="startHabit('${habit.id}')">▶ 開始</button>`;
    }
  } else if (isPast) {
    if (isCompleted) {
      actionBtnHtml = `<button class="btn-habit-action revert" onclick="toggleHabit('${habit.id}')" title="未達成に戻す">↩ 戻す</button>`;
    } else {
      actionBtnHtml = `<button class="btn-habit-action done" onclick="promptCompleteHabit('${habit.id}', event)">✓ 完了にする</button>`;
    }
  } else if (isFuture) {
    actionBtnHtml = `<span style="font-size: 11px; color: #38bdf8; padding: 2px 6px; background: rgba(56,189,248,0.12); border-radius: 4px; border: 1px solid rgba(56,189,248,0.3);">📅 予定</span>`;
  }

  return `
    <div class="${cardClasses.join(' ')}" 
         data-id="${habit.id}" 
         data-type="habit"
         ${styleAttr}
         draggable="true"
         ondragstart="handleCardDragStart(event, '${habit.id}', 'habit')"
         ondragover="handleCardDragOver(event, '${habit.id}', 'habit')"
         ondragleave="handleCardDragLeave(event)"
         ondrop="handleCardDrop(event, '${habit.id}', 'habit')"
         onclick="openEditModal('${habit.id}')">
      <div class="habit-card-header">
        <div class="habit-labels-row">
          ${getTimingBadgeHtml(habit)}
          ${habit.domain ? `<span class="meta-tag domain">${habit.domain}</span>` : ''}
          ${progressBadge}
          ${getRecurrenceBadgeHtml(habit.recurrence)}
          ${normalizeTags(habit.tags).map(t => `<span class="badge-custom-tag" onclick="handleTagBadgeClick(event, '${t}')" title="#${t} で絞込/除外">#${t}</span>`).join('')}
        </div>
        <div class="habit-header-right">
          <div class="habit-chute-times">
            ${timeDisplayHtml}
          </div>
          <div class="habit-actions" onclick="event.stopPropagation()">
            ${actionBtnHtml}
            <button class="btn-habit-action" onclick="openEditModal('${habit.id}')" title="設定・編集">⚙️</button>
          </div>
        </div>
      </div>

      <div class="habit-title">${habit.name}</div>
    </div>
  `;
}

// =========================================================================
// 5. Task Card Renderer
// =========================================================================

function renderTaskCardHtml(task) {
  const labelBadge = getEisenhowerLabelBadge(task.label);
  const estInfo = getEstimatedDuration(task, 'task');

  const isToday = state.selectedDateOffset === 0;
  const isPast = state.selectedDateOffset > 0;
  const isFuture = state.selectedDateOffset < 0;

  const curStatus = getTaskStatusForSelectedDate(task);
  const isCompleted = curStatus === 'completed';
  const isInProgress = isToday && task.status === 'in_progress';
  const isPaused = isToday && task.status === 'paused';

  const timescalePct = getTaskTimeProgress(task);
  let cardClasses = ['task-card'];
  if (isInProgress) cardClasses.push('in-progress', 'is-timescale-active');
  if (isPaused) cardClasses.push('paused', 'is-timescale-paused');
  if ((isInProgress || isPaused) && timescalePct >= 70) cardClasses.push('is-timescale-warning');
  if (isCompleted) cardClasses.push('completed');
  const styleAttr = (isInProgress || isPaused) ? `style="--timescale-pct: ${timescalePct}%;"` : '';

  let timeDisplayHtml = '';
  if (isToday) {
    if (isInProgress) {
      const curElapsedMin = getTaskCurrentElapsedMin(task);
      timeDisplayHtml = `
        <span class="tc-est-badge progress-mode" id="task-progress-time-${task.id}">実績/予想: <b>${curElapsedMin}分</b> / ${estInfo.targetMin}分</span>
        <button class="tc-status-pill in-progress clickable-pause" onclick="event.stopPropagation(); pauseTask('${task.id}')" title="クリックして一時中断 [P]">● 実行中</button>
      `;
    } else if (isPaused) {
      const pausedElapsedMin = task.actMin || Math.floor((task.accumulatedSeconds || 0) / 60);
      timeDisplayHtml = `
        <span class="tc-est-badge progress-mode">実績/予想: <b>${pausedElapsedMin}分</b> / ${estInfo.targetMin}分</span>
        <button class="tc-status-pill paused clickable-resume" onclick="event.stopPropagation(); startTask('${task.id}')" title="クリックして作業を再開 [P]">⏸️ 中断中</button>
      `;
    } else if (isCompleted) {
      const actMin = task.actMin || estInfo.targetMin;
      timeDisplayHtml = `
        <span class="tc-est-badge progress-mode completed-mode" title="実働時間 (${task.actStart || ''}~${task.actEnd || ''})">実績/予想: <b>${actMin}分</b> / ${estInfo.targetMin}分</span>
        <span class="tc-status-pill completed">✓ 完了</span>
      `;
    } else {
      timeDisplayHtml = `
        <span class="tc-est-badge progress-mode">実績/予想: <span class="wait-dash">-</span> / ${estInfo.targetMin}分</span>
        <span class="tc-status-pill wait">⏳ 待機中</span>
      `;
    }
  } else if (isPast) {
    if (isCompleted) {
      const actMin = task.actMin || estInfo.targetMin;
      timeDisplayHtml = `
        <span class="tc-est-badge progress-mode completed-mode">実績/予想: <b>${actMin}分</b> / ${estInfo.targetMin}分</span>
        <span class="tc-status-pill completed">✓ 完了</span>
      `;
    } else {
      timeDisplayHtml = `
        <span class="tc-est-badge progress-mode">実績/予想: <span class="wait-dash">-</span> / ${estInfo.targetMin}分</span>
        <span class="tc-status-pill unreached">未達</span>
      `;
    }
  } else if (isFuture) {
    timeDisplayHtml = `
      <span class="tc-est-badge progress-mode">実績/予想: <span class="wait-dash">-</span> / ${estInfo.targetMin}分</span>
      <span class="tc-status-pill future">📅 予定</span>
    `;
  }

  let actionsHtml = '';
  if (isToday) {
    if (isInProgress) {
      actionsHtml = `<button class="btn-task-action done" onclick="promptCompleteTask('${task.id}', event)">✓ 完了</button>`;
    } else if (isPaused) {
      actionsHtml = `<button class="btn-task-action resume" onclick="startTask('${task.id}')" title="作業を再開">▶ 再開</button>`;
    } else if (isCompleted) {
      actionsHtml = `<button class="btn-task-action revert" onclick="toggleTask('${task.id}')" title="未完了に戻す">↩ 戻す</button>`;
    } else {
      actionsHtml = `<button class="btn-task-action start" onclick="startTask('${task.id}')">▶ 開始</button>`;
    }
  } else if (isPast) {
    if (isCompleted) {
      actionsHtml = `<button class="btn-task-action revert" onclick="toggleTask('${task.id}')" title="未完了に戻す">↩ 戻す</button>`;
    } else {
      actionsHtml = `<button class="btn-task-action done" onclick="promptCompleteTask('${task.id}', event)">✓ 完了にする</button>`;
    }
  } else if (isFuture) {
    actionsHtml = `<span style="font-size: 11px; color: #38bdf8; padding: 2px 6px; background: rgba(56, 189, 248, 0.12); border-radius: 4px; border: 1px solid rgba(56, 189, 248, 0.3);">📅 予定</span>`;
  }

  return `
    <div class="${cardClasses.join(' ')}" 
         data-id="${task.id}" 
         data-type="task"
         ${styleAttr}
         draggable="true" 
         ondragstart="handleCardDragStart(event, '${task.id}', 'task')"
         ondragover="handleCardDragOver(event, '${task.id}', 'task')"
         ondragleave="handleCardDragLeave(event)"
         ondrop="handleCardDrop(event, '${task.id}', 'task')"
         onclick="openEditTaskModal('${task.id}')">
      <div class="task-card-header">
        <div class="task-labels-row">
          ${task._carriedOverFrom ? `<span class="badge-carryover" title="${task._carriedOverFrom}から自動繰越">⏪ 繰越 (${task._carriedOverFrom}より)</span>` : ''}
          ${labelBadge ? `<span class="badge-eisenhower ${labelBadge.cls}">${labelBadge.text}</span>` : ''}
          <span class="badge-frog">🐸 ${task.frog || 3}</span>
          ${task.domainMinor ? `<span class="meta-tag domain">${task.domainMinor}</span>` : ''}
          ${task.timingType === 'anytime' ? `<span class="meta-tag timing" style="color: #38bdf8;">🌐 終日</span>` : ''}
          ${normalizeTags(task.tags).map(t => `<span class="badge-custom-tag" onclick="handleTagBadgeClick(event, '${t}')" title="#${t} で絞込/除外">#${t}</span>`).join('')}
        </div>
        <div class="task-header-right">
          <div class="task-chute-times">
            ${timeDisplayHtml}
          </div>
          <div class="task-actions" onclick="event.stopPropagation()">
            ${actionsHtml}
            <button class="btn-task-action" onclick="openEditTaskModal('${task.id}')" title="設定・編集">⚙️</button>
          </div>
        </div>
      </div>

      <div class="task-title">${task.title}</div>
    </div>
  `;
}
