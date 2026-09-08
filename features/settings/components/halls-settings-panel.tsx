"use client";

import { useState } from "react";

import { useAuthenticatedMutation } from "@/features/dashboard/hooks/use-authenticated-mutation";
import {
  invalidateAuthenticatedQuery,
  useAuthenticatedQuery
} from "@/features/dashboard/hooks/use-authenticated-query";
import { useDashboardAccess } from "@/features/dashboard/hooks/use-dashboard-permission";
import { countSchema, moneySchema } from "@/lib/validation/number";
import { readNumericFields } from "@/lib/validation/numeric-form";

type Hall = {
  id: string;
  name: string;
  capacity: number | null;
  dailyEventLimit: number | null;
  basePrice: string | number | null;
  perCouplePrice: string | number | null;
  memberBasePrice: string | number | null;
  memberPerCouplePrice: string | number | null;
  color: string | null;
  isActive: boolean;
  isBookable: boolean;
  _count: {
    events: number;
    bookingReservations: number;
    hallMapPresets: number;
  };
};

type HallsResponse = {
  halls: Hall[];
  limits?: {
    activeHallLimit: number | null;
    subscriptionStatus: string;
  };
};

type HallInput = {
  id?: string;
  name: string;
  capacity: number | null;
  dailyEventLimit: number | null;
  basePrice: number | null;
  perCouplePrice: number | null;
  memberBasePrice: number | null;
  memberPerCouplePrice: number | null;
  color: string;
  isActive: boolean;
  isBookable: boolean;
};

/**
 * What a PATCH may leave out, which is the whole point of this type.
 *
 * `PUT`-shaped saves - send the entire record every time - stopped working the
 * moment `PATCH /api/halls` began asking for `hall.price.update` when a price
 * field is present and `hall.delete` when a circulation flag is. A hall editor
 * without those keys who resent the prices unchanged would be refused for
 * fields they never touched, so the payload now carries only what the caller
 * may actually change. The route treats an absent field as leave-alone.
 */
type HallUpdateInput = Partial<HallInput> & { id: string };

/**
 * Create is partial for the same reason, minus the id.
 *
 * `POST /api/halls` defaults every absent field - prices to null, `isActive`
 * and `isBookable` to true - so a creator who may not price a hall sends no
 * price fields rather than four nulls, and the route's own
 * `hall.price.update` check has nothing to refuse. Only the name is required.
 */
type HallCreateInput = Partial<HallInput> & { name: string };

/**
 * The dialog keeps numeric fields as the raw text the user typed and only
 * converts on save. Coercing per keystroke with `Number(...)` is what let
 * unparseable input reach the server as a silent 0 or a silent null.
 */
type HallFormState = {
  id?: string;
  name: string;
  capacity: string;
  dailyEventLimit: string;
  basePrice: string;
  perCouplePrice: string;
  memberBasePrice: string;
  memberPerCouplePrice: string;
  color: string;
  isActive: boolean;
  isBookable: boolean;
};

type HallNumericField =
  | "capacity"
  | "dailyEventLimit"
  | "basePrice"
  | "perCouplePrice"
  | "memberBasePrice"
  | "memberPerCouplePrice";

const emptyHall: HallFormState = {
  name: "",
  capacity: "",
  dailyEventLimit: "",
  basePrice: "",
  perCouplePrice: "",
  memberBasePrice: "",
  memberPerCouplePrice: "",
  color: "#1f5f91",
  isActive: true,
  isBookable: true
};

function moneyText(value: string | number | null) {
  return value === null || value === undefined ? "" : String(Number(value));
}

const priceFields: {
  key: Exclude<HallNumericField, "capacity">;
  id: string;
  name: string;
  label: string;
}[] = [
  {
    key: "basePrice",
    id: "hall-base-price",
    name: "hallBasePrice",
    label: "Regular base price"
  },
  {
    key: "perCouplePrice",
    id: "hall-per-couple-price",
    name: "hallPerCouplePrice",
    label: "Regular per couple"
  },
  {
    key: "memberBasePrice",
    id: "hall-member-base-price",
    name: "hallMemberBasePrice",
    label: "Member base price"
  },
  {
    key: "memberPerCouplePrice",
    id: "hall-member-per-couple-price",
    name: "hallMemberPerCouplePrice",
    label: "Member per couple"
  }
];

function PriceInput({
  id,
  name,
  label,
  value,
  error,
  disabled,
  onChange
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-black">
      {label}
      <input
        aria-describedby={error ? `${id}-error` : undefined}
        aria-invalid={error ? true : undefined}
        className="mt-2 h-11 w-full rounded-xl border border-[#b9c2cf] bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-[#f1f4f8] disabled:text-[#6a7483]"
        disabled={disabled}
        id={id}
        inputMode="decimal"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder="0.00"
        readOnly={disabled}
        type="text"
        value={value}
      />
      {error ? (
        <p
          className="mt-1 text-[10px] font-bold text-[#c2410c]"
          id={`${id}-error`}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </label>
  );
}

function formatMoney(value: string | number | null) {
  if (value === null) return "Not set";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number(value));
}

/**
 * ONE CONTROL, ONE KEY - not one panel, one key.
 *
 * This whole panel used to be gated on `settings.update`, passed down as a
 * single `canEdit`. That was true enough while halls were one `hall.manage`
 * key, and became wrong the moment the lifecycle split: an Event Manager holds
 * `hall.update` and would have sat looking at four disabled buttons, because
 * the page was answering a question about settings rather than about halls.
 *
 * Read here rather than passed in, like `reset-settings-panel` does with
 * `organization.reset`: the panel knows which control needs which key, and the
 * page cannot get it wrong on its behalf. These are RENDERING HINTS - the
 * routes decide, and each of them asks again.
 */
function useHallPermissions() {
  const { hasPermission } = useDashboardAccess();

  return {
    canCreate: hasPermission("hall.create"),
    canUpdate: hasPermission("hall.update"),
    /** Every price field on the form, member rates included. */
    canPrice: hasPermission("hall.price.update"),
    /**
     * Deactivating, reactivating, and deleting outright. One key, because
     * deletion is refused as soon as anything references the hall - so
     * deactivating IS the removal, and the catalog treats them as one act.
     */
    canRetire: hasPermission("hall.delete")
  };
}

export function HallsSettingsPanel() {
  const { canCreate, canUpdate, canPrice, canRetire } = useHallPermissions();
  const hallsQuery = useAuthenticatedQuery<HallsResponse>("/api/halls");
  const createMutation = useAuthenticatedMutation<
    HallCreateInput,
    { hall: Hall }
  >("/api/halls", "POST");
  const updateMutation = useAuthenticatedMutation<
    HallUpdateInput,
    { hall: Hall }
  >("/api/halls", "PATCH");
  const deleteMutation = useAuthenticatedMutation<
    { id: string },
    { deleted: true }
  >("/api/halls", "DELETE");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<HallFormState>(emptyHall);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<HallNumericField, string>>
  >({});
  const [message, setMessage] = useState("");
  const pending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending;
  const halls = hallsQuery.data?.halls ?? [];
  const activeHallLimit = hallsQuery.data?.limits?.activeHallLimit ?? null;
  const activeHallCount = halls.filter((hall) => hall.isActive).length;
  const reachedActiveHallLimit =
    activeHallLimit !== null && activeHallCount >= activeHallLimit;

  function refreshHallConsumers() {
    invalidateAuthenticatedQuery("/api/events");
    invalidateAuthenticatedQuery("/api/hall-maps");
    invalidateAuthenticatedQuery("/api/calendar");
    invalidateAuthenticatedQuery("/api/settings");
  }

  function openCreate() {
    if (reachedActiveHallLimit) {
      setMessage(
        "Free trial organizations can only use 1 active hall. Upgrade your plan to add more halls."
      );
      return;
    }
    setForm(emptyHall);
    setFieldErrors({});
    setMessage("");
    setDialogOpen(true);
  }

  function openEdit(hall: Hall) {
    setForm({
      id: hall.id,
      name: hall.name,
      capacity: hall.capacity === null ? "" : String(hall.capacity),
      dailyEventLimit:
        hall.dailyEventLimit === null ? "" : String(hall.dailyEventLimit),
      basePrice: moneyText(hall.basePrice),
      perCouplePrice: moneyText(hall.perCouplePrice),
      memberBasePrice: moneyText(hall.memberBasePrice),
      memberPerCouplePrice: moneyText(hall.memberPerCouplePrice),
      color: hall.color ?? "#1f5f91",
      isActive: hall.isActive,
      isBookable: hall.isBookable
    });
    setFieldErrors({});
    setMessage("");
    setDialogOpen(true);
  }

  function updateField(field: keyof HallFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  }

  async function saveHall() {
    const name = form.name.trim();
    if (!name) {
      setMessage("Enter a hall name.");
      return;
    }

    // Every price and the capacity may legitimately be cleared, so an empty
    // box means "not set" - but unparseable text is an error, not a clear.
    const numbers = readNumericFields<HallNumericField>({
      capacity: {
        raw: form.capacity,
        schema: countSchema({ min: 1, label: "Capacity" }),
        allowEmpty: true
      },
      dailyEventLimit: {
        raw: form.dailyEventLimit,
        schema: countSchema({
          min: 1,
          max: 50,
          label: "Events allowed per day"
        }),
        allowEmpty: true
      },
      basePrice: {
        raw: form.basePrice,
        schema: moneySchema({ label: "Base price" }),
        allowEmpty: true
      },
      perCouplePrice: {
        raw: form.perCouplePrice,
        schema: moneySchema({ label: "Per couple price" }),
        allowEmpty: true
      },
      memberBasePrice: {
        raw: form.memberBasePrice,
        schema: moneySchema({ label: "Member base price" }),
        allowEmpty: true
      },
      memberPerCouplePrice: {
        raw: form.memberPerCouplePrice,
        schema: moneySchema({ label: "Member per couple price" }),
        allowEmpty: true
      }
    });

    if (!numbers.ok) {
      setFieldErrors(numbers.errors);
      setMessage(numbers.firstError);
      return;
    }

    setFieldErrors({});

    // What every hall editor may send. Prices and the circulation flag are
    // added below only for a caller who holds their keys - resending an
    // unchanged price is still a price field on the wire, and the route reads
    // the payload, not the intent.
    const payload: HallCreateInput = {
      name,
      capacity: numbers.values.capacity,
      dailyEventLimit: numbers.values.dailyEventLimit,
      color: form.color,
      ...(canPrice
        ? {
            basePrice: numbers.values.basePrice,
            perCouplePrice: numbers.values.perCouplePrice,
            memberBasePrice: numbers.values.memberBasePrice,
            memberPerCouplePrice: numbers.values.memberPerCouplePrice
          }
        : {}),
      ...(canRetire ? { isActive: form.isActive, isBookable: form.isBookable } : {})
    };

    try {
      if (form.id) {
        await updateMutation.mutate({ ...payload, id: form.id });
        setMessage(`${name} updated.`);
      } else {
        // A hall has to start somewhere: the create route defaults `isActive`
        // and `isBookable` to true and every price to null when they are
        // absent, so a creator without the other two keys gets a live,
        // unpriced hall rather than a refusal.
        await createMutation.mutate(payload);
        setMessage(`${name} created.`);
      }
      setDialogOpen(false);
      refreshHallConsumers();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save this hall."
      );
    }
  }

  async function toggleHall(hall: Hall) {
    try {
      // The one field that is actually changing. Echoing the whole record back
      // - which this did - made a deactivation carry four prices, so the route
      // asked for `hall.price.update` on top of `hall.delete` and refused
      // anyone holding only the latter.
      await updateMutation.mutate({ id: hall.id, isActive: !hall.isActive });
      setMessage(`${hall.name} ${hall.isActive ? "deactivated" : "activated"}.`);
      refreshHallConsumers();
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
            {activeHallLimit !== null ? (
              <p className="mt-1 text-[10px] font-bold text-[#b26a00]">
                Free trial limit: {activeHallCount}/{activeHallLimit} active
                hall used.
              </p>
            ) : null}
          </div>
          <button
            className="h-9 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white enabled:hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!canCreate || pending || reachedActiveHallLimit}
            onClick={openCreate}
            type="button"
            title={
              reachedActiveHallLimit
                ? "Free trial organizations can only use 1 active hall."
                : undefined
            }
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
            {halls.map((hall) => (
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
                    <p className="mt-2 text-[9px] leading-4 text-[#526173]">
                      Regular: {formatMoney(hall.basePrice)} base ·{" "}
                      {formatMoney(hall.perCouplePrice)} / couple
                    </p>
                    <p className="text-[9px] leading-4 text-[#526173]">
                      Member: {formatMoney(hall.memberBasePrice)} base ·{" "}
                      {formatMoney(hall.memberPerCouplePrice)} / couple
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
                    disabled={!canUpdate || pending}
                    onClick={() => openEdit(hall)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="h-8 rounded-lg border border-[#b9c2cf] bg-white text-[10px] font-black enabled:hover:bg-[#eef4fa] disabled:opacity-45"
                    disabled={
                      !canRetire ||
                      pending ||
                      (!hall.isActive && reachedActiveHallLimit)
                    }
                    onClick={() => void toggleHall(hall)}
                    type="button"
                    title={
                      !hall.isActive && reachedActiveHallLimit
                        ? "Free trial organizations can only use 1 active hall."
                        : undefined
                    }
                  >
                    {hall.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    className="h-8 rounded-lg border border-[#efb5ad] bg-white text-[10px] font-black text-[#b42318] enabled:hover:bg-[#fff4f2] disabled:opacity-45"
                    disabled={!canRetire || pending}
                    onClick={() => void deleteHall(hall)}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
            {halls.length === 0 ? (
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
                  id="hall-name"
                  maxLength={100}
                  name="hallName"
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
                    aria-describedby={
                      fieldErrors.capacity ? "hall-capacity-error" : undefined
                    }
                    aria-invalid={fieldErrors.capacity ? true : undefined}
                    className="mt-2 h-11 w-full rounded-xl border border-[#b9c2cf] px-3 text-sm"
                    id="hall-capacity"
                    inputMode="decimal"
                    name="hallCapacity"
                    onChange={(event) =>
                      updateField("capacity", event.target.value)
                    }
                    placeholder="500"
                    type="text"
                    value={form.capacity}
                  />
                  {fieldErrors.capacity ? (
                    <p
                      className="mt-1 text-[10px] font-bold text-[#c2410c]"
                      id="hall-capacity-error"
                      role="alert"
                    >
                      {fieldErrors.capacity}
                    </p>
                  ) : null}
                </label>
                <label className="block text-xs font-black">
                  Calendar color
                  <input
                    className="mt-2 h-11 w-full rounded-xl border border-[#b9c2cf] bg-white px-2"
                    id="hall-color"
                    name="hallColor"
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
              <div className="rounded-xl border border-[#d8dde5] bg-[#f8fafc] p-3">
                <p className="text-xs font-black text-[#1f3148]">
                  Pricing
                </p>
                <p className="mt-1 text-[10px] text-[#617086]">
                  {canPrice
                    ? "Used as the default hall pricing when creating packages, proposals, or event billing."
                    : "Read-only: setting what a hall costs needs the hall pricing permission. Everything else on this form is yours to change."}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {priceFields.map((field) => (
                    <PriceInput
                      disabled={!canPrice}
                      error={fieldErrors[field.key]}
                      id={field.id}
                      key={field.key}
                      label={field.label}
                      name={field.name}
                      onChange={(value) => updateField(field.key, value)}
                      value={form[field.key]}
                    />
                  ))}
                </div>
              </div>
              {/*
                Taking a hall off the booking flow is retiring it, so the box
                asks for the removal key rather than for the edit key - the same
                line the route draws between `hall.update` and `hall.delete`.
              */}
              <label
                className={`flex items-center gap-2 text-xs font-bold ${canRetire ? "" : "text-[#6a7483]"}`}
              >
                <input
                  checked={form.isBookable}
                  disabled={!canRetire}
                  id="hall-is-bookable"
                  name="hallIsBookable"
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
                  disabled={
                    !form.name.trim() ||
                    pending ||
                    (form.id ? !canUpdate : !canCreate)
                  }
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
