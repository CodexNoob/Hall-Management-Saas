"use client";

import {
  ActionsMenu,
  type ActionsMenuItem
} from "@/components/ui/actions-menu";
import { LineIcon } from "@/features/menu/components/menu-shared";

export function MenuItemCard({
  actions = [],
  category,
  name,
  pictureUrl
}: {
  /**
   * Entries for the card's three-dot menu. The card renders them and knows
   * nothing about what they do; pass none and the trigger disappears.
   */
  actions?: ActionsMenuItem[];
  category: string;
  name: string;
  pictureUrl?: string | null;
}) {
  const hasActions = actions.length > 0;

  return (
    // `relative` anchors the actions menu, and the clipping that used to live
    // here has moved down to the picture: on the article it also cut off the
    // open dropdown.
    <article className="relative flex h-50 rounded-lg border border-[#d8dde5] bg-white">
      <div className="flex min-w-0 w-full flex-col">
        <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-t-lg bg-[#fbfcfd]">
          {pictureUrl ? (
            // Plain <img>, not next/image: the signed URL carries a token that
            // rotates every few minutes, so the optimizer would never serve a
            // cache hit and its host would have to be added to remotePatterns.
            // alt="" because the name is already rendered below - announcing it
            // twice is worse than treating the thumbnail as decorative.
            // Absolute, not in flow: a flex item defaults to min-height:auto,
            // so an image left in the flow stretches this slot to its intrinsic
            // height and pushes the name out of the card's fixed h-50.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              src={pictureUrl}
            />
          ) : (
            <span className="mt-7 flex h-12 w-12 items-center justify-center rounded-full border border-[#b9c2cf] text-[#b9c2cf] sm:mt-0 sm:h-18 sm:w-18">
              <span className="flex h-7 w-7 rounded-full border border-[#b9c2cf] sm:h-10 sm:w-10" />
            </span>
          )}
          {/* The pill gives up its right edge when there is a menu to sit
              beside, rather than running underneath it. */}
          <span
            className={`absolute left-1.5 top-2 truncate rounded-full bg-white px-1.5 py-1 text-center text-[8px] font-black text-[#17202a] sm:left-3 sm:right-auto sm:top-3 sm:px-2 sm:text-[10px] ${
              hasActions
                ? "right-9 sm:max-w-[calc(100%-4rem)]"
                : "right-1.5 sm:max-w-[calc(100%-1.5rem)]"
            }`}
          >
            {category}
          </span>
        </div>
        <div className="flex h-16 min-w-0 items-center justify-center rounded-b-lg border-t border-[#d8dde5] px-1.5 text-center text-[10px] font-black leading-3 text-[#17202a] sm:h-12 sm:px-3 sm:text-sm sm:leading-4">
          <span className="line-clamp-3 wrap-break-word">{name}</span>
        </div>
      </div>

      {hasActions ? (
        <div className="absolute right-1.5 top-1.5 sm:right-2 sm:top-2">
          <ActionsMenu
            items={actions}
            label={`More actions for ${name}`}
            triggerClassName="flex h-7 w-7 items-center justify-center rounded-full border border-[#d8dde5] bg-white/90 text-[#6a7483] shadow-sm backdrop-blur-sm transition hover:bg-white hover:text-[#17202a] [&_svg]:h-4 [&_svg]:w-4"
          />
        </div>
      ) : null}
    </article>
  );
}

export function AddItemCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="flex h-50 overflow-hidden rounded-lg border border-dashed border-[#d8dde5] bg-[#fbfcfd] text-[#17202a]"
      onClick={onClick}
      type="button"
    >
      <div className="flex w-full flex-col">
        <div className="flex flex-1 items-center justify-center">
          <span className="flex h-18 w-18 items-center justify-center rounded-xl border border-dashed border-[#b9c2cf] bg-white">
            <LineIcon name="plus" className="h-5 w-5" />
          </span>
        </div>
        <div className="flex h-12 items-center justify-center border-t border-[#d8dde5] text-sm font-black">
          Add item
        </div>
      </div>
    </button>
  );
}

export function PackageAddCard({
  category,
  name,
  rule,
  price
}: {
  category: string;
  name: string;
  rule: string;
  price: string;
}) {
  return (
    <article className="flex h-50 w-full min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white sm:w-38">
      <div className="flex min-w-0 w-full flex-col">
        <div className="relative flex flex-1 items-center justify-center bg-[#fbfcfd]">
          <span className="absolute left-1.5 right-1.5 top-2 truncate rounded-full bg-white px-1.5 py-1 text-center text-[8px] font-black text-[#17202a] sm:left-3 sm:right-auto sm:top-3 sm:max-w-[calc(100%-1.5rem)] sm:px-2 sm:text-[10px]">
            {category}
          </span>
          <span className="mt-7 flex h-12 w-12 items-center justify-center rounded-full border border-[#b9c2cf] text-[#b9c2cf] sm:mt-0 sm:h-18 sm:w-18">
            <span className="flex h-7 w-7 rounded-full border border-[#b9c2cf] sm:h-10 sm:w-10" />
          </span>
        </div>
        <div className="flex h-24 min-w-0 flex-col items-center justify-center overflow-hidden border-t border-[#d8dde5] px-1.5 text-center sm:h-16 sm:px-2">
          <p className="line-clamp-2 w-full wrap-break-word text-[10px] font-black leading-3 text-[#17202a] sm:text-sm sm:leading-4">
            {name}
          </p>
          <p className="mt-1 line-clamp-2 w-full wrap-break-word text-[9px] leading-3 text-[#6a7483] sm:text-xs sm:leading-4">
            {rule}
          </p>
          <p className="w-full truncate text-[9px] leading-3 text-[#6a7483] sm:text-xs sm:leading-4">
            {price}
          </p>
        </div>
      </div>
    </article>
  );
}

export function MenuRuleCard({
  category,
  name,
  rule,
  price
}: {
  category: string;
  name: string;
  rule: string;
  price: string;
}) {
  return (
    <article className="flex h-50 w-full min-w-0 overflow-hidden rounded-lg border border-[#d8dde5] bg-white sm:w-38">
      <div className="flex min-w-0 w-full flex-col">
        <div className="relative flex flex-1 items-center justify-center bg-[#fbfcfd]">
          <span className="absolute left-1.5 right-1.5 top-2 truncate rounded-full bg-white px-1.5 py-1 text-center text-[8px] font-black text-[#17202a] sm:left-3 sm:right-auto sm:top-3 sm:max-w-[calc(100%-1.5rem)] sm:px-2 sm:text-[10px]">
            {category}
          </span>
          <span className="mt-7 flex h-12 w-12 items-center justify-center rounded-full border border-[#b9c2cf] text-[#b9c2cf] sm:mt-0 sm:h-18 sm:w-18">
            <span className="flex h-7 w-7 rounded-full border border-[#b9c2cf] sm:h-10 sm:w-10" />
          </span>
        </div>
        <div className="flex h-24 min-w-0 flex-col items-center justify-center overflow-hidden border-t border-[#d8dde5] px-1.5 text-center sm:h-16 sm:px-2">
          <p className="line-clamp-2 w-full wrap-break-word text-[10px] font-black leading-3 text-[#17202a] sm:text-sm sm:leading-4">
            {name}
          </p>
          <p className="mt-1 line-clamp-2 w-full wrap-break-word text-[9px] leading-3 text-[#6a7483] sm:text-xs sm:leading-4">
            {rule}
          </p>
          <p className="w-full truncate text-[9px] leading-3 text-[#6a7483] sm:text-xs sm:leading-4">
            {price}
          </p>
        </div>
      </div>
    </article>
  );
}

export function MenuRuleSection({
  title,
  items
}: {
  title: string;
  items: Array<{ name: string; category: string; rule: string; price: string }>;
}) {
  return (
    <section className="min-h-21 overflow-hidden rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex h-10 items-center justify-between gap-3 border-b border-[#d8dde5] px-3">
        <h3 className="text-sm font-black text-[#17202a]">{title}</h3>
        <span className="rounded-full border border-[#b9c2cf] bg-[#eef4fa] px-2 py-1 text-[10px] font-black text-[#1f4d73]">
          {items.length} items
        </span>
      </header>
      {items.length ? (
        <div className="grid grid-cols-3 gap-2 p-3 sm:flex sm:flex-col sm:gap-3">
          {items.map((item) => (
            <MenuRuleCard
              key={`${title}-${item.name}`}
              category={item.category}
              name={item.name}
              rule={item.rule}
              price={item.price}
            />
          ))}
        </div>
      ) : (
        <p className="px-3 py-4 text-xs text-[#516174]">
          No items in this section yet.
        </p>
      )}
    </section>
  );
}

export function AddOnCard({
  name,
  description,
  price,
  tag
}: {
  name: string;
  description: string;
  price: string;
  tag: string;
}) {
  return (
    <article className="flex min-h-25 min-w-0 rounded-lg border border-[#d8dde5] bg-white p-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd]">
          <span className="flex h-10 w-10 rounded-full border border-[#b9c2cf]" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-black text-[#17202a]">{name}</h3>
          <p className="mt-1 max-w-full text-xs leading-4 text-[#516174] sm:max-w-48">
            {description}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-[#b9c2cf] bg-[#eef4fa] px-2 py-1 text-[10px] font-black text-[#1f4d73]">
              {price}
            </span>
            <span className="rounded-full border border-[#b9c2cf] bg-[#eef4fa] px-2 py-1 text-[10px] font-black text-[#17202a]">
              {tag}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
