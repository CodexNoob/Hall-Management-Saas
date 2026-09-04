# Beta access approval

Event Core is in private beta. Registering for an owner account no longer
creates an organization: it creates a **request**, and nothing is provisioned
until somebody approves it.

This is the operating manual for that queue.

## What changed

Before, completing registration provisioned an organization, an owner
membership, the starter roles and a 14-day free trial on the applicant's first
sign-in. That still happens — but only once their request says `APPROVED`.

Registering and confirming the address are untouched. The request is opened at
the end of them, not the start:

```
register ──▶ /verify-email        nothing recorded, nobody mailed
                  │
          confirm the address     (Supabase, exactly as before)
                  │
                  ▼
  beta_access_requests row (PENDING) ──▶ BETA_APPROVAL_EMAIL notified
                  │                      applicant lands on /beta-pending
         npm run beta:approve
                  │
                  ▼
  next sign-in ──▶ organization + owner membership + trial   (unchanged)
```

**Only a confirmed address is ever queued.** Recording happens in
`provisionOwner`, which cannot run without a session, and a session only exists
once the confirmation link has been opened — or once Google, which verifies the
address itself, has returned one. Somebody who types an address and abandons it
reaches neither the queue nor the approval inbox.

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
still sends and verifies the confirmation email exactly as before, and
registering still ends at `/verify-email`.

## Duplicate handling

A request is found by **either** of two unique keys:

- `supabase_auth_id` — the identity that confirmed. Set at creation now that
  recording needs a session, and it is what matches somebody arriving by another
  route, which is what makes the Google path safe.
- `email`, normalized to lower case — catches the same person on a *different*
  identity: an account deleted and re-created, or the same address registered
  again after a rejection.

Identity is checked first, then address — the same precedence
`findUserForProfile` uses. Re-registering returns the existing request, does not
open a second one, and does not re-send the notification. Since the gate runs on
every refused sign-in attempt, this is also what stops somebody generating a
mail per retry.

## There is no public endpoint

There was one: `POST /api/beta-access/requests`, called by the sign-up form
between `supabase.auth.signUp` and email confirmation. It has been removed.

Recording before the address was confirmed meant anyone could post any address
and cause a pending row and a mail to `BETA_APPROVAL_EMAIL`, and it put
unconfirmed registrations in a queue whose whole purpose is to be read by a
human. `provisionOwner` records instead, so **nothing reachable over HTTP writes
to `beta_access_requests` at all** — and the only writer of `APPROVED` is still
the approval script.

## Ending the beta

When Event Core opens to the public, delete the two `throw`s in the gate block
in `provisionOwner` (one clearly-marked `if`), and leave the table: it is the
record of who was admitted and when. `/beta-pending` goes with them.

The sign-up form needs no change at all — it already ends at `/verify-email`,
which is where it ended before the beta. Whether to keep recording requests
after that is a free choice: `recordAndNotifyBetaAccessRequest` is what tells
you somebody new arrived, and it is useful with or without a gate in front of
it.
