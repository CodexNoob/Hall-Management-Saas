import { vi } from "vitest";

type Row = Record<string, unknown> & { id: string; createdAt: Date };

/**
 * In-memory stand-ins for `email_security_codes` and `user_devices`,
 * understanding exactly the filters lib/auth/security-codes.ts and
 * lib/auth/device-trust.ts use: equality, `null`, `{ not: null }`, `{ gt }`
 * and the `userId_deviceHash` compound key.
 */
function matches(row: Row, where: Record<string, unknown>) {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key];

    if (expected === null) return actual === null || actual === undefined;
    if (
      expected &&
      typeof expected === "object" &&
      !(expected instanceof Date)
    ) {
      const filter = expected as { not?: unknown; gt?: Date };
      if ("not" in filter) return actual !== null && actual !== undefined;
      if (filter.gt) return actual instanceof Date && actual > filter.gt;
    }

    return actual === expected;
  });
}

function sorted(list: Row[], key: string, direction: "asc" | "desc") {
  return [...list].sort((a, b) => {
    const left = (a[key] as Date).getTime();
    const right = (b[key] as Date).getTime();
    return direction === "asc" ? left - right : right - left;
  });
}

export function fakeCodeTable() {
  const rows: Row[] = [];

  const delegate = {
    findFirst: vi.fn(
      async ({ where, orderBy }) =>
        sorted(
          rows.filter((row) => matches(row, where)),
          "createdAt",
          orderBy?.createdAt ?? "desc"
        )[0] ?? null
    ),
    findMany: vi.fn(async ({ where, orderBy }) =>
      sorted(
        rows.filter((row) => matches(row, where)),
        "createdAt",
        orderBy?.createdAt ?? "asc"
      )
    ),
    updateMany: vi.fn(async ({ where, data }) => {
      const hit = rows.filter((row) => matches(row, where));
      hit.forEach((row) => Object.assign(row, data));
      return { count: hit.length };
    }),
    create: vi.fn(async ({ data }) => {
      const row = {
        attempts: 0,
        verifiedAt: null,
        grantExpiresAt: null,
        consumedAt: null,
        deviceId: null,
        ...data
      } as Row;
      rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }) => {
      const row = rows.find((candidate) => candidate.id === where.id)!;
      if (data.attempts?.increment) {
        row.attempts = (row.attempts as number) + data.attempts.increment;
      }
      return row;
    })
  };

  return { rows, delegate };
}

export function fakeDeviceTable() {
  const rows: Row[] = [];
  let sequence = 0;

  const delegate = {
    findUnique: vi.fn(async ({ where }) => {
      const key = where.userId_deviceHash as {
        userId: string;
        deviceHash: string;
      };
      return (
        rows.find(
          (row) =>
            row.userId === key.userId && row.deviceHash === key.deviceHash
        ) ?? null
      );
    }),
    findFirst: vi.fn(
      async ({ where }) => rows.find((row) => matches(row, where)) ?? null
    ),
    findMany: vi.fn(async ({ where }) =>
      sorted(
        rows.filter((row) => matches(row, where)),
        "lastSeenAt",
        "desc"
      )
    ),
    create: vi.fn(async ({ data }) => {
      sequence += 1;
      const row = {
        id: `device-${sequence}`,
        isPrimary: !rows.some(
          (row) => row.userId === data.userId && row.isPrimary
        ),
        confirmedAt: null,
        trustedAt: null,
        trustExpiresAt: null,
        mfaVerifiedAt: null,
        revokedAt: null,
        confirmationSentAt: null,
        createdAt: new Date(),
        ...data
      } as Row;
      rows.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }) => {
      const row = rows.find((candidate) => candidate.id === where.id)!;
      Object.assign(row, data);
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }) => {
      const hit = rows.filter((row) => matches(row, where));
      hit.forEach((row) => Object.assign(row, data));
      return { count: hit.length };
    })
  };

  return { rows, delegate };
}
