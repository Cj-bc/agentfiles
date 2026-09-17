---
name: unity
description: Unity (2022.3 系) で実際に踏んだ罠 — headless テスト、Editor 起動中のコンパイル検証、asmdef 参照、PlayMode テストの API 制約、nullable、シーン YAML 上の UI 既定値
type: reference
---

実例はすべて 実際のプロジェクト (Unity 2022.3.62f2) で観測したもの。他の Unity プロジェクトでも同じ前提で疑うこと。

## headless テスト (`-batchmode -runTests`)
- **PowerShell の `& Unity.exe` は待たない。** `Unity.exe` は GUI サブシステムの実行ファイルなので即座に戻り、
  `$LASTEXITCODE` は空、結果 XML はまだ無い（または前回実行の結果が残っている）。
  `Start-Process -Wait -PassThru` で待って `.ExitCode` を見る。
- **PlayMode は Unity が自分で再起動する**ので、`-Wait` でも早く戻ることがある。
  合否は常に XML（`test-run` 要素の `failed` / `inconclusive`）で判定する。実行前に古い XML を消し、
  「XML が出現する **または** Unity プロセスが消える」まで待つ（プロセス消滅だけを見ると再起動の隙間で抜ける）。
- `-runTests` と `-quit` は併用しない。`-testFilter "<Fixture>"` なら 1 フィクスチャ 2-3 分で済む。
- Editor が開いていると `Temp/UnityLockfile` のため実行できない。ユーザーが Editor を使っている可能性があるので、閉じてもらう前に必ず確認する。

## Editor を開いたままのコンパイル検証
リポジトリ直下に生成済みの `<Asmdef>.csproj` から参照・ソース・define を抜き出し、
Unity 同梱の Roslyn で asmdef 単位でコンパイルできる。
```bash
grep -oP '(?<=<HintPath>)[^<]+' X.csproj | tr '\\' '/'          # 参照
grep -oP '(?<=<Compile Include=")[^"]+' X.csproj | tr '\\' '/'  # ソース
grep -oP '(?<=<DefineConstants>)[^<]+' X.csproj | head -1 | tr ';' '\n'
# ProjectReference は HintPath が無い → Library/ScriptAssemblies/<名前>.dll を -r: で自分で足す
dotnet "C:/Program Files/Unity/Hub/Editor/<version>/Editor/Data/DotNetSdkRoslyn/csc.dll" @build.rsp
```
- `-target:library -nostdlib+ -langversion:9.0` が要る。`-noconfig` は csc.rsp に負けるので付けても効かない
- パスは Windows 形式 (`C:/...`) で渡す。Git Bash の `/c/...` だと CS0006
- MonoBleedingEdge の `mcs` は使えない（C# 7.2 までで、`using var` が通らない）
- `Library/ScriptAssemblies/*.dll` は Editor が最後にコンパイルした時点のもの。作業ツリーのほうが進んでいると、触っていないファイルでエラーが出る — 自分のエラーと切り分ける

## テストの asmdef と API
- **PlayMode テストの asmdef（`includePlatforms: []`）からは `UnityEditor` を参照できない。**
  `SerializedObject` を使うと CS0246 になる。`[SerializeField] private` へは reflection で注入する
  （`GameObject.SetActive(false)` で `Awake` を止めてから注入し、`SetActive(true)` に戻す）。
  EditMode（`includePlatforms: ["Editor"]`）なら使えるが、`Update()` 駆動の処理は PlayMode でしか回らない。
- `overrideReferences: true` の asmdef では、**`Unity.TextMeshPro` は明示的な参照が必要**
  （無いと `TMPro` が CS0246）。**`UnityEngine.UI` は参照を足さなくても解決する。**
  どちらも `autoReferenced` なので asmdef を読むだけでは区別できない。推測せず、実際にコンパイルして確かめる。

## C# の nullable
Unity のプロジェクトには `<Nullable>` の設定が無く、`csc.rsp` も無ければ nullable は **ファイル単位の `#nullable enable`** でしか有効にならない。
付け忘れたファイルの `T?` は CS8632 の警告が出るだけで、null 検査は一切効かない。
既存コードに広く残っていることが多いので、「このファイルだけ異常」と決めつけない。
`#nullable enable` を足すと `[SerializeField]` に CS8618 が出る → `#pragma warning disable CS8618` / `restore` で囲むのが無難。

## UI の既定値はシーン YAML にある
既定のテキストや表示状態はシーン / prefab の YAML 側に保存されている。C# だけを読んで「そんな要素は無い」と結論しない。
旧コードがフィールドに触れていないのは、要素が無いからではなく静的な値で足りていたからかもしれない。
無条件に `SetText` / `enabled` を叩く API へ載せ替えるときは、先に YAML で `m_text` / `m_IsActive` / `m_Enabled` を確認する。
（実例: `title: ""` を渡して、シーンに静的に置かれていた見出し「解説」を消した。）
