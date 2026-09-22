# Flix Language Knowledge

Key insights from paranoid-time.flix development, particularly the Java API alignment refactoring.

## Function Naming and API Design

When aligning a functional language library with a widely-known imperative API (like Java's `java.time.Instant`), follow these patterns:

### Constructor functions

- **Try form** (returns Option): Use `of*()` prefix + verb modifier
  - `ofEpochMilli(ms: Int64): Option[Instant]` — create from milliseconds, may fail if out of range
  - `ofEpochNano(ns: Int64): Instant` — create from nanoseconds, never fails (Int64 ns span fits Instant range)

- **Saturating form** (clamps to range ends): Use `of*Clamped()` suffix
  - `ofEpochMilliClamped(ms: Int64): Instant` — create from milliseconds, clamp if out of range

- **Established names**: `min()`, `max()` for range boundaries (not `minInstant()`, `maxInstant()`)

### Arithmetic functions

- **Try form** (returns Option): Use descriptive verb
  - `plus(instant: Instant, duration: Duration): Option[Instant]`
  - `minus(instant: Instant, duration: Duration): Option[Instant]`

- **Saturating form** (clamps to range): Use verb + `Saturated` suffix
  - `plusSaturated(instant: Instant, duration: Duration): Instant`
  - `minusSaturated(instant: Instant, duration: Duration): Instant`

### Query/accessor functions

- Use `to*()` for conversions: `toEpochMilli()`, `toEpochNano()`
- Use `get*()` for field access: `getEpochSecond()`, `getNano()`
- Use verb forms for computed values: `until(from: Instant, to: Instant): Option[Duration]` (duration gap between two instants)

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

## Test Organization

paranoid-time.flix structure shows good patterns:

- **Unit tests**: `test/TestTime/Instant/` — one file per function family
  - `Plus.flix` — tests for `plus()` and related plus-based functions
  - `Minus.flix` — tests for `minus()` and related subtract-based functions
  - `Range.flix` — boundary and range limit tests
  - `Compare.flix` — ordering/comparison tests
  
- **Compatibility tests**: `test/test262/` — ports of ECMAScript Temporal test suite
  - Essential for validating alignment with established standards
  - Test262 files may reference saturating forms or other functions not in standard ECMAScript

- **Instant builders**: Flix test harness provides helpers from test262 suite
  - `fromNanos(ns: Int64): Instant` — build an Instant from nanoseconds
  - `instant(seconds: Int64, nanos: Int32): Instant` — build from parts
  - `assertInstantsEqual(expected, actual, message)` — test equality with message

## Refactoring Strategy for Library APIs

When systematically renaming functions across a library:

1. **Update implementation first**: Change function definitions in the source file
2. **Update unit tests**: Change test file names, function calls, and use statements
3. **Update integration tests**: test262 files often have multiple references to old names
   - Use scripted replacements (sed/grep) for systematic renames across many files
   - Follow with manual verification of use statements and imports
4. **Verify test harness helpers**: Test helper functions (assertInstantsEqual, builders) should already match
5. **Run CI often**: Each layer of changes produces compilation errors; CI feedback is iterative

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

## Design Principle: Naming for Clarity

Align with established APIs when the domain is well-known (like Java's java.time). This reduces cognitive load for developers familiar with that ecosystem. Consistency matters more than achieving perfect consistency across the entire codebase — a brief import list documenting the rename is worth the clarity gained.
