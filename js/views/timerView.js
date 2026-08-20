/**
 * Gendrive - Timer & Cockpit Engine (Persistent Background & Multi-Mode)
 * 哲生 (AI Company OS & Personal OS Engine)
 * 
 * Features:
 * 1. Default Idle State (Ready to Launch via 0~9 / clicks)
 * 2. Background Persistence across all views (1~5) with accurate alarm audio
 * 3. Pomodoro Multi-Stage Engine (25m Work ⇄ 5m Movement/Breath ⇄ 15m Long Break)
 * 4. Quick Timers (1m, 3m, 5m, 8m, 10m, 15m, 30m, 60m)
 * 5. Custom Timer (1~999m)
 * 6. Direct Stop & Reset to Idle State
 * 7. Web Audio API Zero-Latency Synthesizer
 */

const POMODORO_CYCLE = [
  { type: 'work', durationMin: 25, title: '全集中', icon: '🔥', sub: 'ゾーンに入り、目の前の1点に全神経を注ぎ込め', theme: 'theme-work', set: 1 },
  { type: 'short_break', durationMin: 5, title: '体を動かして 呼吸を数えて', icon: '🌿', sub: '立ち上がり、背筋を伸ばし、深く息を吐き切れ', theme: 'theme-breathe', set: 1 },
  { type: 'work', durationMin: 25, title: '全集中', icon: '🔥', sub: 'ゾーンに入り、目の前の1点に全神経を注ぎ込め', theme: 'theme-work', set: 2 },
  { type: 'short_break', durationMin: 5, title: '体を動かして 呼吸を数えて', icon: '🌿', sub: '立ち上がり、背筋を伸ばし、深く息を吐き切れ', theme: 'theme-breathe', set: 2 },
  { type: 'work', durationMin: 25, title: '全集中', icon: '🔥', sub: 'ゾーンに入り、目の前の1点に全神経を注ぎ込め', theme: 'theme-work', set: 3 },
  { type: 'short_break', durationMin: 5, title: '体を動かして 呼吸を数えて', icon: '🌿', sub: '立ち上がり、背筋を伸ばし、深く息を吐き切れ', theme: 'theme-breathe', set: 3 },
  { type: 'work', durationMin: 25, title: '全集中', icon: '🔥', sub: 'ゾーンに入り、目の前の1点に全神経を注ぎ込め', theme: 'theme-work', set: 4 },
  { type: 'long_break', durationMin: 15, title: '休憩', icon: '☕', sub: '勝利の4セット達成。完全な脱力と脳のクールダウン', theme: 'theme-rest', set: 4 }
];

const timerState = {
  activeTimerId: null, // null (Idle) | 'pomodoro' | 1 | 3 | 5 | 8 | 10 | 15 | 30 | 60 | 'custom'
  mode: null,          // 'pomodoro' | 'quick' | 'custom' | null
  quickMinutes: 15,
  customMinutes: 20,
  pomodoroIndex: 0,
  targetDurationSec: 0,
  elapsedSec: 0,
  isRunning: false,
  startTimestamp: null,
  accumulatedMs: 0
};

// =========================================================================
// 1. Web Audio API Chime & Alarm Sound Synthesizer
// =========================================================================

function playTimerAlarmSound(style = 'finish') {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    if (style === 'work_end' || style === 'finish') {
      // 4-Tone Heroic Major Gong (ド・ソ・高音ド・ミ)
      const tones = [523.25, 783.99, 1046.50, 1318.51];
      tones.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.14);
        
        gain.gain.setValueAtTime(0.001, now + i * 0.14);
        gain.gain.exponentialRampToValueAtTime(0.4, now + i * 0.14 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.9);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.14);
        osc.stop(now + i * 0.14 + 0.95);
      });
    } else if (style === 'break_end') {
      // Refreshing Triple Bell Chime
      [880, 1174.66, 1760].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);
        
        gain.gain.setValueAtTime(0.3, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.7);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.75);
      });
    }
  } catch (e) {
    console.warn('AudioContext playback error (user interaction may be required):', e);
  }
}

// =========================================================================
// 2. Timer Life-Cycle & Control Functions
// =========================================================================

function renderTimerView() {
  updateTimerCockpitUI();
  updateDeckSelectionUI();
}

function startPresetTimer(presetKey) {
  if (presetKey === 'pomodoro' || presetKey === 0) {
    timerState.activeTimerId = 'pomodoro';
    timerState.mode = 'pomodoro';
    const stage = POMODORO_CYCLE[timerState.pomodoroIndex];
    timerState.targetDurationSec = stage.durationMin * 60;
  } else if (typeof presetKey === 'number') {
    timerState.activeTimerId = presetKey;
    timerState.mode = 'quick';
    timerState.quickMinutes = presetKey;
    timerState.targetDurationSec = presetKey * 60;
  }

  resetTimerTime();
  startActiveTimer();
  renderTimerView();
}

function startCustomTimer() {
  const input = document.getElementById('custom-timer-minutes');
  let mins = 20;
  if (input) {
    mins = Math.max(1, Math.min(999, parseInt(input.value, 10) || 20));
  }
  timerState.activeTimerId = 'custom';
  timerState.mode = 'custom';
  timerState.customMinutes = mins;
  timerState.targetDurationSec = mins * 60;

  resetTimerTime();
  startActiveTimer();
  renderTimerView();
}

function startActiveTimer() {
  if (timerState.isRunning) return;
  timerState.isRunning = true;
  timerState.startTimestamp = Date.now();

  updateTimerCockpitUI();
}

function pauseActiveTimer() {
  if (!timerState.isRunning) return;
  timerState.isRunning = false;

  if (timerState.startTimestamp) {
    timerState.accumulatedMs += Date.now() - timerState.startTimestamp;
  }
  timerState.startTimestamp = null;

  updateTimerCockpitUI();
}

function toggleActiveTimer() {
  if (timerState.activeTimerId === null) {
    // If in idle state, start default Pomodoro
    startPresetTimer('pomodoro');
    return;
  }

  if (timerState.isRunning) {
    pauseActiveTimer();
  } else {
    // If completed, restart
    if (timerState.elapsedSec >= timerState.targetDurationSec) {
      resetTimerTime();
    }
    startActiveTimer();
  }
}

function resetActiveTimer() {
  pauseActiveTimer();
  resetTimerTime();
  updateTimerCockpitUI();
}

function stopAndResetToIdle() {
  pauseActiveTimer();
  resetTimerTime();
  timerState.activeTimerId = null;
  timerState.mode = null;
  renderTimerView();
}

function resetTimerTime() {
  timerState.accumulatedMs = 0;
  timerState.startTimestamp = timerState.isRunning ? Date.now() : null;
  timerState.elapsedSec = 0;
}

function skipActiveTimerStep() {
  if (timerState.mode !== 'pomodoro') return;
  
  pauseActiveTimer();
  timerState.pomodoroIndex = (timerState.pomodoroIndex + 1) % POMODORO_CYCLE.length;
  const stage = POMODORO_CYCLE[timerState.pomodoroIndex];
  timerState.targetDurationSec = stage.durationMin * 60;

  resetTimerTime();
  startActiveTimer();
  renderTimerView();
}

// Floating Top Neon Alert System
function showTimerFinishAlert(title, subtitle, icon = '⏱️', theme = 'theme-work') {
  const alertEl = document.getElementById('timer-finish-alert');
  if (!alertEl) return;

  const iconEl = document.getElementById('timer-alert-icon');
  const titleEl = document.getElementById('timer-alert-title');
  const subEl = document.getElementById('timer-alert-sub');

  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.textContent = title;
  if (subEl) subEl.textContent = subtitle;

  alertEl.className = `timer-finish-alert active ${theme}`;

  // Auto dismiss after 6 seconds
  if (window._timerAlertTimeout) clearTimeout(window._timerAlertTimeout);
  window._timerAlertTimeout = setTimeout(() => {
    dismissTimerAlert();
  }, 6000);
}

function dismissTimerAlert() {
  const alertEl = document.getElementById('timer-finish-alert');
  if (alertEl) alertEl.classList.remove('active');
}

// Global Background Loop (Runs continuously even on other views!)
function tickActiveTimerGlobal() {
  if (!timerState.isRunning) return;

  let totalMs = timerState.accumulatedMs;
  if (timerState.startTimestamp) {
    totalMs += Date.now() - timerState.startTimestamp;
  }

  const elapsedSeconds = Math.floor(totalMs / 1000);
  timerState.elapsedSec = elapsedSeconds;

  if (elapsedSeconds >= timerState.targetDurationSec) {
    // Timer Finished!
    pauseActiveTimer();
    timerState.elapsedSec = timerState.targetDurationSec;

    // Trigger Alarm & Sound (Works across all screens!)
    const isPomodoro = timerState.mode === 'pomodoro';
    const curStage = isPomodoro ? POMODORO_CYCLE[timerState.pomodoroIndex] : null;
    const isPomodoroWork = isPomodoro && curStage.type === 'work';
    playTimerAlarmSound(isPomodoroWork ? 'work_end' : 'finish');

    // Trigger Floating Neon Alert on Top of Screen (Visible on ALL 1~5 views!)
    if (isPomodoro) {
      if (curStage.type === 'work') {
        showTimerFinishAlert('🔥 全集中セッション完了！', `Set ${curStage.set}/4 達成！立ち上がって体を動かしましょう (5分休憩)`, '🔥', 'theme-work');
      } else if (curStage.type === 'short_break') {
        showTimerFinishAlert('🌿 呼吸・リフレッシュ完了！', `呼吸と身体が整いました。次の全集中へ突入します (Set ${curStage.set + 1 <= 4 ? curStage.set + 1 : 1})`, '🌿', 'theme-breathe');
      } else if (curStage.type === 'long_break') {
        showTimerFinishAlert('☕ 4セット完全達成・休憩完了！', '勝利のサイクル達成！最高の集中力を発揮しました', '☕', 'theme-rest');
      }
    } else if (timerState.mode === 'custom') {
      showTimerFinishAlert(`⚙️ ${timerState.customMinutes}分タイマー タイムアップ！`, '設定した集中時間が完了しました。作業を区切りましょう', '⚙️', 'theme-quick');
    } else {
      showTimerFinishAlert(`⚡ ${timerState.quickMinutes}分タイマー タイムアップ！`, 'クイック集中セッションが完了しました！', '⚡', 'theme-quick');
    }

    if (typeof showUndoToast === 'function') {
      const finishName = isPomodoro 
        ? `ポモドーロ [${curStage.title}]`
        : (timerState.mode === 'custom' ? `${timerState.customMinutes}分タイマー` : `${timerState.quickMinutes}分タイマー`);
      showUndoToast(`⏱️ ${finishName} が完了しました！🎉`);
    }

    // Auto-advance pomodoro stage if in pomodoro mode
    if (isPomodoro) {
      setTimeout(() => {
        timerState.pomodoroIndex = (timerState.pomodoroIndex + 1) % POMODORO_CYCLE.length;
        const nextStage = POMODORO_CYCLE[timerState.pomodoroIndex];
        timerState.targetDurationSec = nextStage.durationMin * 60;
        resetTimerTime();
        if (typeof state !== 'undefined' && state && state.currentMode === 'timer') {
          renderTimerView();
        }
      }, 1200);
    } else {
      if (typeof state !== 'undefined' && state && state.currentMode === 'timer') {
        renderTimerView();
      }
    }
    return;
  }

  // If Timer view is currently visible, update live UI
  if (typeof state !== 'undefined' && state && state.currentMode === 'timer') {
    updateTimerCockpitUI(totalMs);
  }
}

// Start persistent global timer interval (100ms precision)
setInterval(tickActiveTimerGlobal, 100);

// =========================================================================
// 3. UI Rendering & Cockpit Updates
// =========================================================================

function updateTimerCockpitUI(totalMs = null) {
  const idleStageEl = document.getElementById('timer-idle-stage');
  const cockpitStageEl = document.getElementById('timer-cockpit-stage');
  if (!idleStageEl || !cockpitStageEl) return;

  // 1. If in Idle State (No timer active)
  if (timerState.activeTimerId === null) {
    idleStageEl.classList.remove('hidden');
    cockpitStageEl.classList.add('hidden');
    return;
  }

  // 2. Active Timer Running / Paused
  idleStageEl.classList.add('hidden');
  cockpitStageEl.classList.remove('hidden');

  let currentTitle = 'タイマー';
  let currentIcon = '⏱️';
  let currentSub = '目標時間を意識し、スピード集中を実行';
  let currentTheme = 'theme-work';
  let typeBadgeText = '⏱️ クイックタイマー';
  let setBadgeText = '';
  const isPomodoro = timerState.mode === 'pomodoro';

  if (isPomodoro) {
    const stage = POMODORO_CYCLE[timerState.pomodoroIndex];
    currentTitle = stage.title;
    currentIcon = stage.icon;
    currentSub = stage.sub;
    currentTheme = stage.theme;
    typeBadgeText = `🍅 ポモドーロ [${stage.durationMin}分]`;
    setBadgeText = `Set ${stage.set} / 4 (${stage.type === 'work' ? 'ワーク' : (stage.type === 'long_break' ? 'ロング休憩' : 'ショート休憩')})`;
  } else if (timerState.mode === 'quick') {
    currentTitle = `${timerState.quickMinutes}分タイマー`;
    currentIcon = '⚡';
    currentSub = '限界突破・今すぐタスクに着手して完了させろ';
    currentTheme = 'theme-quick';
    typeBadgeText = `⚡ ${timerState.quickMinutes}分 クイックタイマー`;
    setBadgeText = `即時着火モード`;
  } else if (timerState.mode === 'custom') {
    currentTitle = `${timerState.customMinutes}分 時間設定タイマー`;
    currentIcon = '⚙️';
    currentSub = 'カスタム設定時間で完全集中';
    currentTheme = 'theme-custom';
    typeBadgeText = `⚙️ カスタム ${timerState.customMinutes}分`;
    setBadgeText = `自由設定モード`;
  }

  // Update theme class on stage
  cockpitStageEl.className = `timer-cockpit-stage ${currentTheme} ${timerState.isRunning ? 'is-running' : 'is-paused'}`;

  // Badges
  const typeBadgeEl = document.getElementById('timer-active-type-badge');
  if (typeBadgeEl) typeBadgeEl.textContent = typeBadgeText;

  const setBadgeEl = document.getElementById('timer-active-set-badge');
  if (setBadgeEl) setBadgeEl.textContent = setBadgeText;

  // State Banner
  const titleEl = document.getElementById('timer-state-title');
  if (titleEl) titleEl.textContent = currentTitle;

  const iconEl = document.getElementById('timer-state-icon');
  if (iconEl) iconEl.textContent = currentIcon;

  const subEl = document.getElementById('timer-state-sub');
  if (subEl) subEl.textContent = currentSub;

  // Digits Display (Remaining Time Countdown)
  const remainSec = Math.max(0, timerState.targetDurationSec - timerState.elapsedSec);
  const remainMin = Math.floor(remainSec / 60);
  const remainSecRem = remainSec % 60;
  const digitsStr = `${String(remainMin).padStart(2, '0')}:${String(remainSecRem).padStart(2, '0')}`;

  const digitsEl = document.getElementById('timer-display-digits');
  if (digitsEl) digitsEl.textContent = digitsStr;

  // Fraction ms display
  const msEl = document.getElementById('timer-display-ms');
  if (msEl) {
    if (totalMs !== null && timerState.isRunning) {
      const fraction = Math.floor((totalMs % 1000) / 10);
      msEl.textContent = `.${String(fraction).padStart(2, '0')}`;
    } else {
      msEl.textContent = '.00';
    }
  }

  // Progress Scale
  const pct = timerState.targetDurationSec > 0 
    ? Math.min(100, Math.round((timerState.elapsedSec / timerState.targetDurationSec) * 100))
    : 0;

  const scaleFill = document.getElementById('timer-scale-fill');
  if (scaleFill) {
    scaleFill.style.width = `${pct}%`;
  }

  const elapsedMin = Math.floor(timerState.elapsedSec / 60);
  const elapsedSecRem = timerState.elapsedSec % 60;
  const elapsedStr = `${String(elapsedMin).padStart(2, '0')}:${String(elapsedSecRem).padStart(2, '0')}`;

  const scaleElapsed = document.getElementById('timer-scale-elapsed');
  if (scaleElapsed) scaleElapsed.textContent = `経過: ${elapsedStr}`;

  const scalePct = document.getElementById('timer-scale-percent');
  if (scalePct) scalePct.textContent = `進捗: ${pct}%`;

  const scaleRemain = document.getElementById('timer-scale-remain');
  if (scaleRemain) scaleRemain.textContent = `残り: ${digitsStr}`;

  // Toggle button label
  const toggleLabel = document.getElementById('timer-toggle-label');
  const toggleIcon = document.getElementById('timer-toggle-icon');
  if (toggleLabel && toggleIcon) {
    if (timerState.isRunning) {
      toggleIcon.textContent = '⏸️';
      toggleLabel.textContent = '一時停止';
    } else {
      toggleIcon.textContent = '▶';
      toggleLabel.textContent = timerState.elapsedSec > 0 ? '再開' : 'スタート';
    }
  }

  // Skip button: Only visible for Pomodoro!
  const skipBtn = document.getElementById('btn-timer-skip');
  if (skipBtn) {
    skipBtn.classList.toggle('hidden', !isPomodoro);
  }
}

function updateDeckSelectionUI() {
  document.querySelectorAll('.timer-deck-card').forEach(card => card.classList.remove('active-preset'));

  if (timerState.activeTimerId === 'pomodoro') {
    const el = document.getElementById('deck-card-0');
    if (el) el.classList.add('active-preset');
  } else if (timerState.mode === 'quick' && typeof timerState.activeTimerId === 'number') {
    const minsToId = { 1: 1, 3: 2, 5: 3, 8: 4, 10: 5, 15: 6, 30: 7, 60: 8 };
    const cardId = minsToId[timerState.activeTimerId];
    if (cardId !== undefined) {
      const el = document.getElementById(`deck-card-${cardId}`);
      if (el) el.classList.add('active-preset');
    }
  } else if (timerState.activeTimerId === 'custom') {
    const el = document.getElementById('deck-card-9');
    if (el) el.classList.add('active-preset');
  }
}
