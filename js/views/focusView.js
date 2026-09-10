/**
 * Gendrive - Focus Mode (Adaptive Focus Board: 1 -> 2 -> 3 Display Loop)
 * with 8:2 Hybrid Task Sampling Engine (80% Hierarchy Priority x 20% Random Exploration)
 * 哲生 (AI Company OS & Personal OS Engine)
 */

// =========================================================================
// 0. Soul Quotes Master (哲生の魂を揺さぶる言葉・ADHD着火エンジン)
// =========================================================================
const SOUL_QUOTES = [
  "自分の価値は自分で決める・常にMAXのパフォーマンスで生きろ",
  "自分が決めたことだからこそやり抜ける",
  "精神論こそ全て！目標への覚悟を圧倒的な行動で示せ",
  "条件が揃うのを待つな",
  "願った瞬間に夢は叶っている・迷いを捨てて前進せよ",
  "俺はできるって信じる！ 君も信じるか？ やるんだよ！ できっこないをやらなくちゃ！",
  "それくらいの感じで生きろ！「俺やばい」と。「周りはまだ知らないだけだ」と。「俺の価値は俺が一番知っている」って、毎日興奮して生きてたら、常にMAXのパフォーマンスで生きられるから。それでええねん！",
  "一番最初に君の価値を評価するのは、君自身なんだよ。それを忘れなければ、社内だろが、パラレルワーカーだろが、起業家だろが関係ない！ ロケット飛ばそうが何しようが、今のアナタに一番コミットメントが高ければ周りは関係ない！",
  "私たちが頑張れない理由は、自分で決めていない時だ。自分が決めたことは、自分が決めた分だけ私たちはやれる",
  "人の言われたことができなくたって、あなたの価値は変わらない。でも、自分で決めたことは守りませんか？他人との約束が守れなくても、自分の言葉を聞きましょう。自分自身が求めている通りに生きましょう。",
  "自分が自分の主人公であるとハッキリと認識せよ",
  "目標に至るまでの決意を行動で示せ、そして、その行動に伴う苦痛を歓迎しろ",
  "圧倒的な自分への自信を持ち、その自信の根拠を積み上げろ",
  "精神論が全てだ！ 小細工なテクニックはどこぞのちんけな本から学ぶがいい、持つべきはど真ん中にあるべき精神論だ！",
  "精神論で負けている人間にビジネスなどできるはずがない！ どの教材を見ても、どの本を読んでも、どのサロンにはいっても稼げることなどない  なぜなら、魂が弱いからだ！",
  "誇りある生き方を取り戻したいのなら、見たくない現実を見なければならない。深い傷を負った格好で前に進まなければならない！ 戦うということはそういうことだ！ 愚痴なら墓場で言えばいい！",
  "金が全てではない？金だよ！ お前が相手に一矢報い、意地を見せつける方法は、奪われたものと踏みにじられた尊厳にふさわしい対価を勝ち取ることだけなんだ！ それ以外にないんだ！",
  "見たいなりたい夢がある、なりたい姿があったら、過去の自分や現在の自分を切り離せ、実績ゼロ、スキルゼロ！それでも動け、それだからこそ動け",
  "条件が揃ってから動くんじゃ、人生終わってしまう！ やりたいと思ったら動け",
  "自分を使い切れ  いっぱいいっぱいなんか存在しない",
  "人間の願望は、思った時もうすでに叶ってる、あとは淡々とそれをクリアしていくだけ、現実化していくだけ",
  "「どうやってモチベーション上げますか？」って聞かれるけど、本音を言えばモチベーション上がらないって意味が分からない。信じてないからですよ！",
  "もう叶ってることをやるのに、なんでモチベーションが必要なんですか？ 叶ってるんですよ。目の前にご飯があって、あと食べるだけです。",
  "現実なんか見ちゃダメなんです！ 未来しか見ちゃダメなんです！",
  "あきらめそうになった時、心が折れそうな時、強さを見失いそうになっても、挑戦する勇気を持っていることを忘れないでいて",
  "ファイト！ 負けるな！ あきらめずに立ち上がれ！ 未来の君は強く偉大なんだ。自分を超えていけ！",
  "誰かの言葉で傷ついたり、失敗して落ち込んだり、自分の弱さに悩んでも、挑戦する勇気を持っていることを忘れないでいて",
  "日が昇る前の暗闇でも、星は輝いている。前を向いて。見たい景色はそこにあるから、挑戦しろ！",
  "大丈夫だ。だから止まらないで。世界でたった一人の自分を信じて。ファイト！ 負けるな！ 自分を超えていけ！",
  "頑張りますからね！ 頑張るしかないんですから！",
  "誰も期待していないくらいがちょうどいいのさ。ここにいる意味を刻み込む。何度倒れても！",
  "まだやれるさ！ 立ち上がれ！ 焼き尽くせ命の火を！ どこまでも行ける、君が望むのならば！",
  "叶うと信じるところから夢は始まるのだろう！",
  "這い上がれよ何度でも！ 誰かの期待を裏切るくらいが良い！ 生きていく意味を作り出す、失うものは何もない！",
  "ほんとはどうしたい？     人生には期限があるがまだ間に合う。本当は家の扉を開けた瞬間に走り出していたあの頃みたいに、やりたいことが山ほどあるはずだ。あの頃の俺が持っていたエンジンを自分の手で再起動しろ。",
  "初めてマーシャルにケーブルを挿した瞬間を思い出せ！俺にはまだやらなきゃいけないことがたくさんあるだろ、ゾーンにはいった爆発力、絶対にやりとげる粘り腰、そのふたつをとりもどして全部奪いにいけ。",
  "俺は本来飲み込みが早く、技術を誰よりも速く習得し、人よりもずっと前に進める人間だった。一晩で12曲マスターしてライブもできた。壊れたんじゃない。今はその条件が揃えられず本来のパワーがまだ出切っていないだけ。",
  "AIと動画を武器に家族を安心させ、子供たちに「少しずつ景色が良くなる人生」を見せるんだろ、10代のお前がそうしてもらったように。",
  "未来の俺はほんの200m先にいる。今日はそこへたった1cm近づく",
  "1cmなら何からやる？ほんの少しでいい、やれ、ケーブルを挿してOpen Eコードをかきならせ。",
  "お前の力をみせつけて明日の朝にはみんなを驚かしてやろうや！",
  "「最後までやり切ること」 「途中で諦めないこと」 「他のものに浮気しないこと」",
  "✨️ALL-INタスクに食らいついて離すな！✨️",
  "35歳になって、好きなことやって、家庭壊して、ひとりぼっちで格闘技やって、どうだお前ら羨ましいだろ！！俺はな、俺はな、こうやってな、明日もコツコツ生きていくんだよ",
  "最初にカエルを食べて気持ちよくなれ",
  "最優先タスク以外全て後退",
  "お前は周回遅れだろ、、どこを見てるんだ？目をそらすな",
  "もう3学期だぞ、お前は夏休みの宿題まだやってない、間に合うからやれ、ひとつづつでいい",
  "君ではダメだといわれてしまったか、君じゃない人のほうがいいとあきらめられたか、そんな言葉をほんとうだと思うのか、まだやれるのにチキショーと叫ぶ心はあるか",
  "立ち上がれその心よ、焼き尽くせ命の火を、どこまでもいけるよ君が望むのならば",
  "なにもかも叶えにいこう そしてまた笑い合おう",
  "数え切れぬ悲しみと数え切れぬ過ちとやりきれぬほどの悔しさを飲み干して這い上がれ",
  "心も体も売り渡せ  金があればいい",
  "価値がある俺は1日、1時間、1分を粗末にしない、1日1日を 丁寧に生きるという覚悟がある",
  "お前の心の中には常に2匹の狼がいる、とても怠け者でいつ も自分が頑張れないことを何かのせいにし て不平不満ばかり言っている狼、自分の可能 性を信じ誰に何と言われようと 自分の決めた目標を 真面目にクリアしていく狼、その狼はどっちが勝つ？お前はどっちの狼に餌をやる？",
  "夢には値段、値札がある、それをどうやって払うのか それは 自分の 努力の量で払うしかない 大きな夢を描き 大きな値札を見たのであれば 君はその値札に見合う 努力をするしかないんだ",
  "能力不足という言い訳の全ては努力不足、行動不足、覚悟不足",
  "ビジネスの序盤はすべて苦しい、そして伸びが全く自覚できない時間が長い、そんな中その暗いトンネルを突破する力は 一体何か、要領の良さではない 忍耐力だ、忍び耐えるという 忍耐力だけが、あなたを夢に近づける、才能じゃない忍耐したのだ、圧倒的孤独と苦痛に耐え忍んだ というただそれだけがその人を成功者たらしめている",
  "決して才能だと言うな決して要領だと言うなその成功者が成功者たりえているのはとてつもない忍耐力で 地獄の縁を這いずりまわったからである",
  "自信を持ちたければ 自分を信じさせる根拠を見せつけろ",
  "鳥は風の強い時に巣を作る、その方が強い巣が出来るから、自信を保ちたければ自分が乗らないときにそれでも目標遂行し たという1日があなたの自信を作りだす",
  "サボったのではないミスをしただけ、計画が失敗したんではないミスをしただけ、1個ミスったけど このミスはどうすれば再発が防げるん だろう　と少しの間考えて再挑戦、秒速でリエントリーする",
  "あなたの物語の責任を負っている のはあなたただ一人、あなたは絶対にダメな人間じゃない、再挑戦が続く限り再挑戦し続けている限りは あなたは敗者ではなく 挑戦者だ、挑戦者である ことを止めるな",
  "最も残酷で最も優しい結論、ただ行動せよ、ただ努力せよ、ただ手をとめるな、それだけでよい"
];

let currentSoulQuote = '';

function pickNextSoulQuote() {
  if (!SOUL_QUOTES || SOUL_QUOTES.length === 0) return '';
  let nextIdx = Math.floor(Math.random() * SOUL_QUOTES.length);
  if (SOUL_QUOTES.length > 1 && SOUL_QUOTES[nextIdx] === currentSoulQuote) {
    nextIdx = (nextIdx + 1) % SOUL_QUOTES.length;
  }
  currentSoulQuote = SOUL_QUOTES[nextIdx];
  return currentSoulQuote;
}

// =========================================================================
// 1. Task Priority Weight Scoring Engine (User Specified Hierarchy)
// =========================================================================

/**
 * 優先要素の厳格な階層重み付け:
 * 1. アイゼンハワー -> ALL-IN (task.label === 'iron_rule') : +1000pt
 * 2. アイゼンハワー -> カエル (task.label === 'frog0' / task.frog >= 4) : +500pt
 * 3. 緊急度が高い (urgency === 'high' / '高') : +250pt
 * 4. 重要度が高い (importance === 'high' / '高') : +120pt
 * 5. 現在のセクションのタスク (task.section === currentSection) : +60pt
 * 最低保証ベーススコア: +10pt (全未完了タスクに選出確率を付与)
 */
function computeTaskPriorityScore(task) {
  if (!task) return 10;
  let score = 10;

  // 1. アイゼンハワー -> ALL-IN
  const isAllIn = task.label === 'iron_rule' || task.eisenhower === 'iron_rule';
  if (isAllIn) score += 1000;

  // 2. アイゼンハワー -> カエル
  const isFrog = task.label === 'frog0' || 
                 task.eisenhower === 'frog0' || 
                 Number(task.frog) >= 4 || 
                 (task.matrix && (task.matrix.frogLevel === 'high' || task.matrix.frog === 'high'));
  if (isFrog) score += 500;

  // 3. 緊急度が高い
  const isUrgent = task.urgency === 'high' || 
                   task.urgency === '高' || 
                   (task.matrix && task.matrix.urgency === 'high') ||
                   task.label === 'p1' || task.label === 'p3';
  if (isUrgent) score += 250;

  // 4. 重要度が高い
  const isImportant = task.importance === 'high' || 
                      task.importance === '高' || 
                      (task.matrix && task.matrix.importance === 'high') ||
                      task.label === 'p1' || task.label === 'p2';
  if (isImportant) score += 120;

  // 5. 現在のセクションのタスク
  const currentSec = (typeof state !== 'undefined' && state.currentSection) ? state.currentSection : '';
  const isCurrentSec = currentSec && task.section && (
    task.section === currentSec || 
    (typeof normalizeSectionName === 'function' && normalizeSectionName(task.section) === normalizeSectionName(currentSec))
  );
  if (isCurrentSec) score += 60;

  return score;
}

// =========================================================================
// 2. 8:2 Hybrid Task Sampling Algorithm (80% Priority / 20% Random)
// =========================================================================

function sampleFocusTasks(pool, count) {
  if (!pool || pool.length === 0) return [];
  if (pool.length <= count) return [...pool];

  const scoredPool = pool.map(task => ({
    task: task,
    score: computeTaskPriorityScore(task)
  }));

  const selectedTasks = [];
  const remaining = [...scoredPool];

  for (let slot = 0; slot < count; slot++) {
    if (remaining.length === 0) break;

    // 80%の確率で本命（重みサンプリング）、20%の確率で完全ランダム
    const isPriorityPick = Math.random() < 0.8;
    let pickedTask = null;

    if (isPriorityPick) {
      // 重み付き確率ルーレットサンプリング
      const totalScore = remaining.reduce((sum, item) => sum + item.score, 0);
      let randVal = Math.random() * totalScore;
      for (let i = 0; i < remaining.length; i++) {
        randVal -= remaining[i].score;
        if (randVal <= 0 || i === remaining.length - 1) {
          pickedTask = remaining[i].task;
          remaining.splice(i, 1);
          break;
        }
      }
    } else {
      // 20%枠: 残りプールから一様ランダム選出（思わぬ掘り出し物）
      const randIdx = Math.floor(Math.random() * remaining.length);
      pickedTask = remaining[randIdx].task;
      remaining.splice(randIdx, 1);
    }

    if (pickedTask) {
      selectedTasks.push(pickedTask);
    }
  }

  return selectedTasks;
}

// =========================================================================
// 3. Render Focus View
// =========================================================================

let currentSampledTasks = [];
let lastSampledCount = 0;

function renderFocusView(forceResample = false) {
  const container = document.getElementById('focus-cards-container') || document.getElementById('focus-task-card-container');
  if (!container) return;

  const currentCount = state.focusCount || 1;

  // 1. Update Top Bar Pill Buttons (if visible)
  document.querySelectorAll('#focus-count-selector .focus-count-btn').forEach(btn => {
    const btnCount = parseInt(btn.dataset.count, 10);
    btn.classList.toggle('active', btnCount === currentCount);
  });

  // 2. Filter Active Uncompleted Tasks for Selected Date
  const activeTodayTasks = state.tasks.filter(t => 
    isTaskForSelectedDate(t) && 
    t.status !== 'completed' && 
    t.status !== 'skipped' && 
    matchesTagFilters(t)
  );

  // 3. Update Container Classes for Grid Layout
  container.className = `focus-cards-container count-${currentCount}`;

  // 4. Update Hyper-Focus Mindset Banner
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

  // 5. If No Tasks Left
  if (activeTodayTasks.length === 0) {
    currentSampledTasks = [];
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
    renderSoulQuoteBanner();
    return;
  }

  // 6. Sample Tasks with 8:2 Hybrid Engine
  const activeIds = new Set(activeTodayTasks.map(t => String(t.id)));
  const hasInvalidTask = currentSampledTasks.some(t => !activeIds.has(String(t.id)));

  if (forceResample || lastSampledCount !== currentCount || currentSampledTasks.length === 0 || hasInvalidTask) {
    currentSampledTasks = sampleFocusTasks(activeTodayTasks, currentCount);
    lastSampledCount = currentCount;
  }

  // 7. Update Counter & Page Indicator
  const counterText = (currentCount === 1)
    ? `1 / ${activeTodayTasks.length}`
    : `${Math.min(currentCount, currentSampledTasks.length)} / ${activeTodayTasks.length}`;

  const counterEl = document.getElementById('focus-task-counter');
  if (counterEl) counterEl.textContent = counterText;

  const pageIndicator = document.getElementById('focus-page-indicator');
  if (pageIndicator) pageIndicator.textContent = counterText;

  // 8. Render Task Focus Cards
  container.innerHTML = currentSampledTasks.map((task, index) => {
    return renderTaskFocusCard(task, index, currentCount);
  }).join('');

  // 9. Render Soul Quote Banner (Philosophical Fire for ADHD Hyper-Focus)
  renderSoulQuoteBanner();
}

function renderSoulQuoteBanner() {
  const quoteContainer = document.getElementById('focus-soul-quote-container');
  const quoteTextEl = document.getElementById('focus-soul-quote-text');
  if (quoteContainer && quoteTextEl) {
    if (!currentSoulQuote) {
      pickNextSoulQuote();
    }
    quoteTextEl.textContent = currentSoulQuote;
    quoteContainer.style.display = 'flex';
  }
}

// =========================================================================
// 4. Render Single Focus Card
// =========================================================================

function renderTaskFocusCard(task, rankIndex, totalFocusCount) {
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
// 5. Live Timers Update
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
// 6. Backward Compatibility Aliases & Guards
// =========================================================================

function isHabitActiveForFocus(habit) {
  return false;
}

function updateLiveFocusProgress() {
  updateLiveTimers();
}
