/**
 * Gendrive - Global Undo History & Toast Notification Service
 * 哲生 (AI Company OS & Personal OS Engine)
 */

let undoStack = [];
let undoToastTimeout = null;

function pushUndoAction(action) {
  // action: { description: string, undo: function }
  if (!action || typeof action.undo !== 'function') return;
  undoStack.push(action);
  if (undoStack.length > 40) undoStack.shift();
  showUndoToast(action.description);
}

function executeUndo() {
  if (undoStack.length === 0) {
    showUndoToast('元に戻す操作はありません', true);
    return;
  }
  const action = undoStack.pop();
  if (action && typeof action.undo === 'function') {
    action.undo();
    if (typeof saveTasks === 'function') saveTasks();
    if (typeof saveHabits === 'function') saveHabits();
    if (typeof renderApp === 'function') renderApp();
    showUndoToast(`↩️ 「${action.description}」を取り消しました`, true);
  }
}

function showUndoToast(msg, hideButton = false) {
  const toast = document.getElementById('undo-toast');
  const text = document.getElementById('undo-toast-text');
  const btnAction = document.getElementById('btn-undo-action');
  if (!toast || !text) return;

  text.textContent = msg;
  if (btnAction) btnAction.style.display = hideButton ? 'none' : 'flex';
  toast.classList.add('show');

  if (undoToastTimeout) clearTimeout(undoToastTimeout);
  undoToastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 6000);
}

function setupUndoEvents() {
  const btnUndo = document.getElementById('btn-undo-action');
  if (btnUndo) {
    btnUndo.addEventListener('click', executeUndo);
  }

  const btnDismiss = document.getElementById('btn-undo-dismiss');
  if (btnDismiss) {
    btnDismiss.addEventListener('click', () => {
      const toast = document.getElementById('undo-toast');
      if (toast) toast.classList.remove('show');
    });
  }
}
