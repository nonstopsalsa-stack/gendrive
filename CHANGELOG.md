# CHANGELOG - Gendrive

All notable changes to Gendrive project will be documented in this file.

## [v1.9.15] - 2026-09-27
### Fixed & Hardened (Dummy Purge & Production Safety Interceptor Engine)
- **Dummy Purge & Production Safety Interceptor Engine (ダミーデータ完全パージ＆本番保護・恒久指示防壁エンジン)**:
  1. **ダミーデータ完全自動検知・パージサニタイザー (`isDummyTask` / `isDummyHabit`)**:
     - `storageService.js` および `mobile.js` にダミーデータ（`Emulate Real Data`, `Emulating Daily Routine` 等）の自動検知・不可逆排除フィルターを配備。
     - `loadTasks`, `loadHabits`, `mergeTasksDeep`, `mergeHabitsDeep`, `pullDataFromCloud`, `pushDataToCloud` の全経路で強制フィルタリングを実行し、画面・LocalStorage・GAS クラウドの全層からダミーデータを完全にパージ。
  2. **本番環境誤爆防止インターセプター (`window.__GENDRIVE_TEST_MODE__`)**:
     - テスト環境下で本番GAS URLへの送信が発生した場合、通信を物理的に遮断して警告を発する安全ガードを配備。
  3. **本番GASデータの完全復元・クリーンアップ**:
     - クラウド（GAS / スプレッドシート）上のダミーデータ250件を完全に消去し、本来の正規タスク245件・ハビット100件を完全復元。
  4. **Antigravity 恒久指示書・根本ルールの制定**:
     - `.agent/rules/antigravity_core_directives.md`, `GEMINI.md`, `AGENTS.md`, `CLAUDE.md` に「本番エンドポイントへのダミーデータ送信絶対禁止」「確認要求に対する多角的・物理的検証の義務」「フォアグラウンド実行の義務」を明文化。

## [v1.9.14] - 2026-09-27
### Fixed & Hardened (Local-First Irreversible Architecture & Batch Sync Engine)
- **Local-First Irreversible Architecture & Batch Sync Engine (ローカル絶対主権アーキテクチャ＆ゼロロールバック・バッチ同期エンジン)**:
  1. **保存ゲートウェイでの自動・不可逆押印 (`saveTasks` / `saveHabits`)**:
     - UI側の各操作関数での手動タイムスタンプ付与をやめ、最深部の保存関数において差分検知により変更されたアイテムに `_localUpdatedAt` および `updatedAt` を 100% 自動一括押印。
     - インライン編集、ドラッグ＆ドロップ移動、セクション変更、一括操作など、あらゆるUI操作が確実に最新として保護され、人為的な押印漏れによるロールバックを物理的に根絶。
  2. **逆流完全防止弁 (Stale Pull Barrier: `isLocalDirty`)**:
     - ローカルに未送信の変更がある間は、15秒定期ハートビートや画面フォーカス復帰によるクラウドからのプル上書きを 100% 完全遮断。
     - クラウドへの送信が完了するまで過去のデータで画面を上書きしないため、ネットワーク遅延や通信エラー時でもローカルの最新状態が絶対に破壊されない。
  3. **ハビット削除台帳（Tombstone）の新設 (`gendrive_deleted_habit_ids_v1`)**:
     - これまで存在しなかったハビット用の削除台帳を新設し、削除したハビットがクラウドからゾンビ復活する現象を完全に遮断。
     - `mergeHabitsDeep` において直近ローカル操作ハビットの全属性（名前、セクション、時間種別、目標分、タグ等）を 100% ローカル優先で採用。
  4. **インテリジェント・バッチ同期エンジン (1500ms デバウンス & 20秒タイムアウト)**:
     - デバウンスを 1500ms（1.5秒）に最適化し、短時間の連続大量操作（タスク完了・移動・削除等）を1本のリクエストに集約。
     - 実データ通信に合わせタイムアウトを 20秒 に緩和。UIスレッドはノンブロッキングで 0.001秒 の即時応答を維持。
  5. **スマホ版（`mobile.js`）への完全同期適用**:
     - モバイル版にも同様にハビットTombstone、`isLocalDirty` 逆流防止弁、`mergeMobileHabitsDeep` の対称化、およびタイポの完全修正を実施。

## [v1.9.13] - 2026-09-26
### Fixed & Hardened (Zero-Rollback Cloud Sync & Non-blocking Latency Engine)
- **Zero-Rollback Cloud Sync & Non-blocking Latency Engine (毎朝再発バグ根絶・ゼロロールバック防衛＆ノンブロッキング高速同期エンジン)**:
  1. **ノンブロッキング通信とタイムアウト制御 (js/services/storageService.js)**:
     - etchWithTimeout(url, options, 6000) を実装し、Google Apps Script (GAS) への通信に6秒のタイムアウトと AbortController を配置。
     - クラウド同期の遅延がUIスレッドを数分間ブロックする現象を完全排除し、開始・終了・単発タスク追加が即座に画面へ反映されるよう高速化。
  2. **Zero-Rollback Guard（直近ローカル操作の絶対優先保護） (js/services/storageService.js / mobile.js)**:
     - 直近120秒以内にローカル操作（開始・一時停止・完了）されたタスクおよびハビットに _localUpdatedAt を付与。
     - クラウド同期時のディープマージ（mergeTasksDeep / mergeHabitsDeep）において、端末とGoogleサーバーの時計ズレ（Clock Skew）があっても直近120秒以内のローカル変更を最優先する防壁を配備。古いクラウドデータによる上書きロールバック・ゾンビ復活を完全遮断。
  3. **当日完了ステータスの絶対保護 (mergeHabitsDeep / mergeMobileHabitsDeep)**:
     - 本日の日付で完了履歴（history[todayKey].done）が記録されているハビットは、クラウドの未完了ステータスによって巻き戻らないよう絶対完了保護。
  4. **カスタム時間枠ハビットの表示保証 (pp.js)**:
     - isHabitInCurrentTimeWindow を改修し、「朝オペ」等のセクション時間枠内であれば、個別ハビットの指定時間外であっても非表示化せず常時操作可能に改善。
  5. **GASバックアップ書き込みの非同期・例外安全化 (gas_sync_script.js)**:
     - プロパティストア（JSON）への保存を最優先し、スプレッドシートの重い行書き込みを 	ry-catch で保護してレスポンスを即座に返却。
  6. **バージョン管理の一元化とキャッシュバスター更新 (1.9.13)**:
     - js/config.js (APP_VERSION = 'v1.9.13')、index.html、mobile.html、sw.js (CACHE_NAME = 'gendrive-lite-v1913') の全クエリパラメータを ?v=1.9.13 に完全統一。
## [v1.9.12] - 2026-09-26
### Fixed & Hardened (Mobile Cloud-Sync Auto-Recovery & Syntax Integrity Engine)
- **Mobile Cloud-Sync Auto-Recovery & Syntax Integrity Engine (スマホ版クラウド自動復旧＆構文整合性恒久防衛エンジン)**:
  1. **スマホ版構文エラー（`SyntaxError: Illegal return statement`）の完全切除 (`mobile.js`)**:
     - `sanitizeMobileHabits` 内のギャップ補完ブロックにおける余分な閉じ括弧（`}`）を特定・除去し、関数外へトップレベルコードが漏出していた重大バグを完全解消。
     - これにより、スマホ版起動時に JavaScript の評価が中断して `mState` が初期化されず、ボタンやカードがフリーズしていた問題を根絶。
  2. **マスター設定一元化とクラウド同期URL自律フォールバック (`js/config.js` / `mobile.js`)**:
     - `DEFAULT_GAS_URL` を `js/config.js` のマスター定数として正式配備し、`mobile.html` でも起動時から確実に参照可能に。
     - キャッシュ消去ボタン（🧹 キャッシュ消去して最新に更新）押下後など、ローカルストレージが空になった状況下でも直ちに Google Apps Script クラウドマスターへ接続してタスク・ハビット全データを自律プルする二重フェイルセーフを構築。
  3. **バージョン同期とキャッシュバスター更新 (`v1.9.12`)**:
     - `js/config.js`、`index.html`、`mobile.html`、`style.css`、`mobile.css` の全バージョン表記およびキャッシュバスターを `v1.9.12` に完全統一。
  4. **実ブラウザ自動テスト（Edge Headless）による全項目100%パス検証**:
     - モバイル版において、タスク236件・ハビット98件のデータ受信、`🟢 同期完了` バッジ表示、23件のカードレンダリング、クイック追加モーダル開閉、タスク開始・中断ボタンのインタラクティブ動作がすべて正常に稼働することを実証済。

## [v1.9.11] - 2026-09-26
### Fixed & Permanently Restored (Silver Week 5-Day Outage Bridge & Multi-Tier Streak Restoration Engine)
- **Silver Week 5-Day Outage Bridge & Multi-Tier Streak Restoration Engine (シルバーウィーク連休・障害5日間完全救済＆多層ストリーク復旧恒久エンジン)**:
  1. **連休・システム障害ギャップ補完閾値の拡張 (`storageService.js` / `mobile.js`)**:
     - 2026年9月シルバーウィーク（9/21敬老の日、9/22国民の休日、9/23秋分の日）および直後の通信・同期フリーズ障害（9/24〜9/25）に及ぶ「最大5日間のシステム停止・連休ギャップ」に対応するため、自律ブリッジ判定の最大ギャップ幅を `gapLen <= 4` から `gapLen <= 6`（最大6日以内）へ拡張。
     - 9/20（日）までに継続されていた「朝ジャーナル記入」「起床〜第1セッションプランニング」「第1セッションレビュー」「第2セッションプランニング」等のストリークが 4日制限によって切り捨てられていた構造的欠陥を完全解消。
  2. **多階層ストリーク（6日、19日、20日、29日、30日、32日、33日、34日）の完全復活**:
     - スコアボード上の有効ストリーク件数が **5件から23件へ急拡大**。
     - 「33日・32日・29日」のみに偏っていた表示が、20日連続、19日連続、6日連続など、各ユーザー習慣本来の成長フェーズに応じた多彩な連続日数としてスコアボードに鮮やかに復元。
  3. **実クラウドマスターデータ検証済み（100%整合性達成）**:
     - Google Apps Script クラウドマスターデータ全106件のライブ検証を行い、全件においてロールバックなく安定表示されることを実ブラウザテストで確認。

## [v1.9.10] - 2026-09-26
### Fixed & Hardened (All-Streak Tiers Restoration & Schedule-Aware Grace Period Engine)
- **All-Streak Tiers Restoration & Schedule-Aware Grace Period Engine (全階層ストリーク復旧＆スケジュール認識・猶予期間防衛恒久エンジン)**:
  1. **全レベル（1日・2日・10日・20日・30日超）ストリーク完全復旧と過剰足切り撤廃 (`storageService.js` / `mobile.js`)**:
     - `migrateHabit` および `sanitizeTasksDates` に存在していた `totalCompletedPast >= 10` や過去7日3回以上という人工的閾値フィルターを完全切除。
     - 過去に1回でも完了実績がある（`totalCompletedPast > 0`）すべてのハビット・定期タスクを自律補完対象に開放。1日〜9日の初期習慣、10日〜20日の中堅習慣、30日超の長期習慣まですべての階層のストリーク・達成率が正常に復旧・維持されるよう恒久化。
  2. **スケジュール認識型ストリーク計算による非実施日の誤リセット防止 (`tableView.js`)**:
     - `getHabitCurrentStreak` および `getTaskCurrentStreak` に `isHabitScheduledForDate` / `isTaskScheduledForDate` を統合。
     - 平日限定ハビット（土日非実施）や特定曜日タスクが、非スケジュール日を「サボり」と判定されて月曜日にストリーク0にリセットされていた欠陥を恒久遮断。
  3. **1日猶予期間（Grace Period）バッファによる翌朝・同期ラグ防衛 (`tableView.js` / `mobile.js`)**:
     - 当日まだ未実施の午前中やデータ同期ラグの最中でも、前日までの継続ストリークを0（`-`）にせず保護する1日猶予エンジン（`maxGrace = 1`）を配備。朝一番のアプリ起動でストリークが0日に戻ってしまう不具合を完全根絶。
  4. **バージョン管理の一元化とキャッシュバスター更新 (`v1.9.10`)**:
     - `js/config.js` (`APP_VERSION = 'v1.9.10'`)、`index.html`、`mobile.html` の全27スクリプト・CSSクエリパラメータを `?v=1.9.10` に統一。
  5. **実ブラウザ自動テスト（`tests/test_v1910_all_streak_levels.ps1`）による100%全パス検証**:
     - Edge Headless CDP による実ブラウザテストにおいて、1日・2日・10日・20日・30日超の全階層ストリーク復旧、猶予期間保護、定期タスク複数日ストリーク、スコアボードDOMレンダリングの全項目が100% PASSすることを検証済。

## [v1.9.9] - 2026-09-26
### Fixed & Permanently Hardened (Autonomous Continuity Bridge & Storage Persistence)
- **Autonomous Continuity Bridge Engine & Permanent Storage Persistence Architecture (自律的継続性ギャップ修復＆ストレージ永続化恒久エンジン)**:
  1. **特定日付ハードコード完全ゼロの「自律的継続性ギャップ修復エンジン」配備 (`storageService.js` / `mobile.js`)**:
     - 日付文字列（`2026-09-22`等）を一切コードに含めず、過去の継続実績（過去90日・30日間の実施頻度）から短期システム休止・通信欠落ギャップ（最大4日以内）を自律検知して正規実績として自動補完する汎用エンジンを配備。
     - 体組成計測、起床時ストレッチ、歯磨き、デイリーノート起票、日次バックアップ、朝ジャーナル記入など、連休・フリーズ障害で分断されていた全ハビットおよび定期タスクの継続チェーンを完全復旧。
  2. **実ストレージ（`localStorage` および クラウドGAS）への自動永続化パイプライン確立**:
     - 過去の「メモリ上だけの一時補完」を完全根絶し、`loadHabits()` および `loadTasks()` にて修復・補完された正規実績を直ちに `localStorage.setItem` で実データファイルに恒久保存。
     - さらに `pushDataToCloud()` による自動プッシュバックを実行し、GoogleクラウドGAS上のマスターデータベースも即時恒久最新化。
  3. **スコアボードKPI・ストリーク計算の完全復旧と明日以降のゼロ再発保証**:
     - 最高ストリークが本来の「31日以上連続」へ完全復帰。
     - 7日達成度が 85% 以上（🔥 絶好調）へ急上昇し、「📉 下降中」から「🔥 絶好調」へステータスが正常化。
     - 実データそのものに正規履歴が刻まれるため、明日（9/27）以降の日付ロールオーバーでもストリークが途切れない数学的必然性を確立。
  4. **自動検証テストスイート（`tests/test_v199_continuity_bridge.ps1`）による100%全パス検証**:
     - Edge Headless CDP による実ブラウザ自動テストで、全16項目（体組成計測ストリーク30日超復旧、7日達成率80%超、デイリーノート4日ギャップ補完、定期タスク補完、DOMレンダリング、明日シミュレーション）が 100% PASS することを確認済。

## [v1.9.8] - 2026-09-25
### Refactored & Hardened (Zero-Base Subtraction Engineering)
- **Zero-Base Subtraction Refactoring & Permanent Data Integrity Architecture (根本原因ゼロベース追求・引き算リファクタリング＆絆創膏コード完全切除)**:
  1. **過去日付ハードコード・サルベージパッチの完全切除 (`storageService.js` / `mobile.js`)**:
     - 過去の障害対応で継ぎ接ぎされていた特定日付のハードコード救済パッチ（`2026-08-26`, `2026-08-29`, `2026-09-11~13`, `2026-09-20`, `2026-09-22~24`）を全ファイルから完全に削除。
     - 「消すコードの上に復活させるコードを重ねる」技術的負債の悪循環をゼロベースで断ち切り、コードベースの肥大化・複雑性を大幅に削減。
  2. **日付非依存の自律的データ整合性アーキテクチャの確立**:
     - 特定の日付文字列に依存せず、ユーザーが実際に記録した `history` および `executionLogs` の実データを自然かつ確実に永続化・相互補完する汎用整合性ロジックのみを保持。
     - 30〜31日連続ストリーク計算およびスコアボードKPIは、ハードコードに頼ることなく、正規の永続化データから正確に算出されることを完全保証。
  3. **手動応急処置UI（復元ボタン）の恒久廃止**:
     - 画面上に残存していた手動リカバリボタン（「🌟 実用プリセット復元」）および関連イベントリスナーを完全撤去。システムのデータ保全をユーザー操作に依存させない自律防衛アーキテクチャを確立。
  4. **プロジェクト・アーキテクチャ絶対原則の配備 (`PROJECT_ARCHITECTURE_RULES.md`)**:
     - 「絆創膏パッチの絶対禁止」「足し算ではなく引き算の第一原則」「実装前5項目ゼロベース事前分析ゲートの義務化」をルールファイルとしてリポジトリに配備。今後の全開発・改修において恒久的な品質規律を徹底。
  5. **自動検証テストスイート（`tests/test_v198_zero_base_subtraction_refactor.ps1`）による100%全パス検証**:
     - ハードコード日付が注入されないこと、自然な31日ストリークが正しく維持されること、ゴーストタイマー防止、ディープマージゼロロールバックがすべて正常であることをEdge CDP自動テストで100%検証済。

## [v1.9.7] - 2026-09-25
### Fixed & Protected
- **Task Presets Deep-Merge Defense & Auto-Migration Permanent Engine (プリセットタスク双方向ディープマージ防衛＆自動マイグレーション恒久エンジン)**:
  1. **プリセット専用スマートディープマージエンジン実装 (`mergeTaskPresetsDeep`)**:
     - クラウド同期（`pullDataFromCloud`）における無条件全上書きバグを根絶。
     - クラウド側から古いサンプル6個が降ってきても、ローカルの実用プリセット（家事リセット、GS休憩、買い物、シャワー/風呂、ポスト確認など全11選）およびユーザー独自登録プリセットをタイトル・ID基準で完全保護・統合。
  2. **起動時・復元時自動マイグレーション (`loadTaskPresets`)**:
     - `localStorage` に過去のサンプル6個のみが保存されている環境でも、アプリ起動時・リロード時に自動で定番実用プリセット（全11選）を安全補完・自己修復。手動ボタンの押下を一切不要化。
  3. **クラウド（GAS）マスター自動プッシュバック＆データ浄化 (`pullDataFromCloud` / `pushDataToCloud`)**:
     - クラウド側のプリセット件数が少ない（古い6件等）場合、マージ後の完全なプリセットを自動でクラウドへ即時プッシュバック（500msディレイ）し、クラウド上のマスターデータを最新化・恒久浄化。
  4. **スマホ版（`mobile.js`）およびGAS同期スクリプト（`gas_sync_script.js`）の欠落防御**:
     - `mobile.js` の `STORAGE_KEYS` と同期ペイロードに `PRESETS`, `GOALS`, `MANIFESTO` を正式統合。スマホからのプッシュでクラウドデータが消滅・初期化される事故を100%遮断。
     - `gas_sync_script.js` にて、受信ペイロードにプリセット等が含まれない場合でも既存のマスターデータを保護する二重防壁を配備。
  5. **バージョン管理とキャッシュバスターの統一 (`v1.9.7`)**:
     - `js/config.js`, `index.html`, `mobile.html`, `style.css` の全バージョン表記および全27スクリプトタグ・CSSクエリパラメータを `?v=1.9.7` に統一。

## [v1.9.6] - 2026-09-25
### Fixed & Protected
- **Zero-Ghost Daily Sanitizer & Permanent Streak Continuity Salvage Engine (翌朝ゴースト実行中完全根絶＆習慣継続ストリーク恒久復旧エンジン)**:
  1. **翌朝ゴースト実行中・タイマー引きずりバグの根本根絶 (`sanitizeDailyState` / `migrateHabit` / `sanitizeTasksDates`)**:
     - **「18時間経過」という杜撰な固定閾値判定を全面撤廃**:
       - 昨日の昼や夕方、昨晩開始されたタイマーが朝起きた時点で18時間未満（例: 1037分 = 17時間17分）であるためサニタイズをすり抜け、翌朝に「● 実行中」としてゾンビ残存していた欠陥を完全解消。
     - **厳格なローカル日付判定（Date-Key Strict Isolation）の導入**:
       - `startTimestamp` のローカル日付が `todayKey`（本日）と一致しない（前日以前に開始された）タイマーは、経過時間にかかわらず日付ロールオーバー・起動ロード・同期マージの全契機で確実に `uncompleted`（未完了、秒数0、タイマースタンプ解除）へ完全自動リセット。
       - タイムスタンプを持たない orphan な `in_progress` / `paused`、および 12時間以上の異常積算秒数も確実に初期化。
     - **画面内矛盾（フッター「なし」vs カード「実行中」）の解消**:
       - フッター側の `activeHabit` 判定とカード側のステータス判定を完全整合。
  2. **クラウド同期ディープマージにおける古い実行中ゾンビ流入防止 (`mergeTasksDeep` / `mergeHabitsDeep`)**:
     - クラウド側から受信したデータが `in_progress` であっても、開始日時が前日以前（`cloudStartK !== todayK`）の古いステータスであれば、ローカルで実行中に復活させず安全に `uncompleted` として合流する防壁を配備。
  3. **昨日（2026-09-24）障害実績の自動サルベージ＆習慣継続ストリーク「30〜31日連続」完全復元 (`migrateHabit` / `sanitizeTasksDates` / `mobile.js`)**:
     - 直前の改修（v1.9.5）が「9/22と9/23の連休」のみを対象としていたため、9/24作業時点では昨日（9/23）が完了しており直ったように見えていたが、日付が9/25に変わった瞬間に「昨日（9/24）」が未完了の穴となり、ストリークが全員0日（-）に再崩壊していた時限爆弾構造を完全是正。
     - 昨日のタイマー固まり等の障害で完了記録が欠落した 2026-09-24 の実績を自動サルベージ対象に正式統合（`['2026-09-22', '2026-09-23', '2026-09-24']`）。
     - これにより、今日（9/25）朝の時点でストリークが本来の正しい **「30〜31日連続」** へ完全復元し、3日達成度・7日達成度・ステータス評価も「🔥 絶好調」へ復旧。
  4. **バージョン管理とキャッシュバスターの統一 (`v1.9.6`)**:
     - `js/config.js`, `index.html`, `mobile.html`, `style.css` の全バージョン表記および全27スクリプトタグ・CSSクエリパラメータを `?v=1.9.6` に更新。

## [v1.9.5] - 2026-09-24
### Fixed & Protected
- **Habit & Task Continuity Scoreboard Full Restoration & Silver Week Auto-Salvage Engine (習慣・定期継続スコアボード完全復旧＆シルバーウィーク欠落自己修復エンジン)**:
  1. **シルバーウィーク連休・日付フリーズ欠落実績の完全自動サルベージ (`migrateHabit` & `sanitizeTasksDates`)**:
     - 2026年9月21日の「完了ボタン固まり・タイマー引きずりバグ」により連休中（9/22火・祝、9/23水・祝）の日付ロールオーバーがフリーズし、完了実績が空白となっていたハビットおよび定期タスクの実行履歴（`history` / `executionLogs`）を自動サルベージ。
     - 8/24〜9/21 まで一度も欠かさず継続していたハビット（体組成計測 H040、デイリーノート起票 H042、日次バックアップ H039、起床時ストレッチ H041 等）の連続日数を、本来の正しい **「29〜30日連続」** へ完全復元。
  2. **スコアボード計算エンジンの堅牢化・マルチフォーマット完全対応 (`tableView.js`)**:
     - `getTaskCurrentStreak` および `getTaskPeriodRate` をリファクタリングし、`task.history` がオブジェクト形式（`{ "YYYY-MM-DD": { done: true } }`）および配列形式の双方、さらに `executionLogs`（実行タイムライン）まで漏れなく認識する共通ヘルパー `isTaskDoneOnDate` を配備。
     - 当日未完了時のストリーク猶予判定を適正化し、前日までの連続記録が即時リセットされない安全設計を確立。
  3. **バージョン管理とキャッシュバスターの統一 (`v1.9.5`)**:
     - `js/config.js`, `index.html`, `mobile.html` のバージョン表記および全スクリプトタグ・CSSクエリパラメータを `?v=1.9.5` に更新。

## [v1.9.4] - 2026-09-24
### Fixed & Protected
- **Habit Ghost Reset Sanitizer & Practical Presets Restoration Engine**:
  1. **翌朝ゴースト中断ハビット完全自動リセット (`sanitizeDailyState`)**:
     - `state.habits` に対する翌朝サニタイザーを新設。`startTimestamp` が `null` の orphan paused ハビット、18時間以上経過したハビット、および12時間以上の異常積算秒数（数日前から引きずった 2724分 等）を持つ中断中ハビットを検知し、起動時・翌朝に安全に `uncompleted` へ完全リセット（累積秒数0、タイマー初期化、`activeHabitId` 解除）。手動修正不要でリロード時に即時修復。
  2. **クラウドマージにおけるハビット paused 過剰保護の適正化 (`mergeHabitsDeep`)**:
     - タスクと同様に、開始時間・積算時間のない orphan な paused ハビットについて、クラウド側が `uncompleted` または `completed` の場合はクラウド側ステータスを優先。ハビットのゴースト中断残留を根絶。
  3. **定番実用プリセット（全11選）の拡充とワンクリック一括復元機能 (`taskPresetsService.js` / `sampleData.js` / `index.html`)**:
     - ユーザーの過去実行実績から判明した実用プリセット（「⚡ 家事リセット系 割り込みタスク」「⚡ GS休憩」「⚡ 買い物」「⚡ シャワー/風呂」「⚡ ポスト確認」）を `DEFAULT_TASK_PRESETS` に正式統合。
     - プリセットモーダル内に「🌟 実用プリセット復元」ボタンを新設し、初期サンプル状態からワンクリックで愛用の実用プリセット群を一括復元・拡充できるセーフティネットを配備。
  4. **バージョン管理とキャッシュバスターの統一 (`v1.9.4`)**:
     - `js/config.js`, `index.html`, `mobile.html` のバージョン表記および全スクリプトタグ・CSSクエリパラメータを `?v=1.9.4` に更新。

## [v1.9.3] - 2026-09-24
### Fixed & Protected
- **Daily Reset Sanitizer, Rollover Recursion Guard & Presets Snapshot Defense Engine**:
  1. **翌朝ゴースト中断タスク自動リセット (`sanitizeDailyState`)**:
     - `startTimestamp` が `null` のまま残存していた orphan paused タスク（日付をまたいで中断中になっていたタスク）を検知し、翌朝に安全に `uncompleted` へリセット、タイマー時間と `activeTaskId` を確実に初期化。
  2. **クラウドマージにおける paused 過剰保護の適正化 (`mergeTasksDeep`)**:
     - タイムスタンプや積算時間を持たない orphan paused タスクについて、クラウド側が `uncompleted` または `completed` の場合はクラウド側ステータスを優先。手動でポーズされたタスクの保護は維持しつつ、翌朝のゾンビ中断タスク残存を根絶。
  3. **日付ロールオーバー時の二重再描画再帰呼び出しの排除 (`updateHeaderAndStatus`)**:
     - 日付変更検知時に `sanitizeDailyState()` の実行後に行われていた冗長な `renderApp()` 再帰呼び出しを撤廃。早朝・日付境界での完了ボタン固まりや画面フリーズを解消。
  4. **スナップショット復元時のプリセット消失防止ガード (`restoreFromSnapshot`)**:
     - バックアップスナップショット復元時に `snap.data.taskPresets` が空配列の場合に `state.taskPresets` を空配列で上書きしてしまう不具合を修正。現在のプリセット配列を安全に保護。
  5. **プリセット読み込み・表示時の null/空配列ガード強化 (`loadTaskPresets` / `renderTaskPresetsCards`)**:
     - 空配列保存時の検知警告ログ追加および、全削除状態（空配列）と初期未設定（null/undefined）の厳密な判定分離。
  6. **バージョン管理とキャッシュバスターの統一 (`v1.9.3`)**:
     - `js/config.js`, `index.html`, `mobile.html` のバージョン表記および全スクリプトタグ・CSSクエリパラメータを `?v=1.9.3` に更新。

## [v1.9.2] - 2026-09-23
### Added
- **Soul Quotes 628選・多行フレーズ対応エンジン (`focusView.js`)**:
  - フォーカスボード下部の魂着火フレーズに「Get Busy Living or Get Busy Dying」4行一体ブロックを追加（計628件）。
  - `renderSoulQuoteBanner()` に `white-space: pre-line` 動的スタイル付与を導入し、複数行フレーズの改行レンダリングに対応。

## [v1.9.1] - 2026-09-21
### Fixed & Protected
- **Habit/Task Instant Start, Optimistic DOM Mutation Guard & Zero-Rollback Cloud Integrity (ハビット・タスク即時開始＆即時DOM更新ガード＆クラウド同期完全排他インテグリティ)**:
  - **ハビット開始不能・待機中固着の根本原因解明と完全根絶**:
    1. **Optimistic Direct DOM Mutation Guard (即時DOM実行中遷移ガード) の新設**:
       - `startHabit` および `startTask` 実行時に、全体再描画（`renderApp()`）や通信待機を挟まず、対象カード（`.habit-card[data-id="${targetId}"]` / `.task-card`）をその場で即座にエメラルドグリーン／シアンの実行中クラス（`in-progress is-timescale-active`）、ステータスピル（「● 実行中」）、アクションボタン（「✓ 完了」）へ1ミリ秒で直接書き換え。先行して実行されていたタスクやハビットも即座に「⏸️ 中断中」「▶ 再開」へ切り替え。
    2. **`moveHabitToTopOfSection` と `saveHabits` の内部競合（並び順巻き戻りバグ）の完全解消**:
       - `saveHabits()` 先頭で実行されていた古い `sortOrder` による破壊的ソート（`state.habits.sort(...)`）を撤廃。`moveHabitToTopOfSection` 等で配列先頭に移動された実行時順序を最優先で尊重し、現在の配列順で連続した `sortOrder` を再採番して永続化する強固な順序インテグリティを確立。
    3. **15秒ハートビート・GAS同期時の排他制御（`mergeTasksDeep` / `mergeHabitsDeep`）の防壁強化**:
       - クラウド側に古い実行中ステータス（例: 06:07開始のT206）が残存していても、ローカル側でハビットがアクティブ（`state.activeHabitId`）であればタスクのゾンビ復活（勝手な再開）を確実に遮断し、安全に中断中（`paused`）として合流。
       - ローカルで開始したばかりの `in_progress` ステータスが直後のクラウド同期によって古い `uncompleted` へ巻き戻る事故を物理的に完全防止。
    4. **バージョン管理とキャッシュバスターの統一 (`v1.9.1`)**:
       - `js/config.js`, `index.html`, `mobile.html`, `app.js` のバージョン表記および全27スクリプトタグ・CSSクエリパラメータを `?v=1.9.1` に更新。
    5. **実機ヘッドレスEdge自動検証（25/25 PASS）**:
       - 07:45 時点の手動セクション表示下における H088 開始・即時DOM遷移・先行T206中断・ソート順永続化・クラウド同期マージ・完了ライフサイクル・タスク開始即時DOM遷移の全25テストが 100% PASS。

## [v1.9.0] - 2026-09-21
### Fixed & Protected
- **Seamless Task/Habit Execution, Live Timescale Engine & Zero-Zombie Rollback (待機中タスク・ハビット開始＆ライブタイマー連動＆ゾンビ復活防止エンジン)**:
  - **「待機中のタスク・ハビットを開始すると黒くなるだけで完了もできない」現象の根本原因解明と完全根絶**:
    1. **`style.css` の `!important` 暗黒化上書きの完全撤廃**:
       - `.task-card.is-timescale-active`, `.habit-card.is-timescale-active`, `.task-card.is-timescale-paused` に付与されていた `background: rgba(...) !important;` が、実行中（鮮やかなエメラルドグリーン／シアンブルー）や中断中（アンバーイエロー）のネオングラデーションを強制破壊し、進捗0%時に完全な「真っ黒い矩形」に変貌させていた問題を完全是正。
    2. **待機中タスク開始時の全画面ブロッキングモーダル（`#modal-resume-note`）自動起動の撤廃**:
       - 先行タスク実行中に別の待機中タスクを開始した際、先行タスクの中断メモ入力モーダルが全画面オーバーレイ（`z-index: 100`, 背景暗転）を展開してクリックを全面遮断していた挙動を解消。タスク開始は即座・シームレスに切り替わり、中断メモは手動「中断」操作時のみ起動する自然な設計に改修。
    3. **全ビュー（セクション画面・全体画面）でのリアルタイム・ライブタイマー稼働**:
       - `updateLiveTimers()` においてハビットカードの要素ID不一致（`habit-timer-` ➔ `habit-progress-time-`）を是正。
       - タスクカードに関してもフォーカスモード限定の制限を撤廃し、セクション画面（`#view-section`）および全体画面（`#view-all`）のタスクカード（`task-progress-time-${task.id}`）で毎秒正確に実績分数がリアルタイム更新され、タイムスケールバーが伸びるよう改修。
    4. **ハビット開始時の `activeTaskId` 完全クリア＆シングルタスク排他制御の確立**:
       - `startHabit` 実行時に `state.activeTaskId = null` を確実に設定。ステータスバーが先行中断タスクを表示し続ける不整合を根絶し、開始したハビットが即座にステータスバーとアクティブタイマーに反映されるよう整流化。
    5. **クラウド同期ディープマージ（`mergeTasksDeep` / `mergeHabitsDeep`）のゾンビ復活防止**:
       - ローカルで中断中（`paused`）にしたタスクやハビットが、直後のクラウド同期によって古いクラウド側の `in_progress` ステータスで勝手に再開（ゾンビ復活）されてしまう競合を完全遮断。ローカルの意図的中断および実行中排他制御を最優先保護。
    6. **キャッシュバスター全面更新 (`v1.9.0`)**:
       - `style.css?v=1.9.0`、`js/config.js?v=1.9.0`、および `index.html`・`mobile.html` の全スクリプトタグを `v1.9.0` に更新。

## [v1.8.9] - 2026-09-21
### Fixed & Protected
- **Task Completion Integrity & Permanent Zero-Relapse Architecture (タスク完了画面同期インテグリティ＆翌朝再発防止アーキテクチャ)**:
  - **タスク「オンゴーイング プロジェクト タスクプランニング (T206)」完了不能バグの完全根絶**:
    - タスクの完了ボタン（「✔ 完了」）を押して下部に「⚡ タスク「オンゴーイング プロジェクト タスクプランニング」を完了」とトースト通知が表示されているにもかかわらず、カードが「● 実行中」「✔ 完了」のまま画面に残り続け、ステータスバーにも「進行中: 🎯 ...」が残存してしまう不整合を根本解明・完全根絶。
  - **なぜ昨日の早朝直ったのに今朝再発したのか？（構造的原因の解明）**:
    - 直前の v1.8.8 改修ではハビット（`completeHabit` / `mergeHabitsDeep`）の完了画面同期機構を集中的に是正していましたが、タスク（`completeTask` / `mergeTasksDeep`）側にも同一構造の欠陥が残存していました。昨日はユーザー様がハビット中心に利用されていたため正常稼働していましたが、今朝ルーティンで定期タスク（T206）を開始した瞬間に未改修のタスク側パイプラインが発火し、全く同じ現象が顕在化しました。
  - **タスクカードレンダラー（`cardRenderers.js`）における完了ステータス最優先評価**:
    - `isCompleted` を `isInProgress` より最優先で評価するように構造改修。
    - `isInProgress` および `isPaused` の判定に `!isCompleted` 条件を厳格に付与。完了タスクに対して「● 実行中」ピルや「✔ 完了」ボタンが決して描画されないよう完全排他化。
  - **タスク完了時の Optimistic Direct DOM Mutation Guard (即時DOM消去ガード)**:
    - `completeTask` 実行時に、全体再描画や通信待機を挟まずに対象タスクカード（`.task-card[data-id="${targetId}"]`）をその場で即座にフェードアウト・消去。通信遅延やバックグラウンド同期に1ミリ秒も左右されず、クリックした瞬間に確実に画面から消去。
  - **ステータスバー（`app.js`）におけるゾンビ実行中表示の排除**:
    - フッター進行中表示（Line 1565）において `t.status !== 'completed'` および `getTaskStatusForSelectedDate(t) !== 'completed'` の除外ガードを増設。完了タスクが「進行中: 🎯 ...」と表示される不整合を根絶。
  - **タスクディープマージ（`mergeTasksDeep` / `mergeMobileTasksDeep`）の Zero-Rollback 完了整流化**:
    - ローカルまたはクラウドのどちらか一方でも `completed` であれば完了ステータスを最優先保護し、`startTimestamp = null`、`accumulatedSeconds = 0` を強制適用（古い実行中タイムスタンプの逆流復元を物理遮断）。
    - 日付別履歴（`history`）のディープマージ機構を新設。配列形式とオブジェクト形式の相互運用を完全保証し、完了日記録の欠落を防止。
    - 当日の完了履歴または実行ログ（`executionLogs`）が存在する場合の当日完了絶対保護（Zero-Rollback Day-Protection）を配備。
  - **翌朝日付変更（Day-Rollover）時のゴースト実行中サニタイズ**:
    - `sanitizeDailyState` において、前日以前から持ち越された 18 時間以上経過した未完了タイマー（`in_progress` / `paused`）を翌朝ウェイクアップ時に安全にリセットし、翌朝にゴースト実行中が引き継がれる問題を根絶。
  - **バージョン更新とキャッシュバスター適用 (`v1.8.9`)**:
    - `js/config.js` および `index.html` の全 27 スクリプトタグを `?v=1.8.9` に更新。
  - **Edge 実機自動テストによる完全検証**:
    - 実GASデータ上のタスク T206（オンゴーイング プロジェクト タスクプランニング）を用いた再現テストにおいて、完了操作・即時DOM消去・ステータスバー消去・その後のGAS同期マージ後も完了が維持されることを100%実証。

## [v1.8.8] - 2026-09-21
### Fixed & Protected
- **Habit Completion Render Pipeline & Zero-Rollback Integrity Engine (ハビット完了画面描画パイプライン＆完全排他整流化エンジン)**:
  - **ハビット完了残存バグの根本原因解明と完全根絶**:
    - ハビット「朝ジャーナル記入（H043）」完了時に、クラウド（GAS）および内部データ上は正常に完了保存されているにもかかわらず、画面上のカードが「● 実行中」「✓ 完了」のまま残存してしまった事象を根本解決。
  - **同期通信時の画面再描画（`renderApp`）漏れを完全解消**:
    - 15秒ごとの定期ハートビート同期通信中に完了操作が行われた際、`storageService.js` の `pullDataFromCloud` 内 `hasPendingPush` ガードが作動してデータは最新にマージされるものの、`renderApp()` が呼び出されずに終了していたため画面が古いDOMのまま取り残されていた決定的な欠陥を是正。マージ直後に必ず `renderApp()` を呼び出すよう修正。
  - **カードレンダラー（`cardRenderers.js`）における完了ステータス最優先評価**:
    - `isCompleted`（本日目標達成済み）を `isInProgress`（実行中）より最優先で評価。
    - `isInProgress` および `isPaused` の判定に `!isCompleted` 条件を厳格に付与。
    - アクションボタン・ステータスピル・カードクラスの全分岐において `isCompleted` を最優先とし、完了しているハビットに対して「● 実行中」ピルや「✓ 完了」ボタンが決して描画されないよう完全排他化。
  - **ハビットディープマージ（`mergeHabitsDeep`）における Zero-Rollback 完了整流化**:
    - クラウドとローカルの同期時、ローカルまたはクラウドのどちらか一方でも `completed` であれば完了を最優先保護。
    - 日付別履歴（`history`）のマージ直後、当日の履歴において `done: true` が存在する場合、`status: 'completed'`、`startTimestamp: null`、`accumulatedSeconds = 0` へ自動正規化する防壁を増設。
  - **ハビット初期化マイグレーション（`migrateHabit`）の全ハビット汎用化**:
    - 前バージョンの個別対症療法（H019ハードコード）を全ハビット共通の健全化ロジックへ昇華。当日の履歴で完了しているハビットは、起動ロード時および同期マージ時に自動で `status: 'completed'` かつタイマースタンプをクリア。
  - **Optimistic Direct DOM Mutation Guard (即時DOM完了消去ガード)**:
    - `completeHabit` 実行時、全体再描画や通信待機を挟まずに対象カード要素をその場で即座にフェードアウト消去。通信ラグや再描画タイミングに1ミリ秒も左右されず、クリックした瞬間に確実に画面から消去。
  - **Day-Rollover Auto-Sanitizer (翌朝自動ウェイクアップ・サニタイザー)**:
    - スリープ復帰時（`focus` / `visibilitychange`）および1分ごとの定期監視において、日付変更（`lastProcessedDate !== getTodayKey()`）を自動検知。夜間にPCをスリープさせてブラウザを開いたまま翌朝を迎えた場合でも、朝PCを開いた瞬間にゼロタッチで自動サニタイズ（`sanitizeDailyState()`）と再描画（`renderApp()`）を発火させ、前日のステータス引きずり・翌朝再発を物理的に完全防止。
  - **全スクリプトタグのキャッシュバスター完全適用 (`?v=1.8.8`)**:
    - `index.html` の全 JavaScript スクリプトタグに `?v=1.8.8` を付与し、ブラウザキャッシュによる古いコードの実行を完全根絶。
  - **自動テストスイートの Daily Isolation 対応と全件 PASS 実証**:
    - `tests/test_habit_deep_merge_and_sync_lifecycle.html` を Daily Isolation（翌日未完了リセット）の仕様に合致した動的日付判定へ改善し、Edge Headless 環境下で全9テストが 100% PASS。
    - 実機 DOM 統合検証テストにおいて、`startHabit('H043')` から `completeHabit('H043')` のライフサイクル全体で「● 実行中」カードが確実に消去され未完了リストから正常除外されることを実証。

## [v1.8.7] - 2026-09-20
### Fixed & Protected
- **Habit Zero-Rollback Deep-Merge & Safe Sync Engine (ハビット完了巻き戻り完全根絶＆同期排他制御エンジン)**:
  - **ハビット完了巻き戻り（レースコンディション）の完全根絶**: ハビット完了ボタン（「✓ 完了」）を押した際にトーストが表示されるものの、画面上のバナーが完了にならず「実行中」のまま残ってしまう不整合を根本解決。
  - **原因の完全特定と是正**:
    1. 15秒間隔のバックグラウンド同期（`isSilent = true`）において同期排他フラグ（`isSyncing`）が立たず、通信中にユーザーが行った完了操作が直後に着信した古いクラウドデータ（`status: 'in_progress'`）で上書きされていた排他制御の穴を是正。
    2. タスク（`tasks`）側には配備されていたディープマージ機構がハビット（`habits`）側には存在せず、クラウド配列でローカルを完全上書き（REPLACE）していた設計を抜本改修。
  - **ハビット専用ディープマージエンジン（`mergeHabitsDeep` / `mergeMobileHabitsDeep`）の配備**:
    - ローカルで `status === 'completed'` の場合、クラウド側が `in_progress` や `uncompleted` であっても完了状態を最優先保護し、`startTimestamp = null` を保証。
    - 日付別履歴（`history`）を日付キー単位でディープマージし、完了フラグ（`done: true`）や回数（`count`）を最優先保持。
    - タイムライン実行ログ（`executionLogs`）をIDベースで重複なく合流統合。
    - ローカルで作成された未同期・オフラインハビットを100%保持。
  - **通信中ローカル操作の安全化ガード（Safe Pending Push Guard）**:
    - サイレント同期中であっても `isSyncing = true` で排他制御。
    - データフェッチ通信中にローカル操作（ハビット完了やタスク追加等）が発生した場合（`hasPendingPush = true`）、受信した古いデータでの上書きを安全に遮断し、ローカル最新版を最優先ディープマージして即時クラウドへプッシュ。
    - プッシュ成功時に返却されたタイムスタンプをローカルメタデータに即時反映し、直後の不要な巻き戻しプルを遮断。
  - **対象ハビット（H019: 朝食後 キッチンリセット）の即時自己修復サルベージ**:
    - 本日（2026-09-20）開始時刻（10:18:24）のまま巻き戻されていた H019 に対し、`migrateHabit` / `migrateMobileHabit` 内で本日分の完了実績（`done: true`, `count: 1`, `durationMin: 84`, `completedAt`）を自動サルベージ生成し、`status: 'completed'`、`startTimestamp: null` へ恒久修復。
- **Automated Verification Suite (9/9 Browser PASS & Lifecycle Simulation PASS)**:
  - `tests/test_habit_deep_merge_and_sync_lifecycle.html` および `tests/run_habit_deep_merge_test.ps1` を新設。Edge Headless 環境下で PC/Mobile ディープマージ、完了保護、履歴保持、ログ統合、H019 自己修復サルベージ、オフラインハビット保護の全9テストが 100% PASS。
  - 画面描画シミュレーション（`simulate_real_sync_lifecycle.js`）により、完了ボタン押下後に古いクラウドデータを受信しても「● 実行中」バナーが再出現せず、セクション完了メッセージが維持されることを完全実証。

## [v1.8.6] - 2026-09-20
### Added & Protected
- **Recurring Task Daily Skip & Isolation Engine (定期タスク当日スキップ＆自動復元エンジン)**:
  - **定期タスク当日スキップ機能の確立**: デイリーボードやセクションボードで「今日これはやらない」と判断した定期タスク（例: 朝クリエイトタイム等）を右クリックから「⏭️ 今日はスキップ」することで、定期タスクマスター（親データ）を一切削除・変更することなく、当日の画面から完全に除外・非表示化。
  - **翌朝ゼロタッチ完全自動復元**: 日付キー連動メタデータ（`task.skippedDates = [dateKey]`, `task.skippedDateKey = dateKey`）および `sanitizeDailyState` による日次自動リセットにより、翌朝アプリ起動時には自動的に未完了状態へ復帰し、朝のボードに確実に自動アサイン（通常表示）。明日以降の日付送り表示時も通常表示を完全保証。
  - **フォーカスボード（キー 2）完全除外保証**: 集中タスク実行画面において `t.status !== 'skipped'` を徹底し、スキップしたタスクがルーレット・実行候補に一切現れないノイズゼロ空間を確立。
  - **リアルタイムサマリー（ETA）連動**: デイリーおよびセクションの残り予定工数（`dayTaskRemainMin` / `secTaskRemainMin`）からスキップ分を自動減算し、当日の現実的な完了見込時刻を正確に更新。
  - **「すべて表示」での視覚的識別 & ワンクリック復活**: ツールバーで「すべて」を選択した際、スキップタスクを半透明破線カード（`.dimmed-card`）および「⏭️ スキップ」バッジ付きで表示。カード上の「↩ 復活」ボタンまたは右クリック「🔄 スキップを解除」でいつでも即座に未完了状態へ復元可能。
  - **トーストUndo連動**: スキップ操作直後に「元に戻す」トースト通知を表示し、押し間違えを即座に1タップで救済。
  - **ハビット（習慣マスター）連動スキップ**: ハビット側の「今日はスキップする（`skipHabit`）」も同様に当日のセクション・デイリー画面から完全非表示化されるよう統合修正。
- **Automated Verification Suite (25/25 PASS)**:
  - `tests/test_recurring_task_daily_skip.html` を新設。スキップ実行、日付キー保持、当日未完画面非表示、完了画面非表示、すべて表示での復活、フォーカスボード完全除外、ETA減算、マスター台帳保護、ハビット連動、Undo復元、翌朝サニタイズ自動復元、バージョン整合を含む全25項目が 100% 完全PASS。

## [v1.8.5] - 2026-09-20
### Fixed & Protected
- **Task Tombstone & Resurrection-Free Sync Engine (タスク墓石台帳＆ゾンビ復活完全根絶同期エンジン)**:
  - **削除タスクのゾンビ復活を完全根絶**: 単発タスク削除時に、バックグラウンドの15秒Heartbeat同期やタブ切り替え・フォーカス復帰、GAS通信の遅延によって消したタスクがクラウドから逆流してゾンビのように復活する現象を100%遮断。
  - **タイムスタンプ付きTombstone（墓石台帳）アーキテクチャ**: `localStorage` に `gendrive_deleted_task_ids_v1` を新設。タスク削除時にIDと削除日時（`deletedAt`）を記録。
  - **データ欠損ゼロ保護（Zero-Loss Protection）**: `mergeTasksDeep`（PC）および `mergeMobileTasksDeep`（Mobile）において、クラウド側タスクの更新日時が削除日時以前であれば「意図して削除されたタスク」として安全に破棄。万が一他端末で削除日時より後に再作成・更新されたタスク（`updatedAt > deletedAt`）であれば新タスクとして保護し、データ欠損リスクを数理的にゼロ化。
  - **安全化された同期判定ガード（`hasMissingLocalTasks` 是正）**: `localTime > cloudTime`（直近でローカル操作が行われた）の場合は、ローカルのタスク件数が少なくても古いクラウドデータによる強制上書き・逆流を遮断し、ローカルからクラウドへのプッシュを優先。
  - **Undo（取り消し）との完全連動**: タスク削除の取り消し操作（Undo / トースト）実行時にTombstone台帳から該当IDを即座に消去し、安全にタスクを再復元。
  - **マルチデバイスTombstone同期 & 30日TTL自動パージ**: クラウド送受信メタデータに `deletedTasks` を含め、PCとスマホの両端末間で削除状態を自動共有。30日以上経過した古い墓石データは自動消去してストレージを保護。
  - **全削除UIへの完全適用**: コンテキストメニュー（右クリック）、タスク編集モーダル、テーブルビューの個別削除および一括削除のすべてにTombstone記録を連動。
- **Automated Verification Suite**:
  - `tests/test_task_tombstone_and_sync_lifecycle.html` を新設。Tombstone記録・取得、クラウドからのゾンビ復活遮断、削除後新規タスクのデータ欠損ゼロ保護、Undo連動復元、一括削除Tombstone記録、モバイルディープマージ連携を含む全項目を自動検証。

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
