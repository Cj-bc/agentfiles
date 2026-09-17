---
name: test-validity-audit
description: Audits automated tests in any project or language for semantic validity by comparing each test's stated intent with the code path and assertions, flags corrupted, vacuous, disabled, inconclusive, or empty tests, and writes matching Markdown and machine-readable JSON reports. Use when asked whether tests actually test what they claim.
compatibility: Works best in a Git repository. Node.js is required only for the bundled JSON validator.
---

# Test Validity Audit

Perform a static semantic audit of every requested test. Distinguish a production defect caught by a good test from a corrupted test that does not exercise or assert its stated behavior.

Project-specific rules do not belong in the globally installed skill. Load the audit profile from the project being audited. If no project profile exists, infer the test framework and use the generic workflow below.

## 1. Load instructions and a profile

1. Find and read repository instruction files such as `AGENTS.md`, `CONTRIBUTING.md`, or equivalents.
2. From the repository root, look for a project-owned profile in this order:
   - `.pi/profiles/test-validity-audit.md`
   - `.agents/profiles/test-validity-audit.md`
   - `test-validity-audit.profile.md`
3. Load the first profile found. A profile applies only to the repository that contains it; do not search for profiles under the globally installed skill directory.
4. Apply profile settings as overrides/additions to this workflow: scope, required reading, framework discovery, output paths, runtime restrictions, and language-specific pitfalls.
5. If no profile exists, record that the generic workflow was used.
6. Follow links from required repository/profile documentation when they affect test interpretation or execution.

## 2. Isolate the audit

In a Git repository, create a new worktree before auditing unless the user explicitly opts out. The source working directory may change during the audit.

1. Record the source root, current revision, branch, requested-file inventory, and target-specific status.
2. Create a uniquely named branch and worktree from the recorded revision. Never delete or reuse an unknown path.
3. Perform reads, report writes, and optional verification in the new worktree.
4. Record requested files that were modified or untracked in the source directory at audit start. A normal worktree contains committed content only. If the user wants working-copy content audited, snapshot those files into the new worktree immediately, state their provenance, and never modify the source directory.

Typical Git commands:

```bash
git rev-parse --show-toplevel
git rev-parse HEAD
git branch --show-current
git status --short --untracked-files=all -- <requested-paths>
git worktree add -b audit/test-validity-<unique> /tmp/<repo>-test-audit-<unique> <recorded-revision>
```

For non-Git projects, make a read-only snapshot or use another isolation mechanism and document it.

## 3. Build the complete inventory

Inventory every requested source file, including helpers whose names do not match conventional test patterns. Determine the test framework from imports, manifests, configuration, annotations/attributes, and runner files.

Classify each source file as:

- fixture/module containing discovered tests;
- mock, spy, fake, helper, fixture factory, or manual utility with no tests;
- empty fixture/stub.

Discover all framework test forms, including parameterized/data-driven tests, generated cases, nested suites, and disabled/skip markers. Count both:

- discovered test methods/functions/templates;
- expanded cases after parameters/data sources.

Do not claim an expanded count unless the source data was inspected. If dynamic generation prevents a reliable count, use `inconclusive`, explain why, and do not invent a number.

## 4. Review every test

For each test method/function or parameter group:

1. Read its name and nearby documentation/comments.
2. State the behavior it claims to cover.
3. Read the complete arrange/setup, action, async/wait, and assertion/verification path.
4. Read the directly exercised production implementation when needed to establish the reached path.
5. Review mocks, spies, fixtures, helpers, and data sources used by the test.
6. Decide whether the test would fail if the claimed behavior regressed.

Check specifically for:

- wrong API, overload, object, collection, phase, branch, fixture data, or environment;
- assertions on setup state rather than post-action state;
- assertions disconnected from the action;
- vacuous assertions, especially predicates over empty collections;
- missing expected-count, non-empty, or precondition checks;
- lazy/deferred operations that are never consumed;
- async operations that are not awaited/joined, are awaited incorrectly, or outlive teardown;
- exception assertions satisfied by unrelated setup, timeout, or infrastructure failures;
- skip/ignore/assumption paths that remove effective regression protection;
- parameter rows that do not reach distinct or intended boundaries;
- mocks that bypass the behavior named by the test;
- commented-out assertions that leave the named contract unverified;
- stale comments that disagree with current code;
- shared state, timing, randomness, resource leakage, or order dependence that makes the result unreliable;
- tests that merely duplicate implementation details without verifying observable behavior.

Apply language/framework-specific checks from the selected profile. If there is no profile, infer relevant semantics from project code and official framework conventions already available in the repository.

A test accurately exposing a production bug is **valid**, even when red. A test is **corrupted** when it can pass without exercising/asserting its stated contract, reaches the wrong path, or cannot detect the relevant regression.

## 5. Classification

Use these stable statuses:

- `valid`: action and assertions match the stated contract.
- `corrupted`: implementation does not effectively test the stated contract.
- `disabled`: a skip/ignore mechanism prevents execution.
- `inconclusive`: static evidence is insufficient; state what evidence is needed.

Record empty fixtures as `empty_fixture` findings with zero cases. Record reliability issues and stale documentation as separate findings rather than changing a semantically valid test's status unless they prevent meaningful verification.

Every non-valid decision must include concrete evidence and a recommended action. Include file, line when stable, test name, and affected expanded-case count.

## 6. Write Markdown and JSON reports

Use output paths from the selected profile or user request. Without either, write:

- `docs/test-case-validity-audit.md`
- `docs/test-case-validity-audit.json`

### Markdown report

Include:

1. audit revision, profile, framework/language, and scope;
2. static-vs-runtime verification note;
3. summary counts;
4. prominent findings;
5. every test method/parameter group with expanded count, status, and what its code verifies;
6. source files with no discovered tests.

### JSON report

Use this top-level shape:

```json
{
  "schema_version": "1.0",
  "report_type": "test_case_validity_audit",
  "audit": {
    "base_revision": "<revision>",
    "profile": "<profile name or generic>",
    "languages": ["<language>"],
    "frameworks": ["<test framework>"],
    "scope": ["<glob or path>"],
    "methodology": "<text>",
    "tests_executed": false,
    "tests_not_executed_reason": "<text>",
    "source_markdown": "<report.md>"
  },
  "summary": {
    "source_files_observed": 0,
    "tracked_source_files": 0,
    "untracked_source_files_observed": 0,
    "discovered_test_methods": 0,
    "expanded_test_cases": 0,
    "expanded_cases_by_status": {
      "valid": 0,
      "corrupted": 0,
      "disabled": 0,
      "inconclusive": 0
    },
    "files_without_test_cases": 0
  },
  "findings": [],
  "test_suites": [
    {
      "file": "tests/example.test",
      "test_cases": [
        {
          "name": "example",
          "expanded_case_count": 1,
          "status": "valid",
          "verification": "What the test code actually verifies."
        }
      ]
    }
  ],
  "source_files_without_test_cases": [
    {
      "file": "tests/example-helper",
      "role_or_finding": "Helper used by the example test."
    }
  ]
}
```

Finding objects should contain:

```json
{
  "id": "TEST-AUDIT-001",
  "classification": "corrupted_test",
  "severity": "high",
  "file": "tests/example.test",
  "line": 42,
  "test_case": "example",
  "affected_expanded_cases": 1,
  "issue": "Concrete failure of the test implementation.",
  "evidence": "Specific code/path proving the issue.",
  "recommended_action": "Action another tool can implement."
}
```

Keep statuses lowercase and JSON free of Markdown formatting. Markdown and JSON totals and decisions must agree.

## 7. Validate output

Run from the repository root:

```bash
node <skill-directory>/scripts/validate-audit-json.mjs <report.json>
git status --short
git diff --check
```

Resolve the skill directory relative to this `SKILL.md`; do not assume the skill is installed inside the project. The validator checks required schema fields and recomputes method, expanded-case, status, and support-file totals.

Do not run a test runner merely to validate report formatting. Obey profile/repository runtime restrictions. If runtime verification is requested but prerequisites are uncertain, ask first.

## 8. Final response

Report concisely:

- worktree/snapshot path;
- selected profile;
- Markdown and JSON paths;
- total and non-valid counts;
- whether tests were executed;
- JSON validation result.
