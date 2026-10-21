import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env is optional locally; CI supplies E2E_* vars directly.
}

// The broad E2E suite tests the application behind an authenticated state. The
// trusted-device gate has its own focused coverage; leaving it on here makes the
// setup account depend on a real mailbox and blocks every unrelated spec.
process.env.DEVICE_CONFIRMATION ??= "off";

/**
 * Specs for the modules the MVP hides, listed here rather than renamed away.
 *
 * The mirror of lib/ui/mvp-features.ts: that file withdraws the routes, this one
 * withdraws the specs that drive them. Shipping a module again is one deleted
 * line in each.
 *
 * Renaming or moving these files was the other option and is worse twice over.
 * The `.authenticated.spec.ts` / `.mutation.spec.ts` suffix is what selects the
 * project below - the storage state and the device - so a renamed file loses the
 * record of which account it ran under. And tsconfig.json includes `**\/*.ts`
 * while eslint does not ignore `tests/`, so these specs are typechecked and
 * linted today; renamed out of `.ts` they would rot unnoticed until the module
 * came back and its spec no longer compiled.
 *
 * Every entry here is a file whose every test drives a hidden module. The lever
 * works on whole files, so a spec that only partly did was edited instead: its
 * hidden-module tests moved out to a file that is listed here
 * (dashboard.authenticated.spec.ts), or, where one test sits among three that
 * still ship, took a `test.skip` in place (event-manager.authenticated.spec.ts).
 * Nothing was deleted, so every module's coverage returns with the module.
 */
const mvpHiddenSpecs = [
  /billing\.authenticated\.spec\.ts/,
  /dashboard-overview\.authenticated\.spec\.ts/,
  /dashboard-roles\.authenticated\.spec\.ts/,
  /dining-manager\.authenticated\.spec\.ts/,
  /files\.authenticated\.spec\.ts/,
  /files\.mutation\.spec\.ts/,
  /hall-map\.authenticated\.spec\.ts/
];

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
  timeout: 60_000,
  workers: 3,
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  /*
   * A BUILT APP, NOT `next dev`.
   *
   * The suite drives six projects across three workers, which asks the server
   * for several dozen routes at once. `next dev` compiles a route the first time
   * it is requested, and under that much concurrency Turbopack stops answering
   * some of them: the request falls through to the not-found page and the test
   * sees a 404 whose body is Next's own 404 HTML. It hit the dynamic API routes
   * hardest - `/api/events/[eventId]/menu`, `/api/menu/packages/[packageId]` -
   * and cost 28 failures a run, reproducibly, while every one of those specs
   * passed when run on its own against the same code.
   *
   * That is a property of on-demand compilation rather than of anything the
   * tests or the app do, so the fix is to remove it: `next build` compiles every
   * route up front and `next start` only serves them. The build costs a couple of
   * minutes and buys most of it back, because no request pays to compile.
   *
   * `reuseExistingServer` still holds, so a server already up on 3000 is used as
   * it was - but note that a `npm run dev` left running is exactly the thing this
   * is avoiding. Stop it before a full run.
   */
  webServer: {
    /// Serves only. The build is the `e2e` scripts' job in package.json, so a
    /// build failure reads as a build failure rather than as "webServer was not
    /// able to start", and so Playwright is not managing a two-stage command.
    command: "npm run start -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: "setup",
      fullyParallel: false,
      testMatch: /auth\.setup\.ts/
    },
    {
      name: "chromium",
      testIgnore: [
        /auth\.setup\.ts/,
        /\.authenticated\.spec\.ts/,
        /\.mutation\.spec\.ts/,
        ...mvpHiddenSpecs
      ],
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile",
      testIgnore: [
        /auth\.setup\.ts/,
        /\.authenticated\.spec\.ts/,
        /\.mutation\.spec\.ts/,
        ...mvpHiddenSpecs
      ],
      use: { ...devices["Pixel 5"] }
    },
    {
      name: "authenticated",
      dependencies: ["setup"],
      testMatch: /\.authenticated\.spec\.ts/,
      testIgnore: mvpHiddenSpecs,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/readonly.json"
      }
    },
    {
      name: "authenticated-mobile",
      dependencies: ["setup"],
      testMatch: /\.authenticated\.spec\.ts/,
      testIgnore: mvpHiddenSpecs,
      use: {
        ...devices["Pixel 5"],
        storageState: "playwright/.auth/readonly.json"
      }
    },
    {
      name: "mutation",
      dependencies: ["setup"],
      testMatch: /\.mutation\.spec\.ts/,
      testIgnore: mvpHiddenSpecs,
      /*
       * One worker, against the three the rest of the suite runs on.
       *
       * Every spec here signs in as the same mutation account and writes to that
       * one organization's data, and the dashboard subscribes to realtime updates
       * for the organization it is looking at. So a write by one worker
       * invalidates the queries behind another worker's open drawer, the list
       * re-renders, and the row the second worker was about to click is detached
       * mid-click - `event-menu.mutation.spec.ts` retried that click for its full
       * two-minute timeout. The specs are correct in isolation; they simply
       * cannot share an organization concurrently.
       *
       * This is not free: a full `npm run e2e` goes from about 5 minutes to
       * about 12, nearly all of it event-menu.mutation.spec.ts running its
       * twelve cases end to end. A green suite is worth that here, but if the
       * wait becomes the problem the fix is to give each mutation spec its own
       * organization rather than to raise this number - the races come from
       * sharing one, not from the count of workers.
       */
      workers: 1,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/mutation.json"
      }
    }
  ]
});
