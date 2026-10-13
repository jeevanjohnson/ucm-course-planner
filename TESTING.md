# Verification record

## Course details verification — October 13, 2026

- All 19 Python and 17 JavaScript tests pass. New coverage checks inert HTML parsing, prerequisite grouping and blank cells, headerless tables, unexpected responses, provider request parameters, and separate persistent detail caches.
- The running details API retrieved the official Spring 2027 MATH 141 CRN 10550 description, prerequisites, corequisites, and restrictions.
- Browser verification confirmed the description and grouped prerequisite table, including minimum C− grades, source links, and retrieval date. No console warnings or errors were observed. Screenshot: `artifacts/course-details.jpg`.
- The previous active plan was restored after verification; no course selections were changed.

Verified October 12, 2026.

- Official term JSON and page-linked JavaScript inspected; requests use the public search flow with isolated session IDs.
- Live provider retrieved and normalized all 1,702 Fall 2026 sections. Every returned term matched the selected semester.
- Python regression suite: normalization, multiple meetings, fixed/unknown units, pagination, term mismatch, incomplete snapshots, rate-limit cooldown, cache reuse after restart, stale retention, and cold failure without synthetic substitution.
- JavaScript regression suite: date-aware overlaps, adjacency, exams, unknown times, calendar-week filtering, enrollment transitions, data separation, independent persisted plans, and Pacific-time ICS recurrence/escaping.
- Browser: selected official term, filtered CSE sections, added lecture/labs, observed conflict highlight and explanation, reordered and removed sections, confirmed reset, undid reset, renamed/created/switched plans, and restored selections after closing tabs and restarting the server.
- Demo mode: explicitly created a separate synthetic plan and verified a conflict without changing the live plan.
- Responsive layouts inspected at desktop 1440×1000 and mobile 390×844. No browser console warnings/errors observed during functional checks.

Desktop notifications require the user's browser permission. Actual future seat transitions were not awaited; their logic is covered by deterministic tests. Drag handlers are implemented, while keyboard/button equivalents and course reordering were exercised in the browser. Linked registration eligibility and holiday exceptions are outside this planner's scope.

The browser contains an `Example live plan`, a separate `Demo test plan`, and an empty `My schedule` from verification. These are illustrative selections, not recommendations or registrations. The app opens on the empty plan after handoff.

## Linked-section checker verification

- 25 automated tests pass: 12 Python and 13 JavaScript, including exact combination matching, AND/OR companion requirements, reverse lab-to-lecture checks, removal, unlinked courses, stale/empty/error responses, invalid university terms, and separate linked-response caching.
- Official MATH 141 CRN 10550 in Spring 2027 returned four discussion alternatives through the new running `/api/linked` route.
- In a separate `Linked sections example` browser plan, adding the lecture showed Missing discussion and the four official choices. Adding CRN 11011 changed both sections to complete; refresh preserved the result. Removing that discussion immediately restored the missing warning. The previously active plan was restored after testing.
- The new panel was visually checked; no browser console warnings or errors appeared. Screenshot: `artifacts/section-requirements.jpg`.

## Prerequisite text and research credits

- All 21 JavaScript tests pass, including grouped prerequisite text, fallback rule text, research unit validation, confirmation, and persistence.
- Browser checks verified a tentative CSE 195 entry, immediate unit edits, confirmation, refresh persistence, and reset/undo. Test entries were removed and the original plan restored.
- Live MATH 141 prerequisites were checked in the text display.
