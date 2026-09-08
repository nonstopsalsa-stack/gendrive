# CHANGELOG - Gendrive

All notable changes to Gendrive project will be documented in this file.

## [v1.5.9] - 2026-09-08
### Fixed & Improved
- **Mobile Bottom Navigation Dynamic Badges Engine**: スマホ版（Gendrive Lite）のボトムナビ4ボタン（セクション・デイリー・タスク・ハビット）の残り件数が常に「0」固定となっていた未実装バグを完全解消。選択コンテキストに完全連動するリアルタイム件数計算・DOM更新パイプライン（`updateBottomNavBadges()`）を確立。
- **Bottom Navigation State & Button Active Synchronization**: アプリ起動時およびタブ切り替え時に、内部状態（`activeScope` / `activeType`）とボタンの選択ハイライト（`active` クラス）が食い違い、「タスクボタンが青いのにハビットが表示される」表示ズレを根本解決。起動時の強制同期（`syncBottomNavButtonsUI()`）および不要なスキップガード撤廃を実施。
- **Section Order & Carryover Alignment**: `getSectionOrder()` が英数字ID（`sec_1`〜`sec_6`）および日本語セクション名（朝オペ／夜オペを含む）の両方に完全対応。引数の型不整合によるデフォルト値（4）フォールバックを排除し、過去セクションからの繰越判定が正常化。スマホ版で全セクションの未完タスク（8件）がセクションに合算表示されてデイリーと同じになる不具合を解決。
- **Habit Time-Window Precision & Custom-Time Section Isolation**: `SECTIONS` に時間帯情報（`start`, `end`）を追加し、時間指定ハビット（`custom_time`）がセクション未設定時に `anytime` 扱いとなって全セクションに貫通表示されていたロジックを修正。42件もの習慣が全時間帯に重複表示される現象を完全根絶。
- **Non-blocking Fast Launch & Network Timeout Abort Guard**: Google Apps Script (GAS) 通信に 8秒のタイムアウト（`AbortController`）を新設。起動時の `pullFromCloud` を直列ブロッキングからバックグラウンド非同期実行へ移行し、アプリ起動後0秒でローカルデータ描画＆操作可能（1〜2分の待たされ感を完全撤廃）を実現。
- **Automated Verification Suite (37/37 PASS)**: セクション順序判定、SECTIONS時間定義整合性、時間指定ハビットの窓判定、セクションタスク繰越分離、ボタンアクティブ同期、バッジ更新DOM反映、タイムアウト関数の全37テストを新設し 100% PASS を達成（既存テストと合わせ全119件完全パス）。
- **Release Notes**: `docs/release_notes/2026-09-08_v1.5.9_mobile_realtime_sync_and_navigation_engine_fix.md` を発行。

---

## [v1.5.8] - 2026-09-07
### Added & Improved
- **Food Tag Habit ETA & Count Exclusion Engine**: 「食材」タグ（#食材）が付いたハビットを、純粋なチェック・記録専用ハビット（実質的ハビットトラッカー）として位置づけ、1日全体のセクション・デイリー画面の動的ETA（予定時間の残り時間・終了見込み時刻）およびバッジの未完了件数カウントから完全に除外（B案仕様）。
- **Seamless Reactive Tag Sync**: ハビットへの「食材」タグの付け外し、新規ハビット作成、マスター画面での一括タグ変更が発生した瞬間に、再計算が即座に走り全画面のETAバッジ・残り時間に自動反映されるリアクティブ連動を確立。
- **Defensive Date Input Guard in isTaskForSelectedDate**: `tasks.filter(isTaskForSelectedDate)` 呼び出し時に第2引数として渡される配列インデックス（数値）が誤って日付オブジェクト（new Date(index) ≒ 1970年）として解釈され、2件目以降のタスクが除外されてしまう潜在的な構造欠陥を根本改修。
- **Automated Verification Suite (26/26 PASS)**: 食材タグ判定、全体のセクション動的ETA除外、タグ動的解除・再付与、未来日事前計画モードの全26単体テストケースを新設し 100% PASS を達成（既存テスト56件も全件パス）。
- **Release Notes**: `docs/release_notes/2026-09-07_v1.5.8_food_tag_habit_eta_and_count_exclusion.md` を発行。

---
## [v1.5.7] - 2026-09-07
### Fixed & Improved
- **Preset Task Interrupt Resume Memo Engine**: プリセットタスク（緊急割り込みタスク）起動時において、直後の全モーダル一括クローズ（`closeModal()`）により先行タスクの中断メモ入力モーダルが消滅していた不具合を解消。プリセットモーダルのみを先行クローズし、中断メモモーダル（単独入力／デュアル）を安全に表示・入力可能にするシーケンス制御を確立。
- **Nested Interrupt Context Preservation**: プリセットタスク実行中にさらに別のプリセットタスクを起動する多重割り込みシナリオにおいても、先行タスクの中断メモが安全に保持・記録されるライフサイクルを保証。
- **Automated Verification Suite (56/56 PASS)**: プリセット起動時の先行タスク中断メモ起動、白紙入力保存、アイドル時起動、入れ子起動の全16テストケース（Test 8シリーズ）を追加し、全56テストケースで 100% PASS を達成。
- **Release Notes**: `docs/release_notes/2026-09-07_v1.5.7_preset_task_interrupt_resume_memo_engine.md` を発行。

---

## [v1.5.6] - 2026-09-07
### Added
- **Dual Task Resume Memo Engine**: 実行中タスクがある状態で中断中タスクを再開した際、中断タスクの白紙メモ（次の一手入力）と再開タスクの前回メモ（作業状況確認）を画面中央左右に並列で同時表示するデュアルモーダルを新設。
- **Context Switch Cognitive Acceleration**: モーダル起動時に左側の中断メモ入力欄へ自動フォーカス。右側の前回メモを視界で確認しながら即座に中断メモを打鍵でき、Enter一発で保存・作業開始へシームレスに復帰するゼロ・フリクション設計を実現。
- **Smart Modal State Machine**: 単独中断（入力のみ）、単独再開（閲覧のみ）、デュアル切替（入力＋閲覧並列）を自動判定・描画する状態遷移マシンを `resumeNoteService.js` に確立。
- **Automated Verification Suite (40/40 PASS)**: 単独手動中断、単独再開、自動中断、デュアル並列展開、左右データ分離保存、空保存、タスク完了時消去の全40テストケースを網羅する自動ヘッドレステストを構築し 100% PASS を達成。
- **Release Notes**: `docs/release_notes/2026-09-07_v1.5.6_dual_task_resume_memo_engine.md` を発行。

---

## [v1.5.5] - 2026-09-07
### Fixed
- **Task Tag Filter Pipeline Integrity**: セクションビュー（`sectionView.js`）およびデイリータイムラインビュー（`allView.js`）において、タスクフィルター内のステータス肯定早期リターン（`return true`）により後続のタグ判定が短絡・スキップされていた不具合を是正。否定早期除外（`return false`）方式へ統一し、スマートタグの 3-Way トグル（Include / Exclude / Reset）がすべてのタスクビューで確実に連動するパイプラインを確立。
- **Compound Filter Harmonization**: ステータスフィルター（未完了/完了）とドメイン・部門・PJ・タグフィルターの複合絞り込みが正常に AND 条件で機能するよう改善。
- **Automated Verification Suite**: Anytimeブロック、セクションビュー、デイリーセクション分割、デイリーフラット、スマートタグサイクルの全16単体テストケースを導入し 100% PASS を達成。
- **Release Notes**: `docs/release_notes/2026-09-07_v1.5.5_task_tag_filter_pipeline_integrity.md` を発行。

---

## [v1.5.4] - 2026-09-07
### Fixed
- **Multi-Count Habit Lifecycle Restoration**: 「1日N回（`daily_times`）」ハビットが1回で完了・非表示になってしまう不具合を根本修正。`recurrence.timesPerDay` を最優先で解決するアーキテクチャを確立。
- **Mobile TargetTimes Truncation & Self-Healing Migration**: `mobile.js` 内の `getItemTargetTimes` に `daily_times` 解決ロジックを復旧。旧バージョンで `targetTimes: 1` に破壊的縮退したハビットデータを起動時に本来の目標回数へ自己修復（Self-Healing）するマイグレーションを実装。
- **Cloud Sync Cross-Pollution Guard**: スマホ版で汚染された `targetTimes: 1` が GAS クラウド同期経由で PC 版へ逆流しても、`recurrence.timesPerDay` を最優先評価して無視・自己修復する二重防壁を展開。
- **Premature Done Flag Auto-Recovery**: 今朝1回実行して誤って `done: true`（完了）となった目標未達ハビット（`count < targetTimes`）を、実行実績カウントを保持したまま未完了へ自動救済。
- **JST Local Date Daily Reset Guard**: `app.js` の `sanitizeDailyState` を `getTodayKey()`（JSTローカル日付）に統一し、UTC依存による早朝（0〜9時前）の日次リセット不発を完全排除。
- **Release Notes**: `docs/release_notes/2026-09-07_v1.5.4_multi_count_habit_lifecycle_and_jst_daily_isolation.md` を発行。

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
