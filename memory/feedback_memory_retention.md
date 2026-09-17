---
name: Keep memories even after moving them into repo docs
description: 知見をリポジトリのドキュメントへ移しても、memory からは削除しない。他プロジェクトと共通の知見として保持する
type: feedback
---

知見をリポジトリのドキュメント（`AGENTS.md` や `knowledge/` など）へ移しても、対応する memory は削除しない。

**Why:** 2026-09-14、Private repositoryの memory をリポジトリのドキュメントへ移した際、ユーザーが「user memory は他のプロジェクトでも共通な知見として保持してください」と指示した。リポジトリのドキュメントは、そのリポジトリでしか読まれない。

**How to apply:** 「リポジトリに記録済みだから memory から削除する」という整理は提案しない。
プロジェクトを跨いで使える知見は、プロジェクト単位の memory ではなくこのグローバルな memory にテーマ別のファイルとして置き、`MEMORY.md` の索引に載せる。
