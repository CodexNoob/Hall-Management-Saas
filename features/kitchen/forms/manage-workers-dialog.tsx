"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { AsyncState } from "@/components/ui/async-state";
import {
  invalidateAuthenticatedQuery,
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

type WorkersResponse = { workers: KitchenWorkerRow[] };

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
  "h-10 w-full border border-[#b9c2cf] bg-white px-3 text-sm text-[#17202a] outline-none placeholder:text-[#737373] focus:border-[#1f4d73] focus:ring-2 focus:ring-[#1f4d73]/15";

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
  const nameInputRef = useRef<HTMLInputElement>(null);
  const workersQuery = useAuthenticatedQuery<WorkersResponse>(
    WORKERS_URL,
    open
  );
  const [name, setName] = useState("");
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
      invalidateAuthenticatedQuery("/api/kitchen");
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
    const trimmed = name.trim();

    if (!canManage || !trimmed) return;

    if (await run(WORKERS_URL, "POST", { name: trimmed, color })) {
      setName("");
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
      className="fixed inset-0 z-110 flex items-center justify-center bg-[#17202a]/40 p-3 sm:p-5"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[calc(100dvh-24px)] w-full max-w-[560px] flex-col overflow-hidden border border-[#cbd5df] bg-white shadow-2xl shadow-[#17202a]/25"
        role="dialog"
      >
        <header className="flex items-center justify-between gap-4 border-b border-[#d8dde5] px-4 py-2">
          <h2 className="text-lg font-black text-[#17202a]" id={titleId}>
            Kitchen workers
          </h2>

          <button
            aria-label="Close kitchen workers"
            className="flex h-10 w-10 items-center justify-center rounded-full text-3xl leading-none text-black hover:bg-[#f6f8fa]"
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

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {canManage ? (
            <form className="mb-4" onSubmit={addWorker}>
              <label htmlFor={nameId}>
                <span className="block text-xs font-black uppercase tracking-[0.04em] text-[#53627a]">
                  Add a worker
                </span>
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  ref={nameInputRef}
                  autoComplete="off"
                  className={inputClass}
                  id={nameId}
                  name="workerName"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Mendy"
                  value={name}
                />
                <button
                  className="h-10 shrink-0 bg-[#07162d] px-4 text-sm font-black text-white hover:bg-[#142946] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={isSaving || !name.trim()}
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
                      className="block h-6 w-6 rounded-full border-2 border-transparent peer-checked:border-[#07162d] peer-focus-visible:border-[#07162d]"
                      style={{ backgroundColor: choice }}
                    />
                    <span className="sr-only">{choice}</span>
                  </label>
                ))}
              </fieldset>
            </form>
          ) : (
            <p className="mb-4 border border-[#f3c679] bg-[#fff9ef] px-3 py-3 text-xs font-bold text-[#80500c]">
              You do not have permission to manage kitchen workers. Contact an
              administrator if you need access.
            </p>
          )}

          {error ? (
            <p
              className="mb-3 border border-[#f0b9b4] bg-[#fff5f4] px-3 py-2 text-xs font-bold text-[#b42318]"
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
              <ul className="divide-y divide-[#d8dde5] border border-[#d8dde5]">
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
                          onChange={(event) =>
                            setEditingName(event.target.value)
                          }
                          value={editingName}
                        />
                        <button
                          className="h-9 bg-[#07162d] px-3 text-xs font-black text-white disabled:opacity-40"
                          disabled={isSaving || !editingName.trim()}
                          onClick={() => void renameWorker(worker.id)}
                          type="button"
                        >
                          Save
                        </button>
                        <button
                          className="h-9 border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a]"
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
                              className="h-9 border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa] disabled:opacity-40"
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
                              className="h-9 border border-[#f0b9b4] bg-white px-3 text-xs font-black text-[#b42318] hover:bg-[#fff5f4] disabled:opacity-40"
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
                  <ul className="mt-2 divide-y divide-[#d8dde5] border border-[#d8dde5]">
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
                            className="h-9 border border-[#b9c2cf] bg-white px-3 text-xs font-black text-[#17202a] hover:bg-[#eef4fa] disabled:opacity-40"
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
