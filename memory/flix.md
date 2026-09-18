---
name: flix
description: Flix の罠 — 未参照の def はコンパイルエラー（E7956）。`pub mod` はパスと名前が一致する必要がある。テストは `flix test`
type: reference
---

## 未参照の `def` はビルドを落とす
Flix は参照されていない定義を **警告ではなくエラー** にする（`Redundancy Error [E7956] Unused definition`）。
`flix check` / `flix test` はここで止まり、テストは 1 件も走らない。

つまり **関数の仕様を変えて補助定義が不要になったら、その場で消さないとリポジトリがビルド不能になる**。
paranoid-time.flix では `toEpochNanos` の戻り値を `BigInt` に変えて範囲チェックを消した結果、
その範囲チェックだけが使っていた `smallestCountableInstant` が孤立し、
`develop` が 4 コミット（feature branch 3 + merge 1）にわたってビルド不能のまま残っていた。
ワークフローは `push: branches: [main, master]` だけを見ていて、デフォルトブランチである
`develop` への push では走らない。**CI のトリガ設定が実際のブランチ運用と噛み合っているかは、
リポジトリに入った最初の一手で確認する。**

手を入れる前に `flix check` を 1 回通しておくと、自分の変更と既存の破損を切り分けられる。

## モジュール名とファイルパス
- `pub mod A.B.C` は `A/B/C.flix` で終わるパスに置く必要がある。
  テストの共有ヘルパを `pub` にするなら、ファイル名はモジュール名と一致させるしかない。
- `pub` でない `mod` はこの制約を受けないが、他のファイルから `use` できない。
  テストファイルを 1 ファイル 1 モジュールにして、パス由来の長い名前を付けておくと
  元ファイル名（test262 のハイフン付き名など）をそのまま保てる。

## 実行
`flix.toml` の `flix = "0.75.1"` に合うバージョンの `flix.jar`
（`https://github.com/flix/flix/releases/download/v<version>/flix.jar`）を取ってきて
`java -jar flix.jar check` / `java -jar flix.jar test`。
nix 環境がなくても JDK さえあれば動く。依存解決はネットワークを使う。
