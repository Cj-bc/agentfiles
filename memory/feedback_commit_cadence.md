---
name: Commit after each small task, never include user-made diffs
description: Make a commit each time a small task completes (don't batch into one end-of-session commit). Stage only files you edited yourself — never pick up the user's concurrent changes in your commits.
type: feedback
---

**Rule 1 — commit cadence:** Commit your work whenever one small task is done, not just at the end of a larger session. If you just finished scaffolding, commit. If you just made the tests pass, commit. Don't accumulate many unrelated changes into a single mega-commit.

**Rule 2 — isolation:** Never include user-made diffs in your commits. Stage only the files you touched yourself. That means:
- Never `git add -A`, `git add .`, or `git add -u` blindly.
- Before staging, check `git status` and explicitly list the files you actually created/edited.
- If the user has modified files concurrently, leave those untouched — they'll commit their own work separately.

**Why:** User gave this as a standing instruction on 2026-04-23 after the initial hoogle-sharp commit. The intent is clean, reviewable history where each commit is "one small thing Claude did," and authorship of changes stays accurate — the user's edits stay on their own commits, not mixed into mine.

**How to apply:** After completing a discrete unit of work (scaffold → test → fix → refactor, etc.), proactively commit even without being asked. Use explicit file paths to `git add`. If the task list has many small items, that's many commits, not one. Apply globally to every project this user works on.
