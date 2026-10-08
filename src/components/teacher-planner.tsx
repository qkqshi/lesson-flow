"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";

import { StudentStatistics } from "@/components/student-statistics";

type CalendarEvent = {
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

type AuthResult = {
  user: { firstName: string };
  googleConnected: boolean;
  demoMode: boolean;
};

type EventDraft = {
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  description: string;
  location: string;
};

const APP_TIME_ZONE = "Europe/Samara";

function dateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateFromKey(value: string): Date {
  return new Date(value + "T12:00:00+04:00");
}

function shiftDate(value: string, days: number): string {
  const date = dateFromKey(value);
  date.setUTCDate(date.getUTCDate() + days);
  return dateKey(date);
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(dateFromKey(value));
}

function formatMonth(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: APP_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(dateFromKey(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function timeFromEvent(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function dateFromEvent(value: string): string {
  return dateKey(new Date(value));
}

function initialDraft(date: string): EventDraft {
  return {
    title: "",
    date,
    startTime: "10:00",
    endTime: "11:00",
    description: "",
    location: "",
  };
}

async function responseJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    let message = "Не удалось выполнить запрос.";

    if (
      body &&
      typeof body === "object" &&
      "error" in body &&
      body.error &&
      typeof body.error === "object" &&
      "message" in body.error &&
      typeof body.error.message === "string"
    ) {
      message = body.error.message;
    }

    throw new Error(message);
  }

  return body as T;
}

async function fetchEventsForDate(date: string): Promise<CalendarEvent[]> {
  const response = await fetch(
    "/api/events?date=" + encodeURIComponent(date),
    { cache: "no-store" },
  );
  const data = await responseJson<{ events: CalendarEvent[] }>(response);

  return [...data.events].sort((left, right) =>
    left.start.localeCompare(right.start),
  );
}

async function fetchGoogleConnectionState(): Promise<{
  connected: boolean;
  url: string | null;
}> {
  const response = await fetch("/api/google/connect", {
    cache: "no-store",
  });
  return responseJson(response);
}

function telegramImpact(style: "light" | "medium" | "heavy" = "light") {
  const webApp = window.Telegram?.WebApp;

  if (!webApp?.initData) {
    return;
  }

  webApp.HapticFeedback?.impactOccurred(style);
}

function telegramNotice(type: "error" | "success" | "warning") {
  const webApp = window.Telegram?.WebApp;

  if (!webApp?.initData) {
    return;
  }

  webApp.HapticFeedback?.notificationOccurred(type);
}

function SettingsIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z" />
      <path d="M19.2 13.1a7.8 7.8 0 0 0 .05-1.1 7.8 7.8 0 0 0-.05-1.1l1.62-1.27-1.8-3.12-1.91.77a8.1 8.1 0 0 0-1.9-1.1L14.9 4.15h-3.6l-.3 2.03a8.1 8.1 0 0 0-1.9 1.1l-1.91-.77-1.8 3.12L7 10.9A7.8 7.8 0 0 0 6.95 12c0 .37.02.73.05 1.1l-1.62 1.27 1.8 3.12 1.91-.77a8.1 8.1 0 0 0 1.9 1.1l.31 2.03h3.6l.3-2.03a8.1 8.1 0 0 0 1.9-1.1l1.91.77 1.8-3.12-1.61-1.27Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.5" y="5.25" width="17" height="15.25" rx="3" />
      <path d="M7.5 3.5v3.25M16.5 3.5v3.25M3.5 9.25h17" />
      <path d="M8 13h2M14 13h2M8 16.5h2M14 16.5h2" />
    </svg>
  );
}

function StudentsIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.75 19.25v-1.5A4.75 4.75 0 0 1 8.5 13h1A4.75 4.75 0 0 1 14.25 17.75v1.5" />
      <circle cx="17.25" cy="9.25" r="2.25" />
      <path d="M15.75 14.25h1.75a3 3 0 0 1 3 3v2" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2.75v2M12 19.25v2M2.75 12h2M19.25 12h2M5.46 5.46l1.42 1.42M17.12 17.12l1.42 1.42M18.54 5.46l-1.42 1.42M6.88 17.12l-1.42 1.42" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 7.5v5l3.25 1.75" />
    </svg>
  );
}

function ChevronIcon({ direction = "right" }: { direction?: "left" | "right" }) {
  return (
    <svg className="ui-icon ui-icon--chevron" viewBox="0 0 24 24" aria-hidden="true" data-direction={direction}>
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function TeacherPlanner() {
  const today = useMemo(() => dateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(today);
  const [auth, setAuth] = useState<AuthResult | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "schedule" | "students" | "settings"
  >("schedule");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [draft, setDraft] = useState<EventDraft>(() => initialDraft(today));

  const weekDays = useMemo(
    () =>
      [-3, -2, -1, 0, 1, 2, 3].map((offset) => {
        const value = shiftDate(selectedDate, offset);
        const date = dateFromKey(value);
        return {
          value,
          day: new Intl.DateTimeFormat("ru-RU", {
            timeZone: APP_TIME_ZONE,
            day: "2-digit",
          }).format(date),
          weekday: new Intl.DateTimeFormat("ru-RU", {
            timeZone: APP_TIME_ZONE,
            weekday: "short",
          })
            .format(date)
            .replace(".", ""),
        };
      }),
    [selectedDate],
  );

  const loadEvents = useCallback(async (date: string) => {
    try {
      const nextEvents = await fetchEventsForDate(date);
      setEvents(nextEvents);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Не удалось загрузить расписание.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshGoogleState = useCallback(async () => {
    if (!auth || auth.demoMode) {
      return;
    }

    try {
      const data = await fetchGoogleConnectionState();

      if (data.connected && !auth?.googleConnected) {
        setLoading(true);
      }

      setGoogleUrl(data.url);
      setAuth((current) => {
        if (!current || current.googleConnected === data.connected) {
          return current;
        }

        return { ...current, googleConnected: data.connected };
      });
    } catch (stateError) {
      setError(
        stateError instanceof Error
          ? stateError.message
          : "Не удалось проверить подключение Google.",
      );
    }
  }, [auth]);

  useEffect(() => {
    let cancelled = false;

    async function authenticate() {
      const webApp = window.Telegram?.WebApp;
      webApp?.ready();
      webApp?.expand();

      try {
        const response = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ initData: webApp?.initData ?? "" }),
        });
        const result = await responseJson<AuthResult>(response);

        if (!cancelled) {
          setAuth(result);
          if (!result.demoMode && !result.googleConnected) {
            setLoading(false);
          }
        }
      } catch (authError) {
        if (!cancelled) {
          setError(
            authError instanceof Error
              ? authError.message
              : "Не удалось войти через Telegram.",
          );
          setLoading(false);
        }
      }
    }

    void authenticate();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!auth) {
      return;
    }

    let cancelled = false;

    if (!auth.demoMode && !auth.googleConnected) {
      void fetchGoogleConnectionState()
        .then((data) => {
          if (cancelled) {
            return;
          }

          setGoogleUrl(data.url);
          setAuth((current) =>
            current && current.googleConnected !== data.connected
              ? { ...current, googleConnected: data.connected }
              : current,
          );
        })
        .catch((stateError: unknown) => {
          if (!cancelled) {
            setError(
              stateError instanceof Error
                ? stateError.message
                : "Не удалось проверить подключение Google.",
            );
          }
        });
    } else {
      void fetchEventsForDate(selectedDate)
        .then((nextEvents) => {
          if (!cancelled) {
            setEvents(nextEvents);
          }
        })
        .catch((loadError: unknown) => {
          if (!cancelled) {
            setError(
              loadError instanceof Error
                ? loadError.message
                : "Не удалось загрузить расписание.",
            );
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [auth, selectedDate]);

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        void refreshGoogleState();
      }
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [refreshGoogleState]);

  function chooseDate(value: string) {
    telegramImpact();
    setError(null);
    if (canUseCalendar) {
      setLoading(true);
    }
    setSelectedDate(value);
  }

  function openCreate() {
    telegramImpact("medium");
    setEditingEvent(null);
    setDraft(initialDraft(selectedDate));
    setSheetOpen(true);
  }

  function openEdit(event: CalendarEvent) {
    if (event.allDay) {
      setError("События на весь день пока редактируются в Google Calendar.");
      telegramNotice("warning");
      return;
    }

    telegramImpact();
    setEditingEvent(event);
    setDraft({
      title: event.title,
      date: dateFromEvent(event.start),
      startTime: timeFromEvent(event.start),
      endTime: timeFromEvent(event.end),
      description: event.description,
      location: event.location,
    });
    setSheetOpen(true);
  }

  function updateDraft(field: keyof EventDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function submitEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const endpoint = editingEvent
      ? "/api/events/" + encodeURIComponent(editingEvent.id)
      : "/api/events";

    try {
      const response = await fetch(endpoint, {
        method: editingEvent ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      await responseJson<{ event: CalendarEvent }>(response);
      setSheetOpen(false);
      telegramNotice("success");

      if (draft.date === selectedDate) {
        setLoading(true);
        await loadEvents(selectedDate);
      } else {
        setLoading(true);
        setSelectedDate(draft.date);
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Не удалось сохранить занятие.",
      );
      telegramNotice("error");
    } finally {
      setSaving(false);
    }
  }

  async function removeEvent() {
    if (!editingEvent || !window.confirm("Удалить это занятие?")) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/events/" + encodeURIComponent(editingEvent.id),
        { method: "DELETE" },
      );

      if (!response.ok) {
        await responseJson(response);
      }

      setSheetOpen(false);
      telegramNotice("success");
      setLoading(true);
      await loadEvents(selectedDate);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Не удалось удалить занятие.",
      );
      telegramNotice("error");
    } finally {
      setSaving(false);
    }
  }

  function connectGoogle() {
    if (!googleUrl) {
      return;
    }

    telegramImpact();
    const webApp = window.Telegram?.WebApp;

    if (webApp?.openLink) {
      webApp.openLink(googleUrl);
    } else {
      window.open(googleUrl, "_blank", "noopener,noreferrer");
    }
  }

  async function disconnectGoogle() {
    if (!window.confirm("Отключить Google Calendar?")) {
      return;
    }

    try {
      const response = await fetch("/api/google/disconnect", {
        method: "DELETE",
      });

      if (!response.ok) {
        await responseJson(response);
      }

      setAuth((current) =>
        current ? { ...current, googleConnected: false } : current,
      );
      setEvents([]);
      setGoogleUrl(null);
      await refreshGoogleState();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Не удалось отключить Google Calendar.",
      );
    }
  }

  const canUseCalendar = Boolean(
    auth && (auth.demoMode || auth.googleConnected),
  );
  const firstEvent = events[0];

  return (
    <main className="app-shell">
      <div className="ambient ambient--one" />
      <div className="ambient ambient--two" />

      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          {auth?.user.firstName?.slice(0, 1).toLocaleUpperCase("ru-RU") ?? "У"}
        </div>
        <div className="topbar__copy">
          <p className="eyebrow">Личный план</p>
          <strong>{auth ? auth.user.firstName : "Преподаватель"}</strong>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Открыть настройки"
          title="Настройки"
          onClick={() => setActiveTab("settings")}
        >
          <SettingsIcon />
        </button>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Закрыть">
            ×
          </button>
        </div>
      ) : null}

      {activeTab === "schedule" ? (
        <>
          <section className="hero">
            <p className="eyebrow">
              {selectedDate === today ? "Сегодня" : "Выбранный день"}
            </p>
            <h1>{formatLongDate(selectedDate)}</h1>
            <p className="hero__note">
              {loading
                ? "Собираю расписание…"
                : events.length
                  ? "Всё на виду — можно спокойно готовиться."
                  : "Свободный день или время добавить занятие."}
            </p>
          </section>

          <section className="date-deck" aria-label="Выбор даты">
            <div className="month-row">
              <button
                className="date-arrow"
                type="button"
                aria-label="Предыдущая неделя"
                onClick={() => chooseDate(shiftDate(selectedDate, -7))}
              >
                <ChevronIcon direction="left" />
              </button>
              <button
                className="month-label"
                type="button"
                onClick={() => chooseDate(today)}
              >
                {formatMonth(selectedDate)}
              </button>
              <button
                className="date-arrow"
                type="button"
                aria-label="Следующая неделя"
                onClick={() => chooseDate(shiftDate(selectedDate, 7))}
              >
                <ChevronIcon />
              </button>
            </div>

            <div className="week-strip">
              {weekDays.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className="day-button"
                  data-selected={day.value === selectedDate}
                  data-today={day.value === today}
                  aria-pressed={day.value === selectedDate}
                  onClick={() => chooseDate(day.value)}
                >
                  <span>{day.weekday}</span>
                  <strong>{day.day}</strong>
                </button>
              ))}
            </div>

            <label className="date-picker">
              <span>Перейти к дате</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => chooseDate(event.target.value)}
              />
            </label>
          </section>

          {!canUseCalendar && auth ? (
            <section className="connect-card">
              <span className="connect-card__glyph" aria-hidden="true">
                31
              </span>
              <div>
                <p className="eyebrow">Один шаг</p>
                <h2>Подключите Google Calendar</h2>
                <p>
                  События останутся в вашем календаре. Приложение получит только
                  доступ к занятиям.
                </p>
              </div>
              <button
                className="primary-button"
                type="button"
                disabled={!googleUrl}
                onClick={connectGoogle}
              >
                {googleUrl ? "Подключить Google" : "Готовлю безопасную ссылку…"}
              </button>
            </section>
          ) : (
            <>
              <section className="day-summary" aria-label="Сводка дня">
                <div>
                  <span>Занятий</span>
                  <strong>{loading ? "—" : events.length}</strong>
                </div>
                <div>
                  <span>Ближайшее</span>
                  <strong>
                    {loading
                      ? "—"
                      : firstEvent
                        ? firstEvent.allDay
                          ? "Весь день"
                          : formatTime(firstEvent.start)
                        : "Свободно"}
                  </strong>
                </div>
                <div>
                  <span>Напоминание</span>
                  <strong>08:00</strong>
                </div>
              </section>

              <section className="schedule-section">
                <div className="section-heading">
                  <div>
                    <p className="eyebrow">Расписание</p>
                    <h2>{loading ? "Обновляю…" : "Ваши уроки"}</h2>
                  </div>
                  {auth?.demoMode ? <span className="demo-chip">Демо</span> : null}
                </div>

                {loading ? (
                  <div className="event-list" aria-label="Загрузка расписания">
                    {[0, 1, 2].map((item) => (
                      <div className="event-skeleton" key={item} />
                    ))}
                  </div>
                ) : events.length ? (
                  <div className="event-list">
                    {events.map((event, index) => (
                      <button
                        type="button"
                        className="event-row"
                        key={event.id}
                        onClick={() => openEdit(event)}
                        style={{ "--event-index": index } as CSSProperties}
                      >
                        <span className="event-time">
                          {event.allDay ? (
                            "день"
                          ) : (
                            <>
                              <strong>{formatTime(event.start)}</strong>
                              <small>{formatTime(event.end)}</small>
                            </>
                          )}
                        </span>
                        <span className="event-line" aria-hidden="true">
                          <i />
                        </span>
                        <span className="event-card">
                          <span className="event-card__top">
                            <strong>{event.title}</strong>
                            <span aria-hidden="true">
                              <ChevronIcon />
                            </span>
                          </span>
                          {event.description ? <small>{event.description}</small> : null}
                          <span className="event-meta">
                            {event.location ? <em>{event.location}</em> : null}
                            {event.recurring ? <em>Повтор</em> : null}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span aria-hidden="true">
                      <CalendarIcon />
                    </span>
                    <h3>Занятий нет</h3>
                    <p>Оставьте день свободным или добавьте новый урок.</p>
                  </div>
                )}
              </section>
            </>
          )}

          {canUseCalendar ? (
            <button
              className="floating-add"
              type="button"
              onClick={openCreate}
              aria-label="Добавить занятие"
            >
              <span aria-hidden="true">
                <PlusIcon />
              </span>
              Добавить
            </button>
          ) : null}
        </>
      ) : activeTab === "students" ? (
        <StudentStatistics
          enabled={canUseCalendar}
          canConnect={Boolean(googleUrl)}
          onConnect={connectGoogle}
          onOpenSchedule={() => setActiveTab("schedule")}
        />
      ) : (
        <section className="settings-view">
          <p className="eyebrow">Настройки</p>
          <h1>Всё под контролем</h1>

          <article className="setting-card">
            <div className="setting-icon setting-icon--calendar">31</div>
            <div>
              <h2>Google Calendar</h2>
              <p>
                {auth?.demoMode
                  ? "Сейчас включён локальный демо-режим."
                  : auth?.googleConnected
                    ? "Основной календарь подключён."
                    : "Календарь ещё не подключён."}
              </p>
            </div>
            {auth?.googleConnected && !auth.demoMode ? (
              <button className="text-button text-button--danger" type="button" onClick={disconnectGoogle}>
                Отключить
              </button>
            ) : !auth?.demoMode ? (
              <button className="text-button" type="button" disabled={!googleUrl} onClick={connectGoogle}>
                Подключить
              </button>
            ) : null}
          </article>

          <article className="setting-card">
            <div className="setting-icon">
              <SunIcon />
            </div>
            <div>
              <h2>Утреннее сообщение</h2>
              <p>Каждый день в 08:00, включая дни без занятий.</p>
            </div>
            <strong className="status-dot">Вкл.</strong>
          </article>

          <article className="setting-card">
            <div className="setting-icon">
              <ClockIcon />
            </div>
            <div>
              <h2>Часовой пояс</h2>
              <p>Самара · МСК+1 · UTC+4</p>
            </div>
          </article>

          <article className="privacy-note">
            <p className="eyebrow">Личное пространство</p>
            <h2>Доступ только у администраторов</h2>
            <p>
              Сервер проверяет подпись Telegram и разрешённый числовой ID перед
              каждым действием. Google-токен хранится в зашифрованном виде.
            </p>
          </article>
        </section>
      )}

      <footer className="legal-footer">
        <span>Teacher Planner · Google Calendar и Telegram</span>
        <nav aria-label="Юридическая информация">
          <a href="/privacy">Конфиденциальность</a>
          <a href="/terms">Условия</a>
        </nav>
      </footer>

      <nav className="bottom-nav" aria-label="Основная навигация">
        <button
          type="button"
          data-active={activeTab === "schedule"}
          aria-current={activeTab === "schedule" ? "page" : undefined}
          onClick={() => setActiveTab("schedule")}
        >
          <span aria-hidden="true">
            <CalendarIcon />
          </span>
          Расписание
        </button>
        <button
          type="button"
          data-active={activeTab === "students"}
          aria-current={activeTab === "students" ? "page" : undefined}
          onClick={() => setActiveTab("students")}
        >
          <span aria-hidden="true">
            <StudentsIcon />
          </span>
          Ученики
        </button>
        <button
          type="button"
          data-active={activeTab === "settings"}
          aria-current={activeTab === "settings" ? "page" : undefined}
          onClick={() => setActiveTab("settings")}
        >
          <span aria-hidden="true">
            <SettingsIcon />
          </span>
          Настройки
        </button>
      </nav>

      {sheetOpen ? (
        <div className="sheet-layer">
          <button
            className="sheet-backdrop"
            type="button"
            aria-label="Закрыть форму"
            onClick={() => setSheetOpen(false)}
          />
          <section
            className="event-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-sheet-title"
          >
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-heading">
              <div>
                <p className="eyebrow">
                  {editingEvent ? "Изменить планы" : "Новое занятие"}
                </p>
                <h2 id="event-sheet-title">
                  {editingEvent ? editingEvent.title : "Добавить урок"}
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Закрыть"
                onClick={() => setSheetOpen(false)}
              >
                <CloseIcon />
              </button>
            </div>

            <form onSubmit={submitEvent}>
              {error ? (
                <div className="sheet-error" role="alert">
                  {error}
                </div>
              ) : null}
              <label className="field field--wide">
                <span>Ученик</span>
                <input
                  autoFocus
                  required
                  maxLength={200}
                  placeholder="Например, Анна"
                  value={draft.title}
                  onChange={(event) => updateDraft("title", event.target.value)}
                />
              </label>

              <div className="field-grid">
                <label className="field field--wide">
                  <span>Дата</span>
                  <input
                    type="date"
                    required
                    value={draft.date}
                    onChange={(event) => updateDraft("date", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Начало</span>
                  <input
                    type="time"
                    required
                    value={draft.startTime}
                    onChange={(event) =>
                      updateDraft("startTime", event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  <span>Окончание</span>
                  <input
                    type="time"
                    required
                    value={draft.endTime}
                    onChange={(event) =>
                      updateDraft("endTime", event.target.value)
                    }
                  />
                </label>
              </div>

              <label className="field field--wide">
                <span>Место или ссылка</span>
                <input
                  maxLength={500}
                  placeholder="Онлайн"
                  value={draft.location}
                  onChange={(event) => updateDraft("location", event.target.value)}
                />
              </label>

              <label className="field field--wide">
                <span>Заметка</span>
                <textarea
                  maxLength={2000}
                  rows={3}
                  placeholder="Тема, домашнее задание…"
                  value={draft.description}
                  onChange={(event) =>
                    updateDraft("description", event.target.value)
                  }
                />
              </label>

              <div className="form-actions">
                {editingEvent ? (
                  <button
                    className="danger-button"
                    type="button"
                    disabled={saving}
                    onClick={removeEvent}
                  >
                    Удалить
                  </button>
                ) : null}
                <button className="primary-button" type="submit" disabled={saving}>
                  {saving
                    ? "Сохраняю…"
                    : editingEvent
                      ? "Сохранить"
                      : "Добавить занятие"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
