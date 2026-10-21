"use client";

import { useState } from "react";

import {
  ACTIVITY_MODULES,
  activityActionLabelKey,
  activityActions,
  activityModuleLabelKey,
  type ActivityModule
} from "@/lib/audit/activity-actions";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import { useAppLanguage } from "@/components/providers/app-language-provider";
import { useDateFormatters } from "@/features/dashboard/hooks/use-regional-settings";

/**
 * What this organization did, most recent first.
 *
 * The sibling of features/access/components/audit-panel.tsx, which reads the
 * privilege trail. This one reads both - /api/activity merges them, and the
 * privilege half is only present when the caller also holds `audit.read` - so
 * the two screens overlap on purpose: somebody in Settings asking "what changed"
 * should not have to know that half the answer lives under Staff.
 *
 * LABELS COME FROM THE CATALOG, not from a copy of it. `audit-panel.tsx` keeps
 * its own ACTION_LABELS map, which is fine for nine fixed actions; there are
 * forty here and a second list would drift the first time somebody adds a key.
 */

type ActivityEntry = {
  id: string;
  source: "activity" | "privilege";
  createdAt: string;
  action: string;
  label: string;
  module: ActivityModule;
  message: string;
  actorName: string | null;
};

type ActivityResponse = {
  entries: ActivityEntry[];
  nextCursor: string | null;
  includesPrivilegeTrail: boolean;
};

// An activity row is a REAL TIMESTAMP - it happened - so it is shown in the
// organization's own timezone, Date Format and Time Format.

/**
 * The action filter, grouped by module so the list reads as the sidebar does.
 *
 * "Access" is offered even to a caller without `audit.read`: the API returns
 * nothing for it in that case, which is the same answer as an organization that
 * has never changed a privilege. Hiding it would be a second place that has to
 * know the permission rule.
 */
const actionsByModule = ACTIVITY_MODULES.map((module) => ({
  module,
  actions: activityActions.filter((entry) => entry.module === module)
})).filter((group) => group.actions.length > 0);

function exportHref(module: string, action: string) {
  const params = new URLSearchParams({ format: "csv" });
  if (module) params.set("module", module);
  if (action) params.set("action", action);

  return `/api/activity?${params.toString()}`;
}

export function ActivitySettingsPanel({ canRead }: { canRead: boolean }) {
  const { t } = useAppLanguage();
  const dates = useDateFormatters();
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");

  const params = new URLSearchParams();
  if (module) params.set("module", module);
  if (action) params.set("action", action);
  const search = params.toString();

  const query = useAuthenticatedQuery<ActivityResponse>(
    `/api/activity${search ? `?${search}` : ""}`,
    canRead
  );

  if (!canRead) {
    return (
      <section className="rounded-xl border border-[#d8dde5] bg-white px-4 py-6">
        <p className="text-[11px] text-[#6a7483]">
          {t("settings.activityNeeds")}
          <code className="mx-1 rounded bg-[#eef1f5] px-1">activity.read</code>.
        </p>
      </section>
    );
  }

  const entries = query.data?.entries ?? [];

  return (
    <section className="rounded-xl border border-[#d8dde5] bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#d8dde5] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-black">{t("settings.activity")}</h2>
          <p className="mt-0.5 text-[10px] text-[#6a7483]">
            {t("settings.activityBlurb")}
            {query.data && !query.data.includesPrivilegeTrail
              ? t("settings.privilegeTrailNote")
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t("settings.filterByModule")}
            className="h-9 rounded-lg border border-[#c7d0dc] px-2 text-xs font-semibold"
            name="activityModuleFilter"
            onChange={(event) => {
              setModule(event.target.value);
              // An action from the module being left would return nothing and
              // read as "no history" rather than as a filter mismatch.
              setAction("");
            }}
            value={module}
          >
            <option value="">{t("settings.allModules")}</option>
            {ACTIVITY_MODULES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            aria-label={t("settings.filterByAction")}
            className="h-9 rounded-lg border border-[#c7d0dc] px-2 text-xs font-semibold"
            name="activityActionFilter"
            onChange={(event) => setAction(event.target.value)}
            value={action}
          >
            <option value="">{t("settings.allActions")}</option>
            {actionsByModule
              .filter((group) => !module || group.module === module)
              .map((group) => (
                <optgroup
                  key={group.module}
                  label={t(activityModuleLabelKey(group.module))}
                >
                  {group.actions.map((entry) => (
                    <option key={entry.key} value={entry.key}>
                      {t(
                        activityActionLabelKey(entry.key) ??
                          "activity.module.Other"
                      )}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
          <a
            className="inline-flex h-9 items-center rounded-lg border border-[#c7d0dc] px-3 text-xs font-black text-[#233144]"
            href={exportHref(module, action)}
          >
            {t("common.exportCsv")}
          </a>
        </div>
      </header>

      <div className="max-h-[60dvh] overflow-y-auto">
        {query.isLoading ? (
          <p className="px-4 py-4 text-[11px] text-[#6a7483]">{t("common.loading")}</p>
        ) : null}
        {!query.isLoading && entries.length === 0 ? (
          <p className="px-4 py-4 text-[11px] text-[#6a7483]">
            {t("settings.activityEmpty")}
          </p>
        ) : null}
        <ul className="divide-y divide-[#eef1f5]">
          {entries.map((entry) => (
            <li className="px-4 py-2.5" key={`${entry.source}-${entry.id}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-black text-[#17202a]">
                  {(() => {
                    const labelKey = activityActionLabelKey(entry.action);

                    return labelKey ? t(labelKey) : entry.label;
                  })()}
                  <span className="ml-2 rounded bg-[#eef1f5] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
                    {t(activityModuleLabelKey(entry.module))}
                  </span>
                </span>
                <span className="text-[10px] text-[#6a7483]">
                  {dates.dateTime(entry.createdAt)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] font-semibold leading-4 text-[#233144]">
                {entry.message}
              </p>
              <p className="mt-0.5 text-[10px] text-[#6a7483]">
                {entry.actorName
                  ? t("settings.byActor", { name: entry.actorName })
                  : t("settings.byServiceAccount")}
              </p>
            </li>
          ))}
        </ul>
        {query.data?.nextCursor ? (
          <p className="px-4 py-3 text-[10px] text-[#6a7483]">
            Showing the most recent {entries.length}. Export the CSV for the full
            history.
          </p>
        ) : null}
      </div>
    </section>
  );
}
