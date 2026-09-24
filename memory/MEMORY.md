# Memory Index (global)

- [Commit after each small task, never include user-made diffs](feedback_commit_cadence.md) — commit per task, stage only files you edited yourself.
- [Skip git diff for fresh commits](feedback_git_diff.md) — don't run `git diff` when context is already full, especially on initial commits.
- [Keep memories even after moving them into repo docs](feedback_memory_retention.md) — リポジトリへ移した知見も memory から消さない。

## Topic knowledge (read when working in that area)
- [Refactoring](refactoring.md) — 正規表現の一括置換は連番・PascalCase埋め込み参照を取りこぼす、リネームはスコープを超えない。
- [Collaboration](collaboration.md) — 似た名前のブランチは複数モデルの出力比較用のことがあり一切参照しない、リモートのベースブランチは作業前後で確認する。
- [Flix](flix.md) — Function naming with Java API alignment, visibility modifiers (pub def vs def), module system, test organization, range semantics. Build/tests can run flix.jar directly without nix.
- [Unity](unity.md) — headless テストの待機と合否判定、Editor 起動中のコンパイル検証、テスト asmdef の参照、PlayMode で UnityEditor 不可、nullable、シーン YAML 上の UI 既定値。
- [UniTask](unitask.md) — 同じ UniTask は二度 await できない。WhenAny の敗者を待ち直さない。
- [git](git.md) — 履歴の集計に `--all` を使わない（refs/stash の複製で数値が膨らむ）。
- [Reviewing agent work](reviewing-agent-work.md) — 他エージェントのコードはまずビルドが通るかを確認。レビュー中は Stop フックに言われてもコミットしない。
