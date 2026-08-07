# Event Core

Event Core is a multi-tenant venue operations platform. The same deployed Next.js application powers the browser experience, the Electron desktop shell, and the Capacitor mobile wrapper.

## Technology

- Next.js 15 App Router, React 19, TypeScript, and Tailwind CSS 4
- Supabase Authentication and PostgreSQL
- Prisma ORM and versioned SQL migrations
- TanStack Query for authenticated client data
- Stripe for subscriptions/payments and Plaid for bank connections
- Vitest for unit/integration tests and Playwright for browser tests
- Electron for Windows/macOS packaging and Capacitor for mobile packaging

## Project map

| Path | Responsibility |
| --- | --- |
| `app/` | Routes, layouts, pages, and thin HTTP route handlers |
| `features/` | Business capabilities grouped by domain |
| `components/` | Application-wide UI and dashboard layout components |
| `lib/` | Cross-feature infrastructure such as auth, database, security, and storage |
| `prisma/` | Database schema, migrations, seed, and controlled backfills |
| `electron/` | Desktop main process and installer assets |
| `tests/` | Vitest and Playwright coverage |
| `docs/` | Architecture and deployment guides |
| `configuration/` | Historical/master product configuration reference |

Read [docs/architecture.md](docs/architecture.md) before making structural changes. Desktop-specific guidance is in [electron/README.md](electron/README.md).

## Local setup

1. Install the Node version declared in `.node-version`.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local` and provide the required values.
4. Run `npm run db:deploy` against the intended database.
5. Start the web application with `npm run dev`.

Never commit `.env.local` or service-role credentials.

## Verification

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Public browser tests can be run with `npm.cmd run e2e:public`. Authenticated tests require the isolated credentials described in [tests/README.md](tests/README.md).

## Database changes

1. Edit `prisma/schema.prisma`.
2. Create a migration with `npm run db:migrate` during development.
3. Review the generated SQL.
4. Commit the schema and migration together.
5. Deploy with `npm run db:deploy`.

Do not edit Supabase tables manually when the change belongs in Prisma, and do not delete the `_prisma_migrations` table.

## Desktop application

`npm run desktop:dev` launches the Electron shell against `EVENT_CORE_APP_URL`. `npm run desktop:build` creates an installer under ignored `dist/`. The desktop shell loads the deployed web app; most UI changes therefore require a web deployment, not a new installer.

