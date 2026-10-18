---
name: nix-gradle-android
description: Nix flake で Kotlin Multiplatform + Android の APK をビルドする — KMP の Android ライブラリプラグインは APK を作れないのでアプリ用モジュールを足す、Compose リソースを assets にコピーする、androidenv の unfree 設定、サンドボックスでの aapt2、gradle.fetchDeps の共有、クラウド環境での FOD の証明書と 429、Build-Tools を AGP の既定に揃える、devShell の Gradle がストアの SDK を書き換える罠
type: reference
---

## KMP の Android ライブラリプラグインでは APK を作れない（2026-10-18、tmp-budget-book）
`com.android.kotlin.multiplatform.library`（AGP 9 で KMP に Android を足す方法）はライブラリ用で、`assembleDebug` も APK も無い。
APK が必要なら `com.android.application` だけを当てたモジュール（例: `androidApp`）を作り、KMP のモジュールに依存させる。
- Activity は KMP 側（`androidMain`）に置いたままでよい。アプリのマニフェストで完全修飾名（`jp.cjbc.kakeibo.MainActivity`）を指定する。
  アプリ側に Kotlin のコードが無いので、Kotlin や Compose のプラグインは要らない。
- マニフェストと `res/` はアプリのモジュールへ移す。ライブラリプラグインは既定で Android のリソースを無効にしている。
- アプリとライブラリの `namespace` は別の名前にする（アプリは `<pkg>.app` にし、`applicationId` は元のパッケージ名にした）。

## Compose Multiplatform 1.7 はこのプラグインで Compose リソースを APK に入れない
`stringResource` やフォントは、Android では assets の `composeResources/<packageOfResClass>/...` から読まれる。
1.7.3 + ライブラリプラグインでは APK にこれが入らず、起動時に `MissingResourceException` になる（APK を `unzip -l` すると無い）。
アプリのモジュールで `:composeApp:prepareComposeResourcesTaskForCommonMain` の出力を `composeResources/<pkg>/` にコピーし、
`androidComponents.onVariants { it.sources.assets?.addGeneratedSourceDirectory(task, Task::outputDirectory) }` で assets に足した。
パスは生成される `Res` のコードを `grep '"composeResources/'` すると分かる。

## Nix 側
- `androidenv.composeAndroidPackages` は unfree。`import nixpkgs { config = { allowUnfree = true; android_sdk.accept_license = true; }; }` が無いと評価で失敗する（devShell も）。
- SDK の Build-Tools は、AGP が既定で使うバージョン（AGP 9.4 は 36.0.0）を入れる。無いと AGP がビルド中にダウンロードしようとし、
  サンドボックスでは `Failed to find Build Tools revision 36.0.0`（その前に `Failed to download any source lists!`）で失敗する。
- AGP が Maven から取る aapt2 はサンドボックスで動かない。`-Pandroid.aapt2FromMavenOverride=${sdk}/libexec/android-sdk/build-tools/<ver>/aapt2`（Nix 版は patchelf 済み）を gradleFlags に入れる。
  `ANDROID_HOME` も derivation の属性で渡す。
- 依存を温める derivation（ビルドスクリプトだけをソースに、仮のソースでタスクを一度走らせて `GRADLE_USER_HOME` を出力する）の `deps.json` を web と Android で共有するなら、依存を温める derivation の `gradleBuildTask` に両方のタスクを空白区切りで書く（setup hook はクォートせずに展開する）。
  仮のソースを置くソースセットに `androidMain` も足す。
- debug ビルドの署名鍵は `$HOME/.android/debug.keystore` にビルドのたびに作られる。毎回違う鍵になるので、作り直した APK は上書きインストールできない。

## devShell の Gradle が Nix ストアの SDK を書き換える（2026-10-18、tmp-budget-book）
クラウド環境の nix は root の単一ユーザーインストールで、ストアに書き込める。`nix develop .#android -c gradle ...` を走らせたら、
AGP が足りない Build-Tools 36.0.0 を `ANDROID_HOME`（`/nix/store/...-androidsdk/...`）の中へ自動でダウンロードしていた。
その SDK を使うサンドボックスのビルドも通ってしまい、ユーザーの手元（ストアが読み取り専用）でだけ失敗した。
- devShell で Gradle を動かしたあとは `nix-store --verify-path <sdk のストアパス>` で改変が無いか確かめる。改変されていたら `nix-store --repair-path` で戻してから `nix build` で確かめ直す。
- Gradle の出力に `Failed to download any source lists!` や SDK のダウンロードの跡があれば、SDK に足りないものがある。

## リポジトリの lock の hash がずれていることがある
`yarn.lock` を変えたコミットで `fetchYarnDeps` の hash と `deps.json` が更新されておらず、master でも `nix build .#web` が通らなかった。
Nix の作業を始めたら、まず既存のパッケージが今のままで通るかを確かめる。hash mismatch の `got:` が新しい値。

## クラウド環境（プロキシ）での Nix
- フレークの入力 `github:owner/repo` は tarball（`github.com/.../archive/...`）を取りに行き、403 になる。
  ローカルで試すだけなら `git clone` して `--override-input utils git+file:///path?rev=<rev>` を付ける（lock は書き換えない）。
- nix は daemon なしの単一ユーザーで、FOD には呼び出し側の `NIX_SSL_CERT_FILE`（`/root/.ccr/ca-bundle.crt`）がそのまま渡る。サンドボックスからは見えない。
  `fetchYarnDeps` は `NODE_EXTRA_CA_CERTS` を nixpkgs の cacert に固定していて、プロキシの CA を信頼しない。
  中の `nix-prefetch-git`（`git+https://github.com/...` の依存）は `NIX_SSL_CERT_FILE` を `GIT_SSL_CAINFO` にするので、env を上書きしても通らなかった。
  回避策: 同じ処理をサンドボックスの外で走らせ、`nix-store --add-fixed --recursive sha256 <dir>/offline` で入れる（ディレクトリ名を FOD の `name` にする）。
  内容が合っていれば FOD の出力パスと一致し、以降のビルドはそれを使う。リポジトリは変更しない。
  例: `mkdir offline && cd offline && NIX_SSL_CERT_FILE=/root/.ccr/ca-bundle.crt prefetch-yarn-deps --builder <yarn.lock>`
- `gradle.fetchDeps` の updateScript（`USE_BWRAP=0 $(nix build --print-out-paths .#<pkg>.gradleDeps.mitmCache.updateScript)`。属性のパスは `fetchDeps` を置いた derivation による）はそのまま動いた。
- `deps.json` の各依存は個別の fetchurl の FOD になり、まとめて取りに行くと Maven Central が 429 を返して落ちる。
  URL が固定の FOD なので、[cloud-session.md](cloud-session.md) のミラー用 init スクリプトは効かない。
  `--keep-going --max-jobs 4` で何度かやり直せば、取れた分は残るので通る。
