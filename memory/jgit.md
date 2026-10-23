---
name: jgit
description: JGit（5.13、Android / JVM）でアプリのデータを同期するときの罠 — 新しいリポジトリ同士の最初のコミットが同じハッシュになりうる、空の設定に差し替えると save() で NPE、マージコミットは writeMergeHeads → commit、bare リポジトリを file URI のリモートにしてテストする、バックグラウンドのスレッドに積んだ処理はテストで待ってから読む、Gradle でビルド時に秘密の値から Kotlin を生成する
type: reference
---

## 新しいリポジトリ同士の最初のコミットが同じハッシュになる（2026-10-23、tmp-budget-book）
`.gitattributes` だけを書いてからコミットする作りだと、2 台の新しい端末の最初のコミットは木・作者・メッセージが同じになる。
時刻（秒単位）まで同じなら**コミットのハッシュも同じ**になり、別々に始めた履歴が「共通の祖先を持つ」と判定される。
テストでは同じ秒に 2 台を作るので毎回起き、マージが 2 つの家計簿の和集合（重複したプリセット）を作った。
- 共通の祖先が見つかっても、その祖先にデータのファイル（`master.json`）がなければ「無関係な履歴」として扱う。
- 同じ理由で、ローカルの HEAD にデータがなければ、新しい端末とみなしてリモートの履歴をそのまま取る。

## `SystemReader` で空の設定に差し替えたら `save()` も空にする（2026-10-23）
`openUserConfig` などで `FileBasedConfig(parent, null, fs)` を返すと、JGit がファイルシステムの性質（タイムスタンプの分解能）を
その設定に保存しようとして、`JGit-FileStoreAttributeWriter` スレッドで `NullPointerException`（`LockFile.getLockFile` の file が null）が出る。
テストは通るので気づきにくい。`load()` と一緒に `save()` も何もしないよう override する。

## マージコミットを自分で作る（2026-10-23）
自前のマージ（レコード単位など）の結果を作業ツリーに書いたあと、`repository.writeMergeHeads(listOf(theirs))` してから
`git.add()` → `git.commit()` すると、親が 2 つのコミットになる（状態が MERGING_RESOLVED になり、commit が MERGE_HEAD を読んで消す）。

## fetch / push / fast-forward（2026-10-23）
- 設定済みのリモートなしで `fetch().setRemote(url).setRefSpecs(RefSpec("+refs/heads/*:refs/remotes/origin/*")).setRemoveDeletedRefs(true)` できる。
  リモートにブランチがなくても失敗しないので、`resolve("refs/remotes/origin/main")` が null かで空のリモートを判定できる。
  `setRemote(url)` で push しても追跡ブランチは更新されないので、次の fetch で揃える。
- push の結果は `RemoteRefUpdate.Status` で見る（`REJECTED_NONFASTFORWARD` は相手に新しいコミットがある）。例外にはならない。
- fast-forward やリモートへの置き換えは、`updateRef("refs/heads/main")` を `isForceUpdate = true` で動かしてから `reset().setMode(HARD)`。
  HEAD がまだない（unborn）リポジトリでも、追跡されていない `.gitattributes` があっても通った。
- 共通の祖先は `RevWalk` に `revFilter = RevFilter.MERGE_BASE` を設定し、両方を `markStart` して `next()`。
- GitHub への HTTPS は `UsernamePasswordCredentialsProvider("x-access-token", <user access token>)`。

## テスト（2026-10-23）
- リモートは `Git.init().setBare(true).setInitialBranch("main")` で作り、`dir.toURI().toString()`（`file:/...`）を URL に渡す。ネットワークなしで fetch / push まで確かめられる。
- 読み書きを 1 本のスレッドに積む実装では、テストのスレッドから `Git.open` して HEAD を読む前に、キューを待つ（何かを読む suspend 関数を呼ぶ）。
  待たないと、まだコミットされていない HEAD を読んで、たまにだけ失敗する。

## ビルド時に秘密の値から Kotlin のソースを生成する（Gradle、KMP、2026-10-23）
`providers.environmentVariable(name).orElse(providers.fileContents(rootProject...file("local.properties")).asText.map { Properties().apply { load(StringReader(it)) }.getProperty(name).orEmpty() }).orElse("")`
を `@Input` にした生成タスクを作り、`sourceSets.androidMain { kotlin.srcDir(task) }` に入れる（`com.android.kotlin.multiplatform.library` でも動いた）。
値は `\` `"` `$` をエスケープして文字列リテラルにする。Android のマニフェストでは `android:scheme="${applicationId}"` が使え、
debug（`applicationIdSuffix`）と release で OAuth のリダイレクト先を分けられる（マニフェストはアプリ用モジュールの方に書く）。
生成した値は APK から取り出せるので、公開されたものとして扱う（[github-actions.md](github-actions.md) の GitHub App の節）。
