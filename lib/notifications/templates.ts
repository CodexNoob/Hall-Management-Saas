import "server-only";

/**
 * The emails themselves.
 *
 * KEPT AWAY FROM THE SENDER, which is about who and whether, not about wording.
 * A template that needed a recipient's permissions to decide what to say would
 * be a second access rule living somewhere nobody would look for one.
 *
 * INTERNAL STAFF EMAIL, AND IT SAYS LESS THAN IT COULD. There is no client
 * phone number, no address, no contract value and no invoice figure in here -
 * a notification goes to everybody entitled to know THAT something happened,
 * which is a wider group than the people entitled to every detail of it. The
 * dashboard is where the detail lives, behind the permission checks that
 * already exist.
 */

/**
 * Escaped, because a client name is free text somebody typed.
 *
 * "Brown & Sons" has to survive, and a name containing a tag has to not become
 * one. The same helper the support notifications use.
 */
function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;"
    };

    return entities[character] ?? character;
  });
}

/**
 * The date, in a form that is unambiguous in every country.
 *
 * DELIBERATELY NOT the organization's Date Format. That setting is about how a
 * date reads on screen for somebody looking at it in context; an email lands in
 * an inbox weeks later, and "09/10/2026" means two different days depending on
 * who opens it. An ISO-style date with a named month cannot be misread.
 *
 * `en-GB` with a long month is not a locale choice - it is the arrangement that
 * puts the day first and spells the month out.
 */
function emailDate(value: Date | string | null | undefined) {
  if (!value) return "a date to be confirmed";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "a date to be confirmed";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    // The stored value is a calendar date at UTC midnight; reading it in any
    // western zone would print the day before.
    timeZone: "UTC"
  }).format(date);
}

type BookingEmailEvent = {
  clientName: string | null;
  eventType: string | null;
  eventDate: Date | string | null;
  hallName?: string | null;
  hall?: { name: string | null } | null;
};

/** A new confirmed booking. */
export function bookingConfirmedEmail(event: BookingEmailEvent) {
  const title = escapeHtml(event.clientName?.trim() || "A new booking");
  const kind = escapeHtml(event.eventType?.trim() || "Event");
  const hall = escapeHtml(
    event.hall?.name?.trim() || event.hallName?.trim() || "a hall to be confirmed"
  );

  return {
    subject: `Booking confirmed: ${event.clientName?.trim() || "new event"}`,
    html: [
      "<h2>Booking confirmed</h2>",
      `<p><strong>${title}</strong> — ${kind}</p>`,
      `<p>${escapeHtml(emailDate(event.eventDate))}, ${hall}</p>`,
      "<p>Open Event Core to see the full details.</p>"
    ].join("")
  };
}
