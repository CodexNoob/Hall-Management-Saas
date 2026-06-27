import { google } from "googleapis";
import { createGoogleOAuthClient } from "@/lib/google/oauth";
import { getEnv } from "@/lib/env";

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

  const auth = createGoogleOAuthClient(env.GOOGLE_CALENDAR_ENCRYPTED_REFRESH_TOKEN);
  const calendar = google.calendar({ version: "v3", auth });
  const requestBody = {
    summary: input.title,
    description: input.description,
    location: input.location,
    start: { dateTime: input.startsAt.toISOString() },
    end: { dateTime: input.endsAt.toISOString() }
  };

  if (input.googleCalendarEventId) {
    const updated = await calendar.events.update({
      calendarId: env.GOOGLE_CALENDAR_ID,
      eventId: input.googleCalendarEventId,
      requestBody
    });
    return { skipped: false as const, eventId: updated.data.id };
  }

  const created = await calendar.events.insert({
    calendarId: env.GOOGLE_CALENDAR_ID,
    requestBody
  });

  return { skipped: false as const, eventId: created.data.id };
}
