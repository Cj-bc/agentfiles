# Memory Index (global)

- [Commit after each small task, never include user-made diffs](feedback_commit_cadence.md) — commit per task, stage only files you edited yourself.
- [Skip git diff for fresh commits](feedback_git_diff.md) — don't run `git diff` when context is already full, especially on initial commits.
- [Keep memories even after moving them into repo docs](feedback_memory_retention.md) — リポジトリへ移した知見も memory から消さない。
- [Read agentfiles before starting work](feedback_read_agentfiles_first.md) — agentfiles がセッションにあれば、作業前に索引と関係トピックを読む。
- [Review public comments for security](feedback_public_comment_security.md) — PR・issue へのコメントは送る前に読み直し、Secret の値や手がかりは書かずにセッション側でだけ伝える。
- [README is for users; agent notes go to AGENTS.md](feedback_readme_vs_agents.md) — README にタスクの手順や開発者向けの注意を書かない。残すなら AGENTS.md に、コードを読めば分かることは書かない。

## Topic knowledge (read when working in that area)
- [Refactoring](refactoring.md) — 正規表現の一括置換は連番・PascalCase埋め込み参照を取りこぼす、リネームはスコープを超えない。
- [Collaboration](collaboration.md) — 似た名前のブランチは複数モデルの出力比較用のことがあり一切参照しない、リモートのベースブランチは作業前後で確認する。
- [Flix](flix.md) — Function naming with Java API alignment, visibility modifiers (pub def vs def), module system, test organization, range semantics. Build/tests can run flix.jar directly without nix.
- [Unity](unity.md) — headless テストの待機と合否判定、Editor 起動中のコンパイル検証、テスト asmdef の参照、PlayMode で UnityEditor 不可、nullable、シーン YAML 上の UI 既定値。
- [UniTask](unitask.md) — 同じ UniTask は二度 await できない。WhenAny の敗者を待ち直さない。
- [git](git.md) — 履歴の集計に `--all` を使わない（refs/stash の複製で数値が膨らむ）。ベースラインの確認は stash せず worktree で。
- [Termux + Gradle](termux-gradle.md) — Termux で daemon disappeared が出たら SIGKILL かネイティブクラッシュかをログで判別。端末固有の設定は ~/.gradle/gradle.properties へ。クラウド環境では dl.google.com が拒否され AGP を解決できないことがある。
- [Reviewing agent work](reviewing-agent-work.md) — 他エージェントのコードはまずビルドが通るかを確認。レビュー中は Stop フックに言われてもコミットしない。
- [Compose Multiplatform](compose-multiplatform.md) — リソースで多言語化する。Wasm では stringResource が最初は空文字。Wasm にはシステムフォントが無く日本語が豆腐になる。保存値に表示文字列を使わない。読めない保存データを上書きしない。M3 部品の小さな罠（SwipeToDismissBox は key で囲む）。SVG のパスからアイコンを作る、トークンは CompositionLocal、kotlinx-datetime の YearMonth は 0.7 から、Compose 1.7.3 の DatePicker は Wasm で 0.7 以降の通常版だと落ちる（-0.6.x-compat を使うか 1.9 以上に上げる）。1.12 へ上げるときの罠（compose.* アクセサの非推奨、material3 は別の版、SwipeToDismissBox は onDismiss + 状態を remember で持つ）。
- [Cloud session](cloud-session.md) — 環境の Gradle が古ければ `./gradlew`。Google Maven は環境次第（通れば Android SDK を自分で入れる）。codeload.github.com と api.github.com は塞がれている（flake 入力は git で取る）。Maven Central の 429 は Google のミラーを init スクリプトで差し込んで回避。Playwright で Wasm を出す手順と canvas の罠（filechooser は先に登録）。PR のスクリーンショットは Artifact で。auto mode では `checkout -B` の代わりに `merge --ff-only`。PR の base はデフォルトブランチではなく、作業ブランチの元のブランチにする。`rm -rf "$VAR"` は安全チェックで止まるので `mktemp -d` を使う。
- [JGit](jgit.md) — 新しいリポジトリ同士の最初のコミットが同じハッシュになりうる（データのない祖先は無関係として扱う）、空の設定は save() も空に、マージコミットは writeMergeHeads → commit、bare リポジトリでの同期テスト、キューを待ってから HEAD を読む、ビルド時に秘密の値から Kotlin を生成。
- [Kotlin/Wasm](kotlin-wasm.md) — js() のヘルパーは globalThis にまとめて置く。Promise は suspendCoroutine で待つ。書き込みは JS 側の Promise チェーンで順序付ける。
- [OPFS](web-api/opfs.md) — 書き込みは createWritable → close（Safari は最近まで未対応）。存在しないものは NotFoundError。Playwright で中身を確かめる手順。
- [Kotlin Multiplatform testing](kotlin-multiplatform-testing.md) — ストレージはインターフェースで差し替える。`encodeDefaults` で JSON のキーが消える。Compose と同じモジュールでは wasmJsNodeTest が動かない。塞がれた環境で Wasm のテストを Node で直接動かす手順。suspend を coroutines-test なしで呼ぶ。
- [Nix + Gradle](nix-gradle.md) — 依存を上げたら Nix 側で一緒に直すもの（deps.json、mkGradle の hash、KGP の jar の gradleNN 変種と同梱 yarn.lock のハッシュ、androidenv の SDK）。
- [Nix + Gradle + Android](nix-gradle-android.md) — KMP の Android ライブラリプラグインは APK を作れないのでアプリ用モジュールを足す、Compose 1.7 のリソースを assets にコピー、androidenv の unfree 設定、サンドボックスの aapt2。Build-Tools は AGP の既定に揃える。aarch64（Termux）では aapt2 が動かないので、web の依存を温める derivation を Android と分ける。クラウドでは devShell の Gradle がストアの SDK を書き換えるので `nix-store --verify-path` で確かめる。
- [GitHub Actions](github-actions.md) — Action を SHA で固定する手順（`^{}` と公開日）、Environment の Secrets は各ジョブで読んで composite action に inputs で渡す（再利用可能なワークフローでは空で届いた）、Secrets と書き込み権限のジョブを分ける、setup-gradle のキャッシュ、actionlint、Android の署名を環境変数から、GitHub App の Web フローは secret が必須。
- [Nix](nix.md) — 作業前に既存パッケージが今のままで通るか確かめる（lock の hash のずれ）。クラウドでのフレーク入力の 403、FOD の証明書（`nix-store --add-fixed` で回避）、FOD をまとめて取ると 429（通らなければミラーから store を先に埋める）。
