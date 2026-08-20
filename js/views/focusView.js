/**
 * Gendrive - Focus Mode (Dual Focus) View Renderer
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Focus Filtering Helper
// =========================================================================

// フォーカス画面専用: すでに終了した過去セクション・過去時間帯のハビットは未完了でも除外
function isHabitActiveForFocus(habit) {
  if (!habit) return false;
  // 今日以外（過去日・未来日）なら全未完了ハビットを対象
  if (state.selectedDateOffset !== 0) return true;

  const type = habit.displayType || habit.timingType || 'section';

  // 1. Anytime: 終日常にフォーカス対象
  if (type === 'anytime') return true;

  const realSecName = normalizeSectionName(detectCurrentSection());
  const realSecIndex = SECTIONS_CONFIG.findIndex(s => s.name === realSecName);

  // 2. Section: 現在のセクションまたは未来のセクションであれば対象、過去セクションは除外
  if (type === 'section') {
    const habitSec = normalizeSectionName(habit.section);
    const habitSecIndex = SECTIONS_CONFIG.findIndex(s => s.name === habitSec);
    if (habitSecIndex !== -1 && habitSecIndex < realSecIndex) {
      return false; // 過去のセクションなので時間切れ・非表示
    }
    return true;
  }

  // 3. Custom: 終了時間（habitEnd）が現在時刻より前なら時間切れ・非表示
  if (type === 'custom') {
    if (!habit.customStart) return true;
    const [sH, sM] = String(habit.customStart).split(':').map(Number);
    const habitStart = (sH || 0) + (sM || 0) / 60;
    let habitEnd = habitStart + ((habit.targetMin || 30) / 60);
    if (habit.customEnd) {
      const [eH, eM] = String(habit.customEnd).split(':').map(Number);
      habitEnd = (eH || 0) + (eM || 0) / 60;
    }

    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;

    // もし終了時間が現在時刻より前なら除外（例: 終了12:00で現在14:58）
    if (habitStart <= habitEnd) {
      if (currentHour > habitEnd) return false;
    }
    return true;
  }

  return true;
}

// =========================================================================
// 2. Render Focus View (Mode 2: Dual Focus - Left Task × Right Habit)
// =========================================================================

function renderFocusView() {
  const showTasks = state.viewType === 'all' || state.viewType === 'task';
  const showHabits = state.viewType === 'all' || state.viewType === 'habit';

  const paneTask = document.getElementById('focus-pane-task');
  const paneHabit = document.getElementById('focus-pane-habit');
  const dualLayout = document.querySelector('.dual-focus-layout');

  if (paneTask) paneTask.style.display = showTasks ? 'flex' : 'none';
  if (paneHabit) paneHabit.style.display = showHabits ? 'flex' : 'none';

  if (dualLayout) {
    if (showTasks && showHabits) {
      dualLayout.style.gridTemplateColumns = '1fr 1fr';
    } else {
      dualLayout.style.gridTemplateColumns = 'minmax(350px, 700px)';
      dualLayout.style.justifyContent = 'center';
    }
  }

  // Left: Task Focus
  if (showTasks) {
    const taskContainer = document.getElementById('focus-task-card-container');
    const activeTodayTasks = state.tasks.filter(t => isTaskForSelectedDate(t) && t.status !== 'completed' && t.status !== 'skipped' && matchesTagFilters(t));
    
    if (activeTodayTasks.length === 0) {
      taskContainer.innerHTML = `
        <div class="focus-card">
          <div class="empty-state">
            <div class="empty-state-icon">🎉</div>
            <h3>未完了タスクはありません</h3>
            <p>今日のタスクはすべてクリア！素晴らしい集中力です。</p>
          </div>
        </div>
      `;
      document.getElementById('focus-task-counter').textContent = '0 / 0';
    } else {
      if (state.focusTaskIndex >= activeTodayTasks.length) state.focusTaskIndex = 0;
      const task = activeTodayTasks[state.focusTaskIndex];
      document.getElementById('focus-task-counter').textContent = `${state.focusTaskIndex + 1} / ${activeTodayTasks.length}`;

      const labelBadge = getEisenhowerLabelBadge(task.label);
      const isInProgress = task.status === 'in_progress';
      const isPaused = task.status === 'paused';
      const estInfo = getEstimatedDuration(task, 'task');
      const targetMin = estInfo.targetMin;

      // Elapsed & Progress calculation
      const pastSec = task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0);
      const curSec = (isInProgress && task.startTimestamp) 
        ? Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000))
        : 0;
      const elapsedSec = pastSec + curSec;

      const elapsedMin = Math.floor(elapsedSec / 60);
      const elapsedRemainSec = elapsedSec % 60;
      const elapsedFormatted = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedRemainSec).padStart(2, '0')}`;
      
      const totalTargetSec = targetMin * 60;
      const progressPercent = totalTargetSec > 0 ? Math.min(100, Math.round((elapsedSec / totalTargetSec) * 100)) : 0;
      const isOverTime = elapsedSec > totalTargetSec;
      const overSec = Math.max(0, elapsedSec - totalTargetSec);
      const overMin = Math.floor(overSec / 60);
      const overRemainSec = overSec % 60;
      const overFormatted = `+${overMin}:${String(overRemainSec).padStart(2, '0')}`;

      taskContainer.innerHTML = `
        <div class="focus-card ${isInProgress ? 'in-progress' : ''} ${isPaused ? 'paused' : ''}">
          <div class="focus-header-tags">
            ${labelBadge ? `<span class="badge-eisenhower ${labelBadge.cls}">${labelBadge.text}</span>` : ''}
            <span class="meta-tag timing">⏱️ ${task.section || '終日'}</span>
            ${task.domainMinor ? `<span class="meta-tag domain">${task.domainMinor}</span>` : ''}
            <span class="badge-frog">🐸 カエル度: ${task.frog || 3} / 5</span>
            ${isPaused ? `<span class="tc-paused-badge">⏸️ 中断中</span>` : ''}
          </div>

          <h2 class="focus-main-title">${task.title}</h2>

          <!-- TaskChute Immersive Realtime Time Scale -->
          <div class="focus-timescale-box ${isInProgress ? 'active' : ''} ${isPaused ? 'paused' : ''} ${isOverTime ? 'overtime' : ''}">
            <div class="timescale-header">
              <div class="timescale-target-info">
                <span class="timescale-label">🎯 予想所要時間:</span>
                <b class="timescale-value">${targetMin}分</b>
                <span class="timescale-source">(${estInfo.label})</span>
              </div>
              <div class="timescale-live-timer" id="focus-task-live-timer">
                ${isInProgress ? `● 経過: <b>${elapsedFormatted}</b>` : isPaused ? `⏸️ 中断中: <b>${elapsedFormatted}</b>` : `実働: <b>${task.actMin || 0}分</b>`}
              </div>
            </div>

            <div class="timescale-bar-track">
              <div class="timescale-bar-fill ${isOverTime ? 'overtime' : ''}" id="focus-task-scale-fill" style="width: ${progressPercent}%;"></div>
            </div>

            <div class="timescale-footer">
              <span id="focus-task-scale-percent">${isInProgress ? (isOverTime ? `⚠️ 超過: ${overFormatted} (${Math.round((elapsedSec/totalTargetSec)*100)}%)` : `進捗: ${progressPercent}%`) : isPaused ? `⏸️ 一時中断中 (${task.actMin || 0}分計測済) - 再開で計測継続` : (task.actMin ? `完了実績: ${task.actMin}分` : '▶ 開始するとリアルタイムで計測します')}</span>
              <span>目標: ${targetMin}:00</span>
            </div>
          </div>

          ${task.notes ? `
            <div class="focus-notes-box">
              <div class="focus-notes-title">📝 メモ・備考:</div>
              <div class="focus-notes-content">${task.notes}</div>
            </div>
          ` : ''}

          <div class="focus-actions-row">
            ${isInProgress ? `
              <button class="btn-focus-action success main-action" onclick="completeTask('${task.id}')">
                ✓ 完了する (Space)
              </button>
              <button class="btn-focus-action secondary sub-action" onclick="pauseTask('${task.id}')" title="一時中断">
                ⏸ 中断
              </button>
            ` : isPaused ? `
              <button class="btn-focus-action pause main-action" onclick="startTask('${task.id}')">
                ▶ 再開する (Space)
              </button>
              <button class="btn-focus-action secondary sub-action" onclick="openEditTaskModal('${task.id}')" title="タスクを編集">
                ⚙️ 編集
              </button>
            ` : `
              <button class="btn-focus-action primary main-action" onclick="startTask('${task.id}')">
                ▶ 開始する (Space)
              </button>
              <button class="btn-focus-action secondary sub-action" onclick="openEditTaskModal('${task.id}')" title="タスクを編集">
                ⚙️ 編集
              </button>
            `}
          </div>
        </div>
      `;
    }
  }

  // Right: Habit Focus (Always uncompleted Next 1 only)
  if (showHabits) {
    const habitContainer = document.getElementById('focus-habit-card-container');
    const activeHabits = getFilteredHabits('focus');

    if (activeHabits.length === 0) {
      habitContainer.innerHTML = `
        <div class="focus-card">
          <div class="empty-state">
            <div class="empty-state-icon">✨</div>
            <h3>ハビット完了！</h3>
            <p>今日のハビットはすべて達成しました！素晴らしい継続力です。</p>
          </div>
        </div>
      `;
      document.getElementById('focus-habit-counter').textContent = '0 / 0';
    } else {
      if (state.focusHabitIndex >= activeHabits.length) state.focusHabitIndex = 0;
      const habit = activeHabits[state.focusHabitIndex];
      document.getElementById('focus-habit-counter').textContent = `${state.focusHabitIndex + 1} / ${activeHabits.length}`;

      const isInProgress = habit.status === 'in_progress';
      const estInfo = getEstimatedDuration(habit, 'habit');
      const targetMin = estInfo.targetMin;

      // Elapsed & Progress calculation
      const elapsedSec = (isInProgress && habit.startTimestamp) 
        ? Math.max(0, Math.floor((Date.now() - habit.startTimestamp) / 1000))
        : 0;
      const elapsedMin = Math.floor(elapsedSec / 60);
      const elapsedRemainSec = elapsedSec % 60;
      const elapsedFormatted = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedRemainSec).padStart(2, '0')}`;
      
      const totalTargetSec = targetMin * 60;
      const progressPercent = totalTargetSec > 0 ? Math.min(100, Math.round((elapsedSec / totalTargetSec) * 100)) : 0;
      const isOverTime = elapsedSec > totalTargetSec;
      const overSec = Math.max(0, elapsedSec - totalTargetSec);
      const overMin = Math.floor(overSec / 60);
      const overRemainSec = overSec % 60;
      const overFormatted = `+${overMin}:${String(overRemainSec).padStart(2, '0')}`;

      habitContainer.innerHTML = `
        <div class="focus-card ${isInProgress ? 'in-progress' : ''}">
          <div class="focus-header-tags">
            ${getTimingBadgeHtml(habit)}
            ${habit.domain ? `<span class="meta-tag domain">${habit.domain}</span>` : ''}
            ${habit.dept ? `<span class="meta-tag dept">${habit.dept}</span>` : ''}
            ${getHabitCompletionProgressHtml(habit)}
            ${getRecurrenceBadgeHtml(habit.recurrence)}
            <span class="badge-frog">🐸 カエル度: ${habit.frogLevel || 3} / 5</span>
            <span class="habit-stats-badge" style="font-size: 11px;">ランク: ${habit.stats ? habit.stats.tier : '🌱 Developing'}</span>
          </div>

          <h2 class="focus-main-title">${habit.name}</h2>

          <!-- TaskChute Immersive Realtime Time Scale -->
          <div class="focus-timescale-box habit-scale ${isInProgress ? 'active' : ''} ${isOverTime ? 'overtime' : ''}">
            <div class="timescale-header">
              <div class="timescale-target-info">
                <span class="timescale-label">🎯 予想所要時間:</span>
                <b class="timescale-value">${targetMin}分</b>
                <span class="timescale-source">(${estInfo.label})</span>
              </div>
              <div class="timescale-live-timer" id="focus-habit-live-timer">
                ${isInProgress ? `● 経過: <b>${elapsedFormatted}</b>` : `実働: <b>0分</b>`}
              </div>
            </div>

            <div class="timescale-bar-track">
              <div class="timescale-bar-fill habit-fill ${isOverTime ? 'overtime' : ''}" id="focus-habit-scale-fill" style="width: ${progressPercent}%;"></div>
            </div>

            <div class="timescale-footer">
              <span id="focus-habit-scale-percent">${isInProgress ? (isOverTime ? `⚠️ 超過: ${overFormatted} (${Math.round((elapsedSec/totalTargetSec)*100)}%)` : `進捗: ${progressPercent}%`) : '▶ 開始するとリアルタイムで計測します'}</span>
              <span>目標: ${targetMin}:00</span>
            </div>
          </div>

          <div class="focus-actions-row">
            ${isInProgress ? `
              <button class="btn-focus-action success main-action" onclick="completeHabit('${habit.id}')">
                🎉 完了する (Enter)
              </button>
              <button class="btn-focus-action secondary sub-action" onclick="pauseHabit('${habit.id}')" title="一時中断">
                ⏸ 中断
              </button>
            ` : `
              <button class="btn-focus-action primary habit-btn main-action" onclick="startHabit('${habit.id}')">
                ▶ 開始する
              </button>
              <button class="btn-focus-action secondary sub-action" onclick="openEditModal('${habit.id}')" title="ハビットを編集">
                ⚙️ 編集
              </button>
            `}
          </div>
        </div>
      `;
    }
  }
}

// =========================================================================
// 3. 1-Second Live Progress Updater
// =========================================================================

function updateLiveFocusProgress() {
  // 1. Live update for Section & Daily Cards (Task)
  state.tasks.forEach(t => {
    if (t.status === 'in_progress' && t.startTimestamp) {
      const cardTimerEl = document.getElementById(`task-progress-time-${t.id}`);
      if (cardTimerEl) {
        const estInfo = getEstimatedDuration(t, 'task');
        const curElapsedMin = getTaskCurrentElapsedMin(t);
        cardTimerEl.innerHTML = `実績/予想: <b>${curElapsedMin}分</b> / ${estInfo.targetMin}分`;
      }

      // Live timescale background update
      const pct = (typeof getTaskTimeProgress === 'function') ? getTaskTimeProgress(t) : 0;
      document.querySelectorAll(`.task-card[data-id="${t.id}"]`).forEach(card => {
        card.classList.add('is-timescale-active');
        card.classList.remove('is-timescale-paused');
        card.classList.toggle('is-timescale-warning', pct >= 70);
        card.style.setProperty('--timescale-pct', `${pct}%`);
      });
    }
  });

  // 2. Live update for Section & Daily Cards (Habit)
  state.habits.forEach(h => {
    if (h.status === 'in_progress' && h.startTimestamp) {
      const cardTimerEl = document.getElementById(`habit-progress-time-${h.id}`);
      if (cardTimerEl) {
        const estInfo = getEstimatedDuration(h, 'habit');
        const curElapsedMin = Math.max(0, Math.floor((Date.now() - h.startTimestamp) / 60000));
        cardTimerEl.innerHTML = `実績/目安: <b>${curElapsedMin}分</b> / ${estInfo.targetMin}分`;
      }

      // Live timescale background update
      const pct = (typeof getHabitTimeProgress === 'function') ? getHabitTimeProgress(h) : 0;
      document.querySelectorAll(`.habit-card[data-id="${h.id}"]`).forEach(card => {
        card.classList.add('is-timescale-active');
        card.classList.toggle('is-timescale-warning', pct >= 70);
        card.style.setProperty('--timescale-pct', `${pct}%`);
      });
    }
  });

  // 3. Live update for Section Banners (Section View & Daily View)
  if (typeof getSectionTimeProgress === 'function') {
    // Section View Banner
    const secBanner = document.querySelector('#view-section .section-banner');
    if (secBanner && state.currentSection) {
      const secPct = getSectionTimeProgress(state.currentSection);
      if (secPct !== null) {
        secBanner.classList.add('is-active-section', 'is-timescale-active');
        secBanner.classList.toggle('is-timescale-warning', secPct >= 70);
        secBanner.style.setProperty('--section-timescale-pct', `${secPct}%`);
      } else {
        secBanner.classList.remove('is-active-section', 'is-timescale-active', 'is-timescale-warning');
        secBanner.style.removeProperty('--section-timescale-pct');
      }
    }

    // Daily View Groups
    document.querySelectorAll('#view-all .section-group').forEach(group => {
      // Find section name from group
      const titleEl = group.querySelector('.section-group-title span');
      if (titleEl) {
        const matchingSec = SECTIONS_CONFIG.find(s => titleEl.textContent.includes(s.name));
        if (matchingSec) {
          const secPct = getSectionTimeProgress(matchingSec.name);
          if (secPct !== null) {
            group.classList.add('is-active-section', 'is-timescale-active');
            group.classList.toggle('is-timescale-warning', secPct >= 70);
            group.style.setProperty('--section-timescale-pct', `${secPct}%`);
          } else {
            group.classList.remove('is-active-section', 'is-timescale-active', 'is-timescale-warning');
            group.style.removeProperty('--section-timescale-pct');
          }
        }
      }
    });
  }

  if (state.currentMode !== 'focus') return;

  // Active Task Live Update
  const activeTask = state.tasks.find(t => t.id === state.activeTaskId && t.status === 'in_progress');
  if (activeTask && activeTask.startTimestamp) {
    const estInfo = getEstimatedDuration(activeTask, 'task');
    const targetMin = estInfo.targetMin;
    const pastSec = activeTask.accumulatedSeconds || (activeTask.actMin ? activeTask.actMin * 60 : 0);
    const curSec = Math.max(0, Math.floor((Date.now() - activeTask.startTimestamp) / 1000));
    const elapsedSec = pastSec + curSec;
    const elapsedMin = Math.floor(elapsedSec / 60);
    const elapsedRemainSec = elapsedSec % 60;
    const elapsedFormatted = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedRemainSec).padStart(2, '0')}`;
    
    const totalTargetSec = targetMin * 60;
    const progressPercent = totalTargetSec > 0 ? Math.min(100, Math.round((elapsedSec / totalTargetSec) * 100)) : 0;
    const isOverTime = elapsedSec > totalTargetSec;
    const overSec = Math.max(0, elapsedSec - totalTargetSec);
    const overMin = Math.floor(overSec / 60);
    const overRemainSec = overSec % 60;
    const overFormatted = `+${overMin}:${String(overRemainSec).padStart(2, '0')}`;

    const timerEl = document.getElementById('focus-task-live-timer');
    if (timerEl) timerEl.innerHTML = `● 経過: <b>${elapsedFormatted}</b>`;

    const fillEl = document.getElementById('focus-task-scale-fill');
    if (fillEl) {
      fillEl.style.width = `${progressPercent}%`;
      fillEl.classList.toggle('overtime', isOverTime);
    }

    const percentEl = document.getElementById('focus-task-scale-percent');
    if (percentEl) {
      percentEl.textContent = isOverTime ? `⚠️ 超過: ${overFormatted} (${Math.round((elapsedSec/totalTargetSec)*100)}%)` : `進捗: ${progressPercent}%`;
    }
  }

  // Active Habit Live Update
  const activeHabit = state.habits.find(h => h.id === state.activeHabitId && h.status === 'in_progress');
  if (activeHabit && activeHabit.startTimestamp) {
    const estInfo = getEstimatedDuration(activeHabit, 'habit');
    const targetMin = estInfo.targetMin;
    const elapsedSec = Math.max(0, Math.floor((Date.now() - activeHabit.startTimestamp) / 1000));
    const elapsedMin = Math.floor(elapsedSec / 60);
    const elapsedRemainSec = elapsedSec % 60;
    const elapsedFormatted = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedRemainSec).padStart(2, '0')}`;
    
    const totalTargetSec = targetMin * 60;
    const progressPercent = totalTargetSec > 0 ? Math.min(100, Math.round((elapsedSec / totalTargetSec) * 100)) : 0;
    const isOverTime = elapsedSec > totalTargetSec;
    const overSec = Math.max(0, elapsedSec - totalTargetSec);
    const overMin = Math.floor(overSec / 60);
    const overRemainSec = overSec % 60;
    const overFormatted = `+${overMin}:${String(overRemainSec).padStart(2, '0')}`;

    const timerEl = document.getElementById('focus-habit-live-timer');
    if (timerEl) timerEl.innerHTML = `● 経過: <b>${elapsedFormatted}</b>`;

    const fillEl = document.getElementById('focus-habit-scale-fill');
    if (fillEl) {
      fillEl.style.width = `${progressPercent}%`;
      fillEl.classList.toggle('overtime', isOverTime);
    }

    const percentEl = document.getElementById('focus-habit-scale-percent');
    if (percentEl) {
      percentEl.textContent = isOverTime ? `⚠️ 超過: ${overFormatted} (${Math.round((elapsedSec/totalTargetSec)*100)}%)` : `進捗: ${progressPercent}%`;
    }
  }
}
