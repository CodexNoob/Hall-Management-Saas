"use client";

import { useState } from "react";

import { AsyncState } from "@/components/ui/async-state";
import {
  Badge,
  LineIcon,
  portalChecklist,
  type EventFile
} from "@/features/events/components/event-manager-shared";
import { useAuthenticatedQuery } from "@/features/dashboard/hooks/use-authenticated-query";
import type {
  ClientPortalOption,
  ClientPortalEvent
} from "@/features/events/types/client-portal";
import { getClientPortalUrl } from "@/lib/ui/client-portal-url";
import { copyText } from "@/lib/ui/copy-text";
import { formatMoney } from "@/lib/ui/format-money";

type PortalResponse = {
  portal: ClientPortalEvent;
  paymentUrl: string | null;
};

function PortalOptionCard({
  option,
  group,
  type,
  disabled,
  onSelect
}: {
  option: ClientPortalOption;
  group: string;
  type: "radio" | "checkbox";
  disabled: boolean;
  onSelect: (checked: boolean) => void;
}) {
  return (
    <label className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
      <div className="flex h-20 items-center justify-center rounded-lg border border-[#d8dde5] bg-white px-2 text-center text-xs font-black uppercase tracking-[0.08em] text-[#516174]">
        {option.name}
      </div>
      <div className="mt-3 flex items-start gap-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#516174]">
        <input
          checked={option.selected}
          className="mt-0.5 h-3.5 w-3.5"
          disabled={disabled}
          name={group}
          onChange={(changeEvent) => onSelect(changeEvent.target.checked)}
          type={type}
        />
        <span>
          {option.name}
          {option.priceCents !== null ? (
            <span className="ml-1 text-[#17202a]">
              {option.priceCents === 0
                ? "Included"
                : formatMoney(option.priceCents)}
            </span>
          ) : null}
          {option.description ? (
            <span className="mt-1 block text-[10px] font-semibold normal-case tracking-normal text-[#6a7483]">
              {option.description}
            </span>
          ) : null}
        </span>
      </div>
    </label>
  );
}

function OptionSection({
  title,
  badge,
  options,
  group,
  type,
  disabled,
  onSelect
}: {
  title: string;
  badge?: string;
  options: ClientPortalOption[];
  group: string;
  type: "radio" | "checkbox";
  disabled: boolean;
  onSelect: (option: ClientPortalOption, checked: boolean) => void;
}) {
  if (options.length === 0) return null;

  return (
    <section className="rounded-lg border border-[#d8dde5] p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black">{title}</h2>
        {badge ? <Badge tone="green">{badge}</Badge> : null}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {options.map((option) => (
          <PortalOptionCard
            disabled={disabled}
            group={group}
            key={option.id}
            onSelect={(checked) => onSelect(option, checked)}
            option={option}
            type={type}
          />
        ))}
      </div>
    </section>
  );
}

function GuestCount({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
      <strong className="text-[11px] font-black uppercase tracking-[0.08em] text-[#516174]">
        {label}
      </strong>
      <p className="mt-1 text-sm font-medium text-[#17202a]">{value}</p>
    </div>
  );
}

/**
 * The client-facing portal body, shared by the public page at
 * /client/[eventId] and the staff preview in Event Manager.
 *
 * Everything rendered here comes from the organization's own records. It used
 * to hardcode menu, linen and add-on prices plus a fixed estimated total, which
 * meant a venue's real customers were shown another venue's invented pricing.
 *
 * `interactive` is off by default so the staff preview stays read-only.
 */
export function ClientPortalPreviewContent({
  portal,
  paymentUrl,
  interactive = false
}: {
  portal: ClientPortalEvent;
  paymentUrl?: string | null;
  interactive?: boolean;
}) {
  const [packages, setPackages] = useState(portal.packages);
  const [menuItems, setMenuItems] = useState(portal.menuItems);
  const [tablecloths, setTablecloths] = useState(portal.tablecloths);
  const [addOns, setAddOns] = useState(portal.addOns);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  // Staff confirmation closes the menu; the kitchen has already committed.
  const locked = !interactive || portal.menuConfirmed;
  const hasOptions =
    packages.length > 0 ||
    menuItems.length > 0 ||
    tablecloths.length > 0 ||
    addOns.length > 0;

  const selectSingle = (
    options: ClientPortalOption[],
    option: ClientPortalOption,
    checked: boolean
  ) =>
    options.map((candidate) => ({
      ...candidate,
      selected: checked && candidate.id === option.id
    }));

  const selectMany = (
    options: ClientPortalOption[],
    option: ClientPortalOption,
    checked: boolean
  ) =>
    options.map((candidate) =>
      candidate.id === option.id
        ? { ...candidate, selected: checked }
        : candidate
    );

  const selectedId = (options: ClientPortalOption[]) =>
    options.find((option) => option.selected)?.id ?? null;
  const selectedIds = (options: ClientPortalOption[]) =>
    options.filter((option) => option.selected).map((option) => option.id);

  const saveSelections = async () => {
    setIsSaving(true);
    setSaveMessage("");

    try {
      const response = await fetch(
        `/api/client-portal/${portal.id}/selections`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            packageId: selectedId(packages),
            tableclothId: selectedId(tablecloths),
            menuItemIds: selectedIds(menuItems),
            addOnIds: selectedIds(addOns)
          })
        }
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      setSaveMessage(
        response.ok
          ? "Your selections were saved."
          : (payload?.error ?? "Could not save your selections.")
      );
    } catch {
      setSaveMessage("Could not save your selections.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
      <header className="rounded-t-lg bg-[#1f4d73] p-4 text-white sm:p-6">
        <h1 className="break-words text-xl font-black sm:text-2xl">
          {portal.title}
        </h1>
        <p className="mt-2 text-sm font-semibold">
          {portal.date} - {portal.time} - {portal.room}
        </p>
      </header>
      <div className="min-w-0 space-y-3 p-3 sm:p-4">
        <section className="min-w-0 rounded-lg border border-[#d8dde5] p-3 sm:p-4">
          <h2 className="text-sm font-black">Event details</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
              <strong>Status</strong>
              <p className="mt-1 text-sm text-[#6a7483]">{portal.status}</p>
            </div>
            <div className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
              <strong>Hall</strong>
              <p className="mt-1 text-sm text-[#6a7483]">{portal.room}</p>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#d8dde5] p-4">
          <h2 className="text-sm font-black">Guest count</h2>
          <p className="mt-1 text-xs text-[#6a7483]">
            Contact the venue to change your guest count.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <GuestCount label="Couples" value={portal.couples} />
            <GuestCount label="Children" value={portal.children} />
          </div>
        </section>

        {portal.menuConfirmed ? (
          <p
            className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3 text-sm font-semibold text-[#516174]"
            role="status"
          >
            Your menu has been confirmed by the venue. Contact them directly to
            make further changes.
          </p>
        ) : null}

        {hasOptions ? (
          <>
            <OptionSection
              badge={locked ? undefined : "client selectable"}
              disabled={locked}
              group="menu-package"
              onSelect={(option, checked) =>
                setPackages((current) => selectSingle(current, option, checked))
              }
              options={packages}
              title="Package"
              type="radio"
            />
            <OptionSection
              badge={locked ? undefined : "client selectable"}
              disabled={locked}
              group="menu-item"
              onSelect={(option, checked) =>
                setMenuItems((current) => selectMany(current, option, checked))
              }
              options={menuItems}
              title="Menu selection"
              type="checkbox"
            />
            <OptionSection
              disabled={locked}
              group="tablecloth-option"
              onSelect={(option, checked) =>
                setTablecloths((current) =>
                  selectSingle(current, option, checked)
                )
              }
              options={tablecloths}
              title="Tablecloth options"
              type="radio"
            />
            <OptionSection
              disabled={locked}
              group="add-on"
              onSelect={(option, checked) =>
                setAddOns((current) => selectMany(current, option, checked))
              }
              options={addOns}
              title="Add-ons"
              type="checkbox"
            />
          </>
        ) : (
          <p className="rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3 text-sm text-[#6a7483]">
            Your venue has not published selectable options yet.
          </p>
        )}

        {interactive && !portal.menuConfirmed && hasOptions ? (
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white transition-colors hover:bg-[#15344f] disabled:opacity-60"
              disabled={isSaving}
              onClick={saveSelections}
              type="button"
            >
              <LineIcon name="document" />
              {isSaving ? "Saving..." : "Save my selections"}
            </button>
            {saveMessage ? (
              <span
                className="text-xs font-semibold text-[#516174]"
                role="status"
              >
                {saveMessage}
              </span>
            ) : null}
          </div>
        ) : null}

        <section className="rounded-lg border border-[#d8dde5] p-4">
          <h2 className="text-sm font-black">Payment</h2>
          {paymentUrl ? (
            <a
              className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white! transition-colors hover:bg-[#15344f] hover:text-white! visited:text-white!"
              href={paymentUrl}
              rel="noreferrer"
              target="_blank"
            >
              <LineIcon name="document" />
              Pay balance
            </a>
          ) : (
            // No global fallback: an unconfigured organization shows no button
            // rather than sending the client to another venue's merchant.
            <p className="mt-3 text-sm text-[#6a7483]">
              Online payment is not set up for this event. Please contact the
              venue to arrange payment.
            </p>
          )}
        </section>

        {portal.totals ? (
          <div className="space-y-2 rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-[#17202a]">Invoice total</span>
              <strong className="text-lg text-[#17202a]">
                {formatMoney(portal.totals.totalCents, portal.totals.currency)}
              </strong>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-[#17202a]">Balance due</span>
              <strong className="text-xl text-[#17202a]">
                {formatMoney(
                  portal.totals.balanceDueCents,
                  portal.totals.currency
                )}
              </strong>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function ClientPortalContent({ event }: { event: EventFile }) {
  const [portalUrl, setPortalUrl] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const portalQuery = useAuthenticatedQuery<PortalResponse>(
    `/api/client-portal/${event.id}`
  );

  return (
    <div className="grid min-w-0 gap-3 overflow-hidden xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-3">
        <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
          <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
            <LineIcon name="files" />
            <h2 className="text-sm font-black text-[#17202a]">
              Client sharing checklist
            </h2>
          </header>
          <div className="space-y-2 p-3">
            {portalChecklist.map(([label, shared]) => (
              <label
                key={label}
                className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-[#d8dde5] bg-white px-3 py-2 text-sm font-black text-[#17202a]"
              >
                <input
                  className="h-4 w-4 accent-[#1f4d73]"
                  type="checkbox"
                  defaultChecked={shared}
                  name={`portal-section-${label.toLowerCase().replaceAll(" ", "-")}`}
                />
                <span className="min-w-0 flex-1 leading-tight">{label}</span>
                <span className="shrink-0 text-xs font-medium text-[#6a7483]">
                  {shared ? "Shared" : "Hidden"}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
          <h2 className="text-sm font-black text-[#17202a]">
            Client portal link
          </h2>
          <input
            className="mt-3 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm"
            readOnly
            value={portalUrl}
            name="clientPortalUrl"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white"
              type="button"
              onClick={() =>
                setPortalUrl(
                  getClientPortalUrl(event.id, window.location.origin)
                )
              }
            >
              <LineIcon name="document" />
              Generate link
            </button>
            <button
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black"
              type="button"
              onClick={async () => {
                if (!portalUrl)
                  return setCopyMessage("Generate the link first.");
                const copied = await copyText(portalUrl);
                setCopyMessage(
                  copied ? "Link copied." : "Unable to copy the link."
                );
              }}
            >
              <LineIcon name="files" />
              Copy link
            </button>
            {copyMessage ? (
              <span
                className="self-center text-xs text-[#516174]"
                role="status"
              >
                {copyMessage}
              </span>
            ) : null}
          </div>
        </section>
      </aside>

      {portalQuery.data ? (
        <ClientPortalPreviewContent
          paymentUrl={portalQuery.data.paymentUrl}
          portal={portalQuery.data.portal}
        />
      ) : (
        <AsyncState
          error={portalQuery.error}
          isLoading={portalQuery.isLoading}
          onRetry={portalQuery.refetch}
        />
      )}
    </div>
  );
}
