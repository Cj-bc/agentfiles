---
name: flix
description: Flix language and paranoid-time.flix — API design patterns, visibility modifiers, test organization, build/test without nix
type: reference
---

# Flix Language Knowledge

Key insights from paranoid-time.flix development, particularly the Java API alignment refactoring.

## API Design Principles (General Programming)

When aligning a library with a widely-known API (like Java's `java.time.Instant`), follow these naming and design patterns:

### Constructor functions

- **Try form** (returns Option/Result): Use `of*()` prefix
  - `ofEpochMilli(ms: Int64): Option[Instant]` — create from milliseconds, may fail if out of range
  - `ofEpochNano(ns: Int64): Instant` — create from nanoseconds, never fails

- **Saturating form** (clamps to range ends): Use `of*Clamped()` suffix
  - `ofEpochMilliClamped(ms: Int64): Instant` — create from milliseconds, clamp if out of range

- **Established names**: `min()`, `max()` for range boundaries (not `minInstance()`, `maxInstance()`)

### Arithmetic operations

- **Try form** (returns Option/Result): Use simple descriptive verbs
  - `plus()`, `minus()` — operation that may fail if result is out of range

- **Saturating form** (clamps to boundaries): Use verb + `Saturated` suffix
  - `plusSaturated()`, `minusSaturated()` — operation that clamps to range boundaries instead of failing
  - This naming convention clearly distinguishes strict vs lenient behavior in a language-agnostic way

### Query/accessor functions

- Use `to*()` for conversions: `toEpochMilli()`, `toEpochNano()`
- Use `get*()` for field access: `getEpochSecond()`, `getNano()`
- Use verb forms for computed values: `until()` (duration gap between two instants)

## Visibility Modifiers in Flix

- **`pub def`** — function is accessible from outside its module; use for public API
- **`def`** — function is private to its module; use for internal helpers

**Critical lesson**: Test files in other modules/packages must use `pub def` to access the function. If a test imports a function but it's defined as `def`, you get "inaccessible definition" error. This caught a late bug in paranoid-time.flix where `ofEpochMilliClamped` was defined as `def` but test262 tests tried to use it.

## Module System and Imports

- Use `use ModuleName.{function1, function2, ...}` to import specific items
- When renaming functions, update all `use` statements in test files — these won't auto-update
- Test discovery: Flix runs all tests matching `@Test` annotation regardless of function name
  - But if the function name changes and old names were referenced in `use` statements, imports break
  - Search for old function names across test files to catch missed renames

## Test Organization (General Best Practices)

When testing a library, organize tests by concern:

- **Unit tests**: One file per function family or concern
  - Group related functions and their tests together
  - Use clear file names that describe what is being tested

- **Compatibility tests**: When aligning with an established standard, port tests from that standard
  - Validates alignment with the reference implementation
  - Catches edge cases defined by the standard

- **Test helpers**: Provide builders and assertion helpers from the standard where applicable
  - Makes tests more readable and maintainable
  - Reduces test boilerplate

## Flix-Specific Test Practices

paranoid-time.flix demonstrates how to apply these in Flix:

- **File structure**: `test/TestTime/Instant/` — one module per function family
  - `Plus.flix` — tests for `plus()` and related arithmetic
  - `Minus.flix` — tests for `minus()` and related arithmetic
  - `Range.flix` — boundary and range limit edge cases
  - `Compare.flix` — ordering and comparison semantics

- **Compatibility integration**: `test/test262/` — ECMAScript Temporal test suite ported to Flix
  - Validates alignment with the JavaScript standard
  - Test discovery: Flix runs all functions marked `@Test` regardless of file or function name

- **Test harness in Flix**: Provides builders and assertions
  - `fromNanos(ns: Int64): Instant` — build an Instant from nanoseconds
  - `instant(seconds: Int64, nanos: Int32): Instant` — build from parts
  - `assertInstantsEqual(expected, actual, message)` — test equality with message

## Refactoring Strategy for API Design Changes (General)

When systematically changing function names across a library:

1. **Update implementation first**: Change function definitions in the source
2. **Update unit tests**: Change function calls in tests
3. **Update integration tests**: Update references across all test suites
4. **Verify test helpers**: Check that test helper/assertion functions match the new API
5. **Verify systematically**: Use find/grep to catch all usages of old names across the codebase
6. **Validate in layers**: Each layer of changes may produce errors; validate frequently

## Flix-Specific Refactoring Considerations

When refactoring in Flix:

- **Import statements**: `use` statements won't auto-update when names change — search for old names in all `use` clauses
- **Test discovery**: Flix runs all functions marked `@Test`, so test file names don't affect discovery; focus on updating imports and function calls
- **Scripted replacements**: Use `sed`/`grep` for bulk replacements, then manually verify import statements
- **CI feedback**: Each compilation error layer reveals missed references — use iterative CI validation to catch edge cases

## Range Semantics in Flix Instant

paranoid-time.flix uses two-field representation:
- `secondsSinceEpoch: Int64` — seconds from Unix epoch
- `nano: Int32` — nanoseconds within the second (0-999_999_999)

Range bounds:
- **Min instant**: `-9999-01-02T00:00:00Z` (one day into year -9999, not on its edge)
- **Max instant**: `9999-12-30T23:59:59.999999999Z` (one day before year 9999 ends)

The one-day slack allows UTC offset application without year overflow. This is a design detail that library documentation should make clear.

## Borrow Semantics in Arithmetic

When subtracting a duration from an Instant with negative nanoseconds in the result:
- Must "borrow" from seconds and negate both second and nanosecond parts separately
- Example: subtracting 1 nanosecond from epoch (0s, 0ns) results in (-1s, 999_999_999ns)
- This is handled internally in `minus()` and `minusSaturated()`; callers don't see it directly

## ビルド・テストは nix 無しで jar 直接実行できる

`flix.toml` の `flix = "X.Y.Z"` に対応する `https://github.com/flix/flix/releases/download/vX.Y.Z/flix.jar` を
落とし、`java -jar flix.jar test` / `check` で動く（JDK 21 のサンドボックス環境で確認）。
`nix` が使えない環境でもこれでローカル検証できる。
0.79.0 の `check` / `test` は、作業ディレクトリに `packages.lock`（依存のハッシュ）を作る。リポジトリが追跡していなければ、自分のタスクのコミットに混ぜない。

## Design Principle: Naming for Clarity

Align with established APIs when the domain is well-known (like Java's java.time). This reduces cognitive load for developers familiar with that ecosystem. Consistency matters more than achieving perfect consistency across the entire codebase — a brief import list documenting the rename is worth the clarity gained.

## enum の書き方で詰まりやすい点（Flix 0.75.1 で `check` して確認）

- 複数ケースの enum は `pub enum Foo { case A({ x = String }) case B }`。`pub enum Foo ({ case ... })` のように
  丸括弧で包むと `Expected <effect> before 'case'` という分かりにくいパースエラーになる。
- ケースが 1 つでレコードだけを持つ型は `pub enum Foo({ a = Int32, b = String })` と書く。
  レコード型の最後のフィールドの後ろにカンマを付けると `Trailing ','` エラーになる。
- 型名や effect 名がモジュール名の最後と同じ（`mod A.Foo` の中の `enum Foo` や `eff Foo`）だとそれは「companion」になり、
  モジュールの**最初の**宣言でなければならない（E5975）。後ろの宣言への前方参照は問題ない。
- 依存（`[dependencies]`）を解決できない環境では、`flix.toml` から依存を外したコピーで `check` すると、
  依存に関係しない構文・型のエラーだけを確かめられる。
  依存の名前を使っているファイルがあるときは、使っている名前だけを持つ代わりのモジュールを置く（例：`src/Time/Instant.flix` に
  `mod Time.Instant { pub enum Instant { case Epoch } }`）。標準ライブラリに `Time` があるので `mod Time {}` は書けない（E5410）。
  これは 0.75.1 の頃の手順。0.79.0 で `mount` した依存（`use paranoidTime::…`）は、パッケージ自体がないと参照できないので、代わりのモジュールでは置き換えられない。

## モジュールと effect で詰まりやすい点（Flix 0.75.1 で `check` / `test` して確認）

- **親モジュールを宣言しないと、外から参照できない。** `src/A/B.flix` に `pub mod A.B` だけがあり `src/A.flix`（`pub mod A {}`）がないと、
  そのモジュール自体にはエラーが出ない。参照している側（テストなど）だけが `Undefined name` / `Undefined use` になり（`check` でも `test` でも）、
  原因が親の不足だとは示されないので気付きにくい。途中の階層の親がない場合（`A.flix` はあるが `A/B.flix` がなく `A/B/C.flix` がある）は、
  `Orphaned module ... (missing parent ...)`（E5512）とはっきり出る。親の階層ごとに `.flix` を置く。
  **Flix 0.79.0 では、一番上の親がないときも E5512 が出る**（2026-11-06 に確認）。上の「エラーが出ない」は 0.75.1 での挙動。
- `pub mod A.B` はファイルのパスと一致させる（`A/B.flix`。違うと E5623）。`pub` のない `mod` には、この検査はかからない
  （テストの `mod TestFoo` も含む）。それでも揃えておく方がよい。
- `run` は予約語なので関数名にできない。
- シグネチャに書いた effect を本体で使わないとエラーになる（`Unused effect`、E6217）。スタブでも effect を実際に使う。
- `Assert.assertEq` には比較する型の `Eq` と `ToString` が要る。
- enum のケースの引数にレコード（`case FileError({ path = String, reason = String })`）を使うと、`with Eq, ToString` が導出できない（E7027 / E7249、0.79.0 で確認）。ケースが 1 つでレコードだけを持つ形（`pub enum Foo({ … })`）も同じ。比較や表示が要るなら、複数の値は `case FileError(String, String)` のように並べる。
- effect の違う関数を同じリストに入れるには、「自分の effect + 型変数」の形で返し、本体を `checked_ecast` で包む。
  例：`def readTool(): AgentTool[FileRead + ef] = …(args -> checked_ecast({ … }))`。こうすると `readTool() :: bashTool() :: Nil` が
  `List[AgentTool[FileRead + Process]]` になる。`checked_ecast` がないと `Unable to unify the effect formulas` になる。
- 標準ライブラリに、JSON（`Util.Json`）、HTTP（`Net.Http` の `Http` effect）、ファイル（`Fs.FileRead` / `Fs.FileWrite`）、
  プロセス（`Sys.Process`）、環境変数（`Sys.Env`）がある。ファイルの effect には範囲を絞るハンドラ（`withChroot`、`withAllowList` など）もある。
  ソースは flix.jar を展開した `src/library/` で読める。`Process.stdout(ph)` が返す `StdOut` の読み出しは `Readable` のインスタンス
  （`type Aef = IO`）なので、プロセスの出力を読むには `IO` が要る。
- effect は `run { … } with handler Eff { def op(x, k) = k(値) }` で偽物に差し替えてテストできる。
- 依存は `flix.toml` で `mount` を付け、その名前で参照する（0.79.0）。`mount` を外すと、接頭辞なしの `use` でも参照できなくなる（E3138）ので、別名ではなく参照に必要なものとして扱う。
  例：`"github:Cj-bc/paranoid_time_flix" = { version = "0.4.0", mount = "paranoidTime" }` なら `use paranoidTime::ParanoidTime.Instant`。

## HTTP と JSON の標準ライブラリ（Flix 0.79.0、2026-11-09 に flix-agent の Anthropic アダプタで確認）

- **JSON は `Util.Json.Json`**（`JArray(Vector[Json])`・`JBool`・`JNull`・`JNumber(BigDecimal)`・`JObject(Map[String, Json])`・`JString`）。
  `with Eq` と `ToString`（コンパクトな JSON）があるので、`Assert.assertEq` でそのまま比べられる。`JObject` は `Map` なので、キーの順序に関係なく等しい。
  - 作る：`JObject(List.toMap(("k", JString("v")) :: Nil))`、`JArray(List.toVector(l))`、数は `JNumber(Int32.toBigDecimal(n))`。
  - 読む・書く：`Util.Json.parse(s): Result[JsonError, Json]`、`Util.Json.toCompactString(j)`。
  - テストの期待値は、JSON の文字列を `parse` して作ると読みやすい（`json("{\"a\":1}")` のような小さな関数を置き、失敗は `bug!`）。
- **HTTP は `Net.Http` の `eff Http { def request(req: HttpRequest): Result[IoError, HttpResponse] }`。** 本物のハンドラは `Http.runWithIO`（`@DefaultHandler`）。
  - リクエストは `Net.HttpRequest.postWith(url, body) |> HttpRequest.setHeader(name, value) |> …` で組み立てる。
    ヘッダーは `Map[String, List[String]]`（`setHeader` は置き換え、`withHeader` は追加）。
  - **既定ではタイムアウトがない**（`requestTimeout = None`）。長い応答を待つなら `withTimeout(Duration.of(10, TimeUnit.Minutes))`。
  - **既定ではリダイレクトを追う**（`followRedirects = true`）。秘密のヘッダーを付けるリクエストは `withFollowRedirects(false)` にする。
    `false` のときは `Net.HttpLayer` が `HttpClient.Redirect.NEVER` のクライアントを作るので、本物のハンドラでも効く。
  - 応答は `HttpResponse.status` / `body`（`String`）/ `isSuccess`。偽の応答は `HttpResponse.HttpResponse({ url, status, headers = Map.empty(), body = Net.Body.Text(s) })`。
  - **Java のヘッダー検証の失敗は、ヘッダーの値ごと `IoError` のメッセージに入る**（`IllegalArgumentException` → `IoError(InvalidInput, msg)`）。
    改行の残った API キーなどを渡すと、エラーを表示しただけでキーが漏れる。送る前に値を検証する。
    URL も同じで、`URI.create` の失敗は URL ごとメッセージに入る（userinfo の資格情報を含みうる）。
  - 再試行・間隔・ログなどのミドルウェア（`withRetry`、`withMinInterval`、`withLogging` など）もある。`withLogging` はヘッダーを出力しないが、URL とエラー（`${err}`）はそのまま出すので、上のヘッダー検証の失敗や userinfo 付きの URL は漏れる。
- **送ったリクエストを確かめるテスト：** ハンドラで継続 `k` を呼ばずに値を返すと、その値が `run` 全体の結果になり、以降は実行されない。
  ```flix
  let sent = run {
      discard Adapter.runWith(config(), () -> Llm.complete(model(), context()));
      None
  } with handler Http {
      def request(req, _k) = Some(req)
  };
  ```
  同じ形で「`Http.request` まで進んだか」を `Bool` で返せる（`def request(_req, _k) = true`、本体の最後は `false`）。
- ハンドラの `def` の本体に文を複数書くときは `{ … }` で囲む。囲まずに `Ref.put(…); k(…)` と書くと `Expected '}' before ';'` になる。
- `region rc { let r = Ref.fresh(rc, false); … }` で、ハンドラの中から書ける変数を作れる。
- `forM ( x <- r1; y <- r2 ) yield …` は `Result` にも `Option` にも使える。`Result.traverse(f, l)` で `List` の各要素に `Result` を返す関数を当てられる。
