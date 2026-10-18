---
name: nix-gradle
description: nixpkgs の Gradle（mitm-cache の deps.json）を使うプロジェクトで依存を更新する手順と、クラウドセッションでの罠 — GitHub の flake 入力は git で取って --override-input、deps.json は USE_BWRAP=0 で更新スクリプト、fetchYarnDeps はサンドボックス外で作って store に入れる、Maven Central の 429 は prefetch-file で store を先に埋める、KGP の jar は gradleNN 版を Gradle に合わせる
type: reference
---

## 依存を上げたら Nix 側で直すもの（tmp-budget-book、2026-10-18）
- `deps.json`: `USE_BWRAP=0 $(nix build --no-link --print-out-paths .#web.gradleDeps.mitmCache.updateScript)` で再生成（約 3 分）。
- `mkGradle` の `hash`: `nix store prefetch-file --json https://services.gradle.org/distributions/gradle-X-bin.zip | jq -r .hash`（fetchurl なので flat）。
- Kotlin Gradle プラグインの jar を直接 fetch しているなら、版だけでなく `-gradleNN` の変種も Gradle に合わせる。
  KGP 2.4.21 + Gradle 9.8 は `gradle96`（2.3.20 + Gradle 9.6 は `gradle813` だった）。どれが選ばれたかは `~/.gradle/caches` の jar 名で分かる。
- その jar に同梱の yarn.lock が変わるので、`fetchYarnDeps` のハッシュも変わる。プロジェクトの `kotlin-js-store/wasm/yarn.lock` のハッシュも、
  ロックファイルを変えたのに更新し忘れていることがあった（古い出力が store に残っている手元では気づかない）。
  ロックファイルを変えたら、下の手順で prefetch-yarn-deps を実行してハッシュを計算し直し、flake の値と比べる。
- androidenv の `platformVersions` / `buildToolsVersions` を compileSdk に合わせる（activity 1.13 は `minCompileSdk=36`）。

## クラウドセッションで Nix を動かす
- flake の `github:` 入力は api.github.com が 403 で取れない。git なら通るので、
  `git init && git fetch --depth 1 https://github.com/OWNER/REPO <rev> && git checkout FETCH_HEAD` で flake.lock の rev を取り、
  `--no-write-lock-file --override-input nixpkgs path:DIR --override-input utils path:DIR` を付けて評価する。flake.lock は書き換えない。
- `fetchYarnDeps`（node の prefetch-yarn-deps）はサンドボックス内でプロキシの証明書を信用せず `SELF_SIGNED_CERT_IN_CHAIN` で落ちる。
  外で同じことをして store に入れれば、同じ出力パスになって使われる:
  `cd EMPTY && NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt GIT_SSL_CAINFO=/root/.ccr/ca-bundle.crt prefetch-yarn-deps --builder <yarn.lock>`、
  `nix hash path EMPTY` がハッシュ、`nix store add --mode nar --name offline EMPTY`（store パスは名前にも依存する。fetchYarnDeps の既定の名前は `offline`）。
  prefetch-yarn-deps は codeload.github.com の URL を github.com の git clone に変換するので、codeload が 403 でも通る。
  ただしサンドボックス内で検証できていないので、PR にそう書く。
- Gradle 側の 429 は [cloud-session.md](cloud-session.md) のミラーの init スクリプトで避けられるが、`nix build` の中では効かない（FOD が URL を直接取る）。
  curl の fetchurl は通るが、`nix build` は依存を並列に取るので Maven Central が 429 を返して失敗する（`--max-jobs 3` でも駄目だった）。
  FOD の出力パスは名前とハッシュだけで決まるので、deps.json を URL とハッシュに展開して Google のミラーから先に入れておく:
  `nix store prefetch-file --name <ファイル名> --expected-hash <hash> https://maven-central.storage-download.googleapis.com/maven2/<パス>`。
  `plugins.gradle.org/m2/` の項目も同じパスでミラーにあった。dl.google.com は 429 にならない。
  deps.json の展開は fetch-deps.nix の `decompressNameVer` と同じ（`"group/path#artifact/version[/classifier]": {ext: hash}`、キーは入れ子になりうる）。
- 以上で `nix build .#web` がサンドボックス内オフラインで通り、出来た `bin/` のサーバーで配信した画面も Chromium で確認できた。
