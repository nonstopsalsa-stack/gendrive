# Gendrive v1.9.21 リリースノート

## 1. 🔍 事前コード分析・設計・リファクタリング分析

### 背景と課題の根本原因
全タスクおよび全ハビットを完了した状態であっても、各セクションバナーに「残7分・見込21:10・ハビット3件残り」などの不正確な数値や見込み時刻が表示される事象が発生していた。徹底的なコード分析の結果、以下の4つの複合的要因を特定した：

1. **見込み時刻の固定加算ロジック**: 従来の `calculateTaskChuteEstimates` では、セクションの時間帯（過去・現在・未来）に関わらず一律に `現在時刻 + 残り時間` を計算していた。そのため、既に終了した朝のセクションであっても「夜の現在時刻 + 残分」で見込みが算出され、セクション時間軸と完全に乖離していた。
2. **完了判定の二重化と不整合**: UI側（`allView.js` など）で `habit.status === 'completed'` を直接参照する箇所と、`taskTimerService` 等で `executionLogs` の有無を参照する箇所が混在。GAS同期実機データでは、過去日完了ハビットの `status: 'completed'` が残存していたり、当日ログのみ存在してステータスが未更新のタスクが存在し、判定の不整合が生じていた。
3. **表示フィルター適用後リストからの集計**: バナーおよび統計の集計元が、ドメインフィルターや未完了フィルター適用後の描画用配列（`itemsToRender`）を参照していたため、フィルターの切り替えによって残時間や件数が変動していた。
4. **全体とセクションの集計経路の乖離**: ヘッダーの全体集計と各セクションバナーの集計が別個のロジックで計算されており、合計値や終了時刻の整合性が保たれていなかった。また、`carryoverEngine.getTasksForSection` が過去セクションの未完了単発タスクを現在セクションへ繰り越す際、過去セクションの本来の所属タスクから除外していたため、セクション固有の残分集計が狂う副作用があった。

### 設計方針・リファクタリングアプローチ
- **単一責任エンジン新設 (`etaEngine.js`)**:
  セクション残時間（`getSectionRemaining`）、セクション見込時刻（`getSectionEta`）、日全体見込時刻（`getDayEta`）を一元管理するピュアな計算エンジンを構築。
- **時間枠に応じた厳格な見込み時刻ルール**:
  - 現在時刻がセクション開始前: `セクション開始時刻 + 残分`
  - 現在時刻がセクション枠内: `現在時刻 + 残分`
  - 現在時刻がセクション終了後: `セクション終了時刻 + 残分`（残分0分なら「達成!🎉」）
  - 見込み時刻がセクション終了時刻を超過した場合、または枠終了後に残分がある場合は `overdue: true`（赤色強調表示）を維持。
- **完了判定の統一 (`isTaskDone`, `isHabitDone`)**:
  `app.js` に共通ヘルパーを新設し、`selectedDate` を基準に `status` と `executionLogs` の両方を安全に評価。`cardRenderers.js` の `getItemRemainingMinutes` も完了時は確実に0分を返却。
- **セクション本来所属タスクの保護**:
  `carryoverEngine.getTasksForSection` に `{ nativeOnly: true }` オプションを追加。繰り越し表示の影響を受けずにセクション固有の正確な集計を実現。

---

## 2. 💡 「知ると面白い、今回の技術の仕組み」解説（エンジニア視点・ユーザー視点）

### エンジニア視点: 時間枠幾何学とクォータ非依存パイプライン
TaskChute 思想の核心は「時間は過去から未来へ不可逆で流れており、セクション枠は物理的な時間の器である」という点にあります。
従来のコードが抱えていた脆弱性は、見込み時刻（ETA）を単なるスカラー加算（`now + remaining`）として扱っていたことです。
新エンジン `etaEngine.js` では、現在時刻とセクション枠の位相関係（Before / Inside / After）を判定する3分岐ステートマシンを導入しました：

```
[セクション開始前] ────▶ ETA = セクション開始時刻 + 残り時間
[セクション枠内]   ────▶ ETA = 現在時刻 + 残り時間
[セクション終了後] ────▶ ETA = セクション終了時刻 + 残り時間 （残0なら即座に達成）
```

これにより、例えば「夜21:17に朝03:00-06:00の第1セッションを振り返る」場合でも、残り7分であれば終了時刻06:00に7分足した「06:07（枠超過overdue）」と論理的に破綻のない時刻が算出されます。また、全体見込み時刻は最終セクション（第4セッション: 21:00-23:00）の見込み時刻と厳密に結合され、全体の残り時間は全6セクションの総和として1分単位で整合します。

### ユーザー視点: 「全完了なのに残7分が出る」ストレスからの完全解放
タスクやハビットをすべて終わらせた瞬間、ヘッダーにも各セクションバナーにも鮮やかな **「✔️ 全達成!🎉」** が表示され、残時間は一切残りません。
また、日中に「あと何分でセクションが終わるか」「遅れているのか前倒しなのか」が1分刻みで正確にリアルタイム反映されます。
食材ハビットなど「習慣としては記録するが時間枠は圧迫しない」タスクは正確に集計から除外され、思考を妨げないクリーンな TaskChute 体験を提供します。

---

## 3. 🌟 Gendrive Lite [v1.9.21] の主要機能・変更点（全機能一覧）

1. **新設 TaskChute ETA 計算エンジン (`js/engine/etaEngine.js`)**:
   - `getSectionRemaining(sectionName, options)`: フィルター非依存でセクション所属全アイテム（未完了タスク・未完了ハビット）の残時間を算出（食材タグ完全除外）。
   - `getSectionEta(sectionName, now)`: セクション枠の位相に応じた厳格な見込時刻・overdue判定。
   - `getDayEta(now)`: 全セクション合計残時間および最終セクション終了見込時刻の統合。
2. **統一完了判定ヘルパー (`app.js`)**:
   - `isTaskDone(task)`: `getTaskStatusForSelectedDate` に基づき、当日ログまたはステータス完了を判定。
   - `isHabitDone(habit)`: `getHabitStatusForSelectedDate` に基づき、当日実ログまたはステータス完了を判定。
   - `cardRenderers.js`: 完了済みアイテムの残り時間は強制的に0分を返す防御機構。
3. **セクションバナー & ヘッダー表示の統合 (`js/views/allView.js`, `app.js`)**:
   - セクションバナーの「残X分 / 見込 HH:MM」および「n/m 件数」を全て新エンジン基準に同期。
   - 全完了時は「✔️ 全達成!🎉」バッジを表示。
   - フラット表示モードでも同一ロジックを適用。
4. **セクション所属タスク完全保護 (`js/engine/carryoverEngine.js`)**:
   - `getTasksForSection(sectionName, { nativeOnly: true })` により、過去セクションのタスクが繰り越し処理で集計から欠落する問題を解消。
5. **日時判定ユーティリティの柔軟化 (`js/utils/dateUtils.js`)**:
   - `detectCurrentSection(targetDate)` で任意の仮想日時を引数に取れるよう拡張（テストおよび過去検証の完全自動化）。
6. **キャッシュ・バージョン統一 (`v1.9.21`)**:
   - `index.html`, `mobile.html`, `sw.js`, `js/config.js` のキャッシュバスターを `v1.9.21`（SWキャッシュ名 `gendrive-lite-v1921`）に統一。
7. **包括的テストスイート (T1〜T10) & CDP 実機検証**:
   - 全10ケースの自動テストを作成し、全パス (10/10) を確認。
   - Headless Edge CDP によるスクリーンショット目視検証を完了。

---

## 4. 📂 変更・追加されたファイル一覧

| 種別 | ファイルパス | 変更内容 |
| :---: | :--- | :--- |
| **新規** | `js/engine/etaEngine.js` | TaskChute 形式統一 ETA 計算エンジン（残分・見込・全日集計） |
| **新規** | `tests/test_eta_engine_t1_t10.html` | T1〜T10 自動テストスイート（エッジケース完全網羅） |
| **新規** | `tests/run_eta_engine_test.ps1` | Headless Edge 自動テスト実行ランナー |
| **新規** | `tests/verify_eta_banners_visual.ps1` | CDP 実機バナー表示目視検証スクリプト |
| **新規** | `tests/eta_all_completed.png` | 全完了時バナー目視検証スクリーンショット |
| **新規** | `tests/eta_one_uncompleted.png` | 1件取消時バナー目視検証スクリーンショット |
| **新規** | `tests/eta_recompleted.png` | 1件再完了時バナー目視検証スクリーンショット |
| **修正** | `app.js` | `isTaskDone`/`isHabitDone` 統一ヘルパー追加、`calculateTaskChuteEstimates` 置換 |
| **修正** | `js/components/cardRenderers.js` | `getItemRemainingMinutes` 完了時 0分強制防御 |
| **修正** | `js/views/allView.js` | セクションバナー・統計・フラット表示の新エンジン連動 |
| **修正** | `js/engine/carryoverEngine.js` | `getTasksForSection` に `{ nativeOnly: true }` オプション追加 |
| **修正** | `js/utils/dateUtils.js` | `detectCurrentSection` に引数日時対応を追加 |
| **修正** | `js/config.js` | バージョンを `v1.9.21` に更新 |
| **修正** | `index.html` | `etaEngine.js` 読み込み追加、キャッシュバスター更新 |
| **修正** | `mobile.html` | バージョン表記およびキャッシュバスター更新 |
| **修正** | `sw.js` | `CACHE_NAME` (`v1921`) およびキャッシュ対象リスト更新 |
| **修正** | `.gitignore` | 一時ダンプ (`current_gas_*.json`) と `scratch/` を除外 |

---

## 🔗 関連ドキュメント・リンク

- 最高行動憲法: `AGENTS.md`
- アーキテクチャ規則: `PROJECT_ARCHITECTURE_RULES.md`
- 前回リリースノート: `docs/release_notes/2026-10-03_v1.9.20_mojibake_restoration_and_guard_engine.md`
- GitHub リポジトリ: [nonstopsalsa-stack/gendrive](https://github.com/nonstopsalsa-stack/gendrive)
