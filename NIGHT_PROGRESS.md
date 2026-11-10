# Nightfall / Messeger — autonomous hardening journal

Owner: autonomous Nightfall engineering session.
Window: 2026-11-10 19:00 → 2026-11-11 09:00 (local).
Working tree: `/home/apache/VScode/Messeger`.
Live data on port 8080 and the user's databases are never modified.
All dynamic checks use the isolated QA instance on `127.0.0.1:8091` with
`/tmp/opencode/deep-qa/nightfall.mv.db`.

This file is append-only. Newest entries go at the bottom. `PROGRESS.md` and
`ROADMAP.md` belong to the parallel hardening workstream; do not rewrite them.

## Checkpoints

| Commit | Meaning |
| --- | --- |
| `b7cfa3d` | baseline snapshot before hardening |
| `8bb051f` | audit roadmap and baseline progress |
| `f66aaab` | API contract check repaired and wired into CI |
| `a1bc687` | profile/avatar/mobile/security-header fixes from this session |

Source rollback archive:
`.backups/2026-11-10-pre-v1.0.0/source-baseline.tar.gz`.

## Completed in this session

### B1 — phantom `my-chat` request

- `src/App.tsx`: initial `selectedId` is now `''`; the real self-chat id is
  assigned after `listChats()` / `getOrCreateSelfChat()` resolves.
- Verified in Chromium at 1440×900: no `GET /api/chats/my-chat/messages`, no
  false “Failed to load messages.” toast.

### B2 — mobile horizontal overflow

- `src/styles.css`: at ≤760 px the connection badge is hidden, the wordmark can
  shrink, gaps are reduced, and the actions group no longer pushes the header
  past the viewport. At ≤359 px the wordmark shrinks further and the command
  launcher is hidden.
- Verified at 390×844 and 320×700:
  `document.documentElement.scrollWidth === window.innerWidth` (390/390,
  320/320), no page-level horizontal scroll.

### B3 — validation messages and 413

- `ApiErrorHandler`: `MaxUploadSizeExceededException` → JSON `413` with a
  human-readable message; `MultipartException` → JSON `400`.
- `firstName`/`lastName` now distinguish “missing” from “too long”.
- Added specific messages for `website`, `githubUsername`, `avatarDataUrl`,
  and password confirmation.
- Verified: 4×8 MB multipart → `413` JSON; 49-character first name →
  “First name must be 48 characters or fewer.”

### B4 — avatar upload validation

- `DataUrlAttachment`: public `AVATAR_TYPES` allowlist (PNG/JPEG/GIF/WebP).
- `ProfileController`: every non-empty `avatarDataUrl` goes through
  `DataUrlAttachment.parse(...)` with a 1 MB decoded limit. SVG, HTML, fake
  signatures, arbitrary URLs, and oversized data are rejected and the stored
  value is canonical base64.
- Verified: SVG avatar → `400`; fake PNG → `400`; real 1×1 PNG → `200` and
  canonical data URL; rendered `<img>` loads under CSP.

### B5 — security headers

- `AuthConfiguration` now emits:
  - `Content-Security-Policy` (self-only scripts/connect, `data:`/`blob:`
    images and media, inline styles for React style attributes, no framing,
    no objects);
  - `Referrer-Policy: strict-origin-when-cross-origin`;
  - `Permissions-Policy` denying camera/microphone/geolocation/payment/USB/etc.
- Existing `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and
  `Cache-Control: no-store` remain.
- Verified with Chromium on all main views: zero CSP console errors, avatar
  `data:` image loads, no page errors.

### B7 — partial profile update data loss

- `ProfileController`: `null` now means “keep the current value”; explicit
  empty string clears a field. Boolean switches are nullable and only applied
  when present. This makes partial `PUT` non-destructive.
- Server-side validation added for `website` (`http://`/`https://` only) and
  `githubUsername` (`[A-Za-z0-9-]{1,39}`).
- Verified: `PUT {"username":"qa_beta"}` preserved display name, names,
  headline, bio, status, and notification switches; `javascript:` website and
  malformed GitHub username are rejected.

### T1.5 / B6 — mobile navigation & viewport polish

- `index.html`: added `viewport-fit=cover` to meta viewport for iOS/Android safe area support.
- `src/App.tsx`: added fixed mobile bottom navigation `<nav className="mobile-nav">` with Home, Messages, Threads, Channels, Contacts.
- `src/App.tsx` & `src/styles.css`: auto-hide `.mobile-nav` when inside active chat conversation (`mobileChatOpen`), giving full screen height to messages and message input. ArrowLeft back button restores the chat list and mobile nav.
- Touch target sizes upgraded to 48px with `env(safe-area-inset-bottom)`.
- Verified with Chromium Playwright at 390×844 (iPhone) and 320×568 (narrow mobile):
  `scrollWidth === innerWidth` (390/390 and 320/320), zero page horizontal overflow across all views.

### T2.3 — bounded collection endpoints

- Controllers and JPA repositories updated with conservative limits (`PageRequest` / `limit` parameters):
  - People search & contacts (`PeopleController`, `ContactRepository`, `AuthUserRepository`, `ProfileRepository`)
  - Channel subscriber directory & follows (`ChannelManagementController`, `ChannelFollowRepository`)
  - Channel list & post queries (`ChannelsController`, `ChannelRepository`)
  - Discussions & comments (`DiscussionsController`, `DiscussionThreadRepository`, `DiscussionCommentRepository`)
  - Feed posts & comments (`FeedController`, `HubController`, `HubCommentRepository`)
- Verified: `scripts/check-profile-api.py` asserts that limit parameters are enforced without changing response schemas.

### T3.3 & PWA — documentation and installability polish

- `CHANGELOG.md`: created comprehensive changelog for v1.0.0 detailing security fixes, mobile UX improvements, validation changes, and deployment options.
- `public/manifest.webmanifest` & `index.html`: added Web App Manifest, Apple mobile web app metadata, and touch icons for "Add to Home Screen" support on iOS/Android.
- `scripts/prepare-demo-preview.mjs`: added `manifest.webmanifest` to public allowlist and tested with `npm run build:demo`.
- `README.md`: added mobile & PWA support details and test run documentation.

## Verification run

| Command | Result |
| --- | --- |
| `npm run build` | pass |
| `npm run build:demo` | pass (includes manifest.webmanifest and favicon) |
| `npm test` | pass (api, account, posts, social, appearance, channels, navigation) |
| `cd backend && mvn -q test` | pass (17/17 integration tests) |
| `python3 scripts/check-profile-api.py` | pass |
| `python3 scripts/check-profile-api.py --legacy-channels` | pass |
| Headless Chromium mobile smoke (390×844 & 320×568) | pass; 0 horizontal overflow, mobile tabs work |

## Sharing with friends

- Instant public HTTPS instance: `./scripts/share.sh cloudflare` opens an anonymous Cloudflare tunnel (using `.tools/cloudflared`) and prints a public URL (`https://*.trycloudflare.com`) with an invite code. Friends can access from mobile phones or desktop browsers without local network or firewall restrictions.
- Offline static demo: `npm run build:demo` builds an isolated browser-only preview into `web-preview/dist`.

## Next queue

1. Session/CSRF/rate-limit verification and regression checks.
2. Attachment payload reduction: stop returning base64 blobs in chat message
   lists; add a dedicated attachment endpoint.
3. Final report, changelog, README refresh, and final test run.

