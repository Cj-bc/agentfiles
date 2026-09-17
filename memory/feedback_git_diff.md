---
name: Skip git diff for fresh commits
description: User prefers not to run git diff as part of the pre-commit ritual — skip it, especially when the repo has no commits yet.
type: feedback
---

Skip `git diff` in the standard commit protocol when there's no prior history (fresh repo) or when context already covers what changed.

**Why:** User said "you don't need to ask for git diff" during the initial commit of hoogle-sharp (2026-04-23). In a fresh repo with zero commits, `git diff` produces no useful output anyway, and `git status` already lists the untracked files about to be added. Running it is pure noise.

**How to apply:** When following the commit protocol with this user:
- Fresh repo / initial commit → skip `git diff`, `git status` alone is enough.
- Normal commits → still OK to run `git diff` if the changes are unclear, but don't run it reflexively when you already have full context (e.g. you just wrote all the changes yourself).
