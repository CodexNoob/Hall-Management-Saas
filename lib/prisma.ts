import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { log } from "@/lib/logging/context";

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const url = new URL(databaseUrl);

  if (url.searchParams.get("sslmode") === "require" && !url.searchParams.has("uselibpqcompat")) {
    url.searchParams.set("uselibpqcompat", "true");
  }

  return url.toString();
}

function getPoolMax() {
  const configured = Number(process.env.PRISMA_POOL_MAX);

  return Number.isInteger(configured) && configured > 0 ? configured : 10;
}

const adapter = new PrismaPg({
  connectionString: getDatabaseUrl(),
  max: getPoolMax(),
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 10_000
});

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * A query at or above this is logged. Below it, nothing - the point of the
 * listener is the query that explains a slow request, not a record of every
 * `SELECT` a dashboard load fans out into.
 */
const SLOW_QUERY_MS = 300;

/** Enough of a statement to recognise it; not enough to bloat every line. */
const QUERY_TEXT_LIMIT = 500;

/** Prisma's own engine messages can be long. Same reasoning. */
const ENGINE_MESSAGE_LIMIT = 500;

/**
 * `LOG_LEVEL` keeps its meaning - "tell me about every query" - and loses its
 * teeth. It used to switch this client to the STDOUT form, which prints each
 * statement together with its bound parameters: client names, phone numbers,
 * event notes. It now only lowers the threshold on the handler below, which
 * logs the statement and never the parameters.
 */
function slowQueryThreshold() {
  return process.env.LOG_LEVEL === "debug" ? 0 : SLOW_QUERY_MS;
}

function createPrismaClient() {
  const client = new PrismaClient({
    adapter,
    // `emit: "event"` is the load-bearing part here, not the level. The
    // bare-string form this replaced (`log: ["query", "error", "warn"]`) is the
    // stdout form: it prints to the console, with parameters, and `$on("query")`
    // never fires at all - the listener would have been dead code. This form
    // routes the same events into code we control, which is what keeps the
    // parameters out of the stream and the output structured.
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "warn" },
      { emit: "event", level: "error" }
    ]
  });

  client.$on("query", (event) => {
    if (event.duration < slowQueryThreshold()) return;

    // `event.params` is NEVER logged, and this is the one line in the file that
    // matters. It is the bound parameter array - whatever the WHERE clause
    // matched on, which in this application is client names, phone numbers and
    // event details. The statement text is safe because it carries `$1`
    // placeholders instead, which holds as long as raw SQL keeps using tagged
    // templates (`$queryRaw` parameterises its interpolations; `Prisma.raw`
    // does not, and nothing may pass a value through it).
    log.warn(
      {
        // A float from the engine - `941.8131999999999` on a cold connection.
        durationMs: Math.round(event.duration),
        target: event.target,
        query: event.query.slice(0, QUERY_TEXT_LIMIT)
      },
      "slow_query"
    );
  });

  // The engine's own channel, which is not the same thing as a failed query
  // reaching a route. Connection-pool exhaustion and adapter-level faults
  // arrive here and never become an exception anyone catches. Where a query
  // failure does produce both this line and the route's, they share a
  // `requestId` and the duplicate is the cheaper mistake.
  client.$on("warn", (event) => {
    log.warn(
      {
        target: event.target,
        message: event.message.slice(0, ENGINE_MESSAGE_LIMIT)
      },
      "prisma_engine_warning"
    );
  });

  client.$on("error", (event) => {
    log.error(
      {
        target: event.target,
        message: event.message.slice(0, ENGINE_MESSAGE_LIMIT)
      },
      "prisma_engine_error"
    );
  });

  return client;
}

// Subscribed before the client is cached, so a dev-server hot reload reuses the
// listeners it already has rather than stacking a new set on every edit.
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
