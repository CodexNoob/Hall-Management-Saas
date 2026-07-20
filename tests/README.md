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
```

The read-only account is used for navigation and file-workspace checks. The
mutation account must have booking permission and is used only for tests that
create server data. The logout account is separate because signing out can
invalidate its session.

Run authenticated projects with:

```powershell
npm.cmd run e2e -- --project=authenticated
npm.cmd run e2e -- --project=authenticated-mobile
npm.cmd run e2e -- --project=mutation
```
