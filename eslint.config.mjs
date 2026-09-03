import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]
  },
  {
    // Application code logs through `lib/logging/context`, never the console.
    // A console line carries no request id, no organization and no level a log
    // platform can filter on, and on Vercel it lands in the same undifferentiated
    // stream as everything else. This rule is what keeps the count at zero once
    // the sixteen that existed were converted.
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "features/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    rules: {
      "no-console": "error"
    }
  },
  {
    // Scripts, tests and the Electron main process are outside that stream:
    // scripts are run by hand, tests report to a terminal, and the desktop main
    // process has no server logger to reach for.
    files: ["scripts/**/*.{ts,mjs,js}", "tests/**/*.{ts,tsx}", "electron/**/*.{js,cjs}", "**/*.test.{ts,tsx}"],
    rules: {
      "no-console": "off"
    }
  }
];

export default eslintConfig;
