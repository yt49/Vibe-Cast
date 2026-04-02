# vibe-cast

> AIに仕事奪われてみたチャンネル — リモートポッドキャスト収録・編集・配信ツール

2人でリモート収録して、AI編集・文字起こし・記事化・配信まで一気通貫でこなすプライベートWebアプリです。
ZencastrやRiverside.fmのような高音質リモート収録に、AI編集と配信機能を統合しています。

---

## 機能

### 収録
- **WebRTC リモート通話** — ブラウザだけで2人が接続。Zoom/Discord 不要
- **個別トラック録音** — ホスト・ゲストの音声を別々に録音（ミックスなし）
- **GCS 自動アップロード** — 収録音声を Google Cloud Storage に即保存
- **効果音ボタン（SoundBoard）** — 収録中にワンクリックで効果音を鳴らし、タイムスタンプを自動記録

### 編集
- **フィラー音除去** — 「えー」「あー」「えっと」を自動検出・カット
- **BGM 自動挿入** — オープニング/エンディングに BGM を付与
- **効果音合成** — 収録中に押したボタンのタイムスタンプ位置に効果音を自動挿入
- **波形プレビュー** — 編集結果をブラウザ上で確認・再生

### 記事化
- **Whisper 文字起こし** — 話者ごとに分離したトランスクリプトを生成
- **Gemini API 要約・記事生成** — エピソードサマリー（200〜400字）と note 投稿用記事を自動生成
- **note 自動投稿** — 生成した記事を note.com に下書きまたは公開投稿

### 配信
- 編集・記事化完了後に「配信しますか？」確認画面を表示
- RSS フィード生成（Spotify・Apple Podcasts 等への対応基盤）

---

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | React + TypeScript + Vite |
| リアルタイム通話 | WebRTC |
| バックエンド | Python / FastAPI |
| 音声処理 | ffmpeg + Whisper |
| AI 要約・記事生成 | Gemini API |
| ストレージ | Google Cloud Storage |
| 認証 | Google OAuth 2.0 |
| note 投稿 | note.com API |
| コンテナ | Docker / Docker Compose |

---

## ディレクトリ構成

```
vibe-cast/
├── frontend/                      # React + TypeScript
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx           # エピソード一覧
│       │   ├── RecordingPage.tsx  # 収録画面
│       │   ├── EditorPage.tsx     # 編集画面
│       │   ├── ArticlePage.tsx    # 記事化画面
│       │   └── PublishPage.tsx    # 配信確認画面
│       ├── components/
│       │   ├── Recording/         # 通話UI・効果音・録音コントロール
│       │   ├── Editor/            # 波形表示・AI編集ボタン
│       │   └── Article/           # 文字起こし・記事プレビュー
│       └── hooks/
│           ├── useWebRTC.ts       # WebRTC 接続管理
│           ├── useRecorder.ts     # MediaRecorder API
│           └── useGCS.ts          # GCS アップロード
├── backend/                       # Python FastAPI
│   └── app/
│       ├── routers/
│       │   ├── signaling.py       # WebRTC シグナリング（WebSocket）
│       │   ├── audio.py           # 音声処理エンドポイント
│       │   ├── ai.py              # 文字起こし・記事生成
│       │   └── publish.py         # note 投稿・RSS 生成
│       └── services/
│           ├── audio_processor.py # ffmpeg 処理
│           ├── transcriber.py     # Whisper 文字起こし
│           ├── article_generator.py # Gemini API 連携
│           ├── note_publisher.py  # note.com 投稿
│           └── gcs_client.py      # GCS 操作
├── docker-compose.yml
└── .env.example
```

---

## セットアップ

### 前提条件

- Docker / Docker Compose
- Google Cloud プロジェクト（GCS バケット + サービスアカウント）
- Gemini API キー
- note.com アカウント（記事投稿する場合）

### 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して以下を設定してください。

```env
GEMINI_API_KEY=your_gemini_api_key
GCS_BUCKET_NAME=your_bucket_name
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
NOTE_API_TOKEN=your_note_token
```

### 起動

```bash
docker-compose up
```

ブラウザで `http://localhost:5173` を開いてください。

---

## データの流れ

```
【収録】
  ブラウザA (ホスト)  ←── WebRTC ──→  ブラウザB (ゲスト)
       ↓ host_track.webm                  ↓ guest_track.webm
                    GCS /episodes/{id}/raw/

【編集】
  GCS → ffmpeg（フィラー除去・BGM・効果音）→ episode_final.mp3

【記事化】
  episode_final.mp3 → Whisper（文字起こし）→ Gemini API（要約・記事）

【配信】
  確認UI → note.com 投稿 + RSS フィード更新
```

---

## 開発フェーズ

| フェーズ | 内容 | 状態 |
|----------|------|------|
| Phase 1 | WebRTC 通話 + 個別トラック録音 + GCS 保存 | 実装中 |
| Phase 2 | フィラー除去・BGM 挿入・効果音合成 | 予定 |
| Phase 3 | Whisper 文字起こし + Gemini API 要約・記事生成 | 予定 |
| Phase 4 | note 自動投稿 + 配信フロー | 予定 |

---

## ライセンス

Private — 個人利用のみ
