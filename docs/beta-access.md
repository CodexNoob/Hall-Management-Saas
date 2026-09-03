# Beta access approval

Event Core is in private beta. Registering for an owner account no longer
creates an organization: it creates a **request**, and nothing is provisioned
until somebody approves it.

This is the operating manual for that queue.

## What changed

Before, completing registration provisioned an organization, an owner
membership, the starter roles and a 14-day free trial on the applicant's first
sign-in. That still happens — but only once their request says `APPROVED`.

```
register ──▶ beta_access_requests row (PENDING) ──▶ BETA_APPROVAL_EMAIL notified
                                │
                       npm run beta:approve
                                │
                                ▼
  first sign-in ──▶ organization + owner membership + trial   (unchanged)
```

## Where the gate is

`provisionOwner()` in `lib/auth/provisioning.ts`, and nowhere else.

That function is the only code in the application that may create an
organization from nothing, and every other surface needs a `users` row that only
it writes. One refusal there closes every door at once:

| Route in | What happens |
| --- | --- |
| Email confirmation link | lands on `/dashboard/new`; the layout syncs the session and gets a 403 |
| Email/password login | the login card syncs the session and gets a 403 |
| Google OAuth | callback → `/dashboard` → same sync, same 403 |
| A typed or bookmarked dashboard URL | same layout gate |
| A direct protected API request | no `users` row, so `resolveUserActor` answers "User account is not provisioned" |

The 403 carries a code — `beta_access_pending` or `beta_access_rejected` — and
both the dashboard layout and the login card route those to **`/beta-pending`**
rather than to a sign-in form with a red message on it. The applicant typed the
right password; there is nothing on that form for them to correct.

The Supabase session is ended first. Leaving it alive would strand them:
`proxy.ts` will not let a signed-in browser back to `/login`.

## Approving somebody

There is deliberately **no approval endpoint and no admin screen**.

There is no platform-level administration area in this codebase to put one in.
Every role lives in `principal_roles` and carries an `organizationId`, and a
beta applicant belongs to no organization — so no existing permission could
guard an approval UI, and building one would mean inventing a cross-tenant
superuser, a permanent new privilege axis far larger than this feature. Approval
therefore runs against `DATABASE_URL`, which means the people who can approve
are exactly those who already hold production database credentials.

```bash
# See the queue
npm run beta:list
npm run beta:list -- --status=PENDING

# Let somebody in
npm run beta:approve -- someone@example.com --by="Your Name"

# Turn somebody down
npm run beta:reject -- someone@example.com --by="Your Name" --notes="not a venue"
```

The `--` matters: without it npm swallows the address.

The address must already have registered. The script refuses to invent a request
for one that has not, so approving a misspelled address fails loudly rather than
looking like it worked.

Approving creates nothing. It flips one column; the organization, owner
membership, roles and trial are still built by the existing sign-in path the
first time the approved person signs in.

### Doing it in SQL instead

From the Supabase SQL editor:

```sql
UPDATE beta_access_requests
   SET status = 'APPROVED', decided_at = NOW(), decided_by = 'your name'
 WHERE email = lower('someone@example.com');
```

`status` is constrained to `PENDING`, `APPROVED` or `REJECTED`, so a typo is
refused by the database rather than silently locking the applicant out — the
gate reads anything that is not `APPROVED` as a refusal.

## Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `BETA_APPROVAL_EMAIL` | for notifications | Where "New Event Core beta-access request" is sent. Read from the environment, never hardcoded. |
| `BREVO_API_KEY` | for notifications | Brevo transactional-email API key used by the application; this is separate from the SMTP key stored by Supabase. |
| `SUPPORT_EMAIL_FROM` | for notifications | A sender address verified in Brevo, optionally formatted as `Event Core <no-reply@example.com>`. |
| `BETA_ACCESS_AUTO_APPROVE_EMAILS` | no | Comma-separated addresses approved the moment they register |

With no recipient configured the queue still works — the request is recorded,
the send is skipped, and a `beta_access_notification_skipped_no_recipient`
warning is logged.

Nothing is ever lost to a mail failure: the row commits first, the send happens
afterwards and outside any transaction, and `notified_at` is stamped only if the
mail actually went. A delivery failure is logged through the structured logger
as `beta_access_notification_failed` and never surfaces to the applicant as
approval.

`BETA_ACCESS_AUTO_APPROVE_EMAILS` should be empty in production. Every entry is
somebody who can create an organization with no review. It is deliberately a
different list from `TESTER_BYPASS_EMAILS` in `lib/subscription/trial.ts`, which
waives payment: not paying and being allowed to create a tenant are different
powers, and one list holding both means granting either grants the other by
accident.

## What is not affected

**Staff invitations.** `POST /api/staff` writes the invitee's `users` row at
invite time, so their first sign-in matches an existing user and runs
`reconcile()` — `provisionOwner`, and therefore the gate, is never reached. An
invited employee is never queued and never refused.
`tests/unit/auth-session-route.test.ts` pins this.

**Tenant isolation, authorization, email verification, rate limiting and request
logging.** Nothing here touches `authorize()`, `tenant()`, `scoped()` or any
privilege table; the gate runs strictly before a principal exists. Supabase
still sends and verifies the confirmation email exactly as before. The new
endpoint goes through `withRoute` and `enforceRateLimit` like every other.

## Duplicate handling

A request is found by **either** of two unique keys:

- `email`, normalized to lower case — catches somebody registering twice, and is
  the only key the public form can use, since it runs before Supabase has issued
  a session.
- `supabase_auth_id` — catches the same authenticated identity arriving by
  another route, which is what makes the Google path safe.

The first authenticated identity to appear claims an unclaimed row. Re-
registering returns the existing request, does not open a second one, and does
not re-send the notification.

## The public endpoint

`POST /api/beta-access/requests` is called by the sign-up form between
`supabase.auth.signUp` and email confirmation, when there is no session to
authorize with. It is rate-limited (5 per 10 minutes), honeypotted, and answers
`202 {"status":"received"}` for **every** address — new, pending, rejected, or
an established account — so it cannot be used to ask whether somebody has an
Event Core account.

It can only ever create a `PENDING` row. **The only writer of `APPROVED` is the
approval script.** Nothing reachable over HTTP can raise a request's status.

Anyone can therefore post an address and cause one pending row and one email.
That row grants nothing, and the exposure is the same one the public contact
form already carries.

## Ending the beta

When Event Core opens to the public, delete the gate block in `provisionOwner`
(one clearly-marked `if`), and leave the table: it is the record of who was
admitted and when. The public endpoint and `/beta-pending` go with the block,
and the sign-up form goes back to routing at `/verify-email`.
