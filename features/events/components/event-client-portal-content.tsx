"use client";

import { useEffect, useState } from "react";

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

/**
 * One selectable option, rendered as a tile.
 *
 * The name is printed once, not twice: this used to repeat it inside an empty
 * 80px box that stood in for a picture the portal never loads, which pushed the
 * real label - price included - out past the card's edge on any option whose
 * name was longer than a word or two.
 */
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
  const price =
    option.priceCents === null
      ? null
      : option.priceCents === 0
        ? "Included"
        : formatMoney(option.priceCents);

  return (
    <label
      className={`flex min-w-0 items-start gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-[#1f4d73]/40 ${
        option.selected
          ? "border-[#1f4d73] bg-[#eef4fa]"
          : "border-[#d8dde5] bg-white"
      } ${
        disabled
          ? ""
          : `cursor-pointer ${option.selected ? "" : "hover:border-[#b9c2cf] hover:bg-[#fbfcfd]"}`
      }`}
    >
      <input
        checked={option.selected}
        className={`mt-0.5 h-4 w-4 shrink-0 accent-[#1f4d73] ${
          disabled ? "" : "cursor-pointer"
        }`}
        disabled={disabled}
        name={group}
        onChange={(changeEvent) => onSelect(changeEvent.target.checked)}
        type={type}
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
          <span className="min-w-0 wrap-break-word text-sm font-black leading-snug text-[#17202a]">
            {option.name}
          </span>
          {price ? (
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${
                option.priceCents === 0
                  ? "bg-[#eef4fa] text-[#146c43]"
                  : "bg-[#f1f4f8] text-[#17202a]"
              }`}
            >
              {price}
            </span>
          ) : null}
        </span>
        {option.description ? (
          <span className="mt-1 block wrap-break-word text-xs font-medium leading-snug text-[#6a7483]">
            {option.description}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/** Below this a filter box costs more attention than the scan it saves. */
const SEARCHABLE_FROM = 8;

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
  const [query, setQuery] = useState("");
  // A section that still needs an answer opens itself; one that is already
  // answered collapses to its answer, so a long portal is a short list of what
  // is left to do. Read once, so the section never folds shut mid-click.
  const [open, setOpen] = useState(() =>
    options.every((option) => !option.selected)
  );

  if (options.length === 0) return null;

  const selectedCount = options.filter((option) => option.selected).length;
  const needle = query.trim().toLowerCase();
  const visible = needle
    ? options.filter((option) =>
        `${option.name} ${option.description ?? ""}`
          .toLowerCase()
          .includes(needle)
      )
    : options;
  const hiddenSelected =
    selectedCount - visible.filter((option) => option.selected).length;

  const selectedNames = options
    .filter((option) => option.selected)
    .map((option) => option.name)
    .join(", ");

  return (
    // Native <details>, not a button and a boolean: it brings keyboard support
    // and the browser's own find-in-page expansion, which a hand-rolled
    // collapse would have to reimplement badly.
    <details
      className="group min-w-0 rounded-lg border border-[#d8dde5]"
      onToggle={(toggleEvent) => setOpen(toggleEvent.currentTarget.open)}
      open={open}
    >
      <summary className="flex min-w-0 cursor-pointer list-none items-start gap-2 p-4 [&::-webkit-details-marker]:hidden">
        <LineIcon
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#516174] transition-transform group-open:rotate-90"
          name="chevron"
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-sm font-black text-[#17202a]">{title}</h2>
            <span className="text-xs font-semibold text-[#6a7483]">
              {selectedCount > 0
                ? `${selectedCount} of ${options.length} selected`
                : `${options.length} option${options.length === 1 ? "" : "s"}`}
            </span>
            {badge ? <Badge tone="green">{badge}</Badge> : null}
          </span>
          {/* Collapsed sections still have to answer "what did we pick?", or
              folding them away just hides the decision. */}
          {!open && selectedNames ? (
            <span className="mt-1 line-clamp-2 block wrap-break-word text-xs font-semibold text-[#516174]">
              {selectedNames}
            </span>
          ) : null}
          {!open && !selectedNames ? (
            <span className="mt-1 block text-xs font-semibold text-[#9a5b00]">
              Nothing selected yet
            </span>
          ) : null}
        </span>
      </summary>

      <div className="border-t border-[#d8dde5] p-4">
        {options.length >= SEARCHABLE_FROM ? (
          <input
            aria-label={`Search ${title.toLowerCase()}`}
            className="h-8 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs sm:max-w-64"
            onChange={(changeEvent) => setQuery(changeEvent.target.value)}
            placeholder={`Search ${title.toLowerCase()}...`}
            type="search"
            value={query}
          />
        ) : null}

        {visible.length === 0 ? (
          <p className="mt-3 rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3 text-xs text-[#6a7483]">
            Nothing matches &ldquo;{query.trim()}&rdquo;.
          </p>
        ) : (
          <>
            {/* Auto-fill, not `sm:`/`xl:` column counts: this panel sits beside
                a 340px sidebar, so viewport breakpoints forced three columns
                into a narrow column and broke option names mid-word. */}
            <div
              className={`grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-3 ${
                options.length >= SEARCHABLE_FROM ? "mt-3" : ""
              }`}
            >
              {visible.map((option) => (
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
            {hiddenSelected > 0 ? (
              <p className="mt-2 text-xs font-semibold text-[#516174]">
                {hiddenSelected} selected option
                {hiddenSelected === 1 ? " is" : "s are"} hidden by this search.
              </p>
            ) : null}
          </>
        )}
      </div>
    </details>
  );
}

/** Status, hall and both guest counts, so the four read as one row of facts. */
function DetailTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
      <strong className="text-[11px] font-black uppercase tracking-[0.08em] text-[#516174]">
        {label}
      </strong>
      <p className="mt-1 wrap-break-word text-sm font-medium text-[#17202a]">
        {value}
      </p>
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
        <h1 className="wrap-break-word text-xl font-black sm:text-2xl">
          {portal.title}
        </h1>
        <p className="mt-2 text-sm font-semibold">
          {portal.date} - {portal.time} - {portal.room}
        </p>
      </header>
      <div className="min-w-0 space-y-3 p-3 sm:p-4">
        <section className="min-w-0 rounded-lg border border-[#d8dde5] p-3 sm:p-4">
          <h2 className="text-sm font-black">Event details</h2>
          <p className="mt-1 text-xs text-[#6a7483]">
            Contact the venue to change the guest count.
          </p>
          <div className="mt-3 grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3">
            <DetailTile label="Status" value={portal.status} />
            <DetailTile label="Hall" value={portal.room} />
            <DetailTile label="Couples" value={portal.couples} />
            <DetailTile label="Children" value={portal.children} />
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
  // The URL is derived from the event id - there is no token to mint - so it is
  // filled in on mount rather than behind a "Generate link" button that only
  // ever produced the one value.
  const [portalUrl, setPortalUrl] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [sharing, setSharing] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      portalChecklist.map(([label, shared]) => [label, shared])
    )
  );
  const portalQuery = useAuthenticatedQuery<PortalResponse>(
    `/api/client-portal/${event.id}`
  );

  useEffect(() => {
    setPortalUrl(getClientPortalUrl(event.id, window.location.origin));
  }, [event.id]);

  return (
    <div className="grid min-w-0 gap-3 overflow-hidden xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-3">
        <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-[#fbfcfd] p-3">
          <h2 className="text-sm font-black text-[#17202a]">
            Client portal link
          </h2>
          <p className="mt-1 text-xs text-[#6a7483]">
            Anyone with this link can open the portal for this event.
          </p>
          <input
            aria-label="Client portal link"
            className="mt-3 h-9 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm"
            readOnly
            value={portalUrl}
            name="clientPortalUrl"
            onFocus={(focusEvent) => focusEvent.currentTarget.select()}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white transition-colors hover:bg-[#15344f] disabled:opacity-60"
              disabled={!portalUrl}
              type="button"
              onClick={async () => {
                const copied = await copyText(portalUrl);
                setCopyMessage(
                  copied ? "Link copied." : "Unable to copy the link."
                );
              }}
            >
              <LineIcon name="files" />
              Copy link
            </button>
            {portalUrl ? (
              <a
                className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a]! hover:bg-[#eef4fa]"
                href={portalUrl}
                rel="noreferrer"
                target="_blank"
              >
                <LineIcon name="document" />
                Open portal
              </a>
            ) : null}
            {copyMessage ? (
              <span className="text-xs text-[#516174]" role="status">
                {copyMessage}
              </span>
            ) : null}
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
          <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
            <LineIcon name="files" />
            <h2 className="text-sm font-black text-[#17202a]">
              Client sharing checklist
            </h2>
          </header>
          <div className="space-y-1.5 p-3">
            {portalChecklist.map(([label]) => {
              const shared = sharing[label];

              return (
                <label
                  key={label}
                  className={`flex min-h-10 min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-black transition-colors ${
                    shared
                      ? "border-[#d8dde5] bg-white text-[#17202a]"
                      : "border-[#d8dde5] bg-[#fbfcfd] text-[#6a7483]"
                  }`}
                >
                  <input
                    checked={shared}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-[#1f4d73]"
                    type="checkbox"
                    onChange={(changeEvent) =>
                      setSharing((current) => ({
                        ...current,
                        [label]: changeEvent.target.checked
                      }))
                    }
                    name={`portal-section-${label.toLowerCase().replaceAll(" ", "-")}`}
                  />
                  <span className="min-w-0 flex-1 leading-tight">{label}</span>
                  <span
                    className={`shrink-0 text-xs font-medium ${
                      shared ? "text-[#146c43]" : "text-[#6a7483]"
                    }`}
                  >
                    {shared ? "Shared" : "Hidden"}
                  </span>
                </label>
              );
            })}
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
