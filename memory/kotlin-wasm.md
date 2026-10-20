---
name: kotlin-wasm
description: Kotlin/Wasm から JS の非同期 API（OPFS など）を使う方法 — js() で globalThis にヘルパーを置く、Promise を suspendCoroutine で待つ、書き込みを Promise チェーンで順序付ける、配列は文字列にして受け取る
type: reference
---

## js() で JS のヘルパーをまとめて置く（2026-10-20）
`js()` の中から別の Kotlin 関数や別の `js()` 関数は呼べない。複数の操作が同じ内部ヘルパーを使うときは、
1 つの `js()` 関数で `globalThis.xxx ??= (() => { ...; return { read, write, ... } })()` のようにオブジェクトを作って返す。
各操作は `private fun opfsRead(files: JsAny, path: String): Promise<JsString?> = js("files.read(path)")` のように、そのオブジェクトを引数で受け取る。
複数行の JS は Kotlin の raw string（`"""..."""`）で書ける。raw string はエスケープを処理しないので、JS の `'\n'` はそのまま JS に渡る。
ただし `$` は Kotlin の文字列テンプレートとして解釈されるので、JS のテンプレートリテラル（`` `${x}` ``）は使わず、文字列の連結にする。

## Promise を coroutines なしで待つ
`kotlinx-coroutines` を依存に足さなくても、標準ライブラリだけで書ける:
```kotlin
private suspend fun <T : JsAny?> Promise<T>.await(): T = suspendCoroutine { continuation ->
    then<JsAny?>(
        { value -> continuation.resume(value); null },
        { error -> continuation.resumeWithException(IllegalStateException(error.toString())); null },
    )
}
```
`then` の型引数（`<JsAny?>`）は明示する。
`kotlinx-coroutines-core` を明示的に依存に入れているモジュールなら、その `Promise.await()` を使えばよい（Compose 経由の推移的依存には頼らない）。

## 書き込みは同期の API にして、JS 側で順序付ける
OPFS の書き込みは非同期だが、呼び出し側（Compose のクリックハンドラなど）を suspend にしたくなかった。
JS 側で `queue = queue.then(task).catch(e => console.error(...))` と 1 本の Promise チェーンに積めば、書き込みと削除は順序どおりに行われる。
読み込みも `queue.then(...)` から始めれば、それより前に積んだ書き込みの結果が見える。
この形では、書き込みの失敗は `console.error` に出るだけで、呼び出し側には伝わらない。失敗を画面に出したいなら、別に通知の仕組みが要る。

## JS の配列は文字列にして受け取る
ファイル名の一覧などは `names.join('\n')` で 1 つの文字列にして返し、Kotlin 側で `split('\n')` すると、`JsArray` の変換を考えずに済む。

## OPFS
- `createWritable()` → `write()` → `close()` で書く。`close()` するまで元の内容は置き換わらない。
  `createWritable()` は Safari では最近まで使えなかった（古い Safari では Worker の中で sync access handle を使う必要がある）。Chromium でしか確かめていない。
- 存在しないファイルやディレクトリは `NotFoundError` で reject される。読み込みでは null に、削除では無視に変換する。
- `navigator.storage.persist()` を呼んでおくと、ストレージが逼迫しても退避されにくくなる（失敗は無視してよい）。
