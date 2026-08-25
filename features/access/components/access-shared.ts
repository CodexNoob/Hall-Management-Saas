"use client";

import type { PermissionKey } from "@/lib/authz/catalog";

/**
 * The wire shapes the access screens read, and nothing else.
 *
 * There is no local copy of the catalog here. `GET /api/access/catalog` is the
 * only source, because a second list in the client is a second place to forget a
 * key - and the failure mode is a permission that exists, is enforced, and can
 * never be granted because no checkbox draws it.
 */

export type CatalogEntry = {
  key: PermissionKey;
  label: string;
  description: string;
  group: string;
  isDangerous: boolean;
};

export type CatalogResponse = {
  groups: Array<{ group: string; permissions: CatalogEntry[] }>;
  epoch: number;
};

export type RoleSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  rank: number;
  isSystem: boolean;
  permissions: PermissionKey[];
  holderCount: number;
};

export type RolesResponse = { roles: RoleSummary[]; epoch: number };

export type AssignmentSummary = {
  id: string;
  roleId: string;
  roleName: string;
  roleKey: string;
  rank: number;
  scopeType: "org" | "hall" | "event_type";
  scopeId: string;
  scopeLabel: string | null;
  expiresAt: string | null;
  grantedByName: string | null;
  source: string;
  createdAt: string;
};

export type StaffEntry = {
  userId: string;
  principalId: string;
  membershipId: string;
  name: string;
  email: string;
  phone: string | null;
  department: string;
  title: string | null;
  status: "Active" | "Inactive";
  assignments: AssignmentSummary[];
  lastLoginAt: string | null;
  createdAt: string;
};

export type StaffResponse = { staff: StaffEntry[]; epoch: number };

export type EffectiveEntry = {
  key: PermissionKey;
  label: string;
  group: string;
  isDangerous: boolean;
  held: boolean;
  viaRoles: Array<{ roleId: string; roleName: string; scopeLabel: string }>;
  viaGrantOverride: boolean;
  deniedByOverride: boolean;
  expiredOnly: boolean;
  scope: { hallIds: string[] | "all"; eventTypeIds: string[] | "all" } | null;
};

export type EffectiveResponse = {
  data: {
    principalId: string;
    subjectName: string | null;
    permissions: EffectiveEntry[];
    heldCount: number;
  };
  epoch: number;
};

export type AuditEntry = {
  id: string;
  createdAt: string;
  action: string;
  actorId: string | null;
  actorName: string;
  subjectPrincipalId: string | null;
  subjectName: string | null;
  detail: unknown;
};

export type AuditResponse = {
  entries: AuditEntry[];
  nextCursor: string | null;
  epoch: number;
};

export type ApiError = {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
};

/**
 * Turn a coded API failure into something a human can act on.
 *
 * The server's prose is already user-facing, so this only adds what the prose
 * cannot say for itself: which keys caused an amplification refusal, and what
 * the current epoch is when somebody else got there first.
 */
export function describeApiError(payload: ApiError | null): string {
  if (!payload) return "Something went wrong. Please try again.";

  if (payload.code === "amplification") {
    const keys = payload.details?.permissions;

    return Array.isArray(keys) && keys.length > 0
      ? `${payload.error} (${keys.join(", ")})`
      : payload.error;
  }

  return payload.error;
}

/**
 * The optimistic-concurrency header.
 *
 * A stale epoch is REFUSED rather than merged, and the client re-presents rather
 * than silently retrying - the user's intent may no longer apply once they can
 * see what somebody else changed.
 */
export function epochHeaders(epoch: number | null): Record<string, string> {
  return epoch === null ? {} : { "If-Match": `"epoch:${epoch}"` };
}

/** A stable colour per role name, so a tenant's own roles get one too. */
export function roleTone(name: string): string {
  const tones = [
    "border-[#f0b2b8] bg-[#fdeef0] text-[#a52a3d]",
    "border-[#9bc8f2] bg-[#edf6ff] text-[#1769aa]",
    "border-[#a9dfc9] bg-[#effaf5] text-[#147653]",
    "border-[#efd39d] bg-[#fff7e8] text-[#a45f00]",
    "border-[#d2c6f7] bg-[#f5f2ff] text-[#6550c4]",
    "border-[#cdd5df] bg-[#f4f6f8] text-[#536172]"
  ];

  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 31 + name.charCodeAt(index)) >>> 0;
  }

  return tones[hash % tones.length];
}

export function describeScope(assignment: AssignmentSummary): string {
  if (assignment.scopeType === "org") return "Whole organization";

  const label = assignment.scopeLabel ?? "(deleted)";

  return assignment.scopeType === "hall" ? `Hall: ${label}` : `Type: ${label}`;
}
