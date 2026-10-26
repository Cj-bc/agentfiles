---
name: kotlinx-serialization
description: kotlinx.serialization（JSON）で手で編集されうるデータを読むときの罠 — 文字列の数値 "1,200" を Long の 1 と読んでしまう、デコーダの寛容さに合わせた検証はこの罠も引き継ぐ
type: reference
---

JSON のテストの罠（`encodeDefaults`、往復で打ち消されるバグ）は [kotlin-multiplatform-testing.md](kotlin-multiplatform-testing.md) の「kotlinx.serialization の JSON テスト」を参照。

## 文字列で書いた数値を、途中まで読んでしまう（2026-10-26、tmp-budget-book、kotlinx-serialization 1.7.3）
`parseToJsonElement` → `decodeFromJsonElement` で `val amount: Long` を読むと、`"amount":"1,200"`（引用符付き）がエラーにならず **1** になった。
引用符付きの数値は既定（`isLenient = false`）でも受け付けられ、しかも数字の後ろの `,200` が無視される。
アプリ自身が書いたデータでは起きないが、git で同期していて人がリポジトリ側で編集できるようなデータでは、値が黙って別の数になる。
- 数値のフィールドは `value is JsonPrimitive && !value.isString && value.longOrNull != null` のように、JSON の数値リテラルであることを自分で確かめる。
- 「デコーダが受け付けるか」で検証を書く（`runCatching { decodeFromJsonElement(Long.serializer(), v) }`）と、この寛容さもそのまま引き継ぐ。数値だけは別に厳しく判定する。
- 画面で確かめて気づいた（残高が 1 円ずれていた）。テストは、読んだ値が期待どおりかまで見る。
