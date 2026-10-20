---
name: kotlin-multiplatform-testing
description: Kotlin Multiplatform のテストの罠 — Compose と同じモジュールの wasmJsNodeTest は Skiko の wasm を Node で読み込めず動かない。JSON のテストは encodeDefaults に注意。プラットフォーム依存はインターフェースで差し替える。並べ替えて保存するならメモリ上の並びも揃える（ULID を移行で振るときの順序も）
type: reference
---

## expect/actual のストレージは、インターフェースで差し替えられるようにする
`expect fun readStorage` / `writeStorage` に直結したクラス（例: `Ledger`）は、common のテストから差し替えられない。
`interface KeyValueStorage` を作り、コンストラクタ引数（既定値は platform の実装）で受け取る。
テストは `private class InMemoryStorage : KeyValueStorage`（`mutableMapOf`）を渡す。呼び出し側のコードは変わらない。
同じ storage で `Ledger(storage)` を 2 回作って「再読み込みで復元される」ことまで確かめられる。

## kotlinx.serialization の JSON テスト
- `Json { encodeDefaults = false }`（既定）だと、既定値と同じ値のプロパティは出力されない。
  `version = 1` や `description = ""`、`isRecurring = false`、空リストが JSON から消える。
  しかも `exportedAt = currentDate()` のような既定値は、必ず既定値と等しいので**常に**出力されない。
  キーの存在をテストするなら、非既定値を使うか、`encodeDefaults = true` にする。
- 必須プロパティ（既定値なし）を 1 つ作ると、`{}` や無関係な JSON を `decodeFromString` が拒否するようになる。
  ただし、その必須キーを持たない過去のバックアップも拒否されるので、既存データの有無を先に確認する。
- 入力 JSON を文字列テンプレートで組み立てない。`"` や `\` や改行を含む説明文で壊れる。`buildJsonObject { put(...) }` を使う。
- キーの検証は `Json.parseToJsonElement(...).jsonObject.keys` と比較する。モデルの serializer でデコードし直すと、同じバグが往復で打ち消される。

## Compose と同じモジュールのテストは Wasm の Node で動かない（2026-10）
`wasmJs { nodejs() }` + `commonTest` に `kotlin("test")` で `wasmJsNodeTest` を作っても、同じモジュールに Compose がある限り、
Skiko の wasm を Node で読み込めずにテストが走らない。ロジックを Compose / Skiko 抜きのモジュールに分ければ解決するはずだが、分割はまだ試していない（未検証）。
分離のとき `Category` のように `StringResource`（Compose Resources）を持つ型が足を引っ張る。ID とリストをコアに残し、ラベルと色は UI 側へ。
`currentDate()` のような `expect` 関数も、コア側に seam が必要。

## 塞がれた環境で Wasm のテストだけ実行する（2026-10）
[cloud-session.md](cloud-session.md) の手順で Android を外したコピーを作り、`:composeApp:compileTestDevelopmentExecutableKotlinWasmJs -x kotlinWasmToolingSetup` を実行する。
`build/compileSync/wasmJs/test/testDevelopmentExecutable/kotlin/` に `<module>-test.mjs` ができる。そのまま Node で動かすには:
1. `build/compose/skiko-runtime-processed-wasmjs/skiko.*` を同じディレクトリへコピーし、`skiko.mjs` を `export default {};` に差し替える。
2. `<module>-test.import-object.mjs` の `'./skiko.mjs': <ns>` を `new Proxy({}, {get: () => () => {}})` に書き換える（wasm の import がすべて callable である必要がある）。
3. `npm i --no-save @js-joda/core`（例。`.mjs` が bare import するパッケージを入れる）（`NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt` を付ける）。
4. 小さなランナーを書く: `globalThis.kotlinTest = {}`、`describe` / `it` を配列に集める関数を `globalThis` に定義 → `import` した `startUnitTests()` を呼ぶ → 集めたテストを順に実行して PASS / FAIL を出す。
Maven が `429 Too Many Requests` を返すことがあるので、30 秒空けて 2〜3 回リトライする（失敗するのは取得だけで、再実行で通る）。
リトライでも通らないときは、[cloud-session.md](cloud-session.md) の Google のミラーを差し込む init スクリプトを使う。

## suspend 関数を coroutines-test なしでテストする
`kotlinx-coroutines-test` を依存に足さなくても、実際には中断しない suspend 関数（例: `getString` を差し替えた
`suspend (CategoryId) -> String` を受け取る移行処理）なら、標準ライブラリだけで呼べる:
```kotlin
fun <T> runSuspend(block: suspend () -> T): T {
    var result: Result<T>? = null
    block.startCoroutine(Continuation(EmptyCoroutineContext) { result = it })
    return checkNotNull(result) { "the block suspended" }.getOrThrow()
}
```
依存を増やすと Nix の `deps.json` の再生成が要るプロジェクトでは、この方が安い。

## 並べ替えて保存するなら、メモリ上の並びも揃える（2026-10-20）
ファイルには ID 順・日付順で書き出したのに、メモリ上のリストは追加した順のままにしていた。そのため
「保存 → 読み込み直し → `assertEquals(ledger.data, reopened.data)`」がリストの並び順の違いで失敗した。
更新のたびに保存時の順序へ正規化すると、テストも通り、再読み込みで画面の並びが変わることもない。
正規化する前に、画面がリストの順序に頼っていないかを確認する（例: 同じ日の取引は、データのリスト順のまま表示されていた）。
ULID は時刻順なので、同じ日の中を ID の降順にすれば「新しく追加した順」になる。移行で ULID をまとめて振るときは、
`generateUlid(timeMillis = now - index)` のように 1 ミリ秒ずつずらすと、元のリスト順を ID から復元できる
（同じミリ秒の ULID どうしは、ランダム部分で順序が決まってしまう）。
