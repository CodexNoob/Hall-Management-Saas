# Architecture

## Runtime boundaries

Event Core has three distinct runtime layers:

1. The Next.js client renders pages and calls same-origin APIs.
2. Next.js route handlers authenticate, authorize, validate, and delegate business work.
3. Prisma services access the PostgreSQL database using organization-scoped queries.

Electron and Capacitor are shells around the deployed web runtime. They must not contain duplicated booking, billing, or authorization logic.

## Dependency direction

Use this direction for new code:

```text
app routes -> feature components/services -> lib infrastructure -> external systems
shared components -> no feature-specific business logic
electron -> deployed web URL only
```

- Keep `app/**/page.tsx` small and compose a feature page component.
- Keep route handlers focused on HTTP concerns. Put reusable business rules in `features/<domain>/services` or `server`.
- Keep feature-private components inside their feature.
- Move a utility to `lib/` only when multiple features genuinely share it.
- Every tenant-owned database operation must include an organization boundary.
- Validate untrusted request data with Zod and enforce authorization on the server.

The `features/dashboard` folder currently also provides shared authenticated-query and dashboard-shell helpers. Treat those helpers as platform infrastructure; avoid adding domain business logic to that feature. A future cleanup may move them to `lib/query` or `components/dashboard` when touching those APIs for another reason.

## Feature layout

A feature may contain:

```text
features/<feature>/
  components/   React presentation and orchestration
  forms/        dialogs and form-specific UI
  hooks/        feature-owned client behavior
  services/     business operations and pure rules
  server/       server-only handlers or repositories
  validations/  shared Zod schemas
```

Not every feature needs every folder. Avoid empty abstraction layers.

## Known maintainability hotspots

The codebase is organized but not completely free of large orchestration components. Refactor these incrementally when changing their behavior:

- `features/billing/components/transactions-tab.tsx`
- `features/administration/components/staff-page.tsx`
- `features/hall-room-map/components/hall-room-map-page.tsx`
- `components/layout/dashboard-sidebar.tsx`

Extract cohesive dialogs, hooks, and services with tests; do not rewrite all workflows simultaneously.

## Authentication and tenant safety

- Supabase establishes the user identity.
- Server helpers resolve the local user, active organization membership, role, and permissions.
- Client-side visibility is usability only, not authorization.
- Mutations must re-check permissions and organization ownership in the server/API layer.
- Public endpoints require strict schemas and rate limiting.
- **Beta access gate.** While Event Core is in private beta, owner registration records a request in `beta_access_requests` instead of provisioning anything. The gate is a single block in `provisionOwner()` (`lib/auth/provisioning.ts`) — the one function that may create an organization from nothing — so a pending or rejected applicant is refused everywhere at once, including direct API requests, without any route needing its own check. Refused applicants are sent to `/beta-pending` rather than a generic auth error. Approval is a script (`npm run beta:approve`), never an endpoint. Staff invitations are unaffected: invitees already have a `users` row and never reach that path. See [beta-access.md](beta-access.md).

## Integrations

- Stripe handles subscription checkout and payment webhooks.
- Plaid handles bank-link flows and transaction import.
- Brevo sends beta-request notifications, while Supabase uses Brevo SMTP for authentication email.
- Google integrations live under `lib/google` and feature-specific API routes.

Keep provider secrets server-side and verify webhook signatures before processing events.

## Definition of done

A behavior change should normally pass type checking, ESLint, relevant Vitest tests, and a production build. Add Playwright coverage for important user workflows on desktop and mobile viewports.

