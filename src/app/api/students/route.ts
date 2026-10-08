import { z } from "zod";

import { listCalendarEventsBetween } from "@/lib/calendar";
import { isDemoMode } from "@/lib/config";
import {
  archiveStudentProfile,
  listStudentMonthPlans,
  syncStudentProfiles,
  updateStudentLessonPrice,
  updateStudentMonthPlan,
} from "@/lib/db";
import { listDemoEvents } from "@/lib/demo-events";
import { HttpError, errorResponse } from "@/lib/http";
import { requireAppSession } from "@/lib/session";
import {
  buildStudentStatistics,
  extractStudentNames,
  normalizeStudentName,
  type StudentProfile,
} from "@/lib/students";
import {
  assertMonthString,
  currentDateInSamara,
  currentMonthInSamara,
  monthBounds,
} from "@/lib/time";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updatePriceSchema = z.object({
  normalizedName: z.string().trim().min(1).max(200),
  month: z.string(),
  lessonPriceRubles: z.number().finite().min(0).max(1_000_000).nullable(),
  plannedLessonCount: z.number().int().min(0).max(1000).optional(),
});

type DemoStudentGlobal = typeof globalThis & {
  teacherDemoStudentPrices?: Map<string, number | null>;
  teacherDemoStudentPlans?: Map<string, number>;
  teacherDemoArchivedStudents?: Set<string>;
};

const demoGlobal = globalThis as DemoStudentGlobal;

function demoProfiles(): StudentProfile[] {
  demoGlobal.teacherDemoStudentPrices ??= new Map();
  demoGlobal.teacherDemoArchivedStudents ??= new Set();

  return ["Анна", "Максим", "Никита"]
    .map((displayName) => {
      const normalizedName = normalizeStudentName(displayName);

      return {
        normalizedName,
        displayName,
        lessonPriceKopecks:
          demoGlobal.teacherDemoStudentPrices?.get(normalizedName) ?? null,
      };
    })
    .filter(
      (student) =>
        !demoGlobal.teacherDemoArchivedStudents?.has(student.normalizedName),
    );
}

function demoPlanKey(month: string, normalizedName: string): string {
  return month + ":" + normalizedName;
}

export async function GET(request: Request) {
  try {
    const session = await requireAppSession();
    const month = assertMonthString(
      new URL(request.url).searchParams.get("month") ?? "",
    );
    const currentMonth = currentMonthInSamara();
    const planning = month > currentMonth;

    if (isDemoMode()) {
      const events =
        month === currentMonth ? listDemoEvents(currentDateInSamara()) : [];
      const profiles = demoProfiles();
      const plannedLessonCounts = planning
        ? new Map(
            profiles.map((student) => [
              student.normalizedName,
              demoGlobal.teacherDemoStudentPlans?.get(
                demoPlanKey(month, student.normalizedName),
              ) ?? 0,
            ]),
          )
        : undefined;

      return Response.json({
        month,
        mode: planning ? "plan" : "actual",
        ...buildStudentStatistics(profiles, events, plannedLessonCounts),
      });
    }

    const targetEventsPromise = listCalendarEventsBetween(
      session.telegramId,
      monthBounds(month),
    );
    const discoveryEventsPromise =
      month === currentMonth
        ? targetEventsPromise
        : listCalendarEventsBetween(
            session.telegramId,
            monthBounds(currentMonth),
          );
    const [targetEvents, discoveryEvents] = await Promise.all([
      targetEventsPromise,
      discoveryEventsPromise,
    ]);
    const profiles = await syncStudentProfiles(
      session.telegramId,
      extractStudentNames([...targetEvents, ...discoveryEvents]),
    );
    const plannedLessonCounts = planning
      ? await listStudentMonthPlans(session.telegramId, month)
      : undefined;

    return Response.json({
      month,
      mode: planning ? "plan" : "actual",
      ...buildStudentStatistics(
        profiles,
        targetEvents,
        plannedLessonCounts,
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAppSession();
    const input = updatePriceSchema.parse(await request.json());
    const month = assertMonthString(input.month);
    const planning = month > currentMonthInSamara();
    const normalizedName = normalizeStudentName(input.normalizedName);
    const lessonPriceKopecks =
      input.lessonPriceRubles === null
        ? null
        : Math.round(input.lessonPriceRubles * 100);

    if (planning && input.plannedLessonCount === undefined) {
      throw new HttpError(
        400,
        "PLANNED_LESSON_COUNT_REQUIRED",
        "Укажите количество занятий на месяц.",
      );
    }

    if (isDemoMode()) {
      const existingStudent = demoProfiles().find(
        (student) => student.normalizedName === normalizedName,
      );
      if (!existingStudent) {
        throw new HttpError(
          404,
          "STUDENT_NOT_FOUND",
          "Ученик не найден. Обновите список из календаря.",
        );
      }

      demoGlobal.teacherDemoStudentPrices ??= new Map();
      demoGlobal.teacherDemoStudentPrices.set(
        normalizedName,
        lessonPriceKopecks,
      );
      if (planning && input.plannedLessonCount !== undefined) {
        demoGlobal.teacherDemoStudentPlans ??= new Map();
        demoGlobal.teacherDemoStudentPlans.set(
          demoPlanKey(month, normalizedName),
          input.plannedLessonCount,
        );
      }

      return Response.json({
        student: demoProfiles().find(
          (student) => student.normalizedName === normalizedName,
        ),
      });
    }

    const student = await updateStudentLessonPrice(
      session.telegramId,
      normalizedName,
      lessonPriceKopecks,
    );

    if (!student) {
      throw new HttpError(
        404,
        "STUDENT_NOT_FOUND",
        "Ученик не найден. Обновите список из календаря.",
      );
    }

    if (planning && input.plannedLessonCount !== undefined) {
      const updated = await updateStudentMonthPlan(
        session.telegramId,
        normalizedName,
        month,
        input.plannedLessonCount,
      );
      if (!updated) {
        throw new HttpError(
          404,
          "STUDENT_NOT_FOUND",
          "Ученик не найден. Обновите список из календаря.",
        );
      }
    }

    return Response.json({ student });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAppSession();
    const input = z
      .object({ normalizedName: z.string().trim().min(1).max(200) })
      .parse(await request.json());
    const normalizedName = normalizeStudentName(input.normalizedName);

    if (isDemoMode()) {
      demoGlobal.teacherDemoArchivedStudents ??= new Set();
      demoGlobal.teacherDemoArchivedStudents.add(normalizedName);
      return Response.json({ deleted: true });
    }

    const deleted = await archiveStudentProfile(
      session.telegramId,
      normalizedName,
    );
    if (!deleted) {
      throw new HttpError(
        404,
        "STUDENT_NOT_FOUND",
        "Ученик уже удалён или не найден.",
      );
    }

    return Response.json({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
