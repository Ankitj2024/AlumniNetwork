# Privacy statement — what students can see

**Audience:** the Alumni Relations Office. You do not need to read code to check this document.
**Status:** enforced by automated tests (`apps/api/tests/privacy.test.ts`) that call **every** API endpoint as a student and fail if any alumni email address, phone number or LinkedIn URL appears in any response or real-time message.

---

## 1. Alumni information a student can see

A student sees an alumnus only after the alumnus is **verified** against institutional records and has opted in to mentoring.

| # | Field | Where it comes from | Notes |
|---|-------|--------------------|-------|
| 1 | Name | Registration | Full name |
| 2 | Verified badge | Verification workflow | Yes/no only |
| 3 | Headline | Alumnus | e.g. "Senior Data Scientist at Quantia AI" |
| 4 | Current role | Alumnus | |
| 5 | Current company | Alumnus | |
| 6 | Industry | Alumnus | |
| 7 | Years of experience | Alumnus | |
| 8 | City | Alumnus | City only — never an address |
| 9 | Department | Institutional record | |
| 10 | Degree | Institutional record | |
| 11 | Graduation year | Institutional record | |
| 12 | Bio | Alumnus | Free text written by the alumnus |
| 13 | Expertise tags | Alumnus | e.g. Python, Product Management |
| 14 | Mentoring areas | Alumnus | e.g. Interview preparation |
| 15 | Languages | Alumnus | |
| 16 | Capacity | Alumnus settings | Number of mentee slots, how many are used, paused yes/no and until when |
| 17 | Weekly availability | Alumnus settings | Day of week + time range + time zone only |
| 18 | Match score and reasons | Computed | Built only from fields 3–17 and the student's own profile |
| 19 | Session fee | Alumnus settings | Price per session in rupees (0 = free), capped by the programme |

Inside a mentorship the student is part of, they additionally see: messages, proposed/confirmed session times, the per-session video-call link, the **shared** session summary, goals, action items, and feedback given in that mentorship.

### Payments

- **Card numbers and CVVs never reach the platform.** Students type them into the payment gateway's own checkout (Razorpay). The platform keeps only the gateway's token, the card network, the last four digits, the expiry and the name on the card, and the API refuses any request that contains a card number.
- A **student** sees their own payments: amount, receipt number, how they paid (e.g. "Visa •••• 4242" or a masked UPI id like "aa***@okhdfc"), and any refund.
- A **mentor** sees payments for their sessions: the student's name, the amount, the platform fee and their share. They never see how the student paid.
- **Admin and Alumni Relations** see all payments, for refunds and disputes. Gateway ids and tokens are never sent to any browser.

## 2. Alumni information a student can NEVER see

- Email address
- Phone number
- LinkedIn or any other social-media URL
- Date of birth, roll / enrolment number
- Verification documents and verification history
- The mentor's **private** session notes
- How the mentor responded to other students (declines, reasons)
- Calendar account details or tokens

This applies everywhere: search and matching results, mentor profile pages, requests, mentorship pages, notifications, emails, calendar files, and real-time (Socket.IO) events.

## 3. Contact details typed into free text

If anyone types an email address (including forms like `name [at] domain [dot] com`), a phone number, or a LinkedIn/WhatsApp/Telegram/Instagram/Facebook/X link into a **message, request note, session agenda or summary, feedback comment, decline note, student bio, or the alumnus's own headline, role, company, city or bio**, it is replaced with `[contact hidden]` **before it is saved**. The original text is never stored, so it cannot leak later.

## 4. Calendar invitations

- When a session is synced to Google Calendar or Outlook, a separate event is created **in each person's own calendar with no attendee list**, so neither side's email address is shared.
- Downloadable `.ics` files contain no organiser or attendee email addresses.

## 5. Symmetric protection

Mentors cannot see a student's email address or phone number either. A mentor sees the student's name, programme, department, graduation year, bio, interests, target roles and industries, help wanted, and career goals the student chose to share.

## 6. Who can see contact details

| Role | Alumni email / phone / LinkedIn |
|------|-------------------------------|
| Student | **Never** |
| Alumnus (other alumni) | **Never** |
| Alumni Relations Officer | Yes — for verification and programme administration |
| Administrator | Yes |
| Placement Officer | No — aggregate analytics only |

Every time staff open a verification document, it is recorded in the audit log.

**How documents are stored:** uploaded verification documents are checked by their content (only real PDF, PNG, JPEG or WEBP files are accepted) and kept in private storage: a private cloud bucket in production, or the server's disk. They are never public and never linked directly. Staff open them through the platform, which checks their role and records the view.

**Staff accounts:** because staff can see contact details and identity documents, production deployments require staff to sign in with two-factor authentication (an authenticator app).

**Mentorship content:** Alumni Relations Officers and Administrators can open any mentorship in read-only mode, including its messages, sessions, goals and feedback, to support engagement monitoring and safeguarding. Placement Officers cannot. Participants should be told this in the programme's terms of use.

## 7. How this is enforced (for technical reviewers)

1. **Storage:** `email`, `phone` and `linkedinUrl` are marked `select: false` in the database schema, so they are not loaded unless code explicitly asks for them.
2. **One serializer:** every API response and socket event is built by `apps/api/src/serializers/index.ts`, which uses explicit allow-lists. A field reaches a client only if it is named there. Every piece of free text shown to another person (names, bios, titles, goals, messages, notes, notifications) is also passed through contact-detail masking at this layer, on top of masking before storage.
3. **Response guard:** `leakGuard` middleware scans every JSON response and blocks it (HTTP 500, logged as `PRIVACY VIOLATION BLOCKED`) if a contact field would reach someone not entitled to it. Socket emits pass the same check.
4. **Exhaustive tests:** the privacy test suite enumerates the route table programmatically, calls every endpoint (GET and non-GET) as a student with real ids, asserts every expected status, runs full request/session/mentorship flows, pages through matching results for all 60 seeded mentors with every facet, opens every mentor profile, listens to socket events, and searches every response for every alumni email, phone (by digits) and LinkedIn URL.

*Keep this document in sync with `mentorPublic()` in `apps/api/src/serializers/index.ts`.*
