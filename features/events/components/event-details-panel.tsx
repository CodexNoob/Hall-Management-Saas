"use client";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useState
} from "react";
import type { CountryCode } from "libphonenumber-js";
import { authenticatedFetch } from "@/lib/http/authenticated-fetch";
import { readApiError } from "@/lib/http/api-request-error";
import {
  DEFAULT_PHONE_COUNTRY,
  countryFromE164,
  nationalFromE164
} from "@/lib/validation/phone";
import { BookingFormFields } from "@/features/bookings/forms/booking-form-fields";
import {
  bookingFormSchema,
  fieldErrorPatch,
  toFieldErrors,
  toGuestCountPayload,
  type BookingFormErrors,
  type BookingFormInput,
  type BookingFormValues
} from "@/features/bookings/validations/booking-form.schema";
import {
  LineIcon,
  type EventFile,
  type EventHallOption,
  type EventTypeOption,
  type IconName
} from "@/features/events/components/event-manager-shared";
import {
  getEventReadinessSummary,
  getScopedEventReadinessItems
} from "@/features/events/components/event-readiness";

export function Field({
  label,
  children,
  className = ""
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label
      className={`block text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483] ${className}`}
    >
      {label}
      {children}
    </label>
  );
}

export function ClientContact({ event }: { event: EventFile }) {
  const rows = [
    {
      icon: "phone",
      label: event.phone || "Phone not provided",
      href: event.phone ? `tel:${event.phone}` : undefined
    },
    {
      icon: "mail",
      label: event.email || "Email not provided",
      href: event.email ? `mailto:${event.email}` : undefined
    },
    { icon: "couples", label: event.coordinator, href: undefined }
  ] satisfies Array<{ icon: IconName; label: string; href?: string }>;

  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
        <LineIcon name="user" />
        <h2 className="text-sm font-black text-[#17202a]">Client contact</h2>
      </header>
      <div className="space-y-3 p-3">
        {rows.map((row) => (
          <a
            key={row.label}
            className={`flex h-12 w-full items-center gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 text-left text-sm font-black text-[#17202a] ${row.href ? "hover:bg-[#eef4fa]" : "cursor-default"}`}
            href={row.href}
            aria-disabled={!row.href}
            onClick={(clickEvent) => {
              if (!row.href) clickEvent.preventDefault();
            }}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d8dde5] bg-[#fbfcfd] text-[#1f4d73]">
              <LineIcon name={row.icon} />
            </span>
            <span className="min-w-0 flex-1 truncate">{row.label}</span>
            {row.href ? (
              <LineIcon name="chevron" className="h-4 w-4 text-[#17202a]" />
            ) : null}
          </a>
        ))}
      </div>
    </section>
  );
}

export function ReadinessPanel({ event }: { event: EventFile }) {
  const rows = getScopedEventReadinessItems(event, "event");
  const summary = getEventReadinessSummary(event, "event");

  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex min-h-11 items-center justify-between gap-2 border-b border-[#d8dde5] px-4 py-2">
        <div className="flex items-center gap-2">
          <LineIcon name="files" />
          <h2 className="text-sm font-black text-[#17202a]">Readiness</h2>
        </div>
        <span
          className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
            summary.ready
              ? "bg-[#eefaf5] text-[#146c43]"
              : "bg-[#fff8dd] text-[#946200]"
          }`}
        >
          {summary.completed}/{summary.total}
        </span>
      </header>
      <div className="space-y-2 p-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex min-h-14 items-start gap-3 rounded-lg border border-[#d8dde5] bg-white px-3 py-2 text-sm font-black text-[#17202a]"
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                row.done
                  ? "border-[#146c43] bg-[#eefaf5] text-[#146c43]"
                  : "border-[#b9c2cf] text-transparent"
              }`}
            >
              {row.done ? <LineIcon name="check" className="h-4 w-4" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block leading-4">{row.label}</span>
              <span className="mt-0.5 block text-xs font-semibold leading-4 text-[#64748b]">
                {row.helper}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

const activityTimestamp = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));

/**
 * What has been done to this event, most recent first.
 *
 * The eight most recent entries rather than the full history - that is what
 * /api/events returns - so this answers "what just changed" rather than serving
 * as an audit trail. Named accordingly.
 */
export function ActivityPanel({ event }: { event: EventFile }) {
  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
        <LineIcon name="clock" />
        <h2 className="text-sm font-black text-[#17202a]">Recent activity</h2>
      </header>
      <div className="space-y-3 p-3">
        {event.activityLogs.map((entry) => (
          <div
            key={entry.id}
            className="border-l-2 border-[#bfd2e2] pl-3 text-[#17202a]"
          >
            <strong className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6a7483]">
              {entry.actionType}
            </strong>
            <p className="mt-1 text-xs font-semibold leading-4">
              {entry.message}
            </p>
            <span className="mt-1 block text-[10px] font-semibold text-[#8290a2]">
              {entry.userName ? `${entry.userName} - ` : ""}
              {activityTimestamp(entry.createdAt)}
            </span>
          </div>
        ))}
        {event.activityLogs.length === 0 ? (
          <p className="text-xs font-semibold text-[#6a7483]">
            No activity recorded yet. Changes to this event will appear here.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function countText(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "0";
}

/**
 * The stored event, as the booking form's fields.
 *
 * Event information is the booking form again, over the same nine fields, so an
 * event is edited with exactly what created it. The phone arrives stored as
 * E.164 and goes back to the picker as its national part, which is what the
 * field is typed in.
 *
 * The count mode is read back out of the counts rather than stored beside them.
 * An event whose total is exactly its couples and children had nothing counted
 * by head, which is only true of one that was entered in `Couples`. Everything
 * else - including an event booked before the modes existed, holding couples
 * and a head count at once - opens in `People` showing its full total, so
 * reopening one cannot quietly shed the part of the room the couples do not
 * account for.
 */
export function createBookingFormValues(event: EventFile): BookingFormValues {
  const couples = Number(event.couples);
  const countedInCouples =
    couples > 0 &&
    Number(event.guests) === couples * 2 + Number(event.children);

  return {
    clientName: event.clientName,
    phone: nationalFromE164(event.phone),
    eventDate: event.dateInput,
    hallId: event.hallId,
    eventTypeId: event.eventTypeId,
    countMode: countedInCouples ? "Couples" : "People",
    guests: countText(event.guests),
    couples: countText(event.couples),
    children: countText(event.children),
    notes: event.internalNotes
  };
}

/**
 * A validated form as the PATCH body.
 *
 * `startsAt` is rebuilt from the event's own stored clock time, not edited
 * here: moving the date without it would leave the occupancy window on the old
 * day, and the calendar and the event list would then disagree about when this
 * event is. Events with no time recorded simply keep having none.
 */
export function toEventDetailsPayload(
  data: BookingFormInput,
  storedTimeInput: string
) {
  return {
    clientName: data.clientName,
    phone: data.phone,
    eventDate: data.eventDate,
    hallId: data.hallId,
    eventTypeId: data.eventTypeId,
    ...toGuestCountPayload(data),
    notes: data.notes,
    ...(storedTimeInput
      ? {
          startsAt: new Date(
            `${data.eventDate}T${storedTimeInput}:00`
          ).toISOString()
        }
      : {})
  };
}

/** Booking states that can still be moved to confirmed. */
const confirmableStatuses = ["INQUIRY", "TENTATIVE_HOLD"];

type PanelFeedback = { tone: "success" | "error"; text: string };

export function EventInformation({
  event,
  eventTypes,
  halls,
  onEventSaved
}: {
  event: EventFile;
  eventTypes: EventTypeOption[];
  halls: EventHallOption[];
  onEventSaved: () => Promise<unknown>;
}) {
  const [values, setValues] = useState<BookingFormValues>(() =>
    createBookingFormValues(event)
  );
  const [errors, setErrors] = useState<BookingFormErrors>({});
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(
    () => countryFromE164(event.phone) ?? DEFAULT_PHONE_COUNTRY
  );
  const [feedback, setFeedback] = useState<PanelFeedback | null>(null);
  const [pendingIntent, setPendingIntent] = useState<
    "save" | "confirm" | null
  >(null);

  // Reloads whenever the selected event changes, and after a save, when the
  // refetched row arrives as a new object.
  useEffect(() => {
    setValues(createBookingFormValues(event));
    setPhoneCountry(countryFromE164(event.phone) ?? DEFAULT_PHONE_COUNTRY);
    setErrors({});
  }, [event]);

  // Whatever the last save said is about the event that was open at the time,
  // so it is dropped when a different one is selected.
  useEffect(() => setFeedback(null), [event.id]);

  const canConfirm = confirmableStatuses.includes(event.bookingStatus);
  const isBusy = pendingIntent !== null;

  function updateValue(field: keyof BookingFormValues, value: string) {
    setFeedback(null);
    setErrors((current) => ({ ...current, ...fieldErrorPatch(field) }));
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function transitionTo(
    status: "TENTATIVE_HOLD" | "CONFIRMED",
    expectedVersion: number
  ) {
    const response = await authenticatedFetch(
      `/api/events/${event.id}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, expectedVersion })
      }
    );

    if (!response.ok) throw await readApiError(response);

    const result = (await response.json()) as { event: { version: number } };

    return result.event.version;
  }

  async function submit(intent: "save" | "confirm") {
    // The same schema the calendar's booking dialog submits through, so an
    // event cannot be edited into a shape a new booking would be refused for.
    const parsed = bookingFormSchema({ country: phoneCountry }).safeParse(
      values
    );

    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      setFeedback({
        tone: "error",
        text: "Fix the highlighted fields before saving."
      });
      return;
    }

    setErrors({});
    setFeedback(null);
    setPendingIntent(intent);

    try {
      const response = await authenticatedFetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toEventDetailsPayload(parsed.data, event.timeInput))
      });

      if (!response.ok) throw await readApiError(response);

      const saved = (await response.json()) as { event: { version: number } };

      if (intent === "confirm") {
        // Saving bumped the row's version, so the transition has to quote the
        // one that came back rather than the one this panel rendered with.
        let version = saved.event.version;

        // An inquiry cannot jump straight to confirmed - the booking rules only
        // allow it through a hold - so it takes both steps rather than failing.
        if (event.bookingStatus === "INQUIRY") {
          version = await transitionTo("TENTATIVE_HOLD", version);
        }

        await transitionTo("CONFIRMED", version);
      }

      await onEventSaved();
      setFeedback({
        tone: "success",
        text:
          intent === "confirm"
            ? "Event confirmed. The details were saved first."
            : "Event details saved successfully."
      });
    } catch (error) {
      setFeedback({
        tone: "error",
        text:
          error instanceof Error ? error.message : "Could not save this event."
      });
    } finally {
      setPendingIntent(null);
    }
  }

  function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    void submit("save");
  }

  return (
    <form
      className="relative rounded-lg border border-[#1f4d73] bg-white shadow-sm shadow-[#1f4d73]/10"
      // The schema decides what is acceptable. Leaving the browser's own
      // validation on would swallow the submit first and replace those messages
      // with its generic bubble.
      noValidate
      onSubmit={handleSubmit}
    >
      <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
        <LineIcon name="calendar" />
        <h2 className="text-sm font-black text-[#17202a]">Event information</h2>
      </header>

      <div className="p-3">
        <BookingFormFields
          columns={3}
          errors={errors}
          eventTypes={eventTypes}
          halls={halls}
          idPrefix="event-details"
          onChange={updateValue}
          onPhoneCountryChange={setPhoneCountry}
          phoneCountry={phoneCountry}
          // No country picker here: this panel edits a number that was already
          // saved with a country, so the picker only ever restated it - and the
          // three-column grid makes this the tightest phone field in the app.
          // An overseas number can still be typed in full, with its own "+".
          showPhoneCountry={false}
          values={values}
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1f4d73] px-4 text-xs font-black text-white hover:bg-[#15344f] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={isBusy}
            type="submit"
          >
            <LineIcon name="save" className="h-4 w-4" />
            {pendingIntent === "save" ? "Saving..." : "Save event details"}
          </button>

          <button
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#b9c2cf] bg-white px-4 text-xs font-black text-[#17202a] hover:bg-[#eef4fa] disabled:cursor-not-allowed disabled:opacity-45"
            disabled={isBusy || !canConfirm}
            onClick={() => void submit("confirm")}
            title={
              canConfirm
                ? "Save these details and confirm the booking"
                : "This event is no longer waiting to be confirmed."
            }
            type="button"
          >
            <LineIcon name="check" className="h-4 w-4" />
            {pendingIntent === "confirm" ? "Confirming..." : "Confirm event"}
          </button>

          {feedback ? (
            <div
              className={`flex w-full items-start gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
                feedback.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
              role={feedback.tone === "success" ? "status" : "alert"}
            >
              <LineIcon
                name={feedback.tone === "success" ? "check" : "close"}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>{feedback.text}</span>
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}
