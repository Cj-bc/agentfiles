---
name: herdr
description: "Control Herdr, a terminal multiplexer for coding agents. Use only when the user explicitly mentions Herdr or asks to use Herdr to inspect or control panes, tabs, workspaces, commands, or another agent. Do not use merely because a task could benefit from a background terminal, delegation, or parallel work. Requires HERDR_ENV=1."
---

# Herdr

Herdr organizes terminals into workspaces, tabs, and panes, recognizes coding agents running inside panes, and exposes the current session through the `herdr` CLI.

## 1. Verify you are inside Herdr

Before issuing any control command, check that this agent is running in a Herdr-managed pane:

- PowerShell: `$env:HERDR_ENV -eq '1'`
- Bash: `test "${HERDR_ENV:-}" = 1`

If the check fails, say that you are not running inside Herdr and stop. Do not inspect or control a Herdr session from outside Herdr.

## 2. Load the real instructions

```
herdr --skill
```

This prints the complete, version-current agent guide: public ID scheme, agent lifecycle states (`idle` / `working` / `blocked` / `done` / `unknown`), the split → `agent start` → `agent prompt --wait` → `agent read` workflow, read sources, and safety rules. **Read it before issuing any control command.** The installed binary is the authority — not memory, and not this file. Herdr self-updates, so its output changes between versions.

For per-command syntax, run `herdr --help`, then the relevant group with no subcommand: `herdr agent`, `herdr pane`, `herdr workspace`, `herdr tab`, `herdr worktree`, `herdr terminal`, `herdr notification`, `herdr integration`, `herdr session`.

Two hazards that bite during discovery, before you have read the full guide:

- Do **not** run bare `herdr` — it launches or attaches the TUI.
- Do **not** probe a mutating nested command by omitting arguments. Commands such as `herdr workspace create` are valid with defaults and will execute.

## 3. PowerShell notes (this machine)

- Caller context is injected as `$env:HERDR_WORKSPACE_ID`, `$env:HERDR_TAB_ID`, `$env:HERDR_PANE_ID`.
- `--cwd "$PWD"` in the guide's bash examples → use `--cwd $PWD.Path` in PowerShell.
- Responses are single-line JSON and the guide names fields with jq-style paths. Pipe through `ConvertFrom-Json` and walk the same path:

  ```powershell
  (herdr pane split --current --direction right --cwd $PWD.Path --no-focus | ConvertFrom-Json).result.pane.pane_id
  (herdr pane current --current | ConvertFrom-Json).result.pane.pane_id
  ```

- Server errors are JSON on stderr with exit 1; CLI syntax errors exit 2. The PowerShell tool reports a non-zero exit as a failure, so append `2>&1 | Out-String` when you want to read the error text.
- The Bash tool (Git Bash) is also available if running the guide's snippets unmodified is easier.
