# Alumni Mentor Network

**Verified Alumni Mentorship Matching and Engagement Platform** — P11, Track J (Next.js + Node.js + MongoDB).

Verifies alumni against institutional records, matches students to mentors with explained relevance, and supports the whole mentoring relationship (requests → sessions → goals → feedback) while **protecting mentors' time** and **never exposing alumni contact details to students**.

---

## Contents

1. [Quick start (5 minutes)](#1-quick-start-5-minutes)
2. [Demo accounts & what to try](#2-demo-accounts--what-to-try)
3. [What you need to set up (and what you don't)](#3-what-you-need-to-set-up-and-what-you-dont)
4. [Optional integrations, step by step](#4-optional-integrations-step-by-step)
   - [Accounts & security](#accounts--security)
5. [Architecture](#5-architecture)
6. [Feature map (spec → code)](#6-feature-map-spec--code)
7. [Testing](#7-testing)
8. [Deployment](#8-deployment) (including the [go-live checklist](#go-live-checklist))
9. [Scripts](#9-scripts)
10. [Known limitations / not yet verified](#10-known-limitations--not-yet-verified)

---

## 1. Quick start (5 minutes)

**Prerequisites:** [Node.js 20+](https://nodejs.org) (tested on 22.19) and Git. Nothing else — no database install needed.

```bash
npm install
```

```bash
npm run dev
```

Open **http://localhost:3000**.

On first start the API downloads a MongoDB binary (~600 MB, one time only), starts it **embedded**, and loads the demo data set automatically. Data persists in `%LOCALAPPDATA%\alumni-mentor-network\mongo-data` (Windows) or `~/.local/share/alumni-mentor-network/mongo-data` — deliberately **outside** the project folder, because OneDrive/Dropbox sync corrupts live database files.

| Service | URL |
|---------|-----|
| Web app | http://localhost:3000 |
| API | http://localhost:4000/api |
| Health check | http://localhost:4000/api/health |

To wipe and reload the demo data at any time (stop `npm run dev` first):

```bash
npm run seed
```

## 2. Demo accounts & what to try

All demo accounts use the password **`Demo@1234`** (defined in `apps/api/src/seed/data.ts`).

| Email | Role | Try this |
|-------|------|----------|
| `student@demo.edu` | Student (Aarav Sharma) | Dashboard → **Find a mentor** (ranked matches with reasons, facets, capacity) → open a mentor → **Request mentorship**. Open your mentorship → **Messages** and type an email address: it is hidden. |
| `mentor@demo.edu` | Verified alumni mentor (Priya Nair) | 3 pending requests, 1 open slot. **Accept** one → you're now full and Accept is disabled. **Decline** with an optional reason, or **Decline all**. **Pause** new requests. |
| `newalumni@demo.edu` | Registered, unverified alumna | **Profile & verification** → submit roll number `2018CS901`, name *Rhea Kapoor*, year 2018, B.Tech, Computer Science & Engineering, DOB 1996-04-12 → exact record match. |
| `aro@demo.edu` | Alumni Relations Officer | **Verification queue** (approve Rhea, compare fields, open documents), **Engagement health** (nudge), **Mentor capacity** (overload warnings), **Programme report**. |
| `placement@demo.edu` | Placement Officer | Read-only programme report incl. mentoring ↔ placement correlation. |
| `admin@demo.edu` | Administrator | **Programme settings**: matching weights, throttle limits, request expiry, engagement thresholds. Users, audit log. |

Seed contents: **60 verified alumni** (each matched to an institutional record with an approval audit trail), 6 pending verifications (some with mismatches), 46 students, 26 mentorships with ~5 months of sessions, goals, action items, messages, feedback and weekly engagement snapshots, 45 requests in every state, and placement outcomes.

## 3. What you need to set up (and what you don't)

| Thing | Needed to run? | Default without setup |
|-------|---------------|----------------------|
| Node.js 20+ | **Yes** | — |
| MongoDB | No | Embedded MongoDB, auto-started |
| `.env` files | No | Sensible defaults (see `apps/api/.env.example`) |
| Email (SMTP) | No | Every email is written to `apps/api/outbox/*.json` so you can read it |
| SMS (Twilio) | No | Written to `apps/api/outbox/` |
| Google / Outlook calendar | No | Every session has an **.ics download**; "Connect calendar" shows *Not enabled on this server* |
| Video calls | No | A unique Jitsi Meet link per session (no account needed) |
| Docker | No | Only for the production-style setup in §8 |

**For production you must set:** `JWT_SECRET`, `MONGODB_URI`, `DATA_ENCRYPTION_KEY`, `SMTP_URL`, `MAIL_FROM`, `COOKIE_SECURE=true`, and https:// values for `WEB_ORIGIN` and `PUBLIC_API_URL`. The API checks these at startup and refuses to run without them, listing exactly what is missing. See the [go-live checklist](#go-live-checklist).

## 4. Optional integrations, step by step

Create `apps/api/.env` from the template first:

```bash
cp apps/api/.env.example apps/api/.env
```

### 4.1 Real MongoDB (Docker)

1. Start Docker Desktop.
2. Run `docker compose up -d mongo`.
3. Set `MONGODB_URI=mongodb://localhost:27017/amn` in `apps/api/.env`.
4. Run `npm run seed`, then `npm run dev`.

**MongoDB Atlas instead:** create a free cluster, add a database user, allow your IP, copy the `mongodb+srv://…` string into `MONGODB_URI`.

### 4.2 Email (SMTP)

1. Pick any SMTP provider. For Gmail: enable 2-step verification, then create an **App password** at https://myaccount.google.com/apppasswords.
2. Set `SMTP_URL=smtps://your.address%40gmail.com:APP_PASSWORD@smtp.gmail.com:465` (note `%40` for `@`).
3. Set `MAIL_FROM`.
4. Restart the API.

### 4.3 SMS (Twilio)

1. Create a Twilio account and get a phone number.
2. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`.
3. Users opt in under **Settings → SMS reminders**. Only session reminders and confirmations go by SMS.

### 4.4 Google sign-in, Google Calendar and Google Meet

One Google OAuth client powers "Continue with Google" **and** calendar sync.



1. Go to https://console.cloud.google.com → create a project → **APIs & Services → Library** → enable **Google Calendar API**.
2. **OAuth consent screen** → External → add the scopes `openid`, `email`, `profile` and `.../auth/calendar.events` → add yourself as a test user.
3. **Credentials → Create credentials → OAuth client ID** → *Web application*.
4. Add **both** authorised redirect URIs:
   - `http://localhost:4000/api/auth/google/callback` (sign-in)
   - `http://localhost:4000/api/calendar/google/callback` (calendar)

   In production use `{PUBLIC_API_URL}/api/auth/google/callback` and `{PUBLIC_API_URL}/api/calendar/google/callback`.
5. Put the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
6. Optional: set `VIDEO_PROVIDER=google_meet` to use Meet links instead of Jitsi.
7. Optional: set `GOOGLE_STUDENT_DOMAINS=students.your-institution.edu` so new **student** accounts created via Google must use an institution address. Alumni can use any verified Google account, because they are verified against records afterwards.
8. Restart the API. The **Continue with Google** button activates on the sign-in and sign-up pages, and calendar sync appears under **Settings → Calendar → Connect**.

How Google sign-in behaves:
- Only Google-verified email addresses are accepted.
- If an account with the same email already exists, it is linked to Google and keeps its role.
- New users pick Student or Alumnus on the sign-up page before continuing to Google.
- The flow uses a signed state plus a nonce cookie (CSRF and replay protection), and the ID token is checked for audience, issuer, expiry and nonce.

### 4.5 Outlook / Microsoft 365 calendar

1. Go to https://entra.microsoft.com → **App registrations → New registration**.
2. Choose *Accounts in any organizational directory and personal Microsoft accounts* (or your tenant only).
3. Add the redirect URI (Web) `http://localhost:4000/api/calendar/outlook/callback`.
4. **Certificates & secrets → New client secret**.
5. **API permissions** → Microsoft Graph → Delegated → `Calendars.ReadWrite`, `OnlineMeetings.ReadWrite` and `offline_access`.
6. Set `MS_CLIENT_ID`, `MS_CLIENT_SECRET` and `MS_TENANT` (`common`, or your tenant ID).
7. Restart the API → **Settings → Calendar → Connect**.

### 4.6 Institutional records (ERP)

Staff open **Institution records → Import CSV** with the columns `rollNumber,fullName,graduationYear,degree,department[,dateOfBirth]`. Existing roll numbers are updated. For a live ERP sync, call `POST /api/alumni/records/import` from a scheduled job with a staff token.

## Accounts & security

| Feature | How it works |
|---|---|
| **Password reset** | "Forgot password?" on the sign-in page emails a one-time link (30 minutes). The answer is the same whether or not the account exists, and at most 3 links are sent per hour. Resetting signs the account out on every device and sends a "password changed" notice. |
| **Email confirmation** | New password accounts get a confirmation link (48 hours) and a banner until it's used. Sending mentorship requests and submitting alumni verification wait for it (`REQUIRE_EMAIL_VERIFICATION`, on by default). Google sign-ins count as confirmed. |
| **Two-factor sign-in** | Settings → Security: scan a QR code with any authenticator app (Google Authenticator, Microsoft Authenticator, 1Password…), confirm a code, save 10 one-time recovery codes. Sign-in then asks for a code after the password, and after Google too. A code can't be reused, and 5 wrong codes pause it for 15 minutes and email the user. Keys are encrypted at rest (AES-256-GCM with `DATA_ENCRYPTION_KEY`). The QR code is drawn by our own server, so the setup link never goes to a third party. |
| **Required for staff** | With `REQUIRE_STAFF_2FA` (on by default in production), admin, Alumni Relations and Placement accounts see a setup screen until two-factor sign-in is on, and the API refuses their other requests (`403 mfa_setup_required`). |
| **Sign out everywhere** | Sessions carry a version number. Password reset or change and turning two-factor on or off bump it, which ends every other session at once. |
| **Document storage** | Verification uploads are checked by their content (real PDF, PNG, JPEG or WEBP only, 5 MB each), then stored privately: on disk (`STORAGE_DRIVER=local`) or in an S3-compatible bucket (`STORAGE_DRIVER=s3`: AWS S3, Cloudflare R2, MinIO). The bucket stays private. Files are streamed to staff through the API, which checks the role and writes an audit entry on every view. |
| **First admin** | Production never loads demo data. `npm run bootstrap -w apps/api -- --admin-email you@college.edu --admin-name "Your Name"` creates the settings, the expertise-tag list and the first administrator, and emails them a link to choose a password (it also prints the link). |

Demo accounts are already email-confirmed and have two-factor sign-in off, so the demo logins in §2 work as before. In development, staff two-factor sign-in is not required unless you set `REQUIRE_STAFF_2FA=true`.

## 5. Architecture

```
apps/
  api/   Express + TypeScript + Mongoose + Socket.IO + node-cron      (port 4000)
    src/
      config/env.ts        all configuration
      models/              16 spec entities + User, Notification, AuditLog, Settings, InstitutionRecord, …
      serializers/         ★ PRIVACY LAYER: the only place documents become API output (allow-lists)
      middleware/          auth (JWT cookie / Bearer), leakGuard (response privacy scan), errors
      services/            matching, requests (throttle/expiry/accept), capacity, sessions, calendar,
                           engagement, analytics, verification, notify, channels (email/SMS)
      routes/              REST endpoints (see docs/API.md)
      jobs/                cron schedule (expiry 10 min, reminders 5 min, action items hourly, decay weekly)
      socket.ts            real-time messages + notifications (privacy-checked emits)
      seed/                demo / UAT data
    tests/                 vitest + supertest + in-memory MongoDB
  web/   Next.js 15 (App Router) + React 19 + Tailwind                (port 3000)
    src/app/               public pages, (app)/ authenticated pages per role
    src/components/        UI kit, app shell, mentor card
docs/    PRIVACY.md (field-by-field statement), API.md
```

**Key design decisions**

| Concern | Decision |
|---------|----------|
| Capacity under concurrency | One `MentorCapacity` document per mentor, and `findOneAndUpdate({activeCount < maxMentees, not paused}, {$inc: 1})`. MongoDB applies the filter and the increment atomically, so N simultaneous accepts can never exceed the limit (spec §8, Track J). Each later step rolls the slot back if it fails. |
| Throttling | Student: max pending, max per rolling period, cooldown after a decline, max active mentorships. Mentor: max open requests in their inbox. All limits live in the DB and admins edit them in the UI. A post-insert re-check keeps the limits under concurrent requests. |
| Expiry | `expiresAt` per request. A sweep every 10 minutes **plus** a check at accept time, so an expired-but-unswept request can never be accepted. Jobs take an injectable clock for tests. |
| Privacy | `select:false` on contact fields → allow-list serializers → `leakGuard` scan of every response and socket emit → exhaustive tests. Free text is masked before storage. Calendar events carry no attendee list. |
| Matching | Computed on demand. Weighted score over expertise overlap, target-role similarity, industry, mentoring areas, department, availability and **load balance** (spreads students across mentors). Every result carries plain-language reasons. Admins tune the weights. |
| Messaging | Socket.IO with rooms per mentorship, plus a polling fallback in the UI if websockets are blocked. |
| Auth | JWT in an httpOnly SameSite=Lax cookie. The web app proxies `/api` so it is same-origin. bcrypt password hashes; the auth endpoints are rate-limited. |

## 6. Feature map (spec → code)

| Module | Where |
|--------|-------|
| M1 Verification & profile | `services/verification.ts`, `routes/alumni.ts`, web `mentor/profile`, `admin/verification`, `admin/records` |
| M2 Capacity & availability | `services/capacity.ts`, `routes/mentors.ts` (`/me/capacity`, `/me/pause`, `/me/availability`), web `mentor/availability`, `admin/capacity` |
| M3 Student career profile | `routes/students.ts`, web `student/profile` |
| M4 Matching | `services/matching.ts`, `GET /api/mentors/search`, web `mentors` |
| M5 Requests | `services/requests.ts`, `routes/requests.ts`, web `mentor` (inbox), `student` |
| M6 Scheduling & sessions | `services/sessions.ts`, `services/calendar.ts`, web `mentorships/[id]` → Sessions |
| M7 Goals, actions, feedback | `routes/mentorships.ts`, web `mentorships/[id]` → Goals / Feedback |
| M8 Engagement | `services/engagement.ts`, weekly job, web `admin/engagement` |
| M9 Messaging | `routes/messages.ts`, `socket.ts`, `lib/mask.ts`, web `mentorships/[id]` → Messages |
| M10 Analytics | `services/analytics.ts`, `routes/analytics.ts`, web `analytics`, `admin/mentors` |
| Notifications | `services/notify.ts` (in-app + socket + email + SMS), web `notifications` |
| Admin dashboard | web `admin/*` |
| Privacy statement | `docs/PRIVACY.md`, web `/privacy` |

## 7. Testing

```bash
npm test
```

The suite has 86 tests in 8 files. Each file runs against its own throw-away in-memory MongoDB. CI (`.github/workflows/ci.yml`) runs the type checks, these tests and both production builds on every push and pull request.

| Spec requirement | Test file | What it proves |
|------------------|-----------|----------------|
| Alumni contact data never in any student-accessible response | `tests/privacy.test.ts` | Loads the full seed. **Enumerates every route from the Express router** and calls every route (GET and non-GET) as a student with real ids. It asserts that every path parameter was filled, every GET returns an expected status (200/403, never a 404 from a bad id), and the student data endpoints really return data. It also calls every GET as a mentor (symmetric privacy), runs full flows (request, withdraw, propose, book, complete, cancel, end), pages through matching for all 60 mentors with every facet, opens every mentor profile, and listens to Socket.IO. Every payload is searched for every alumni email, phone (by digits) and LinkedIn URL. |
| Capacity cannot be exceeded under concurrency | `tests/capacity.test.ts` | 10 rounds of 8 simultaneous accepts (service layer), 10 parallel HTTP accepts, the same request accepted 5× at once, pause, end-then-reaccept, lowering the limit. |
| Throttling enforced and configurable | `tests/throttle.test.ts` | Pending limit, period limit, admin-configured limits, role restriction, 8 concurrent requests, duplicate, cooldown, mentor inbox limit (also concurrent). |
| Expiry job correct | `tests/expiry.test.ts` | Boundary at exactly `expiresAt`, only pending requests touched, idempotent, 3 concurrent sweeps, configurable expiry days, accept-after-expiry refused. |
| Google sign-in | `tests/google.test.ts` | New account, linking an existing account, unverified email rejected, forged state/nonce rejected, wrong audience rejected, suspended accounts blocked, open-redirect-safe `next`. With two-factor on, Google alone gives no session: the redirect asks for a code, which completes with only the challenge cookie. Linking Google to an address that was registered but never confirmed removes the earlier password and ends its sessions (protects against someone pre-registering another person's email); confirmed accounts keep their password. |
| Password reset, email confirmation, two-factor sign-in, first admin | `tests/account.test.ts` | RFC 6238 test vectors; reset links are one-time, expire and are only stored hashed; reset signs out every session; unknown emails get the same answer; confirmation gate on requests; two-factor sign-in needs a fresh code (replays refused), recovery codes work once, 5 wrong codes lock it, the challenge can't be used as a session; staff gate; bootstrap is safe to re-run and its invite link works. |
| Document storage, upload checks, production config | `tests/storage.test.ts` | Files are identified by content (an HTML file named `.pdf` is refused); local storage refuses paths outside its folder and never overwrites; S3 writes are private with server-side encryption; staff-only streaming with `no-store`; oversized uploads give a clear 400; unsafe production settings are refused and a complete set is accepted. |
| Matching, verification, engagement, sessions, analytics | `tests/domain.test.ts` | Ranking + reasons + capacity filter, weight changes, record matching + audit trail, decay → nudge → cooldown → recovery, propose/book/ICS/complete, mentor double-booking prevented, private notes hidden, role access. |

## 8. Deployment

### Docker Compose (MongoDB + API + worker + web)

```bash
docker compose up --build
```

This is a production setup: put the values it asks for (`JWT_SECRET`, `DATA_ENCRYPTION_KEY`, `WEB_ORIGIN`, `PUBLIC_API_URL`, `SMTP_URL`, `MAIL_FROM`) in an `.env` next to `docker-compose.yml`, and serve it behind HTTPS. For a local trial use `npm run dev` instead. The worker container runs the background jobs, and the API runs with `JOBS_IN_PROCESS=false`. Then create the first admin: `docker compose exec api node apps/api/dist/seed/bootstrap.js --admin-email you@college.edu`.

### Manual / PaaS

- **API:** run `npm run build -w apps/api`, then `node apps/api/dist/index.js`. It needs `MONGODB_URI`, `JWT_SECRET`, `WEB_ORIGIN`, `PUBLIC_API_URL` and `COOKIE_SECURE=true`.
- **Worker:** run `node apps/api/dist/worker.js` as a single instance with the same env, and set `JOBS_IN_PROCESS=false` on the API.
- **Web:** run `npm run build -w apps/web`, then `npm run start -w apps/web`, with `API_URL` (server-side proxy target) and `NEXT_PUBLIC_SOCKET_URL`.
- **Scaling Socket.IO** across several API instances needs the Socket.IO Redis adapter (spec §16: "messaging server separate if Socket.IO is used at scale"). A single API instance needs nothing extra.
- Put the API and web behind one domain with HTTPS (e.g. `app.example.edu` → web, `/api` and `/socket.io` → API) so cookies stay first-party.

### Go-live checklist

1. **Database:** a MongoDB Atlas cluster (the Mumbai region suits Indian institutions) with backups on. Set `MONGODB_URI`.
2. **Secrets:** `JWT_SECRET` (`openssl rand -base64 48`) and `DATA_ENCRYPTION_KEY` (`openssl rand -base64 32`), kept in your host's secret manager. Losing `DATA_ENCRYPTION_KEY` means everyone has to set up two-factor sign-in again.
3. **Email:** a transactional provider (Amazon SES, Postmark, Resend…) with SPF, DKIM and DMARC records on your domain. Set `SMTP_URL` and `MAIL_FROM`.
4. **Documents:** a **private** bucket (Cloudflare R2 or AWS S3, public access blocked) and a key limited to that bucket. Set `STORAGE_DRIVER=s3` and the `S3_*` values.
5. **Hosting:** the API on a server that stays running (Render, Railway, Fly.io, AWS…), because Socket.IO and the scheduled jobs need it, plus the web app (Vercel or the same host). HTTPS on one domain, with `COOKIE_SECURE=true`.
6. **Start it:** the API checks its settings and lists anything missing. Run the bootstrap command to create the first admin, sign in, turn on two-factor sign-in, and import the alumni register (Admin → Records).
7. **Staging first:** run a separate copy (its own database and bucket) to try changes before they reach real users.


## UI design system & credits

**Direction — "calm depth".** Marketing and sign-in screens are expressive: a midnight canvas, one 3D focal point (the live Three.js globe) and kinetic type. The product itself is calm and fast to scan: a light canvas, crisp surfaces, Geist for the interface and Instrument Serif italic only as an editorial accent. Motion is used where it explains a change of state: entrances, selection, success feedback and progress. Every animation respects the OS "reduce motion" setting.

**UX upgrades**
- Grouped, collapsible sidebar with icons, plus a mobile bottom tab bar and a "More" sheet.
- **⌘K / Ctrl+K command palette.** Jump to any page, or live-search mentors by name, role or company.
- **Student home** built around one adaptive "next best step": finish your profile, find a mentor, book a session or join one. It also shows a profile-strength ring that drives match quality.
- **Mentor inbox** as a keyboard master–detail view: ↑↓ to browse, **A** to accept, **D** to decline, with one-click guilt-free decline and "decline all" when full.
- **Alumni verification** as a 4-step wizard (Identity → Programme → Document → Review).
- **Discovery:** a sticky search bar, removable filter chips, a capacity toggle, skeleton loading and a "Top match" highlight.

**Brand mark.** The "network A" (`apps/web/src/components/Logo.tsx`). Its apex is a mentor node set apart by a small gap, and its crossbar is an arc, the same arcs that link cities on the globe. It comes as a gradient tile (`<LogoMark />`), a single-colour glyph (`variant="glyph"`) and a lockup with the wordmark (`<Logo />`). The same geometry is the favicon (`apps/web/src/app/icon.svg`), and an animated version is the page loader. Each instance gets unique SVG ids, so hidden and visible copies never clash.

**Hero globe.** A dotted Earth. The land comes from Natural Earth 1:110m (public domain, via the `world-atlas` package), sampled into evenly spaced rows and packed into a ~5 KB bit mask in `apps/web/src/components/three/landDots.ts`. Teal nodes mark alumni cities, violet nodes mark campus cities, and light travels along the arcs between them. The cities and links are illustrative static copy in `globeData.ts`, not user data. To change the map density, edit `STEP` in `apps/web/scripts/generate-land-dots.mjs` and run `node apps/web/scripts/generate-land-dots.mjs`. The globe can be dragged, stops rendering when scrolled off-screen, and draws a single static frame under "reduce motion".

**React Bits.** Several components come from [React Bits](https://reactbits.dev) by David Haz ([GitHub](https://github.com/DavidHDev/react-bits)), used under its MIT + Commons Clause licence (copy in `apps/web/src/components/reactbits/LICENSE.md`). They were adapted to this codebase: Framer Motion imports, Lucide icons and Tailwind 3 syntax.

| Component | Where it's used |
|---|---|
| SpotlightCard | Mentor cards, stat tiles, the landing-page product bento |
| AnimatedList | Mentor request inbox (keyboard-navigable list) |
| Stepper | Alumni verification wizard |
| ClickSpark | Accept-request confirmation burst |
| BlurText | Landing headline (kept as a semantic `<h1>`) |
| RotatingText | Landing "Grow your career / confidence / network / first offer" |
| ShinyText | Landing eyebrow, sign-in tagline, "Top match" badge, student next-step label |
| StarBorder | Landing primary calls to action |
| LogoLoop | Landing "Our alumni mentor from teams like…" band (static copy, no data endpoint) |

## 9. Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | API (with embedded DB + jobs) and web, with hot reload |
| `npm run dev:api` / `npm run dev:web` | One side only |
| `npm run seed` | **Resets** the database and loads demo data (development only) |
| `npm run bootstrap -w apps/api -- --admin-email …` | First-run setup for a real database: settings, tags, first admin (sends an invite link) |
| `npm test` | API test suite |
| `npm run typecheck` | TypeScript, both apps |
| `npm run build` | Production builds |

## 10. Known limitations / not yet verified

Stated plainly so nothing is assumed to work that hasn't been exercised:

- **Google Calendar, Outlook, Twilio and SMTP** are implemented (OAuth code flow, token refresh, event create/delete, SMS and email send) but were **not tested against the live services**, because no credentials were available. The local fallbacks (.ics, Jitsi, outbox files) are tested and work.
- **Google sign-in** is implemented and covered by tests with Google's endpoints mocked, but was **not tried against real Google** (no OAuth client was available).
- **Institution SSO** (SAML or another identity provider beyond Google) and **LinkedIn profile prefill** — both listed as optional in spec §12 — are **not implemented**. Login is email + password.
- **ERP integration** is CSV import plus an import endpoint. There is no live connector to a specific ERP product.
- **AI/ML extensions** (embedding-based semantic matching, lapse prediction) are not implemented. The matching engine's interface is designed so a semantic score can be added as another weighted component.
- Socket.IO runs on a single API instance. Horizontal scaling needs the Redis adapter.
- **Docker:** `docker-compose.yml` and both Dockerfiles were written but **not built or run** (Docker Desktop was not running on the development machine). Note that the web image bakes `API_URL` (rewrite target) and `NEXT_PUBLIC_SOCKET_URL` in at **build** time, so pass them as build args when they differ from the defaults.
- Reminder times in notifications are formatted in UTC. The web UI shows local times.
- **Two-factor lockout:** someone who loses both their phone and their recovery codes cannot get back in by themselves, and there is no admin "reset two-factor" button yet. Until there is, an operator can switch it off in the database (`mfaEnabled: false` on the user, and remove the `mfa*` fields).
- **S3 / R2 storage** is covered by tests with a stand-in client, but was **not tried against a real bucket** (no credentials were available). The local disk driver is tested end to end.
- **CI workflow** (`.github/workflows/ci.yml`) runs the same commands that pass locally, but it has **not run on GitHub yet**: the project has no GitHub repository so far.
- **Staging deployment and a hosted database** need your accounts (hosting, MongoDB Atlas, email provider, bucket), so they are documented in the go-live checklist but not set up.
