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

  let filteredTasks = [];

  if (state.currentBucketFilter && state.currentBucketFilter.type === 'bucket') {
    const bId = state.currentBucketFilter.id;
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
    filteredTasks = state.tasks.filter(t => t.bucket === bId);

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
    filteredTasks = state.tasks.filter(t => t.label === lId);
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

  container.innerHTML = filteredTasks.map(renderTaskCardHtml).join('');
}
