import { defineConfig, devices } from "@playwright/test";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env is optional locally; CI supplies E2E_* vars directly.
}

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
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
      testMatch: /auth\.setup\.ts/
    },
    {
      name: "chromium",
      testIgnore: [
        /auth\.setup\.ts/,
        /\.authenticated\.spec\.ts/,
        /\.mutation\.spec\.ts/
      ],
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile",
      testIgnore: [
        /auth\.setup\.ts/,
        /\.authenticated\.spec\.ts/,
        /\.mutation\.spec\.ts/
      ],
      use: { ...devices["Pixel 5"] }
    },
    {
      name: "authenticated",
      dependencies: ["setup"],
      testMatch: /\.authenticated\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/readonly.json"
      }
    },
    {
      name: "authenticated-mobile",
      dependencies: ["setup"],
      testMatch: /\.authenticated\.spec\.ts/,
      use: {
        ...devices["Pixel 5"],
        storageState: "playwright/.auth/readonly.json"
      }
    },
    {
      name: "mutation",
      dependencies: ["setup"],
      testMatch: /\.mutation\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/mutation.json"
      }
    }
  ]
});
