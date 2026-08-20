/**
 * Gendrive - 6-Axis Load & Evaluation Smart Matrix Engine
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Matrix Get / Set / UI Synchronization
// =========================================================================

function getMatrixValues(prefix) {
  const result = {};
  MATRIX_KEYS.forEach(key => {
    const activeBtn = document.querySelector(`#chips-${prefix}-${key} .matrix-chip[class*="active-"]`);
    result[key] = activeBtn ? activeBtn.dataset.val : 'mid';
  });
  return result;
}

function setMatrixValues(prefix, values = {}) {
  MATRIX_KEYS.forEach(key => {
    const val = values[key] || 'mid';
    const container = document.getElementById(`chips-${prefix}-${key}`);
    const badge = document.getElementById(`badge-${prefix}-${key}`);
    if (badge) {
      badge.textContent = val.toUpperCase();
    }
    if (container) {
      container.querySelectorAll('.matrix-chip').forEach(btn => {
        btn.className = 'matrix-chip';
        if (btn.dataset.val === val) {
          btn.classList.add(`active-${val}`);
        }
      });
    }
  });
}

function setupLoadMatrixEvents() {
  const prefixes = ['add-habit', 'edit-habit', 'add-task', 'edit-task', 'preset'];
  prefixes.forEach(prefix => {
    MATRIX_KEYS.forEach(key => {
      const container = document.getElementById(`chips-${prefix}-${key}`);
      const badge = document.getElementById(`badge-${prefix}-${key}`);
      if (!container) return;

      container.querySelectorAll('.matrix-chip').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const targetVal = btn.dataset.val;
          container.querySelectorAll('.matrix-chip').forEach(b => {
            b.className = 'matrix-chip';
          });
          btn.classList.add(`active-${targetVal}`);
          if (badge) {
            badge.textContent = targetVal.toUpperCase();
          }
        });
      });
    });
  });
}
