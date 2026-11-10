# Progress log

Append-only record of the autonomous Nightfall hardening session. Newest work
is at the bottom. Commands are run from `/home/apache/VScode/Messeger` unless a
`cd` is shown.

## 2026-11-10 — Session start

### Audit

- Identified the project as Nightfall Messenger: React + TypeScript + Vite SPA
  with a Spring Boot 3.5.16 / Java 21 API and H2 storage.
- Read `README.md`, `QA-REPORT-2026-11-10.md`, the security review in
  `security-review/2026-11-10/`, the CI workflow, and the backend auth/profile/
  chat/media code.
- Confirmed the source tree had no usable Git history. Created a source archive
  at `.backups/2026-11-10-pre-audit/source-baseline.tar.gz` and initialized a
  local Git repository. Baseline commit: `chore: baseline snapshot before v1.0
  hardening`.
- Added `.backups/`, `.site-git/`, `web-preview/`, and the nested
  `iphone-ryoku/` demo to `.gitignore`. User data, databases, `.share/`,
  `.tools/`, and `test-accounts.txt` were already excluded.

### Baseline test results

| Command | Result |
| --- | --- |
| `npm run build` | pass |
| `npm test` | pass — api, account, posts, social, appearance, channels, navigation |
| `cd backend && mvn test` | pass — 17 tests |
| `python3 scripts/check-profile-api.py` | fail — expected 403 for anonymous media, server returns 401 |

The profile API failure is a stale expectation. The endpoint remains protected:
anonymous requests are rejected by Spring Security before the controller. This
is tracked as T3.1.

### Environment notes

- Port 8080 is occupied by a paused/debugged development backend. It was not
  modified. Tests use isolated ports and disposable databases.
- Vite is listening on `::1:5173`; `127.0.0.1:5173` is not reachable. Use
  `http://localhost:5173` if manual browsing is needed.
- The current POM already uses Spring Boot 3.5.16, newer than the 3.4.1 noted
  in the older security report.

### Plan

Created `ROADMAP.md` with P0/P1/P2 tasks and explicit deferred items.

## Next

T1.1 — remove the phantom `my-chat` message request.

## 2026-11-10 — API contract repair and CI

### T3.1 Repair the full API check

- Updated the one stale expectation: anonymous access to a channel comment
  photo now expects `401` (Spring Security's entry point) instead of `403`.
  The endpoint still never serves bytes without an authenticated session.
- `python3 scripts/check-profile-api.py` — pass.
- `python3 scripts/check-profile-api.py --legacy-channels` — pass, including
  historical channel migration.

### T3.2 Add the API check to CI

- Added an `api-contract` job to `.github/workflows/ci.yml`: Java 21, Maven
  cache, `mvn -B -DskipTests package`, then both API check modes.

### Current tree state

- The parallel QA session still has uncommitted frontend/profile/security
  changes. Only the API script, CI workflow, and this log entry are committed
  at this point so the two workstreams stay separable.
