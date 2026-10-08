import { describe, expect, it } from "vitest";

import {
  buildStudentStatistics,
  extractStudentNames,
  normalizeStudentName,
} from "@/lib/students";

describe("student statistics", () => {
  it("normalizes whitespace and letter case", () => {
    expect(normalizeStudentName("  Анна   Петрова ")).toBe("анна петрова");
  });

  it("extracts unique students from timed calendar events", () => {
    expect(
      extractStudentNames([
        { title: "Анна", allDay: false },
        { title: " анна ", allDay: false },
        { title: "Отпуск", allDay: true },
      ]),
    ).toEqual([{ normalizedName: "анна", displayName: "Анна" }]);
  });

  it("counts lessons and projected income without floating point money", () => {
    const result = buildStudentStatistics(
      [
        {
          normalizedName: "анна",
          displayName: "Анна",
          lessonPriceKopecks: 150_000,
        },
        {
          normalizedName: "максим",
          displayName: "Максим",
          lessonPriceKopecks: null,
        },
      ],
      [
        { title: "Анна", allDay: false },
        { title: " анна ", allDay: false },
        { title: "Максим", allDay: false },
        { title: "Праздник", allDay: true },
      ],
    );

    expect(result).toMatchObject({
      lessonCount: 3,
      activeStudentCount: 2,
      projectedIncomeKopecks: 300_000,
      unpricedStudentCount: 1,
    });
    expect(result.students[0]).toMatchObject({
      displayName: "Анна",
      lessonCount: 2,
      projectedIncomeKopecks: 300_000,
    });
  });

  it("uses manually planned lessons instead of calendar events", () => {
    const result = buildStudentStatistics(
      [
        {
          normalizedName: "анна",
          displayName: "Анна",
          lessonPriceKopecks: 150_000,
        },
      ],
      [{ title: "Анна", allDay: false }],
      new Map([["анна", 8]]),
    );

    expect(result).toMatchObject({
      lessonCount: 8,
      activeStudentCount: 1,
      projectedIncomeKopecks: 1_200_000,
    });
  });
});
