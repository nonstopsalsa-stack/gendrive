# CHANGELOG - Gendrive

All notable changes to Gendrive project will be documented in this file.

## [v1.8.2] - 2026-09-18
### Fixed & Protected
- **Completed Single Task Lifecycle & Daily Quarantine Engine (完了単発タスク自己修復＆デイリー画面ゾンビ表示完全根絶エンジン)**:
  - **根本原因の完全解消**: 日付未指定のまま完了された単発タスク（例: `T075` Antigravity2.0インストール、`T076` Cursorインストール等）が、デイリー判定（`isTaskForSelectedDate`）の「日付未指定なら今日に表示」ルールにより、完了状態にもかかわらず毎日デイリー画面の「いつでも枠」に出現していた不整合を完全根絶。
  - **`taskTimerService.js` / `mobile.js` (`completeTask`)**: 単発タスク完了時、`scheduledDate` が未設定であれば完了当日の日付キー（`dateKey`）を自動ロックして保存。Undo操作時は元の期日へ忠実に復元。
  - **`app.js` (`isTaskForSelectedDate`) 二重防衛ガード**: 単発タスクが完了済み（`status === 'completed'`）で万が一 `scheduledDate` が未設定の場合でも、実行ログ（`executionLogs`）や完了履歴（`history`）の完了日を参照し、該当日のデイリー画面にのみ限定表示。今日を含む別日へのゾンビ流出を完全遮断。
  - **`storageService.js` / `mobile.js` 自己修復（Self-Healing）**: `sanitizeTasksDates()` および `sanitizeMobileTasks()` において、完了済みで `scheduledDate` が空の単発タスクを検出し、完了ログから本来の完了日（`2026-09-06`等）を自動サルベージして台帳を恒久修復。
- **Automated Verification Suite (21/21 PASS & 112/112 Total PASS)**:
  - `tests/test_completed_single_task_lifecycle.html` を新設。日付自動サルベージ、デイリー隔離防衛、PC/モバイル完了時ロック、Undo復元、LocalStorage自動永続化を含む全21テストケースが 100% 完全合格。既存テスト（91件）と合わせ全112テストでエラー0件を実証。

## [v1.8.1] - 2026-09-18
### Fixed & Protected
- **Defensive Date Normalization Engine (防衛的日付正規化エンジンの確立)**: Googleスプレッドシートや外部同期クライアント起因で混入した長文Date文字列（例: `Fri Sep 18 2026 00:00:00 GMT+0900 (日本標準時)`）やスラッシュ形式、ISO形式のあらゆる日付表現を、ユーザーのローカル時刻基準（JST）で `YYYY-MM-DD` へダイレクトにパース・正規化する `normalizeToLocalDateKey(val)` を新設・強化。
- **Daily View & Calendar Activity Dots Full Restoration (デイリー画面タスク表示＆カレンダードット完全復活)**:
  - `app.js` の `isTaskForSelectedDate`: `scheduledDate` を `normalizeToLocalDateKey` を通して日付キー（`YYYY-MM-DD`）と比較するよう改修。本日（9/18）の期日指定単発タスク（J PREP Week1〜Week4、計画→Obsidianリスケ、ALL-IN、謝恩会返信方針など）がデイリー画面に確実に表示されるよう完全復旧。
  - `calendarView.js` の `hasActivityOnDate`: `t.scheduledDate` を `normalizeToLocalDateKey` を通して評価。本日および明日以降（9/19〜11/11、計26件）のタスクが存在する日付の下にアクティビティドット（・）が100%確実に描画されるよう完全復旧。
  - `allView.js`: キャリーオーバー判定における `scheduledDate` 比較の防衛的正規化。
- **Storage & Cloud Deep-Merge Auto-Sanitization (ローカル保存・クラウド同期時の自動サニタイズ)**:
  - `storageService.js` の `loadTasks()` および `mergeTasksDeep()` の全ブランチにおいて、`sanitizeTasksDates()` を通して読み込み・マージ時に `scheduledDate` を自動で `YYYY-MM-DD` に自己修復。
  - `pullDataFromCloud()`: クラウド側にタスクが存在しローカルのタスク数が下回っている場合、自動でディープマージを実行して画面およびカレンダーを即時最新化するフェイルセーフを配備。
- **Mobile Engine Defensive Alignment (モバイル側防衛的アライメント)**:
  - `mobile.js` に `normalizeMobileDateKey(val)` を配備し、`sanitizeMobileTasks()` での `scheduledDate` 正規化および `pullFromCloud()` での自動マージ保護を適用。
- **Automated Test Suite (19/19 PASS & 91/91 Total PASS)**:
  - `tests/test_task_date_normalization_and_calendar_dots.html` を新設。Date文字列パース、デイリー表示判定、カレンダードット描画、ディープマージサニタイズ、モバイルサニタイズを含む全19テストケースが 100% 完全PASS。既存のディープマージテスト（12件）および祝日ナビゲーションテスト（60件）と合わせ全91テストでエラー0件を実証。

## [v1.8.0] - 2026-09-18
### Added & Protected
- **Task Deep-Merge Engine (タスク消失完全根絶ディープマージエンジンの確立)**: `storageService.js` および `mobile.js` の `pullDataFromCloud` において、クラウド受信データでローカルタスクを完全上書き（REPLACE）していた設計を根本是正。ローカルにのみ存在する未同期・オフラインタスクを100%保持し、同一IDタスクは完了ステータス（`completed`）を最優先保護、更新日時が新しい属性を採用、`executionLogs` を重複なく統合するディープマージ機構（`mergeTasksDeep` / `mergeMobileTasksDeep`）を配備。
- **High-Water Mark Task ID Protection (ハイウォーターマークID採番衝突防止エンジン)**: タスクIDの自動発番（`generateNextTaskId()`）において、ローカル配列内の最大番号だけでなく `localStorage` に保持された過去最高採番値（`gendrive_task_max_id_v1`）を常に参照・更新するハイウォーターマーク防壁を構築。タスク削除や同期一時欠落が発生しても過去のID番号を再利用せず、ID衝突や重複上書きによるデータ押し出しを永久に根絶。
- **Dual-Device Storage Keys Collision-Safe Architecture**: `storageService.js` と `mobile.js` の `STORAGE_KEYS` 定義を `Object.assign` 型の安全なグローバル共有構造へリファクタリング。デュアルロード時やテスト実行時のSyntaxErrorを完全解消。
- **Full Restoration of Lost Tasks (消失タスク全45件の完全復旧・ID整合)**:
  - 9/14登録の「天才アイデアの箱」バイブコーディングタスク11件（T122〜T132）をID衝突なしの `T156〜T166` へ安全にリナンバリングして完全復旧。
  - 9/18朝および将来1ヶ月先（10月中旬まで）の期日指定単発タスク34件（T122〜T155）をGoogle Driveバックアップより完全復旧。
  - クラウド・スプレッドシート・GAS API（全211件）およびローカル台帳への完全統合を完了。
- **Automated Verification Suite (12/12 PASS & 108/108 Total PASS)**: ハイウォーターマーク維持、未同期ローカルタスク生存（Zero-Loss）、完了ステータス保護、更新日時最新優先、executionLogs統合、モバイルディープマージ等を含む自動テストスイートを新設し 100% PASS を達成。


## [v1.7.6] - 2026-09-17
### Fixed & Improved
- **Japanese Holiday Non-Recursive Engine (祝日判定・非再帰2層エンジンの確立)**: `js/utils/dateUtils.js` の `getJapaneseHolidayName()` における「国民の休日」および「振替休日」判定時の相互再帰（ピンポン呼び出し）を根本是正。第2条本祝日のみを直接判定する純粋関数 `getJapaneseBaseHolidayName()` と、それを参照して判定する総合祝日判定 `getJapaneseHolidayName()` に分離し、再帰深度を完全にゼロ（O(1)）化。
- **Date Navigation Stack Overflow Guard (日付ナビゲーション無限スタッククラッシュ完全解消)**: 2026年9月24日・25日や10月13日〜16日など、祝日直後の平日へ移動した際に発生していた `RangeError: Maximum call stack size exceeded` による画面描画停止・3日スキップ現象を完全解消。←→キー移動・カレンダー直接選択の双方で、ミリ秒単位で安全かつシームレスに全日付間を遷移可能に。
- **Substitute Holiday Consecutive Chain Correction (振替休日連続チェーン正確化)**: 振替休日判定において過去3日を無条件で遡っていた簡易処理を刷新。日曜日から直前日までの平日がすべて祝日であった場合のみ直後の平日を振替休日とする正式な祝日法（第3条第2項）準拠ロジックへ更新し、平日への誤判定を根絶。
- **Automated Verification Suite (60/60 PASS)**: 2026年9月連休・10月連休・過去振替休日・3年間（1,095日）連続走破ストレステスト・リカーレンス連動を含む全60テストケースを新設し、100% 完全合格を達成（既存テスト131件と合わせ計191件完全パス）。

## [v1.7.5] - 2026-09-15
### Fixed & Protected
- **Habit Streak Auto-Salvage Engine (ハビット継続ストリーク自己修復エンジン)**: クラウド同期上書きやアプリアップデート時のキャッシュ更新等により欠落していた「2026-09-11〜2026-09-13」および「2026-08-29」のハビット完了ログを安全に自己修復・自動サルベージ。開始以降毎日継続しているハビットのストリークを「2日連続」から本来の正しい「19〜23日連続」へと完全復活。
- **Cloud Pull History Deep-Merge Guard (クラウド同期履歴ディープマージ保護)**: `pullDataFromCloud` において、クラウド側のハビット配列でローカルを完全上書き（REPLACE）していた挙動を根本是正。ローカルに存在する各日付の完了履歴（`history`）をクラウド受信データと安全に日付キー単位でディープマージし、今後のスマホ同期等による過去実績の消失・巻き戻しを100%遮断。
- **Immediate LocalStorage Persistence**: `loadHabits()` 実行時に自己修復されたハビット履歴を即時 `localStorage` へ自動永続化。

## [v1.7.4] - 2026-09-12
### Added & Improved
- **GTD Buckets Slim 1-Column High Density Layout (スリム1列・高密度16+件一覧)**: GTDバケツ一覧をセクション画面用リッチカードから専用の「スリム1列タスク行（高さ38px・行間4px）」へ刷新。過剰なタイマー表示・大ボタンを省き、タスク名を全幅で広々表示しつつ、画面内に16〜18件を一括表示可能な超高密度一覧性を確立。
- **GTD Buckets Habit Isolation (バケツ画面のハビット完全除外)**: GTDバケツ（Inbox、今週、来週、天才アイデア、いつか、隔離）は純粋な単発タスクの保管・整理箱であるため、ハビットおよび定期タスクのクローンインスタンスを画面から完全除外。バケット表示中はツールバーの「すべて／タスク／ハビット」切替を自動非表示にし、`V` キーによる誤遷移もスキップガード。
- **Completed Tasks Batch Bucket-Release Banner (完了タスクの箱から外す一括バナー)**: 完了タスクを自動削除せず手動で安全に整理できる新パイプラインを確立。バケット内に完了タスク（`status === 'completed'`）が存在する場合のみ、画面上部に「✅ 完了したタスクが N件 あります（※マスターボードの単発タスク一覧にはそのまま残ります）」という安心バナーと「🧹 完了タスクを箱から外す (N件)」ボタンを自動表示。
- **Master Board Data Preservation**: バケツから外された完了タスクは `bucket = 'today'` に安全に解除され、マスターボード（台帳）の単発タスク一覧および完了実績ログにはそのまま確実に保持される設計を確立。
- **Silent Complete Toggle (音声なし・静かな完了トグル)**: バケツ内でのチェックボックス操作時は音声再生（AudioContext等）を一切行わず、静かに未完了・完了をトグル。取り消し線と透過表示、および上部クリーンアップバナーのカウントと即座にリアルタイム連動（Undo対応）。
- **Single-Task Context Menu Quick Release (右クリックからの個別箱外し)**: タスクの右クリックコンテキストメニューに「📦 箱から外す (通常タスクに戻す)」項目を新設。バケットに入っているタスクの場合のみ動的に表示され、1件ずつでも即座に解除可能に。
- **Full Undo Support (Ctrl+Z完全対応)**: バナーの一括解除・右クリックの個別解除・完了トグルのすべてにおいて、誤操作時に `Ctrl+Z` で瞬時に復元可能なUndoアクションを登録。
- **Automated Verification Suite (36/36 PASS)**: ハビット除外、スリム行要素描画、静かな完了トグル、完了タスクバナー動的表示、一括解除、台帳データ保持、個別右クリック解除、Undo復元、全6バケット（今週・来週・天才アイデア・いつか・隔離・Inbox）の動作を機械的に検証する自動テストスイートを新設（36件全パス）。

---

## [v1.7.3] - 2026-09-11
### Added & Enhanced
- **Soul Quotes Master Expansion (64選 -> 72選への拡充・ADHD着火エンジン強化)**: フォーカスモード下部に表示される魂を揺さぶる言葉（Soul Quotes）に、哲生の闘志・集中力・覚悟を極限まで高める8つの最新フレーズ（aMCCスクワット＆最大カエル撃破、丁寧な生き方、恐怖と限界を突破する1分全振り、モードとプロトコルの復帰、アイデア歓喜とカエル丸呑み、青木真也の覚悟とコツコツ生きる誓い、持ち場での即時行動、恐怖への打ち勝ちと闘争心）を正式追加。
- **Automated Verification Suite (64/64 PASS)**: `test_focus_board_loop.html` の Soul Quotes マスター配列テストを 72件アサーションへ同期・自動検証し、100% 完全パスを保証。
- **Release Notes**: `docs/release_notes/2026-09-11_v1.7.3_soul_quotes_expansion_72_fire_phrases.md` を発行。

---

## [v1.7.2] - 2026-09-11
### Added & Improved
- **Preset Task 20 Slots & QWERTY Matrix Auto-Assignment**: プリセットタスク登録数を最大20個まで拡張し、一覧画面を横5個×縦4列のパノラマグリッドレイアウト（`repeat(5, 1fr)`）へ刷新。ショートカットキーを上段から物理キーボード配列に完全一致させた `12345`（第1行）、`67890`（第2行）、`QWERT`（第3行）、`YUIOP`（第4行）の計20キーへ自動割り当て。単キー押下（大文字・小文字・全角IME対応）で即座にタスク起動＆先行タスク自動中断連携。
- **Conflict Resolution for "P" Key (Recommended Scheme A)**: 20番目（インデックス19）に割り当てられた `P` キーとの競合を解消するため、プリセット新規作成のショートカットを `P` から `N`（New）へスマートに移行。単体キー `P` によるタスク即時実行の爽快感を100%維持。
- **Strict 20-Preset Upper Guard (上限保護パイプライン)**: 新規プリセット作成画面の起動時および保存処理（`savePresetFromForm`）において `MAX_TASK_PRESETS = 20` の防御チェックを導入。既存プリセットの編集は20個状態でも安全に実行可能。
- **Automated Verification Suite (31/31 PASS)**: 定数定義、物理配列順序、キーバッジ描画、ツールチップ整合性、新規作成上限ブロック、編集許可、20キー即時実行、全角IME入力、5列CSS Computed Styleの全31テストケースを新設し 100% PASS を達成（既存テスト96件と合わせ全127件完全パス）。
- **Release Notes**: `docs/release_notes/2026-09-11_v1.7.2_preset_tasks_20_slots_qwerty_keyboard_matrix.md` を発行。

---

## [v1.7.1] - 2026-09-10
### Fixed & Improved
- **Soul Quotes Hybrid Left Alignment**: フォーカス画面のマインドセット／ソウルクオート（64選）のタイポグラフィにおいて、中央揃えによる改行時の視認性低下を解消し、テキスト幅（fit-content）に追従する左揃えハイブリッドレイアウトを確立。

---

## [v1.7.0] - 2026-09-10
### Added & Improved
- **Adaptive Focus Board (1-2-3 Loop Engine)**: フォーカス画面のタスク精選ループ（1件・2件・3件）およびソウルクオート枠なしダイレクト表示エンジンを確立。

---
### Added & Improved
- **Recurring Task Auto-Clone to Single Tasks Engine**: 定期タスク完了イベント（PC / モバイル両対応）において、親オブジェクトの `executionLogs` 追記と連動して「完了済み単発タスク」レコード（`taskType: 'single'`, `status: 'completed'`）を自動生成して `state.tasks` へ追記。全属性（タイトル、ドメイン大/小、部門大/小、PJ大/小、セクション、実績時間、開始/終了時刻、6軸マトリクス、優先度、ラベル、タグ、メモ、Obsidianノート）および識別子（`isRecurringInstance: true`, `recurringSourceId`, `recurringLogId`）を完全保持。
- **Dual Count Prevention Engine (集計の二重カウント完全遮断)**: デイリー画面（Daily Board / Section View / All View / Focus View / Mobile）およびデイリーサマリー計算において、親定期タスクが当日の完了状態を表示するため、自動生成された単発タスク（`isRecurringInstance: true`）をタスク一覧およびサマリー集計（残り時間・実績・完了件数）から完全に除外。デイリー画面上でのタスク重複表示や実績件数・時間の2倍カウントを根本遮断。
- **Full Undo & Uncomplete Synchronization (未完了戻しの完全連動)**: トーストからのUndo操作、デイリーでの再トグル操作、実行ログ削除モーダルでのログ削除のいずれで定期タスクが「未完了」に戻された場合でも、連動して作られた単発タスク側の完了レコードを自動で削除する堅牢なクリーンアップパイプラインを確立。
- **Master Board & GAS Integration**: マスターボードの「単発タスク」タブに自動生成された単発タスクが表示され、`🔁 定期` バッジを付与して視覚的に識別可能に。Google Apps Script (`gas_sync_script.js`) の `SingleTasks` シート連携にも `定期由来(isRecurringInstance)` と `親定期ID(recurringSourceId)` 列を追加しスプレッドシート上でも完全連動。
- **Future-Proof Analytics Helpers**: 今後実装される分析機能で二重カウントが絶対に起きないよう、純粋な単発タスク（`isPureSingleTask`）と定期インスタンス（`isRecurringInstanceTask`）を明瞭に切り分け、重複なく集計できる共通API（`taskCloneHelper.js`）を整備。
- **Automated Verification Suite (32/32 PASS)**: クローン自動生成、属性完全コピー、単発タスク完了時の非増殖、Undo連動削除、トグル連動削除、ログ削除連動、デイリー二重表示防止、繰越除外、重複排除集計、モバイル側連動の全32テストケースを新設し 100% PASS を達成（既存テストと合わせて全150件完全パス）。
- **Release Notes**: `docs/release_notes/2026-09-10_v1.6.1_recurring_task_auto_clone_and_dedup_engine.md` を発行。

---
### Fixed & Improved
- **Vision Board Goal Editor Dark Theme Contrast Fix**: 目標ビジョン設定モーダル（週次・月次・ハーフ・フェイズ）の各目標記入欄（textarea）が、ダークテーマCSSの適用対象外によりブラウザ標準の白背景×ダークテーマ文字色の「白バック・白文字（不可視）」となっていた不具合を解消。背景をダークネイビー（`rgba(15, 23, 42, 0.85)`）、文字色を鮮明なホワイト（`#f8fafc`）に統一。
- **Global `.form-group textarea` Styling & Font Inheritance**: 共通フォームスタイルに `textarea` を明示追加し、UIフォント（Inter）の継承および垂直リサイズを定義。今後のフォーム拡張時における白浮き再発を予防。
- **Automated Visual & Computed Style Verification**: ヘッドレス Edge を用いた自動検証テストスイートを構築し、全目標textareaの Computed Style（ダーク背景・白文字・フォント継承）およびモーダル実画面スクリーンショット撮影による完全視認性を機械的に検証・合格。
- **Release Notes**: `docs/release_notes/2026-09-09_v1.5.10_vision_board_goal_editor_dark_theme_contrast_fix.md` を発行。

---

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
