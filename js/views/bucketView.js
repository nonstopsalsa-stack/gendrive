/**
 * Gendrive - Bucket / Category / Label View Renderer
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 1. Render Bucket / Label View (Inbox, This Week, Next Week, Genius, Someday, Vault, Labels)
// =========================================================================

function renderBucketView() {
  const container = document.getElementById('bucket-task-list');
  const titleEl = document.getElementById('bucket-view-title');
  const descEl = document.getElementById('bucket-view-desc');
  const cleanupBanner = document.getElementById('bucket-cleanup-banner');

  let filteredTasks = [];
  let isGtdBucket = false;
  let currentBucketId = null;

  if (state.currentBucketFilter && state.currentBucketFilter.type === 'bucket') {
    isGtdBucket = true;
    const bId = state.currentBucketFilter.id;
    currentBucketId = bId;
    const bucketInfo = {
      inbox: { title: '📥 Inbox 一覧', desc: '思いついたタスクを即時投入・一時保管する場所（D&Dで整理可能）' },
      this_week: { title: '📅 今週やるタスク', desc: '上位計画からブレイクダウンされた今週のタスク（朝に順算でTodayへアサイン）' },
      next_week: { title: '🗓️ 来週やるタスク', desc: '過集中（ゾーン状態）時のバッファ＆来週の待機タスク' },
      genius: { title: '💡 Recent Genius Ideas (天才の閃き)', desc: '「俺サイコー！」と思えるワクワクタスク。モチベ低下時のドーパミン着火剤！' },
      someday: { title: '⏳ Someday (いつかやる)', desc: 'いつかやりたいアイデアの保管庫' },
      vault: { title: '🗄️ Vault (隔離・削除許容セーフティネット)', desc: '視界から外して心を軽くする場所。安心してタスク削除を自分に許すための箱。' }
    };
    const info = bucketInfo[bId] || { title: '箱の一覧', desc: '' };
    titleEl.textContent = info.title;
    descEl.textContent = info.desc;
    // GTDバケツ内は純粋な単発タスクのみ（ハビットや定期クローンは除外）
    filteredTasks = state.tasks.filter(t => t.bucket === bId && !t.isDisabled && !t.isRecurringInstance);

  } else if (state.currentBucketFilter && state.currentBucketFilter.type === 'label') {
    const lId = state.currentBucketFilter.id;
    const labelInfo = {
      iron_rule: { title: '🔥 ALL - IN (センターピンタスク)', desc: '目標や数字達成のセンターピン。何があってもやり抜く最重要コミットメント！' },
      frog0: { title: '🐸 第0 (カエル × 重要)', desc: 'もっともやりたくないが超重要。終われば心が劇的に軽くなる！' },
      p1: { title: '💼 第1 (重要 × 緊急)', desc: '当面の稼ぎ・収益に直結するビジネスタスク' },
      p2: { title: '🌱 第2 (重要 × 非緊急)', desc: '計画・仕組み化・学習など将来の稼ぎにつながるタスク' },
      p3: { title: '🧺 第3 (非重要 × 緊急)', desc: '家事・育児・日常の雑務' },
      p4: { title: '🎮 第4 (非重要 × 非緊急)', desc: '趣味・娯楽・リラックス' }
    };
    const info = labelInfo[lId] || { title: 'ラベル別一覧', desc: '' };
    titleEl.textContent = info.title;
    descEl.textContent = info.desc;
    filteredTasks = state.tasks.filter(t => t.label === lId && !t.isDisabled && !t.isRecurringInstance);
  }

  // 完了タスク整理バナーの描画制御 (GTDバケツ表示時のみ)
  if (cleanupBanner) {
    if (isGtdBucket) {
      const completedTasks = filteredTasks.filter(t => t.status === 'completed');
      if (completedTasks.length > 0) {
        cleanupBanner.classList.remove('hidden');
        cleanupBanner.innerHTML = `
          <div class="bucket-cleanup-content">
            <div class="bucket-cleanup-info">
              <span class="cleanup-icon">✅</span>
              <span class="cleanup-text">完了したタスクが <strong>${completedTasks.length}件</strong> あります</span>
              <span class="cleanup-subtext">※箱から外してもマスターボード（台帳）の単発タスク一覧にはそのまま残ります</span>
            </div>
            <button type="button" class="btn-bucket-cleanup" id="btn-bucket-cleanup-action" onclick="removeCompletedTasksFromCurrentBucket()">
              🧹 完了タスクを箱から外す (${completedTasks.length}件)
            </button>
          </div>
        `;
      } else {
        cleanupBanner.classList.add('hidden');
        cleanupBanner.innerHTML = '';
      }
    } else {
      cleanupBanner.classList.add('hidden');
      cleanupBanner.innerHTML = '';
    }
  }

  if (filteredTasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <h3>タスクはありません</h3>
        <p>上部の「➕ この箱にタスク追加」またはドラッグ＆ドロップでタスクを移動できます。</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredTasks.map(renderBucketTaskRowHtml).join('');
}

// バケット専用スリム1列タスク行レンダラー (高さ38px・高密度16+件一覧)
function renderBucketTaskRowHtml(task) {
  const isCompleted = task.status === 'completed';
  const labelBadge = typeof getEisenhowerLabelBadge === 'function' ? getEisenhowerLabelBadge(task.label) : null;
  const tags = typeof normalizeTags === 'function' ? normalizeTags(task.tags) : (task.tags || []);

  let badgeHtml = '';
  if (labelBadge) {
    const isIron = task.label === 'iron_rule';
    badgeHtml += `<span class="bucket-mini-badge eisenhower ${isIron ? 'iron' : ''}">${labelBadge.text}</span>`;
  }
  if (task.frog && task.frog >= 1) {
    badgeHtml += `<span class="bucket-mini-badge frog" title="カエル度: ${task.frog}">🐸${task.frog}</span>`;
  }
  if (task.domainMinor) {
    badgeHtml += `<span class="bucket-mini-badge tag" title="ドメイン: ${task.domainMinor}">${task.domainMinor}</span>`;
  }
  if (tags.length > 0) {
    badgeHtml += tags.slice(0, 2).map(t => `<span class="bucket-mini-badge tag">#${t}</span>`).join('');
  }

  return `
    <div class="bucket-task-row ${isCompleted ? 'completed' : ''}"
         data-id="${task.id}"
         data-type="task"
         draggable="true"
         ondragstart="handleCardDragStart(event, '${task.id}', 'task')"
         ondragover="handleCardDragOver(event, '${task.id}', 'task')"
         ondragleave="handleCardDragLeave(event)"
         ondrop="handleCardDrop(event, '${task.id}', 'task')"
         onclick="openEditTaskModal('${task.id}')"
         title="クリックしてタスクを編集 (右クリックでメニュー)">
      <div class="bucket-row-left">
        <span class="bucket-row-drag" title="ドラッグして移動/並替">⠿</span>
        <button type="button" 
                class="bucket-checkbox ${isCompleted ? 'checked' : ''}" 
                onclick="event.stopPropagation(); toggleBucketTaskComplete('${task.id}')"
                title="${isCompleted ? 'クリックして未完了に戻す' : 'クリックして完了にする'}">
          ${isCompleted ? '✓' : ''}
        </button>
        <span class="bucket-row-title">${task.title || '(無題のタスク)'}</span>
      </div>
      <div class="bucket-row-right" onclick="event.stopPropagation()">
        ${badgeHtml}
        <button type="button" class="btn-bucket-row-action" onclick="openEditTaskModal('${task.id}')" title="設定・編集">⚙️</button>
      </div>
    </div>
  `;
}

// バケット内タスクの完了トグル（音声なし・静かに実行）
function toggleBucketTaskComplete(taskId) {
  const task = (state.tasks || []).find(t => String(t.id) === String(taskId));
  if (!task) return;

  const prevStatus = task.status;
  const isNowCompleted = (prevStatus !== 'completed');

  if (isNowCompleted) {
    task.status = 'completed';
    const now = new Date();
    const dateKey = typeof getSelectedDateKey === 'function' ? getSelectedDateKey() : '';
    if (!task.scheduledDate) {
      task.scheduledDate = dateKey;
    }
    if (!Array.isArray(task.history)) task.history = [];
    task.history.push({
      date: dateKey,
      completedAt: now.toISOString(),
      durationMin: task.actMin || task.estMin || 25
    });
  } else {
    task.status = 'uncompleted';
  }

  saveTasks();

  if (typeof pushUndoAction === 'function') {
    pushUndoAction({
      description: `タスク「${task.title}」を${isNowCompleted ? '完了' : '未完了'}に変更`,
      undo: () => {
        task.status = prevStatus;
        saveTasks();
        renderApp();
      }
    });
  }

  // 音声は一切鳴らさずに静かに再描画
  renderApp();
  if (typeof updateSidebarCounters === 'function') {
    updateSidebarCounters();
  }
}

// 完了タスクを一括で現在のバケツから外す（マスターボードには残る）
function removeCompletedTasksFromCurrentBucket() {
  if (!state.currentBucketFilter || state.currentBucketFilter.type !== 'bucket') return;
  const bId = state.currentBucketFilter.id;
  const completedTasks = state.tasks.filter(t => t.bucket === bId && t.status === 'completed' && !t.isDisabled && !t.isRecurringInstance);
  if (completedTasks.length === 0) return;

  const count = completedTasks.length;
  const prevSnapshot = state.tasks.map(t => ({
    id: t.id,
    bucket: t.bucket,
    scheduledDate: t.scheduledDate
  }));

  // 各完了タスクのバケット属性を解除 (today に戻す、または日付を補完)
  completedTasks.forEach(t => {
    t.bucket = 'today';
    if (!t.scheduledDate) {
      // 完了ログの日付があればそれを、なければ選択中の日付をセット
      const logDate = (t.executionLogs && t.executionLogs[0] && t.executionLogs[0].dateKey)
        || (t.history && t.history[0] && t.history[0].date)
        || getSelectedDateKey();
      t.scheduledDate = logDate;
    }
  });

  saveTasks();

  // Undoアクション登録 (Ctrl+Z で復元可能)
  if (typeof pushUndoAction === 'function') {
    pushUndoAction({
      description: `完了タスク ${count}件 を箱から外しました`,
      undo: () => {
        const undoMap = new Map();
        prevSnapshot.forEach(p => undoMap.set(p.id, p));
        state.tasks.forEach(t => {
          const prev = undoMap.get(t.id);
          if (prev) {
            t.bucket = prev.bucket;
            t.scheduledDate = prev.scheduledDate;
          }
        });
        saveTasks();
        renderApp();
      }
    });
  }

  if (typeof showCarryoverToast === 'function') {
    showCarryoverToast(`完了タスク ${count}件 を箱から外しました（マスターボードに保持）`);
  } else if (typeof showToast === 'function') {
    showToast(`完了タスク ${count}件 を箱から外しました（マスターボードに保持）`);
  }

  renderApp();
  if (typeof updateSidebarCounters === 'function') {
    updateSidebarCounters();
  }
}
