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

## Design Principle: Naming for Clarity

Align with established APIs when the domain is well-known (like Java's java.time). This reduces cognitive load for developers familiar with that ecosystem. Consistency matters more than achieving perfect consistency across the entire codebase — a brief import list documenting the rename is worth the clarity gained.
