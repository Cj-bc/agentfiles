---
name: nix-gradle-android
description: Nix flake で Kotlin Multiplatform + Android の APK をビルドする — KMP の Android ライブラリプラグインは APK を作れないのでアプリ用モジュールを足す、Compose リソースを assets にコピーする、androidenv の unfree 設定、サンドボックスでの aapt2、gradle.fetchDeps の共有、クラウド環境での事例、Build-Tools を AGP の既定に揃える、devShell の Gradle がストアの SDK を書き換える罠、aarch64（Termux）では Build-Tools の aapt2 が動かないので web の依存を Android から切り離す
type: reference
---

## KMP の Android ライブラリプラグインでは APK を作れない（2026-10-18、tmp-budget-book）
`com.android.kotlin.multiplatform.library`（AGP 9 で KMP に Android を足す方法）はライブラリ用で、`assembleDebug` も APK も無い。
APK が必要なら `com.android.application` だけを当てたモジュール（例: `androidApp`）を作り、KMP のモジュールに依存させる。
- Activity は KMP 側（`androidMain`）に置いたままでよい。アプリのマニフェストでは完全修飾名で指定する。
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
- 依存を温める derivation（ビルドスクリプトだけをソースに、仮のソースでタスクを一度走らせて `GRADLE_USER_HOME` を出力する）は、web 用と Android 用で分ける（下の「aarch64 では Android のタスクが動かない」を参照）。
  `deps.json` は共有してよい。Android 用の derivation の `gradleBuildTask` に両方のタスクを空白区切りで書き（setup hook はクォートせずに展開する）、`deps.json` は x86_64-linux で `.#android.gradleDeps.mitmCache.updateScript` から作る（web 用の updateScript でも動くが、Android の依存が消える）。
  web 用は web のタスクだけにする（`deps.json` に余分な依存があっても困らない）。
  仮のソースを置くソースセットに `androidMain` も足す。
- debug ビルドの署名鍵は `$HOME/.android/debug.keystore` にビルドのたびに作られる。毎回違う鍵になるので、作り直した APK は上書きインストールできない。

## devShell の Gradle が Nix ストアの SDK を書き換える（2026-10-18、tmp-budget-book）
クラウド環境の nix は root の単一ユーザーインストールで、ストアに書き込める。`nix develop .#android -c gradle ...` を走らせたら、
AGP が足りない Build-Tools 36.0.0 を `ANDROID_HOME`（`/nix/store/...-androidsdk/...`）の中へ自動でダウンロードしていた。
その SDK を使うサンドボックスのビルドも通ってしまい、ユーザーの手元（ストアが読み取り専用）でだけ失敗した。
- devShell で Gradle を動かしたあとは `nix-store --verify-path <sdk のストアパス>` で改変が無いか確かめる。改変されていたら `nix-store --repair-path` で戻してから `nix build` で確かめ直す。
- Gradle の出力に `Failed to download any source lists!` や SDK のダウンロードの跡があれば、SDK に足りないものがある。

## クラウド環境での事例（2026-10-18、tmp-budget-book）
一般的な話は [nix.md](nix.md) にある。
- 既存の `nix build .#web` が、`yarn.lock` を変えたコミットで `fetchYarnDeps` の hash と `deps.json` が更新されておらず、最初から通らなかった。
- `fetchYarnDeps` は `NODE_EXTRA_CA_CERTS` を nixpkgs の cacert に固定している。Kotlin の tooling 用 `yarn.lock` にある `git+https://github.com/...` の依存は、
  中の `nix-prefetch-git` が `NIX_SSL_CERT_FILE` を `GIT_SSL_CAINFO` にするので、env を上書きしても通らなかった。
  `mkdir offline && cd offline && NIX_SSL_CERT_FILE=/root/.ccr/ca-bundle.crt prefetch-yarn-deps --builder <yarn.lock>` のあと
  `cd .. && nix-store --add-fixed --recursive sha256 offline` で入れた（`offline` は `fetchYarnDeps` の FOD の `name`）。
- `gradle.fetchDeps` の updateScript（`USE_BWRAP=0 $(nix build --print-out-paths .#<pkg>.gradleDeps.mitmCache.updateScript)`。属性のパスは `fetchDeps` を置いた derivation による）はそのまま動いた。
- `deps.json` の依存を取りに行くと Maven Central が 429 を返した。`--keep-going --max-jobs 4` でやり直して通った。

## aarch64（Termux）では Android のタスクが動かない（2026-10-21、tmp-budget-book）
nixpkgs の androidenv の Build-Tools（36.0.0）は `linux` のアーカイブが 1 つだけで、Google が配っているのは x86_64 向け（`file` では未確認）。
SDK の derivation は aarch64-linux でも評価もビルドも通るが、Nix の SDK の aapt2 を `aapt2FromMavenOverride` で渡していても、この aapt2 自体が
`Cannot run program ".../build-tools/36.0.0/aapt2": Exec failed, error: 2 (No such file or directory)` で動かない（ENOENT になる原因は未確認）。
- web と Android で依存を温める derivation を共有していたため、web のビルドも `:androidApp:...` のタスクを走らせて、Termux の `nix run .#web` が失敗した。
  web 用の derivation を分け、web のタスクだけを走らせ、`ANDROID_HOME` と aapt2 の override も渡さないようにしたら、Termux で通った。
  AGP のプラグインを当てたプロジェクトがあっても、web のタスクだけなら SDK 無しで設定もビルドも通る。
- web が SDK に依存していないかは `nix-store -qR $(nix eval --raw .#packages.aarch64-linux.web.drvPath) | grep androidsdk` で確かめられる（クラウドの x86_64 で評価し、0 件になることを確かめた）。
- ログに `> Task :androidApp:...` があれば、web のビルドで Android のタスクが走っている（`Configure project :androidApp` は web だけでも出る）。
- アーカイブは nixpkgs の `pkgs/development/mobile/androidenv/repo.json` の `packages.build-tools.<ver>.archives` で見られる。ただし x86_64 のバイナリでも `arch` は `all` になっている。`os` が `linux` のアーカイブが 1 つしか無ければ、aarch64 向けは無いと考える。
- aarch64 で APK をビルドする方法はまだ見つけていない（Maven の aapt2 も、おそらく x86_64 向けしか無い。未確認）。
