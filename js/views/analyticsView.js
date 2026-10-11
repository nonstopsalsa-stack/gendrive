/**
 * Gendrive - Analytics View & Time Intersection Radar (Phase 1: v2.0.0)
 * 哲生 (AI Company OS & Personal OS Engine)
 * 
 * 反転生活座標（上＝朝 03:00 〜 下＝夜 24:00/27:00）による
 * SVG タイム・インターセクション・レーダー & キー7分析ボード
 */

(function (global) {
  'use strict';

  // タイムトラベル状態
  let selectedDateOffset = 0; // 0 = 今日, 1 = 昨日, 2 = 一昨日...
  let hoveredTooltipData = null;

  /**
   * 対象日の日付文字列 (YYYY-MM-DD) を取得
   */
  function getTargetDateKey(offset = 0) {
    const dt = new Date();
    dt.setDate(dt.getDate() - offset);
    return dt.toLocaleDateString('sv');
  }

  /**
   * 対象日の表示用ラベル（例: "2026-10-11 (今日・リアルタイム)"）を取得
   */
  function getTargetDateLabel(offset = 0) {
    const dt = new Date();
    dt.setDate(dt.getDate() - offset);
    const dateStr = dt.toLocaleDateString('sv');
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const dayOfWeek = days[dt.getDay()];

    if (offset === 0) {
      return `${dateStr} (${dayOfWeek}) [今日・リアルタイム]`;
    } else if (offset === 1) {
      return `${dateStr} (${dayOfWeek}) [昨日・アーカイブ]`;
    } else if (offset === 2) {
      return `${dateStr} (${dayOfWeek}) [一昨日・アーカイブ]`;
    } else {
      return `${dateStr} (${dayOfWeek}) [${offset}日前・アーカイブ]`;
    }
  }

  /**
   * 前日へタイムトラベル (ArrowLeft)
   */
  function timeTravelPrev() {
    selectedDateOffset++;
    renderAnalyticsView();
  }

  /**
   * 翌日へタイムトラベル (ArrowRight)
   */
  function timeTravelNext() {
    if (selectedDateOffset > 0) {
      selectedDateOffset--;
      renderAnalyticsView();
    }
  }

  /**
   * 今日にリセット
   */
  function resetTimeTravelToToday() {
    selectedDateOffset = 0;
    renderAnalyticsView();
  }

  /**
   * 反転生活座標のY座標（ピクセル）を計算
   * 03:00 = 上端 (0%), 27:00 (翌日03:00) = 下端 (100%)
   * 基準全幅: 24時間スパン
   */
  function calculateYCoord(hoursDec, plotHeight, paddingTop) {
    // 03:00以前（深夜00:00〜02:59）は翌日扱い (24.0〜26.99)
    let h = hoursDec;
    if (h < 3.0) h += 24.0;

    // 比率: (h - 3) / 24
    const ratio = Math.max(0, Math.min(1.0, (h - 3.0) / 24.0));
    return paddingTop + ratio * plotHeight;
  }

  /**
   * 時間の経過のX座標（ピクセル）を計算
   * 03:00 = 左端 (0%), 24:00 = 右端 (100%) [21時間スパン]
   */
  function calculateXCoord(hoursDec, plotWidth, paddingLeft) {
    let h = hoursDec;
    if (h < 3.0) h += 24.0;

    // 03:00 〜 24:00 (21時間)
    const ratio = Math.max(0, Math.min(1.0, (h - 3.0) / 21.0));
    return paddingLeft + ratio * plotWidth;
  }

  /**
   * SVGレーダーチャート本体の生成
   */
  function generateRadarSvgHtml(snapshots, isToday, summary) {
    const svgWidth = 960;
    const svgHeight = 480;
    const padTop = 35;
    const padBottom = 45;
    const padLeft = 75;
    const padRight = 50;

    const plotWidth = svgWidth - padLeft - padRight;
    const plotHeight = svgHeight - padTop - padBottom;

    // タイムボクシング防衛ラインの定義
    const defenseLines = [
      { hours: 12.0, label: '☀️ 昼休憩 (12:00)', color: 'rgba(56, 189, 248, 0.45)', dash: '3,3' },
      { hours: 17.0, label: '🛡️ 神の防衛ライン (17:00)', color: '#f59e0b', dash: '6,4', highlight: true },
      { hours: 21.0, label: '⚠️ 当日死守ライン (21:00)', color: '#ef4444', dash: '6,4', highlight: true },
      { hours: 23.0, label: '🌙 就寝リミット (23:00)', color: '#a855f7', dash: '4,4' },
      { hours: 24.0, label: '🕛 日付変更 (24:00)', color: '#06b6d4', dash: '2,2' }
    ];

    // 横軸の目盛線（時間）
    const xTimeTicks = [3, 6, 9, 12, 15, 17, 18, 21, 24];

    // 縦軸グリッド線の生成
    let gridLinesHtml = '';
    defenseLines.forEach(line => {
      const y = calculateYCoord(line.hours, plotHeight, padTop);
      const isHl = !!line.highlight;
      gridLinesHtml += `
        <line x1="${padLeft}" y1="${y}" x2="${padLeft + plotWidth}" y2="${y}"
          stroke="${line.color}" stroke-width="${isHl ? 1.75 : 1}" stroke-dasharray="${line.dash}" opacity="${isHl ? 0.9 : 0.6}" />
        <text x="${padLeft - 8}" y="${y + 4}" fill="${line.color}" font-size="11" font-weight="${isHl ? 700 : 500}" text-anchor="end" font-family="'JetBrains Mono', monospace">
          ${line.label}
        </text>
      `;
    });

    // 朝03:00の上端目盛
    const yTop = calculateYCoord(3.0, plotHeight, padTop);
    gridLinesHtml += `
      <line x1="${padLeft}" y1="${yTop}" x2="${padLeft + plotWidth}" y2="${yTop}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
      <text x="${padLeft - 8}" y="${yTop + 4}" fill="var(--text-muted)" font-size="11" text-anchor="end" font-family="'JetBrains Mono', monospace">🌅 起床 (03:00)</text>
    `;

    // 横軸（時間経過）の目盛線の生成
    let xTicksHtml = '';
    xTimeTicks.forEach(t => {
      const x = calculateXCoord(t, plotWidth, padLeft);
      const timeLabel = `${String(t % 24).padStart(2, '0')}:00`;
      xTicksHtml += `
        <line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + plotHeight}" stroke="rgba(255,255,255,0.06)" stroke-width="1" stroke-dasharray="2,4" />
        <text x="${x}" y="${padTop + plotHeight + 20}" fill="var(--text-dim)" font-size="11" text-anchor="middle" font-family="'JetBrains Mono', monospace">
          ${timeLabel}
        </text>
      `;
    });

    // スナップショット点列の計算
    const validSnaps = Array.isArray(snapshots) ? snapshots : [];
    
    // スナップショットが0件の場合のモック/プレースホルダー
    if (validSnaps.length === 0) {
      const nowDec = (typeof analyticsService !== 'undefined') ? analyticsService.timeToHourDecimal(new Date(), true) : 9.5;
      validSnaps.push({
        timeStr: (typeof analyticsService !== 'undefined') ? analyticsService.hourDecimalToTime(nowDec) : '09:30',
        hours: nowDec,
        etaHours: Math.min(24.0, nowDec + 4.0),
        etaTimeStr: (typeof analyticsService !== 'undefined') ? analyticsService.hourDecimalToTime(nowDec + 4.0) : '13:30',
        totalRemainingMin: 240,
        completedTaskCount: 0,
        completedHabitCount: 0,
        isAllClear: false
      });
    }

    // 1. 現在時刻ライン (Current Time Line: ネオンシアン)
    // 2. 見込み終了ライン (ETA Line: ネオンオレンジ)
    const currentPoints = [];
    const etaPoints = [];
    let intersectionPoint = null;

    validSnaps.forEach((s, idx) => {
      const cx = calculateXCoord(s.hours, plotWidth, padLeft);
      const cyCurrent = calculateYCoord(s.hours, plotHeight, padTop);
      const cyEta = calculateYCoord(s.etaHours, plotHeight, padTop);

      currentPoints.push({ x: cx, y: cyCurrent, snap: s });
      etaPoints.push({ x: cx, y: cyEta, snap: s });

      // 交差判定（全タスク完了、または cyCurrent >= cyEta）
      if (!intersectionPoint && (s.isAllClear || s.totalRemainingMin === 0 || cyCurrent >= cyEta)) {
        intersectionPoint = {
          x: cx,
          y: cyCurrent,
          timeStr: s.timeStr,
          snap: s
        };
      }
    });

    // 折れ線パス文字列の生成
    const currentPathD = currentPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const etaPathD = etaPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    // 獲得自由時間エリア（Intersectionから24:00までの多角形ハイライト）
    let freeTimeAreaHtml = '';
    if (intersectionPoint) {
      const ix = intersectionPoint.x;
      const iy = intersectionPoint.y;
      const endX = calculateXCoord(24.0, plotWidth, padLeft);
      const y24 = calculateYCoord(24.0, plotHeight, padTop);

      // 交差点 -> 24:00右端 -> 24:00右下 -> 交差点直下
      const polygonPoints = `
        ${ix.toFixed(1)},${iy.toFixed(1)}
        ${endX.toFixed(1)},${iy.toFixed(1)}
        ${endX.toFixed(1)},${y24.toFixed(1)}
        ${ix.toFixed(1)},${y24.toFixed(1)}
      `;

      freeTimeAreaHtml = `
        <polygon points="${polygonPoints}" fill="url(#freeTimeGrad)" opacity="0.65" />
        <line x1="${ix}" y1="${iy}" x2="${endX}" y2="${iy}" stroke="#10b981" stroke-width="2" stroke-dasharray="4,3" />
        <text x="${ix + 12}" y="${iy + 24}" fill="#10b981" font-size="12" font-weight="700" font-family="'JetBrains Mono', monospace">
          🏆 獲得自由時間ゾーン (GOLDEN FREE TIME)
        </text>
      `;
    }

    // 未来予測点線（最後のスナップショット点から最終ETA点へ）
    let futurePredictionHtml = '';
    if (etaPoints.length > 0 && !intersectionPoint) {
      const lastEtaP = etaPoints[etaPoints.length - 1];
      const targetEtaX = calculateXCoord(lastEtaP.snap.etaHours, plotWidth, padLeft);
      const targetEtaY = calculateYCoord(lastEtaP.snap.etaHours, plotHeight, padTop);

      futurePredictionHtml = `
        <line x1="${lastEtaP.x}" y1="${lastEtaP.y}" x2="${targetEtaX}" y2="${targetEtaY}"
          stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,4" opacity="0.8" />
        <circle cx="${targetEtaX}" cy="${targetEtaY}" r="4.5" fill="#f59e0b" filter="url(#glowAmber)" />
        <text x="${targetEtaX + 8}" y="${targetEtaY + 4}" fill="#f59e0b" font-size="11" font-weight="700" font-family="'JetBrains Mono', monospace">
          見込GOAL: ${lastEtaP.snap.etaTimeStr}
        </text>
      `;
    }

    // データポイントドットの生成
    let dotsHtml = '';
    currentPoints.forEach((p, idx) => {
      const isLast = idx === currentPoints.length - 1;
      dotsHtml += `
        <circle cx="${p.x}" cy="${p.y}" r="${isLast ? 6 : 3.5}" fill="#00f2fe" filter="url(#glowCyan)"
          class="radar-dot" data-snap-idx="${idx}" data-type="current" />
      `;
      if (isLast && isToday) {
        // 現在地パルスリング
        dotsHtml += `
          <circle cx="${p.x}" cy="${p.y}" r="11" fill="none" stroke="#00f2fe" stroke-width="1.5" opacity="0.75" class="radar-pulse-ring" />
          <text x="${p.x + 10}" y="${p.y - 10}" fill="#00f2fe" font-size="11" font-weight="700" font-family="'JetBrains Mono', monospace">
            現在地: ${p.snap.timeStr}
          </text>
        `;
      }
    });

    etaPoints.forEach((p, idx) => {
      const isLast = idx === etaPoints.length - 1;
      dotsHtml += `
        <circle cx="${p.x}" cy="${p.y}" r="${isLast ? 6 : 3.5}" fill="#f59e0b" filter="url(#glowAmber)"
          class="radar-dot" data-snap-idx="${idx}" data-type="eta" />
      `;
      if (isLast) {
        dotsHtml += `
          <text x="${p.x + 10}" y="${p.y + 16}" fill="#f59e0b" font-size="11" font-weight="700" font-family="'JetBrains Mono', monospace">
            ETA: ${p.snap.etaTimeStr}
          </text>
        `;
      }
    });

    // 交差点マーカー
    let intersectionMarkerHtml = '';
    if (intersectionPoint) {
      intersectionMarkerHtml = `
        <g class="radar-intersection-group" transform="translate(${intersectionPoint.x}, ${intersectionPoint.y})">
          <circle r="14" fill="rgba(16, 185, 129, 0.3)" filter="url(#glowEmerald)" class="radar-pulse-ring" />
          <circle r="8" fill="#10b981" />
          <circle r="4" fill="#ffffff" />
          <text x="16" y="5" fill="#10b981" font-size="13" font-weight="800" font-family="'JetBrains Mono', monospace">
            ★ ALL CLEAR! (${intersectionPoint.timeStr})
          </text>
        </g>
      `;
    }

    return `
      <svg class="radar-svg-canvas" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="xMidYMid meet">
        <defs>
          <!-- グローフィルター: ネオンシアン -->
          <filter id="glowCyan" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <!-- グローフィルター: ネオンアンバー -->
          <filter id="glowAmber" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <!-- グローフィルター: エメラルド -->
          <filter id="glowEmerald" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <!-- 自由時間グラデーション -->
          <linearGradient id="freeTimeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#10b981" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.15" />
          </linearGradient>
          <!-- 背景グラデーション -->
          <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#090d16" />
            <stop offset="58%" stop-color="#0c1322" />
            <stop offset="100%" stop-color="#140a1c" />
          </linearGradient>
        </defs>

        <!-- 背景エリア -->
        <rect x="${padLeft}" y="${padTop}" width="${plotWidth}" height="${plotHeight}" fill="url(#bgGrad)" rx="8" stroke="rgba(255,255,255,0.08)" />

        <!-- 自由時間獲得ハイライト -->
        ${freeTimeAreaHtml}

        <!-- 目盛線・防衛ライン -->
        ${gridLinesHtml}
        ${xTicksHtml}

        <!-- 未来予測破線 -->
        ${futurePredictionHtml}

        <!-- 2本のライン -->
        <!-- 現在時刻ライン（沈降: シアン） -->
        <path d="${currentPathD}" fill="none" stroke="#00f2fe" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowCyan)" />

        <!-- 見込み終了ライン（浮上: アンバー） -->
        <path d="${etaPathD}" fill="none" stroke="#f59e0b" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#glowAmber)" />

        <!-- データ点 -->
        ${dotsHtml}

        <!-- 交差点マーカー -->
        ${intersectionMarkerHtml}
      </svg>
    `;
  }

  /**
   * 分析ビュー全体の描画
   */
  function renderAnalyticsView() {
    const container = document.getElementById('view-analytics');
    if (!container) return;

    const isToday = (selectedDateOffset === 0);
    const targetDateKey = getTargetDateKey(selectedDateOffset);
    const dateLabel = getTargetDateLabel(selectedDateOffset);

    // アーカイブまたは今日のスナップショット取得
    let dayData = null;
    if (typeof analyticsService !== 'undefined') {
      dayData = analyticsService.getArchiveForDate(targetDateKey);
    }

    const snapshots = dayData ? (dayData.snapshots || []) : [];
    const summary = dayData ? (dayData.summary || dayData.finalSummary || {}) : {};

    // 最新のスナップショット
    const latestSnap = (snapshots.length > 0) ? snapshots[snapshots.length - 1] : null;

    // HUD サマリーバッジの値
    const remainCount = latestSnap ? ((latestSnap.taskRemainingCount || 0) + (latestSnap.habitRemainingCount || 0)) : 0;
    const remainMin = latestSnap ? (latestSnap.totalRemainingMin || 0) : 0;
    const etaStr = latestSnap ? (latestSnap.etaTimeStr || '--:--') : '--:--';
    const isAllClear = latestSnap ? !!latestSnap.isAllClear : false;

    // 17:00ライン防衛状況
    let defense17Text = '計算中';
    let defense17Class = '';
    if (latestSnap) {
      if (isAllClear) {
        defense17Text = '🎉 ALL CLEAR! 完全防衛';
        defense17Class = 'status-safe';
      } else {
        const etaH = latestSnap.etaHours;
        const diffHours = Math.round((etaH - 17.0) * 10) / 10;
        if (diffHours <= 0) {
          defense17Text = `🛡️ 防衛圏内 (17:00まで ${Math.abs(diffHours)}h余裕)`;
          defense17Class = 'status-safe';
        } else {
          defense17Text = `⚠️ 17:00超過 (+${diffHours}h オーバー)`;
          defense17Class = 'status-warning';
        }
      }
    }

    // 自由時間見込み
    const savedHours = summary.savedFreeHours || (latestSnap && isAllClear ? Math.max(0, Math.round((24.0 - latestSnap.hours) * 10) / 10) : 0);

    // HTMLの構築
    container.innerHTML = `
      <div class="analytics-view-wrapper">
        <!-- 1. Header & Navigation HUD -->
        <header class="analytics-header">
          <div class="analytics-header-left">
            <div class="analytics-title-group">
              <span class="analytics-icon">📈</span>
              <div class="analytics-title-texts">
                <h2 class="analytics-title">TIME INTERSECTION RADAR</h2>
                <span class="analytics-subtitle">リアルタイム戦況 & 反転生活座標レーダー (v2.0)</span>
              </div>
            </div>
          </div>

          <!-- Date Selector (Time Travel Controls) -->
          <div class="analytics-date-selector">
            <button type="button" class="btn-time-travel" id="btn-tt-prev" onclick="analyticsView.timeTravelPrev()" title="前日へ (←)">
              ◀ 前日 <span class="kbd-sub">←</span>
            </button>
            <div class="time-travel-badge ${isToday ? 'live-today' : 'past-archive'}" id="analytics-date-label">
              <span class="tt-dot"></span>
              <span class="tt-date-text">📅 ${dateLabel}</span>
            </div>
            <button type="button" class="btn-time-travel ${selectedDateOffset === 0 ? 'disabled' : ''}" id="btn-tt-next" onclick="analyticsView.timeTravelNext()" title="翌日へ (→)">
              翌日 ▶ <span class="kbd-sub">→</span>
            </button>
            ${!isToday ? `
              <button type="button" class="btn-tt-reset" onclick="analyticsView.resetTimeTravelToToday()" title="今日に戻る (0 / Home)">
                ⚡ 今日へ戻る
              </button>
            ` : ''}
          </div>

          <div class="analytics-header-right">
            <button type="button" class="btn-analytics-close" onclick="setMode(state.previousMode || 'section')" title="閉じる (7 / Esc)">
              ✕ 閉じる <span class="kbd-sub">7</span>
            </button>
          </div>
        </header>

        <!-- 2. Battle Status HUD Cards -->
        <div class="analytics-hud-row">
          <div class="analytics-hud-card">
            <div class="hud-card-icon">🎯</div>
            <div class="hud-card-body">
              <span class="hud-card-label">残りタスク & ハビット</span>
              <div class="hud-card-value">
                <b>${remainCount}</b> <span class="hud-unit">件</span>
                <span class="hud-sub-val">(${remainMin}分)</span>
              </div>
            </div>
          </div>

          <div class="analytics-hud-card">
            <div class="hud-card-icon">⏱️</div>
            <div class="hud-card-body">
              <span class="hud-card-label">最新見込み終了時刻 (ETA)</span>
              <div class="hud-card-value eta-val ${isAllClear ? 'all-clear' : ''}">
                <b>${etaStr}</b>
              </div>
            </div>
          </div>

          <div class="analytics-hud-card ${defense17Class}">
            <div class="hud-card-icon">🛡️</div>
            <div class="hud-card-body">
              <span class="hud-card-label">17:00 神の防衛ライン状況</span>
              <div class="hud-card-value status-text">
                <b>${defense17Text}</b>
              </div>
            </div>
          </div>

          <div class="analytics-hud-card">
            <div class="hud-card-icon">🏆</div>
            <div class="hud-card-body">
              <span class="hud-card-label">獲得自由時間 (自由枠)</span>
              <div class="hud-card-value gold-val">
                <b>${savedHours > 0 ? `+${savedHours}` : '0'}</b> <span class="hud-unit">時間</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Main SVG Radar Stage -->
        <div class="analytics-radar-stage">
          <div class="radar-legend-bar">
            <div class="legend-item">
              <span class="legend-line line-current"></span>
              <span class="legend-text">現在時刻ライン (朝から夜へ沈降)</span>
            </div>
            <div class="legend-item">
              <span class="legend-line line-eta"></span>
              <span class="legend-text">終了見込みライン (タスク完了で浮上)</span>
            </div>
            <div class="legend-item">
              <span class="legend-badge badge-free-time"></span>
              <span class="legend-text">交差点 = 激突GOAL (ALL CLEAR / 自由時間獲得)</span>
            </div>
          </div>

          <div class="radar-canvas-container" id="radar-canvas-container">
            ${generateRadarSvgHtml(snapshots, isToday, summary)}
          </div>
        </div>

        <!-- 4. Footer Tactical Advice & Metrics -->
        <footer class="analytics-footer">
          <div class="tactical-advice-box">
            <span class="advice-icon">💡</span>
            <div class="advice-content">
              <b>戦術アドバイス:</b>
              ${isAllClear 
                ? '今日の全タスク・ハビット撃破達成！ここからの時間は完全にあなたが勝ち取った黄金の自由時間です。お疲れ様でした！'
                : 'タスクを1つ消化するたびに、終了ラインが下から上へカクンと浮上します。現在時刻と終了ラインがガチャンと激突した瞬間、完全クリアとなります！'}
            </div>
          </div>
          <div class="radar-quick-shortcuts">
            <span class="hint-key"><kbd>7</kbd> 作業画面 ⇄ 分析トグル</span>
            <span class="hint-key"><kbd>←</kbd> / <kbd>→</kbd> 過去日タイムトラベル</span>
            <span class="hint-key"><kbd>Esc</kbd> 戻る</span>
          </div>
        </footer>
      </div>
    `;
  }

  // 公開インターフェース
  const analyticsView = {
    renderAnalyticsView,
    timeTravelPrev,
    timeTravelNext,
    resetTimeTravelToToday,
    calculateYCoord,
    calculateXCoord,
    generateRadarSvgHtml
  };

  global.analyticsView = analyticsView;
  global.renderAnalyticsView = renderAnalyticsView;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = analyticsView;
  }
})(typeof window !== 'undefined' ? window : globalThis);
