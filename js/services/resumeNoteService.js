/**
 * Gendrive - Task Resume Memo Service (タスク中断・再開メモエンジン)
 * 翔 (AI Company OS & Personal OS Engine)
 *
 * 中断時に素早く記録し、再開時に自動で開くことでコンテキストスイッチの認知負荷をゼロにする。
 */

let currentResumeModalTaskId = null;

/**
 * 中断時の入力モーダルを開く（白紙新規）
 * @param {string} taskId
 */
function openResumeNoteInputModal(taskId) {
  if (!state || !Array.isArray(state.tasks)) return;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  currentResumeModalTaskId = taskId;

  const modal = document.getElementById('modal-resume-note');
  if (!modal) return;

  const titleEl = document.getElementById('resume-note-modal-title');
  const taskNameEl = document.getElementById('resume-note-task-name');
  const inputPanel = document.getElementById('resume-note-input-panel');
  const viewPanel = document.getElementById('resume-note-view-panel');
  const textarea = document.getElementById('resume-note-textarea');
  const btnSave = document.getElementById('btn-resume-note-save');
  const btnConfirm = document.getElementById('btn-resume-note-confirm');

  if (titleEl) titleEl.textContent = '\uD83D\uDCDD \u518D\u958B\u30E1\u30E2\u306E\u8A18\u9332 (\u4E2D\u65AD)';
  if (taskNameEl) taskNameEl.textContent = task.title || task.name || '\u30BF\u30B9\u30AF';
  
  // 2回目以降の中断時は常に白紙リセット
  task.resumeNote = '';

  if (inputPanel) inputPanel.classList.remove('hidden');
  if (viewPanel) viewPanel.classList.add('hidden');
  if (btnSave) btnSave.classList.remove('hidden');
  if (btnConfirm) btnConfirm.classList.add('hidden');

  if (textarea) {
    textarea.value = '';
    textarea.placeholder = '\u6B21\u306B\u518D\u958B\u3059\u308B\u3068\u304D\u306E\u624B\u304C\u304B\u308A\u30FB\u72B6\u6CC1\u3092\u30E1\u30E2\uFF08\u4F8B: \u25CB\u25CB\u306E\u8CC7\u65993\u30DA\u30FC\u30B8\u76EE\u307E\u3067\u78BA\u8A8D\u6E08\u307F\u3001\u6B21\u306F\u25BD\u25BD\u306E\u4F5C\u6210\u304B\u3089\uFF09...';
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
 * 再開時の確認モーダルを開く
 * @param {string} taskId
 */
function openResumeNoteViewModal(taskId) {
  if (!state || !Array.isArray(state.tasks)) return;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task || !task.resumeNote || !task.resumeNote.trim()) return;

  currentResumeModalTaskId = taskId;

  const modal = document.getElementById('modal-resume-note');
  if (!modal) return;

  const titleEl = document.getElementById('resume-note-modal-title');
  const taskNameEl = document.getElementById('resume-note-task-name');
  const inputPanel = document.getElementById('resume-note-input-panel');
  const viewPanel = document.getElementById('resume-note-view-panel');
  const viewContentEl = document.getElementById('resume-note-view-content');
  const btnSave = document.getElementById('btn-resume-note-save');
  const btnConfirm = document.getElementById('btn-resume-note-confirm');

  if (titleEl) titleEl.textContent = '\uD83D\uDCDD \u518D\u958B\u30E1\u30E2 (\u524D\u56DE\u4E2D\u65AD\u6642\u306E\u8A18\u9332)';
  if (taskNameEl) taskNameEl.textContent = task.title || task.name || '\u30BF\u30B9\u30AF';

  if (inputPanel) inputPanel.classList.add('hidden');
  if (viewPanel) viewPanel.classList.remove('hidden');
  if (btnSave) btnSave.classList.add('hidden');
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
 * モーダルからのメモ保存
 */
function handleSaveResumeNote() {
  if (!currentResumeModalTaskId || !state || !Array.isArray(state.tasks)) {
    closeResumeNoteModal();
    return;
  }

  const task = state.tasks.find(t => t.id === currentResumeModalTaskId);
  const textarea = document.getElementById('resume-note-textarea');
  const noteText = textarea ? textarea.value.trim() : '';

  if (task) {
    task.resumeNote = noteText;
    if (typeof saveTasks === 'function') {
      saveTasks();
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
  currentResumeModalTaskId = null;
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
  const textarea = document.getElementById('resume-note-textarea');
  if (textarea) {
    textarea.addEventListener('keydown', (e) => {
      // Enter (without Shift) または Ctrl+Enter / Cmd+Enter で即保存
      if ((e.key === 'Enter' && !e.shiftKey) || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        handleSaveResumeNote();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleSaveResumeNote();
      }
    });
  }

  const btnConfirm = document.getElementById('btn-resume-note-confirm');
  if (btnConfirm) {
    btnConfirm.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        closeResumeNoteModal();
      }
    });
  }

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
