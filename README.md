# YouTube MCP Server

Claude DesktopなどのMCP対応アプリケーションからYouTubeを自在に操作できるMCP (Model Context Protocol) サーバーです。

動画の検索、内容要約、トレンド分析、字幕取得、コメント収集など、YouTubeの情報を包括的に取得・分析できます。AIアシスタントがYouTube動画の内容を理解し、質問に答えたり、要約を作成したりすることが可能になります。

## 🌟 主な特徴

- **日本語優先設計**: 字幕・コメントのデフォルト言語が日本語
- **インテリジェント字幕処理**: 長時間動画に対応する3つの取得モード（full/smart/summary）
- **コメント全数取得**: ページネーション対応で最大1000件のコメント取得
- **包括的なフォールバック**: ytdl-core → yt-dlp自動切り替え
- **詳細なロギング**: MCP_LOG_FILEでデバッグログ出力対応

## 📋 機能一覧

### APIキー不要の機能
- **動画メタデータ取得**: 再生回数、いいね数、動画時間など
- **字幕・トランスクリプト取得**: 多言語対応、自動生成字幕対応
- **字幕ダウンロード**: SRT/VTT形式でのダウンロード
- **利用可能字幕一覧**: 動画で利用できる字幕言語の確認

### APIキー必要の機能（YOUTUBE_API_KEY）
- **動画検索**: キーワード検索、並び替え対応
- **チャンネル統計**: 登録者数、総再生回数など
- **チャンネル動画一覧**: 最新動画、人気動画の取得
- **トレンド動画**: 地域別・カテゴリ別のトレンド
- **コメント取得**: 全コメント取得、言語フィルタ対応

## 🚀 セットアップ

### 必要な環境

- Node.js 18以上
- npm または yarn
- yt-dlp (字幕機能用)
- YouTube Data API v3のAPIキー（一部機能用）

### インストール

1. リポジトリをクローン:
```bash
git clone https://github.com/okuyam2y/SubTubeMCP.git
cd SubTubeMCP
```

2. 依存関係をインストール:
```bash
npm install
```

3. yt-dlpをインストール:

**macOS/Linux:**
```bash
# Homebrewを使用
brew install yt-dlp

# または pip経由
pip install yt-dlp
```

**Windows:**
```powershell
# Python/pipがインストール済みの場合
pip install yt-dlp

# またはバイナリを直接ダウンロード
# https://github.com/yt-dlp/yt-dlp/releases から
# yt-dlp.exe をダウンロードしてPATHに追加
```

4. ビルド:
```bash
npm run build
```

5. YouTube APIキーを設定（オプション）:
```bash
export YOUTUBE_API_KEY="your-youtube-api-key"
```

## 🖥️ Claude Desktopへの組み込み

### 1. 設定ファイルの場所

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 2. 設定ファイルの編集

```json
{
  "mcpServers": {
    "youtube": {
      "command": "node",
      "args": ["/path/to/YoutubeMcpServer/dist/index.js"],
      "env": {
        "YOUTUBE_API_KEY": "your-youtube-api-key-here",
        "MCP_LOG_FILE": "/tmp/youtube-mcp.log"
      }
    }
  }
}
```

**Windows\u306e\u4f8b:**
```json
{
  "mcpServers": {
    "youtube": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\YoutubeMcpServer\\dist\\index.js"],
      "env": {
        "YOUTUBE_API_KEY": "your-youtube-api-key-here",
        "MCP_LOG_FILE": "C:\\temp\\youtube-mcp.log"
      }
    }
  }
}
```

**重要な設定項目：**
- `args`: dist/index.jsへの絶対パスを指定
- `YOUTUBE_API_KEY`: 検索・コメント機能に必要（なくても基本機能は動作）
- `MCP_LOG_FILE`: デバッグログの出力先（オプション）

### 3. Claude Desktopを再起動

設定後、Claude Desktopを完全に終了して再起動してください。

## 📖 使い方

詳細な使い方は [USAGE_GUIDE.md](./USAGE_GUIDE.md) を参照してください。

### 基本的な使用例

```
# 動画検索
YouTubeで「React tutorial」を検索して

# 字幕取得（結論重視）
この動画の内容を結論重視で要約して
https://www.youtube.com/watch?v=xxxxx

# コメント全取得
この動画のコメントを全部取得して
https://www.youtube.com/watch?v=xxxxx

# チャンネル最新動画
このチャンネルの最新動画を10本見せて
チャンネルID: UCxxxxx
```

## 🛠️ 利用可能なツール

### 1. search_videos
動画を検索します。
- `query`: 検索キーワード
- `maxResults`: 最大結果数（1-50）
- `order`: 並び順（date/rating/relevance/viewCount）

### 2. get_video_metadata
動画の詳細情報を取得します。
- `videoId`: YouTube動画ID

### 3. get_transcript ⭐
動画の字幕を効率的に取得・処理します。
- `videoId`: YouTube動画ID
- `lang`: 言語コード（デフォルト: ja）
- `mode`: 取得モード（デフォルト: full）
  - `full`: 全セグメント順次取得（デフォルト）
  - `smart`: バランス型（冒頭20% + 中盤30% + 結論50%）
  - `summary`: 結論重視（冒頭10% + 中盤20% + 結論70%）
- `maxSegments`: 最大セグメント数（デフォルト: 5000、約6時間の動画まで対応）

**字幕クリーニング機能:**
- プログレッシブ重複削除（「こんにちは」→「こんにちは世界」のような段階的重複を除去）
- 話者ラベル保持（【Speaker】、[Name]:、SPEAKER: などの文脈情報を維持）
- 音楽・効果音除去（[音楽]、[拍手]、♪♪♪などのノイズを削除）
- 半角カタカナ変換（ｱｲｳ → アイウ）
- HTMLエンティティデコード（&amp; → &）

### 4. get_comments ⭐
コメントを取得します（ページネーション対応）。
- `videoId`: YouTube動画ID
- `maxResults`: 1ページあたりの最大数
- `sortBy`: 並び順（relevance/new）
- `lang`: 言語フィルタ
- `fetchAll`: 全コメント取得（最大10ページ）
- `pageToken`: ページトークン

### 5. get_channel_videos
チャンネルの動画一覧を取得します。
- `channelId`: YouTubeチャンネルID
- `maxResults`: 最大結果数
- `order`: 並び順（date/viewCount/rating）

### 6. get_channel_stats
チャンネルの統計情報を取得します。
- `channelId`: YouTubeチャンネルID

### 7. get_trending_videos
トレンド動画を取得します。
- `regionCode`: 国コード（JP/US等）
- `categoryId`: カテゴリID
- `maxResults`: 最大結果数

### 8. download_subtitles
字幕ファイルをダウンロードします。
- `videoUrl`: YouTube動画URL
- `lang`: 言語コード（auto=日本語優先）
- `format`: フォーマット（srt/vtt/json）

### 9. list_available_subtitles
利用可能な字幕一覧を取得します。
- `videoUrl`: YouTube動画URL

## 🏗️ プロジェクト構造

```
YoutubeMcpServer/
├── src/
│   ├── index.ts           # メインサーバー
│   ├── handlers/          # 機能別ハンドラー
│   │   ├── video.ts       # 動画関連
│   │   ├── channel.ts     # チャンネル関連
│   │   ├── subtitle.ts    # 字幕関連（重複削除・クリーニング処理含む）
│   │   └── comment.ts     # コメント関連
│   ├── utils/             # ユーティリティ
│   │   ├── logger.ts      # ロギング
│   │   ├── validation.ts  # 入力検証
│   │   └── helpers.ts     # ヘルパー関数
│   └── types/             # 型定義
├── dist/                  # ビルド済みファイル
├── temp/                  # 一時ファイル（.gitignore）
├── package.json           # Node.js依存関係とスクリプト定義
├── package-lock.json      # 依存関係のバージョンロック
├── tsconfig.json          # TypeScriptコンパイラ設定
├── claude_desktop_config.example.json  # Claude Desktop設定サンプル
├── yt-dlp-config.json     # yt-dlp（字幕取得）の設定
├── USAGE_GUIDE.md         # 詳細な使い方ガイド
└── README.md              # このファイル
```

### 📄 主要ファイルの説明

- **claude_desktop_config.example.json**: Claude Desktop用の設定ファイルサンプル。実際の環境に合わせてパスとAPIキーを設定してください
- **yt-dlp-config.json**: YouTube字幕取得時の詳細設定（ユーザーエージェント、リクエストヘッダー等）。通常は変更不要
- **package.json**: プロジェクトの依存関係とnpmスクリプトを定義
- **tsconfig.json**: TypeScriptのコンパイル設定

## 🔧 開発

### 開発モードで実行
```bash
npm run dev
```

### ビルド
```bash
npm run build
```

### 型チェック
```bash
npm run typecheck
```

## 🐛 トラブルシューティング

### Claude DesktopでMCPサーバーが認識されない

1. **JSON構文を確認**
```bash
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | python -m json.tool
```

2. **ログを確認**
```bash
# MCP_LOG_FILEを設定している場合
tail -f /tmp/youtube-mcp.log
```

3. **Node.jsパスを確認**
```bash
which node
# 出力されたパスをconfigのcommandに使用
```

### yt-dlpエラー

```bash
# 最新版に更新
brew upgrade yt-dlp
# または
pip install --upgrade yt-dlp
```

### APIクォータエラー

YouTube API使用量が制限を超えた場合：
- Google Cloud ConsoleでAPI使用量を確認
- 必要に応じてクォータ制限の引き上げをリクエスト

## 📝 更新履歴

### v1.5.0 (2025-01-12)
- 🎯 プログレッシブ重複削除アルゴリズム実装
- 💬 話者ラベル保持機能追加
- 🧹 字幕クリーニング処理の改善
- 📈 最大セグメント数を5000に増加（6時間動画対応）
- 📁 ファイル構造の整理（temp/ディレクトリ）

### v1.4.0 (2024-12-12)
- 📚 使い方ガイド（USAGE_GUIDE.md）追加
- 💬 コメント全数取得機能（ページネーション対応）
- 🎯 インテリジェント字幕サンプリング（3モード対応）
- 🇯🇵 日本語字幕のデフォルト化と改善
- 🏗️ コードのモジュール化（1142行→複数ファイル）
- 📺 チャンネル動画取得機能
- 🔧 包括的なロギング機能

## 📄 ライセンス

MIT

## 🤝 貢献

Issue や Pull Request は大歓迎です！
[GitHub リポジトリ](https://github.com/okuyam2y/SubTubeMCP)

## ⚠️ 注意事項

- YouTube Data APIの使用にはAPIキーが必要です（一部機能）
- APIの使用量には制限があります
- yt-dlpの使用にはYouTubeの利用規約に従ってください
- 長時間の動画の字幕は自動的にサンプリングされます（モードで調整可能）

## 🔒 セキュリティに関する注意

このMCPサーバーはローカル環境での使用を前提としています。プロダクション環境や公開サービスとして使用する場合は、以下の追加セキュリティ対策を実装してください：

### 利用者側で実装すべきセキュリティ対策

1. **並列実行数の制限**
   - DoS攻撃対策として、同時実行可能なリクエスト数を制限
   - レート制限の実装を推奨

2. **エラーメッセージの管理**
   - プロダクション環境では詳細なエラー情報を制限
   - システムパスなどの内部情報を含まないエラーレスポンスに変更

3. **ログレベルの適切な設定**
   - プロダクション環境ではDEBUGログを無効化
   - 機密情報がログに含まれないよう注意
   - 環境変数`MCP_LOG_LEVEL`でログレベルを制御

4. **環境変数の保護**
   - APIキーなどの機密情報は環境変数で管理
   - `.env`ファイルは絶対にコミットしない
   - 本番環境では適切なシークレット管理サービスを使用