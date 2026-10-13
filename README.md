# UC Merced Course Schedule Planner

A local Python + Preact planner with verified public UC Merced course data, independent saved plans, a weekly calendar, conflict detection, and seat monitoring. It does not register for classes.

## Run on Windows

Python 3.11 or newer is required. A `.venv` has already been created in this workspace.

```powershell
cd "C:\Users\jeeva\OneDrive\Desktop\course scheduke majer"
.\.venv\Scripts\Activate.ps1
python -m planner.server
```

Open **http://127.0.0.1:8000** in your browser. Keep the terminal open; Ctrl+C stops the server. If PowerShell prevents activation, activation is optional:

```powershell
.\.venv\Scripts\python.exe -m planner.server
```

For a fresh installation:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python -m planner.server
```

There are **no third-party Python runtime dependencies** and no Node build step. Preact 10.26.4 and htm 3.1.1 are vendored, so the frontend does not depend on a CDN at runtime. `run.ps1` is also available. On macOS/Linux use `python3 -m venv .venv`, `source .venv/bin/activate`, and `python -m planner.server`.

## Using the planner

1. Choose an official semester. The first complete snapshot usually takes 20–40 seconds.
2. Filter by subject, number, instructor, day, availability, title, or CRN. Add any section, even if full, or drag it onto the calendar.
3. Open **My sections** to remove courses, reorder them by dragging or arrow buttons, change colors, and find alternatives. Real class times are fixed; change the section to change meeting times.
4. Use the week selector to see date-specific lectures, labs, discussions, and exams. Conflicts are calculated across all meeting date ranges, including exams outside the visible week.
5. Create, rename, switch, or delete plans. Changing the term of a populated plan or changing data source creates a separate plan after asking for its name.
6. **Reset Calendar** asks for confirmation. **Undo Reset** restores the last reset in that plan and merges with any courses added since. Undo survives refresh/restart. Deleting a whole plan is permanent and separately confirmed.
7. Availability refreshes while the tab is visible. Choose 5, 10, 15, or 30 minutes. Full-to-open and open-to-full transitions produce in-app alerts; opt in to desktop notifications for browser alerts.
8. **Export .ics** generates a file you can import into Google Calendar, Outlook, or Apple Calendar. It includes meeting date ranges and exams, skips unspecified meetings, uses Pacific time, and does not exclude holidays.

All plan edits save synchronously to browser localStorage. Use the **same browser profile and exact URL/port** when returning: `localhost` and `127.0.0.1` have different storage. Private browsing, clearing site data, or changing browser profiles removes/accesses different saved plans. Cached enrollment is stored separately under `.cache/`; it never overwrites saved selections. No account or database is needed. The repository class can be replaced later with a database-backed implementation.

## Official data integration

Investigation and live validation completed October 12, 2026. The supplied public page and its linked JavaScript expose these endpoints:

- `GET /StudentRegistrationSsb/ssb/courseSearch/getTerms` — official term choices.
- `GET /StudentRegistrationSsb/ssb/term/termSelection?mode=courseSearch` — initialize a public search session.
- `POST /StudentRegistrationSsb/ssb/term/search?mode=courseSearch` — select a term in the search session; **this is not course registration**.
- `GET /StudentRegistrationSsb/ssb/searchResults/searchResults` — paginated sections using `txt_term`, `pageOffset`, `pageMaxSize`, and sort fields.

Each provider operation uses an isolated cookie jar and `uniqueSessionId`, matching the public UI. Results are rejected if any row belongs to a different term or pagination is incomplete. The adapter reads enrollment, capacity, seats, waitlist fields, variable credits, faculty, meeting dates, times, and locations directly from JSON. No API key, university login, private student record, or guessed authentication endpoint is used. These are observed web application endpoints, not a guaranteed supported developer API; response changes are handled as errors, retaining the last good snapshot.

Source: [UC Merced course search](https://reg-prod.ec.ucmerced.edu/StudentRegistrationSsb/ssb/term/termSelection?mode=courseSearch). The read-only reproducible probe is `research/probe.py`. Full-provider live validation retrieved **1,702 Fall 2026 sections**. Terms and enrollment are fetched dynamically, never hardcoded into the live provider.

## Traffic and failure behavior

- Complete snapshots default to a ten-minute server cache, shared across browser tabs. Terms cache for one hour. Requests are serialized and spaced at least 0.8 seconds apart, with a 20-second request timeout and bounded pagination.
- Configure the cache with `python -m planner.server --cache-seconds 300` for five-minute fresh snapshots; values below 300 are clamped. Selecting a five-minute browser interval does not override the server cache.
- Last successful refresh time is always displayed. Cached data can be older during an outage and is explicitly labeled stale.
- Failures use a retry cooldown. HTTP 401, 403, and 429 trigger at least a ten-minute cooldown, respecting a longer numeric Retry-After. No authentication or access-control bypass is attempted.
- Failed or partial snapshots do not replace good snapshots. Missing sections stay in the plan with unknown availability. Seat refreshes never change saved meeting details or remove a selection. To adopt an official meeting-time change, inspect current search results, then remove and re-add that section.
- Monitoring runs only while the browser tab is open and visible. There is no background daemon, email, or automatic registration. Snapshot polling cannot guarantee detection of short-lived openings.
- The clearly labeled **Demo · synthetic** provider requires an explicit separate demo plan. It never silently substitutes for live university data. Synthetic courses exist solely to demonstrate conflicts, full seats, waitlists, and arranged meetings.

## Structure and tests

```text
planner/models.py       Public response normalization
planner/providers.py    Official and synthetic providers
planner/service.py      Atomic snapshots, cache, backoff
planner/server.py       Local API + static server
static/app.mjs          Preact interactive dashboard
static/domain.mjs       Persistence, conflicts, dates, ICS
static/style.css        Responsive dashboard styling
static/vendor/          Pinned browser modules and licenses
tests/                  Python and JavaScript regression tests
research/probe.py       Read-only live endpoint verification
```

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
node --test tests/domain.test.mjs
```

Node 18+ is needed only for JavaScript tests. The server binds to `127.0.0.1`, checks the Host header, serves only `static/`, and uses a restrictive content security policy. This single-student local server is not a public hosting service.

Linked lecture/lab/discussion requirements, prerequisites, cross-list restrictions, variable unit choices, holidays, and eligibility must be verified with official registration. The summary counts each selected section's reported units; unknown/variable credits use the supplied minimum and are marked as estimates. Selecting multiple alternatives for the same course adds their units separately.

## Linked-section completeness

The **Section requirements** panel automatically checks each selected CRN against the official `GET /StudentRegistrationSsb/ssb/searchResults/fetchLinkedSections` response. A returned combination requires all its sections; different combinations are alternatives. A same-number lab from a different permitted grouping does not count. Selecting a lab or discussion by itself also checks for the required lecture.

Use **Choose required sections** to see compatible CRNs, meeting times, availability from the current enrollment snapshot, and potential time conflicts. **Add missing sections** adds only that option's missing companions and saves the plan immediately. Full sections remain selectable for hypothetical planning.

Requirement responses are fetched only for selected linked sections, cached for one hour separately from enrollment, and refreshed with course refreshes once expired. Failed, missing, stale, or empty linked data is labeled **Not verified**. This checks linked section combinations, not prerequisites, separate-course corequisites, major restrictions, or registration eligibility. Demo results remain explicitly synthetic.

Run all JavaScript checks with `node --test tests/domain.test.mjs tests/requirements.test.mjs`.

## Rate My Professors links and personal rating snapshots

Instructor names in search results, saved sections, and section details now include **RMP reviews** links scoped to UC Merced (RMP school 4767). No name match is assumed. For a direct profile link and numeric badge, choose **Save rating**, open the RMP search, verify the instructor and school, and enter the profile URL, overall rating, and optional review count. The badge links to the saved profile and explicitly displays **Manually saved** with the date. A blank rating stores only the profile link. **Edit** lets you update or clear it.

Ratings are not fetched or refreshed automatically. RMP's terms restrict scraping without permission; no documented public API was identified. No scraper, private API credential, or access-control workaround is used. Search links are ordinary browser navigation. Demo instructors and TBA entries have no rating links.

Personal rating records are stored separately under browser localStorage key `ucm-professor-ratings.v1`, shared across your plans in the same browser. They do not change course selections, enrollment data, or calendar exports.

Reference: https://www.ratemyprofessors.com/terms-of-use and https://www.ratemyprofessors.com/search/professors/4767?q=%2A

Run rating checks with `node --test tests/professors.test.mjs`.

## Course descriptions and prerequisites

Click a course title or calendar block to view its description, prerequisites, corequisites, and enrollment restrictions. Details come from the official registration system for that term and CRN, with source links, a retrieval timestamp, and a link to the UC Merced catalog. Prerequisite tables preserve AND/OR alternatives, parentheses, test scores, and minimum grades. Missing information is labeled; it does not imply eligibility.

The local `/api/details` route fetches four public registration detail fragments only when you open a section. Responses are cached for one hour, separately from enrollment and saved plans. Connection failures retain an available snapshot and mark it stale. Demo details are explicitly synthetic. The planner displays requirements but does not evaluate your transcript or register you for courses.
