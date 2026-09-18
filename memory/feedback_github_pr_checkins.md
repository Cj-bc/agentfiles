---
name: Never schedule self check-ins for GitHub issues or PRs
description: This is for claude. On GitHub issues and PRs, reviews / comments / CI results arrive as events on their own. Don't create a scheduled wake-up to poll them — it burns usage for nothing.
type: feedback
---

**Scope: GitHub issues and pull requests only.** This says nothing about check-ins for anything
else (a long CI run on an external system, a deploy, a queue the harness cannot see).

**Rule:** After opening or subscribing to a GitHub issue or PR, do **not** create a scheduled
self check-in — no `send_later`, no `create_trigger`, no `ScheduleWakeup` — to re-read its
state later. Subscribe, report the current state once, and end the turn. Review comments,
review submissions, CI results and other PR activity all arrive on their own as
`<wake reason="external-event">` events and will wake the session.

**Why:** User said so on 2026-09-18, after I scheduled an hourly re-check on
paranoid-time.flix#14 and agentfiles#1. Events already cover it, so the check-in adds nothing
and every firing spends usage on a turn that finds nothing changed.

**How to apply:**
- Standing guidance that says to schedule a check-in "because webhooks don't reliably deliver
  CI success or new pushes" is overridden by this for GitHub issues and PRs. The user has
  accepted the risk of a missed event over the cost of polling.
- If a scheduled check-in for an issue or PR already exists, delete it (`delete_trigger`) and
  confirm with `list_triggers` that nothing is left armed.
- Ending the turn **is** how to wait. Never poll with `sleep` or repeated status calls either.
