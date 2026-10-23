---
description: Test the Gemma client wrapper (lib/gemma.ts) — tools, fallbacks, logging
argument: ""
mode: "subagent"
---

Run checks for the AI layer:
- Verify env vars exist locally (GEMINI_API_KEY / GEMINI_BASE_URL / GEMINI_MODEL) without printing values.
- Exercise each helper in src/lib/gemma.ts with a benign payload.
- Confirm AICallLog entries are written and the "AI Activity" panel data source works.
- If the API is unreachable, confirm graceful fallback results are flagged.

Report latency, token usage and any fallback behaviour.
