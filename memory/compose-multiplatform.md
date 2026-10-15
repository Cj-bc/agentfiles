---
name: compose-multiplatform
description: Compose Multiplatform のリソースによる多言語化と Kotlin/Wasm の罠 — Wasm では stringResource が非同期で最初は空文字、Wasm にはシステムフォントが無い、保存値に表示文字列を使わない、SVG のパスからアイコンを作る、トークンは CompositionLocal で配る、kotlinx-datetime の YearMonth と保存形式
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

## 保存データの読み込みに失敗したとき、上書きしない
「読めなければ既定値で始める」実装で、開いた直後に既定値（や移行結果）を保存すると、壊れた（あるいは新しい形式の）
保存データを黙って消してしまう。読めなかった生データは別のキー（例: `...:unreadable`）へ退避してから進める。

## Material3 の部品の小さな罠
- `LinearProgressIndicator` は値が 0 でも右端に「停止インジケーター」の点を描く。要らなければ `drawStopIndicator = {}`。
- `FilterChip` を並べて折り返すには `FlowRow`（`@OptIn(ExperimentalLayoutApi::class)`）。`compose.foundation` に入っている。
- `material-icons-core` は `compose.material3` の推移的依存として解決されていることが多いが、宣言していないので頼らない。

## アイコンライブラリなしで SVG のアイコンを使う
デザインの SVG（`<path d=...>` の線のアイコン）は、`ImageVector.Builder` に `addPath(pathData = addPathNodes(d), stroke = SolidColor(Color.Black), strokeLineWidth = 1.8f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round)` で
そのまま描ける（`androidx.compose.ui.graphics.vector.addPathNodes`）。`<circle>` / `<rect rx>` は弧（`a`）のパスに書き直す。
`Icon(tint = ...)` で色が付く。`material-icons-extended` を足さずに済む（依存を Nix の `deps.json` でロックしているプロジェクトでは、再生成も要らない）。Compose Multiplatform 1.7.3 で確認。

## デザイントークンは CompositionLocal で配る
`@Immutable data class AppColors(...)` をライト・ダークの 2 組作り、`staticCompositionLocalOf` で配って `object AppTheme { val colors @Composable get() = Local.current }` （例: `LocalAppColors.current`）で読む。
Material の `colorScheme` も同じ値に揃えておくと、`DatePicker` や `ModalBottomSheet` などの M3 部品の色も合う。デザインにダークのトークンがなければ、役割ごとに明度を反転して自分で作り、PR にそう書く。

## kotlinx-datetime
- `YearMonth` は 0.7.0 から。
- 既定のシリアライザーは `LocalDate` → `"2026-10-14"`、`YearMonth` → `"2026-10"`（ISO）。独自の型が同じ ISO 文字列で保存していたなら、置き換えても保存形式は変わらない。テストで固定しておく。
- 入力の検証には `LocalDate.Formats.ISO.parseOrNull(text)`（`"2026-02-30"` や `"2026-1-01"` は null）。
- 0.7.0 では npm の `format-util` に依存しなくなるので、Wasm の `kotlin-js-store/wasm/yarn.lock` が変わる。`./gradlew kotlinWasmUpgradeYarnLock` で更新する（クラウド環境でも動いた）。
