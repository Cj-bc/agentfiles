---
name: flix
description: Flix (paranoid-time.flix) の罠 — ビルド・テストは nix 無しで flix.jar を直接実行できる
type: reference
---

## ビルド・テストは nix 無しで jar 直接実行できる
`flix.toml` の `flix = "X.Y.Z"` に対応する `https://github.com/flix/flix/releases/download/vX.Y.Z/flix.jar` を
落とし、`java -jar flix.jar test` / `check` で動く（JDK 21 のサンドボックス環境で確認）。
`nix` が使えない環境でもこれでローカル検証できる。
