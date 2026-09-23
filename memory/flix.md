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

### Arithmetic functions

- **Try form** (returns Option): Use descriptive verb
  - `plus(instant: Instant, duration: Duration): Option[Instant]`
  - `minus(instant: Instant, duration: Duration): Option[Instant]`

- **Saturating form** (clamps to range): Use verb + `Saturated` suffix
  - `plusSaturated(instant: Instant, duration: Duration): Instant`
  - `minusSaturated(instant: Instant, duration: Duration): Instant`

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

## Refactoring Strategy for Library APIs

When systematically renaming functions across a library:

1. **Update implementation first**: Change function definitions in the source file
2. **Update unit tests**: Change test file names, function calls, and use statements
   - Use scripted replacements (sed/grep) for systematic renames across many files
   - Follow with manual verification of use statements and imports
3. **Run CI often**: Each layer of changes produces compilation errors; CI feedback is iterative

## Design Principle: Naming for Clarity

Align with established APIs when the domain is well-known (like Java's java.time). This reduces cognitive load for developers familiar with that ecosystem. Consistency matters more than achieving perfect consistency across the entire codebase — a brief import list documenting the rename is worth the clarity gained.
