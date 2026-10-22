---
name: github-actions
description: GitHub Actions で Secrets を使うワークフローを書くときの知見 — Action を SHA で固定する手順（git ls-remote と ^{}、公開日の確認）、Environment の Secrets と再利用可能なワークフロー、Secrets のジョブと書き込み権限のジョブを分ける、setup-gradle のキャッシュの既定、actionlint をクラウドで動かす、Android の署名を環境変数から作る、GitHub App の Web フローは PKCE でも client_secret が必須
type: reference
---

## Action をコミット SHA で固定する（2026-10-22、tmp-budget-book）
- `git ls-remote https://github.com/<owner>/<repo>.git refs/tags/<tag> 'refs/tags/<tag>^{}'` で SHA を取る。
  注釈付きタグ（gradle/actions など）は `^{}` の行がコミットで、`^{}` のない行はタグオブジェクトなので使わない。
- コミット日は `git init x && git -C x fetch --depth 1 <url> <sha> && git -C x log -1 --format=%cI FETCH_HEAD` で分かる。
  これはタグを付けた日（リリース日）ではない。タグは後から付けられるので、厳密には Release の `published_at` を見る。
  2 週間たっていない版は避け、一つ前の版にした（setup-java 6.1.0 → 6.0.1）。
- 入力の名前は、同じ方法で `action.yml` を `git show FETCH_HEAD:action.yml` して確かめる（メジャー版で変わる）。
- `uses: owner/repo@<sha> # vX.Y.Z` とコメントで版を残す。

## Environment の Secrets と再利用可能なワークフロー（2026-10-22、tmp-budget-book）
- 呼び出し側の `uses:` のジョブには `environment:` を書けない。再利用可能なワークフローのジョブに
  `environment: ${{ inputs.environment }}` を書けば、そこで `secrets.X` として Environment の Secrets を読める（`secrets: inherit` は要らない）。
- `uses:` のジョブにも `if:` と `permissions:` は書ける。呼ばれる側の権限は呼び出し側以下になる。
- Release への添付など `contents: write` が要る処理は、Secrets を持たない別のジョブにし、APK は artifact で渡した。
- ワークフローのトップに `permissions: {}` を置き、ジョブごとに必要な権限だけを付ける。
- `github.run_number` はドキュメント上は文字列なので、`type: string` の入力にそのまま渡してよいはず（`format('{0}', ...)` で包んだが、おそらく不要）。
- タグ名や入力値は `run:` に `${{ }}` で埋め込まず、`env:` 経由で渡す。タグから作る値は正規表現で検証する。

## gradle/actions/setup-gradle のキャッシュ（2026-10-22、v6.4.0）
- 既定ではデフォルトブランチでだけキャッシュを書き、他（PR など）では読むだけ。
- release のビルドは `cache-disabled: true` にした（他のビルドが書いたキャッシュが release に入らないように）。
- wrapper の検証（`validate-wrappers`）は v4 以降で既定で有効。

## actionlint をクラウドで動かす（2026-10-22）
`proxy.golang.org` は通るので `GOBIN=<dir> go install github.com/rhysd/actionlint/cmd/actionlint@v1.7.7` で入る。shellcheck は入っていなかった（2026-10 時点）ので、
`run:` のシェルは変数を設定してローカルで実際に動かして確かめた。

## Android の署名を環境変数から作る（2026-10-22、tmp-budget-book、AGP 9.4）
- `providers.environmentVariable("KAKEIBO_KEYSTORE_FILE").isPresent` のときだけ `signingConfigs.create(...)` し、build type の `signingConfig` に入れる。
  無ければ debug は既定のデバッグ鍵、release は未署名（`<module>-release-unsigned.apk`）になる。
- debug のアプリ名は `src/debug/res/values*/strings.xml` で `app_name` を上書きすれば変えられる（`resValue` は AGP 9 では buildFeatures が要る）。
- 確認は `build-tools/<ver>/aapt2 dump badging <apk> | grep -E "^package|application-label:"` と `apksigner verify --print-certs <apk>`。
- テスト用の鍵は `keytool -genkeypair -keystore t.jks -alias a -keyalg RSA -keysize 2048 -validity 1000 -storepass ... -keypass ... -dname CN=test`。

## GitHub App のユーザートークン（Web フロー、2026-10-22 に docs.github.com で確認）
PKCE（S256 のみ）に対応しているが、トークンの交換とリフレッシュには GitHub App でも `client_secret` が必須（Device Flow を除く）。
ネイティブアプリでは secret を同梱するしかない。GitHub のドキュメント（Best practices for creating a GitHub App / OAuth app）は、secret を秘密にできないアプリでは同梱したうえで PKCE を使うよう勧めている。ビルド時に Secrets から注入しても APK からは取り出せる、とレビューで指摘する。
