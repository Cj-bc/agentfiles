---
name: git
description: git の罠 — 履歴を集計するとき `--all` は refs/stash まで含むので、数値が膨らむことがある。作業中に stash してベースラインを確かめず、worktree を使う。`add -p` が使えないときは、ステージしたい内容を作って `hash-object -w` → `update-index --cacheinfo` で一部だけをステージする。浅いクローンで `refusing to merge unrelated histories` が出たら `fetch --unshallow`。ベースを取り込んだら、コンフリクトがなくても型検査とテストを通す
type: reference
---

## 履歴の集計に `--all` を使わない
`git log --all` は `refs/stash` まで辿る。stash にほぼ全履歴の複製が載っているリポジトリでは、
コミット数・稼働日数・変更ファイル数など、すべての集計値が約 2 倍になる
（Private repositoryで観測: `--all` だと 3,814、実際は 1,936）。
集計には `--branches --tags --remotes` を使う。値が不自然に大きいときは、まず stash を疑う。

## ベースラインの確認は `git worktree` で行う。作業中に `git stash` しない（2026-10-20）
変更前のテストが通るかを確かめるために、`git stash` してバックグラウンドでビルドし、終わったら `stash pop` しようとした。
しかし待っている間に新しいファイルを書き足したので、ビルドが「半分だけ戻った」ソースを見ることになった（追跡されていない新規ファイルは `-u` なしでは stash されないため）。
`git worktree add <scratchpad>/base HEAD` で別ディレクトリに出し（ビルドに要る追跡外のファイル、例えば `local.properties` もコピーする）、そこでビルドすれば、作業ツリーに触らずに並行して確認できる。
終わったら `git worktree remove <dir>` で片付ける。

## ファイルの一部の変更だけをステージする（`add -p` が使えないとき、2026-10-26）
対話的な `git add -p` は使えない。`git diff` から一部の hunk だけを切り出して `git apply --cached --recount` しようとしたら、「patch does not apply」で失敗した（原因は未確認）。
代わりに、ステージしたい内容のファイルを作って（`git show HEAD:<path>` に必要な変更だけを足す）、
`git update-index --cacheinfo 100644,$(git hash-object -w <作ったファイル>),<path>` でインデックスに直接入れると確実。作業ツリーは触らない。
モードは `git ls-files -s <path>` で元のもの（実行可能なら `100755`）に合わせ、`<path>` はリポジトリのルートからの相対パスにする。

## `refusing to merge unrelated histories` は浅いクローンを疑う（2026-11-24、flix-agent#16）
クラウドのセッションのクローンは浅い（履歴 50 件ほど）ことがある。PR のブランチに `git merge origin/main` したら
`fatal: refusing to merge unrelated histories` で止まった。共通の祖先が取得した範囲より古かっただけで、履歴が本当に無関係なわけではない。
- `git rev-parse --is-shallow-repository` が `true` なら、`git fetch --unshallow origin` してからマージし直す。
- `--allow-unrelated-histories` で押し通さない。共通の祖先なしのマージになり、両側で内容が違うファイルはすべて add/add の衝突になる。

## ベースを取り込んだら、コンフリクトがなくても型検査とテストを通す（2026-11-24、flix-agent#16）
テキストのコンフリクトはドキュメント 1 か所だけだったが、main 側で型が別のモジュールに移っていて（`AssistantMessage.ToolName` → `Identifier.ToolName`）、
PR 側で新しく足したファイルの `use` が 8 か所壊れていた。git は別々のファイルの変更として自動マージするので、コンフリクトとしては出ない。
マージコミットを作る前に、そのリポジトリの `check` / `test`（CI と同じもの）を走らせ、直した分もマージコミットに含める。
