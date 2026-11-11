# Nightfall Changelog

All notable changes to the Nightfall project are documented in this file.

## [1.2.0] - 2026-11-11

### Mobile App
- Added a separate Expo/React Native iPhone client under `mobile/`.
- Added mobile login, feed, likes, comments, chat list, messages, profile, and logout flows against the existing Spring Boot API.
- Added a configurable server URL for LAN testing and HTTPS deployments.

### Security & Reliability
- Revoked existing authenticated sessions after a successful password reset using a per-account session version.
- Kept mobile CSRF state synchronized with the backend session rotation after login.

### Web UX
- Made the web feed comment action visibly open and close its comments section, with accessible state and focus behavior.

## [1.0.0] - 2026-11-10

### Security & Hardening
- **Security Headers**: Added `Content-Security-Policy`, `Referrer-Policy: strict-origin-when-cross-origin`, and restrictive `Permissions-Policy`. Retained `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Cache-Control: no-store`.
- **Avatar & Attachment Magic-Byte Verification (NF-06 / B4)**: Integrated `DataUrlAttachment` validation with file signature verification across PNG, JPEG, GIF, WebP, PDF, UTF-8 text, MP4, WebM, MP3, OGG, and WAV. Stored assets are strictly capped at 1 MB; SVG, HTML, and forged signatures are rejected.
- **Account Registration Isolation (NF-01 / NF-02)**: Unverified registration attempts snapshot candidate credentials per verification token, preventing account pre-claim takeovers. Added in-process rate limiting on login, registration, verification, and password reset endpoints.
- **Enumeration Protection (NF-05)**: Standardized auth error responses with constant-time dummy password hashing for nonexistent accounts, ensuring unverified accounts cannot be enumerated without the correct password.
- **Account-Scoped Client Cache (NF-04)**: Scoped browser `localStorage` and memory cache keys by account ID, preventing profile data leakage across sessions or after logout.
- **Bounded Endpoints (T2.3 / NF-03)**: Added pagination and conservative `limit` query parameters on people search, contacts, channel subscribers, channel listings, discussions, comments, and feed timelines.

### Mobile & Responsive UX
- **Mobile Navigation Bar (T1.5 / B6)**: Added a persistent bottom navigation bar on screens ≤760 px for instant switching between Home, Messages, Threads, Channels, and Contacts.
- **Chat Fullscreen Focus**: On mobile, opening a chat conversation automatically hides the bottom bar to provide maximum vertical space for messages and message input. The header back button (`←`) restores the conversation list and navigation bar.
- **Viewport & Safe Area Insets**: Added `viewport-fit=cover` to meta viewport and applied `env(safe-area-inset-bottom)` to navigation bars and message composers for iOS and Android gesture bars.
- **Zero Horizontal Overflow (B2)**: Eliminated header stretching and content overflow at 390×844 and 320×568 viewports (`document.documentElement.scrollWidth === window.innerWidth`).
- **PWA Installation**: Added `manifest.webmanifest` and mobile app meta tags for "Add to Home Screen" standalone app mode on iOS and Android.

### Bug Fixes & Reliability
- **Phantom `my-chat` Request (B1)**: Initialized selected chat ID empty; self-chat ID is resolved dynamically after loading, eliminating the 404 console error and false "Failed to load messages." toast.
- **Non-Destructive Partial Profile Updates (B7)**: Omitted profile fields in `PUT /api/profile` preserve current values instead of overwriting them with empty strings. Added server-side validation for website URLs (`http://` / `https://` only) and GitHub usernames.
- **Validation & 413 Handling (B3)**: Specific validation error messages for names, passwords, and avatars. Added JSON error body for `MaxUploadSizeExceededException`.
- **Discussion Markdown Sanitization**: Sanitized markdown output with `rehype-sanitize` and secure external link attributes (`target="_blank" rel="noreferrer noopener"`).

### Sharing & Deployment
- **One-Command Cloudflare Tunnel**: Included `./scripts/share.sh cloudflare` for instant anonymous HTTPS hosting via Cloudflare Quick Tunnel with invite code protection.
- **Browser-Only Demo Build**: `npm run build:demo` outputs a self-contained offline preview to `web-preview/dist` using IndexedDB storage.
