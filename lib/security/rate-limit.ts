import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RateLimitOptions = {
  scope: string;
  limit: number;
  windowMs: number;
};

type RateLimitRow = {
  requestCount: number;
  expiresAt: Date;
};

type MemoryBucket = {
  requestCount: number;
  expiresAt: Date;
};

const fallbackBuckets = new Map<string, MemoryBucket>();

function readFallbackBucket(id: string, expiresAt: Date) {
  const existing = fallbackBuckets.get(id);
  const bucket =
    !existing || existing.expiresAt.getTime() <= Date.now()
      ? { requestCount: 1, expiresAt }
      : { ...existing, requestCount: existing.requestCount + 1 };

  fallbackBuckets.set(id, bucket);
  if (fallbackBuckets.size > 2_000) {
    for (const [key, value] of fallbackBuckets) {
      if (value.expiresAt.getTime() <= Date.now()) fallbackBuckets.delete(key);
    }
  }
  return bucket;
}

function getClientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    forwarded ||
    "unknown"
  ).slice(0, 80);
}

function createBucketId(request: Request, scope: string) {
  const identifier = `${scope}:${getClientAddress(request)}:${process.env.SESSION_SECRET ?? "event-core"}`;
  return createHash("sha256").update(identifier).digest("hex");
}

export async function enforceRateLimit(
  request: Request,
  { scope, limit, windowMs }: RateLimitOptions
) {
  const id = createBucketId(request, scope);
  const expiresAt = new Date(Date.now() + windowMs);
  let bucket: RateLimitRow | undefined;
  try {
    [bucket] = await prisma.$queryRaw<RateLimitRow[]>`
      INSERT INTO api_rate_limit_buckets (
        id, request_count, window_start, expires_at, updated_at
      )
      VALUES (${id}, 1, NOW(), ${expiresAt}, NOW())
      ON CONFLICT (id) DO UPDATE SET
        request_count = CASE
          WHEN api_rate_limit_buckets.expires_at <= NOW() THEN 1
          ELSE api_rate_limit_buckets.request_count + 1
        END,
        window_start = CASE
          WHEN api_rate_limit_buckets.expires_at <= NOW() THEN NOW()
          ELSE api_rate_limit_buckets.window_start
        END,
        expires_at = CASE
          WHEN api_rate_limit_buckets.expires_at <= NOW() THEN ${expiresAt}
          ELSE api_rate_limit_buckets.expires_at
        END,
        updated_at = NOW()
      RETURNING
        request_count AS "requestCount",
        expires_at AS "expiresAt"
    `;
  } catch (error) {
    // Keep authentication and other critical endpoints available if the backing
    // table is temporarily unreachable. This per-instance limiter still provides
    // protection until the database-backed limiter recovers.
    console.error("Persistent rate limiter unavailable; using memory fallback.", error);
    bucket = readFallbackBucket(id, expiresAt);
  }

  if (!bucket || bucket.requestCount <= limit) return null;

  const retryAfter = Math.max(
    1,
    Math.ceil((bucket.expiresAt.getTime() - Date.now()) / 1000)
  );
  return NextResponse.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0"
      }
    }
  );
}
