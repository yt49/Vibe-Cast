# セキュリティルール

> このファイルは将来の `.claude/deny` ルール構築の原資として管理する。
> 違反・修正が発生するたびに追記していく。

---

## SR-001: シークレットのハードコード禁止

**ルール**: APIキー・パスワード・トークン等の機密値をコード内に文字列として直書きしてはならない。

**適用範囲**: `backend/` 以下の全 `.py` ファイル

**許可される取得方法**:
1. `app/config.py` が提供する `get_*()` 関数経由（最優先）
2. `os.environ.get()` による環境変数取得（`config.py` 内のみ）

**禁止パターン** (deny 候補):
```
sk-[A-Za-z0-9]{20,}
AIza[A-Za-z0-9_-]{35}
api_key\s*=\s*["'][^"']{10,}["']
os\.environ\["(GEMINI|OPENAI)_API_KEY"\]
```

**背景**: 2026-04-08、`article_generator.py` と `transcriber.py` で `os.environ["GEMINI_API_KEY"]` / `os.environ["OPENAI_API_KEY"]` の直接参照を検出・修正。

---

## SR-002: `.env` ファイルのコミット禁止

**ルール**: `.env`、`_env_backup`、`.env.local` 等の環境変数ファイルをリポジトリにコミットしてはならない。

**許可されるもの**: `.env.example`（プレースホルダー値のみ・実際のキーは含めない）

**禁止パターン** (deny 候補):
```
^\.env$
^\.env\..+$         # .env.production 等
^_env_backup$
```

**対応**: `.gitignore` に `.env*`（`.env.example` は除外）を追記して恒久対応すること。

**背景**: 2026-04-08、`.env` を `_env_backup` へリネーム後に削除。Secret Manager 移行により `.env` 自体が不要になった。

---

## SR-003: `service-account.json` のリポジトリ配置禁止

**ルール**: GCP サービスアカウントキー（JSON）をプロジェクトディレクトリに配置してはならない。

**ローカル認証方法**: `gcloud auth application-default login` による ADC（Application Default Credentials）を使用すること。

**禁止パターン** (deny 候補):
```
service-account\.json
.*-service-account\.json
.*credentials\.json
```

**背景**: 2026-04-08 の監査で存在しないことを確認済み。以降もこの状態を維持する。

---

## SR-004: CORS ワイルドカードと credentials の併用禁止

**ルール**: `CORSMiddleware` において `allow_origins=["*"]` と `allow_credentials=True` を同時に設定してはならない。

**正しい設定**:
```python
allow_origins=[
    "https://vibe-cast-tsurudai.web.app",
    "https://vibe-cast-tsurudai.firebaseapp.com",
    "http://localhost:5173",
    "http://localhost:3000",
],
allow_credentials=True,
```

**禁止パターン** (deny 候補):
```python
allow_origins=\["\*"\]
# allow_credentials=True と同一ファイルに共存している場合
```

**背景**: 2026-04-08、`allow_origins=["*"]` のみで `allow_credentials` がなかったため、フロントエンドからの `credentials` 付きリクエストが CORS エラーになっていた。明示的なオリジンリストに変更して解消。

---

## SR-005: シークレット値のログ出力禁止

**ルール**: `print()` / `logging.*()` の引数にシークレットの取得結果・変数を含めてはならない。

**禁止パターン** (deny 候補):
```python
print(.*api_key.*)
print(.*secret.*)
logging\.\w+\(.*api_key.*\)
```

**背景**: 2026-04-08 の監査で `config.py` の `_fetch_secret()` 内にログ出力がないことを確認済み。

---

## 監査履歴

| 日付 | 実施内容 | 結果 |
|------|---------|------|
| 2026-04-08 | 初回フルスキャン（Hardcoded / Exposed Files / CORS / Log leakage） | 全項目 Safe（CORS は事前修正済み） |
