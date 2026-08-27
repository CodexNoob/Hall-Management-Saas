# Supabase auth configuration

Everything in this document lives in the Supabase dashboard, not in this
repository. It is not versioned, not covered by tests, and **not revertible with
`git revert`** — if it is wrong, the only record of what it used to be is this
file. Keep it current.

GoTrue v2.195.0 (supports `token_hash`; no upgrade required).

## There are TWO projects. Every setting below has to be applied to both.

| Environment                      | Project ref              | Where the ref comes from        |
| -------------------------------- | ------------------------ | ------------------------------- |
| **Production** (Vercel)          | `embeuhifhylbychgivkp`   | Vercel environment variables    |
| **Local development**            | `lrxppdlbhymbsgehspwx`   | `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` |

An earlier revision of this file said "that one project is shared by local
development, Vercel previews and production," named only `lrxppdlbhymbsgehspwx`,
and was **wrong**. Local dev has not talked to the production project for as
long as `.env.local` has existed: Next.js loads `.env.local` ahead of `.env`, and
the two files name different refs. `.env` names the production one, so anything
that reads `.env` alone looks correct and still is not what `next dev` used.

The consequence is the trap this whole file exists to prevent, one level up:
**a dashboard change verified locally proves nothing about production.** Email
templates, the redirect allowlist, SMTP and rate limits are per-project. Paste
every one of them into both dashboards, or write down deliberately why not.

This is the second time a stale ref has been recorded here - an even earlier
revision named `nychjjjixbaniwftblyx`, cached in `supabase/.temp/` by an old
`supabase link`. Verify the live values rather than trusting this file:

```bash
# local
curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/settings" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
# production - read the ref off the deployed bundle, not off any file in this repo
```

The two databases have already diverged: `GET /rest/v1/organizations` answers on
`embeuhifhylbychgivkp` and returns `42501 permission denied for schema public` on
`lrxppdlbhymbsgehspwx`, which has had its public-schema grants revoked.

---

## 1. Before you change anything: record the current state

Open **Authentication → Email Templates** and paste each template's current HTML
into the block below. Do this **before** editing. Screenshots are not
restorable; this is the rollback.

```html
<!-- Confirm signup — CURRENT (paste before editing, date it) -->
<h2>Confirm your email address</h2>

<p>
  Follow the link below to confirm this email address and finish signing up.
</p>
<p><a href="{{ .ConfirmationURL }}">Confirm email address</a></p>

<!-- Invite user — CURRENT -->
<h2>You've been invited</h2>

<p>
  You've been invited to create an account. Follow the link below to accept.
</p>
<p><a href="{{ .ConfirmationURL }}">Accept invitation</a></p>

<!-- Magic Link — CURRENT -->
<h2>Your sign-in link</h2>

<p>
  Follow the link below to sign in. This link expires shortly and can only be
  used once.
</p>
<p><a href="{{ .ConfirmationURL }}">Sign in</a></p>

<!-- Change Email Address — CURRENT -->
<h2>Confirm your new email address</h2>

<p>
  Follow the link below to confirm {{ .NewEmail }} as your new email address.
</p>
<p><a href="{{ .ConfirmationURL }}">Confirm new email address</a></p>

<p>If you didn't request this change, you can safely ignore this email.</p>

<!-- Reset Password — CURRENT -->
<h2>Reset your password</h2>

<p>
  We received a request to reset your password. Follow the link below to choose
  a new one.
</p>
<p><a href="{{ .ConfirmationURL }}">Reset password</a></p>

<p>If you didn't request this, you can safely ignore this email.</p>
```

---

## 2. Target email templates

Every template moves from `{{ .ConfirmationURL }}` to a link the app owns:

| Template             | `type`         |
| -------------------- | -------------- |
| Confirm signup       | `signup`       |
| Invite user          | `invite`       |
| Magic Link           | `magiclink`    |
| Change Email Address | `email_change` |
| Reset Password       | `recovery`     |

```html
<a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=signup">
  Confirm your email
</a>
```

Branded, email-client-safe bodies for all six dashboard templates are kept in
[docs/email-templates/](./email-templates/) — paste one whole into the matching
Message body field. Each file's header comment records why its link is shaped
the way it is; read it before editing.

| Dashboard template   | File                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| Confirm sign up      | [confirm-signup.html](./email-templates/confirm-signup.html)            |
| Invite user          | [invite-user.html](./email-templates/invite-user.html)                  |
| Magic link or OTP    | [magic-link.html](./email-templates/magic-link.html)                    |
| Change email address | [change-email-address.html](./email-templates/change-email-address.html) |
| Reset password       | [reset-password.html](./email-templates/reset-password.html)            |
| Reauthentication     | [reauthentication.html](./email-templates/reauthentication.html)        |

Two of them are not reachable from the app as it stands, and are here so they
are correct on the day they become reachable rather than being found stale:
**Magic link** (nothing calls `signInWithOtp()`, though `magiclink` is an
accepted callback type) and **Reauthentication** (nothing calls
`reauthenticate()`).

Reauthentication is also the one template with no link at all — it carries a
6-digit `{{ .Token }}` the user types back in. Every other template is
link-only: the app verifies a token hash and has no code-entry screen, so a
`{{ .Token }}` block elsewhere would be a dead end for the recipient.

### Why `{{ .RedirectTo }}` and not `{{ .SiteURL }}`

`.SiteURL` is a single constant for the whole project. With one project serving
local, preview and production, it would point every confirmation and reset email
from every environment at production — a developer could no longer finish a
signup or a password reset locally.

`.RedirectTo` is the `redirectTo` / `emailRedirectTo` the client passed, and it
is validated against the allowlist below, so it is safe as well as correct. All
four producers already pass `window.location.origin`:

- [features/auth/components/signup-card.tsx](../features/auth/components/signup-card.tsx) — signup
- [features/auth/components/verify-email-card.tsx](../features/auth/components/verify-email-card.tsx) — resend
- [features/auth/components/forgot-password-card.tsx](../features/auth/components/forgot-password-card.tsx) — reset
- [features/administration/server/staff-invitations.ts](../features/administration/server/staff-invitations.ts) — invites

### `redirectTo` must never carry a query string

The template appends `?token_hash=…`. A `redirectTo` with a `?` of its own
produces a URL with two of them, and `token_hash` is then parsed as part of
`next` instead — the link fails with `missing_token` and no other symptom.

This is why the producers pass a bare `${origin}/auth/confirm` and
[app/auth/confirm/route.ts](../app/auth/confirm/route.ts) picks the destination
from `type` alone. `tests/unit/signup-card.test.tsx` pins it with
`toMatch(/\/auth\/confirm$/)`. Do not "helpfully" add `?next=` back.

**Never enable `experimental.appendPkceFlowIdToRedirects`** on the Supabase
client. auth-js calls `_maybeAppendFlowIdToRedirect()` on every `emailRedirectTo`
and, when that flag is on, appends `?sb_flow_id=…` to it. `.RedirectTo` would
then already carry a `?`, the template would add a second one, and **every email
link in the product would break at once** with nothing but `missing_token` to go
on. It defaults to off; the whole `{{ .RedirectTo }}?token_hash=` composition
depends on it staying off.

---

## 3. Redirect URL allowlist

**Authentication → URL Configuration → Redirect URLs.** `.RedirectTo` is
validated against this list; anything missing silently falls back to Site URL.

```
https://<production-domain>/**
https://<vercel-preview-wildcard>.vercel.app/**
http://localhost:3000/**
http://127.0.0.1:3000/**
```

`127.0.0.1` is not redundant — it is Playwright's `baseURL` in
`playwright.config.ts`, and it is a different origin from `localhost`.

---

## 4. Cutover order

The order is not a preference. Reversed, every invite, reset and confirmation
mailed during the window resolves to a 404, and those links are single-use —
they cannot be retried.

1. **Deploy the code first.** `/auth/confirm` and `/auth/callback` must be live.
2. **Verify the endpoint answers.** Open `https://<host>/auth/confirm` with no
   parameters. It must redirect to `/auth/auth-error?error_code=missing_token`.
   A 404 means the deploy has not landed — stop here.
3. **Then edit the templates.**
4. **Send one real test email per flow** before telling anyone.

Links already in inboxes are unaffected by the template edit — their bodies are
fixed and point at GoTrue's `/verify`, which redirects back with the token in
the URL fragment.

> **Those old links cannot be salvaged.** `@supabase/ssr` forces
> `flowType: "pkce"`, and auth-js throws `Not a valid PKCE flow url.` for an
> implicit-flow fragment in that mode. They land on `/auth/auth-error`. This is
> accepted because there are no production users; if that ever stops being true,
> re-mail rather than trying to bridge.

---

## 5. Rollback

1. Revert the deploy.
2. Paste the saved template bodies from §1 back into the dashboard.
3. Accept one forced logout.

**Point of no return:** once the new templates are live and links are in
inboxes, roll _forward_ only. A revert makes every link mailed since the cutover
resolve to a route that no longer exists.

---

## 6. Settings this setup depends on

- **Secure email change** (default: on) — an email change needs _both_ addresses
  confirmed. The first confirmation returns `error: null` with **no session**;
  `/auth/confirm` detects that and redirects to
  `/auth/auth-error?error_code=confirmation_pending` rather than bouncing the
  user to login with nothing to explain it. If you turn this off, that branch
  simply stops being reached.
- **Email confirmation** (default: on) — with it off, `signUp` returns a session
  immediately and [signup-card.tsx](../features/auth/components/signup-card.tsx)
  skips `/verify-email` entirely. That is the local-development path.
- **Link TTL** (default: 24h) — an expired or already-spent link both report
  `otp_expired`. Mail-provider link scanners routinely spend a single-use link
  before the recipient clicks it, which is why the copy says "expired or already
  used" and offers a fresh link rather than a retry.

---

## 7. The email sender — custom SMTP is not optional

**Authentication → Emails → SMTP Settings.**

Templates decide what an email *says*. They do not decide whether it is *sent*.
With **Enable Custom SMTP** off, the project falls back to Supabase's shared
built-in sender, which is a testing convenience with two hard limits — neither
of them configurable, both applied before the template is ever rendered:

| Limit                                                   | Consequence                                                                   |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **2 messages per hour, project-wide**                    | The third signup of the hour fails no matter which address it uses.            |
| **Recipients must be members of the Supabase organization** | Every real prospect's address is refused with `email_address_not_authorized`. |

That second one is the fatal one: it means **public signup cannot work at all**
on the built-in sender. A developer testing with their own Supabase account
address sees it succeed and concludes email is fine. It is not — that address is
the only kind that is allowed through.

### Measured state of production, 2026-08-27

**`embeuhifhylbychgivkp`: custom SMTP off, "Rate limit for sending emails" = 2
emails/h.** Read off the dashboard, not inferred. Public signup is therefore
dead there, and has been since the project was created — the two working
registrations in its history (2026-08-25, 2026-08-27 05:43) fit inside a
2-per-hour allowance and prove nothing about capacity.

`GET /auth/v1/admin/users` corroborates it without dashboard access.
`confirmation_sent_at` is the honest signal — set means GoTrue handed the
message to a sender, null means none was attempted. Production shows sends at
05:43, 06:40:28, 06:40:43, 07:10:45 and 07:11:01: **exactly two in the 06:00
hour, exactly two in the 07:00 hour**, then nothing.

Failed signups roll the user row back, so the attempts that hit the cap leave no
trace at all. A quiet gap in that list is the symptom, not an absence of one.

> **The 2 is not editable while custom SMTP is off.** Raising it is step 3
> below and only unlocks after step 2. Reading "2 emails/h" and hunting for a
> way to type 100 into it is the wrong order.

Note also that `tests/e2e/staff-invite.mutation.spec.ts` and
`staff-lifecycle.mutation.spec.ts` invite real addresses through
`inviteUserByEmail`, which spends this same quota. Four `…+e2e-…@gmail.com`
users were created on **production** on 2026-08-27 despite
`playwright.config.ts` loading `.env.local` — most likely `reuseExistingServer`
attaching to a server started with different environment. One e2e run can empty
the hour's allowance for real signups.

The same dead end follows either way, so
[lib/auth/auth-error-messages.ts](../lib/auth/auth-error-messages.ts) keeps three
distinct messages for them. Do not re-merge them: "please wait a minute" is true
only of the per-address cooldown, and is actively misleading for the other two.

### What to configure — on **both** projects, checked one at a time

As of 2026-08-27 production has had none of these three done.

1. Create a sender at a transactional provider and verify the sending domain.
   **Resend** is the path of least resistance here — the app already talks to it
   for support mail ([support-notifications.ts](../features/support/server/support-notifications.ts)),
   so `RESEND_API_KEY` and `SUPPORT_EMAIL_FROM` end up serving both. SendGrid,
   Postmark, Brevo and SES are equally fine; nothing in the app depends on the
   choice.
2. **Authentication → Emails → SMTP Settings → Enable Custom SMTP**, then fill in
   the provider's host, port, username and password. The sender address must be
   on the domain verified in step 1 or the provider will reject every message.
3. **Authentication → Rate Limits → "Emails sent per hour."** Enabling custom
   SMTP raises the project cap from 2 to 30, which is still low for a public
   signup page. Set it to something the launch can absorb. **Enabling SMTP does
   not raise a cap you have already pinned by hand** — check the number even when
   step 2 is visibly done.

Until this is right on the production project, signup is broken there no matter
what local development shows, and no amount of application code can work around
it.

---

## 8. Verifying the cutover

The one that proves `token_hash` is actually in use:

**Send a staff invitation from Chrome, then open the link in a private Firefox
window.** It must reach `/set-password?flow=invite`. This is exactly what fails
under PKCE — the `code_verifier` cookie lives in the browser that _started_ the
flow — so a pass here is the whole point of the migration.

Then:

- Signup → `/dashboard/new`; reset → `/set-password?flow=recovery`; invite →
  `/set-password?flow=invite`.
- Click any link **twice**. The second must land on `/auth/auth-error` with the
  expired-link copy.
- Test the **shareable invite fallback** — the copyable link the staff panel
  shows when invitation mail fails, not the emailed one. It is built in-app from
  `properties.hashed_token`; Supabase's own `action_link` ignores these
  templates entirely, so this path has to be checked separately.
