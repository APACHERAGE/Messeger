# Nightfall Dev Board

Nightfall is a responsive community app built with React, TypeScript, Vite, and a Spring Boot API. Home and the personal profile are one page: identity and status at the top, About, skills and repositories beneath, and a wall below. `/profile` is a compatible alias for `/`. Profile editing and settings open in a dialog over the same Home page, preserving its wall and draft state. Threads, channels, messages, mail, and people remain separate workspace sections.

## Personal and general walls

**My wall** contains records explicitly published on that wall, by its owner or by friends allowed to post there. It is not a feed of every post written by those friends. Owners can remove guest posts from their wall; authors can edit or remove their own posts. An account can disable guest posts in Privacy.

**General feed** has **For you** and **Following** tabs. Following combines visible posts from friends, explicitly followed people, and followed channels. For you adds eligible public recommendations, ranked by real reactions/comments and recency with a small daily exploration factor. Private friends-only posts never become recommendations. Following a person does not grant access to their private profile or wall. A public post is readable by signed-in users, while opening an entire personal wall still requires friendship.

Choose **Friends** or **Public** on each post. The default remains Friends; Privacy also lets users choose the default for new posts. Posts on someone else’s wall are always friends-only. The visibility policy is shared by post reads, reactions, comments, and attachment downloads.

Posts support text (500 characters), media without a caption, or a combination of up to four JPG, PNG, WebP, GIF, MP4, or WebM files. Photos/GIFs may be up to 5 MB each, videos up to 20 MB each, with a 30 MB total per post. GIFs are uploaded from the device. Media has previews and removal controls; videos support byte-range playback. Server feeds contain metadata rather than embedded file bytes. Local mode uses localStorage for post metadata and IndexedDB for binary files, and does not share data or invent recommendations from other users.

## Channels and post discussions

Only the current channel owner can publish announcements. Readers can open Comments under a post, write comments (up to 2000 characters), reply to another comment, insert emoji, toggle reactions, and attach one JPG/PNG/GIF/WebP photo up to 1 MB. Comments load in pages of 50; Refresh retrieves changes from other readers. Photos use authenticated endpoints rather than embedded bytes in comment lists. Removing a comment erases its text, photo and reactions while keeping a placeholder for existing replies.

Manage channel opens the owner studio: name/description, subscriber directory, actual post/comment/subscriber counts, and a channel-wide comments switch. Owners can edit/delete posts, pin posts at the top, close individual discussions, and moderate comments. Ownership cannot unsubscribe. Transfer & leave atomically assigns another existing subscriber as owner, unsubscribes the previous owner and revokes their owner permissions. The new owner can manage historical posts too. Deleting a channel requires its exact name and removes all its posts, comments, photos, reactions and subscriptions.

`ChannelAccess` centralizes channel/post lookup and ownership locks. Publishing, transfer, leaving, deletion and moderation serialize against the same channel row. Comment operations verify both channel and post IDs; a reply cannot refer to another post. Existing browser records and database rows retain their posts and receive defaults for the new settings. Local mode keeps per-account demo records; transfer between real accounts requires the API.

## Contacts, friends, and following

Contacts are an address book. Friends are mutual relationships established by sending and accepting a request. Requests can be declined or cancelled; removing a contact does not remove friendship, and removing a friend does not erase the contact. Blocking ends friendship and following; unblocking does not recreate them. Existing contacts are not silently converted into friends.

People cards show a compact profile with a More button for fuller details. The server separately enforces who can view profile details, send messages, or post to a wall. Message restrictions apply to existing conversations as well as new ones. Display name and username remain discoverable; hidden individual fields are omitted from public DTOs and from name search. Public profile DTOs include only safe appearance options, never private notification/chat preferences.

## Profile and appearance settings

Appearance offers Dark (the default), Light, System, 40 preset palettes and a custom color, four cover styles, compact/comfortable spacing, and a 100-item pixel/ASCII artwork library. Colors are adapted for readable accent/label contrast. Artwork comes from the pinned MIT-licensed Pixelarticons package; the generated paths and ASCII previews are checked in, so viewing the app needs no external image service. The complete MIT notice is bundled in the gallery and retained under `src/data/`.

Profile details include display name, first/last name, username, role, status, biography, location, website, pronouns, company/team, time zone, interests, collaboration interests, a GitHub handle, skills, and up to six repositories. There are individual visibility controls for 16 optional fields. Home shows About, then skills on the left and repositories on the right, followed by the add-project action. Visibility management is a small button rather than a separate sidebar panel.

Settings include notifications and quiet hours, messaging, appearance, accessibility, export, blocked accounts, and storage controls. Changes apply after Save changes; unsaved changes can be discarded. Account caches are isolated. Profile exports include hidden fields. Two-step verification and device-session management are not implemented; password recovery is available from sign-in.

## Validation and architecture

```bash
npm test                 # API contract checks + all UI/state checks
npm run test:api         # chat fallback/pagination and mail server mode only
npm run build            # TypeScript + production bundle
cd backend
mvn test                 # Spring Boot integration tests
cd ..
python3 scripts/check-profile-api.py
# Optional legacy database migration regression:
python3 scripts/check-profile-api.py --legacy-channels
```

The API checker starts a private loopback test server on a dynamically assigned port, uses an in-memory H2 database and three disposable accounts, and stops its server after testing. It requires Java, compiled backend classes and Maven dependencies cached in `~/.m2/repository`; it never touches the development database. The optional legacy migration mode uses a disposable database file in its temporary directory. The tests cover profile/privacy round trips, all palettes, request/friend/follow lifecycles, guest posts and moderation, recommendations, people/channel subscriptions, direct-message restrictions, uploads, and media access.

`HomePage` composes `ProfileOverview`, `UserWall`, and `GeneralFeed`; `PostComposer` and `PostCard` are shared. `SocialAccess` owns relationship/audience rules, `HubAccess` handles per-post authorization, `HubPostPresenter` emits safe feed DTOs, and controllers keep request/transaction boundaries. `/src/routes.ts` contains the canonical view mappings. Source-level/SSR and API checks do not replace visual browser QA.

Optional asset regeneration: `python3 scripts/prepare-pixel-art.py` (requires ImageMagick and the pinned npm package) and `python3 scripts/prepare-theme-tokens.py`. These tools are not needed for normal builds.

## Command center

Open the command center from the navigation rail or press `Ctrl+K` (`⌘K` on macOS). Type a command or select one from the list. `/help` opens the in-app reference.

| Command | Action |
| --- | --- |
| `/help` | Open the command reference |
| `/home` | Open your profile and personal wall |
| `/threads` | Open the Threads discussion feed |
| `/forum` | Legacy alias for Threads |
| `/channels` | Open technical channels |
| `/chats` | Open direct and group chats |
| `/people` | Open the people directory |
| `/profile` | Open the unified Home/profile page |
| `/new-thread` | Open the new thread composer |
| `/new-channel` | Open the new channel form |
| `/search <query>` | Search threads by text, title, or author |
| `/sort active` | Sort threads by reply activity |
| `/sort new` | Sort threads by creation date |
| `/status` | Show connection status |
| `/logout` | Sign out |

The command center only runs built-in Nightfall actions. It does not execute operating-system commands or pass input to a shell.

## Run the web app

```bash
npm install
npm run dev
```

In VS Code, the `Nightfall: dev` background task is also available. It uses port 5173 and remains open in the task terminal.

Open the local URL printed by Vite. If the backend is unavailable, the app uses local demo mode: feeds, channels, chats, messages, profiles, and contacts are stored in that browser's `localStorage`. Registration, email delivery, and shared channels require the API.

## Share with friends

`scripts/share.sh` builds the frontend and backend, serves both from one process, and opens a public HTTPS tunnel. Registration is invite-only. With SMTP configured, it also emails invitations and welcome/verification links.

```bash
./scripts/share.sh             # Tailscale Funnel first, Cloudflare Quick Tunnel as fallback
./scripts/share.sh cloudflare  # anonymous random URL, no account
./scripts/share.sh tailscale   # stable HTTPS URL; enable Funnel once in the Tailscale admin console
./scripts/share.sh lan         # same Wi-Fi or tailnet, http://<local-ip>:8080
```

The script prints the URL and an invite code. Signed-in members can use **Mail → Invite by email** to send a registration link. The code is saved privately in `.share/invite-code` so restart does not invalidate existing invitations. By default accounts and messages live in `.share/nightfall.mv.db`, logs in `.share/logs/`. Override defaults with `NIGHTFALL_INVITE_CODE`, `NIGHTFALL_PORT`, `NIGHTFALL_DATA_DIR`, or `NIGHTFALL_DB_PATH`.

The Tailscale URL stays the same while the machine and tailnet remain online. The Cloudflare Quick Tunnel URL changes after each restart; previously emailed links then need to be resent. Without SMTP, new accounts are active immediately and password reset is unavailable. With SMTP, email verification is required. Back up the H2 file while the app is stopped.

The first `tailscale` run can print a one-click link to enable Funnel for this machine; after that the same URL works across restarts. If `*.trycloudflare.com` does not resolve on this computer, a local DNS filter is blocking it — friends on normal DNS are usually unaffected, and Tailscale Funnel gives a stable URL that resolves locally. Set `NIGHTFALL_TAILSCALE_PORT=443` if you prefer a URL without `:8443`.

## Run the API

JDK 21+ and Maven 3.9+ are required.

```bash
cd backend
mvn spring-boot:run
```

The API listens on `http://127.0.0.1:8080`; Vite proxies `/api` requests to it. H2 stores data in `backend/nightfall.mv.db`. Refresh the site after starting the backend to switch from local mode to the API. Local demo data is not automatically imported into H2.

### Email and account verification

All state-changing requests use CSRF protection. Sign-in is stored in a server-side HTTP-only session, not in `localStorage`. Passwords are hashed with BCrypt. Verification tokens are stored in the database as SHA-256 hashes and expire after 24 hours.

To send real email, configure SMTP with environment variables and start the backend:

```bash
export NIGHTFALL_MAIL_MODE=smtp
export NIGHTFALL_PUBLIC_URL=http://127.0.0.1:5173
export NIGHTFALL_MAIL_FROM=no-reply@example.com
export NIGHTFALL_SMTP_HOST=smtp.example.com
export NIGHTFALL_SMTP_PORT=587
export NIGHTFALL_SMTP_USERNAME=...
export NIGHTFALL_SMTP_PASSWORD=...
export NIGHTFALL_SMTP_AUTH=true
export NIGHTFALL_SMTP_STARTTLS=true
cd backend
mvn spring-boot:run
```

`NIGHTFALL_PUBLIC_URL` must match the browser URL printed by Vite. Do not post or commit SMTP credentials.

For this machine, `.share/mail.env` already contains the sender `apache.desktop@gmail.com`, Gmail's SMTP host, and the existing local database path. Start `./scripts/share.sh` from an interactive terminal; the script privately prompts for a **Google app password** when needed. Enable two-step verification on that Google account and generate an app password in Google Account settings. Enter the app password only in the local terminal; do not use your ordinary Google password or put either password in this repository or chat. The password is kept in the process environment for that run. This configuration has not sent a real email until the password is entered and an invitation or registration is tested.

The app's `username@nf.com` mailbox is internal Nightfall messaging. External invitations, welcome messages, and password resets use SMTP and the sender configured above.

For local development, `NIGHTFALL_MAIL_MODE=console` prints one-time verification links to the backend log instead of sending email. The default is `disabled`; registration reports the missing mail configuration rather than pretending delivery succeeded.

Authentication endpoints are rate limited in process: login by IP and identifier, registration by IP and email, verification/resend and password-reset requests. A throttled request returns `429` with `Retry-After`. The limiter is per-instance; a multi-instance deployment needs a shared store such as Redis or a gateway limiter.

Registration stores the password immediately. Opening the emailed link requires entering the same password before the account is marked verified, so knowing the link alone cannot take over a pending registration. A fresh link can be requested from the sign-in screen without revealing whether the address exists.

Profiles, contacts, and chats are scoped to accounts. Channels are visible to signed-in users; only owners can publish. Main API routes include `/api/auth/{csrf,session,register,login,verify,resend-verification,logout}`, `/api/mail/{mailbox,mailboxes,inbox,sent}`, `/api/channels`, `/api/channels/{id}`, `/api/channels/{id}/follow`, `/api/channels/{id}/posts`, `/api/discussions`, `/api/discussions/{id}`, `/api/discussions/{id}/comments`, `/api/chats`, `/api/profile`, `/api/people`, and `/api/contacts`.

### Mail and pagination

Server mail is limited to the mailbox derived from the account (`username@nf.com`); additional external inboxes exist only in local demo mode. The inbox and sent folders accept `limit` (default 100, maximum 200) and an ISO-8601 `before` cursor. Chat messages accept `limit` (maximum 100) and a numeric `before` cursor; channel posts accept `limit` (maximum 100) and an ISO-8601 `before` cursor. Older pages are loaded on demand.

Attachments are validated by declared type, decoded size, and file signature before storage. Chats accept images, PDF, plain text, MP4/WebM video, and MP3/OGG/WAV audio; channels accept images, PDF, and plain text. SVG and HTML are rejected, and every attachment is capped at 1 MB. Files are still stored as base64 payloads, which is suitable for this prototype but should move to object storage before real scale.

The app polls the open chat every five seconds. Messages are merged by ID so pagination survives refresh; a WebSocket/SSE transport is the next scalability step.

This is an early prototype and is not ready for public deployment. H2 with `ddl-auto=update` is intended for development only. A production launch needs a managed database with migrations, HTTPS, `NIGHTFALL_COOKIE_SECURE=true`, a shared rate-limit store, object storage for attachments, and a reviewed mail-provider configuration. Authentication, mail delivery, and attachment validation are covered by `backend/src/test`; run both suites in CI (`.github/workflows/ci.yml`).
