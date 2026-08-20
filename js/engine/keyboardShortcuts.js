/**
 * Gendrive - Keyboard Shortcuts Engine (with Strict Modal Isolation & Ctrl+Enter Submit)
 * 哲生 (AI Company OS & Personal OS Engine)
 */

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    const activeModal = document.querySelector('.modal-overlay.active');

    // 1. If any Modal is currently Active: Strictly isolate events inside Modal!
    if (activeModal) {
      // Special Shortcuts inside Modal: Task Presets Modal
      if (activeModal.id === 'modal-task-presets') {
        const editView = document.getElementById('preset-edit-view');
        const isEditOpen = editView && !editView.classList.contains('hidden');

        // In Edit View
        if (isEditOpen) {
          if (e.key === 'Escape') {
            e.preventDefault();
            if (typeof showPresetListView === 'function') showPresetListView();
            return;
          }
          if (isCtrlOrCmd && e.key === 'Enter') {
            e.preventDefault();
            if (typeof savePresetFromForm === 'function') savePresetFromForm();
            return;
          }
        } else {
          // In List View
          if (e.key === 'Escape') {
            e.preventDefault();
            if (typeof closeModal === 'function') closeModal();
            return;
          }

          const isInputActive = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
          if (!isInputActive) {
            // 'P' or 'p': Switch to New Preset View
            if (e.key === 'p' || e.key === 'P') {
              e.preventDefault();
              if (typeof showPresetEditView === 'function') showPresetEditView(true);
              return;
            }

            // '1' ~ '9': Instant Execute Preset 1 ~ 9
            if (e.key >= '1' && e.key <= '9') {
              e.preventDefault();
              const idx = parseInt(e.key, 10) - 1;
              const presets = state.taskPresets || loadTaskPresets();
              if (presets[idx] && typeof executePresetTask === 'function') {
                executePresetTask(presets[idx].id);
              }
              return;
            }

            // '0': Instant Execute Preset 10 (idx 9)
            if (e.key === '0') {
              e.preventDefault();
              const presets = state.taskPresets || loadTaskPresets();
              if (presets[9] && typeof executePresetTask === 'function') {
                executePresetTask(presets[9].id);
              }
              return;
            }
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        if (typeof closeModal === 'function') closeModal();
        return;
      }

      // Ctrl+Enter or Cmd+Enter: Instant Form Submit / Save
      if (isCtrlOrCmd && e.key === 'Enter') {
        e.preventDefault();

        // Standard Modal Form Submit
        const form = activeModal.querySelector('form');
        if (form) {
          const submitBtn = form.querySelector('button[type="submit"]') || form.querySelector('.btn-primary');
          if (submitBtn) {
            submitBtn.click();
          } else if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
          } else {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
          return;
        }
      }

      // While inside modal, DO NOT trigger any background shortcuts
      return;
    }

    // 2. Ctrl+Z or Cmd+Z for Global UNDO
    if (isCtrlOrCmd && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;
      
      e.preventDefault();
      if (typeof executeUndo === 'function') executeUndo();
      return;
    }

    // 3. If typing inside standalone input/textarea outside modals:
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
      if (e.key === 'Escape' && typeof closeModal === 'function') closeModal();
      return;
    }

    // 3.5. Special Shortcuts inside Timer Mode
    if (state.currentMode === 'timer') {
      const isInputActive = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName);
      const isTimerActive = typeof timerState !== 'undefined' && timerState && timerState.activeTimerId !== null;

      if (!isInputActive) {
        // --- CASE A: Inside Timer View while Timer is ACTIVE / RUNNING ---
        if (isTimerActive) {
          // 1 ~ 5 keys: Switch back to corresponding views (1: Section, 2: Focus, 3: Daily, 4: Master, 5: Vision)
          if (e.key === '1') {
            e.preventDefault();
            if (typeof setMode === 'function') setMode('section');
            return;
          }
          if (e.key === '2') {
            e.preventDefault();
            if (typeof setMode === 'function') setMode('focus');
            return;
          }
          if (e.key === '3') {
            e.preventDefault();
            if (typeof setMode === 'function') setMode('all');
            return;
          }
          if (e.key === '4') {
            e.preventDefault();
            if (typeof setMode === 'function') setMode('table');
            return;
          }
          if (e.key === '5') {
            e.preventDefault();
            if (typeof setMode === 'function') setMode('goals');
            return;
          }
          if (e.key === '6') {
            e.preventDefault();
            // 6: Do nothing while already in timer view
            return;
          }

          // Active Timer Controls
          if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
            e.preventDefault();
            if (typeof toggleActiveTimer === 'function') toggleActiveTimer();
            return;
          }
          if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            if (typeof resetActiveTimer === 'function') resetActiveTimer();
            return;
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            if (typeof stopAndResetToIdle === 'function') stopAndResetToIdle();
            return;
          }
          if (e.key === 'Enter') {
            e.preventDefault();
            if (timerState.mode === 'pomodoro' && typeof skipActiveTimerStep === 'function') {
              skipActiveTimerStep();
            }
            return;
          }
          return;
        }

        // --- CASE B: Inside Timer View in IDLE / SELECTION STATE ---
        // 0 ~ 9 keys: Instantly launch respective preset timer!
        if (e.key === '0') {
          e.preventDefault();
          if (typeof startPresetTimer === 'function') startPresetTimer('pomodoro');
          return;
        }
        if (e.key === '1') {
          e.preventDefault();
          if (typeof startPresetTimer === 'function') startPresetTimer(1);
          return;
        }
        if (e.key === '2') {
          e.preventDefault();
          if (typeof startPresetTimer === 'function') startPresetTimer(3);
          return;
        }
        if (e.key === '3') {
          e.preventDefault();
          if (typeof startPresetTimer === 'function') startPresetTimer(5);
          return;
        }
        if (e.key === '4') {
          e.preventDefault();
          if (typeof startPresetTimer === 'function') startPresetTimer(8);
          return;
        }
        if (e.key === '5') {
          e.preventDefault();
          if (typeof startPresetTimer === 'function') startPresetTimer(10);
          return;
        }
        if (e.key === '6') {
          e.preventDefault();
          if (typeof startPresetTimer === 'function') startPresetTimer(15);
          return;
        }
        if (e.key === '7') {
          e.preventDefault();
          if (typeof startPresetTimer === 'function') startPresetTimer(30);
          return;
        }
        if (e.key === '8') {
          e.preventDefault();
          if (typeof startPresetTimer === 'function') startPresetTimer(60);
          return;
        }
        if (e.key === '9') {
          e.preventDefault();
          const customInput = document.getElementById('custom-timer-minutes');
          if (customInput && document.activeElement !== customInput) {
            customInput.focus();
            customInput.select();
          } else {
            if (typeof startCustomTimer === 'function') startCustomTimer();
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          const returnMode = (typeof state !== 'undefined' && state.previousMode && state.previousMode !== 'timer')
            ? state.previousMode
            : 'section';
          if (typeof setMode === 'function') setMode(returnMode);
          return;
        }
      } else {
        // If inside custom-timer-minutes input, Enter starts it
        if (e.key === 'Enter') {
          e.preventDefault();
          if (typeof startCustomTimer === 'function') startCustomTimer();
          e.target.blur();
          return;
        }
      }
    }

    // 4. Global Shortcuts (Only when NO modal is open)
    const filtered = typeof getFilteredHabits === 'function' ? getFilteredHabits() : [];

    switch (e.key) {
      case '0':
      case 'Home':
      case 'h':
      case 'H':
        e.preventDefault();
        if (typeof resetToToday === 'function') resetToToday();
        break;
      case '1':
        if (typeof setMode === 'function') setMode('section');
        break;
      case '2':
        if (typeof setMode === 'function') setMode('focus');
        break;
      case '3':
        if (typeof setMode === 'function') setMode('all');
        break;
      case '4':
        if (typeof setMode === 'function') setMode('table');
        break;
      case '5':
        if (typeof setMode === 'function') setMode('goals');
        break;
      case '6':
        if (typeof setMode === 'function') setMode('timer');
        break;

      // Arrow Keys Navigation
      case 'ArrowLeft':
        e.preventDefault();
        if (typeof prevDay === 'function') prevDay();
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (typeof nextDay === 'function') nextDay();
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (typeof prevSection === 'function') prevSection();
        break;

      case 'ArrowDown':
        e.preventDefault();
        if (typeof nextSection === 'function') nextSection();
        break;

      case 'v':
      case 'V':
        e.preventDefault();
        if (typeof cycleViewType === 'function') cycleViewType();
        break;

      case 'p':
      case 'P':
        e.preventDefault();
        if (typeof openTaskPresetsModal === 'function') openTaskPresetsModal();
        break;

      case 't':
      case 'T':
        e.preventDefault();
        if (typeof openAddTaskModal === 'function') openAddTaskModal();
        break;

      case 'Tab':
        e.preventDefault();
        if (typeof cycleStatusFilter === 'function') cycleStatusFilter();
        break;

      case ' ':
      case 'Enter':
        e.preventDefault();
        if (filtered.length > 0 && typeof toggleHabit === 'function') {
          const target = filtered[state.selectedIndex] || filtered[0];
          toggleHabit(target.id);
        }
        break;

      case 's':
      case 'S':
        if (filtered.length > 0 && typeof skipHabit === 'function') {
          const target = filtered[state.selectedIndex] || filtered[0];
          skipHabit(target.id);
        }
        break;

      case 'j':
      case 'J':
        e.preventDefault();
        if (state.selectedIndex < filtered.length - 1) {
          state.selectedIndex++;
          if (typeof renderApp === 'function') renderApp();
        }
        break;

      case 'k':
      case 'K':
        e.preventDefault();
        if (state.selectedIndex > 0) {
          state.selectedIndex--;
          if (typeof renderApp === 'function') renderApp();
        }
        break;

      case 'd':
      case 'D':
        if (typeof openCascadeFilterModal === 'function') openCascadeFilterModal('domain', 'ドメイン (PN1〜PN5)', DOMAINS_DATA);
        break;

      case 'b':
      case 'B':
        if (typeof openCascadeFilterModal === 'function') openCascadeFilterModal('dept', '部門 (本部/直轄)', DEPTS_DATA);
        break;

      case 'f':
      case 'F':
        e.preventDefault();
        if (state.currentMode === 'all') {
          if (typeof toggleDailyFlatView === 'function') {
            toggleDailyFlatView();
          }
        } else {
          if (typeof setMode === 'function') {
            setMode('all');
          }
        }
        break;

      case 'n':
      case 'N':
        if (typeof openAddModal === 'function') openAddModal();
        break;

      case '[':
      case ']':
        e.preventDefault();
        toggleSidebar();
        break;

      case 'r':
      case 'R':
        e.preventDefault();
        if (typeof reloadAppData === 'function') reloadAppData();
        break;

      case '?':
        if (typeof openShortcutsModal === 'function') openShortcutsModal();
        break;

      case 'Escape':
        handleGlobalEscape(e);
        break;
    }
  });
}

// Multi-Step Cascade Escape Handler (Mental Model: Clear -> Today -> Section 1)
function handleGlobalEscape(e) {
  if (e) e.preventDefault();

  // 1. Check if any Modal is open
  if (typeof isAnyModalOpen === 'function' && isAnyModalOpen()) {
    if (typeof closeModal === 'function') closeModal();
    return;
  }

  // 2. Check if any Context Menu is open
  const habitMenu = document.getElementById('habit-context-menu');
  const taskMenu = document.getElementById('task-context-menu');
  if ((habitMenu && habitMenu.classList.contains('active')) || (taskMenu && taskMenu.classList.contains('active'))) {
    if (typeof hideAllContextMenus === 'function') hideAllContextMenus();
    return;
  }

  // 3. Inside Timer Mode
  if (state.currentMode === 'timer') {
    const isTimerActive = typeof timerState !== 'undefined' && timerState && timerState.activeTimerId !== null;
    if (isTimerActive) {
      if (typeof stopAndResetToIdle === 'function') stopAndResetToIdle();
    } else {
      const returnMode = (typeof state !== 'undefined' && state.previousMode && state.previousMode !== 'timer') 
        ? state.previousMode 
        : 'section';
      if (typeof setMode === 'function') setMode(returnMode);
    }
    return;
  }

  // 4. Has Active Filters (Domain, Dept, Proj, Tags, or status != uncompleted) -> Reset all filters!
  const hasActiveFilters = (
    (state.filters.status && state.filters.status !== 'uncompleted') ||
    state.filters.domain !== null ||
    state.filters.dept !== null ||
    state.filters.proj !== null ||
    (Array.isArray(state.filters.includeTags) && state.filters.includeTags.length > 0) ||
    (Array.isArray(state.filters.excludeTags) && state.filters.excludeTags.length > 0)
  );
  if (hasActiveFilters) {
    if (typeof resetAllFilters === 'function') resetAllFilters();
    return;
  }

  // 5. Viewing Past / Future Date -> Reset to Today!
  if (state.selectedDateOffset !== 0) {
    if (typeof resetToToday === 'function') resetToToday();
    return;
  }

  // 6. Subview Exit Cascades
  // 5: Vision Mode
  if (state.currentMode === 'goals') {
    const backView = document.getElementById('goals-back-view');
    if (backView && backView.classList.contains('active')) {
      if (typeof toggleGoalsSubmode === 'function') toggleGoalsSubmode();
      return;
    }
    if (typeof setMode === 'function') setMode('section');
    return;
  }

  // 2: Focus Mode, 3: Daily Mode, 4: Master Table Mode, Bucket Mode -> Return to Section View (1)
  if (['focus', 'all', 'table', 'bucket'].includes(state.currentMode)) {
    if (typeof setMode === 'function') setMode('section');
    return;
  }

  // 1: Section Mode -> Reset to Current Real-time Time Section!
  if (state.currentMode === 'section') {
    const detectedSec = typeof detectCurrentSection === 'function' ? detectCurrentSection() : '第2セッション';
    if (state.currentSection !== detectedSec) {
      state.currentSection = detectedSec;
      if (typeof renderApp === 'function') renderApp();
      return;
    }
  }
}

function toggleSidebar() {
  const isCurrentlyHiddenInMode = ['focus', 'table', 'goals'].includes(state.currentMode);
  
  if (isCurrentlyHiddenInMode) {
    document.body.classList.toggle('sidebar-force-open');
  } else {
    document.body.classList.toggle('sidebar-collapsed');
  }
}

let goalFocusIndex = -1;
const GOAL_CARD_IDS = ['goal-card-weekly', 'goal-card-monthly', 'goal-card-half', 'goal-card-phase'];

function cycleGoalFocus() {
  const cards = GOAL_CARD_IDS.map(id => document.getElementById(id)).filter(Boolean);
  if (cards.length === 0) return;

  cards.forEach(c => c.classList.remove('goal-card-focus-highlight'));
  goalFocusIndex = (goalFocusIndex + 1) % (cards.length + 1);

  if (goalFocusIndex < cards.length) {
    const activeCard = cards[goalFocusIndex];
    activeCard.classList.add('goal-card-focus-highlight');
    activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
