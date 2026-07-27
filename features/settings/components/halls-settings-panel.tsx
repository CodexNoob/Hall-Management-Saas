"use client";

import { useState } from "react";

import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import {
  invalidateAuthenticatedQuery,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";

type Hall = {
  id: string;
  name: string;
  capacity: number | null;
  color: string | null;
  isActive: boolean;
  isBookable: boolean;
  _count: {
    events: number;
    bookingReservations: number;
    hallMapPresets: number;
  };
};

type HallsResponse = { halls: Hall[] };

type HallInput = {
  id?: string;
  name: string;
  capacity: number | null;
  color: string;
  isActive: boolean;
  isBookable: boolean;
};

const emptyHall: HallInput = {
  name: "",
  capacity: null,
  color: "#1f5f91",
  isActive: true,
  isBookable: true
};

export function HallsSettingsPanel({ canEdit }: { canEdit: boolean }) {
  const hallsQuery = useAuthenticatedQuery<HallsResponse>("/api/halls");
  const createMutation = useAuthenticatedMutation<
    HallInput,
    { hall: Hall }
  >("/api/halls", "POST");
  const updateMutation = useAuthenticatedMutation<
    HallInput & { id: string },
    { hall: Hall }
  >("/api/halls", "PATCH");
  const deleteMutation = useAuthenticatedMutation<
    { id: string },
    { deleted: true }
  >("/api/halls", "DELETE");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<HallInput>(emptyHall);
  const [message, setMessage] = useState("");
  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  function refreshHallConsumers() {
    invalidateAuthenticatedQuery("/api/events");
    invalidateAuthenticatedQuery("/api/hall-maps");
    invalidateAuthenticatedQuery("/api/calendar");
  }

  function openCreate() {
    setForm(emptyHall);
    setMessage("");
    setDialogOpen(true);
  }

  function openEdit(hall: Hall) {
    setForm({
      id: hall.id,
      name: hall.name,
      capacity: hall.capacity,
      color: hall.color ?? "#1f5f91",
      isActive: hall.isActive,
      isBookable: hall.isBookable
    });
    setMessage("");
    setDialogOpen(true);
  }

  async function saveHall() {
    const name = form.name.trim();
    if (!name) return;
    try {
      if (form.id) {
        await updateMutation.mutate({ ...form, id: form.id, name });
        setMessage(`${name} updated.`);
      } else {
        await createMutation.mutate({ ...form, name });
        setMessage(`${name} created.`);
      }
      setDialogOpen(false);
      refreshHallConsumers();
      await hallsQuery.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save this hall."
      );
    }
  }

  async function toggleHall(hall: Hall) {
    try {
      await updateMutation.mutate({
        id: hall.id,
        name: hall.name,
        capacity: hall.capacity,
        color: hall.color ?? "#1f5f91",
        isActive: !hall.isActive,
        isBookable: hall.isBookable
      });
      setMessage(`${hall.name} ${hall.isActive ? "deactivated" : "activated"}.`);
      refreshHallConsumers();
      await hallsQuery.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update this hall."
      );
    }
  }

  async function deleteHall(hall: Hall) {
    if (!window.confirm(`Delete "${hall.name}" permanently?`)) return;
    try {
      await deleteMutation.mutate({ id: hall.id });
      setMessage(`${hall.name} deleted.`);
      refreshHallConsumers();
      await hallsQuery.refetch();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to delete this hall."
      );
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <header className="flex flex-wrap items-center gap-3 border-b border-[#d8dde5] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black">Halls and rooms</h2>
            <p className="mt-1 text-[10px] text-[#6a7483]">
              Active, bookable halls appear in booking and map-assignment forms.
            </p>
          </div>
          <button
            className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!canEdit || pending}
            onClick={openCreate}
            type="button"
          >
            + Add hall
          </button>
        </header>

        {hallsQuery.isLoading ? (
          <p className="p-5 text-center text-xs text-[#617086]">
            Loading halls...
          </p>
        ) : hallsQuery.error ? (
          <div className="p-4 text-center">
            <p className="text-xs font-bold text-[#b42318]">
              {hallsQuery.error}
            </p>
            <button
              className="mt-3 h-9 rounded-lg border border-[#b9c2cf] px-4 text-xs font-black"
              onClick={hallsQuery.refetch}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {(hallsQuery.data?.halls ?? []).map((hall) => (
              <article
                className={`rounded-xl border p-3 ${
                  hall.isActive
                    ? "border-[#cbd5e1] bg-white"
                    : "border-[#d8dde5] bg-[#f5f6f8] opacity-70"
                }`}
                key={hall.id}
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-0.5 h-8 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: hall.color ?? "#1f5f91" }}
                  />
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">
                      {hall.name}
                    </strong>
                    <p className="mt-1 text-[10px] text-[#617086]">
                      Capacity: {hall.capacity ?? "Not set"} ·{" "}
                      {hall.isBookable ? "Bookable" : "Not bookable"}
                    </p>
                    <p className="mt-1 text-[9px] text-[#718096]">
                      {hall._count.events} events ·{" "}
                      {hall._count.hallMapPresets} map presets
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[9px] font-black ${
                      hall.isActive
                        ? "bg-[#e9f8f0] text-[#087047]"
                        : "bg-[#e8ebef] text-[#5f6978]"
                    }`}
                  >
                    {hall.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    className="h-8 rounded-lg border border-[#b9c2cf] bg-white text-[10px] font-black enabled:hover:bg-[#eef4fa] disabled:opacity-45"
                    disabled={!canEdit || pending}
                    onClick={() => openEdit(hall)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="h-8 rounded-lg border border-[#b9c2cf] bg-white text-[10px] font-black enabled:hover:bg-[#eef4fa] disabled:opacity-45"
                    disabled={!canEdit || pending}
                    onClick={() => void toggleHall(hall)}
                    type="button"
                  >
                    {hall.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className="h-8 rounded-lg border border-[#efb5ad] bg-white text-[10px] font-black text-[#b42318] enabled:hover:bg-[#fff4f2] disabled:opacity-45"
                    disabled={!canEdit || pending}
                    onClick={() => void deleteHall(hall)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
            {hallsQuery.data?.halls.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#c7d0dc] p-6 text-center text-xs text-[#617086] sm:col-span-2">
                No halls yet. Add the first hall to start accepting bookings.
              </p>
            ) : null}
          </div>
        )}
        {message ? (
          <p className="border-t border-[#d8dde5] px-4 py-3 text-xs font-bold text-[#315573]">
            {message}
          </p>
        ) : null}
      </section>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-120 flex items-center justify-center bg-[#07162d]/55 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !pending) {
              setDialogOpen(false);
            }
          }}
          role="presentation"
        >
          <section
            aria-labelledby="hall-dialog-title"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            role="dialog"
          >
            <header className="flex items-center border-b border-[#d8dde5] px-5 py-4">
              <h2 className="min-w-0 flex-1 text-lg font-black" id="hall-dialog-title">
                {form.id ? "Edit hall" : "Add hall"}
              </h2>
              <button
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-md text-2xl hover:bg-[#eef4fa]"
                disabled={pending}
                onClick={() => setDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <form
              className="space-y-4 p-5"
              onSubmit={(event) => {
                event.preventDefault();
                void saveHall();
              }}
            >
              <label className="block text-xs font-black">
                Hall / room name
                <input
                  autoFocus
                  className="mt-2 h-11 w-full rounded-xl border border-[#b9c2cf] px-3 text-sm"
                  maxLength={100}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  placeholder="Example: Grand Ballroom"
                  value={form.name}
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-black">
                  Capacity
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-[#b9c2cf] px-3 text-sm"
                    min="1"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        capacity: event.target.value
                          ? Number(event.target.value)
                          : null
                      }))
                    }
                    placeholder="500"
                    type="number"
                    value={form.capacity ?? ""}
                  />
                </label>
                <label className="block text-xs font-black">
                  Calendar color
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-[#b9c2cf] bg-white px-2"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        color: event.target.value
                      }))
                    }
                    type="color"
                    value={form.color}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  checked={form.isBookable}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isBookable: event.target.checked
                    }))
                  }
                  type="checkbox"
                />
                Available for new bookings
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="h-10 rounded-xl border border-[#b9c2cf] px-4 text-sm font-bold"
                  disabled={pending}
                  onClick={() => setDialogOpen(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="h-10 rounded-xl bg-[#1f4d73] px-4 text-sm font-bold text-white disabled:opacity-45"
                  disabled={!form.name.trim() || pending}
                  type="submit"
                >
                  {pending ? "Saving..." : form.id ? "Save changes" : "Create hall"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
