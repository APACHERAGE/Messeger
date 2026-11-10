# Nightfall — roadmap to a tested v1.0

Status date: 2026-11-10. Owner: autonomous full-stack work session.

This plan turns the current working prototype into a tested, hardened v1.0
candidate. It is based on a source audit, the QA report in
`QA-REPORT-2026-11-10.md`, the security review in
`security-review/2026-11-10/REPORT.md`, and a fresh local test run.

## Current baseline

Verified before any code change:

- `npm run build` — pass.
- `npm test` — pass (api, account, posts, social, appearance, channels, navigation).
- `cd backend && mvn test` — pass (17 tests).
- `python3 scripts/check-profile-api.py` — **fail**: anonymous comment-photo
  request returns 401 but the script expects 403. This is a stale test
  expectation, not an authentication bypass; the media is still protected.
- Working tree had no Git history; a baseline commit and a pre-audit source
  archive now exist.

The live development backend on port 8080 is paused in a debugger and is not
used for testing. All automated checks use isolated ports and in-memory or
throw-away databases.

## Priorities

P0 blocks a trustworthy release. P1 is important UX/security hygiene. P2 is
release polish. P3 is explicitly deferred.

## P0 — correctness and security

### T1.1 Remove the phantom `my-chat` request

- Start `selectedId` empty instead of the non-existent `my-chat` id.
- Ensure the message effect does not call the API until a real chat is selected.
- Verify: login produces no `GET /api/chats/my-chat/messages` and no false
  "Failed to load messages." toast.
- Add a regression check.

### T1.2 Fix mobile horizontal overflow

- Apply the verified CSS fix for `.app-shell`, `.masthead`, `.wordmark`, and
  `.masthead-actions` at `max-width: 760px`.
- Optionally hide the long wordmark subtitle on narrow screens.
- Verify at 390x844: `document.documentElement.scrollWidth === 390` on every
  route.
- Add a regression check.

### T1.3 Improve validation messages and 413 responses

- Distinguish empty from too-long `firstName`/`lastName`.
- Add a specific `avatarDataUrl` message.
- Add a JSON `MaxUploadSizeExceededException` handler.
- Verify with API checks for long names, oversized avatar, and oversized
  multipart upload.

### T1.4 Validate avatars like other uploads

- Run `avatarDataUrl` through `DataUrlAttachment.parse` with
  `AVATAR_TYPES` and a 1 MB limit.
- Reject SVG, HTML, arbitrary URLs, forged signatures, and oversized data.
- Verify with API checks and keep existing valid PNG avatars accepted.

### T1.5 Add mobile navigation

- Render a bottom navigation bar for widths <= 760 px using the existing
  `.hub-mobile-nav` styles.
- Expose Home, Messages, Threads, Channels, and Contacts with accessible
  labels and active state.
- Verify at 390x844 that every main section is reachable without the command
  palette and without horizontal overflow.

## P1 — hardening

### T2.1 Security headers

- Add `Content-Security-Policy-Report-Only` (compatible with the current Vite
  build), `Referrer-Policy: no-referrer`, and a restrictive
  `Permissions-Policy`.
- Keep `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff`.
- Add a backend test for the headers.

### T2.2 Partial profile updates

- Add `PATCH /api/profile` that changes only fields present in the body.
- Keep `PUT` for existing clients that send a full profile.
- Verify absent fields survive a PATCH and that validation still applies.

### T2.3 Bound remaining collection endpoints

- Audit channels, discussions, subscribers, people, and feed endpoints for
  unbounded reads.
- Add conservative server-side limits or pagination where missing.
- Keep response shapes backward compatible where possible.

### T2.4 Regression tests for fixed security findings

- Confirm NF-01 (re-registration cannot activate an old password), NF-05
  (unverified accounts are not enumerable with a wrong password), and NF-06
  (chat attachments are validated) remain fixed.
- Record the checks in the repository's test scripts.

### T2.5 Dependency and secret hygiene

- Re-run `mvn dependency:tree`, `npm audit` if the registry is reachable, and
  a repository secret scan.
- Update only when a concrete advisory applies and tests stay green.
- Never commit `.env`, `.share`, databases, or invite codes.

## P2 — release polish

### T3.1 Repair and extend the full API check

- Update the stale anonymous-media expectation to 401.
- Run both normal and `--legacy-channels` modes.

### T3.2 CI coverage for the API check

- Add the Python profile/API check to the existing GitHub Actions workflow so
  `mvn test` and the live API regression suite both run.
- Make the job reproducible (Java 21, Maven cache, compiled classes).

### T3.3 Release documentation

- Add a concise `CHANGELOG.md` for v1.0.0.
- Update README with the current behavior, test commands, and known limits.
- Keep the QA report as an artifact; link it from the changelog.

### T3.4 Final verification and commit

- `npm run build`
- `npm test`
- `cd backend && mvn test`
- `python3 scripts/check-profile-api.py`
- `python3 scripts/check-profile-api.py --legacy-channels`
- Headless mobile/desktop smoke test
- Commit the result with a clear message. Do not publish or deploy.

## P3 — deferred

- Object storage for attachments (currently base64 in JSON/H2).
- WebSocket/SSE transport instead of five-second polling.
- Managed database migrations and multi-instance rate limiting.
- Two-step verification and device-session management.
- Full visual and accessibility audit.
- Public deployment: HTTPS, secure cookies, SMTP review, backups, monitoring.

## Definition of done

- Every P0/P1 task is implemented or explicitly recorded as deferred with a
  reason.
- All automated checks above pass locally.
- The app has a clean Git history with one commit per task group.
- `PROGRESS.md` names the exact commands and results for the latest run.
- No user data, credentials, system settings, or public deployment are touched.
