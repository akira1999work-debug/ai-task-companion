# AITAS 開発引き継ぎドキュメント

> **最終更新**: 2026-02-28
> **対象**: 新しい AI セッション（Gemini / Claude）がプロジェクトの経緯と現状を把握するためのドキュメント

---

## 1. プロジェクト概要

**AITAS**（アイタス）は、AI アシスタント付きのタスク管理アプリ。
ユーザーの生活スタイルに合わせた 3 つのパーソナリティ（standard / yuru / maji）で、タスクの追加・管理・振り返りをサポートする。

### コンセプト
- **Now Playing UI**: 音楽プレーヤーのように「今やるべきタスク」をフォーカス表示
- **AI カテゴリ推論**: タスク追加時に AI が自動でカテゴリを分類
- **ケアモード**: ユーザーがしんどい時に自動で彩度低下 + タスク負荷軽減
- **適応型スコアリング**: 完了率・トレンド・自己申告の3軸でユーザー状態を数値化

---

## 2. 技術スタック

| 領域 | 技術 | バージョン |
|------|------|-----------|
| フレームワーク | React Native + Expo | RN 0.81.5, Expo ~54 |
| 言語 | TypeScript | ~5.9.2 |
| UI ライブラリ | react-native-paper (MD3) | 5.15.0 |
| DB (ネイティブ) | expo-sqlite (WAL mode) | ~16.0.10 |
| DB (Web) | sql.js (localStorage 永続化) | ^1.14.0 |
| AI (クラウド) | Google Gemini API | gemini-1.5-flash |
| AI (ローカル) | Ollama | llama4 (設定変更可) |
| ハプティクス | expo-haptics | ~15.0.8 |
| アニメーション | react-native-reanimated | ~4.1.1 |
| ナビゲーション | @react-navigation (stack + bottom-tabs) | 7.x |

---

## 3. ファイル構成

```
C:\ClaudeCode\projects\aitas\
├── App.tsx                    # ルート: DatabaseProvider → AppProvider → ThemedApp
├── index.ts                   # エントリーポイント
├── package.json
├── tsconfig.json
├── vercel.json
└── src/
    ├── db/
    │   ├── database.ts        # SQLite スキーマ定義 + CRUD + マイグレーション
    │   ├── dbProvider.tsx      # 統一 DB プロバイダ (native: expo-sqlite / web: sql.js)
    │   └── webDatabase.ts     # sql.js ラッパー（expo-sqlite 互換 API）
    ├── types/
    │   ├── index.ts            # Task, ChatMessage, PersonalityType, AIProviderConfig 等
    │   ├── onboarding.ts       # TaskCategory, UserProfile, OnboardingState 等
    │   └── sql.js.d.ts         # sql.js 型定義
    ├── context/
    │   └── AppContext.tsx       # グローバル状態管理（tasks, categories, careMode 等）
    ├── theme/
    │   └── index.ts            # 3テーマ定義 + getCareTheme（HSL 彩度低下）
    ├── services/
    │   ├── aiProvider.ts       # Gemini/Ollama 統合 (hybrid mode 対応)
    │   ├── categoryInference.ts # AI カテゴリ自動分類（3段階推論）
    │   ├── displayScore.ts     # タスク表示優先度スコア（50~120）
    │   ├── onboardingService.ts # オンボーディング対話フロー
    │   └── scoreService.ts     # 適応型スコアリング（0~100）
    ├── hooks/
    │   └── useSortedTasks.ts   # スコア順ソート済みタスク hook
    ├── navigation/
    │   └── AppNavigator.tsx    # Stack(Onboarding → MainTabs → Settings) + BottomTab
    └── screens/
        ├── HomeScreen.tsx      # 「Now Playing」UI — フォーカスカード + フェーディングリスト
        ├── TaskListScreen.tsx  # タスク一覧
        ├── ReviewScreen.tsx    # AI チャット / 振り返り
        ├── OnboardingScreen.tsx # 初回セットアップ対話
        └── SettingsScreen.tsx  # 設定画面
```

---

## 4. DB スキーマ

### テーブル一覧

| テーブル | 主な列 | 用途 |
|---------|--------|------|
| `tasks` | id, title, completed, due_date, priority, task_type, category_id, reschedule_count, completed_at | タスク本体 |
| `sub_tasks` | id, task_id(FK), title, completed | サブタスク |
| `categories` | id, name, icon, color, sort_order, is_default, scaling_weight, parent_id | カテゴリ（階層化対応） |
| `chat_messages` | id, text, sender, timestamp | AI 会話履歴 |
| `settings` | key, value | KV ストア（personality, careMode, apiKey 等） |
| `reschedule_history` | id, reason, task_ids(JSON), created_at | リスケ履歴 |
| `user_profiles` | id, onboarding_raw, occupation, interests(JSON), goals(JSON) | ユーザープロファイル |

### マイグレーション方式
- `initializeDatabase()` 内で `ALTER TABLE ADD COLUMN` を try-catch で実行
- 既存カラムなら例外を無視する safe migration パターン

---

## 5. 主要機能の実装状況

### 実装済み (2026-02-28 時点)

| 機能 | 状態 | 実装箇所 |
|------|------|---------|
| SQLite DB 層 + マイグレーション | 完了 | `database.ts` |
| Web フォールバック (sql.js) | 完了 | `webDatabase.ts`, `dbProvider.tsx` |
| オンボーディング対話 (Gemini/Ollama) | 完了 | `OnboardingScreen.tsx`, `onboardingService.ts` |
| 3 パーソナリティ (standard/yuru/maji) | 完了 | `theme/index.ts`, 各画面で分岐 |
| AI 連携 (Gemini + Ollama hybrid) | 完了 | `aiProvider.ts` |
| 適応型スコアリング (0~100) | 完了 | `scoreService.ts` |
| HomeScreen "Now Playing" UI | 完了 | `HomeScreen.tsx` |
| タスク表示優先度スコア (50~120) | 完了 | `displayScore.ts`, `useSortedTasks.ts` |
| AI カテゴリ推論 (3段階) | 完了 | `categoryInference.ts` |
| カテゴリ階層化 (parent_id) | 完了 | DB + types |
| タスク-カテゴリ紐付け (category_id) | 完了 | DB + types + AppContext |
| 「今日は無理！」理由選択 UI | 完了 | `HomeScreen.tsx` 内モーダル |
| ケアモード (DB 永続化 + 自動期限) | 完了 | `AppContext.tsx` |
| ケアモード視覚効果 (彩度低下 + バナー) | 完了 | `theme/index.ts`, `App.tsx`, `HomeScreen.tsx` |
| ハプティクス | 完了 | `HomeScreen.tsx` (expo-haptics) |
| タスクリスト画面 | 完了 | `TaskListScreen.tsx` |
| レビュー/チャット画面 | 完了 | `ReviewScreen.tsx` |
| 設定画面 | 完了 | `SettingsScreen.tsx` |

### 未実装 / 今後の候補

| 機能 | メモ |
|------|------|
| カテゴリ推論のバックグラウンド自動実行 | `categoryInference.ts` は作成済みだが、`addTask` 後の自動呼び出しは未実装。AppContext 内で `addTask` → 即デフォルトカテゴリ割当 → バックグラウンド推論 → `updateTaskCategory` の非同期フローを組む必要あり |
| サブカテゴリ作成 UI | AI が `new_subcategory` を返した時のトースト表示 + ユーザー承認フロー |
| Google Calendar 連携 | フラグのみ存在（`googleCalendarEnabled`）、API 接続は未実装 |
| 音声入力（STT） | 現在はシミュレーション。expo-speech / whisper 等の統合が必要 |
| ルーティン設定・ストリーク追跡 | `scoreService.ts` にプレースホルダあり。DB に routine_config テーブル追加が必要 |
| 通知・リマインダー | 未実装 |
| クラウド同期 | UUID ベース ID で設計済み。バックエンド未構築 |
| TaskDetail 画面 | ナビゲーション定義済み (`RootStackParamList`) だが画面未作成 |
| カテゴリ別スコアリング | `scoreService.ts` の `categoryId: 'global'` をカテゴリ別に拡張 |

---

## 6. アーキテクチャ詳細

### 状態管理フロー
```
ユーザー操作
  → AppContext mutation (useState 即時更新 = optimistic)
  → DB 非同期書き込み (.catch(console.error))
  → UI は即座に反映
```

### AI 接続モード
```
local:  Ollama のみ（30秒タイムアウト）
cloud:  Gemini のみ
hybrid: Ollama (3秒タイムアウト) → 失敗時 Gemini フォールバック
```

### カテゴリ推論フロー（設計済み・自動実行は未接続）
```
タスク入力 → 即座にデフォルトカテゴリで DB 挿入 + State 反映
           → バックグラウンドで Gemini/Ollama に推論リクエスト
           → existing    → updateTaskCategory で即更新
           → new_subcategory → UI にトースト表示 → ユーザー承認 → カテゴリ作成
           → fallback    → 何もしない（デフォルトのまま）
```

### ケアモード
```
トリガー:
  - 「今日は無理！」→ rest (1日) / struggling (3日)
  - schedule_change はケアモード起動しない

効果:
  - テーマ彩度 -40 (HSL の S を下げる)
  - バナー表示（パーソナリティ別文言）
  - スコア上限 50 に制限 (scoreService.ts)

自動解除:
  - 期限切れ（careModeExpiresAt チェック）
  - 自己申告 'good' で即時解除
```

### 表示優先度スコア (displayScore)
```
base 50
+ priority: high=30, medium=15, low=0
+ scalingWeight: strict=20, normal=10, relaxed=0
+ dueDate: today/overdue=20, tomorrow=10, later=0
→ 範囲 50~120
```

---

## 7. 開発時の注意事項

### TypeScript
- `TaskCategory` オブジェクト作成時は `parentId: null` を必ず含める
- `Task` は `categoryId?: string` (optional)

### DB
- マイグレーションは `ALTER TABLE ADD COLUMN` + try-catch パターン
- WAL モード + FK 有効
- Web 版は sql.js、localStorage に base64 で永続化（2秒デバウンス）

### AI プロンプト
- オンボーディング: JSON 出力を要求（markdown code block 対応のパーサーあり）
- カテゴリ推論: JSON 出力を要求（同上）
- 会話: 直近20メッセージをコンテキストとして送信

### テーマ
- `getCareTheme()` は `themes[personality]` の全 `#RRGGBB` 色を HSL 変換 → 彩度 -40 → 再変換
- maji テーマはダークモード。StatusBar は 'light' に設定

---

## 8. ビルド・実行

```bash
# 開発サーバー
npx expo start

# Web
npx expo start --web

# 型チェック
npx tsc --noEmit

# Web ビルド
npx expo export --platform web
```

---

## 9. 開発経緯（時系列）

### Phase 1: 基盤構築
- SQLite スキーマ設計（tasks, sub_tasks, chat_messages, settings, categories, user_profiles）
- AppContext による状態管理 + optimistic update パターン
- 3 パーソナリティテーマ (standard/yuru/maji)

### Phase 2: AI 連携
- Gemini + Ollama ハイブリッド接続 (`aiProvider.ts`)
- オンボーディング対話フロー — AI がユーザーの生活を聞き出し、カテゴリを自動提案
- 適応型スコアリング (`scoreService.ts`) — 定量・トレンド・自己申告の加重平均

### Phase 3: リモデル (2026-02-28)
1. **DB 拡張**: categories に `parent_id`、tasks に `category_id` を追加（階層化 + タスク紐付け）
2. **AI カテゴリ推論サービス**: `categoryInference.ts` — シノニムマッチ → サブカテゴリ提案 → フォールバック
3. **HomeScreen "Now Playing" 化**: フォーカスカード + フェーディングリスト + スコア順ソート
4. **「今日は無理！」理由選択 UI**: 3 理由 × ケアモード自動有効化 × パーソナリティ別メッセージ
5. **ケアモード視覚効果**: HSL 彩度低下 + パーソナリティ別バナー
6. **Web フォールバック**: sql.js + DatabaseProvider による自動分岐

---

## 10. よくある開発パターン

### 新しいテーブル列を追加する場合
1. `database.ts` の `Row` インターフェースに列追加
2. `migrations` 配列に `ALTER TABLE ADD COLUMN` を追加
3. `mapRowToXxx` 関数でマッピング追加
4. `insertXxx` の INSERT 文を更新
5. `types/` の対応インターフェースを更新
6. `AppContext.tsx` で state/mutation を追加

### 新しい画面を追加する場合
1. `src/screens/XxxScreen.tsx` を作成
2. `types/index.ts` の `RootStackParamList` or `RootTabParamList` に追加
3. `AppNavigator.tsx` に Screen 登録

### AI プロンプトを追加する場合
- `aiProvider.ts` の `buildSystemPrompt` に context 分岐を追加
- JSON 出力を要求する場合はパーサーで markdown code block を strip する処理を入れる
