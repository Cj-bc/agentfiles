---
name: termux-gradle
description: Termux（Android）上の Gradle で `DaemonDisappearedException` が出たときの切り分け — SIGKILL（phantom process killer / LMK）かネイティブクラッシュかをログで判別する。回避設定は ~/.gradle/gradle.properties に置く
type: reference
---

## Termux で「Gradle build daemon disappeared unexpectedly」
Windows では通るビルド（Kotlin Multiplatform + Compose、wasmJs + AGP 9.4、Gradle 9.6、`-Xmx2g`）が、
Nothing Phone 3（Android 15）の Termux では `DaemonDisappearedException` で失敗した（2026-10-03、tmp-budget-book）。
**原因は未確定。** 以下は仮説と切り分け手順。確定したらこのファイルを更新する。

### 仮説（可能性の高い順）
1. **Android がプロセスを SIGKILL している。** Android 12 以降の phantom process killer
   （子プロセス数の上限や、バックグラウンドでの CPU 過多で kill する）か、LMK。
   Gradle daemon、Kotlin compile daemon（別 JVM で、ヒープ設定は Gradle と同じものを引き継ぐ）、node/webpack、wasm-opt が同時に動くと狙われやすい。
   SIGKILL では `hs_err_pid*.log` が残らず、daemon ログが途中で途切れる。
2. **JVM のネイティブクラッシュ。** Gradle 同梱の native-platform / file-events は glibc 向けで、Termux の JVM は bionic。
   ファイル監視が怪しい。この場合は `hs_err_pid*.log` が出る。

### ユーザーに頼む切り分け
- `~/.gradle/daemon/<ver>/daemon-*.out.log` の末尾
- プロジェクトのルートか `~/.gradle/daemon/<ver>/` に `hs_err_pid*.log` があるか（あれば仮説 2）
- Termux をフォアグラウンドにしたままでも落ちるか、画面に `[Process completed (signal 9)]` が出ていないか（出ていれば仮説 1）
- スタックトレースに `SingleUseDaemonClient` があれば、`--no-daemon` か `org.gradle.daemon=false` が効いている

### 回避策（リポジトリは変更しない）
端末固有の設定は `~/.gradle/gradle.properties` に置く。ここに書いた値はプロジェクトの `gradle.properties` より優先されるので、他の OS には影響しない。
```properties
kotlin.compiler.execution.strategy=in-process   # Kotlin daemon の JVM を減らす
org.gradle.workers.max=2
org.gradle.parallel=false
org.gradle.vfs.watch=false                      # 仮説 2 の対策
```
仮説 1 の根本対処は、開発者オプションの「子プロセスの制限を無効にする」（Android 14 以降）か、
`adb shell settings put global settings_enable_monitor_phantom_procs false`。

## クラウド（Claude Code on the web）環境では AGP を解決できない
既定のネットワークポリシーでは `dl.google.com` が 403 で拒否されるため、Google Maven の
AGP（`com.android.*` プラグイン）が解決できず、Android を含むビルドは設定段階で失敗する。
再現が必要なら、ユーザーに環境の Network access で `dl.google.com` を許可してもらう。
