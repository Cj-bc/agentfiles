---
name: cloud-session
description: Claude Code のクラウドセッション（プロキシ経由のネットワーク）でのビルドと動作確認の罠 — Google Maven は環境次第で塞がれる（通れば Android SDK を自分で入れる）、codeload.github.com が塞がれている、Maven Central の 429 は Google のミラーで回避、Playwright での canvas 操作の罠、PR のスクリーンショットは Artifact で、auto mode では merge --ff-only、Kotlin/Wasm を webpack なしで Chromium に出す方法、PR の base は作業ブランチの元のブランチにする
type: reference
---

## 塞がれているホスト（2026-10 時点）
- `dl.google.com`（Google Maven）が 403 の環境がある。そのときは Android Gradle Plugin（`com.android.*`）を解決できず、
  Android を含むプロジェクトは設定フェーズで失敗する。環境によっては通る（下の「環境によっては dl.google.com が通る」を参照）。
- `repo.maven.apache.org` と `registry.npmjs.org` は通る。ただし Maven Central は 429 が続くことがある（下の「ミラー」の節）。
- `codeload.github.com` が 403。Kotlin/Wasm の `kotlinWasmToolingSetup`（Kotlin 同梱の yarn.lock が GitHub の tarball を参照する）が失敗するので、
  `wasmJsBrowser*Distribution` / `*Run` のような webpack を使うタスクは動かない。
- Node 製ツール（yarn / npm）は `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` を付けないと TLS エラーになる。
- 環境の Gradle は 8.14 と古いことがある。ラッパーが新しい版を要求していても、Android を除けばそのまま動いた。

## 環境によっては dl.google.com が通る（2026-10-14）
同じリポジトリでも、環境（environment）を変えたら `dl.google.com` が 200 を返すようになった。塞がれていると決めつけず、最初に
`curl -sS -o /dev/null -w "%{http_code}" https://dl.google.com/dl/android/maven2/com/android/tools/build/gradle/maven-metadata.xml` で確かめる。
通るなら Android SDK は自分で入れられる:
1. `https://dl.google.com/android/repository/commandlinetools-linux-13114758_latest.zip` を `/opt/android-sdk` に展開し、
   中身を `cmdline-tools/latest/` へ移す。
2. `yes | cmdline-tools/latest/bin/sdkmanager --sdk_root=/opt/android-sdk "platforms;android-35" "build-tools;35.0.0" "platform-tools"`
3. リポジトリに `local.properties`（`sdk.dir=/opt/android-sdk`、通常 .gitignore 済み）を置く。
- `com.android.kotlin.multiplatform.library` のプロジェクトには `assembleDebug` が無い（APK が必要なら [nix-gradle-android.md](nix-gradle-android.md) のアプリ用モジュールを参照）。`:composeApp:assembleAndroidMain` /
  `compileAndroidMain` / `testAndroidHostTest` を使う。

## Maven Central の 429 は Google のミラーで回避する
`repo.maven.apache.org` が `429 Too Many Requests` を返し続け、リトライでも通らないことがある（2026-10-14）。
`https://maven-central.storage-download.googleapis.com/maven2/` は同じ内容を 200 で返すので、リポジトリを触らずに
`~/.gradle/init.d/mirror.init.gradle.kts` で先頭に差し込む（プラグインポータルも Maven Central へリダイレクトするので
`pluginManagement` にも入れる）:
```kotlin
val mirror = "https://maven-central.storage-download.googleapis.com/maven2/"
beforeSettings {
    pluginManagement.repositories.maven(mirror)
    dependencyResolutionManagement.repositories.maven(mirror)
}
settingsEvaluated {
    listOf(pluginManagement.repositories, dependencyResolutionManagement.repositories).forEach { repos ->
        val m = repos.filterIsInstance<org.gradle.api.artifacts.repositories.MavenArtifactRepository>()
            .firstOrNull { it.url.toString() == mirror }
        if (m != null) { repos.remove(m); repos.add(0, m) }
    }
}
```
`FAIL_ON_PROJECT_REPOS` の設定でも、settings 側のリポジトリなので問題ない。

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
   `http.server` は起動時のディレクトリを使い続けるので、配信中のディレクトリを `rm -rf` で作り直すと空の応答（`ERR_EMPTY_RESPONSE`）を返す。
   ビルドし直したら中身だけ消して入れ替えるか、サーバーを起動し直す。
5. Playwright は `/opt/node-tools/node_modules` にある（Python 版は無い）。
   `createRequire('/opt/node-tools/node_modules/')` で読み込み、`newContext({ locale: 'ja-JP' })` でロケールを切り替えて撮影する。
   `addInitScript` で `localStorage` に旧形式のデータを入れておけば、データ移行も確認できる。
   Compose の canvas はクリックで操作する（下部タブなら座標を指定してクリック）。
   スクロールは `page.mouse.move(x, y)` してから `page.mouse.wheel(0, dy)`。テキスト欄はクリックしてから `page.keyboard.type()` で入力できる（ASCII のみ。下の「canvas を Playwright で操作するときの罠」を参照）。
   スクリプトの最後で `browser.close()` を忘れると、撮影は済んでもコマンドがタイムアウトする。

## Wasm のテストを動かす
`wasmJsNodeTest` も `kotlinWasmToolingSetup` に依存するので動かない。テストのコンパイルと Node での直接実行は [kotlin-multiplatform-testing.md](kotlin-multiplatform-testing.md) を参照。
`repo.maven.apache.org` が 429 を返したら、まず少し空けてリトライし、通らなければ上の「Maven Central の 429 は Google のミラーで回避する」の init スクリプトを使う。

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

## Compose (Wasm) の canvas を Playwright で操作するときの罠（2026-10-15）
- `page.keyboard.type()` は ASCII なら Compose のテキスト欄に入るが、日本語は入らなかった（原因は未確認。おそらく IME を経由しないため）。検索や新規作成の確認は ASCII の文字列で行う。
- `ModalBottomSheet` を開いた直後のクリックは取りこぼされた（おそらく開くアニメーション中のため。ダイアログも同様の可能性）。開いたあと 1 秒ほど待つ（スクリーンショットを挟む）。
- スワイプは `mouse.move` → `mouse.down` → `mouse.move(x, y, {steps: 12})` → `mouse.up` で再現できる（`SwipeToDismissBox` の削除まで動く）。
- `colorScheme: 'dark'` を `newContext` に渡すと、`isSystemInDarkTheme()` が true になる。
- ファイル選択（`<input type=file>` の `click()`）を確かめるときは、`page.on('filechooser', fc => fc.setFiles(path))` を**最初に**登録しておく（2026-10-16）。
  クリックの直前に `page.waitForEvent('filechooser')` を呼ぶと、間に合わずにタイムアウトすることがあった（おそらく横取りの有効化が非同期なため）。
  アプリ側は `navigator.userActivation.isActive` が true で、正しく呼べていた。先に登録する方法では 3 回とも通った。
- ダウンロードは `page.on('download', d => d.saveAs(path))` で保存できる（2026-10-16 に確認）。書き出したバックアップを、そのまま復元の確認に使える。

## PR に画面のスクリーンショットを載せる
GitHub の MCP では画像を添付できない。スクリーンショットを data URI で埋め込んだ HTML を Artifact として公開し、その URL を PR の説明に書いた
（Artifact は既定でオーナーだけが見られる、と PR にも書いておく）。

## auto mode では `git checkout -B` が拒否される
マージ済みの PR のブランチを base の最新に付け替えるとき、`git checkout -B <branch> origin/<base>` は「Git Destructive」として拒否された。
ブランチが base の祖先なら `git merge --ff-only origin/<base>` で同じ結果になり、通る。
