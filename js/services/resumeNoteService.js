/**
 * Gendrive - Task Resume Memo Service (タスク中断・再開メモエンジン)
 * 翔 (AI Company OS & Personal OS Engine)
 *
 * 中断時に素早く記録し、再開時に自動で開くことでコンテキストスイッチの認知負荷をゼロにする。
 * タスク実行中に別の中断タスクを再開する際は、左右並列（左: 中断白紙メモ / 右: 再開前回メモ）で同時表示。
 */

let currentResumeModalTaskId = null; // 中断タスクID（単独入力時またはデュアル時）
let currentResumeViewTaskId = null;  // 再開タスクID（単独閲覧時またはデュアル時）
let currentResumeMode = null;        // 'input' | 'view' | 'dual' | null

/**
 * モーダルの表示モード要素をリセット
 */
function resetResumeNoteModalPanels() {
  const dialog = document.getElementById('resume-note-dialog');
  const singleHeader = document.getElementById('resume-note-single-header');
  const singleBody = document.getElementById('resume-note-single-body');
  const dualHeader = document.getElementById('resume-note-dual-header');
  const dualBody = document.getElementById('resume-note-dual-body');
  const btnSave = document.getElementById('btn-resume-note-save');
  const btnConfirm = document.getElementById('btn-resume-note-confirm');
  const btnDualAction = document.getElementById('btn-resume-note-dual-action');

  if (dialog) dialog.classList.remove('dual-mode');
  if (singleHeader) singleHeader.classList.remove('hidden');
  if (singleBody) singleBody.classList.remove('hidden');
  if (dualHeader) dualHeader.classList.add('hidden');
  if (dualBody) dualBody.classList.add('hidden');
  if (btnSave) btnSave.classList.add('hidden');
  if (btnConfirm) btnConfirm.classList.add('hidden');
  if (btnDualAction) btnDualAction.classList.add('hidden');
}

/**
 * 中断時の入力モーダルを開く（単独・白紙新規）
 * @param {string} taskId
 */
function openResumeNoteInputModal(taskId) {
  if (!state || !Array.isArray(state.tasks)) return;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  currentResumeModalTaskId = taskId;
  currentResumeViewTaskId = null;
  currentResumeMode = 'input';

  const modal = document.getElementById('modal-resume-note');
  if (!modal) return;

  resetResumeNoteModalPanels();

  const titleEl = document.getElementById('resume-note-modal-title');
  const taskNameEl = document.getElementById('resume-note-task-name');
  const inputPanel = document.getElementById('resume-note-input-panel');
  const viewPanel = document.getElementById('resume-note-view-panel');
  const textarea = document.getElementById('resume-note-textarea');
  const btnSave = document.getElementById('btn-resume-note-save');

  if (titleEl) titleEl.textContent = '📝 再開メモの記録 (中断)';
  if (taskNameEl) taskNameEl.textContent = task.title || task.name || 'タスク';
  
  // 2回目以降の中断時は常に白紙リセット
  task.resumeNote = '';

  if (inputPanel) inputPanel.classList.remove('hidden');
  if (viewPanel) viewPanel.classList.add('hidden');
  if (btnSave) btnSave.classList.remove('hidden');

  if (textarea) {
    textarea.value = '';
    textarea.placeholder = '次に再開するときの手がかり・状況をメモ（例: ◯◯の資料3ページ目まで確認済み、次は▽▽の作成から）... (Enterで即保存)';
  }

  modal.classList.add('active');
  modal.classList.remove('hidden');

  setTimeout(() => {
    if (textarea) {
      textarea.focus();
    }
  }, 50);
}

/**
 * 再開時の確認モーダルを開く（単独・閲覧）
 * @param {string} taskId
 */
function openResumeNoteViewModal(taskId) {
  if (!state || !Array.isArray(state.tasks)) return;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.resumeNote || !task.resumeNote.trim()) return;

  currentResumeModalTaskId = null;
  currentResumeViewTaskId = taskId;
  currentResumeMode = 'view';

  const modal = document.getElementById('modal-resume-note');
  if (!modal) return;

  resetResumeNoteModalPanels();

  const titleEl = document.getElementById('resume-note-modal-title');
  const taskNameEl = document.getElementById('resume-note-task-name');
  const inputPanel = document.getElementById('resume-note-input-panel');
  const viewPanel = document.getElementById('resume-note-view-panel');
  const viewContentEl = document.getElementById('resume-note-view-content');
  const btnConfirm = document.getElementById('btn-resume-note-confirm');

  if (titleEl) titleEl.textContent = '📝 再開メモ (前回中断時の記録)';
  if (taskNameEl) taskNameEl.textContent = task.title || task.name || 'タスク';

  if (inputPanel) inputPanel.classList.add('hidden');
  if (viewPanel) viewPanel.classList.remove('hidden');
  if (btnConfirm) btnConfirm.classList.remove('hidden');

  if (viewContentEl) {
    viewContentEl.textContent = task.resumeNote;
  }

  modal.classList.add('active');
  modal.classList.remove('hidden');

  setTimeout(() => {
    if (btnConfirm) btnConfirm.focus();
  }, 50);
}

/**
 * 中断と再開が同時に発生したときのデュアル並列モーダルを開く
 * 画面左: これから中断するタスク（白紙メモ記入待ち）
 * 画面右: 今から再開するタスク（前回中断時のメモ閲覧）
 * @param {string} pausedTaskId - 中断されるタスクID
 * @param {string} resumingTaskId - 再開されるタスクID
 */
function openDualResumeNoteModal(pausedTaskId, resumingTaskId) {
  if (!state || !Array.isArray(state.tasks)) return;
  const pausedTask = state.tasks.find(t => t.id === pausedTaskId);
  const resumingTask = state.tasks.find(t => t.id === resumingTaskId);
  if (!pausedTask || !resumingTask) return;

  currentResumeModalTaskId = pausedTaskId;
  currentResumeViewTaskId = resumingTaskId;
  currentResumeMode = 'dual';

  const modal = document.getElementById('modal-resume-note');
  const dialog = document.getElementById('resume-note-dialog');
  if (!modal || !dialog) return;

  resetResumeNoteModalPanels();

  // デュアルモード専用スタイル・パネル展開
  dialog.classList.add('dual-mode');

  const singleHeader = document.getElementById('resume-note-single-header');
  const singleBody = document.getElementById('resume-note-single-body');
  const dualHeader = document.getElementById('resume-note-dual-header');
  const dualBody = document.getElementById('resume-note-dual-body');
  const btnDualAction = document.getElementById('btn-resume-note-dual-action');

  if (singleHeader) singleHeader.classList.add('hidden');
  if (singleBody) singleBody.classList.add('hidden');
  if (dualHeader) dualHeader.classList.remove('hidden');
  if (dualBody) dualBody.classList.remove('hidden');
  if (btnDualAction) btnDualAction.classList.remove('hidden');

  // 左カラム（中断されるタスク）の設定
  const pauseNameEl = document.getElementById('resume-note-dual-pause-task-name');
  const dualTextarea = document.getElementById('resume-note-dual-textarea');
  if (pauseNameEl) pauseNameEl.textContent = pausedTask.title || pausedTask.name || 'タスク';
  
  // 新たに中断されるため白紙リセット
  pausedTask.resumeNote = '';
  if (dualTextarea) {
    dualTextarea.value = '';
    dualTextarea.placeholder = '次に再開するときの手がかり・状況をメモ... (Enterで即保存して作業開始)';
  }

  // 右カラム（今から再開するタスク）の設定
  const resumeNameEl = document.getElementById('resume-note-dual-resume-task-name');
  const viewContentEl = document.getElementById('resume-note-dual-view-content');
  if (resumeNameEl) resumeNameEl.textContent = resumingTask.title || resumingTask.name || 'タスク';
  if (viewContentEl) {
    viewContentEl.textContent = resumingTask.resumeNote || '（前回のメモはありません）';
  }

  modal.classList.add('active');
  modal.classList.remove('hidden');

  // 中断タスクの白紙入力欄に自動フォーカス
  setTimeout(() => {
    if (dualTextarea) {
      dualTextarea.focus();
    }
  }, 50);
}

/**
 * モーダルからのメモ保存ハンドラ
 */
function handleSaveResumeNote() {
  if (!state || !Array.isArray(state.tasks)) {
    closeResumeNoteModal();
    return;
  }

  if (currentResumeMode === 'dual') {
    if (currentResumeModalTaskId) {
      const task = state.tasks.find(t => t.id === currentResumeModalTaskId);
      const textarea = document.getElementById('resume-note-dual-textarea');
      const noteText = textarea ? textarea.value.trim() : '';

      if (task) {
        task.resumeNote = noteText;
        if (typeof saveTasks === 'function') {
          saveTasks();
        }
      }
    }
  } else if (currentResumeMode === 'input') {
    if (currentResumeModalTaskId) {
      const task = state.tasks.find(t => t.id === currentResumeModalTaskId);
      const textarea = document.getElementById('resume-note-textarea');
      const noteText = textarea ? textarea.value.trim() : '';

      if (task) {
        task.resumeNote = noteText;
        if (typeof saveTasks === 'function') {
          saveTasks();
        }
      }
    }
  }

  closeResumeNoteModal();
  if (typeof renderApp === 'function') {
    renderApp();
  }
}

/**
 * モーダルを閉じる
 */
function closeResumeNoteModal() {
  const modal = document.getElementById('modal-resume-note');
  if (modal) {
    modal.classList.remove('active');
    modal.classList.add('hidden');
  }
  const dialog = document.getElementById('resume-note-dialog');
  if (dialog) {
    dialog.classList.remove('dual-mode');
  }
  currentResumeModalTaskId = null;
  currentResumeViewTaskId = null;
  currentResumeMode = null;
}

/**
 * タスク完了時のメモクリア
 * @param {string} taskId
 */
function clearResumeNote(taskId) {
  if (!state || !Array.isArray(state.tasks)) return;
  const task = state.tasks.find(t => t.id === taskId);
  if (task) {
    task.resumeNote = '';
  }
}

/**
 * 再開メモモーダルのキーボードショートカット初期化
 */
function setupResumeNoteModalEvents() {
  // 単独入力時のテキストエリア
  const textarea = document.getElementById('resume-note-textarea');
  if (textarea) {
    textarea.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        handleSaveResumeNote();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleSaveResumeNote();
      }
    });
  }

  // デュアル入力時のテキストエリア
  const dualTextarea = document.getElementById('resume-note-dual-textarea');
  if (dualTextarea) {
    dualTextarea.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        handleSaveResumeNote();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleSaveResumeNote();
      }
    });
  }

  // 単独閲覧時の確認ボタン
  const btnConfirm = document.getElementById('btn-resume-note-confirm');
  if (btnConfirm) {
    btnConfirm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        closeResumeNoteModal();
      }
    });
  }

  // デュアル時のアクションボタン
  const btnDualAction = document.getElementById('btn-resume-note-dual-action');
  if (btnDualAction) {
    btnDualAction.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        handleSaveResumeNote();
      }
    });
  }

  // 背景クリックで保存して閉じる
  const modal = document.getElementById('modal-resume-note');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        handleSaveResumeNote();
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupResumeNoteModalEvents);
} else {
  setupResumeNoteModalEvents();
}
