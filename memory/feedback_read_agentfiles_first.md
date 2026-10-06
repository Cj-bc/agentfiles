---
name: Read agentfiles before starting work
description: agentfiles がセッションに含まれているときは、作業対象のリポジトリに手を付ける前に memory/MEMORY.md と関係するトピックを読む
type: feedback
---

agentfiles がセッションのリポジトリに含まれているときは、作業に取りかかる前に `memory/MEMORY.md` と、関係するトピックのファイルを読む。

**Why:** 2026-10-05、別リポジトリの多言語化タスクを agentfiles を読まずに始めたところ、ユーザーから「CI の使い方やその他の tips は agentfiles にあるので参考にしてください」と指摘された。
読んでいなかったため、既にコミットした変更で `git add -A` を使い、作業全体を 1 コミットにまとめていた（[commit cadence](feedback_commit_cadence.md) に反する）。

**How to apply:** セッション開始時にリポジトリ一覧に agentfiles があれば、まず索引を読む。
セッションで得た知見は、終わる前に agentfiles への PR にまとめる（ユーザーが求めることがある）。
