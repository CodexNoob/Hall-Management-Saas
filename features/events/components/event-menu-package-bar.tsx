"use client";

import { useState } from "react";
import { LineIcon } from "@/features/events/components/event-manager-shared";

/**
 * The strip above the menu that says which package this event is served from.
 *
 * It sits above the dish sections rather than beside them because a package is
 * the decision that fills those sections: pick one and the dishes appear under
 * Buffet and Plated by their own service rules. Everything it offers is also
 * doable one dish at a time - this is the shortcut for the menu a venue sells
 * over and over.
 */

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2
});

export function EventMenuPackageBar({
  appliedPackage,
  packageLineCount,
  hasPackages,
  isConfirmed,
  isSaving,
  onOpenSelector,
  onRemove
}: {
  /// The package on this event, or null. Resolved from the catalog, so a
  /// package that has since been deactivated still names itself here.
  appliedPackage: { id: string; name: string; price: number | null } | null;
  /// Lines the package put on the menu, which is what removing it takes back.
  packageLineCount: number;
  /// Whether the library has any package to offer at all.
  hasPackages: boolean;
  isConfirmed: boolean;
  isSaving: boolean;
  onOpenSelector: () => void;
  onRemove: () => void;
}) {
  const [isConfirmingRemoval, setIsConfirmingRemoval] = useState(false);

  return (
    <>
      <section className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8dde5] bg-[#fbfcfd] px-3 py-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
              appliedPackage
                ? "border-[#a9c6df] bg-[#eef4fa] text-[#1f4d73]"
                : "border-dashed border-[#b9c2cf] bg-white text-[#6a7483]"
            }`}
          >
            <LineIcon name="box" />
          </span>
          <div className="min-w-0">
            {appliedPackage ? (
              <>
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="wrap-break-word text-[13px] font-black text-[#17202a] sm:text-sm">
                    {appliedPackage.name}
                  </span>
                  {appliedPackage.price === null ? null : (
                    <span className="text-xs font-black text-[#1f4d73]">
                      {priceFormatter.format(appliedPackage.price)}
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-[#6a7483]">
                  {packageLineCount > 0
                    ? `${packageLineCount} dish${packageLineCount === 1 ? "" : "es"} on this menu came from the package.`
                    : "Its dishes are no longer on this menu."}
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-black text-[#17202a] sm:text-sm">
                  No package on this event
                </p>
                <p className="mt-0.5 text-xs text-[#6a7483]">
                  {hasPackages
                    ? "Add one to drop its whole dish list onto this menu at once."
                    : "Build one on the Packages tab of the menu library to use it here."}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="h-8 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isConfirmed || isSaving || !hasPackages}
            onClick={onOpenSelector}
            type="button"
          >
            {/* An event can name a package with none of it on the menu - one
                picked when the booking was taken, or one whose dishes were
                removed since. "Change" would be the wrong offer there. */}
            {!appliedPackage
              ? "Add package"
              : packageLineCount > 0
                ? "Change package"
                : "Add its dishes"}
          </button>
          {appliedPackage ? (
            <button
              className="h-8 rounded-lg border border-[#efb5ad] bg-white px-3 text-xs font-black text-[#c3291b] hover:bg-[#fff4f2] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isConfirmed || isSaving}
              onClick={() => setIsConfirmingRemoval(true)}
              type="button"
            >
              Remove
            </button>
          ) : null}
        </div>
      </section>

      {isConfirmingRemoval ? (
        <div
          className="fixed inset-0 z-110 flex items-center justify-center bg-[#17202a]/45 p-4"
          onMouseDown={(mouseEvent) => {
            if (mouseEvent.currentTarget === mouseEvent.target && !isSaving) {
              setIsConfirmingRemoval(false);
            }
          }}
        >
          <section
            aria-labelledby="remove-package-title"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl"
            role="dialog"
          >
            <header className="border-b border-[#d8dde5] px-5 py-4">
              <h2
                className="text-lg font-black text-[#17202a]"
                id="remove-package-title"
              >
                Remove {appliedPackage?.name}?
              </h2>
              {/* Said plainly because it is the one thing that is not obvious:
                  a dish added by hand survives, a dish the package brought does
                  not. */}
              <p className="mt-1 text-sm text-[#64748b]">
                {packageLineCount > 0
                  ? `The ${packageLineCount} dish${packageLineCount === 1 ? "" : "es"} it added come off this menu. Anything you added by hand stays.`
                  : "The event stops naming this package. The menu itself does not change."}
              </p>
            </header>
            <footer className="flex justify-end gap-2 border-t border-[#d8dde5] bg-[#fbfcfd] px-5 py-4">
              <button
                className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa] disabled:opacity-50"
                disabled={isSaving}
                onClick={() => setIsConfirmingRemoval(false)}
                type="button"
              >
                Keep it
              </button>
              <button
                className="h-9 rounded-lg bg-[#c3291b] px-4 text-xs font-black text-white hover:bg-[#a02214] disabled:opacity-50"
                disabled={isSaving}
                onClick={() => {
                  setIsConfirmingRemoval(false);
                  onRemove();
                }}
                type="button"
              >
                Remove package
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
