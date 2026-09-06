# CHANGELOG - Gendrive

All notable changes to Gendrive project will be documented in this file.

---

## [v1.5.3] - 2026-09-06
### Fixed
- **Mobile Task Interruption & Resumption Lifecycle**: `mobile.js` 内のタスク中断・再開ライフサイクルを完全刷新。中断（`paused`）後の「▶ 再開」が何度でも確実に動作する状態遷移マシンを確立。
- **Multi-Paused Retention**: 複数の中断中タスク・ハビットをリスト内に安全に維持し、各カード上からワンタップで再開可能に改善。
- **Sticky Active Bar Priority Routing**: 実行中（`in_progress`）アイテムを最優先でトップバーにピン留め表示し、ハビットとタスクの表示競合による描画ロストを根絶。
- **Storage Key Alignment**: モバイル版のタスクキーをPC版と同一の `habit_flow_tasks_v3` に正常化（旧キーからの自動移行コード付き）。
- **Event Propagation Guard**: カード内アクションボタンに `event.stopPropagation()` を配置し二重発火・誤作動を排除。
- **Release Notes**: `docs/release_notes/2026-09-06_v1.5.3_mobile_task_resume_lifecycle_engine.md` を発行。

---

## [v1.5.2] - 2026-09-06
### Fixed
- **Mobile Task Interruption & Resumption Crash**: `mobile.js` に `pauseTask()` ハンドラを新規実装し、上部固定バーおよびカードからのタスク中断時のクラッシュを根本解消。
- **Habit Pause Sticky Retention**: ハビット中断時に `activeHabitId` が破棄される不具合を修正。中断中も「⏸️ PAUSED」バッジ付きでピン留めを維持しワンタップ再開可能に。
- **Auto-Pause Engine**: タスク/ハビットの相互開始時に先行タスクを自動中断（PAUSED）へ移行し、累積秒数（`accumulatedSeconds`）を非破壊的に記録・保持。
- **Type-Safe ID Matcher & Service Worker v152**: 文字列/数値型ID不一致による探索失敗を排除。PWAキャッシュを `gendrive-lite-v152` に更新。
- **Release Notes**: `docs/release_notes/2026-09-06_v1.5.2_mobile_task_habit_pause_resume_engine.md` を発行。

---

## [v1.5.1] - 2026-09-06
### Fixed
- **Daily Status Isolation**: 前日に完了した定期タスク（Recurring Task）や1回ハビットが翌朝「完了」として引き継がれてしまう問題を根本修正。当日の実行履歴（history / executionLogs）に基づく厳格な判定を確立。
- **Auto-Cleanup Sanitizer**: アプリ起動時に当日履歴のない完了済み定期タスク・ハビットを自動で検出し安全にリセットする `sanitizeDailyState()` エンジンを搭載。
- **Release Notes**: `docs/release_notes/2026-09-06_v1.5.1_daily_isolation_and_recurring_cleanup.md` 発行および `v1.5.0` リリースノートの全面改定。

---

## [v1.5.0] - 2026-09-06
### Added
- **TaskChute Dynamic ETA Badge Unification**: 今日全体・セクション・デイリー・マスターの全画面で上下2段組デザイン（🏁 予定終了時刻 / ⏱️ 予定総時間・残タスク数）に統一。
- **Real-time Overdue Alert**: 現在時刻が予定終了時刻を超過した場合にネオンクリムゾン（赤色発光）でアラート表示。
- **Task Resume Memo Engine**: タスク中断時の白紙メモ自動起動、再開時の自動ポップアップ、タスクカード上の `📝 再開メモ` チップ表示、タスク完了時の自動消去。
- **Release Notes**: `docs/release_notes/2026-09-06_v1.5.0_unified_taskchute_eta_and_resume_memo.md` 発行。

### Changed
- `js/services/taskTimerService.js`: 手動中断（pauseTask）、自動中断（Auto-pause）、再開（startTask）、完了（completeTask）に再開メモフックを統合。
- `js/components/cardRenderers.js`: 実行中タスクカードに「⏸️ 中断」ボタンを追加。
- `mobile.html` & `sw.js`: バージョンカプセルバッジ（v1.5.0）およびキャッシュバスター更新。

---

## [v1.4.0] - 2026-09-02
### Added
- **Vision 2x2 Panorama**: ビジョン画面の2x2パノラマ大刷新。
- **Soul Declaration 2-Column**: 魂の宣言 2カラム段組み表示。
- **Preset Task Drag & Drop Engine**: プリセットタスクのドラッグ＆ドロップ並び替え対応。

---

## [v1.3.0] - 2026-08-31
### Added
- **Mobile Sticky Active Bar**: スマホ版上部3段固定レイアウト＆実行中タスクのスティッキー表示。
- **1-Line Compact Header**: 1行スマートヘッダー。
- **Smart Pause & Resume**: スマホ版でのスマート中断・再開管理。

---

## [v1.2.5] - 2026-08-30
### Fixed
- **Inbox Sync Isolation**: Inbox同期の完全分離。
- **Mobile Multi-Count Habit UI**: スマホ版での複数回ハビットカウントUI修正。

---

## [v1.2.0] - 2026-08-30
### Added
- **Mobile Multi-Count Habits**: 1日N回ハビットの段階的消化＆リアルタイム進捗トラッキング。

---

## [v1.1.0] - 2026-08-30
### Added
- **Carryover Dual Routing**: キャリーオーバー2分岐（現セクション / Inbox一括移動）。
- **Clean Past View**: 過去日の定期タスク非表示＆残存タスク即時把握。

---

## [v1.0.0] - 2026-08-29
### Added
- **Personal Action Engine Initial Release**: 個人用行動管理エンジン正式統合版。
- **Dynamic Version Badge & Release Notes**: バージョン表示およびリリースノート機能導入。
