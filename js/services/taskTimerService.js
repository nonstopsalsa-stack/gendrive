/**
 * Gendrive - TaskChute Live Timer & Execution State Service
 * 哲生 (AI Company OS & Personal OS Engine)
 */

let activeTaskTimerInterval = null;

function moveTaskToTopOfSection(taskId) {
  if (!state || !Array.isArray(state.tasks)) return;
  const targetTaskIdx = state.tasks.findIndex(t => t.id === taskId);
  if (targetTaskIdx === -1) return;
  const targetTask = state.tasks[targetTaskIdx];

  // Find index of the very first task in the same section / group
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
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Automatically promote started task to the top of its section
  moveTaskToTopOfSection(taskId);

  state.tasks.forEach(t => {
    if (t.id === taskId) {
      t.status = 'in_progress';
      t.actStart = t.actStart || nowTimeStr;
      t.startTimestamp = Date.now();
      state.activeTaskId = taskId;
    } else if (t.status === 'in_progress') {
      // Auto-pause previously active task and accumulate exact seconds
      t.status = 'paused';
      if (t.startTimestamp) {
        const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - t.startTimestamp) / 1000));
        t.accumulatedSeconds = (t.accumulatedSeconds || (t.actMin ? t.actMin * 60 : 0)) + sessionElapsedSec;
        t.actMin = Math.round(t.accumulatedSeconds / 60);
      }
      t.startTimestamp = null;
    }
  });

  saveTasks();
  renderApp();
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
}

function completeTask(taskId, userNote = '', userDurationMin = null) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const now = new Date();
  const nowTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  task.actEnd = nowTimeStr;
  
  if (task.startTimestamp) {
    const sessionElapsedSec = Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000));
    task.accumulatedSeconds = (task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0)) + sessionElapsedSec;
  }

  const finalTotalSec = task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : (task.estMin || 25) * 60);
  task.actMin = userDurationMin !== null ? Number(userDurationMin) : Math.max(1, Math.round(finalTotalSec / 60));
  task.status = 'completed';
  task.startTimestamp = null;

  const dateKey = getSelectedDateKey();
  const logId = 'tlog_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  // Save to task history (for moving average calculations)
  if (!Array.isArray(task.history)) task.history = [];
  task.history.push({
    date: dateKey,
    durationMin: task.actMin,
    completedAt: now.toISOString(),
    note: userNote ? userNote.trim() : ''
  });

  // Save to executionLogs (Timeline)
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

  pushUndoAction({
    description: `タスク「${task.title}」を完了`,
    undo: () => {
      task.status = 'uncompleted';
      task.actEnd = null;
      task.executionLogs = task.executionLogs.filter(l => l.id !== logId);
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
  } else if (task.status === 'in_progress') {
    completeTask(taskId);
    return;
  } else if (task.status === 'paused') {
    startTask(taskId); // Resume
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
  if (state.activeTaskId === taskId) {
    state.activeTaskId = null;
  }
  saveTasks();
  renderApp();
}
