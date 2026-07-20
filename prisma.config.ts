import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

function loadEnvFile(path: string) {
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);

    if (!match) {
      continue;
    }

    const name = match[1].trim();
    const value = match[2].trim().replace(/^"(.*)"$/, "$1");

    process.env[name] ??= value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

// Prisma Client generation only needs the schema and does not connect to the
// database. A non-secret placeholder keeps `prisma generate` working during
// dependency installation; the application still requires DATABASE_URL at
// runtime in lib/prisma.ts.
const databaseUrl =
  process.env.DATABASE_URL ||
  "postgresql://unused:unused@localhost:5432/unused";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl
  },
  migrations: {
    seed: "tsx prisma/seed.ts"
  }
});
