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
  const now = new Date();
  const nowTimeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  moveTaskToTopOfSection(taskId);

  let autoPausedTaskId = null;
  let isResumingWithNote = false;

  state.tasks.forEach(t => {
    if (t.id === taskId) {
      if (t.status === 'paused' && t.resumeNote && t.resumeNote.trim()) {
        isResumingWithNote = true;
      }
      t.status = 'in_progress';
      t.actStart = t.actStart || nowTimeStr;
      t.startTimestamp = Date.now();
      state.activeTaskId = taskId;
    } else if (t.status === 'in_progress') {
      t.status = 'paused';
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
    openDualResumeNoteModal(autoPausedTaskId, taskId);
  } else if (isResumingWithNote && typeof openResumeNoteViewModal === 'function') {
    openResumeNoteViewModal(taskId);
  } else if (autoPausedTaskId && typeof openResumeNoteInputModal === 'function') {
    openResumeNoteInputModal(autoPausedTaskId);
  }
}

function pauseTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || task.status !== 'in_progress') return;

  task.status = 'paused';
  if (task.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000));
    task.accumulatedSeconds = (task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0)) + sessionElapsedSec;
    task.actMin = Math.round(task.accumulatedSeconds / 60);
  }
  task.startTimestamp = null;
  if (state.activeTaskId === taskId) {
    state.activeTaskId = null;
  }

  saveTasks();
  renderApp();

  if (typeof openResumeNoteInputModal === 'function') {
    openResumeNoteInputModal(taskId);
  }
}

function completeTask(taskId, userNote, userDurationMin) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const now = new Date();
  const nowTimeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  task.actEnd = nowTimeStr;
  
  if (task.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000));
    task.accumulatedSeconds = (task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0)) + sessionElapsedSec;
  }

  const finalTotalSec = task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : (task.estMin || 25) * 60);
  task.actMin = (userDurationMin !== undefined && userDurationMin !== null) ? Number(userDurationMin) : Math.max(1, Math.round(finalTotalSec / 60));
  task.status = 'completed';
  task.startTimestamp = null;
  task.resumeNote = '';

  const dateKey = getSelectedDateKey();
  const logId = 'tlog_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  if (!Array.isArray(task.history)) task.history = [];
  task.history.push({
    date: dateKey,
    durationMin: task.actMin,
    completedAt: now.toISOString(),
    note: userNote ? userNote.trim() : ''
  });

  if (!Array.isArray(task.executionLogs)) task.executionLogs = [];
  task.executionLogs.unshift({
    id: logId,
    dateKey: dateKey,
    completedAt: now.toISOString(),
    durationMin: task.actMin,
    note: userNote ? userNote.trim() : ''
  });

  if (state.activeTaskId === taskId) {
    state.activeTaskId = null;
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
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (task.status === 'completed') {
    task.status = 'uncompleted';
    task.actEnd = null;
    // 定期タスクを未完了に戻した場合、連動クローン単発タスクも削除
    const dateKey = typeof getSelectedDateKey === 'function' ? getSelectedDateKey() : null;
    if (typeof isRecurringTaskItem === 'function' && isRecurringTaskItem(task)) {
      if (typeof removeRecurringInstanceSingleTasks === 'function') {
        removeRecurringInstanceSingleTasks(task.id, dateKey, null, state.tasks);
      }
    }
  } else if (task.status === 'in_progress') {
    completeTask(taskId);
    return;
  } else if (task.status === 'paused') {
    startTask(taskId);
    return;
  } else {
    startTask(taskId);
    return;
  }
  saveTasks();
  renderApp();
}

function skipTask(taskId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  task.status = 'skipped';
  task.startTimestamp = null;
  task.resumeNote = '';
  if (state.activeTaskId === taskId) {
    state.activeTaskId = null;
  }
  saveTasks();
  renderApp();
}