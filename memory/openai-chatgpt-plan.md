---
name: openai-chatgpt-plan
description: ChatGPT のサブスクリプションを自作のツールから使う公式の経路（Sign in with ChatGPT）と、使ってはいけない古い Codex の経路
type: reference
---

# ChatGPT のサブスクリプションを自作のツールから使う

2026-11-06 に flix-agent の引き継ぎ資料（flix-agent#2 の `docs/handoff/02c-openai-responses-adapter.md`）を書くために調べた。

## 公式の経路：Sign in with ChatGPT の「ChatGPT plan usage」

- OpenAI が公式に用意している。オープンソースのプロジェクトと、ローカルで動く個人のプロジェクトは使える。有料やリモートでホストするアプリはウェイトリストで申請が要る。
  出典：developers.openai.com の cookbook「Integrating Sign in with ChatGPT in your open-source app」（2026-09-28）と `/siwc/token-sharing-open-source` 以下。
- 送り先は公開の Responses API（`https://api.openai.com/v1/responses`）。`store: false` と `stream: true` が必須で、`temperature`・`max_output_tokens` などは送れない。システムプロンプトは `instructions`。関数のツールは namespace か `additional_tools` の項目で渡す（`/siwc/token-sharing-open-source/preview-limitations`）。
- 認証は OAuth の動的登録。初回は `client_id=dynamic_agent_client` と `agent_name_hint`（アプリ名）と `ext_agent_host_id`（インストールごとの `urn:uuid:…`）を付けて `https://auth.openai.com/api/accounts/authorize` を開き、コールバックで発行されたクライアント ID（`oaiapp_…`）を保存する。scope に `chatgpt.tokens.use.direct`、resource は `https://api.openai.com/v1`。コールバックは `127.0.0.1`（`localhost` は不可）。
- 使えるモデルは `GET https://api.openai.com/v1/models` の `models` のうち `visibility == "list"` のもの。
- 「Continue with ChatGPT」「Using ChatGPT plan」「Manage usage」などの表示の決まりがある（`/siwc/ui-ux-guidelines`）。
- 実装の参考：pi（`badlogic/pi-mono`）の `packages/ai/src/auth/oauth/openai-chatgpt.ts`。

## 使ってはいけない経路

- Codex CLI のクライアント ID で OAuth し、`https://chatgpt.com/backend-api/codex/responses` に送る方法。公式ドキュメントは "do not point it at ChatGPT's backend-api endpoints" と書いている。
  pi の「OpenAI Codex (legacy)」（`openai-codex.ts`）、tau（`huggingface/tau`）の `openai_codex.py` / `oauth.py`、OpenCode のコミュニティ製プラグインの多くがこの経路。
- Codex CLI のログイン情報（`~/.codex/auth.json` など）を読み取って使う方法も、公式の流れの外。

## 調べるときの注意

- クラウドの環境では、`developers.openai.com` は許可するホストに追加すれば `curl` で読めた。`help.openai.com` と `openai.com`（利用規約）は、追加しても 403 で読めなかった（ボット対策と思われる）。利用規約の本文はユーザーに確認してもらう。
- `WebFetch` は、許可するホストを追加した直後でも DNS で失敗した。`curl`（プロキシ経由）なら取得できた。
