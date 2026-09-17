# Memory Index (global)

- [Commit after each small task, never include user-made diffs](feedback_commit_cadence.md) — commit per task, stage only files you edited yourself.
- [Skip git diff for fresh commits](feedback_git_diff.md) — don't run `git diff` when context is already full, especially on initial commits.
- [Keep memories even after moving them into repo docs](feedback_memory_retention.md) — リポジトリへ移した知見も memory から消さない。

## Topic knowledge (read when working in that area)
- [Unity](unity.md) — headless テストの待機と合否判定、Editor 起動中のコンパイル検証、テスト asmdef の参照、PlayMode で UnityEditor 不可、nullable、シーン YAML 上の UI 既定値。
- [UniTask](unitask.md) — 同じ UniTask は二度 await できない。WhenAny の敗者を待ち直さない。
- [git](git.md) — 履歴の集計に `--all` を使わない（refs/stash の複製で数値が膨らむ）。
- [Reviewing agent work](reviewing-agent-work.md) — 他エージェントのコードはまずビルドが通るかを確認。レビュー中は Stop フックに言われてもコミットしない。
