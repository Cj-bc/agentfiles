---
name: git
description: git の罠 — 履歴を集計するとき `--all` は refs/stash まで含むので、数値が膨らむことがある
type: reference
---

## 履歴の集計に `--all` を使わない
`git log --all` は `refs/stash` まで辿る。stash にほぼ全履歴の複製が載っているリポジトリでは、
コミット数・稼働日数・変更ファイル数など、すべての集計値が約 2 倍になる
（Private repositoryで観測: `--all` だと 3,814、実際は 1,936）。
集計には `--branches --tags --remotes` を使う。値が不自然に大きいときは、まず stash を疑う。
