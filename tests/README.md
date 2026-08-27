# Test suite

## Unit and integration tests

Run:

```powershell
npm.cmd test
```

These tests mock external systems and cover authorization, tenant isolation,
booking conflicts, event creation/status changes, payment confirmation,
Google Calendar/Gmail failures, and file path isolation.

## Playwright

Public and mobile smoke tests require no credentials:

```powershell
npm.cmd run e2e -- --project=chromium
npm.cmd run e2e -- --project=mobile
```

Authenticated tests use reusable Playwright storage state. Supply isolated
accounts through environment variables:

```text
E2E_READONLY_EMAIL=
E2E_READONLY_PASSWORD=
E2E_MUTATION_EMAIL=
E2E_MUTATION_PASSWORD=
E2E_LOGOUT_EMAIL=
E2E_LOGOUT_PASSWORD=
E2E_RESTRICTED_EMAIL=
E2E_RESTRICTED_PASSWORD=
```

The read-only account is used for navigation and file-workspace checks. The
mutation account must have booking permission and is used only for tests that
create server data. The logout account is separate because signing out can
invalidate its session.

### The restricted account

`rbac-enforcement.mutation.spec.ts` is the only suite that checks authorization
from the side of the person being authorized: it grants a role from the mutation
account's session and then calls the API from a second, genuinely signed-in
session to see what that role actually opens. Everything else in the suite - and
the effective-permissions panel the admin screen draws - reports what the
resolver believes, which is not what a request goes through.

That account has to be:

- **A real, active member of the mutation account's organization.** Invite it
  from `/dashboard/staff` and accept the invitation. An address with no staff row
  is refused during provisioning, before any permission check, which looks
  identical to a working guard and would make the suite pass for the wrong
  reason.
- **Holding no role whatsoever.** The tests assert this at the start of every
  case and fail with instructions if it is not true. An empty effective set is
  what lets a `200` prove the grant the test just made.

Leave the two variables unset and the suite skips rather than guessing.

Run authenticated projects with:

```powershell
npm.cmd run e2e -- --project=authenticated
npm.cmd run e2e -- --project=authenticated-mobile
npm.cmd run e2e -- --project=mutation
```
