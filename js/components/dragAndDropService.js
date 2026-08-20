/**
 * Gendrive - Drag & Drop Interaction Service (with In-Section Reordering & Cross-View Sync)
 * 哲生 (AI Company OS & Personal OS Engine)
 */

let draggedItemId = null;
let draggedItemType = null; // 'task' | 'habit'

// Backward compatibility alias
function handleTaskDragStart(event, taskId) {
  handleCardDragStart(event, taskId, 'task');
}

function handleCardDragStart(event, itemId, itemType) {
  draggedItemId = itemId;
  draggedItemType = itemType;

  event.dataTransfer.setData('text/plain', itemId);
  event.dataTransfer.setData('application/json', JSON.stringify({ id: itemId, type: itemType }));
  event.dataTransfer.effectAllowed = 'move';

  const card = event.target.closest('.task-card, .habit-card');
  if (card) {
    card.classList.add('is-dragging');
  }
}

function handleCardDragOver(event, targetId, targetType) {
  if (draggedItemId === targetId && draggedItemType === targetType) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';

  const card = event.currentTarget;
  const rect = card.getBoundingClientRect();
  const isAbove = event.clientY < rect.top + rect.height / 2;

  card.classList.toggle('drop-above', isAbove);
  card.classList.toggle('drop-below', !isAbove);
}

function handleCardDragLeave(event) {
  const card = event.currentTarget;
  card.classList.remove('drop-above', 'drop-below');
}

function handleCardDrop(event, targetId, targetType) {
  event.preventDefault();
  event.stopPropagation();

  const card = event.currentTarget;
  const rect = card.getBoundingClientRect();
  const isAbove = event.clientY < rect.top + rect.height / 2;

  card.classList.remove('drop-above', 'drop-below');

  const sourceId = draggedItemId || event.dataTransfer.getData('text/plain');
  const sourceType = draggedItemType || 'task';

  if (!sourceId || (sourceId === targetId && sourceType === targetType)) return;

  reorderItems(sourceId, sourceType, targetId, targetType, isAbove);
}

// Container-level drop handlers (when dragging into empty section area)
function handleContainerDragOver(event) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('dnd-container-over');
}

function handleContainerDragLeave(event) {
  event.currentTarget.classList.remove('dnd-container-over');
}

function handleContainerDrop(event, sectionName, containerType) {
  if (event.target.closest('.task-card, .habit-card')) return; // Item level precision drop takes precedence
  event.preventDefault();
  event.currentTarget.classList.remove('dnd-container-over');

  const sourceId = draggedItemId || event.dataTransfer.getData('text/plain');
  const sourceType = draggedItemType || 'task';

  if (!sourceId) return;

  if (sourceType === 'task') {
    const task = state.tasks.find(t => t.id === sourceId);
    if (!task) return;

    const prevSnapshot = [...state.tasks];
    const prevTaskProps = {
      section: task.section,
      timingType: task.timingType,
      bucket: task.bucket,
      scheduledDate: task.scheduledDate
    };

    task.section = sectionName;
    task.timingType = 'section';
    task.bucket = 'today';
    task.scheduledDate = getSelectedDateKey();

    // Move to end of tasks list
    state.tasks = state.tasks.filter(t => t.id !== sourceId);
    state.tasks.push(task);

    pushUndoAction({
      description: `タスク「${task.title}」を【${sectionName}】の末尾へ移動`,
      undo: () => {
        state.tasks = prevSnapshot;
        Object.assign(task, prevTaskProps);
        saveTasks();
        renderApp();
      }
    });

    saveTasks();
    renderApp();
  } else if (sourceType === 'habit') {
    const habit = state.habits.find(h => String(h.id) === String(sourceId));
    if (!habit) return;

    const prevSnapshot = [...state.habits];
    const prevHabitProps = {
      section: habit.section,
      displayType: habit.displayType
    };

    habit.section = sectionName;
    habit.displayType = 'section';

    // Move to end of habits list
    state.habits = state.habits.filter(h => String(h.id) !== String(sourceId));
    state.habits.push(habit);

    pushUndoAction({
      description: `ハビット「${habit.name}」を【${sectionName}】の末尾へ移動`,
      undo: () => {
        state.habits = prevSnapshot;
        Object.assign(habit, prevHabitProps);
        saveHabits();
        renderApp();
      }
    });

    saveHabits();
    renderApp();
  }
}

document.addEventListener('dragend', () => {
  draggedItemId = null;
  draggedItemType = null;
  document.querySelectorAll('.is-dragging').forEach(el => el.classList.remove('is-dragging'));
  document.querySelectorAll('.drop-above, .drop-below, .dnd-drag-over, .dnd-container-over').forEach(el => {
    el.classList.remove('drop-above', 'drop-below', 'dnd-drag-over', 'dnd-container-over');
  });
});

// =========================================================================
// Reorder & Section Insertion Logic
// =========================================================================

function reorderItems(sourceId, sourceType, targetId, targetType, isAbove) {
  if (sourceType === 'task' && targetType === 'task') {
    const sourceIdx = state.tasks.findIndex(t => t.id === sourceId);
    const targetIdx = state.tasks.findIndex(t => t.id === targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    const sourceTask = state.tasks[sourceIdx];
    const targetTask = state.tasks[targetIdx];

    const prevTasksSnapshot = [...state.tasks];
    const prevTaskProps = {
      section: sourceTask.section,
      timingType: sourceTask.timingType,
      bucket: sourceTask.bucket,
      scheduledDate: sourceTask.scheduledDate
    };

    // Sync section & timingType if dropped onto a task in a different section
    sourceTask.section = targetTask.section;
    sourceTask.timingType = targetTask.timingType || (targetTask.section ? 'section' : 'anytime');
    sourceTask.bucket = targetTask.bucket || 'today';
    sourceTask.scheduledDate = targetTask.scheduledDate || getSelectedDateKey();

    // Remove source task from array
    state.tasks.splice(sourceIdx, 1);

    // Calculate new insertion index
    const newTargetIdx = state.tasks.findIndex(t => t.id === targetId);
    const insertIdx = isAbove ? newTargetIdx : newTargetIdx + 1;
    state.tasks.splice(insertIdx, 0, sourceTask);

    pushUndoAction({
      description: `タスク「${sourceTask.title}」の並び順を変更`,
      undo: () => {
        state.tasks = prevTasksSnapshot;
        Object.assign(sourceTask, prevTaskProps);
        saveTasks();
        renderApp();
      }
    });

    saveTasks();
    renderApp();
  } else if (sourceType === 'habit' && targetType === 'habit') {
    const sourceIdx = state.habits.findIndex(h => String(h.id) === String(sourceId));
    const targetIdx = state.habits.findIndex(h => String(h.id) === String(targetId));
    if (sourceIdx === -1 || targetIdx === -1) return;

    const sourceHabit = state.habits[sourceIdx];
    const targetHabit = state.habits[targetIdx];

    const prevHabitsSnapshot = [...state.habits];
    const prevHabitProps = {
      section: sourceHabit.section,
      displayType: sourceHabit.displayType
    };

    // Sync section & displayType if dropped onto a habit in a different section
    if (targetHabit.section) {
      sourceHabit.section = targetHabit.section;
    }
    if (targetHabit.displayType) {
      sourceHabit.displayType = targetHabit.displayType;
    }

    // Remove source habit from array
    state.habits.splice(sourceIdx, 1);

    // Calculate new insertion index
    const newTargetIdx = state.habits.findIndex(h => String(h.id) === String(targetId));
    const insertIdx = isAbove ? newTargetIdx : newTargetIdx + 1;
    state.habits.splice(insertIdx, 0, sourceHabit);

    pushUndoAction({
      description: `ハビット「${sourceHabit.name}」の並び順を変更`,
      undo: () => {
        state.habits = prevHabitsSnapshot;
        Object.assign(sourceHabit, prevHabitProps);
        saveHabits();
        renderApp();
      }
    });

    saveHabits();
    renderApp();
  }
}

// =========================================================================
// Container & Sidebar Drop Targets Setup
// =========================================================================

function setupDragAndDrop() {
  const bucketNameMap = {
    inbox: 'Inbox',
    this_week: '今週',
    next_week: '来週',
    genius: 'Genius Ideas',
    someday: 'Someday',
    vault: 'Vault (隔離)'
  };

  const labelNameMap = {
    iron_rule: '🔥 ALL - IN',
    frog0: '🐸 第0 (最難関)',
    p1: '💼 第1 (緊急×重要)',
    p2: '🌱 第2 (非緊急×重要)',
    p3: '🧺 第3 (緊急×非重要)',
    p4: '🎮 第4 (非緊急×非重要)'
  };

  // 1. Sidebar GTD Buckets Drop Target: Convert to Bucket
  document.querySelectorAll('.bucket-item').forEach(btn => {
    const bucketId = btn.dataset.bucket;
    btn.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      btn.classList.add('dnd-drag-over');
    });
    btn.addEventListener('dragleave', () => {
      btn.classList.remove('dnd-drag-over');
    });
    btn.addEventListener('drop', (e) => {
      e.preventDefault();
      btn.classList.remove('dnd-drag-over');
      const taskId = e.dataTransfer.getData('text/plain') || draggedItemId;
      if (taskId && draggedItemType !== 'habit') {
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
          const prev = {
            bucket: task.bucket,
            scheduledDate: task.scheduledDate,
            section: task.section,
            timingType: task.timingType
          };

          task.bucket = bucketId;
          task.scheduledDate = null;
          task.section = null;

          pushUndoAction({
            description: `タスク「${task.title}」を【${bucketNameMap[bucketId] || bucketId}】へ移動`,
            undo: () => {
              Object.assign(task, prev);
            }
          });

          saveTasks();
          renderApp();
        }
      }
    });
  });

  // 2. Sidebar Eisenhower Labels Drop Target
  document.querySelectorAll('.label-item').forEach(btn => {
    const labelId = btn.dataset.label;
    btn.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      btn.classList.add('dnd-drag-over');
    });
    btn.addEventListener('dragleave', () => {
      btn.classList.remove('dnd-drag-over');
    });
    btn.addEventListener('drop', (e) => {
      e.preventDefault();
      btn.classList.remove('dnd-drag-over');
      const taskId = e.dataTransfer.getData('text/plain') || draggedItemId;
      if (taskId && draggedItemType !== 'habit') {
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
          const prevLabel = task.label;
          task.label = labelId;

          pushUndoAction({
            description: `タスク「${task.title}」に【${labelNameMap[labelId] || labelId}】ラベルを付与`,
            undo: () => {
              task.label = prevLabel;
            }
          });

          saveTasks();
          renderApp();
        }
      }
    });
  });

  // 3. Anytime Section Drop Target: Move to Anytime
  const anytimeBlocks = [document.getElementById('anytime-section-block'), document.getElementById('anytime-daily-block')].filter(Boolean);
  anytimeBlocks.forEach(block => {
    block.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      block.classList.add('dnd-drag-over');
    });
    block.addEventListener('dragleave', () => {
      block.classList.remove('dnd-drag-over');
    });
    block.addEventListener('drop', (e) => {
      e.preventDefault();
      block.classList.remove('dnd-drag-over');
      const taskId = e.dataTransfer.getData('text/plain') || draggedItemId;
      if (taskId && draggedItemType !== 'habit') {
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
          const prev = {
            bucket: task.bucket,
            scheduledDate: task.scheduledDate,
            section: task.section,
            timingType: task.timingType
          };

          task.bucket = 'today';
          task.scheduledDate = getSelectedDateKey();
          task.section = null;
          task.timingType = 'anytime';

          // Move to bottom of anytime tasks
          state.tasks = state.tasks.filter(t => t.id !== taskId);
          state.tasks.push(task);

          pushUndoAction({
            description: `タスク「${task.title}」を【いつでも (Anytime)】へ移動`,
            undo: () => {
              Object.assign(task, prev);
            }
          });

          saveTasks();
          renderApp();
        }
      }
    });
  });

  // 4. Section Task List Drop Target (Drop into section empty area / container)
  const sectionSubgroup = document.getElementById('subgroup-section-tasks');
  if (sectionSubgroup) {
    sectionSubgroup.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      sectionSubgroup.classList.add('dnd-drag-over');
    });
    sectionSubgroup.addEventListener('dragleave', () => {
      sectionSubgroup.classList.remove('dnd-drag-over');
    });
    sectionSubgroup.addEventListener('drop', (e) => {
      if (e.target.closest('.task-card, .habit-card')) return; // Card drop handles precision insert
      e.preventDefault();
      sectionSubgroup.classList.remove('dnd-drag-over');
      const taskId = e.dataTransfer.getData('text/plain') || draggedItemId;
      if (taskId && draggedItemType !== 'habit') {
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
          const prev = {
            bucket: task.bucket,
            scheduledDate: task.scheduledDate,
            section: task.section,
            timingType: task.timingType
          };

          task.bucket = 'today';
          task.scheduledDate = getSelectedDateKey();
          task.section = state.currentSection || '第2セッション';
          task.timingType = 'section';

          // Move to bottom of this section
          state.tasks = state.tasks.filter(t => t.id !== taskId);
          state.tasks.push(task);

          pushUndoAction({
            description: `タスク「${task.title}」を【${task.section}】の末尾へ移動`,
            undo: () => {
              Object.assign(task, prev);
            }
          });

          saveTasks();
          renderApp();
        }
      }
    });
  }
}

