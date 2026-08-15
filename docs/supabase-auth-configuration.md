# Supabase auth configuration

Everything in this document lives in the Supabase dashboard, not in this
repository. It is not versioned, not covered by tests, and **not revertible with
`git revert`** — if it is wrong, the only record of what it used to be is this
file. Keep it current.

Project ref: **`lrxppdlbhymbsgehspwx`** · GoTrue v2.195.0 (supports
`token_hash`; no upgrade required).

Verify the ref in your dashboard URL before editing anything. An earlier
revision of this file named `nychjjjixbaniwftblyx`, which is a **different**
project - it was the ref cached in `supabase/.temp/` by an old `supabase link`,
not the one the application authenticates against. The runtime project is the
one in `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`, and `supabase/.temp/` has
since been deleted so nothing points at the stale one any more.

Verify the live values rather than trusting this file:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/health" -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

That one project is shared by local development, Vercel previews and
production.

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

## 7. Verifying the cutover

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
