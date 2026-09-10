/**
 * Gendrive - Focus Mode (Adaptive Focus Board: 1 -> 2 -> 3 Display Loop)
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Render Focus View (Mode 2: Adaptive Focus Board: 1 -> 2 -> 3 Loop)
// =========================================================================

function renderFocusView() {
  const container = document.getElementById('focus-cards-container') || document.getElementById('focus-task-card-container');
  if (!container) return;

  const currentCount = state.focusCount || 1;

  // 1. Update Top Bar Pill Buttons (if visible)
  document.querySelectorAll('#focus-count-selector .focus-count-btn').forEach(btn => {
    const btnCount = parseInt(btn.dataset.count, 10);
    btn.classList.toggle('active', btnCount === currentCount);
  });

  // 2. Update Mode Badge Title (if visible)
  const modeBadgeEl = document.getElementById('focus-mode-badge');
  if (modeBadgeEl) {
    if (currentCount === 1) {
      modeBadgeEl.textContent = '🎯 シングル集中 (NEXT 1)';
    } else if (currentCount === 2) {
      modeBadgeEl.textContent = '🅰️/🅱️ 二者択一 (A or B)';
    } else if (currentCount === 3) {
      modeBadgeEl.textContent = '🥇/🥈/🥉 スモール優先順位 (TOP 3)';
    }
  }

  // 3. Filter Active Uncompleted Tasks for Selected Date
  const activeTodayTasks = state.tasks.filter(t => 
    isTaskForSelectedDate(t) && 
    t.status !== 'completed' && 
    t.status !== 'skipped' && 
    matchesTagFilters(t)
  );

  // 4. Update Container Classes for Grid Layout
  container.className = `focus-cards-container count-${currentCount}`;

  // 5. Update Hyper-Focus Mindset Banner
  const mindsetEl = document.getElementById('focus-mindset-banner');
  if (mindsetEl) {
    if (activeTodayTasks.length === 0) {
      mindsetEl.innerHTML = '';
    } else if (currentCount === 1) {
      mindsetEl.innerHTML = `<span class="mindset-text count-1">スーパーフォーカスモード、今すぐ着手、１分でいいからやれ</span>`;
    } else if (currentCount === 2) {
      mindsetEl.innerHTML = `<span class="mindset-text count-2">どっちからやる？</span>`;
    } else if (currentCount === 3) {
      mindsetEl.innerHTML = `<span class="mindset-text count-3">どれからやる？</span>`;
    }
  }

  // 6. If No Tasks Left
  if (activeTodayTasks.length === 0) {
    container.innerHTML = `
      <div class="focus-card focus-card-empty">
        <div class="empty-state">
          <div class="empty-state-icon">🎉</div>
          <h3>未完了タスクはありません</h3>
          <p>今日のタスクはすべてクリア！素晴らしい集中力です。</p>
        </div>
      </div>
    `;
    const counterEl = document.getElementById('focus-task-counter');
    if (counterEl) counterEl.textContent = '0 / 0';
    const pageIndicator = document.getElementById('focus-page-indicator');
    if (pageIndicator) pageIndicator.textContent = '0 / 0';
    return;
  }

  // 7. Calculate Slice for Display
  if (state.focusTaskIndex >= activeTodayTasks.length) {
    state.focusTaskIndex = 0;
  }
  const startIndex = state.focusTaskIndex || 0;
  const visibleTasks = activeTodayTasks.slice(startIndex, startIndex + currentCount);

  // 8. Update Counter & Page Indicator
  const counterText = (currentCount === 1)
    ? `${startIndex + 1} / ${activeTodayTasks.length}`
    : `${startIndex + 1}-${Math.min(startIndex + visibleTasks.length, activeTodayTasks.length)} / ${activeTodayTasks.length}`;

  const counterEl = document.getElementById('focus-task-counter');
  if (counterEl) counterEl.textContent = counterText;

  const pageIndicator = document.getElementById('focus-page-indicator');
  if (pageIndicator) pageIndicator.textContent = counterText;

  // 9. Render Task Focus Cards
  container.innerHTML = visibleTasks.map((task, index) => {
    return renderTaskFocusCard(task, index, currentCount, startIndex);
  }).join('');
}

// =========================================================================
// 2. Render Single Focus Card
// =========================================================================

function renderTaskFocusCard(task, rankIndex, totalFocusCount, startIndex) {
  const isInProgress = task.status === 'in_progress';
  const isPaused = task.status === 'paused';
  const estInfo = getEstimatedDuration(task, 'task');
  const targetMin = estInfo.targetMin;

  const labelBadge = typeof getEisenhowerBadge === 'function' 
    ? getEisenhowerBadge(task.eisenhower) 
    : (typeof EISENHOWER_MATRIX !== 'undefined' && EISENHOWER_MATRIX[task.eisenhower] 
        ? { text: EISENHOWER_MATRIX[task.eisenhower].label, cls: EISENHOWER_MATRIX[task.eisenhower].cls } 
        : null);

  // Rank / Mode badge depending on focusCount
  let rankBadgeHtml = '';
  if (totalFocusCount === 1) {
    rankBadgeHtml = `<span class="focus-rank-badge single">🎯 シングル集中</span>`;
  } else if (totalFocusCount === 2) {
    const label = rankIndex === 0 ? '🅰️ 選択肢 A' : '🅱️ 選択肢 B';
    const cls = rankIndex === 0 ? 'choice-a' : 'choice-b';
    rankBadgeHtml = `<span class="focus-rank-badge ${cls}">${label}</span>`;
  } else if (totalFocusCount === 3) {
    const labels = ['🥇 TOP 1', '🥈 TOP 2', '🥉 TOP 3'];
    const cls = ['rank-1', 'rank-2', 'rank-3'];
    rankBadgeHtml = `<span class="focus-rank-badge ${cls[rankIndex] || ''}">${labels[rankIndex] || `TOP ${rankIndex + 1}`}</span>`;
  }

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

  const safeObsidianUri = (task.obsidianUri || '').replace(/'/g, "\\'");

  return `
    <div class="focus-card ${isInProgress ? 'in-progress' : ''} ${isPaused ? 'paused' : ''}" data-task-id="${task.id}">
      <div class="focus-header-tags">
        ${rankBadgeHtml}
        ${labelBadge ? `<span class="badge-eisenhower ${labelBadge.cls}">${labelBadge.text}</span>` : ''}
        <span class="meta-tag timing">⏱️ ${task.section || '終日'}</span>
        ${task.domainMinor ? `<span class="meta-tag domain">${task.domainMinor}</span>` : ''}
        <span class="badge-frog">🐸 カエル度: ${task.frog || 3} / 5</span>
        ${isPaused ? `<span class="tc-paused-badge">⏸️ 中断中</span>` : ''}
      </div>

      <h2 class="focus-main-title">${task.title}</h2>

      <!-- Realtime Time Scale -->
      <div class="focus-timescale-box ${isInProgress ? 'active' : ''} ${isPaused ? 'paused' : ''} ${isOverTime ? 'overtime' : ''}">
        <div class="timescale-header">
          <div class="timescale-target-info">
            <span class="timescale-label">🎯 予想:</span>
            <b class="timescale-value">${targetMin}分</b>
            <span class="timescale-source">(${estInfo.label})</span>
          </div>
          <div class="timescale-live-timer" id="focus-task-live-timer-${task.id}">
            ${isInProgress ? `● 経過: <b>${elapsedFormatted}</b>` : isPaused ? `⏸️ 中断中: <b>${elapsedFormatted}</b>` : `実働: <b>${task.actMin || 0}分</b>`}
          </div>
        </div>

        <div class="timescale-bar-track">
          <div class="timescale-bar-fill ${isOverTime ? 'overtime' : ''}" id="focus-task-scale-fill-${task.id}" style="width: ${progressPercent}%;"></div>
        </div>

        <div class="timescale-footer">
          <span id="focus-task-scale-percent-${task.id}">${isInProgress ? (isOverTime ? `⚠️ 超過: ${overFormatted} (${Math.round((elapsedSec/totalTargetSec)*100)}%)` : `進捗: ${progressPercent}%`) : isPaused ? `⏸️ 一時中断中 (${task.actMin || 0}分計測済) - 再開で計測継続` : (task.actMin ? `完了実績: ${task.actMin}分` : '▶ 開始するとリアルタイムで計測します')}</span>
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
            ✓ 完了
          </button>
          <button class="btn-focus-action secondary sub-action" onclick="pauseTask('${task.id}')" title="一時中断">
            ⏸ 中断
          </button>
        ` : isPaused ? `
          <button class="btn-focus-action pause main-action" onclick="startTask('${task.id}')">
            ▶ 再開
          </button>
          <button class="btn-focus-action secondary sub-action" onclick="openEditTaskModal('${task.id}')" title="タスクを編集">
            ⚙️ 編集
          </button>
        ` : `
          <button class="btn-focus-action primary main-action" onclick="startTask('${task.id}')">
            ▶ 開始
          </button>
          <button class="btn-focus-action secondary sub-action" onclick="openEditTaskModal('${task.id}')" title="タスクを編集">
            ⚙️ 編集
          </button>
        `}
        <button class="btn-focus-action obsidian sub-action ${task.obsidianUri ? 'active' : 'disabled'}"
                onclick="${task.obsidianUri ? `openObsidianLink('${safeObsidianUri}', event)` : `openEditTaskModal('${task.id}')`}"
                title="${task.obsidianUri ? 'Obsidianノートを開く: ' + task.obsidianUri : 'Obsidianリンク未設定（クリックして設定）'}">
          <svg class="obsidian-svg-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.5L18 8l-6 3.5L6 8l6-3.5zm-6.5 5.5l5.5 3.2v6.8L5.5 16V10zm13 6l-5.5 3.5v-6.8l5.5-3.2v6.5z"/>
          </svg>
          <span>Obsidian</span>
        </button>
      </div>
    </div>
  `;
}

// =========================================================================
// 3. Live Timers Update
// =========================================================================

function updateLiveTimers() {
  // 1. Live update for Habit Cards (All Views)
  if (typeof state !== 'undefined' && state.habits && Array.isArray(state.habits)) {
    state.habits.forEach(h => {
      if (h.status === 'in_progress' && h.startTimestamp) {
        const curElapsedSec = Math.max(0, Math.floor((Date.now() - h.startTimestamp) / 1000));
        const curElapsedMin = Math.floor(curElapsedSec / 60);
        const estInfo = (typeof getEstimatedDuration === 'function') 
          ? getEstimatedDuration(h, 'habit') 
          : { targetMin: h.targetMin || 30 };

        const cardTimerEl = document.getElementById(`habit-timer-${h.id}`);
        if (cardTimerEl) {
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
  }

  // 2. Live update for Section Banners (Section View & Daily View)
  if (typeof getSectionTimeProgress === 'function' && typeof SECTIONS_CONFIG !== 'undefined') {
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

    document.querySelectorAll('#view-all .section-group').forEach(group => {
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

  if (typeof state === 'undefined' || !state || state.currentMode !== 'focus') return;

  // 3. Live update for Tasks in Focus View
  if (state.tasks && Array.isArray(state.tasks)) {
    const activeTasks = state.tasks.filter(t => t.status === 'in_progress' && t.startTimestamp);
    activeTasks.forEach(task => {
      const estInfo = (typeof getEstimatedDuration === 'function') 
        ? getEstimatedDuration(task, 'task') 
        : { targetMin: task.estMin || 30 };
      const targetMin = estInfo.targetMin;
      const pastSec = task.accumulatedSeconds || (task.actMin ? task.actMin * 60 : 0);
      const curSec = Math.max(0, Math.floor((Date.now() - task.startTimestamp) / 1000));
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

      // Target by specific task id
      const timerEl = document.getElementById(`focus-task-live-timer-${task.id}`) || document.getElementById('focus-task-live-timer');
      if (timerEl) timerEl.innerHTML = `● 経過: <b>${elapsedFormatted}</b>`;

      const fillEl = document.getElementById(`focus-task-scale-fill-${task.id}`) || document.getElementById('focus-task-scale-fill');
      if (fillEl) {
        fillEl.style.width = `${progressPercent}%`;
        fillEl.classList.toggle('overtime', isOverTime);
      }

      const percentEl = document.getElementById(`focus-task-scale-percent-${task.id}`) || document.getElementById('focus-task-scale-percent');
      if (percentEl) {
        percentEl.textContent = isOverTime ? `⚠️ 超過: ${overFormatted} (${Math.round((elapsedSec/totalTargetSec)*100)}%)` : `進捗: ${progressPercent}%`;
      }
    });
  }
}

// =========================================================================
// 4. Backward Compatibility Aliases & Guards
// =========================================================================

function isHabitActiveForFocus(habit) {
  // Focus view is purified for task execution only
  return false;
}

function updateLiveFocusProgress() {
  updateLiveTimers();
}
