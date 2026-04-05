# vibe-cast

> AIに仕事奪われてみたチャンネル — リモートポッドキャスト収録・AI処理・配信ツール

2人でリモート収録して、AI文字起こし・要約・配信まで一気通貫でこなすプライベートWebアプリです。

**URL:** https://vibe-cast-tsurudai.web.app

---

## 現在の機能（実装済み）

### 収録
- **WebRTC リモート通話** — ブラウザだけで2人が接続。Zoom/Discord 不要
- **ロール制御** — Host / Guest を事前に選択。同ロール接続はブロック
- **ミックス録音** — 自分の声＋相手の声をAudioContextでミックスして1ファイルに録音
- **ゲスト自動録音** — ホストが録音開始/停止するとゲストも自動で連動
- **GCS 自動アップロード** — 収録音声を Google Cloud Storage に即保存
- **音量メーター** — マイクの入力レベルをリアルタイム表示

### AI処理
- **Whisper 文字起こし** — ホスト・ゲストの音声を個別に文字起こし
- **Gemini 要約・構造化** — テーマ・主張・合意点・対立点・問いをJSON形式で生成

---

## 今後の予定

| Issue | 内容 |
|-------|------|
| #6 | TURNサーバー追加（企業ネット等での接続改善） |
| #10 | BGM自動挿入 |
| #13 | note自動投稿 |
| #14 | RSS生成・ポッドキャスト配信（MP3変換含む） |

---

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| フロントエンド | React 18 + TypeScript + Vite 8 + Tailwind CSS v4 |
| デザイン | Material Design 3（Dark Theme） |
| リアルタイム通話 | WebRTC + WebSocket（シグナリング） |
| バックエンド | Python / FastAPI（Cloud Run） |
| 音声処理 | MediaRecorder API + AudioContext + fix-webm-duration |
| AI 文字起こし | OpenAI Whisper API |
| AI 要約 | Google Gemini 2.5 Flash |
| ストレージ | Google Cloud Storage |
| ホスティング | Firebase Hosting |
| シークレット管理 | GCP Secret Manager |

---

## ディレクトリ構成

```
vibe-cast/
├── frontend/                      # React + TypeScript
│   └── src/
│       ├── pages/
│       │   └── RecordingPage.tsx  # 収録・AI処理画面
│       └── hooks/
│           ├── useWebRTC.ts       # WebRTC 接続・シグナリング管理
│           ├── useRecorder.ts     # MediaRecorder（ミックス録音・duration修正）
│           ├── useGCS.ts          # GCS アップロード
│           └── useVolumeLevel.ts  # 音量メーター（AudioContext）
├── backend/                       # Python FastAPI
│   └── app/
│       ├── routers/
│       │   ├── signaling.py       # WebRTC シグナリング（WebSocket）
│       │   ├── audio.py           # 音声アップロードエンドポイント
│       │   └── ai.py              # 文字起こし・要約エンドポイント
│       └── services/
│           ├── transcriber.py     # Whisper 文字起こし
│           └── article_generator.py # Gemini API 要約
└── 作業ログ/                       # 日次作業メモ
```

---

## データの流れ

```
【収録】
  ブラウザA (ホスト)  ←── WebRTC P2P ──→  ブラウザB (ゲスト)
    localStream + remoteStream              localStream + remoteStream
    → AudioContext でミックス              → AudioContext でミックス
    → MediaRecorder で録音                → ホストのsession_idで自動開始
    → GCS /episodes/{id}/raw/host_track.webm
    → GCS /episodes/{id}/raw/guest_track.webm

【AI処理】（ホスト画面から操作）
  GCS の webm → Whisper API（文字起こし）→ 画面表示
  文字起こしテキスト → Gemini API（要約・構造化）→ 画面表示
```

---

## デプロイ

```bash
# フロントエンド
cd frontend && npm run build
cd .. && firebase deploy --only hosting

# バックエンド
cd backend
gcloud run deploy vibe-cast-backend \
  --source . --region asia-northeast1 --allow-unauthenticated \
  --project vibe-cast-tsurudai
```

---

## 開発フェーズ

| フェーズ | 内容 | 状態 |
|----------|------|------|
| Phase 1 | WebRTC 通話 + 個別トラック録音 + GCS 保存 | ✅ 完了 |
| Phase 2 | BGM 挿入 | 予定（#10） |
| Phase 3 | Whisper 文字起こし + Gemini 要約 | ✅ 完了 |
| Phase 4 | note 自動投稿 + RSS 配信 | 予定（#13, #14） |
