export type StudentProfile = {
  normalizedName: string;
  displayName: string;
  lessonPriceKopecks: number | null;
};

type LessonEvent = {
  title: string;
  allDay: boolean;
};

export type StudentStatisticsItem = StudentProfile & {
  lessonCount: number;
  projectedIncomeKopecks: number;
};

export type StudentStatistics = {
  students: StudentStatisticsItem[];
  lessonCount: number;
  activeStudentCount: number;
  projectedIncomeKopecks: number;
  unpricedStudentCount: number;
};

export function normalizeStudentName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

export function extractStudentNames(
  events: readonly LessonEvent[],
): Array<{ normalizedName: string; displayName: string }> {
  const uniqueNames = new Map<string, string>();

  for (const event of events) {
    const displayName = event.title.trim().replace(/\s+/g, " ");

    if (event.allDay || !displayName) {
      continue;
    }

    const normalizedName = normalizeStudentName(displayName);

    if (!uniqueNames.has(normalizedName)) {
      uniqueNames.set(normalizedName, displayName);
    }
  }

  return [...uniqueNames].map(([normalizedName, displayName]) => ({
    normalizedName,
    displayName,
  }));
}

export function buildStudentStatistics(
  profiles: readonly StudentProfile[],
  events: readonly LessonEvent[],
  plannedLessonCounts?: ReadonlyMap<string, number>,
): StudentStatistics {
  const lessonCountByName = new Map<string, number>(
    plannedLessonCounts?.entries(),
  );

  if (!plannedLessonCounts) {
    for (const event of events) {
      if (event.allDay) {
        continue;
      }

      const normalizedName = normalizeStudentName(event.title);
      lessonCountByName.set(
        normalizedName,
        (lessonCountByName.get(normalizedName) ?? 0) + 1,
      );
    }
  }

  const students = profiles
    .map((profile) => {
      const lessonCount = lessonCountByName.get(profile.normalizedName) ?? 0;

      return {
        ...profile,
        lessonCount,
        projectedIncomeKopecks:
          lessonCount * (profile.lessonPriceKopecks ?? 0),
      };
    })
    .sort(
      (left, right) =>
        Number(right.lessonCount > 0) - Number(left.lessonCount > 0) ||
        left.displayName.localeCompare(right.displayName, "ru"),
    );

  return students.reduce<StudentStatistics>(
    (result, student) => {
      result.students.push(student);
      result.lessonCount += student.lessonCount;
      result.projectedIncomeKopecks += student.projectedIncomeKopecks;

      if (student.lessonCount > 0) {
        result.activeStudentCount += 1;

        if (student.lessonPriceKopecks === null) {
          result.unpricedStudentCount += 1;
        }
      }

      return result;
    },
    {
      students: [],
      lessonCount: 0,
      activeStudentCount: 0,
      projectedIncomeKopecks: 0,
      unpricedStudentCount: 0,
    },
  );
}
