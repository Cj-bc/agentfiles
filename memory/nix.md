---
name: nix
description: Nix を使った開発全般の罠 — 作業前に既存パッケージが今のままで通るか確かめる（lock の hash のずれ）、クラウド環境（プロキシ）でのフレーク入力の 403、FOD の証明書（`nix-store --add-fixed` で回避）、FOD をまとめて取ると 429（ミラーから store を先に埋める）
type: reference
---

## 作業を始めたら、まず既存のパッケージが今のままで通るか確かめる
lock（`yarn.lock` など）を変えたコミットで、それを固定する hash（`fetchYarnDeps` の `hash`、`gradle.fetchDeps` の `deps.json` など）が更新されていないことがある。
その場合はデフォルトブランチでもビルドが通らない。自分の変更のせいと取り違えないよう、先に確かめる。
hash mismatch のエラーの `got:` が新しい値。

## クラウド環境（プロキシ）での Nix
- フレークの入力 `github:owner/repo` は 403 で取れない（rev の解決に使う `api.github.com` も、tarball の `github.com/.../archive/...` → `codeload.github.com` も 403）。
  ローカルで試すだけなら `git clone` して `--override-input <input> git+file:///path?rev=<rev>` を付ける（lock は書き換えない）。
- nix は daemon なしの単一ユーザーで、FOD には呼び出し側の `NIX_SSL_CERT_FILE`（`/root/.ccr/ca-bundle.crt`）がそのまま渡る。サンドボックスからは見えない。
  nixpkgs の fetcher には CA を nixpkgs の cacert に固定しているものがあり、プロキシの CA を信頼しない。env を上書きしても通らないことがある。
  回避策: 同じ処理をサンドボックスの外で走らせ、`nix-store --add-fixed --recursive sha256 <dir>/<name>` で入れる（ディレクトリ名を FOD の `name` にする）。
  内容が合っていれば FOD の出力パスと一致し、以降のビルドはそれを使う。リポジトリは変更しない。
- 依存をひとつずつ fetchurl の FOD にするもの（`gradle.fetchDeps` など）は、まとめて取りに行くとレジストリが 429 を返して落ちる。
  URL が固定の FOD なので、ツール側のミラー設定（[cloud-session.md](cloud-session.md) の init スクリプトなど）は効かない。
  `--keep-going --max-jobs 4` で何度かやり直せば、取れた分は残るので通る。
  やり直しても通らないとき（2026-10-18 は `--max-jobs 3` で 3 回とも 429）は、FOD の出力パスが名前とハッシュ（と flat / recursive の別）だけで決まることを使い、
  Google のミラーから同じ名前で先に store へ入れる: `nix store prefetch-file --name <ファイル名> --expected-hash <hash> https://maven-central.storage-download.googleapis.com/maven2/<パス>`。
  `deps.json` は fetch-deps.nix の `decompressNameVer` と同じ規則で URL に展開できる（`"group/path#artifact/version[/classifier]": {ext: hash}`、キーは入れ子になりうる）。
  `plugins.gradle.org/m2/` の項目も同じパスでミラーにあった。dl.google.com は（通る環境では）429 にならない。

具体的な事例は [nix-gradle-android.md](nix-gradle-android.md) の「クラウド環境での事例」を参照。
