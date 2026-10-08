import { randomUUID } from "node:crypto";

import type { CalendarEventDto, EventMutation } from "@/lib/calendar";
import { APP_UTC_OFFSET } from "@/lib/config";
import { currentDateInSamara } from "@/lib/time";

type DemoGlobal = typeof globalThis & {
  teacherDemoEvents?: Map<string, CalendarEventDto[]>;
};

const demoGlobal = globalThis as DemoGlobal;

function store(): Map<string, CalendarEventDto[]> {
  demoGlobal.teacherDemoEvents ??= new Map();
  return demoGlobal.teacherDemoEvents;
}

function fromMutation(id: string, input: EventMutation): CalendarEventDto {
  return {
    id,
    title: input.title,
    description: input.description,
    location: input.location,
    start: `${input.date}T${input.startTime}:00${APP_UTC_OFFSET}`,
    end: `${input.date}T${input.endTime}:00${APP_UTC_OFFSET}`,
    allDay: false,
    recurring: false,
  };
}

function initialEvents(date: string): CalendarEventDto[] {
  if (date !== currentDateInSamara()) {
    return [];
  }

  return [
    fromMutation("demo-anna", {
      title: "Анна",
      date,
      startTime: "09:30",
      endTime: "10:30",
      description: "Разговорная практика",
      location: "Онлайн",
    }),
    fromMutation("demo-maxim", {
      title: "Максим",
      date,
      startTime: "13:00",
      endTime: "14:00",
      description: "Подготовка к контрольной",
      location: "Кабинет 214",
    }),
    fromMutation("demo-nikita", {
      title: "Никита",
      date,
      startTime: "17:30",
      endTime: "18:30",
      description: "Новая тема",
      location: "Онлайн",
    }),
  ];
}

export function listDemoEvents(date: string): CalendarEventDto[] {
  const events = store();

  if (!events.has(date)) {
    events.set(date, initialEvents(date));
  }

  return [...(events.get(date) ?? [])];
}

export function createDemoEvent(input: EventMutation): CalendarEventDto {
  const event = fromMutation(`demo-${randomUUID()}`, input);
  const current = listDemoEvents(input.date);
  store().set(input.date, [...current, event]);
  return event;
}

export function updateDemoEvent(
  eventId: string,
  input: EventMutation,
): CalendarEventDto {
  deleteDemoEvent(eventId);
  const event = fromMutation(eventId, input);
  const current = listDemoEvents(input.date);
  store().set(input.date, [...current, event]);
  return event;
}

export function deleteDemoEvent(eventId: string): void {
  for (const [date, events] of store()) {
    const filtered = events.filter((event) => event.id !== eventId);

    if (filtered.length !== events.length) {
      store().set(date, filtered);
      return;
    }
  }
}
