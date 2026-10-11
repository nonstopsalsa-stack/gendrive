/**
 * Gendrive - Analytics & Radar Service (Phase 1: v2.0.0)
 * 哲生 (AI Company OS & Personal OS Engine)
 * 
 * リアルタイムスナップショット記録 & 日次アーカイブ蓄積エンジン
 * タイム・インターセクション・レーダー用の時系列データパイプライン
 */

(function (global) {
  'use strict';

  // ストレージキー定義（未定義時のフォールバック）
  const ARCHIVE_STORAGE_KEY = (typeof STORAGE_KEYS !== 'undefined' && STORAGE_KEYS.ANALYTICS_ARCHIVE)
    ? STORAGE_KEYS.ANALYTICS_ARCHIVE
    : 'gendrive_analytics_archive_v1';

  const TODAY_STORAGE_KEY = (typeof STORAGE_KEYS !== 'undefined' && STORAGE_KEYS.TODAY_SNAPSHOTS)
    ? STORAGE_KEYS.TODAY_SNAPSHOTS
    : 'gendrive_today_snapshots_v1';

  // 10分インターバル (600,000ms)
  const SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000;

  let lastSnapshotTimestamp = 0;
  let intervalTimerId = null;

  /**
   * Dateオブジェクトまたは "HH:mm" 文字列を小数時間（例: 09:30 -> 9.5）に変換
   * 深夜（00:00〜02:59）は翌日扱い（24.0〜26.99）として24を加算可能
   */
  function timeToHourDecimal(dateOrStr, handleLateNight = true) {
    if (!dateOrStr) return 0;

    let h = 0;
    let m = 0;

    if (dateOrStr instanceof Date) {
      h = dateOrStr.getHours();
      m = dateOrStr.getMinutes();
    } else if (typeof dateOrStr === 'string') {
      const clean = dateOrStr.replace(/^翌\s*/, '').trim();
      const parts = clean.split(':');
      if (parts.length >= 2) {
        h = parseInt(parts[0], 10) || 0;
        m = parseInt(parts[1], 10) || 0;
      }
    } else if (typeof dateOrStr === 'number') {
      return dateOrStr;
    }

    let dec = h + (m / 60);
    // 深夜 00:00 〜 02:59 は生活サイクル上、前日夜の続き（24:00〜26:59）として扱う
    if (handleLateNight && dec < 3.0) {
      dec += 24.0;
    }
    return Math.round(dec * 100) / 100;
  }

  /**
   * 小数時間（例: 9.5 -> "09:30", 25.5 -> "翌 01:30"）を "HH:mm" 文字列に変換
   */
  function hourDecimalToTime(hoursDec) {
    if (typeof hoursDec !== 'number' || isNaN(hoursDec)) return '--:--';

    let isNextDay = false;
    let adjusted = hoursDec;
    if (adjusted >= 24.0) {
      isNextDay = true;
      adjusted -= 24.0;
    }

    const totalMinutes = Math.round(adjusted * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;

    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return isNextDay ? `翌 ${timeStr}` : timeStr;
  }

  /**
   * 今日の日付キー (YYYY-MM-DD) を取得
   */
  function getTodayKeyStr() {
    if (typeof getTodayKey === 'function') {
      return getTodayKey();
    }
    return new Date().toLocaleDateString('sv');
  }

  /**
   * 今日のスナップショット一覧を取得
   */
  function getTodaySnapshots() {
    try {
      const raw = localStorage.getItem(TODAY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (parsed && parsed.dateKey === getTodayKeyStr() && Array.isArray(parsed.snapshots)) {
        return parsed.snapshots;
      }
      return [];
    } catch (e) {
      console.warn('[AnalyticsService] Failed to parse today snapshots:', e);
      return [];
    }
  }

  /**
   * 今日のスナップショット一覧を保存
   */
  function saveTodaySnapshots(snapshots) {
    try {
      const payload = {
        dateKey: getTodayKeyStr(),
        updatedAt: new Date().toISOString(),
        snapshots: snapshots || []
      };
      localStorage.setItem(TODAY_STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error('[AnalyticsService] Failed to save today snapshots:', e);
    }
  }

  /**
   * 全過去アーカイブを取得（遅延ロード）
   */
  function getAllArchives() {
    try {
      const raw = localStorage.getItem(ARCHIVE_STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) || {};
    } catch (e) {
      console.warn('[AnalyticsService] Failed to load archives:', e);
      return {};
    }
  }

  /**
   * 全過去アーカイブを保存
   */
  function saveAllArchives(archives) {
    try {
      localStorage.setItem(ARCHIVE_STORAGE_KEY, JSON.stringify(archives || {}));
    } catch (e) {
      console.error('[AnalyticsService] Failed to save archives:', e);
    }
  }

  /**
   * 特定日付のアーカイブを取得（今日なら今日のスナップショット、過去日ならアーカイブから）
   */
  function getArchiveForDate(dateKey) {
    const today = getTodayKeyStr();
    if (dateKey === today) {
      const snaps = getTodaySnapshots();
      return {
        dateKey: today,
        snapshots: snaps,
        isToday: true,
        summary: calculateSummaryFromSnapshots(snaps)
      };
    }

    const archives = getAllArchives();
    if (archives[dateKey]) {
      return {
        ...archives[dateKey],
        isToday: false
      };
    }

    return null;
  }

  /**
   * 特定日付のアーカイブを保存
   */
  function saveDailyArchive(dateKey, dayData) {
    if (!dateKey) return;
    const archives = getAllArchives();
    archives[dateKey] = dayData;
    saveAllArchives(archives);
  }

  /**
   * スナップショット配列からサマリーを計算
   */
  function calculateSummaryFromSnapshots(snapshots) {
    if (!Array.isArray(snapshots) || snapshots.length === 0) {
      return {
        totalCompleted: 0,
        totalRemaining: 0,
        allClearTime: null,
        savedFreeHours: 0,
        firstEtaHours: null,
        lastEtaHours: null
      };
    }

    const lastSnap = snapshots[snapshots.length - 1];
    const firstSnap = snapshots[0];

    // 全タスク完了（All Clear）した最初のスナップショットを探す
    const allClearSnap = snapshots.find(s => s.isAllClear || s.totalRemainingMin === 0);

    let savedFreeHours = 0;
    if (allClearSnap) {
      // 24:00 (または当日死守21:00/就寝23:00) までの余白時間
      const finishHours = allClearSnap.hours;
      savedFreeHours = Math.max(0, Math.round((24.0 - finishHours) * 10) / 10);
    }

    return {
      totalCompleted: (lastSnap.completedTaskCount || 0) + (lastSnap.completedHabitCount || 0),
      totalRemaining: lastSnap.totalRemainingMin || 0,
      allClearTime: allClearSnap ? allClearSnap.timeStr : null,
      savedFreeHours: savedFreeHours,
      firstEtaHours: firstSnap ? firstSnap.etaHours : null,
      lastEtaHours: lastSnap ? lastSnap.etaHours : null
    };
  }

  /**
   * 日跨ぎ時に前日分のスナップショットをアーカイブに確定保存する
   */
  function checkAndRollOverDay(currentDateKey) {
    try {
      const raw = localStorage.getItem(TODAY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.dateKey && parsed.dateKey !== currentDateKey) {
        // 前日のデータが存在する場合、アーカイブに移動
        const prevDateKey = parsed.dateKey;
        const prevSnapshots = parsed.snapshots || [];
        if (prevSnapshots.length > 0) {
          const summary = calculateSummaryFromSnapshots(prevSnapshots);
          saveDailyArchive(prevDateKey, {
            dateKey: prevDateKey,
            snapshots: prevSnapshots,
            finalSummary: summary,
            archivedAt: new Date().toISOString()
          });
          console.log(`[AnalyticsService] Successfully rolled over archive for ${prevDateKey} (${prevSnapshots.length} snapshots)`);
        }
        // 今日のスナップショットストレージを初期化
        localStorage.removeItem(TODAY_STORAGE_KEY);
      }
    } catch (e) {
      console.error('[AnalyticsService] Error during day roll-over:', e);
    }
  }

  /**
   * リアルタイムスナップショットを記録する
   * @param {boolean} force - trueなら10分のスロットリングを無視して強制記録（タスク完了時等）
   */
  function recordSnapshot(force = false) {
    const now = new Date();
    const nowMs = now.getTime();

    // スロットリング: force でない場合は前回収集から10分未満ならスキップ
    if (!force && lastSnapshotTimestamp > 0 && (nowMs - lastSnapshotTimestamp) < SNAPSHOT_INTERVAL_MS) {
      return null;
    }

    const todayKey = getTodayKeyStr();
    checkAndRollOverDay(todayKey);

    // 1. 現在時刻情報
    const h = now.getHours();
    const m = now.getMinutes();
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const hours = timeToHourDecimal(now, true);

    // 2. ETA & 残りタスク情報の収集
    let dayEtaInfo = null;
    if (typeof getDayEta === 'function') {
      try {
        dayEtaInfo = getDayEta(now);
      } catch (err) {
        console.warn('[AnalyticsService] getDayEta failed:', err);
      }
    }

    const taskRemainingMin = dayEtaInfo ? (dayEtaInfo.dayTaskRemainMin || 0) : 0;
    const habitRemainingMin = dayEtaInfo ? (dayEtaInfo.dayHabitRemainMin || 0) : 0;
    const totalRemainingMin = dayEtaInfo ? (dayEtaInfo.totalDayRemainMin || 0) : 0;
    const taskRemainingCount = dayEtaInfo ? (dayEtaInfo.dayTaskRemainCount || 0) : 0;
    const habitRemainingCount = dayEtaInfo ? (dayEtaInfo.dayHabitRemainCount || 0) : 0;
    const completedTaskCount = dayEtaInfo ? (dayEtaInfo.dayTaskDoneCount || 0) : 0;
    const completedHabitCount = dayEtaInfo ? (dayEtaInfo.dayHabitDoneCount || 0) : 0;
    const isAchieved = dayEtaInfo ? !!dayEtaInfo.isAchieved : (totalRemainingMin === 0 && (completedTaskCount + completedHabitCount) > 0);

    let etaHours = hours;
    let etaTimeStr = timeStr;

    if (dayEtaInfo && dayEtaInfo.dayEtaDate instanceof Date) {
      etaHours = timeToHourDecimal(dayEtaInfo.dayEtaDate, true);
      etaTimeStr = dayEtaInfo.dayEtaTimeStr || hourDecimalToTime(etaHours);
    } else if (isAchieved) {
      etaHours = hours;
      etaTimeStr = 'ALL CLEAR!';
    } else {
      // フォールバック: 現在時刻 + 残り分数
      const fallbackEtaDate = new Date(nowMs + totalRemainingMin * 60000);
      etaHours = timeToHourDecimal(fallbackEtaDate, true);
      etaTimeStr = hourDecimalToTime(etaHours);
    }

    const snapshot = {
      timestamp: nowMs,
      timeStr: timeStr,
      hours: hours,
      taskRemainingMin: taskRemainingMin,
      habitRemainingMin: habitRemainingMin,
      totalRemainingMin: totalRemainingMin,
      etaHours: etaHours,
      etaTimeStr: etaTimeStr,
      taskRemainingCount: taskRemainingCount,
      habitRemainingCount: habitRemainingCount,
      completedTaskCount: completedTaskCount,
      completedHabitCount: completedHabitCount,
      isAllClear: isAchieved
    };

    // 3. 今日のスナップショット一覧に追加
    const existingSnapshots = getTodaySnapshots();

    // 重複防止: 直前のスナップショットと全く同じ分かつ同じ残分の場合は更新
    if (existingSnapshots.length > 0) {
      const last = existingSnapshots[existingSnapshots.length - 1];
      if (last.timeStr === snapshot.timeStr) {
        existingSnapshots[existingSnapshots.length - 1] = snapshot;
      } else {
        existingSnapshots.push(snapshot);
      }
    } else {
      existingSnapshots.push(snapshot);
    }

    saveTodaySnapshots(existingSnapshots);
    lastSnapshotTimestamp = nowMs;

    // もし現在分析ビューが表示中ならリアルタイム再描画
    if (typeof state !== 'undefined' && state && state.currentMode === 'analytics') {
      if (typeof renderAnalyticsView === 'function') {
        renderAnalyticsView();
      }
    }

    return snapshot;
  }

  /**
   * サービス初期化
   */
  function initAnalyticsService() {
    const todayKey = getTodayKeyStr();
    checkAndRollOverDay(todayKey);

    // 初回スナップショットを即座に記録
    recordSnapshot(true);

    // 10分ごとの定期記録タイマーを起動
    if (intervalTimerId) {
      clearInterval(intervalTimerId);
    }
    intervalTimerId = setInterval(() => {
      recordSnapshot(false);
    }, SNAPSHOT_INTERVAL_MS);
  }

  // 公開インターフェース
  const analyticsService = {
    initAnalyticsService,
    recordSnapshot,
    getTodaySnapshots,
    saveTodaySnapshots,
    getArchiveForDate,
    saveDailyArchive,
    getAllArchives,
    saveAllArchives,
    calculateSummaryFromSnapshots,
    timeToHourDecimal,
    hourDecimalToTime
  };

  global.analyticsService = analyticsService;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = analyticsService;
  }
})(typeof window !== 'undefined' ? window : globalThis);
