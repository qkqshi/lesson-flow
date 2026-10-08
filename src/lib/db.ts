import "server-only";

import postgres from "postgres";

import { requiredEnv } from "@/lib/config";
import type { StudentProfile } from "@/lib/students";
import type { TelegramUser } from "@/lib/telegram";

type SqlClient = ReturnType<typeof postgres>;

type GlobalWithDatabase = typeof globalThis & {
  teacherMiniAppSql?: SqlClient;
  teacherStudentSchemaPromise?: Promise<void>;
};

const globalWithDatabase = globalThis as GlobalWithDatabase;

export function database(): SqlClient {
  if (!globalWithDatabase.teacherMiniAppSql) {
    globalWithDatabase.teacherMiniAppSql = postgres(requiredEnv("DATABASE_URL"), {
      max: 5,
      prepare: false,
      idle_timeout: 20,
    });
  }

  return globalWithDatabase.teacherMiniAppSql;
}

async function ensureStudentProfileSchema(): Promise<void> {
  if (!globalWithDatabase.teacherStudentSchemaPromise) {
    globalWithDatabase.teacherStudentSchemaPromise = (async () => {
      const sql = database();

      await sql`
        CREATE TABLE IF NOT EXISTS student_profile (
          telegram_id BIGINT NOT NULL REFERENCES app_user(telegram_id) ON DELETE CASCADE,
          normalized_name TEXT NOT NULL,
          display_name TEXT NOT NULL,
          lesson_price_kopecks BIGINT,
          is_archived BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (telegram_id, normalized_name),
          CHECK (lesson_price_kopecks IS NULL OR lesson_price_kopecks >= 0)
        )
      `;
      await sql`
        ALTER TABLE student_profile
        ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE
      `;
      await sql`
        CREATE INDEX IF NOT EXISTS student_profile_telegram_name_idx
        ON student_profile (telegram_id, display_name)
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS student_month_plan (
          telegram_id BIGINT NOT NULL,
          normalized_name TEXT NOT NULL,
          plan_month DATE NOT NULL,
          planned_lesson_count INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (telegram_id, normalized_name, plan_month),
          FOREIGN KEY (telegram_id, normalized_name)
            REFERENCES student_profile (telegram_id, normalized_name)
            ON DELETE CASCADE,
          CHECK (planned_lesson_count >= 0 AND planned_lesson_count <= 1000)
        )
      `;
    })().catch((error) => {
      globalWithDatabase.teacherStudentSchemaPromise = undefined;
      throw error;
    });
  }

  await globalWithDatabase.teacherStudentSchemaPromise;
}

type StudentProfileRow = {
  normalized_name: string;
  display_name: string;
  lesson_price_kopecks: string | number | null;
};

function mapStudentProfile(row: StudentProfileRow): StudentProfile {
  return {
    normalizedName: row.normalized_name,
    displayName: row.display_name,
    lessonPriceKopecks:
      row.lesson_price_kopecks === null
        ? null
        : Number(row.lesson_price_kopecks),
  };
}

export async function syncStudentProfiles(
  telegramId: string,
  names: ReadonlyArray<{ normalizedName: string; displayName: string }>,
): Promise<StudentProfile[]> {
  await ensureStudentProfileSchema();
  const sql = database();

  await Promise.all(
    names.map((student) => sql`
      INSERT INTO student_profile (telegram_id, normalized_name, display_name)
      VALUES (${telegramId}, ${student.normalizedName}, ${student.displayName})
      ON CONFLICT (telegram_id, normalized_name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        updated_at = NOW()
    `),
  );

  const rows = await sql<StudentProfileRow[]>`
    SELECT normalized_name, display_name, lesson_price_kopecks
    FROM student_profile
    WHERE telegram_id = ${telegramId} AND is_archived = FALSE
    ORDER BY display_name
  `;

  return rows.map(mapStudentProfile);
}

export async function updateStudentLessonPrice(
  telegramId: string,
  normalizedName: string,
  lessonPriceKopecks: number | null,
): Promise<StudentProfile | null> {
  await ensureStudentProfileSchema();
  const rows = await database()<StudentProfileRow[]>`
    UPDATE student_profile
    SET lesson_price_kopecks = ${lessonPriceKopecks}, updated_at = NOW()
    WHERE telegram_id = ${telegramId}
      AND normalized_name = ${normalizedName}
      AND is_archived = FALSE
    RETURNING normalized_name, display_name, lesson_price_kopecks
  `;

  return rows[0] ? mapStudentProfile(rows[0]) : null;
}

export async function listStudentMonthPlans(
  telegramId: string,
  month: string,
): Promise<Map<string, number>> {
  await ensureStudentProfileSchema();
  const rows = await database()<Array<{
    normalized_name: string;
    planned_lesson_count: number;
  }>>`
    SELECT plan.normalized_name, plan.planned_lesson_count
    FROM student_month_plan AS plan
    JOIN student_profile AS profile
      ON profile.telegram_id = plan.telegram_id
      AND profile.normalized_name = plan.normalized_name
    WHERE plan.telegram_id = ${telegramId}
      AND plan.plan_month = ${month + "-01"}::date
      AND profile.is_archived = FALSE
  `;

  return new Map(
    rows.map((row) => [row.normalized_name, Number(row.planned_lesson_count)]),
  );
}

export async function updateStudentMonthPlan(
  telegramId: string,
  normalizedName: string,
  month: string,
  plannedLessonCount: number,
): Promise<boolean> {
  await ensureStudentProfileSchema();
  const rows = await database()<Array<{ normalized_name: string }>>`
    INSERT INTO student_month_plan (
      telegram_id,
      normalized_name,
      plan_month,
      planned_lesson_count
    )
    SELECT
      telegram_id,
      normalized_name,
      ${month + "-01"}::date,
      ${plannedLessonCount}
    FROM student_profile
    WHERE telegram_id = ${telegramId}
      AND normalized_name = ${normalizedName}
      AND is_archived = FALSE
    ON CONFLICT (telegram_id, normalized_name, plan_month) DO UPDATE SET
      planned_lesson_count = EXCLUDED.planned_lesson_count,
      updated_at = NOW()
    RETURNING normalized_name
  `;

  return Boolean(rows[0]);
}

export async function archiveStudentProfile(
  telegramId: string,
  normalizedName: string,
): Promise<boolean> {
  await ensureStudentProfileSchema();
  const rows = await database()<Array<{ normalized_name: string }>>`
    UPDATE student_profile
    SET is_archived = TRUE, updated_at = NOW()
    WHERE telegram_id = ${telegramId}
      AND normalized_name = ${normalizedName}
      AND is_archived = FALSE
    RETURNING normalized_name
  `;

  return Boolean(rows[0]);
}

export async function upsertAppUser(user: TelegramUser): Promise<void> {
  const sql = database();

  await sql`
    INSERT INTO app_user (telegram_id, first_name, username)
    VALUES (${String(user.id)}, ${user.first_name}, ${user.username ?? null})
    ON CONFLICT (telegram_id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      username = EXCLUDED.username,
      updated_at = NOW()
  `;
}

export type GoogleConnection = {
  encrypted_refresh_token: string;
  scopes: string;
  calendar_id: string;
};

export async function getGoogleConnection(
  telegramId: string,
): Promise<GoogleConnection | null> {
  const sql = database();
  const rows = await sql<GoogleConnection[]>`
    SELECT encrypted_refresh_token, scopes, calendar_id
    FROM google_connection
    WHERE telegram_id = ${telegramId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function saveGoogleConnection(input: {
  telegramId: string;
  encryptedRefreshToken: string;
  scopes: string;
}): Promise<void> {
  const sql = database();

  await sql`
    INSERT INTO google_connection (
      telegram_id,
      encrypted_refresh_token,
      scopes,
      calendar_id
    )
    VALUES (
      ${input.telegramId},
      ${input.encryptedRefreshToken},
      ${input.scopes},
      'primary'
    )
    ON CONFLICT (telegram_id) DO UPDATE SET
      encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
      scopes = EXCLUDED.scopes,
      updated_at = NOW()
  `;
}

export async function removeGoogleConnection(telegramId: string): Promise<void> {
  await database()`
    DELETE FROM google_connection
    WHERE telegram_id = ${telegramId}
  `;
}

export async function claimDailyNotification(
  telegramId: string,
  scheduleDate: string,
): Promise<boolean> {
  const rows = await database()<Array<{ id: string }>>`
    INSERT INTO notification_delivery (telegram_id, schedule_date, status)
    VALUES (${telegramId}, ${scheduleDate}, 'sending')
    ON CONFLICT (telegram_id, schedule_date) DO UPDATE SET
      status = 'sending',
      error = NULL,
      updated_at = NOW()
    WHERE notification_delivery.status = 'failed'
    RETURNING id
  `;

  return rows.length === 1;
}

export async function completeDailyNotification(
  telegramId: string,
  scheduleDate: string,
  eventCount: number,
): Promise<void> {
  await database()`
    UPDATE notification_delivery
    SET status = 'sent', event_count = ${eventCount}, sent_at = NOW(), updated_at = NOW()
    WHERE telegram_id = ${telegramId} AND schedule_date = ${scheduleDate}
  `;
}

export async function failDailyNotification(
  telegramId: string,
  scheduleDate: string,
  error: string,
): Promise<void> {
  await database()`
    UPDATE notification_delivery
    SET status = 'failed', error = ${error.slice(0, 1000)}, updated_at = NOW()
    WHERE telegram_id = ${telegramId} AND schedule_date = ${scheduleDate}
  `;
}
