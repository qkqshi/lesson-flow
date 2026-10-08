import { describe, expect, it } from "vitest";

import {
  addDays,
  currentDateInSamara,
  currentMonthInSamara,
  dayBounds,
  monthBounds,
} from "@/lib/time";

describe("Samara calendar time", () => {
  it("builds an exclusive date range with UTC+4", () => {
    expect(dayBounds("2026-09-09")).toEqual({
      timeMin: "2026-09-09T00:00:00+04:00",
      timeMax: "2026-09-10T00:00:00+04:00",
    });
  });

  it("handles month boundaries", () => {
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(monthBounds("2026-12")).toEqual({
      timeMin: "2026-12-01T00:00:00+04:00",
      timeMax: "2027-01-01T00:00:00+04:00",
    });
  });

  it("uses Samara time for the current date", () => {
    expect(currentDateInSamara(new Date("2026-09-08T21:30:00Z"))).toBe(
      "2026-09-09",
    );
    expect(currentMonthInSamara(new Date("2026-09-08T21:30:00Z"))).toBe(
      "2026-09",
    );
  });
});
