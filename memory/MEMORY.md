# Memory Index (global)

- [Commit after each small task, never include user-made diffs](feedback_commit_cadence.md) — commit per task, stage only files you edited yourself.
- [Skip git diff for fresh commits](feedback_git_diff.md) — don't run `git diff` when context is already full, especially on initial commits.
- [Keep memories even after moving them into repo docs](feedback_memory_retention.md) — リポジトリへ移した知見も memory から消さない。
- [Never schedule self check-ins for GitHub issues or PRs](feedback_github_pr_checkins.md) — issue/PR はイベントで起きるので、定期チェックインは作らない（usage の無駄）。

## Topic knowledge (read when working in that area)
- [Unity](unity.md) — headless テストの待機と合否判定、Editor 起動中のコンパイル検証、テスト asmdef の参照、PlayMode で UnityEditor 不可、nullable、シーン YAML 上の UI 既定値。
- [Flix](flix.md) — 未参照の def はエラー（E7956）でビルドごと止まる。`pub mod` はパスと一致。`flix.jar` を直接叩けば nix なしで動く。
- [DateTime](datetime.md) — 4桁年に制限するなら UTC の両端を1日ずつ内側へ（01-02 / 12-30）。境界秒は proleptic Gregorian の日数から。範囲を狭めてもオーバーフローガードは消さない。
- [TDD (静的型付け)](tdd.md) — 新 API を参照するテストは先に書いても「落ちる」を確認できない。ガードは mutation で確かめる。
- [UniTask](unitask.md) — 同じ UniTask は二度 await できない。WhenAny の敗者を待ち直さない。
- [git](git.md) — 履歴の集計に `--all` を使わない（refs/stash の複製で数値が膨らむ）。
- [Reviewing agent work](reviewing-agent-work.md) — 他エージェントのコードはまずビルドが通るかを確認。レビュー中は Stop フックに言われてもコミットしない。
