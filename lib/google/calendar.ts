import { google } from "googleapis";
import { createGoogleOAuthClient } from "@/lib/google/oauth";
import { getEnv } from "@/lib/env";
import { trackOutbound } from "@/lib/logging/outbound";

export type CalendarEventInput = {
  title: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  location?: string;
  googleCalendarEventId?: string | null;
};

export async function upsertGoogleCalendarEvent(input: CalendarEventInput) {
  const env = getEnv();

  if (!env.ENABLE_GOOGLE_CALENDAR_SYNC) {
    return { skipped: true as const };
  }

  if (!env.GOOGLE_CALENDAR_ID || !env.GOOGLE_CALENDAR_ENCRYPTED_REFRESH_TOKEN) {
    throw new Error("Google Calendar integration is not configured.");
  }

  // Bound to a local because the calls below are inside a closure now, and
  // TypeScript drops the narrowing the guard above established on a property.
  const calendarId = env.GOOGLE_CALENDAR_ID;
  const auth = createGoogleOAuthClient(env.GOOGLE_CALENDAR_ENCRYPTED_REFRESH_TOKEN);
  const calendar = google.calendar({ version: "v3", auth });
  const requestBody = {
    summary: input.title,
    description: input.description,
    location: input.location,
    start: { dateTime: input.startsAt.toISOString() },
    end: { dateTime: input.endsAt.toISOString() }
  };

  const eventId = input.googleCalendarEventId;

  if (eventId) {
    const updated = await trackOutbound(
      { vendor: "google", operation: "calendar.events.update" },
      () => calendar.events.update({ calendarId, eventId, requestBody })
    );
    return { skipped: false as const, eventId: updated.data.id };
  }

  const created = await trackOutbound(
    { vendor: "google", operation: "calendar.events.insert" },
    () => calendar.events.insert({ calendarId, requestBody })
  );

  return { skipped: false as const, eventId: created.data.id };
}
