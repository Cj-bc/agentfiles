# herdr 操作レシピ（PowerShell / dual-review 用）

herdr の**バイナリが常に正**。バージョンが上がると構文が変わる。挙動が食い違ったら
`herdr --skill` と `herdr agent` / `herdr pane` の group help を読み直すこと。
このファイルは herdr `0.8.2-preview` 時点で実測した内容。

## 0. 前提と落とし穴

- **素の `herdr` を実行しない** — TUI が起動または attach してしまう。
- **`herdr workspace create` のような mutating コマンドを引数なしで叩かない** — 既定値で実行される。
  一方 `herdr agent` / `herdr pane` のように group 名だけを叩くのは help が出るだけで安全
  （exit code 2 になるが失敗ではない）。
- 応答は 1 行 JSON。**ID は必ず JSON から取る**。サイドバーの並び順や例から推測しない。
- サーバーエラーは stderr に JSON + exit 1、CLI 構文エラーは exit 2。
  PowerShell ツールは非ゼロ exit を失敗として扱うので、**エラー本文を読みたいときは
  `2>&1 | Out-String` を付ける**。
- 自分が作っていない pane / tab / workspace を閉じない。
- `herdr server stop` を実行しない。

## 1. 自分の位置を知る

```powershell
$env:HERDR_ENV          # '1' でなければ Herdr 外 → 停止
$env:HERDR_WORKSPACE_ID # 例: w1
$env:HERDR_TAB_ID       # 例: w1:t1
$env:HERDR_PANE_ID      # 例: w1:pP
```

```powershell
herdr workspace list
herdr tab list --workspace $env:HERDR_WORKSPACE_ID
herdr pane list --workspace $env:HERDR_WORKSPACE_ID
herdr pane layout --pane $env:HERDR_PANE_ID
herdr agent list
```

JSON の取り出しは `ConvertFrom-Json` でパスを辿る。

```powershell
$panes = (herdr pane list --workspace $env:HERDR_WORKSPACE_ID | ConvertFrom-Json).result.panes
$sameTab = @($panes | Where-Object { $_.tab_id -eq $env:HERDR_TAB_ID })
$sameTab.Count      # 現タブの pane 数 → 2 以上なら新タブを作る
```

## 2. レビュー用のタブと 2 pane を作る

```powershell
$repo = (git rev-parse --show-toplevel)

# 現タブが混んでいる場合: 専用タブ
$tab = (herdr tab create --workspace $env:HERDR_WORKSPACE_ID `
          --label "review/$branch" --cwd $repo --no-focus | ConvertFrom-Json).result
$tabId  = $tab.tab.tab_id
$pane1  = $tab.root_pane.pane_id

# 現タブが 1 pane だけの場合はこちら
# $pane1 = (herdr pane split --current --direction right --cwd $repo --no-focus | ConvertFrom-Json).result.pane.pane_id

# 2 枚目
$pane2 = (herdr pane split $pane1 --direction right --cwd $repo --no-focus | ConvertFrom-Json).result.pane.pane_id

herdr pane rename $pane1 "review: claude"
herdr pane rename $pane2 "review: codex"
```

`--no-focus` を必ず付ける（ユーザーのフォーカスを奪わない）。
`--cwd` は PowerShell では `$PWD.Path` か明示の絶対パスを渡す（`"$PWD"` は展開が期待と違うことがある）。

ID の在り処:

| コマンド | ID のパス |
|---|---|
| `workspace create` | `.result.workspace` / `.result.tab` / `.result.root_pane` |
| `tab create` | `.result.tab.tab_id` / `.result.root_pane.pane_id` |
| `pane split` | `.result.pane.pane_id` |
| `pane move` | `.result.move_result.pane.pane_id`（旧 ID は再利用しない） |

## 3. エージェントを起動する

`agent start` は **既存の空いた shell pane** を要求する。pane を作ったりはしない。
pane がプロンプト状態（前景にコマンド無し）であることが条件。

```powershell
$settings = "$env:USERPROFILE\.claude\skills\dual-review\assets\reviewer-settings.json"

herdr agent start rv-claude --kind claude --pane $pane1 --timeout 180000 -- `
  --model claude-opus-5 --effort high `
  --setting-sources project,local `
  --settings $settings `
  --tools "Read,Grep,Glob,Bash,Write,TodoWrite"

herdr agent start rv-codex --kind codex --pane $pane2 --timeout 180000 -- `
  --model gpt-5.6-terra -c model_reasoning_effort=high `
  --sandbox workspace-write -c "sandbox_workspace_write.writable_roots=[`"$work`"]" `
  --ask-for-approval never
```

- **herdr に `--model` は無い。** モデル指定は `--` 以降のネイティブ引数。
  herdr はこの引数を検証しないので、**モデル名を間違えると CLI が即終了し
  `agent_not_ready` かタイムアウトになる**。
- agent 名は `[a-z][a-z0-9_-]{0,31}` で、生存中の agent 間で一意。
- `--timeout` の既定は 30000ms、最大 300000ms。TUI の初回起動は遅いので 180000 を渡す。
- 起動に失敗したら `herdr agent read <name> --source recent-unwrapped --lines 60` で
  pane の実際の出力（エラーメッセージ）を読む。

### 起動時に踏んだ罠（実測 2026-08-24）

1. **`claude --permission-mode bypassPermissions` は使えない。**
   対話起動だと「Bypass Permissions mode を受け入れますか」の確認ダイアログが出て、
   `agent start` が `{"error":{"code":"agent_not_ready"}}` を返す。
   代わりに `--settings assets/reviewer-settings.json` で必要なツールを事前許可する。
   （復旧は `herdr agent send-keys <name> esc` でダイアログを閉じ、pane をプロンプトに戻す。）
2. **codex の `writable_roots` を指定しないとレポートを書けない。**
   `workspace-write` の既定の書き込み可能範囲は `[workdir, /tmp, $TMPDIR]` で、
   Claude Code の scratchpad（`%LOCALAPPDATA%\Temp\claude\...`）はここに入らない。
   codex は `Unable to write the requested file outside the permitted workspace.` で失敗する。
   `-c "sandbox_workspace_write.writable_roots=[\"<work>\"]"` を渡すこと。
   値は TOML として解釈されるので、パスは**スラッシュ区切り**で書く。
3. codex を止めるのは `send-keys ctrl+c` 1 回で足りることがある。
   2 回目を送ると `agent_not_found`（もう agent がいない）になるが、これは正常。

`--kind` に指定できる値（実測）:
`pi, claude, codex, gemini, cursor, devin, agy, cline, omp, mastracode, opencode, copilot,
kimi, kiro, droid, amp, grok, hermes, kilo, qodercli, qwen, maki`

## 4. プロンプトを送って待つ

```powershell
herdr agent prompt rv-claude "Read $work/review-brief-claude.md and follow it exactly." --wait --timeout 1800000
```

- **長文を引数で渡さない。** 指示書をファイルに書いて「これを読め」と言う方が確実
  （bracketed paste とクォート処理で壊れる）。
- `--wait` は `idle` / `done` / `blocked` のいずれかで返る。
  **`--until idle --until done --until blocked` と既定を書き直さない**（ガイドが禁止）。
- 非 working 状態から送ったプロンプトが 5 秒以内に状態変化を起こさないと
  `agent_prompt_stalled` が返る。
- **`--timeout` は `--wait` とセットでしか使えない。** 単独で付けると
  `--timeout requires --wait` で exit 2 になる（実測）。
- `--wait` に `--timeout` を省くと無限待ち。単独で待つときは必ず付ける。
- 2 名を並列に走らせるには、**先に両方 `prompt` を投げてから** `herdr agent wait` で順に待つ。

```powershell
# 並列パターン（prompt には --wait も --timeout も付けない）
herdr agent prompt rv-claude "Read <work>/review-brief-claude.md and follow it exactly."
herdr agent prompt rv-codex  "Read <work>/review-brief-codex.md and follow it exactly."
herdr agent wait   rv-claude --timeout 1800000
herdr agent wait   rv-codex  --timeout 1800000
```

## 5. 状態を確認する

```powershell
herdr agent get rv-claude          # .result.agent.agent_status
herdr agent list
herdr agent explain rv-claude --verbose
```

状態の意味:

| 状態 | 意味 |
|---|---|
| `working` | 実行中 |
| `idle` | 入力待ち。かつ UI 上で「見られた」状態 |
| `done` | 見られていない背景作業が終わった `idle`。CLI の read では「見た」ことにならない |
| `blocked` | 承認/質問ダイアログを検出。**自分で答えず、ユーザーに聞く** |
| `unknown` | 分類できない。**完了の証拠にはならない** |

`herdr integration install claude|codex` が入っていない環境では検出が画面スクレイプ頼みになり、
`unknown` が出やすい（検出根拠は `herdr agent explain <name> --verbose` で確認できる）。
**完了の最終判定は「レポートファイルが存在するか」で行うこと。**

## 6. 出力を読む

```powershell
herdr agent read rv-claude --source recent-unwrapped --lines 200
herdr pane  read $pane1    --source recent-unwrapped --lines 200
```

`--source` の選択:

| 値 | 用途 |
|---|---|
| `visible` | 今表示されている範囲だけ |
| `recent` | 直近の出力（ソフトラップあり） |
| `recent-unwrapped` | ソフトラップを結合。**ログ・トランスクリプトはこれ** |
| `detection` | エージェント検出用のプレーンテキスト（`agent read` のみ） |

**alternate screen の罠**: `claude` / `codex` の TUI は alternate screen で動くため、
画面外に流れた行はスクロールバックに入らない。`--lines` を増やしても復元できない。
→ **だから dual-review は最初からレポートをファイルに書かせる。**
それでも回収が必要になったら、追加プロンプトで「指摘 N〜M を再掲して」と小分けにさせる。

## 7. 割り込み・終了（dual-review では通常使わない）

```powershell
herdr agent send-keys rv-claude esc
herdr agent send-keys rv-claude ctrl+c      # 大抵の TUI は 2 回必要
herdr pane close $pane1
herdr tab  close $tabId
```

`herdr agent stop` / `agent kill` は**存在しない**。

**dual-review ではレビュー完了後にこれらを実行しない。**
ユーザーが明示的に「閉じて」と言ったときだけ `herdr tab close <tabId>` を使う。
