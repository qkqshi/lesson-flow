"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

type StudentItem = {
  normalizedName: string;
  displayName: string;
  lessonPriceKopecks: number | null;
  lessonCount: number;
  projectedIncomeKopecks: number;
};

type StatisticsResponse = {
  month: string;
  mode: "actual" | "plan";
  students: StudentItem[];
  lessonCount: number;
  activeStudentCount: number;
  projectedIncomeKopecks: number;
  unpricedStudentCount: number;
};

type Props = {
  enabled: boolean;
  canConnect: boolean;
  onConnect: () => void;
  onOpenSchedule: () => void;
};

function currentMonth(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Samara",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
}

function shiftMonth(value: string, offset: number): string {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + offset, 1))
    .toISOString()
    .slice(0, 7);
}

function monthLabel(value: string): string {
  const [year, month] = value.split("-").map(Number);
  const label = new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label[0].toLocaleUpperCase("ru-RU") + label.slice(1);
}

function money(kopecks: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: kopecks % 100 === 0 ? 0 : 2,
  }).format(kopecks / 100);
}

function lessons(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "занятие";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "занятия";
  }
  return "занятий";
}

async function json<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const apiError =
      body &&
      typeof body === "object" &&
      "error" in body &&
      body.error &&
      typeof body.error === "object" &&
      "message" in body.error &&
      typeof body.error.message === "string"
        ? body.error.message
        : "Не удалось выполнить запрос.";
    throw new Error(apiError);
  }
  return body as T;
}

function Arrow({ left = false }: { left?: boolean }) {
  return (
    <svg
      className="ui-icon ui-icon--chevron"
      viewBox="0 0 24 24"
      aria-hidden="true"
      data-direction={left ? "left" : "right"}
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 7.5h15M9.5 4.5h5M7.5 7.5l.7 12h7.6l.7-12M10 11v5M14 11v5" />
    </svg>
  );
}

export function StudentStatistics({
  enabled,
  canConnect,
  onConnect,
  onOpenSchedule,
}: Props) {
  const firstMonth = useMemo(() => shiftMonth(currentMonth(), 1), []);
  const [month, setMonth] = useState(firstMonth);
  const [data, setData] = useState<StatisticsResponse | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [lessonDrafts, setLessonDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const planning =
    data?.month === month ? data.mode === "plan" : month > currentMonth();

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        "/api/students?month=" + encodeURIComponent(month),
        { cache: "no-store" },
      );
      const result = await json<StatisticsResponse>(response);
      setData(result);
      setDrafts(
        Object.fromEntries(
          result.students.map((student) => [
            student.normalizedName,
            student.lessonPriceKopecks === null
              ? ""
              : String(student.lessonPriceKopecks / 100),
          ]),
        ),
      );
      setLessonDrafts(
        Object.fromEntries(
          result.students.map((student) => [
            student.normalizedName,
            String(student.lessonCount),
          ]),
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить статистику.");
    } finally {
      setLoading(false);
    }
  }, [enabled, month]);

  useEffect(() => {
    const task = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function savePrice(
    event: FormEvent<HTMLFormElement>,
    student: StudentItem,
  ) {
    event.preventDefault();
    const raw = (drafts[student.normalizedName] ?? "").trim().replace(",", ".");
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1_000_000)) {
      setError("Укажите цену от 0 до 1 000 000 рублей.");
      return;
    }
    const plannedRaw = (lessonDrafts[student.normalizedName] ?? "").trim();
    let plannedLessonCount: number | undefined;
    if (planning) {
      const parsedLessonCount = Number(plannedRaw);
      if (
        !Number.isInteger(parsedLessonCount) ||
        parsedLessonCount < 0 ||
        parsedLessonCount > 1000
      ) {
        setError("Укажите количество занятий от 0 до 1000.");
        return;
      }
      plannedLessonCount = parsedLessonCount;
    }

    setSaving(student.normalizedName);
    setSaved(null);
    setError(null);
    try {
      await json(
        await fetch("/api/students", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            normalizedName: student.normalizedName,
            month,
            lessonPriceRubles: value,
            plannedLessonCount,
          }),
        }),
      );
      setSaved(student.normalizedName);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить цену.");
    } finally {
      setSaving(null);
    }
  }

  async function deleteStudent(student: StudentItem) {
    if (
      !window.confirm(
        `Удалить «${student.displayName}» из списка учеников? Календарное событие останется без изменений.`,
      )
    ) {
      return;
    }

    setDeleting(student.normalizedName);
    setError(null);
    try {
      await json(
        await fetch("/api/students", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ normalizedName: student.normalizedName }),
        }),
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить ученика.");
    } finally {
      setDeleting(null);
    }
  }

  if (!enabled) {
    return (
      <section className="students-view">
        <header className="students-heading">
          <p className="eyebrow">Ученики</p>
          <h1>Доход по расписанию</h1>
          <p>Подключите календарь, чтобы собрать учеников и занятия.</p>
        </header>
        <div className="students-empty">
          <span className="students-empty__mark" aria-hidden="true">₽</span>
          <h2>Нужен Google Calendar</h2>
          <p>Имя ученика берётся из названия события.</p>
          <button className="primary-button" type="button" disabled={!canConnect} onClick={onConnect}>
            {canConnect ? "Подключить Google" : "Готовлю ссылку…"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="students-view">
      <header className="students-heading">
        <p className="eyebrow">Ученики</p>
        <h1>{planning ? "План на месяц" : "Статистика занятий"}</h1>
        <p>
          {planning
            ? "Количество занятий задаётся вручную для каждого ученика."
            : "Фактические занятия считаются по событиям Google Calendar."}
        </p>
      </header>

      <div className="month-switcher" aria-label="Месяц статистики">
        <button type="button" aria-label="Предыдущий месяц" onClick={() => setMonth(shiftMonth(month, -1))}>
          <Arrow left />
        </button>
        <label>
          <span>{monthLabel(month)}</span>
          <input
            type="month"
            value={month}
            min="2020-01"
            max="2100-12"
            onChange={(event) => {
              if (event.target.value) setMonth(event.target.value);
            }}
          />
        </label>
        <button type="button" aria-label="Следующий месяц" onClick={() => setMonth(shiftMonth(month, 1))}>
          <Arrow />
        </button>
      </div>

      {error ? <div className="stats-error" role="alert">{error}</div> : null}

      <section className="income-card" aria-label={planning ? "План дохода" : "Фактический доход"}>
        <span>{planning ? "Планируемый доход" : "Доход по календарю"}</span>
        <strong>{loading && !data ? "Загрузка…" : money(data?.projectedIncomeKopecks ?? 0)}</strong>
        <div className="income-card__metrics">
          <div><b>{data?.lessonCount ?? 0}</b><span>{planning ? "в плане" : "занятий"}</span></div>
          <div><b>{data?.activeStudentCount ?? 0}</b><span>учеников</span></div>
        </div>
      </section>

      {data?.unpricedStudentCount ? (
        <p className="price-warning">
          Без цены: {data.unpricedStudentCount}. Эти ученики пока не входят в итоговую сумму.
        </p>
      ) : null}

      <div className="student-list-heading">
        <div><h2>Список учеников</h2><p>{monthLabel(month)}</p></div>
        <button className="text-button" type="button" disabled={loading} onClick={() => void load()}>
          Обновить
        </button>
      </div>

      {loading && !data ? (
        <div className="student-list" aria-label="Загрузка учеников">
          {[0, 1, 2].map((item) => <div className="student-skeleton" key={item} />)}
        </div>
      ) : data?.students.length ? (
        <div className="student-list">
          {data.students.map((student) => (
            <article className="student-card" key={student.normalizedName}>
              <div className="student-avatar" aria-hidden="true">
                {student.displayName.slice(0, 1).toLocaleUpperCase("ru-RU")}
              </div>
              <div className="student-card__copy">
                <h3>{student.displayName}</h3>
                <p>
                  {planning ? "План: " : ""}
                  {student.lessonCount} {lessons(student.lessonCount)} ·{" "}
                  {money(student.projectedIncomeKopecks)}
                </p>
              </div>
              <button
                className="student-delete"
                type="button"
                disabled={deleting === student.normalizedName}
                aria-label={"Удалить " + student.displayName}
                onClick={() => void deleteStudent(student)}
              >
                <TrashIcon />
              </button>
              <form
                className="price-editor"
                data-planning={planning}
                onSubmit={(event) => void savePrice(event, student)}
              >
                <label className="price-editor__field">
                  <span>Цена занятия</span>
                  <span className="price-input">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={drafts[student.normalizedName] ?? ""}
                      placeholder="Цена"
                      aria-label={"Цена занятия для " + student.displayName}
                      onChange={(event) => {
                        setSaved(null);
                        setDrafts((current) => ({ ...current, [student.normalizedName]: event.target.value }));
                      }}
                    />
                    <b>₽</b>
                  </span>
                </label>
                {planning ? (
                  <label className="price-editor__field">
                    <span>Занятий в месяце</span>
                    <span className="price-input">
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        max="1000"
                        step="1"
                        value={lessonDrafts[student.normalizedName] ?? "0"}
                        aria-label={"Количество занятий для " + student.displayName}
                        onChange={(event) => {
                          setSaved(null);
                          setLessonDrafts((current) => ({
                            ...current,
                            [student.normalizedName]: event.target.value,
                          }));
                        }}
                      />
                      <b>шт.</b>
                    </span>
                  </label>
                ) : null}
                <button
                  type="submit"
                  disabled={saving === student.normalizedName}
                  data-saved={saved === student.normalizedName}
                >
                  {saving === student.normalizedName ? "Сохраняю" : saved === student.normalizedName ? "Готово" : "Сохранить"}
                </button>
              </form>
            </article>
          ))}
        </div>
      ) : (
        <div className="students-empty">
          <span className="students-empty__mark" aria-hidden="true">+</span>
          <h2>Ученики не найдены</h2>
          <p>Создайте урок и укажите имя ученика в названии события.</p>
          <button className="primary-button" type="button" onClick={onOpenSchedule}>Открыть расписание</button>
        </div>
      )}
    </section>
  );
}
