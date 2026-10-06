# Workspace instructions

On Windows, do not open or launch a visible PowerShell window for work in this repository. Do not use `Start-Process` to run commands. Use non-interactive command execution with `shell: "cmd.exe"`, `login: false`, and `tty: false` when a shell is needed. Prefer `apply_patch` for file edits. If a task truly requires PowerShell and there is no safe alternative, explain why and ask the user first.
