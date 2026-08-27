"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AsyncState } from "@/components/ui/async-state";
import {
  invalidateAuthenticatedQuery,
  invalidateAuthenticatedQueryPrefix,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { readApiError } from "@/lib/http/api-request-error";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";

/**
 * The list of people a dish can be assigned to.
 *
 * `KitchenWorker` rows existed in the schema from the baseline and nothing in
 * the product could create one, so the assignment control on every dish had a
 * single option: "Unassigned". This is the screen that fills it.
 *
 * Retiring rather than deleting, matching what the route does: a sheet from
 * last month should still say who cooked it.
 */

export type KitchenWorkerRow = {
  id: string;
  name: string;
  color: string | null;
  isActive: boolean;
};

/** A staff member with the Kitchen Staff role who is not yet on the list. */
export type AvailableKitchenStaff = { id: string; name: string };

type WorkersResponse = {
  workers: KitchenWorkerRow[];
  availableStaff: AvailableKitchenStaff[];
};

const WORKERS_URL = "/api/kitchen/workers";

/**
 * Enough to tell one worker's chips from another's, and dark enough that white
 * text sits on any of them. Free text in the column, so this is a convenience
 * rather than the allowed set.
 */
const COLOR_CHOICES = [
  "#1f4d73",
  "#0f5132",
  "#7a3e00",
  "#6b21a8",
  "#9f1239",
  "#115e59"
];

const inputClass =
  "h-10 w-full rounded-lg border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none placeholder:text-[#737373] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

function WorkerDot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden="true"
      className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#b9c2cf]"
      style={color ? { backgroundColor: color, borderColor: color } : undefined}
    />
  );
}

export function ManageWorkersDialog({
  canManage,
  onClose,
  open
}: {
  canManage: boolean;
  onClose: () => void;
  open: boolean;
}) {
  const titleId = useId();
  const nameId = useId();
  const nameInputRef = useRef<HTMLSelectElement>(null);
  const workersQuery = useAuthenticatedQuery<WorkersResponse>(
    WORKERS_URL,
    open
  );
  const [selectedUserId, setSelectedUserId] = useState("");
  const [color, setColor] = useState<string | null>(COLOR_CHOICES[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    nameInputRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  const workers = workersQuery.data?.workers ?? [];
  const availableStaff = workersQuery.data?.availableStaff ?? [];
  const active = workers.filter((worker) => worker.isActive);
  const retired = workers.filter((worker) => !worker.isActive);

  /**
   * One place for every write, because they all end the same way: refresh this
   * list, and refresh the board - whose assignment control reads the same rows
   * and would otherwise keep offering a worker who has just been retired.
   */
  async function run(
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown
  ) {
    setIsSaving(true);
    setError(null);

    try {
      const response = await authenticatedFetch(path, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });

      if (!response.ok) throw await readApiError(response);

      invalidateAuthenticatedQuery(WORKERS_URL);
      invalidateAuthenticatedQueryPrefix("/api/kitchen?");
      await workersQuery.refetch();
      return true;
    } catch (writeError) {
      setError(
        writeError instanceof Error
          ? writeError.message
          : "Unable to save changes."
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function addWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || !selectedUserId) return;

    if (await run(WORKERS_URL, "POST", { userId: selectedUserId, color })) {
      setSelectedUserId("");
    }
  }

  async function renameWorker(workerId: string) {
    const trimmed = editingName.trim();

    if (!trimmed) return;

    if (await run(`${WORKERS_URL}/${workerId}`, "PATCH", { name: trimmed })) {
      setEditingId(null);
    }
  }

  return (
    <div
      className="dashboard-drawer-backdrop fixed inset-0 z-110 flex items-center justify-center bg-[#17202a]/25 p-3 backdrop-blur-[1px] sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-140 flex-col overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-2xl shadow-[#17202a]/20"
        role="dialog"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#d8dde5] px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-[#17202a]" id={titleId}>
              Kitchen workers
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              The people a dish can be assigned to on the board.
            </p>
          </div>

          <button
            aria-label="Close kitchen workers"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full leading-none text-[#17202a] hover:bg-[#eef4fa]"
            onClick={onClose}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                d="M5 5 19 19M19 5 5 19"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2.25"
              />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {canManage ? (
            availableStaff.length > 0 ? (
              <form className="mb-4" onSubmit={addWorker}>
                <label htmlFor={nameId}>
                  <span className="block text-xs font-black uppercase tracking-[0.04em] text-[#53627a]">
                    Add Kitchen Staff member
                  </span>
                </label>
                {/* Chosen from staff rather than typed. A typed name produced a
                  row with no link to any account, so the same person could
                  end up on the list twice with neither row aware of the
                  other. */}
                <div className="mt-1 flex gap-2">
                  <select
                    ref={nameInputRef}
                    aria-label="Add Kitchen Staff member"
                    className={inputClass}
                    id={nameId}
                    name="workerUserId"
                    onChange={(event) => setSelectedUserId(event.target.value)}
                    value={selectedUserId}
                  >
                    <option value="">Select a staff member</option>
                    {availableStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="h-10 shrink-0 rounded-lg bg-[#1f4d73] px-4 text-sm font-black text-white shadow-sm enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={isSaving || !selectedUserId}
                    type="submit"
                  >
                    Add
                  </button>
                </div>

                <fieldset className="mt-2 flex items-center gap-2">
                  <legend className="sr-only">Colour</legend>
                  {COLOR_CHOICES.map((choice) => (
                    <label
                      className="cursor-pointer"
                      key={choice}
                      title={`Use ${choice}`}
                    >
                      <input
                        checked={color === choice}
                        className="peer sr-only"
                        name="workerColor"
                        onChange={() => setColor(choice)}
                        type="radio"
                        value={choice}
                      />
                      <span
                        className="block h-7 w-7 rounded-full border-2 border-transparent ring-offset-2 peer-checked:border-white peer-checked:ring-2 peer-checked:ring-[#1f4d73] peer-focus-visible:ring-2 peer-focus-visible:ring-[#1f4d73]"
                        style={{ backgroundColor: choice }}
                      />
                      <span className="sr-only">{choice}</span>
                    </label>
                  ))}
                </fieldset>
              </form>
            ) : (
              <div className="mb-4 rounded-lg border border-[#d8dde5] bg-[#fbfcfd] px-3 py-3">
                <p className="text-xs font-black uppercase tracking-[0.04em] text-[#53627a]">
                  Kitchen worker roster is up to date
                </p>
                <p className="mt-1 text-sm font-medium text-[#64748b]">
                  Everyone currently designated as a kitchen worker is already
                  on this board. Change production access from the Staff page.
                </p>
              </div>
            )
          ) : (
            <p className="mb-4 rounded-lg border border-[#f3c679] bg-[#fff9ef] px-3 py-3 text-xs font-bold text-[#80500c]">
              You do not have permission to manage kitchen workers. Contact an
              administrator if you need access.
            </p>
          )}

          {error ? (
            <p
              className="mb-3 rounded-lg border border-[#f0b9b4] bg-[#fff5f4] px-3 py-2 text-xs font-bold text-[#b42318]"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {workersQuery.isLoading || workersQuery.error ? (
            <AsyncState
              error={workersQuery.error}
              isLoading={workersQuery.isLoading}
              onRetry={() => void workersQuery.refetch()}
            />
          ) : workers.length === 0 ? (
            <AsyncState
              emptyMessage="Add the people who cook, and they become assignable on every dish."
              emptyTitle="No kitchen workers yet"
              isEmpty
            />
          ) : (
            <>
              <ul className="divide-y divide-[#d8dde5] overflow-hidden rounded-xl border border-[#d8dde5]">
                {active.map((worker) => (
                  <li
                    className="flex flex-wrap items-center gap-2 px-3 py-2"
                    key={worker.id}
                  >
                    {editingId === worker.id ? (
                      <>
                        <input
                          aria-label={`Rename ${worker.name}`}
                          className={`${inputClass} min-w-40 flex-1`}
                          name={`workerName-${worker.id}`}
                          onChange={(event) =>
                            setEditingName(event.target.value)
                          }
                          value={editingName}
                        />
                        <button
                          className="h-9 rounded-lg bg-[#1f4d73] px-3 text-xs font-black text-white disabled:opacity-45"
                          disabled={isSaving || !editingName.trim()}
                          onClick={() => void renameWorker(worker.id)}
                          type="button"
                        >
                          Save
                        </button>
                        <button
                          className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa]"
                          onClick={() => setEditingId(null)}
                          type="button"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <WorkerDot color={worker.color} />
                        <span className="min-w-0 flex-1 truncate text-sm font-black text-[#17202a]">
                          {worker.name}
                        </span>
                        {canManage ? (
                          <>
                            <button
                              className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa] disabled:opacity-40"
                              disabled={isSaving}
                              onClick={() => {
                                setEditingId(worker.id);
                                setEditingName(worker.name);
                              }}
                              type="button"
                            >
                              Rename
                            </button>
                            <button
                              className="h-9 rounded-lg border border-[#f0b9b4] bg-white px-3 text-xs font-black text-[#b42318] hover:bg-[#fff5f4] disabled:opacity-40"
                              disabled={isSaving}
                              onClick={() =>
                                void run(
                                  `${WORKERS_URL}/${worker.id}`,
                                  "DELETE"
                                )
                              }
                              type="button"
                            >
                              Retire
                            </button>
                          </>
                        ) : null}
                      </>
                    )}
                  </li>
                ))}
              </ul>

              {retired.length > 0 ? (
                <section className="mt-4">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
                    Retired
                  </h3>
                  {/* Kept rather than deleted so finished work keeps the name
                      of whoever did it. */}
                  <ul className="mt-2 divide-y divide-[#d8dde5] overflow-hidden rounded-xl border border-[#d8dde5]">
                    {retired.map((worker) => (
                      <li
                        className="flex items-center gap-2 px-3 py-2"
                        key={worker.id}
                      >
                        <WorkerDot color={worker.color} />
                        <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#6a7483]">
                          {worker.name}
                        </span>
                        {canManage ? (
                          <button
                            className="h-9 rounded-lg border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa] disabled:opacity-40"
                            disabled={isSaving}
                            onClick={() =>
                              void run(`${WORKERS_URL}/${worker.id}`, "PATCH", {
                                isActive: true
                              })
                            }
                            type="button"
                          >
                            Restore
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
