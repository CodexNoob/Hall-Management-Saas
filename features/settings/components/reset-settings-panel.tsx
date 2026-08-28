"use client";

import { useState } from "react";

import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";
import {
  PanelHeader,
  secondaryButton
} from "@/features/settings/components/settings-shared";
import {
  RESET_CONFIRMATIONS,
  RESET_DESCRIPTIONS,
  RESET_SCOPES,
  type ResetScope
} from "@/features/settings/lib/organization-reset-scopes";

type ResetOutcome = { scope: ResetScope; deleted: Record<string, number> };

/**
 * The four resets, and the one screen in the product that destroys data on
 * purpose.
 *
 * Three things are deliberate here. Each card says what it KEEPS as well as
 * what it removes, because "events and menu reset" tells somebody nothing about
 * whether their halls survive. The confirmation phrase differs per scope, so
 * the muscle memory of the last dialog cannot arm a wider one. And the panel is
 * absent rather than disabled for anyone without `organization.reset` - a
 * greyed-out "wipe the account" button invites a support conversation about
 * getting the permission, which is not a conversation this screen should start.
 */
export function ResetSettingsPanel() {
  const { hasPermission } = useDashboardAccess();
  const canReset = hasPermission("organization.reset");
  const [armed, setArmed] = useState<ResetScope | null>(null);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const resetMutation = useAuthenticatedMutation<
    { scope: ResetScope; confirmation: string },
    ResetOutcome
  >("/api/settings/reset", "POST");

  if (!canReset) return null;

  const close = () => {
    setArmed(null);
    setTyped("");
    setError("");
  };

  const run = async (scope: ResetScope) => {
    setError("");
    setMessage("");

    try {
      const outcome = await resetMutation.mutate({
        scope,
        confirmation: typed.trim()
      });
      const total = Object.values(outcome.deleted).reduce(
        (sum, count) => sum + count,
        0
      );
      setMessage(
        `${RESET_DESCRIPTIONS[scope].title} finished. ${total} record${
          total === 1 ? "" : "s"
        } removed. Reload the page to see the empty workspace.`
      );
      close();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The reset did not run."
      );
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-[#e6b8b1] bg-white shadow-sm">
      <PanelHeader title="Reset" icon="gear" />

      <div className="border-b border-[#e6b8b1] bg-[#fff6f4] px-4 py-3">
        <p className="text-[11px] font-black text-[#b42318]">
          Everything on this panel is permanent.
        </p>
        <p className="mt-1 text-[10px] leading-4 text-[#7c5b56]">
          There is no undo and no export first. Take a backup outside Event Core
          if the data still matters to anybody.
        </p>
      </div>

      {message ? (
        <p
          className="border-b border-[#d8dde5] bg-[#f3f9f5] px-4 py-3 text-[11px] font-bold text-[#147653]"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-3 p-4">
        {RESET_SCOPES.map((scope) => {
          const description = RESET_DESCRIPTIONS[scope];
          const isArmed = armed === scope;

          return (
            <article
              className={`rounded-xl border p-3 ${
                isArmed
                  ? "border-[#b42318] bg-[#fff6f4]"
                  : "border-[#d8dde5] bg-white"
              }`}
              key={scope}
            >
              <h3 className="text-[11px] font-black text-[#17202a]">
                {description.title}
              </h3>
              <p className="mt-1 text-[10px] leading-4 text-[#6a7483]">
                {description.summary}
              </p>

              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-[9px] font-black uppercase tracking-[0.08em] text-[#b42318]">
                    Deletes
                  </dt>
                  <dd>
                    <ul className="mt-1 grid gap-1">
                      {description.removes.map((line) => (
                        <li className="text-[10px] leading-4" key={line}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt className="text-[9px] font-black uppercase tracking-[0.08em] text-[#147653]">
                    Keeps
                  </dt>
                  <dd>
                    <ul className="mt-1 grid gap-1">
                      {description.keeps.map((line) => (
                        <li className="text-[10px] leading-4" key={line}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>

              {isArmed ? (
                <div className="mt-3 border-t border-[#e6b8b1] pt-3">
                  <label
                    className="block text-[10px] font-bold"
                    htmlFor={`reset-confirmation-${scope}`}
                  >
                    Type{" "}
                    <span className="font-black text-[#b42318]">
                      {RESET_CONFIRMATIONS[scope]}
                    </span>{" "}
                    to confirm
                    <input
                      autoComplete="off"
                      className="mt-1 h-9 w-full rounded-lg border border-[#c7d0dc] px-3 text-xs"
                      id={`reset-confirmation-${scope}`}
                      name={`reset-confirmation-${scope}`}
                      onChange={(changeEvent) =>
                        setTyped(changeEvent.target.value)
                      }
                      value={typed}
                    />
                  </label>

                  {error ? (
                    <p
                      className="mt-2 text-[10px] font-bold text-[#b42318]"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="h-9 rounded-lg bg-[#b42318] px-4 text-xs font-black text-white disabled:opacity-45"
                      disabled={
                        resetMutation.isPending ||
                        typed.trim() !== RESET_CONFIRMATIONS[scope]
                      }
                      onClick={() => void run(scope)}
                      type="button"
                    >
                      {resetMutation.isPending
                        ? "Resetting..."
                        : `Run ${description.title.toLowerCase()}`}
                    </button>
                    <button
                      className={secondaryButton}
                      disabled={resetMutation.isPending}
                      onClick={close}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="mt-3 h-9 rounded-lg border border-[#b42318] bg-white px-4 text-xs font-black text-[#b42318] hover:bg-[#fff4f2]"
                  onClick={() => {
                    setArmed(scope);
                    setTyped("");
                    setError("");
                    setMessage("");
                  }}
                  type="button"
                >
                  {description.title}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
