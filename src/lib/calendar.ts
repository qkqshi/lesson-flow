import "server-only";

import { google, type calendar_v3 } from "googleapis";
import { z } from "zod";

import { APP_TIME_ZONE, APP_UTC_OFFSET, requiredEnv } from "@/lib/config";
import { getGoogleConnection, removeGoogleConnection } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { dayBounds } from "@/lib/time";
import { decryptToken } from "@/lib/token-crypto";

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const eventMutationSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    startTime: z.string().regex(timePattern),
    endTime: z.string().regex(timePattern),
    description: z.string().trim().max(2000).optional().default(""),
    location: z.string().trim().max(500).optional().default(""),
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "Время окончания должно быть позже времени начала.",
    path: ["endTime"],
  });

export type EventMutation = z.infer<typeof eventMutationSchema>;

export type CalendarEventDto = {
  id: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  recurring: boolean;
  htmlLink?: string;
};

function oauthClient() {
  return new google.auth.OAuth2(
    requiredEnv("GOOGLE_CLIENT_ID"),
    requiredEnv("GOOGLE_CLIENT_SECRET"),
    requiredEnv("GOOGLE_REDIRECT_URI"),
  );
}

export function createGoogleAuthorizationUrl(state: string): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    include_granted_scopes: true,
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

async function calendarForUser(
  telegramId: string,
): Promise<{ api: calendar_v3.Calendar; calendarId: string }> {
  const connection = await getGoogleConnection(telegramId);

  if (!connection) {
    throw new HttpError(409, "GOOGLE_NOT_CONNECTED", "Сначала подключите Google Calendar.");
  }

  const auth = oauthClient();
  auth.setCredentials({
    refresh_token: decryptToken(connection.encrypted_refresh_token),
  });

  return {
    api: google.calendar({ version: "v3", auth }),
    calendarId: connection.calendar_id,
  };
}

function normalizeEvent(event: calendar_v3.Schema$Event): CalendarEventDto | null {
  const start = event.start?.dateTime ?? event.start?.date;
  const end = event.end?.dateTime ?? event.end?.date;

  if (!event.id || !start || !end) {
    return null;
  }

  return {
    id: event.id,
    title: event.summary?.trim() || "Без названия",
    description: event.description ?? "",
    location: event.location ?? "",
    start,
    end,
    allDay: Boolean(event.start?.date),
    recurring: Boolean(event.recurringEventId || event.recurrence?.length),
    htmlLink: event.htmlLink ?? undefined,
  };
}

function eventResource(input: EventMutation): calendar_v3.Schema$Event {
  return {
    summary: input.title,
    description: input.description || undefined,
    location: input.location || undefined,
    start: {
      dateTime: `${input.date}T${input.startTime}:00${APP_UTC_OFFSET}`,
      timeZone: APP_TIME_ZONE,
    },
    end: {
      dateTime: `${input.date}T${input.endTime}:00${APP_UTC_OFFSET}`,
      timeZone: APP_TIME_ZONE,
    },
    extendedProperties: {
      private: { teacherMiniApp: "true" },
    },
  };
}

export async function listCalendarEvents(
  telegramId: string,
  date: string,
): Promise<CalendarEventDto[]> {
  return listCalendarEventsBetween(telegramId, dayBounds(date));
}

export async function listCalendarEventsBetween(
  telegramId: string,
  bounds: { timeMin: string; timeMax: string },
): Promise<CalendarEventDto[]> {
  const { api, calendarId } = await calendarForUser(telegramId);
  const items: calendar_v3.Schema$Event[] = [];
  let pageToken: string | undefined;

  do {
    const response = await api.events.list({
      calendarId,
      timeMin: bounds.timeMin,
      timeMax: bounds.timeMax,
      timeZone: APP_TIME_ZONE,
      singleEvents: true,
      orderBy: "startTime",
      showDeleted: false,
      maxResults: 2500,
      pageToken,
      fields:
        "nextPageToken,items(id,summary,description,location,start,end,recurringEventId,recurrence,htmlLink)",
    });

    items.push(...(response.data.items ?? []));
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return items.flatMap((event) => {
    const normalized = normalizeEvent(event);
    return normalized ? [normalized] : [];
  });
}

export async function createCalendarEvent(
  telegramId: string,
  input: EventMutation,
): Promise<CalendarEventDto> {
  const { api, calendarId } = await calendarForUser(telegramId);
  const response = await api.events.insert({
    calendarId,
    requestBody: eventResource(input),
  });
  const event = normalizeEvent(response.data);

  if (!event) {
    throw new Error("Google Calendar returned an incomplete event");
  }

  return event;
}

export async function updateCalendarEvent(
  telegramId: string,
  eventId: string,
  input: EventMutation,
): Promise<CalendarEventDto> {
  const { api, calendarId } = await calendarForUser(telegramId);
  const response = await api.events.patch({
    calendarId,
    eventId,
    requestBody: eventResource(input),
  });
  const event = normalizeEvent(response.data);

  if (!event) {
    throw new Error("Google Calendar returned an incomplete event");
  }

  return event;
}

export async function deleteCalendarEvent(
  telegramId: string,
  eventId: string,
): Promise<void> {
  const { api, calendarId } = await calendarForUser(telegramId);
  await api.events.delete({ calendarId, eventId });
}

export async function disconnectGoogleCalendar(
  telegramId: string,
): Promise<void> {
  const connection = await getGoogleConnection(telegramId);

  if (!connection) {
    return;
  }

  const refreshToken = decryptToken(connection.encrypted_refresh_token);
  const auth = oauthClient();

  try {
    await auth.revokeToken(refreshToken);
  } catch (error) {
    console.warn("Google token revocation failed; removing the local connection", error);
  }

  await removeGoogleConnection(telegramId);
}
