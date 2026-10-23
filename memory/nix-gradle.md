---
name: nix-gradle
description: nixpkgs の Gradle（gradle.fetchDeps の deps.json）で固定したプロジェクトの依存を上げたとき、Nix 側で一緒に直すもの — deps.json、mkGradle の hash、Kotlin Gradle プラグインの jar（gradleNN 変種を Gradle に合わせる）、yarn のハッシュ、androidenv の SDK
type: reference
---

## 依存を上げたら Nix 側で一緒に直すもの（2026-10-18、tmp-budget-book で Compose 1.12 / Kotlin 2.4 / Gradle 9.8 に上げたとき）
クラウド環境で Nix を動かすときの罠（フレーク入力の 403、FOD の証明書、429）は [nix.md](nix.md)、具体的な事例は [nix-gradle-android.md](nix-gradle-android.md) を参照。
- `deps.json`: updateScript で再生成する（コマンドは nix-gradle-android.md の「クラウド環境での事例」）。約 3 分。
- Gradle を上げたら `mkGradle` の `hash`: `nix store prefetch-file --json https://services.gradle.org/distributions/gradle-X-bin.zip | jq -r .hash`（fetchurl なので flat）。
- Kotlin Gradle プラグインの jar を直接 fetch している（同梱の yarn.lock を取り出すため）なら、版だけでなく `-gradleNN` の変種も Gradle に合わせる。
  KGP 2.4.21 + Gradle 9.8 は `gradle96`（2.3.20 + Gradle 9.6 は `gradle813` だった）。どれが選ばれたかは `~/.gradle/caches` の jar 名で分かる。
  jar が変われば同梱の yarn.lock も変わるので、その `fetchYarnDeps` のハッシュも計算し直す。
- androidenv の `platformVersions` / `buildToolsVersions` を compileSdk に合わせる（activity 1.13 は `minCompileSdk=36`）。
