# VibeFlow — Idiosyncrasies

Last updated: 2026-04-11

---

## What This File Is

This file documents code or architecture choices that may look wrong, unusual, non-standard, or suspicious to a new developer or new AI session — but were done intentionally for a good reason.

**Every agent must read this file before making changes.**
**Every agent must add an entry here when introducing intentional weirdness.**

If you see something in the codebase that looks odd and it is NOT in this file, it may be a genuine bug. If it IS in this file, it was done on purpose — do not "fix" it without understanding the entry first.

---

## Entry Format

```
## [Short title of the oddity]
- **What looks odd:** ...
- **Where it is:** [file path, or "TBD" if not yet implemented]
- **Why it was done:** ...
- **What breaks if cleaned up:** ...
- **Permanent or temporary:** Permanent / Temporary
- **How to safely remove later:** [instructions, or "N/A" if permanent]
```

---

## Entries

*(No entries yet — this file will be populated as implementation begins.)*

---

## How to Add an Entry

When you introduce intentional weirdness:

1. Add an entry to this file immediately (do not wait for handoff)
2. Use the format above
3. Be specific about the file path and line number if known
4. Explain the "why" clearly — future AI sessions will read this
5. Update the "Last updated" date at the top of this file

During handoff, the Orchestrator reviews this file and adds any entries that were missed during the session.
