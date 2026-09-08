"use client";

import { useState } from "react";
import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import {
  invalidateAuthenticatedQuery,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";

type EventType = {
  id: string;
  name: string;
  isActive: boolean;
  validDays: number[];
  isShabbosShevaBrachos: boolean;
  _count: { events: number };
};
type EventTypeInput = {
  id?: string;
  name: string;
  isActive: boolean;
  validDays: number[];
  isShabbosShevaBrachos: boolean;
};
const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const emptyForm: EventTypeInput = {
  name: "",
  isActive: true,
  validDays: [],
  isShabbosShevaBrachos: false
};

/**
 * One control, one key - see the same note in `halls-settings-panel`.
 *
 * `canRetire` covers both the Deactivate button and Delete, because
 * `DELETE /api/event-types` refuses with a 409 as soon as any event uses the
 * type: deactivating is the removal that actually happens.
 */
export function EventTypesSettingsPanel() {
  const { hasPermission } = useDashboardAccess();
  const canCreate = hasPermission("eventtype.create");
  const canUpdate = hasPermission("eventtype.update");
  const canRetire = hasPermission("eventtype.delete");
  const query = useAuthenticatedQuery<{ eventTypes: EventType[] }>(
    "/api/event-types"
  );
  const createMutation = useAuthenticatedMutation<
    EventTypeInput,
    { eventType: EventType }
  >("/api/event-types", "POST");
  // Partial, because PATCH now asks for `eventtype.delete` when `isActive` is
  // on the wire. An editor without that key must be able to rename a type
  // without resending the flag they are not allowed to change.
  const updateMutation = useAuthenticatedMutation<
    Partial<EventTypeInput> & { id: string },
    { eventType: EventType }
  >("/api/event-types", "PATCH");
  const deleteMutation = useAuthenticatedMutation<
    { id: string },
    { deleted: true }
  >("/api/event-types", "DELETE");
  const [form, setForm] = useState<EventTypeInput>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;

  function openEdit(item?: EventType) {
    setForm(
      item
        ? {
            id: item.id,
            name: item.name,
            isActive: item.isActive,
            validDays: item.validDays,
            isShabbosShevaBrachos: item.isShabbosShevaBrachos
          }
        : emptyForm
    );
    setMessage("");
    setDialogOpen(true);
  }
  function refresh() {
    invalidateAuthenticatedQuery("/api/events");
  }
  async function save() {
    const name = form.name.trim();
    if (!name) return;
    try {
      if (form.id) {
        const { isActive, ...editable } = form;
        await updateMutation.mutate({
          ...editable,
          id: form.id,
          name,
          // Only from a caller who may retire one. Resending it unchanged is
          // still sending it, and the route reads the payload.
          ...(canRetire ? { isActive } : {})
        });
      } else await createMutation.mutate({ ...form, name });
      setDialogOpen(false);
      setMessage(`${name} ${form.id ? "updated" : "created"}.`);
      refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save event type."
      );
    }
  }
  async function toggle(item: EventType) {
    try {
      // The one field that is changing. Echoing the rest back made a
      // deactivation look like a rename as well.
      await updateMutation.mutate({ id: item.id, isActive: !item.isActive });
      setMessage(
        `${item.name} ${item.isActive ? "deactivated" : "activated"}.`
      );
      refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update event type."
      );
    }
  }
  async function remove(item: EventType) {
    if (!window.confirm(`Delete "${item.name}" permanently?`)) return;
    try {
      await deleteMutation.mutate({ id: item.id });
      setMessage(`${item.name} deleted.`);
      refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to delete event type."
      );
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-xl border border-[#d8dde5] bg-white shadow-sm">
        <header className="flex items-center gap-3 border-b border-[#d8dde5] px-4 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-black">Event types</h2>
            <p className="mt-1 text-[10px] text-[#6a7483]">
              Active event types appear in New Booking, Calendar, and Event
              forms.
            </p>
          </div>
          <button
            className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white disabled:opacity-45"
            disabled={!canCreate || pending}
            onClick={() => openEdit()}
            type="button"
          >
            + Add event type
          </button>
        </header>
        {message ? (
          <p className="border-b border-[#d8dde5] bg-[#eef8f3] px-4 py-2 text-xs font-bold text-[#147653]">
            {message}
          </p>
        ) : null}
        {query.isLoading ? (
          <p className="p-5 text-center text-xs text-[#617086]">
            Loading event types...
          </p>
        ) : query.error ? (
          <div className="p-4 text-center">
            <p className="text-xs font-bold text-[#b42318]">{query.error}</p>
            <button
              className="mt-3 h-9 rounded-lg border px-4 text-xs font-black"
              onClick={query.refetch}
              type="button"
            >
              Try again
            </button>
          </div>
        ) : !query.data?.eventTypes.length ? (
          <div className="p-8 text-center">
            <p className="text-sm font-black">No event types yet</p>
            <p className="mt-1 text-xs text-[#6a7483]">
              Add one before creating a booking.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {query.data.eventTypes.map((item) => (
              <article
                className={`rounded-xl border p-3 ${item.isActive ? "bg-white" : "bg-[#f5f6f8] opacity-70"}`}
                key={item.id}
              >
                <div className="flex justify-between gap-3">
                  <div>
                    <strong className="text-sm">{item.name}</strong>
                    <p className="mt-1 text-[10px] text-[#617086]">
                      {item.validDays.length
                        ? item.validDays.map((day) => days[day]).join(", ")
                        : "All days"}{" "}
                      · {item._count.events} events
                    </p>
                  </div>
                  <span className="text-[9px] font-black">
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    className="h-8 rounded-lg border text-[10px] font-black"
                    disabled={!canUpdate || pending}
                    onClick={() => openEdit(item)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="h-8 rounded-lg border text-[10px] font-black"
                    disabled={!canRetire || pending}
                    onClick={() => void toggle(item)}
                    type="button"
                  >
                    {item.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className="h-8 rounded-lg border border-[#efaaa4] text-[10px] font-black text-[#b42318]"
                    disabled={!canRetire || pending}
                    onClick={() => void remove(item)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {dialogOpen ? (
        <div
          className="fixed inset-0 z-110 flex items-center justify-center bg-[#17202a]/35 p-4 backdrop-blur-sm"
          onMouseDown={(event) =>
            event.currentTarget === event.target && setDialogOpen(false)
          }
        >
          <section
            aria-modal="true"
            className="w-full max-w-lg rounded-xl bg-white shadow-2xl"
            role="dialog"
          >
            <header className="flex justify-between border-b px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase text-[#1f4d73]">
                  Booking settings
                </p>
                <h2 className="text-lg font-black">
                  {form.id ? "Edit event type" : "Add event type"}
                </h2>
              </div>
              <button
                aria-label="Close"
                className="h-10 w-10 rounded-full text-xl hover:bg-[#eef4fa]"
                onClick={() => setDialogOpen(false)}
                type="button"
              >
                ×
              </button>
            </header>
            <div className="space-y-4 p-5">
              <label className="block text-xs font-black uppercase text-[#64748b]">
                Name
                <input
                  autoFocus
                  className="mt-1 h-10 w-full rounded-lg border border-[#b9c2cf] px-3 text-sm font-medium normal-case"
                  name="eventTypeName"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value
                    }))
                  }
                  placeholder="Wedding"
                  required
                  value={form.name}
                />
              </label>
              <fieldset>
                <legend className="text-xs font-black uppercase text-[#64748b]">
                  Allowed booking days
                </legend>
                <p className="mt-1 text-[10px] text-[#6a7483]">
                  Leave every day unchecked to allow all days.
                </p>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {days.map((label, day) => (
                    <label
                      className="flex items-center gap-1 text-xs font-bold"
                      key={label}
                    >
                      <input
                        checked={form.validDays.includes(day)}
                        name={`eventTypeDay-${day}`}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            validDays: event.target.checked
                              ? [...current.validDays, day].sort()
                              : current.validDays.filter(
                                  (value) => value !== day
                                )
                          }))
                        }
                        type="checkbox"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {/* Retiring a type, so it asks for the removal key - not the
                  edit key that opened this dialog. */}
              <label
                className={`flex items-center gap-2 text-xs font-bold ${canRetire ? "" : "text-[#6a7483]"}`}
              >
                <input
                  checked={form.isActive}
                  disabled={!canRetire}
                  name="eventTypeIsActive"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isActive: event.target.checked
                    }))
                  }
                  type="checkbox"
                />
                Active and available for booking
              </label>
              <label className="flex items-center gap-2 text-xs font-bold">
                <input
                  checked={form.isShabbosShevaBrachos}
                  name="eventTypeIsShabbosShevaBrachos"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      isShabbosShevaBrachos: event.target.checked
                    }))
                  }
                  type="checkbox"
                />
                Shabbos Sheva Brachos event
              </label>
            </div>
            <footer className="flex justify-end gap-2 border-t bg-[#fbfcfd] px-5 py-4">
              <button
                className="h-9 rounded-lg border px-4 text-xs font-black"
                onClick={() => setDialogOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white disabled:opacity-45"
                disabled={
                  pending ||
                  !form.name.trim() ||
                  (form.id ? !canUpdate : !canCreate)
                }
                onClick={() => void save()}
                type="button"
              >
                {pending ? "Saving..." : "Save event type"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
