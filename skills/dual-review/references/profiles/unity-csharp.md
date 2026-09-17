---
profile_id: unity-csharp
markers: ["ProjectSettings/ProjectVersion.txt"]
---

# プロファイル: Unity / C#

Unity プロジェクト一般に成り立つ観点だけを書く。
特定プロジェクトの ADR 番号・シナリオ名・既知の赤テストなどは
`<repo>/.claude/dual-review-profile.md` 側に置くこと。

**判定順の注意**: Unity は `.csproj` / `.sln` を自動生成するので、
`dotnet-csharp` より**先に**このプロファイルを判定すること
（実測: Unity リポジトリ 2 件とも `*.csproj` にヒットした）。

## 規約ファイル候補

- `CLAUDE.md` / `AGENTS.md` / `CONTRIBUTING.md`
- `.claude/knowledge/**`（ADR や設計メモの置き場になっていることが多い）
- `Assets/Documents~/**`（`~` サフィックスのディレクトリは Unity のインポート対象外。
  ドキュメントを Asset 化せず置く定番の場所）
- `docs/adr/**` / `**/adr/**`
- `Packages/manifest.json`（**使用ライブラリの判定に使う**。UniTask / R3 / Zenject など）

## テスト（既定値）

- Unity Test Framework。EditMode / PlayMode の 2 系統。
  配置はプロジェクトごとに違うので**実物を見る**（`*.asmdef` に
  `"UNITY_INCLUDE_TESTS"` や `nunit.framework.dll` 参照があるものがテストアセンブリ）。
  よくある配置: `Assets/Tests/`（EditMode） / `Assets/Tests.Playmode/`（PlayMode）、
  あるいは機能ごとの `**/Tests/`。
- 実行コマンド（参考）:
  `Unity.exe -batchmode -projectPath <path> -runTests -testPlatform EditMode -testResults <xml>`
- **レビュワーには実行させない**。Unity のヘッドレス実行は `Temp/UnityLockfile` を要求し、
  エディタを開いているユーザーの作業を壊す。`{{EXTRA_PROHIBITIONS}}` に必ず入れる。

## 生成物パターン

- `Library/` `Temp/` `Logs/` `obj/` `Build/` `Builds/` `UserSettings/`
- `*.csproj` `*.sln`（Unity が生成する。コミット対象にしているリポジトリもあるので
  `.gitignore` を見て判断する）

## digest 対象（巨大な機械生成テキスト）

- `*.unity` `*.prefab` `*.asset` `*.mat` `*.controller` `*.anim`
  — 抜き出す情報: 変更されたプロパティ名の一覧 / 参照 GUID (`guid:`) の追加・削除件数 /
  追加・削除されたコンポーネントの種類

これを digest しないと、レビュワーのコンテキストが YAML で埋まり C# が読まれない。

## 機械チェック（監督がフェーズ 1-4 で実行する）

1. **`.meta` 欠落**: 追加された非 `.meta` ファイルで、対応する `<path>.meta` が
   diff にも作業ツリーにも無いもの → `WARNING: missing .meta`

   **必ず 2 つの前処理を入れる**（入れないと全件が偽の WARNING になる。実測で踏んだ）:
   - **パスの取得は `git -c core.quotepath=false ...`**（または `-z`）。
     既定では非 ASCII のパスが `"\343\203\237..."` と 8 進エスケープ + 引用符付きで返り、
     そのままでは存在判定が全て失敗する。日本語のアセット名は珍しくない。
   - **対象は `Assets/` 配下だけ**。`.meta` を持たないのが正常なもの:
     リポジトリルートの各種ファイル、`Packages/`、`ProjectSettings/`、
     そして **`~` で終わるディレクトリの中身**（Unity のインポート対象外）。
2. **孤児 `.meta`**: 削除されたファイルの `.meta` が残っている / `.meta` だけが追加されている。
3. **`.meta` GUID の変更**: 既存 `.meta` の `guid:` 行が変更されている
   （リネーム時に GUID を維持できておらず、全参照が切れる）。
4. **serialized field の増減**: `diff.patch` から `[SerializeField]` 付きフィールドと
   `public` フィールドの追加・削除・改名を抽出して一覧化。
5. **配線の同伴**: 4 が非空なのに diff に `.unity` / `.prefab` の変更が **1 つも無い** 場合、
   `WARNING: serialized field changed but no scene/prefab wiring in this branch`。
   これは「ブランチ単独でチェックアウトすると参照が未割り当てになる」典型的な壊れ方。
6. **アセンブリ定義**: `*.asmdef` の `references` から削除された参照があるのに、
   そのアセンブリ内で当該名前空間がまだ使われている。

## レビュー観点（`{{ECOSYSTEM_CHECKS}}` に流し込む本文）

### Unity の直列化と配線整合

- `[SerializeField]` フィールドのリネームに `[FormerlySerializedAs]` が付いていない
  （シーン / prefab に保存済みの値が失われる）。
- MonoBehaviour のクラス名とファイル名の不一致（Unity がスクリプトを解決できない）。
- `.meta` の GUID が変更されている（リネーム時に GUID を維持していない）。
- 新規ファイルに `.meta` が無い / 削除ファイルの `.meta` が残っている。
- **serialized field を追加・削除・改名したのに、対応するシーン `.unity` / prefab `.prefab` の
  配線が同じ差分に含まれていない。** これは 🔴 Blocker として扱う:
  このブランチだけをチェックアウトすると参照が未割り当てになり、実行時に
  `NullReferenceException` になる。他人の作業ツリーに未コミットで残っている Editor 編集に
  依存したブランチは、それ単体では壊れている。
  （`machine-audit.txt` の `WARNING: serialized field changed but no scene/prefab wiring` を参照）

### Unity ランタイムの罠

- `Awake` / `OnEnable` / `Start` の実行順に依存した初期化。
- 破棄済み UnityEngine.Object への参照（`== null` は破棄済みで true になる／
  `?.` や `??` は破棄済みを検知できない）。
- `Update` 内での `GetComponent` / `Find` / `LINQ` / 文字列連結によるアロケーション。
- `Instantiate` した object の `Destroy` 漏れ、`DontDestroyOnLoad` の多重生成。
- コルーチンが MonoBehaviour の無効化・破棄で暗黙に止まることへの依存（あるいは止め忘れ）。
- シーン遷移をまたぐ static / シングルトンの状態残留。

### C# 一般

- `async void`（イベントハンドラ以外）、`.Result` / `.Wait()` によるデッドロック。
- `IDisposable` の解放漏れ、`using` の欠落。
- イベント `+=` に対する `-=` の欠落（対象が長寿命なら実質リーク）。
- `catch (Exception)` での握り潰し、`OperationCanceledException` の巻き込み。
- 構造体の意図しないコピー、`readonly struct` にできる巨大構造体。
- enum に対する `switch` の網羅漏れ（新しい値が追加されたときに黙って通る形）。

### 非同期ライブラリ（`Packages/manifest.json` を見て**使っている場合のみ**適用）

UniTask (`com.cysharp.unitask`) を採用しているプロジェクトでは:

- `async` / `UniTask` を返すメソッドが `CancellationToken` 引数を取っていない。
- 受け取った token を**呼び出し先に渡し忘れている**（伝播の断絶）。
- 正当な理由なく `CancellationToken.None` / `default` を渡している。
- `CancellationTokenSource` を作って `Dispose()` していない、
  または `Cancel()` 後に `Dispose()` していない（リーク）。
- `.Forget()` でキャンセル例外ごと握り潰している。
- MonoBehaviour の破棄後も生き続ける token
  （`this.GetCancellationTokenOnDestroy()` を使うべき箇所で使っていない）。
- token をフィールドに保持してオブジェクトの寿命を跨がせている。
- 同じ `UniTask` を 2 回 await している（UniTask は 1 度しか await できない。
  `WhenAny` の敗者を待ち直すのは不正）。
- プロジェクトが「UniTask 必須」を規約にしている場合、`Task` / `IEnumerator` コルーチンの混入。
  **規約に書かれていなければ指摘しない**（コルーチンは Unity の正当な選択肢）。

## このエコシステム由来の典型的な偽陽性

- **YAML の巨大 diff そのもの**。Unity のシーン / prefab は 1 プロパティ変更でも
  大量の行が動く。行数の多さ自体を指摘しない。
- **`Assets/**` 下のインポート済みサードパーティコード**の書式・規約違反。
  レビュー対象はプロジェクトが書いたコードであり、取り込んだアセットではない。
- **`.meta` ファイルの中身の差分**（`fileFormatVersion`, `timeCreated` 等の揺れ）。
  意味があるのは `guid:` と importer 設定だけ。
- **`?.` / `??` を UnityEngine.Object に使うな**という指摘は正しいが、
  相手が `UnityEngine.Object` でない（純粋な C# クラス）なら誤り。型を確認させる。
- **Shift-JIS で書かれた既存ファイル**。文字化けして見えても、
  そのファイルが元から Shift-JIS なら今回の変更の不具合ではない。
  「書き換える前にエンコーディングを疑え」を既知の例外に入れておくとよい。
