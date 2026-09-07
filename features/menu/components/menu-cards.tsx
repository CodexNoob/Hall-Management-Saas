"use client";

import {
  ActionsMenu,
  type ActionsMenuItem
} from "@/components/ui/actions-menu";
import {
  LineIcon,
  type IconName
} from "@/features/menu/components/menu-shared";

/**
 * What a card draws where a picture would be.
 *
 * A tile rather than the ring inside a ring these cards used to show: two thin
 * grey circles read as a thumbnail still loading, and the grids they sit in are
 * mostly pictureless, so the whole page looked half-arrived.
 */
function PicturePlaceholder({ icon }: { icon: IconName }) {
  return (
    <>
      <span className="absolute inset-0 bg-linear-to-br from-[#f6fafd] to-[#e7eef6]" />
      <span className="relative flex h-14 w-14 items-center justify-center rounded-xl border border-[#dbe3ec] bg-white text-[#1f4d73] shadow-[0_1px_3px_rgba(23,32,42,0.06)] sm:h-18 sm:w-18 sm:rounded-2xl">
        <LineIcon name={icon} className="h-6 w-6 sm:h-7 sm:w-7" />
      </span>
    </>
  );
}

export function MenuItemCard({
  actions = [],
  category,
  detail = null,
  isSelectDisabled = false,
  isTicked = false,
  name,
  onSelect,
  onToggleTick,
  pendingLabel = null,
  pictureIcon = "fork",
  pictureUrl
}: {
  /**
   * Entries for the card's three-dot menu. The card renders them and knows
   * nothing about what they do; pass none and the trigger disappears.
   *
   * Not an alternative to `onSelect`, though no grid needs both today: the
   * library opens an editor on click, and a package keeps the menu because its
   * one action is destructive and wants a label before it fires.
   */
  actions?: ActionsMenuItem[];
  category: string;
  /**
   * A second line under the name. The Drink Menu and the two service tabs put
   * the counting rule here - "2 bottles per table", "1 plate per guest" -
   * because those tabs are about how an item is served, and the card is the
   * only place the actual numbers can be read.
   *
   * Deliberately not on the library grid: a food card there says what a dish
   * IS, and how much of it to cook is a kitchen question that tab does not ask.
   */
  detail?: string | null;
  /**
   * Set when the viewer may not edit the item. The card still reads, but stops
   * offering a form that could not save. Ignored without `onSelect`.
   */
  isSelectDisabled?: boolean;
  /** Whether this card is part of the current selection. Needs `onToggleTick`. */
  isTicked?: boolean;
  name: string;
  /**
   * Makes the whole card one click target - the update flow's entry point.
   *
   * The card, not a control inside it: these sit three columns wide on a phone,
   * where the corner of a card is the hardest place on the page to hit.
   */
  onSelect?: () => void;
  /**
   * Turns the card into a toggle: clicking it ticks and unticks rather than
   * doing anything on its own. Set from the package panel, where a click builds
   * up a selection that one button at the bottom then acts on.
   *
   * Takes precedence over `onSelect`, which is the library grid's click and has
   * no meaning while a selection is being made. The tick mark replaces the
   * actions menu in the corner rather than sitting beside it - a card offering
   * both a tick and a hidden menu of verbs is two answers to one tap.
   */
  onToggleTick?: () => void;
  /**
   * Set while a write started from this card is in flight. It takes the corner
   * from the actions menu, because the menu has already closed itself by then
   * and there would otherwise be nowhere on the card to say anything is
   * happening.
   */
  pendingLabel?: string | null;
  /**
   * What to draw in place of a missing picture. Defaults to the fork and knife,
   * which is right for every food grid; the Drink Menu passes a glass, because
   * cutlery over a list of bottles is worse than no icon at all.
   */
  pictureIcon?: IconName;
  pictureUrl?: string | null;
}) {
  const isPending = Boolean(pendingLabel);
  const isTickable = Boolean(onToggleTick);
  const hasActions = actions.length > 0 && !isPending && !isTickable;
  // Whichever control is there sits in the same corner, and the category pill
  // has to give up its right edge for it.
  const hasCornerControl = hasActions || isPending || isTickable;
  const isSelectable =
    Boolean(onSelect) && !isTickable && !isSelectDisabled && !isPending;

  // Written once and placed into whichever wrapper this card needs, rather than
  // duplicated down two branches of the return.
  const body = (
    <>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden rounded-t-xl bg-[#fbfcfd]">
        {pictureUrl ? (
          /* Plain <img>, not next/image: the signed URL carries a token that
             rotates every few minutes, so the optimizer would never serve a
             cache hit and its host would have to be added to remotePatterns.
             alt="" because the name is already rendered below - announcing it
             twice is worse than treating the thumbnail as decorative.
             Absolute, not in flow: a flex item defaults to min-height:auto, so
             an image left in the flow stretches this slot to its intrinsic
             height and pushes the name out of the card's fixed h-50.
             No scrim over the top: the pill carries its own opaque backing, and
             a gradient band read as a shadow across the picture. */
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
            decoding="async"
            loading="lazy"
            src={pictureUrl}
          />
        ) : (
          <PicturePlaceholder icon={pictureIcon} />
        )}
        {/* The pill gives up its right edge when there is a menu to sit
            beside, rather than running underneath it. */}
        <span
          className={`absolute left-1.5 top-2 truncate rounded-full bg-white/92 px-1.5 py-1 text-center text-[8px] font-black text-[#17202a] ring-1 ring-inset ring-black/5 backdrop-blur-sm sm:left-3 sm:right-auto sm:top-3 sm:px-2 sm:text-[10px] ${
            hasCornerControl
              ? "right-9 sm:max-w-[calc(100%-4rem)]"
              : "right-1.5 sm:max-w-[calc(100%-1.5rem)]"
          }`}
        >
          {category}
        </span>
      </div>
      <div className="flex h-16 min-w-0 flex-col items-center justify-center gap-0.5 rounded-b-xl border-t border-[#d8dde5] px-1.5 text-center text-[10px] font-black leading-3 text-[#17202a] sm:h-12 sm:px-3 sm:text-sm sm:leading-4">
        {/* One line shorter when a detail sits under it, so the footer keeps
            the height every other card in the grid has. */}
        <span
          className={`wrap-break-word ${detail ? "line-clamp-2" : "line-clamp-3"}`}
          // Clamped, so a long name is only readable in full on hover.
          title={name}
        >
          {name}
        </span>
        {detail ? (
          <span className="line-clamp-1 w-full text-[9px] font-bold leading-3 text-[#6a7483] sm:text-[11px]">
            {detail}
          </span>
        ) : null}
      </div>
    </>
  );

  return (
    // `relative` anchors the actions menu, and the clipping that used to live
    // here has moved down to the picture: on the article it also cut off the
    // open dropdown.
    <article
      aria-busy={isPending || undefined}
      className={`group relative flex h-50 rounded-xl border bg-white shadow-[0_1px_2px_rgba(23,32,42,0.04)] ${
        isTicked
          ? "border-[#1f4d73] ring-2 ring-[#1f4d73]/25"
          : "border-[#d8dde5]"
      } ${isPending ? "opacity-60" : ""} ${
        isSelectable || (isTickable && !isPending)
          ? "dashboard-hover-card cursor-pointer"
          : ""
      }`}
    >
      {isTickable ? (
        // The whole card again, for the reason the editor's click is the whole
        // card: a tick box in the corner is a 24px target on a grid that is
        // three columns wide on a phone. `aria-pressed` rather than a checkbox
        // role because this is a button that stays down, and the bar at the
        // bottom of the grid is what submits.
        <button
          aria-label={`Select ${name}`}
          aria-pressed={isTicked}
          className="flex min-w-0 w-full flex-col rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4d73]/40 disabled:cursor-not-allowed"
          disabled={isSelectDisabled || isPending}
          onClick={onToggleTick}
          type="button"
        >
          {body}
        </button>
      ) : onSelect ? (
        // The whole card is the button. Its accessible name says what the click
        // does rather than repeating the category pill and the dish name that
        // are already rendered inside it.
        <button
          aria-label={`Edit ${name}`}
          className="flex min-w-0 w-full flex-col rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4d73]/40 disabled:cursor-not-allowed"
          disabled={isSelectDisabled || isPending}
          onClick={onSelect}
          type="button"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 w-full flex-col">{body}</div>
      )}

      {isPending ? (
        <span
          className="absolute right-1.5 top-1.5 rounded-full border border-[#d8dde5] bg-white/90 px-2 py-1 text-[9px] font-black text-[#6a7483] shadow-sm backdrop-blur-sm sm:right-2 sm:top-2 sm:text-[10px]"
          role="status"
        >
          {pendingLabel}
        </span>
      ) : isTickable ? (
        // Drawn even when empty, and not only on hover: an outline is what says
        // these cards are ticked rather than opened, and hover does not exist
        // on the phone where most of this grid is read.
        <span
          aria-hidden
          className={`pointer-events-none absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm sm:right-2 sm:top-2 sm:h-7 sm:w-7 ${
            isTicked
              ? "border-[#1f4d73] bg-[#1f4d73] text-white"
              : "border-[#b9c2cf] bg-white/90 text-transparent"
          }`}
        >
          <LineIcon name="check" className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </span>
      ) : hasActions ? (
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
      className="dashboard-hover-card flex h-50 overflow-hidden rounded-xl border border-dashed border-[#b9c2cf] bg-[#fbfcfd] text-[#17202a] hover:bg-[#eef4fa]"
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

export function AddOnCard({
  name,
  description,
  price,
  pictureUrl,
  tag
}: {
  name: string;
  description: string;
  price: string;
  pictureUrl?: string | null;
  tag: string;
}) {
  return (
    // Top-aligned rather than centred: the cards stretch to the tallest in
    // their row, and centring left a one-line add-on's name floating in the
    // middle of a box sized by the two-line one beside it.
    <article className="flex min-w-0 items-start gap-3 rounded-xl border border-[#d8dde5] bg-white p-3 shadow-[0_1px_2px_rgba(23,32,42,0.04)]">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#dbe3ec] bg-[#fbfcfd]">
        {pictureUrl ? (
          // Plain <img> and alt="", for the reasons spelled out on
          // MenuItemCard: a signed URL that rotates faster than the optimizer
          // could ever cache it, beside a name this card already renders.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            decoding="async"
            loading="lazy"
            src={pictureUrl}
          />
        ) : (
          // The thumbnail is too small for the tile the grid cards draw, so
          // this one is just the icon on the same tinted ground.
          <>
            <span className="absolute inset-0 bg-linear-to-br from-[#f6fafd] to-[#e7eef6]" />
            <LineIcon name="fork" className="relative h-6 w-6 text-[#1f4d73]" />
          </>
        )}
      </div>
      {/* `flex-1 min-w-0` so a long name wraps inside the card instead of
          pushing the pills past its edge - these columns are narrow now that
          the grid fills the panel rather than stopping at two. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <h3
          className="line-clamp-2 wrap-break-word text-sm font-black leading-4 text-[#17202a]"
          // Clamped, so a long name is only readable in full on hover.
          title={name}
        >
          {name}
        </h3>
        {/* Nothing at all when there is no description, rather than an empty
            line holding the pills away from the name. */}
        {description ? (
          <p className="mt-1 line-clamp-2 wrap-break-word text-xs leading-4 text-[#516174]">
            {description}
          </p>
        ) : null}
        {/* Pushed to the bottom of whatever height the row settled on, so the
            prices read along one line across the row instead of stepping with
            each card's description. */}
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          {/* The price is what an add-on is for, so it is the filled chip and
              the pricing mode beside it is the outlined one. Two chips in the
              same tint read as two equal facts. */}
          <span className="rounded-full bg-[#1f4d73] px-2 py-1 text-[10px] font-black leading-none text-white">
            {price}
          </span>
          <span className="rounded-full border border-[#b9c2cf] bg-white px-2 py-1 text-[10px] font-black leading-none text-[#17202a]">
            {tag}
          </span>
        </div>
      </div>
    </article>
  );
}
