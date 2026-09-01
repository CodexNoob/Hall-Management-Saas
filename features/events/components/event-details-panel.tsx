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
import {
  BookingFormFields,
  bookingControlClass
} from "@/features/bookings/forms/booking-form-fields";
import { EventDatePickerDialog } from "@/features/events/forms/event-date-picker-dialog";
import {
  clientContactFields,
  eventDetailsFormSchema,
  fieldErrorPatch,
  liveCountErrors,
  toFieldErrors,
  toGuestCountPayload,
  type BookingFormErrors,
  type EventDetailsFormInput,
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

/** The rows on the card, and the column each one saves to. */
type ContactField = "phone" | "email";

const contactRowClass =
  "flex min-h-12 w-full items-center gap-3 rounded-lg border " +
  "border-[#d8dde5] bg-white px-3 text-left text-sm font-black text-[#17202a]";

const contactIconClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border " +
  "border-[#d8dde5] bg-[#fbfcfd] text-[#1f4d73]";

const contactControlClass =
  "h-9 w-full min-w-0 rounded-lg border border-[#b9c2cf] bg-white px-2 " +
  "text-sm font-bold text-[#17202a] outline-none focus:border-[#1f4d73] " +
  "focus:ring-2 focus:ring-[#1f4d73]/15";

/**
 * Who to contact, edited a row at a time.
 *
 * One row is open at once and each saves on its own, which is why this holds a
 * single `editing` field rather than a form: the card is a list of unrelated
 * facts, and committing the email should not make somebody re-confirm a phone
 * number they never touched.
 *
 * The event's own PATCH takes each of these, so there is no second route -
 * `Event information` simply no longer sends them. That split is what keeps the
 * two cards from overwriting one another.
 */
export function ClientContact({
  event,
  onEventSaved
}: {
  event: EventFile;
  onEventSaved: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState<ContactField | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const phoneCountry = countryFromE164(event.phone) ?? DEFAULT_PHONE_COUNTRY;

  // Whatever was half-typed belonged to the event that was open at the time.
  useEffect(() => {
    setEditing(null);
    setError(null);
  }, [event.id]);

  function startEditing(field: ContactField, current: string) {
    setEditing(field);
    setDraft(current);
    setError(null);
  }

  async function save(field: ContactField) {
    // The booking form's own rules for these three, so a number the calendar
    // would refuse cannot be typed in here instead.
    const parsed = clientContactFields({ country: phoneCountry })[
      field
    ].safeParse(draft);

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "That value is not valid.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await authenticatedFetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: parsed.data })
      });

      if (!response.ok) throw await readApiError(response);

      await onEventSaved();
      setEditing(null);
      setError(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not save."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const rows = [
    {
      field: "phone" as const,
      icon: "phone" as IconName,
      label: event.phone || "Phone not provided",
      href: event.phone ? `tel:${event.phone}` : undefined,
      editLabel: "Edit phone",
      // The national part, which is what the field is typed in - the same hop
      // the booking form makes.
      draftFrom: () => nationalFromE164(event.phone)
    },
    {
      field: "email" as const,
      icon: "mail" as IconName,
      label: event.email || "Email not provided",
      href: event.email ? `mailto:${event.email}` : undefined,
      editLabel: "Edit email",
      draftFrom: () => event.email
    }
  ];

  return (
    <section className="rounded-lg border border-[#d8dde5] bg-white">
      <header className="flex h-11 items-center gap-2 border-b border-[#d8dde5] px-4">
        <LineIcon name="user" />
        <h2 className="text-sm font-black text-[#17202a]">Client contact</h2>
      </header>
      <div className="space-y-3 p-3">
        {rows.map((row) => {
          if (editing === row.field) {
            return (
              <div className={contactRowClass} key={row.field}>
                <span className={contactIconClass}>
                  <LineIcon name={row.icon} />
                </span>

                <div className="min-w-0 flex-1 py-2">
                  <input
                    aria-label={row.field === "phone" ? "Phone" : "Email"}
                    autoFocus
                    className={contactControlClass}
                    disabled={isSaving}
                    inputMode={row.field === "phone" ? "tel" : "email"}
                    onChange={(changeEvent) =>
                      setDraft(changeEvent.target.value)
                    }
                    // Enter commits and Escape abandons, because a row this
                    // small is faster to leave by keyboard than to aim at.
                    onKeyDown={(keyEvent) => {
                      if (keyEvent.key === "Enter") {
                        keyEvent.preventDefault();
                        void save(row.field);
                      }
                      if (keyEvent.key === "Escape") setEditing(null);
                    }}
                    placeholder={row.field === "email" ? "Optional" : undefined}
                    type="text"
                    value={draft}
                  />
                  {error ? (
                    <p
                      className="mt-1 text-[10px] font-bold text-[#c2410c]"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}
                </div>

                <button
                  aria-label="Save"
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-black text-[#1f4d73] hover:bg-[#eef4fa] disabled:opacity-45"
                  disabled={isSaving}
                  onClick={() => void save(row.field)}
                  type="button"
                >
                  {isSaving ? "…" : "Save"}
                </button>
                <button
                  aria-label="Cancel"
                  className="shrink-0 rounded-md px-2 py-1 text-xs font-black text-[#6a7483] hover:bg-[#eef4fa] disabled:opacity-45"
                  disabled={isSaving}
                  onClick={() => setEditing(null)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            );
          }

          return (
            <div className={contactRowClass} key={row.field}>
              <span className={contactIconClass}>
                <LineIcon name={row.icon} />
              </span>

              {/* Still a link, so the row keeps dialling and composing on a
                  phone. The pencil beside it is what opens the editor, rather
                  than the row itself - tapping a number should call it. */}
              {row.href ? (
                <a
                  className="min-w-0 flex-1 truncate hover:underline"
                  href={row.href}
                >
                  {row.label}
                </a>
              ) : (
                <span className="min-w-0 flex-1 truncate">{row.label}</span>
              )}

              {/* Named per row rather than a bare "Edit": three identical
                  buttons in one card are indistinguishable to anything reading
                  by accessible name. The visible word stays short. */}
              <button
                aria-label={row.editLabel}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-black text-[#1f4d73] hover:bg-[#eef4fa]"
                onClick={() => startEditing(row.field, row.draftFrom())}
                type="button"
              >
                Edit
              </button>
            </div>
          );
        })}
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
    email: event.email,
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
  data: EventDetailsFormInput,
  storedTimeInput: string
) {
  return {
    clientName: data.clientName,
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

/** The date on the closed field, in the words the picker's own rows use. */
const eventDateLabelFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric"
});

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
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
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
  // The hall the form currently names, not the one the event was saved under:
  // changing the hall and the date in one edit has to be checked against where
  // the event is going.
  const selectedHallName =
    halls.find((hall) => hall.id === values.hallId)?.name ?? "this hall";
  const eventDateLabel = values.eventDate
    ? eventDateLabelFormatter.format(new Date(`${values.eventDate}T00:00:00`))
    : "Choose a date";

  function updateValue(field: keyof BookingFormValues, value: string) {
    const next = { ...values, [field]: value };

    setFeedback(null);
    // Checked against the form this keystroke produces, not the one it
    // replaced: the counts have to answer for themselves as they are typed
    // rather than holding their complaint until a save.
    setErrors((current) => ({
      ...current,
      ...fieldErrorPatch(field),
      ...liveCountErrors(next)
    }));
    setValues(next);
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
    // The booking dialog's schema less the contact fields, which the Client
    // contact card owns. Everything else is checked exactly as a new booking
    // would be, so an event cannot be edited into a shape that would have been
    // refused when it was created.
    const parsed = eventDetailsFormSchema().safeParse(values);

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
          // A native date input would accept a day this hall cannot take and
          // leave the refusal to the save. The list asks first.
          dateField={({ id }) => (
            <button
              aria-describedby={
                errors.eventDate ? "event-details-date-error" : undefined
              }
              className={`${bookingControlClass} flex items-center justify-between gap-2 text-left`}
              id={id}
              onClick={() => setIsDatePickerOpen(true)}
              type="button"
            >
              <span className={values.eventDate ? "" : "text-[#6a7483]"}>
                {eventDateLabel}
              </span>
              <LineIcon
                className="h-4 w-4 shrink-0 text-[#516071]"
                name="calendar"
              />
            </button>
          )}
          errors={errors}
          eventTypes={eventTypes}
          halls={halls}
          idPrefix="event-details"
          onChange={updateValue}
          onPhoneCountryChange={setPhoneCountry}
          phoneCountry={phoneCountry}
          // The phone and email live on the Client contact card beside this
          // one, which edits them a row at a time. Kept in one place rather
          // than two: a panel still holding a stale phone would put it back
          // over the card's edit on the next save of anything.
          showClientContact={false}
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

      {/*
        Inside the form on purpose: it is a fixed overlay, so it escapes this
        panel's layout anyway, and keeping it here is what lets the date it
        returns land straight in the form's own state.
      */}
      <EventDatePickerDialog
        eventId={event.id}
        hallId={values.hallId}
        hallName={selectedHallName}
        onClose={() => setIsDatePickerOpen(false)}
        onSelect={(nextDateKey) => updateValue("eventDate", nextDateKey)}
        open={isDatePickerOpen}
        selectedDate={values.eventDate}
      />
    </form>
  );
}
