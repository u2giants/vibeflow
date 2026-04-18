# VibeFlow — Assumptions

This file records assumptions made during planning and development.
Each assumption has a confidence level and a validation plan.
Agents must add entries here when making assumptions that affect architecture or implementation.

---

## A1 — Albert has an existing Supabase account and project

**Assumption:** Albert already has a Supabase account and a project set up for VibeFlow.
**Why made:** Albert confirmed this on 2026-04-11.
**Confidence:** High
**Validation:** Confirmed by Albert directly.
**Impact if wrong:** Milestone 1 would need to include Supabase project setup steps.

---

## A2 — Albert has an existing OpenRouter API key

**Assumption:** Albert already has an OpenRouter API key for testing AI features.
**Why made:** Albert confirmed this on 2026-04-11.
**Confidence:** High
**Validation:** Confirmed by Albert directly.
**Impact if wrong:** Milestone 2/3 testing would be blocked until a key is obtained.

---

## A3 — Albert has an existing Coolify instance

**Assumption:** Albert already has a running Coolify instance with API access.
**Why made:** Albert confirmed this on 2026-04-11.
**Confidence:** High
**Validation:** Confirmed by Albert directly.
**Impact if wrong:** Milestone 6 (DevOps) would need to include Coolify setup guidance.

---

## A4 — Albert has a second Windows device for sync testing

**Assumption:** Albert has a second Windows machine or VM available for testing Milestone 4 (cloud sync).
**Why made:** Albert confirmed this on 2026-04-11.
**Confidence:** High
**Validation:** Confirmed by Albert directly. Two-device sync test is still pending as of 2026-04-18.
**Impact if wrong:** Sync tests would need to be partially simulated on one machine.

---

## A5 — Windows-first means Windows 10/11 x64

**Assumption:** The primary target platform is Windows 10 or Windows 11, 64-bit.
**Why made:** The product spec says "Windows-first." Windows 10/11 x64 is the dominant desktop platform.
**Confidence:** High
**Validation:** No contradicting information from Albert.
**Impact if wrong:** Build targets and installer configuration would need adjustment.

---

## A6 — Users are non-programmers or light technical operators

**Assumption:** The primary user cannot read or write code fluently, but can follow technical instructions and understand concepts.
**Why made:** Explicitly stated in the product spec.
**Confidence:** High
**Validation:** Core product requirement.
**Impact if wrong:** UX and documentation would need to be adjusted for a more technical audience.

---

## A7 — OpenRouter will remain the primary AI provider

**Assumption:** OpenRouter will continue to be available and will remain the primary AI provider for the foreseeable future.
**Why made:** OpenRouter is the only provider designed for day one.
**Confidence:** Medium
**Validation:** Monitor OpenRouter availability and pricing. Provider abstraction layer allows switching.
**Impact if wrong:** Switch to direct Anthropic/OpenAI/etc. via the provider abstraction layer.

---

## A8 — Supabase Realtime is sufficient for lease/heartbeat coordination

**Assumption:** Supabase Realtime (Broadcast channels) can handle the heartbeat frequency (every 15 seconds) and ownership coordination without significant latency or reliability issues.
**Why made:** Supabase Realtime is designed for this use case. 15-second heartbeats are low-frequency.
**Confidence:** Medium
**Validation:** Not yet validated in practice. Two-device sync test is pending as of 2026-04-18. See R7 in [`docs/risks.md`](risks.md).
**Impact if wrong:** May need to implement a lightweight Edge Function for lease management, or increase heartbeat interval.

---

## A9 — keytar works reliably on Windows 10/11

**Assumption:** The `keytar` npm package (which uses Windows Credential Manager) works reliably on Windows 10 and 11 for storing API keys and other secrets.
**Why made:** keytar is the standard solution for OS-secure storage in Electron apps on Windows.
**Confidence:** Medium-High
**Validation:** Test in Milestone 1. Document any quirks in idiosyncrasies.md.
**Impact if wrong:** Fall back to encrypted local file storage with a user-provided passphrase.

---

## A10 — pnpm is available on the development machine

**Assumption:** pnpm is installed and available on Albert's development machine.
**Why made:** pnpm is the chosen package manager for the monorepo.
**Confidence:** Medium
**Validation:** Check in Milestone 1 setup. Include pnpm installation instructions if needed.
**Impact if wrong:** Include pnpm installation as a prerequisite step in the setup guide.

---

## A11 — Git is available on the development machine

**Assumption:** Git is installed and available in the PATH on Albert's development machine.
**Why made:** Git is required for the git-manager package and for the IDE's own development workflow.
**Confidence:** High
**Validation:** Check in Milestone 5 setup.
**Impact if wrong:** Include Git installation as a prerequisite step.

---

## A12 — Node.js 18+ is available on the development machine

**Assumption:** Node.js version 18 or higher is installed on Albert's development machine.
**Why made:** Electron 28+ requires Node.js 18+. Vite requires Node.js 18+.
**Confidence:** Medium
**Validation:** Check in Milestone 1 setup. Include Node.js version requirement in README.
**Impact if wrong:** Include Node.js installation/upgrade as a prerequisite step.
