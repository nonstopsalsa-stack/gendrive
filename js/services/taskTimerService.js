let activeTaskTimerInterval = null;

function moveTaskToTopOfSection(taskId) {
  if (!state || !Array.isArray(state.tasks)) return;
  const targetTaskIdx = state.tasks.findIndex(t => t.id === taskId);
  if (targetTaskIdx === -1) return;
  const targetTask = state.tasks[targetTaskIdx];

  const firstSectionTaskIdx = state.tasks.findIndex(t => {
    if (targetTask.section) {
      return t.section === targetTask.section;
    } else {
      return !t.section || t.timingType === 'anytime';
    }
  });

  if (firstSectionTaskIdx !== -1 && firstSectionTaskIdx !== targetTaskIdx) {
    state.tasks.splice(targetTaskIdx, 1);
    state.tasks.splice(firstSectionTaskIdx, 0, targetTask);
  }
}

function startTask(taskId) {
  const targetId = String(taskId);
  const now = new Date();
  const nowTimeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  // 1. Optimistic Direct DOM Mutation Guard (即時DOM実行中遷移ガード)
  try {
    const cardEl = document.querySelector(`.task-card[data-id="${targetId}"]`);
    if (cardEl) {
      cardEl.classList.remove('paused', 'completed', 'is-timescale-paused', 'dimmed-card', 'is-skipped');
      cardEl.classList.add('in-progress', 'is-timescale-active');
      cardEl.style.setProperty('--timescale-pct', '0%');

      const pill = cardEl.querySelector('.tc-status-pill');
      if (pill) {
        pill.className = 'tc-status-pill in-progress clickable-pause';
        pill.setAttribute('onclick', `event.stopPropagation(); pauseTask('${targetId}')`);
        pill.setAttribute('title', 'クリックして一時中断 [P]');
        pill.textContent = '● 実行中';
      }

      const actionsDiv = cardEl.querySelector('.task-actions');
      if (actionsDiv) {
        const startBtn = actionsDiv.querySelector('.btn-task-action.start, .btn-task-action.resume, .btn-task-action.revert');
        if (startBtn) {
          actionsDiv.innerHTML = `
            <button type="button" class="btn-task-action pause" onclick="pauseTask('${targetId}')" title="一時中断">⏸️ 中断</button>
            <button type="button" class="btn-task-action done" onclick="promptCompleteTask('${targetId}', event)">✔️ 完了</button>
            ${actionsDiv.querySelector('.btn-card-obsidian') ? actionsDiv.querySelector('.btn-card-obsidian').outerHTML : ''}
            <button class="btn-task-action" onclick="openEditTaskModal('${targetId}')" title="設定・編集">⚙️</button>
          `;
        }
      }
    }

    // 先行タスクのDOM即時中断表示
    document.querySelectorAll(`.task-card.in-progress:not([data-id="${targetId}"])`).forEach(tCard => {
      const tId = tCard.getAttribute('data-id');
      tCard.classList.remove('in-progress', 'is-timescale-active');
      tCard.classList.add('paused', 'is-timescale-paused');
      const tPill = tCard.querySelector('.tc-status-pill');
      if (tPill) {
        tPill.className = 'tc-status-pill paused clickable-resume';
        tPill.setAttribute('onclick', `event.stopPropagation(); startTask('${tId}')`);
        tPill.setAttribute('title', 'クリックして作業を再開 [P]');
        tPill.textContent = '⏸️ 中断中';
      }
      const tActions = tCard.querySelector('.task-actions');
      if (tActions) {
        const pBtn = tActions.querySelector('.btn-task-action.pause');
        if (pBtn) pBtn.remove();
        const dBtn = tActions.querySelector('.btn-task-action.done');
        if (dBtn) {
          dBtn.className = 'btn-task-action resume';
          dBtn.setAttribute('onclick', `startTask('${tId}')`);
          dBtn.setAttribute('title', '作業を再開');
          dBtn.textContent = '▶ 再開';
        }
      }
    });

    // 先行ハビットのDOM即時中断表示
    document.querySelectorAll('.habit-card.in-progress').forEach(hCard => {
      const hId = hCard.getAttribute('data-id');
      hCard.classList.remove('in-progress', 'is-timescale-active');
      hCard.classList.add('paused', 'is-timescale-paused');
      const hPill = hCard.querySelector('.tc-status-pill');
      if (hPill) {
        hPill.className = 'tc-status-pill paused habit-pill clickable-resume';
        hPill.setAttribute('onclick', `event.stopPropagation(); startHabit('${hId}')`);
        hPill.setAttribute('title', 'クリックして作業を再開 [P]');
        hPill.textContent = '⏸️ 中断中';
      }
      const hActionBtn = hCard.querySelector('.btn-habit-action.done');
      if (hActionBtn) {
        hActionBtn.className = 'btn-habit-action resume';
        hActionBtn.setAttribute('onclick', `startHabit('${hId}')`);
        hActionBtn.setAttribute('title', '作業を再開');
        hActionBtn.textContent = '▶ 再開';
      }
    });
  } catch (domErr) {
    console.warn('[Optimistic DOM Mutation Task] Non-fatal error:', domErr);
  }

  moveTaskToTopOfSection(targetId);

  let autoPausedTaskId = null;
  let isResumingWithNote = false;

  state.tasks.forEach(t => {
    if (String(t.id) === targetId) {
      if (t.status === 'paused' && t.resumeNote && t.resumeNote.trim()) {
        isResumingWithNote = true;
      }
      t.status = 'in_progress';
      t.actStart = t.actStart || nowTimeStr;
      t.startTimestamp = Date.now();
      t._localUpdatedAt = Date.now();
      state.activeTaskId = targetId;
      state.activeHabitId = null;
    } else if (t.status === 'in_progress') {
      t.status = 'paused';
      t._localUpdatedAt = Date.now();
      if (t.startTimestamp) {
        const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - t.startTimestamp) / 1000));
        t.accumulatedSeconds = (t.accumulatedSeconds || (t.actMin ? t.actMin * 60 : 0)) + sessionElapsedSec;
        t.actMin = Math.round(t.accumulatedSeconds / 60);
      }
      t.startTimestamp = null;
      autoPausedTaskId = t.id;
    }
  });

  if (Array.isArray(state.habits)) {
    let habitPaused = false;
    state.habits.forEach(h => {
      if (h.status === 'in_progress') {
        h.status = 'paused';
        h._localUpdatedAt = Date.now();
        if (h.startTimestamp) {
          const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - h.startTimestamp) / 1000));
          h.accumulatedSeconds = (h.accumulatedSeconds || (h.actMin ? h.actMin * 60 : 0)) + sessionElapsedSec;
          h.actMin = Math.round(h.accumulatedSeconds / 60);
        }
        h.startTimestamp = null;
        habitPaused = true;
      }
    });
    if (habitPaused && typeof saveHabits === 'function') {
      saveHabits();
    }
  }

  saveTasks();
  renderApp();

  if (autoPausedTaskId && isResumingWithNote && typeof openDualResumeNoteModal === 'function') {
    openDualResumeNoteModal(autoPausedTaskId, targetId);
  } else if (isResumingWithNote && typeof openResumeNoteViewModal === 'function') {
    openResumeNoteViewModal(targetId);
  }
}

function pauseTask(taskId) {
  const targetId = String(taskId);
  const task = state.tasks.find(t => String(t.id) === targetId);
  if (!task || task.status !== 'in_progress') return;

  task.status = 'paused';
  task._localUpdatedAt = Date.now();
  if (task.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000));
    task.accumulatedSeconds = (task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0)) + sessionElapsedSec;
    task.actMin = Math.round(task.accumulatedSeconds / 60);
  }
  task.startTimestamp = null;
  if (String(state.activeTaskId) === targetId) {
    state.activeTaskId = null;
  }

  saveTasks();
  renderApp();

  if (typeof openResumeNoteInputModal === 'function') {
    openResumeNoteInputModal(targetId);
  }
}

function completeTask(taskId, userNote, userDurationMin) {
  const targetId = String(taskId);
  const task = state.tasks.find(t => String(t.id) === targetId);
  if (!task) return;

  const now = new Date();
  const nowTimeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  task.actEnd = nowTimeStr;
  task._localUpdatedAt = Date.now();
  
  if (task.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000));
    task.accumulatedSeconds = (task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0)) + sessionElapsedSec;
  }

  const finalTotalSec = task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : (task.estMin || 25) * 60);
  task.actMin = (userDurationMin !== undefined && userDurationMin !== null) ? Number(userDurationMin) : Math.max(1, Math.round(finalTotalSec / 60));
  task.status = 'completed';
  task.startTimestamp = null;
  task.accumulatedSeconds = 0;
  task.resumeNote = '';
  task.updatedAt = now.toISOString();

  const dateKey = getSelectedDateKey();
  const logId = 'tlog_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  if (Array.isArray(task.history)) {
    task.history.push({
      date: dateKey,
      durationMin: task.actMin,
      completedAt: now.toISOString(),
      note: userNote ? userNote.trim() : ''
    });
  } else if (typeof task.history === 'object' && task.history !== null) {
    task.history[dateKey] = {
      done: true,
      count: (task.history[dateKey]?.count || 0) + 1,
      durationMin: task.actMin,
      completedAt: now.toISOString(),
      note: userNote ? userNote.trim() : ''
    };
  } else {
    task.history = [{
      date: dateKey,
      durationMin: task.actMin,
      completedAt: now.toISOString(),
      note: userNote ? userNote.trim() : ''
    }];
  }

  if (!Array.isArray(task.executionLogs)) task.executionLogs = [];
  task.executionLogs.unshift({
    id: logId,
    dateKey: dateKey,
    completedAt: now.toISOString(),
    durationMin: task.actMin,
    note: userNote ? userNote.trim() : ''
  });

  if (String(state.activeTaskId) === targetId) {
    state.activeTaskId = null;
  }

  // Optimistic Direct DOM Mutation Guard: 完了操作時に全体再描画や通信待機を挟まず即座にDOMからカードを消去
  const cardEls = document.querySelectorAll(`.task-card[data-id="${targetId}"]`);
  cardEls.forEach(card => {
    if (typeof state !== 'undefined' && state.filters && state.filters.status === 'uncompleted') {
      card.style.transition = 'all 0.2s ease-out';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      setTimeout(() => { if (card.parentNode) card.remove(); }, 200);
    }
  });

  // ステータスバー即時クリーンアップ
  const activeNameEl = document.getElementById('active-habit-name');
  if (activeNameEl && (activeNameEl.textContent.includes(task.title) || String(state.activeTaskId) === targetId)) {
    activeNameEl.textContent = 'なし';
  }

  // 単発タスク完了時: scheduledDateが未設定の場合は完了日(dateKey)を自動設定して翌日以降のゾンビ表示を防止
  const prevScheduledDate = task.scheduledDate;
  const isRecTask = typeof isRecurringTaskItem === 'function' ? isRecurringTaskItem(task) : (task.type === 'recurring' || task.taskType === 'recurring');
  if (!isRecTask && !task.isRecurringInstance && !task.scheduledDate) {
    task.scheduledDate = dateKey;
  }

  // 定期タスク完了時: 単発タスクレコードをクローン自動生成してマスターボード・SingleTasksへ反映
  let cloneTaskId = null;
  if (isRecTask) {
    if (typeof createRecurringSingleTaskClone === 'function') {
      const clone = createRecurringSingleTaskClone(task, {
        userNote: userNote,
        userDurationMin: task.actMin,
        dateKey: dateKey,
        now: now,
        logId: logId
      });
      if (clone) {
        state.tasks.push(clone);
        cloneTaskId = clone.id;
      }
    }
  }

  pushUndoAction({
    description: '\u30BF\u30B9\u30AF\u300C' + (task.title || '') + '\u300D\u3092\u5B8C\u4E86',
    undo: () => {
      task.status = 'uncompleted';
      task.actEnd = null;
      task.scheduledDate = prevScheduledDate;
      task.executionLogs = task.executionLogs.filter(l => l.id !== logId);
      // 連動して生成されたクローン単発タスクを自動削除
      if (typeof removeRecurringInstanceSingleTasks === 'function') {
        removeRecurringInstanceSingleTasks(task.id, dateKey, logId, state.tasks);
      } else if (cloneTaskId) {
        state.tasks = state.tasks.filter(t => t.id !== cloneTaskId);
      }
      saveTasks();
      renderApp();
    }
  });

  saveTasks();
  renderApp();
}

function toggleTask(taskId) {
  const targetId = String(taskId);
  const task = state.tasks.find(t => String(t.id) === targetId);
  if (!task) return;
  if (task.status === 'completed') {
    task.status = 'uncompleted';
    task.actEnd = null;
    task.updatedAt = new Date().toISOString();
    // 定期タスクを未完了に戻した場合、連動クローン単発タスクも削除
    const dateKey = typeof getSelectedDateKey === 'function' ? getSelectedDateKey() : null;
    if (typeof isRecurringTaskItem === 'function' && isRecurringTaskItem(task)) {
      if (typeof removeRecurringInstanceSingleTasks === 'function') {
        removeRecurringInstanceSingleTasks(task.id, dateKey, null, state.tasks);
      }
    }
  } else if (task.status === 'in_progress') {
    completeTask(targetId);
    return;
  } else if (task.status === 'paused') {
    startTask(targetId);
    return;
  } else {
    startTask(targetId);
    return;
  }
  saveTasks();
  renderApp();
}

function isTaskSkippedForDate(task, dateKey) {
  if (!task || !dateKey) return false;
  if (Array.isArray(task.skippedDates) && task.skippedDates.includes(dateKey)) {
    return true;
  }
  if (task.skippedDateKey && task.skippedDateKey === dateKey) {
    return true;
  }
  return false;
}

function skipTaskForToday(taskId, dateKey = null) {
  const task = (state.tasks || []).find(t => String(t.id) === String(taskId));
  if (!task) return false;
  const targetDate = dateKey || (typeof getSelectedDateKey === 'function' ? getSelectedDateKey() : new Date().toISOString().split('T')[0]);
  
  if (!Array.isArray(task.skippedDates)) {
    task.skippedDates = [];
  }
  if (!task.skippedDates.includes(targetDate)) {
    task.skippedDates.push(targetDate);
  }
  task.skippedDateKey = targetDate;

  // 当日または選択日の場合ステータスをskippedに更新
  const todayKey = typeof getTodayKey === 'function' ? getTodayKey() : new Date().toISOString().split('T')[0];
  if (targetDate === todayKey || (typeof getSelectedDateKey === 'function' && targetDate === getSelectedDateKey())) {
    task.status = 'skipped';
    task.startTimestamp = null;
    task.resumeNote = '';
    if (state.activeTaskId === task.id) {
      state.activeTaskId = null;
    }
  }

  saveTasks();
  renderApp();
  return true;
}

function unskipTaskForDate(taskId, dateKey = null) {
  const task = (state.tasks || []).find(t => String(t.id) === String(taskId));
  if (!task) return false;
  const targetDate = dateKey || (typeof getSelectedDateKey === 'function' ? getSelectedDateKey() : new Date().toISOString().split('T')[0]);

  if (Array.isArray(task.skippedDates)) {
    task.skippedDates = task.skippedDates.filter(d => d !== targetDate);
  }
  if (task.skippedDateKey === targetDate) {
    task.skippedDateKey = (task.skippedDates && task.skippedDates.length > 0) ? task.skippedDates[task.skippedDates.length - 1] : null;
  }

  if (task.status === 'skipped') {
    task.status = 'uncompleted';
  }

  saveTasks();
  renderApp();
  return true;
}

function skipTask(taskId) {
  return skipTaskForToday(taskId);
}