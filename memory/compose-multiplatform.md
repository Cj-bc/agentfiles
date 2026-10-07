---
name: compose-multiplatform
description: Compose Multiplatform のリソースによる多言語化と Kotlin/Wasm の罠 — Wasm では stringResource が非同期で最初は空文字、Wasm にはシステムフォントが無い、保存値に表示文字列を使わない、同じ可変オブジェクトを渡した子は strong skipping でスキップされる
type: reference
---

## 多言語化の基本構成
- 文字列は `src/commonMain/composeResources/values/strings.xml`（既定ロケール）と `values-ja/strings.xml` などに置く。
  `compose.components.resources` の依存だけで使える（`<string>` / `<plurals>` / `<string-array>`）。
- 生成される `Res` のパッケージは、`compose.resources { packageOfResClass = "..." }` で固定しておくと import が読みやすい。
- `enum` のラベルなどは `String` ではなく `StringResource` を持たせ、表示する時点で `stringResource(...)` を呼ぶ。
- 状態として「表示中のメッセージ」を持つときは `StringResource?` を持つ。表示文字列で比較しない（例: 成功メッセージかどうかで色を変える）。
- 書式の引数には `%1$s` / `%1$d` を使う。`%%` のエスケープは検証していないので避けた。`"$n%"` を `%1$s` に渡せば済む。
- 英語のラベルは日本語より長く、ボタンや `OutlinedTextField` のラベルが折り返す。両方の言語でスクリーンショットを撮って確認する。

## Kotlin/Wasm では `stringResource` が非同期
Wasm では `stringResource` は最初のコンポジションで `""` を返し、読み込みが終わってから再コンポーズされる
（Android やデスクトップでは同期的に返る）。そのため、次のような使い方は Wasm でだけ壊れる。
- `remember { ... }` の初期化で、文字列を使って一度きりの処理（データの書き込みなど）をする → 空文字のまま処理が走る。
  UI 以外で文字列が必要なら、`LaunchedEffect` の中で suspend の `getString(res, args)` を使う。
- 文字列を初期値にした `remember { mutableStateOf(label) }` → `""` のまま固定される。`remember(label) { ... }` のようにキーに含める。

## Kotlin/Wasm にはシステムフォントが無い
Wasm の Compose は canvas に描画する。HTML 側の `font-family` は効かず、システムフォントも使えない。
フォントを同梱しないと日本語は豆腐（☒）になる。`composeResources/font/` に TTF を置き、
`FontFamily(Font(Res.font.xxx, FontWeight.Normal), ...)` を `MaterialTheme(typography = ...)` の全スタイルに設定する。
- Noto Sans JP の静的 TTF（ウェイトごとに約 5.7MB）は、Google Fonts の CSS API を UA なしで curl すると得られる
  （`https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700` → 中の `fonts.gstatic.com/...ttf`）。
  ライセンス（OFL）も一緒にリポジトリに入れる。
- Noto Sans JP には絵文字が入っていないので、絵文字は豆腐のまま。必要なら絵文字フォントを別に追加する。

## 保存値に表示文字列を使わない
ユーザーデータ（カテゴリ名など）に表示用の日本語文字列をそのまま保存していると、多言語化した時点で壊れる。
言語に依存しない ID（`food` など）で保存し、表示するときに翻訳する。既存データは、読み込み時とバックアップの
インポート時に旧文字列から ID へ変換する（変換は冪等にしておけば、毎回の読み込みで実行してよい）。
ただし、移行コードを書く前に、旧形式で保存されたデータが実際にあるかをユーザーに確認する。2026-10-06 には
「まだデータを保存していないので、今回に限りマイグレーションは行わず破壊的変更をしてよい」と言われ、移行コードを削除した。
自由入力欄の場合は、どちらかの言語の表示名に一致した入力だけを ID として保存し、それ以外は独自の値として残す。

## 同じ可変オブジェクトを渡した子はスキップされる（strong skipping）
Kotlin 2.0.20 以降の Compose コンパイラでは strong skipping が既定で有効になっている。不安定な型の引数も
インスタンスの同一性（`===`）で比較され、すべて同じなら composable はスキップされる（ラムダも自動で remember される）。
`Screen(ledger, onChange)` のように同じ `ledger` を渡し続け、中身を書き換えてから親でカウンタ（`revision++`）を
読み直して再コンポーズさせる作りでは、子の画面がスキップされて表示が古いままになる。さらに、子が前回のコンポジションで
`ledger` から作った値（並べ替え用のリストや添字など）をキャプチャしたクリックのラムダも残るので、次の操作が古い値に対して
実行され、データまで壊れる（2026-10-07、家計簿アプリの設定画面で、削除した直後の並べ替えが削除を打ち消した）。
- 直し方: 共有データのプロパティを `var x by mutableStateOf(...)` にして、読み取りを Compose に追跡させる。
  リストは `mutableStateListOf()` にするか、`mutableStateOf(listOf())` に新しいリストを代入し直す
  （`mutableStateOf(mutableListOf())` の中身を変えても追跡されない）。カウンタや `key(revision)` での再コンポーズに頼らない。
- 入力中の文字列などローカル状態が変わると再コンポーズされるので、たまたま動いて見える画面もある。
  共有データだけを変える操作（削除・並べ替えなど）を続けて行い、ローカル状態に触れずにスクリーンショットで確認する。
