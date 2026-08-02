# FillIn

## 機能

- **カード自作・編集** — 英文と日本語訳を自由に登録・修正
- **聞き流しモード** — ネイティブ品質の TTS 音声を繰り返し再生。速度調整・単語隠し・段階表示・日本語→英語モード（再生頻度切り替え対応）
- **クイズモード** — 穴埋め形式で定着確認
- **間隔反復** — 忘却曲線に基づいてカードを自動スケジューリング
- **タグ管理** — カードをリスト（タグ）で整理してセッションを絞り込み

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
