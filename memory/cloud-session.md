---
name: cloud-session
description: Claude Code のクラウドセッション（プロキシ経由のネットワーク）でのビルドと動作確認の罠 — Google Maven と codeload.github.com が塞がれている、Kotlin/Wasm を webpack なしで Chromium に出す方法、PR の base は作業ブランチの元のブランチにする
type: reference
---

## 塞がれているホスト（2026-10 時点）
- `dl.google.com`（Google Maven）が 403。Android Gradle Plugin（`com.android.*`）を解決できず、Android を含むプロジェクトは
  設定フェーズで失敗する。`repo.maven.apache.org` と `registry.npmjs.org` は通る。
- `codeload.github.com` が 403。Kotlin/Wasm の `kotlinWasmToolingSetup`（Kotlin 同梱の yarn.lock が GitHub の tarball を参照する）が失敗するので、
  `wasmJsBrowser*Distribution` / `*Run` のような webpack を使うタスクは動かない。
- Node 製ツール（yarn / npm）は `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` を付けないと TLS エラーになる。
- 環境の Gradle は 8.14 と古いことがある。ラッパーが新しい版を要求していても、Android を除けばそのまま動いた。

## Android を含む KMP プロジェクトで Wasm だけを検証する
リポジトリを scratchpad にコピーし（`git ls-files -z | xargs -0 -I{} cp --parents {} DEST/`）、
コピー側で Android のプラグイン・`android {}` ブロック・`androidMain` を削ってから `compileKotlinWasmJs` を実行する。
本物のリポジトリは触らない。編集したソースはコピーへ同期し直してビルドする。Android 側は未検証だと PR に明記する。

## Kotlin/Wasm を webpack なしで Chromium に出す
1. `:composeApp:compileDevelopmentExecutableKotlinWasmJs :composeApp:wasmJsProcessResources`
2. 1 か所に集める:
   - `build/compileSync/wasmJs/main/developmentExecutable/kotlin/*`（`<module>.mjs` と `.wasm`）
   - `build/compose/skiko-runtime-processed-wasmjs/skiko.*`
   - `build/processedResources/wasmJs/main/composeResources`
3. `.mjs` が bare import する npm パッケージ（例: `@js-joda/core`）は `npm i` し、`<script type="importmap">` で ESM ファイルに向ける。
   `index.html` には `<div id="composeApp">` と `<script type="module">import './<module>.mjs'</script>` を置く。
4. `.wasm` → `application/wasm`、`.mjs` → `text/javascript` を返すように設定した `python3 http.server` で配信する。
5. Playwright は `/opt/node-tools/node_modules` にある（Python 版は無い）。
   `createRequire('/opt/node-tools/node_modules/')` で読み込み、`newContext({ locale: 'ja-JP' })` でロケールを切り替えて撮影する。
   `addInitScript` で `localStorage` に旧形式のデータを入れておけば、データ移行も確認できる。
   Compose の canvas はクリックで操作する（下部タブなら座標を指定してクリック）。

## Wasm のテストを動かす
`wasmJsNodeTest` も `kotlinWasmToolingSetup` に依存するので動かない。テストのコンパイルと Node での直接実行は [kotlin-multiplatform-testing.md](kotlin-multiplatform-testing.md) を参照。
`repo.maven.apache.org` は一時的に 429 を返すことがあり、リトライで通る。

## シェルの罠: `&&` の連鎖の途中にある `cd`
`cp ... && cd DIR && cat > index.html` の `cp` が失敗すると、`cd` が飛ばされて、ファイルが元の作業ディレクトリ（ホームなど）に書かれる。
`cd DIR || exit 1` を単独で書くか、書き込み先は絶対パスで指定する。

## PR のレビューコメントへの返信
PR の購読後にオーナーから届くコメント（「レビューして」「分離を念頭に置くと直す所は？」など）は、PR にコメントで返す。
追加した修正は、返信前に Android を外したコピーで再度テストを走らせて確認する。

## PR の base は「作業ブランチがどこから切られたか」で決める
デフォルトブランチ（`main` / `master`）とは限らない。2026-10-06、`master` に向けて PR を作ったところ、
ユーザーから「base には `rewrite-in-kotlin` を指定してあったはず」と指摘された。チェックアウト直後の HEAD は
`Merge pull request #5 ...` で、そのブランチの直前の PR がどこにマージされたかを見れば分かった。
- `git branch -r --contains HEAD` や、HEAD のマージコミットの PR の base を確認してから base を指定する。
- `main` と決めつけると `PullRequest.base (invalid)` で失敗するが、`master` で通ってしまう場合のほうが気づきにくい。
- base を間違えたら `update_pull_request` で base を変更できる。
