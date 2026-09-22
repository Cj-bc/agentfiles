---
name: flix
description: Flix (paranoid-time.flix) の罠 — test262 移植ツリーは関数リネームでパスも引用も変えない、リネームは既存関数の改名に留めて新規関数を足さない、ビルドは nix 無しで jar 直接実行できる
type: reference
---

## test262 移植ツリーのパス・JSソース引用は関数リネームで変えない
`paranoid-time.flix` の `test/test262/built-ins/...` は [tc39/test262](https://github.com/tc39/test262) の
該当パスをそのまま反映したツリー（`test/test262/README.md` 参照。トレーサビリティのための設計）。
ライブラリ側の関数（例: `fromEpochMilliseconds` → `saturatingOfEpochMilli`）をリネームしても、
このディレクトリ・ファイル名や `mod Test262.BuiltIns....` は変えない。

さらに doc comment 内の `` /// test262: `fromEpochMilliseconds(...).epochNanoseconds` is ... `` という形の行は、
リネーム対象の自分たちの関数ではなく元の JS (test262) ソースをそのまま引用したもの。ここも書き換えない。

単純な `\bold\b` → `new` の一括置換をかけると、上記のパス文字列や JS 引用まで巻き込んで誤って書き換えてしまう
（実際に `.../fromEpochMilliseconds/limits.flix` というパス文字列が `.../saturatingOfEpochMilli/limits.flix` に
化けた）。置換後は `grep` で `Temporal/Instant/` 配下のパスと `` test262: ` `` で始まる行を除外して差分を
目視確認すること。

## 関数名の一括置換は連番付き識別子とPascalCase参照を取りこぼす
`\btryAdd\b` は `tryAdd01`（数字が続く＝word boundary が無い）にはマッチしない。
テスト関数名 (`def tryAdd01_...`)、モジュール宣言 (`mod TestTime.Instant.TryAdd`)、
camelCase 内に埋め込まれた PascalCase 参照 (`isTheSameAsTryAdd`) は正規表現の一括置換では拾えないので、
別途 `grep -E '(TryAdd|TrySub|...)'` のような大文字始まりパターンで探して手動で直す。

## リネームはスコープを超えない — 対応する概念が無い関数は足さない
「関数名を X (java.time.Instant 等) に揃えて」という依頼は既存関数の改名であって、対象 API にあって
自分たちに無いメソッド (`getEpochSecond`, `getNano`, `toEpochMilli` 等) を新設する話ではない。
並行していた別セッションがこの区別を誤って新規関数を追加したうえに命名も別物 (`plus`/`minus` に
try/saturating 接頭辞を落とす、`ofEpochMilliClamped` 等) にした PR は、リポジトリオーナーに一度
マージされた後 `develop` を force-push で巻き戻されて取り消された。
「対応する概念が無い関数」（例: `fromEpochNanoseconds` → `ofEpochNanos` には対応する java 側 factory が無い）は、
既存の語彙・接尾辞パターン（この場合は `Duration.ofNanos`/`toNanos` の複数形）に合わせて改名するに留め、
新しい機能は足さない。

## ビルド・テストは nix 無しで jar 直接実行できる
`flix.toml` の `flix = "X.Y.Z"` に対応する `https://github.com/flix/flix/releases/download/vX.Y.Z/flix.jar` を
落とし、`java -jar flix.jar test` / `check` で動く（JDK 21 のサンドボックス環境で確認）。
`nix` が使えない環境でもこれでローカル検証できる。

## 同じリポジトリで並行セッションが同じタスクを別ブランチでやっていることがある
`gh`/GitHub MCP で `list_branches` / `list_pull_requests` を見ると、自分が着手する前から
似た名前のブランチ (`claude/<task>-<suffix>`) や、既にオーナーがマージ→取り消した PR が
残っていることがある。着手前に一度確認すると、車輪の再発明や食い違う設計判断を避けられる。
リモートのベースブランチ（今回は `develop`）が自分の想定と食い違っていないか（他の PR が
先にマージされて内容が変わっていないか）も、作業開始前と PR 作成後の両方で確認する。
