# FillIn

## 機能

- **カード自作・編集** — 英文と日本語訳を自由に登録・修正
- **聞き流しモード** — ネイティブ品質の TTS 音声を繰り返し再生。速度調整・単語隠し・段階表示・日本語→英語モード（再生頻度切り替え対応）
- **クイズモード** — 穴埋め形式で定着確認
- **間隔反復** — 忘却曲線に基づいてカードを自動スケジューリング
- **タグ管理** — カードをリスト（タグ）で整理。Listening / Quiz では複数リストを選択でき、重複カードは1枚にまとめて出題

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フロントエンド | Next.js 15 / React 19 / Tailwind CSS / Zustand |
| バックエンド | FastAPI / edge-tts / Whisper (OpenAI) |
| 音声キャッシュ | サーバーサイドで MP3 を生成・保存、ブラウザが同一オリジン経由で取得 |
| データ永続化 | ブラウザ localStorage（カード・設定） |

```
Browser
  └─ Next.js (port 3000)
        ├─ /api/tts  ──────────────┐
        └─ React UI (Zustand)      │  proxy
                                   ▼
                            FastAPI (port 9000)
                                   └─ edge-tts → audio_cache/
```

## セットアップ

**前提条件:** Node.js 20+, pnpm, Python 3.12+, uv

```bash
# バックエンド
cd api
uv sync
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 9000

# フロントエンド
cd web
cp .env.local.example .env.local   # 必要に応じて編集
pnpm install
pnpm dev
```

TTS の接続先は `web/.env.local` の `API_URL`（既定値: `http://localhost:9000`）です。
API を `--port 8000` で起動する場合は `API_URL=http://127.0.0.1:8000` を設定してください。
`NEXT_PUBLIC_API_URL` はブラウザから Whisper に接続するための設定で、TTS の接続先には使われません。
こちらも API のポートに合わせ、別端末から利用する場合は Mac の LAN IP を指定してください。
環境変数の変更が反映されない場合は `pnpm dev` を再起動してください。
