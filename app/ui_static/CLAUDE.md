# DefectTracker — Static UI (project rules for any Claude thread)

This file is read automatically when a thread is opened in this project. The rules here are **mandatory** unless the user explicitly overrides them in chat.

---

## Scope

This project handles **UI alone** — no backend, no API integration, no data layer beyond the seed records already inlined in `js/app.js`. Do not add server calls, build tooling, or framework migrations without the user explicitly asking for them.

---

## Logging contract (mandatory)

**Every UI change must be appended to [`UI_CHANGELOG.md`](./UI_CHANGELOG.md) before the change is considered complete.** Treat the log entry as part of the work, not as documentation that comes later.

Each entry uses this shape:

- **Change** — what is different now.
- **Why** — the user-facing problem or trigger.
- **Intent** — the outcome we're trying to produce.
- **Concept / Principle** — which Guiding Principle (defined at the top of `UI_CHANGELOG.md`) the change reinforces.
- **Files touched** — listed for non-trivial changes.

The log also captures **decisions NOT to do something** (e.g. rejected alternatives) along with the reasoning, so future threads don't re-litigate settled trade-offs.

### Workflow per change

1. **Read `UI_CHANGELOG.md` first** — it holds the why-behind-decisions context for everything currently in the UI. Without that read, you risk undoing a deliberate choice.
2. Make the change.
3. **Re-read the log immediately before appending** (so you append to the latest version even if a parallel thread also wrote to it) and add the entry in the format above.
4. Only then report the change as complete to the user.

If you reject an alternative the user proposed (or you proposed and the user rejected), log that decision too — these are often more valuable than the affirmative entries.

---

## Project layout (quick reference)

- **Pages (root):** `dashboard.html`, `defect_list.html`, `defect_detail.html`, `defect_create.html`, `projects.html`, `environments.html`, `users.html`, `reports.html`, `status_workflow.html`, `login.html`, `index.html`.
- **Shared logic:** `js/app.js` (single IIFE-wrapped file; all page-scoped logic lives inside one outer closure).
- **Shared styles:** `css/app.css` (single file).
- **Assets:** `assets/icons/`.

No build step. The user runs `python -m http.server 8000` (or opens `index.html` directly) to test.

---

## Style of working that matches this project

The user values *opinion-led product reasoning over option-spamming*. When a question has a defensible answer, give it directly with the trade-offs, then ask for approval. Do not enumerate every possible direction unless the user explicitly asks for an exhaustive comparison.

The Guiding Principles block at the top of `UI_CHANGELOG.md` is the agreed lens. Use it when you're weighing whether to add an affordance, a setting, or a customization knob.
