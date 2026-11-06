---
name: openai-chatgpt-plan
description: ChatGPT のサブスクリプションを自作のツールから使う公式の経路（Sign in with ChatGPT）と、公式に文書化されていない古い Codex の経路
type: reference
---

# ChatGPT のサブスクリプションを自作のツールから使う

2026-11-06 に flix-agent の引き継ぎ資料（flix-agent#2 の `docs/handoff/02c-openai-responses-adapter.md`）を書くために調べた。

## 公式の経路：Sign in with ChatGPT の「ChatGPT plan usage」

- OpenAI が公式に用意している。開始時点では、オープンソースのプロジェクト、ローカルで動く個人のプロジェクト、選ばれた非公開のアプリ（selected private apps）が使える。有料やリモートでホストするアプリは、ウェイトリスト（interest form）で申請が要る。
  出典：developers.openai.com の cookbook「Integrating Sign in with ChatGPT in your open-source app」（2026-09-28）と `/siwc/token-sharing-open-source` 以下。
- 送り先は公開の Responses API（`https://api.openai.com/v1/responses`）。`store: false` と `stream: true` が必須で、`temperature`・`max_output_tokens` などは送れない。システムプロンプトは `instructions`。関数のツールは namespace か `additional_tools` の項目で渡す（`/siwc/token-sharing-open-source/preview-limitations`）。
- 認証は OAuth の動的登録。初回は `client_id=dynamic_agent_client` と `agent_name_hint`（アプリ名）と `ext_agent_host_id` を付けて `https://auth.openai.com/api/accounts/authorize` を開き、コールバックで発行されたクライアント ID（`oaiapp_…`）を保存する。
  - `ext_agent_host_id` はホスト（インストール）ごとに 1 つ、初回のログインの前に作って保存し、使い回す。形式は JWK thumbprint の URI（推奨）、`urn:uuid:…`、`did:key:…` のどれか。
  - scope は `openid profile email offline_access resource.invoke chatgpt.tokens.use.direct`（`offline_access` がないとリフレッシュトークンが来ない）。トークンの応答で実際に許可された scope に `chatgpt.tokens.use.direct` があるかを確かめる。
  - resource は `https://api.openai.com/v1`。コールバックは `127.0.0.1`（`localhost` は不可）。
- 使えるモデルは `GET https://api.openai.com/v1/models` の `models` のうち `visibility == "list"` のもの。
- 「Continue with ChatGPT」「Using ChatGPT plan」「Manage usage」などの表示の決まりがある（`/siwc/ui-ux-guidelines`）。
- 実装の参考：pi（`badlogic/pi-mono`）の `packages/ai/src/auth/oauth/openai-chatgpt.ts`。

## 公式に文書化されていない経路（ユーザーに確認するまで使わない）

- Codex CLI のクライアント ID で OAuth し、`https://chatgpt.com/backend-api/codex/responses` に送る方法。
  - 公式ドキュメントが案内するのは公開の Responses API だけ。"Use the public Responses API endpoint above for this ChatGPT plan usage flow; do not point it at ChatGPT's backend-api endpoints."（models-and-inference）。ただしこれは Sign in with ChatGPT で得たトークンの送り先についての文で、Codex CLI のクライアント ID を使う経路を禁止するとは書いていない。
  - 規約上の扱いは確認できていない（利用規約の本文を読めなかった）。flix-agent では、ユーザーに確認するまでこの経路は使わない方針にした。
  - この経路を使っている実装：pi の「OpenAI Codex (legacy)」（`packages/ai/src/providers/openai-codex.ts`。クライアント ID は `packages/ai/src/auth/oauth/openai-codex.ts`）、tau の `src/tau_ai/openai_codex.py` と `src/tau_coding/oauth.py`。OpenCode 向けのコミュニティ製プラグインにも同じ経路のものがある（どれがどの経路かは確かめていない）。
- Codex CLI のログイン情報（`~/.codex/auth.json` など）を読み取って使う方法。公式ドキュメントには言及がない。公式の流れ（自分のアプリとして登録する）の外にある、というのは私の推測。

## 調べるときの注意

- クラウドの環境では、`developers.openai.com` は許可するホストに追加すれば `curl` で読めた。`help.openai.com` と `openai.com`（利用規約）は、追加しても 403 で読めなかった（ボット対策と思われる）。利用規約の本文はユーザーに確認してもらう。
- `WebFetch` は、許可するホストを追加した直後でも DNS で失敗した。`curl`（プロキシ経由）なら取得できた。
