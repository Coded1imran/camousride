---
description: OpenCode code review — safety, validation, auth and prompt-injection checks
argument: ""
mode: "subagent"
---

Review the current diff / changed files for:
- Auth & authorization gaps (missing role guards, insecure defaults).
- Input validation gaps (Zod missing, unvalidated AI output).
- Prompt injection / unsafe AI tool usage.
- Secrets committed.
- Error handling and fallback paths.

Output a checklist with file paths and severity; do not auto-fix unless asked.
