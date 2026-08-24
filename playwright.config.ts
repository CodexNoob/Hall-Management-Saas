import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env is optional locally; CI supplies E2E_* vars directly.
}

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
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120000
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
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/mutation.json"
      }
    }
  ]
});
