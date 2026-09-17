---
name: unitask
description: UniTask (Cysharp) の罠 — 同じ UniTask は二度 await できない。WhenAny の敗者を待ち直すと実行時に落ち、Preserve() でも救えない
type: reference
---

## UniTask は一度しか await できない
`IUniTaskSource` はプールに返却されるため、同じ UniTask は **一度しか await できない**。
`WhenAny` は渡したタスクをすべて消費するので、負けた側を後から待ち直すと
`InvalidOperationException: Already continuation registered, can not await twice or get Status after await.` で落ちる。

```csharp
// NG: skipTask は WhenAny が消費済み
await UniTask.WhenAny(UniTask.Delay(d, ct), skipTask);
skipCts.Cancel();
await skipTask.SuppressCancellationThrow();   // 落ちる

// NG: Preserve() が memo できるのは「完了済み」のソースだけ。直後の敗者はまだ未完了
var t = UniTask.Delay(d, ct).SuppressCancellationThrow().Preserve();
await UniTask.WhenAny(t, skip);
cts.Cancel();
await UniTask.WhenAll(t, skip);               // 敗者が未完了だと落ちる
```

**正しい形**: リンクした CTS を `Cancel()` するだけにして、敗者は待ち直さない。後始末（敗者側の `finally` など）は次のフレームで走る。

このバグはコンパイルが通り、実行して初めて表に出る。2026-08-21 に Claude と Codex が同じ箇所で踏んだ。この形のコードには PlayMode 等の実行テストを書く。
