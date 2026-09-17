---
name: dual-review
description: "現在のブランチの変更を、herdr 上で走らせた 2 つのコーディングエージェント（既定: Claude Opus 5 と GPT-5.6-terra）に同一 rubric で独立レビューさせ、突合した最終レポートを作る監督ワークフロー。言語・フレームワークに依存しない骨格 + プロファイルで構成される。ユーザーが /dual-review を呼んだとき、または『2 つのエージェントでレビュー』『claude と codex でレビューさせて』のように複数エージェントによるレビューを明示的に求めたときだけ使う。単に『レビューして』と言われただけでは使わない（それは /code-review）。引数でベースブランチを指定できる: /dual-review develop"
---

# dual-review — 2 エージェント並列コードレビューの監督

あなたは **レビュワーではなく監督** である。自分でレビューを書かない。
herdr 上に 2 名のレビュワーを立て、同一の指示書を渡し、返ってきた 2 本のレビューを
**突合・裏取り・偽陽性棄却** して 1 本の最終レポートにするのが仕事。

| 役割 | 実体 | 既定モデル |
|---|---|---|
| 監督 | このセッション | — |
| reviewer 1 | herdr pane 上の `claude` / agent 名 `rv-claude` | `claude-opus-5` |
| reviewer 2 | herdr pane 上の `codex` / agent 名 `rv-codex` | `gpt-5.6-terra` |

**絶対規則**

- レビュワーの pane / タブ / agent を **勝手に閉じない・kill しない**。
  ユーザーが生の出力を読み、追加質問することがある。「閉じて」と明示されたときだけ閉じる。
- レビュワーが承認ダイアログ (`blocked`) で止まったら **自分で答えない**。ユーザーに聞く。
- リポジトリを汚さない。レビューは読み取り専用。フェーズ 0 と 5 の汚染ガードで検証する。
- 片方が失敗しても打ち切らない。生き残った側でレポートを作り、失敗を明記する。
- **この SKILL.md に特定の言語・フレームワーク・リポジトリの固有ルールを書き足さない。**
  言語 / ライブラリ依存の知識は `references/profiles/` に、リポジトリ固有の知識は
  `<repo>/.claude/dual-review-profile.md` に置く。

## 参照ファイル

| ファイル | 内容 | 読むタイミング |
|---|---|---|
| `references/repo-profile.md` | エコシステム判定・プロファイル解決・固有ルールの採取手順 | フェーズ 1 の前 |
| `references/profiles/<id>.md` | 言語 / フレームワーク依存のチェック項目（unity-csharp, typescript-node, python, …） | フェーズ 1 の前 |
| `references/review-rubric.md` | レビュー指示書のテンプレート（言語非依存の骨格） | フェーズ 2 の前 |
| `references/herdr-recipes.md` | herdr の正確な構文と実測済みの落とし穴 | フェーズ 3 の前 |
| `assets/reviewer-settings.json` | claude レビュワー用の権限設定 | フェーズ 3 |

---

## フェーズ 0 — 前提チェック

順に確認し、1 つでも落ちたら理由を述べて停止する。

```powershell
$env:HERDR_ENV -eq '1'                       # false なら「Herdr 内で実行してください」で停止
(Get-Command herdr,claude,codex -ErrorAction SilentlyContinue).Source
git rev-parse --is-inside-work-tree
```

**汚染ガードのベースライン**を必ず取り、scratch に保存する。

```
git rev-parse HEAD                >  $work/baseline-head.txt
git status --porcelain=v1 -uall   >  $work/baseline-status.txt
```

`$work` = セッションの scratchpad 配下 `dual-review/<branch>-<yyyyMMdd-HHmmss>/`。
ブランチ名の `/` は `-` に置換する。

`$work` は**スラッシュ区切りの絶対パス**で持つこと。codex の起動時に TOML 値として
埋め込むため、バックスラッシュだとエスケープで壊れる。
**レビュワーの出力先は必ず `$work` の中に置く**（codex の書き込み可能範囲がここだけになるため）。

## フェーズ 1 — レビュー対象の確定

### 1-1. ベースブランチ判定

引数があればそれを使う（存在しなければエラーで停止）。無ければ自動判定する。

**`main` をハードコードしないこと。** `main` が無く `develop` や `master` が幹のリポジトリは
普通にある（実測: 同一マシン上の 3 リポジトリで採用 base が `develop` / `develop` / `main` と
割れ、うち 1 つには `main` ブランチ自体が存在しなかった）。

候補 `origin/HEAD` `develop` `origin/develop` `main` `origin/main` `master` `origin/master` のうち
`git rev-parse --verify <cand>` が通るものだけを対象に、

```
mb    = git merge-base HEAD <cand>
ahead = git rev-list --count <mb>..HEAD
```

を計算し、**`ahead` が最小**の候補を採用する（＝いちばん近い分岐元）。
同点なら候補リストの順序で先勝ち。`ahead == 0` の候補は分岐していないので除外する。
1 つも通らなければ（孤立ブランチ / 初回コミットのみ）ユーザーに base を尋ねる。

### 1-2. プロファイルの解決

`references/repo-profile.md` に従って、このリポジトリのプロファイルを決める。優先順:

1. `<repo>/.claude/dual-review-profile.md` があればそれが**正**（リポジトリ側が持つ固有知識）。
2. 無ければエコシステムを自動判定し、`references/profiles/<id>.md` を読む。
3. どれにも当たらなければ `references/profiles/_template.md` の枠だけ使い、
   規約は監督がリポジトリの実物から採取する。

いずれの場合も、**リポジトリ固有の規約と既知の例外は毎回リポジトリの実物から採取する**
（`repo-profile.md` §2）。プロファイルに書いていない項目を推測で埋めない。

### 1-3. スナップショットの書き出し

`MB = git merge-base HEAD <base>` として `$work/` に以下を作る。
**コミット済みと未コミット（staged / unstaged / untracked）の両方が対象。**

| ファイル | 作り方 |
|---|---|
| `diff.patch` | `git diff $MB` （コミット済み + staged + unstaged を一括） |
| `diff.stat` | `git diff --stat $MB` |
| `commits.txt` | `git log --oneline --no-decorate $MB..HEAD` |
| `untracked.txt` | `git ls-files --others --exclude-standard` |
| `untracked-preview/` | untracked のうち **テキストかつ 64KB 未満**のものだけコピー。それ以外はパスとサイズを `untracked.txt` に注記 |
| `machine-audit.txt` | 1-4 の機械チェック結果 |
| `diff-digest.md` | 1-5 の巨大ファイル要約（対象が無ければ「該当なし」と書いて置く） |

`git diff $MB` は 2 点比較なので、merge-base 以降のコミットと作業ツリーの変更が
まとめて 1 つの patch に入る。`$MB...HEAD` は使わない（未コミット分が落ちる）。

### 1-4. 機械チェック（監督が先に走らせて材料にする）

レビュワーに探させると見落とすので、機械的に確実に取れるものは監督が取って渡す。
結果を `machine-audit.txt` に書く。**共通チェックは常に実行し、そのうえでプロファイルの
「機械チェック」節にあるものを追加で実行する。**

**パスを扱う git コマンドは必ず `git -c core.quotepath=false ...`（または `-z`）で呼ぶ。**
既定では非 ASCII のパスが `"\343\203\237..."` と 8 進エスケープ + 引用符付きで返り、
存在判定・比較が全滅する（日本語や絵文字を含むファイル名で実測）。

共通チェック（言語非依存）:

1. **テストの同伴**: プロダクトコードの変更があるのに、テストと判定されるパスの変更が
   **1 件も無い** 場合 `WARNING: production code changed with no test changes`。
   テストパスの判定規則はプロファイルから取る（無ければ `test` / `tests` / `spec` /
   `__tests__` / `*_test.*` / `*.test.*` / `*Test.*` / `*Tests.*` を既定に使う）。
2. **無視されるべきファイルの混入**: 追加・変更されたパスを `git check-ignore -v` に通し、
   ヒットしたものを列挙（`.gitignore` に反して追跡されている生成物）。
   加えてプロファイルの「生成物パターン」に一致するものを列挙。
3. **巨大バイナリ**: 1MB 超で追加されたバイナリのうち、LFS ポインタでないもの。
4. **衝突マーカー**: 追加行に残った `<<<<<<<` / `=======` / `>>>>>>>`。
5. **エンコーディング**: 追加されたテキストファイルの UTF-8 BOM 混入、および
   UTF-8 として不正なバイト列を含むファイル（文字化けの検出）。
6. **秘密情報らしき追加行**: `api[_-]?key` / `secret` / `password` / `token` の代入行、
   `BEGIN * PRIVATE KEY`、長いランダム英数字リテラル。**該当は 🔴 候補としてそのまま渡す。**

プロファイル固有チェックの例（Unity なら `.meta` 欠落・GUID 変更・serialized field と
シーン配線の同伴など）は `references/profiles/unity-csharp.md` にある。
**この SKILL.md にエコシステム固有のチェックを書き足さない。**

### 1-5. 巨大な機械生成テキストへの対策

**機械生成・シリアライズ由来の巨大テキスト**（Unity の `.unity` / `.prefab`、lock ファイル、
生成コード、スナップショット、`.ipynb` など。対象パターンはプロファイルが持つ）のうち、
hunk 合計が **400 行**を超えるファイルは、`diff.patch` には全文を残したまま
`diff-digest.md` に要約を作る。

```
- path/to/Generated.ext : +1240 / -37 行
  変更された主なキー / プロパティ: ...
  参照 ID の追加: 3 件 / 削除: 0 件
```

指示書では「まず digest を読み、必要な箇所だけ patch を見よ」と誘導する。
これをやらないとレビュワーのコンテキストが機械生成テキストで埋まり、
人が書いたコードが読まれない。

### 1-6. ユーザー確認（1 回だけ）

採用ベース / ブランチ / コミット数 / 変更ファイル数 / 追加削除行数 / untracked 件数 /
採用プロファイル / `machine-audit` の WARNING 有無を提示し、AskUserQuestion で
「この対象で走らせる / ベースを変える / 中止」を確認する。

誤ったベースで 2 エージェントを 30 分走らせると高くつくので、この確認は省略しない。

## フェーズ 2 — 共通レビュー指示書の生成

`references/review-rubric.md` を読み、プレースホルダを実値で置換して
`$work/review-brief-claude.md` と `$work/review-brief-codex.md` を作る。
**中身は出力先パスの 1 行を除いて完全に同一にする**（プロンプトを書き分けると比較が公平でなくなる）。

置換するプレースホルダは rubric 冒頭の表にある。値の作り方:

- `{{CONVENTION_DOCS}}` / `{{TEST_LAYOUT}}` / `{{ECOSYSTEM_CHECKS}}` / `{{KNOWN_EXCEPTIONS}}` /
  `{{EXTRA_PROHIBITIONS}}` は **プロファイル + リポジトリ実物**から作る（`repo-profile.md` §2）。
- `{{KNOWN_EXCEPTIONS}}` を空のまま渡さない。**ここを埋めるほど偽陽性が減る。**
  採取できなかった場合は「（このリポジトリでは未整備。一般則のみ）」と明記して渡す。

## フェーズ 3 — herdr で 2 レビュワーを起動

構文は `references/herdr-recipes.md` を参照。要点だけ書く。

### レイアウト

`herdr pane list --workspace $env:HERDR_WORKSPACE_ID` で **現タブの pane 数**を数える。

- **現タブが 2 pane 以上 → 新しいタブを作る。**
  `herdr tab create --workspace <ws> --label "review/<branch>" --cwd <repo> --no-focus`
  → `.result.root_pane.pane_id`
- 1 pane だけ → `herdr pane split --current --direction right --cwd <repo> --no-focus`

> なぜ新タブか: herdr のガイドは「明示的に頼まれない限り新タブを作るな」と言うが、
> 同じガイドが「使い物にならない狭い pane を作るな」とも言う。既に何枚も開いているタブに
> さらに 2 枚足すと後者に反する。レビュー用 pane は完了後も残すぶん寿命が長く、
> ユーザーが行き来する対象なので、独立したタブの方が扱いやすい。

得た root pane を **1 回だけ** `--direction right` で分割して 2 枚にする。

### 起動

モデルは **`--` 以降のネイティブ引数**で渡す（herdr 自体に `--model` は無い）。

```powershell
$settings = "$env:USERPROFILE\.claude\skills\dual-review\assets\reviewer-settings.json"

herdr agent start rv-claude --kind claude --pane <pane1> --timeout 180000 -- `
  --model claude-opus-5 --effort high `
  --setting-sources project,local `
  --settings $settings `
  --tools "Read,Grep,Glob,Bash,Write,TodoWrite"

# $work は必ずスラッシュ区切りの絶対パスにする（TOML 値として解釈されるため）
herdr agent start rv-codex --kind codex --pane <pane2> --timeout 180000 -- `
  --model gpt-5.6-terra -c model_reasoning_effort=high `
  --sandbox workspace-write -c "sandbox_workspace_write.writable_roots=[`"$work`"]" `
  --ask-for-approval never
```

各フラグの理由（変更するなら理由ごと更新すること）:

- `--setting-sources project,local` … **ユーザー設定のフックを継承させないため。**
  ユーザーの `~/.claude/settings.json` に `Stop` フック（例: 終了時に自動 commit する
  エージェントフック）が入っていると、レビュワーがそれを継承してユーザーの未コミット変更を
  巻き込んで commit しかねない。認証情報は settings.json に無いのでこの除外で壊れない。
  該当フックが無い環境でも害は無いので、常にこの指定で走らせる。
- `--settings assets/reviewer-settings.json` … 必要なツールを事前許可して
  **許可ダイアログで `blocked` にならないようにする**と同時に、`Edit` と git の
  書き込み系コマンドを `deny` で塞ぐ。deny は allow に優先する。
  **`--permission-mode bypassPermissions` は使わない**: 対話起動だと
  「Bypass Permissions mode を受け入れますか」の確認ダイアログが出て、
  `agent start` が即 `agent_not_ready` になる（2026-08-24 実測）。
  `plan` モードも Write ごと塞ぎ、終了時に ExitPlanMode で `blocked` になるので不採用。
- `--tools "Read,Grep,Glob,Bash,Write,TodoWrite"` … レポート出力に `Write` は要るが
  `Edit` / `NotebookEdit` は要らない。既存ファイルの改変経路を型で塞ぐ。
- codex の `--sandbox workspace-write` … `read-only` だとレポートファイルを書けず、
  ターミナルからの回収に頼ることになる。TUI は alternate screen を使うため長文は
  `agent read` では取り切れない（herdr ガイドの明示的な警告）。ファイル出力の方が確実。
- codex の `writable_roots` … **これが無いとレポートを書けない。**
  `workspace-write` の既定の書き込み可能範囲は `[workdir, /tmp, $TMPDIR]` で、
  Claude Code の scratchpad はここに含まれない。実際に
  `Unable to write the requested file outside the permitted workspace` で失敗した（実測）。
  `$work` を writable root に追加して解決する。
- cwd はリポジトリ … 両者にプロジェクトの規約ファイル（`CLAUDE.md` / `AGENTS.md` など）を
  自然に読ませるため。ただし workdir は常に書き込み可能なので、
  **codex にとってリポジトリは書き込み可能なまま**。
  より強く封じたいときは codex の pane だけ `--cwd $work` で起動するとリポジトリが
  OS レベルで読み取り専用になる（読み取りはサンドボックス外でも可）。その場合は
  `AGENTS.md` の自動読み込みが効かず、非 git ディレクトリの確認プロンプトで
  `blocked` になるおそれがあるので、既定は cwd = リポジトリ。
  担保は指示書の禁止事項とフェーズ 5 の汚染ガード。

上記の組み合わせは herdr 上で実起動して検証済み（2026-08-24）。
両者とも `agent_status: idle` で起動し、指示書ファイルを読んで所定のパスに出力できることを確認した。

`agent_not_ready` やタイムアウトが返ったら `herdr agent read <name> --source recent-unwrapped`
で pane の実際の出力を読む。herdr はモデル名を検証しないので、**モデル名の誤りは
起動失敗として現れる**。その旨をユーザーに報告する。

## フェーズ 4 — 実行と監視

**両方に prompt を投げてから待つ**（逐次にすると 2 倍時間がかかる）。
長文をコマンドライン引数で渡さない — 短い一行にする
（PowerShell のクォートと bracketed paste で壊れやすいため）。

```powershell
# 投げる（--wait を付けないと --timeout は指定できない。ここでは待たないので付けない）
herdr agent prompt rv-claude "Read $work/review-brief-claude.md and follow it exactly."
herdr agent prompt rv-codex  "Read $work/review-brief-codex.md and follow it exactly."

# それから順に待つ
herdr agent wait rv-claude --timeout 1800000
herdr agent wait rv-codex  --timeout 1800000
```

- **`herdr agent prompt --timeout` は `--wait` とセットでしか使えない**（単独指定は exit 2）。
  並列に走らせたいので、投げるときは `--wait` を付けず、待つのは `agent wait` に任せる。
- `--wait` / `agent wait` は既定で `idle` / `done` / `blocked` の**いずれか**で返る。
  `--until` でその既定を再指定しない（herdr ガイドが明示的に禁止している）。
- **復帰後は必ず `herdr agent get <name>` を見る。**
  `blocked` = 承認/質問ダイアログ。`agent read` で内容を読み、**ユーザーに確認**する。
  `unknown` は完了の証拠にならない。**完了判定はレポートファイルの存在で行う。**
- `herdr integration install claude|codex` が入っていない環境では、ライフサイクル検出は
  画面スクレイプになる。状態は常に疑ってかかる。
- 途中経過を見るなら `herdr agent read <name> --source recent-unwrapped --lines 60`。
  長引くときはユーザーに一言進捗を返す。

## フェーズ 5 — 汚染ガードと結果回収

```
git rev-parse HEAD                # baseline-head.txt と一致するか
git status --porcelain=v1 -uall   # baseline-status.txt と一致するか
```

**一致しなければ最終レポートの冒頭に `⚠ 汚染ガード` 節を立てて警告する。**
何が変わったかを diff で示し、`herdr agent read` の pane 履歴で犯人を特定する。
勝手に `git restore` などで戻さない — ユーザーに判断を仰ぐ。

レポート回収:

1. `$work/review-claude.md` / `$work/review-codex.md` を読む。
2. 無ければ `herdr agent read <name> --source recent-unwrapped --lines 400` にフォールバック。
3. それでも切れている（alternate screen）なら、そのレビュワーに
   「指摘 1〜5 をもう一度そのまま出力して」と追加 prompt して分割回収する。

## フェーズ 6 — 突合と最終レポート

**ここが監督の本体。2 本の連結ではない。**

1. **両者一致** → 確度高。最上位に置く。
2. **片方だけの指摘** → 監督が該当箇所を実際に読んで裏取りする。
   裏が取れたものだけ採用し、取れないものは「未確認」節に落とす。
   *他エージェントの主張を額面どおりに受け取らない。* コンパイル・型・構文が関わる指摘なら
   括弧・シンボルの実在まで確認する。
3. **両者が矛盾** → 両論併記し、監督の判断と根拠を書く。
4. **偽陽性の棄却** → 既知の例外（プロファイル）に該当する指摘は、棄却理由付きで落とす。
   落としたことを隠さず「棄却した指摘」節に残す（レビュワーの精度が見えるようにするため）。
5. 重大度を再採番し、**Approve / Approve with changes / Needs rework** の最終判定を出す。
6. 画面に表示し、同時に `$work/review-summary.md` にも保存する。

構成:

```markdown
# レビュー結果: <branch>
base `<base>` / <N> commits + 未コミット <M> ファイル / profile: <id> / reviewers: <model1>, <model2>

## 最終判定
## ⚠ 汚染ガード          ← 差分があったときだけ
## 🔴 Blocker
## 🟡 Should fix
## 🔵 Nit
## 意見が割れた点
## 棄却した指摘（偽陽性）
## 未確認・要人間判断
## レビュワーの生出力
```

各指摘の頭に出所を付ける: `[両者一致]` / `[claude のみ・監督確認済]` / `[codex のみ・監督確認済]` /
`[claude のみ・未確認]`。

## フェーズ 7 — 片付けはしない / プロファイルの育成

レビュワーは **`idle` のまま残す**。最終レポートの末尾に、ユーザー向けの操作方法を書いて終わる
（自分では実行しない）。

```
reviewer pane はそのまま残しています。
  追加質問  : herdr agent prompt rv-claude "…" --wait
  直接操作  : herdr agent attach rv-claude
  片付け    : herdr tab close <tab-id>     ← 指示があれば私が実行します
```

後続ターンでも、ユーザーが明示的に「閉じて」と言うまで閉じない。

**棄却した偽陽性が 1 件以上あった場合**、その内容は次回も同じように出る。
`<repo>/.claude/dual-review-profile.md` の「既知の例外」に追記することを**提案する**
（書式は `references/repo-profile.md` §3）。

- 提案するのはフェーズ 5 の汚染ガード**後**だけ。ガード前にリポジトリへ書き込まない。
- 実際に書くのはユーザーが同意したときだけ。監督自身の書き込みであることを明示する。
