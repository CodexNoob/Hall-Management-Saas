"use client";

import { useState } from "react";
import type { AuditResponse } from "@/features/access/components/access-shared";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useAppLanguage } from "@/components/providers/app-language-provider";
import { useDateFormatters } from "@/features/dashboard/hooks/use-regional-settings";
import type { MessageKey } from "@/lib/i18n/messages";

/**
 * The privilege-change audit trail, with a reader.
 *
 * An audit table nobody can read is storage, not a control - so this exists in
 * the same phase that starts writing it. The CSV export is not a nicety either:
 * an export is what a security questionnaire actually asks to see.
 */

const ACTION_LABELS: Record<string, MessageKey> = {
  "role.created": "access.action.roleCreated",
  "role.updated": "access.action.roleUpdated",
  "role.deleted": "access.action.roleDeleted",
  "assignment.created": "access.action.roleAssigned",
  "assignment.revoked": "access.action.roleRevoked",
  "override.replaced": "access.action.permissionsChanged",
  "staff.invited": "access.action.staffInvited",
  "staff.deactivated": "access.action.accessRevoked",
  "staff.restored": "access.action.accessRestored",
  "staff.password.reset": "access.action.passwordReset"
};

// An audit row is a REAL TIMESTAMP: something that actually happened, shown in
// the venue's own timezone. The module-level `en-US` formatter that used to sit
// here ignored the organization's Language & Region settings entirely, so a
// venue on dd/MM/yyyy and a 24-hour clock still read its own audit trail in
// American. `useDateFormatters` is a hook, so it lives inside the component.

function formatDetail(detail: unknown): string {
  if (!detail || typeof detail !== "object") return "";

  const parts: string[] = [];
  const record = detail as Record<string, unknown>;

  for (const [name, value] of Object.entries(record)) {
    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      if (value.length > 0) parts.push(`${name}: ${value.join(", ")}`);
      continue;
    }

    if (typeof value === "object") {
      const nested = value as { added?: string[]; removed?: string[] };
      if (nested.added?.length) parts.push(`+${nested.added.join(", +")}`);
      if (nested.removed?.length) parts.push(`-${nested.removed.join(", -")}`);
      continue;
    }

    parts.push(`${name}: ${String(value)}`);
  }

  return parts.join(" · ");
}

export function AuditPanel({ canRead }: { canRead: boolean }) {
  const { t } = useAppLanguage();
  const dates = useDateFormatters();
  const [action, setAction] = useState("");
  const query = useAuthenticatedQuery<AuditResponse>(
    `/api/access/audit${action ? `?action=${encodeURIComponent(action)}` : ""}`,
    canRead
  );

  if (!canRead) {
    return (
      <section className="rounded-xl border border-[#d8dde5] bg-white px-4 py-6">
        <p className="text-[11px] text-[#6a7483]">
          {t("access.auditNeeds")}
          <code className="mx-1 rounded bg-[#eef1f5] px-1">audit.read</code>.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#d8dde5] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8dde5] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-black">{t("access.privilegeChanges")}</h2>
          <p className="mt-0.5 text-[10px] text-[#6a7483]">
            {t("access.auditBlurb")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-lg border border-[#c7d0dc] px-2 text-xs font-semibold"
            name="auditActionFilter"
            onChange={(event) => setAction(event.target.value)}
            value={action}
          >
            <option value="">{t("access.allChanges")}</option>
            {Object.entries(ACTION_LABELS).map(([value, labelKey]) => (
              <option key={value} value={value}>
                {t(labelKey)}
              </option>
            ))}
          </select>
          <a
            className="inline-flex h-9 items-center rounded-lg border border-[#c7d0dc] px-3 text-xs font-black text-[#233144]"
            href={`/api/access/audit?format=csv${action ? `&action=${encodeURIComponent(action)}` : ""}`}
          >
            {t("common.exportCsv")}
          </a>
        </div>
      </header>

      <div className="max-h-[60dvh] overflow-y-auto">
        {query.isLoading ? (
          <p className="px-4 py-4 text-[11px] text-[#6a7483]">{t("common.loading")}</p>
        ) : null}
        {!query.isLoading && (query.data?.entries.length ?? 0) === 0 ? (
          <p className="px-4 py-4 text-[11px] text-[#6a7483]">
            {t("access.auditEmpty")}
          </p>
        ) : null}
        <ul className="divide-y divide-[#eef1f5]">
          {(query.data?.entries ?? []).map((entry) => (
            <li className="px-4 py-2.5" key={entry.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-black text-[#17202a]">
                  {ACTION_LABELS[entry.action]
                    ? t(ACTION_LABELS[entry.action])
                    : entry.action}
                  {entry.subjectName ? (
                    <span className="font-semibold text-[#536172]">
                      {" "}
                      · {entry.subjectName}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] text-[#6a7483]">
                  {dates.dateTime(entry.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-[#6a7483]">
                {t("access.by")} {entry.actorName}
                {formatDetail(entry.detail)
                  ? ` — ${formatDetail(entry.detail)}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
