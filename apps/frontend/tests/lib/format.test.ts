import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test"
import {
  formatDate,
  formatDateTime,
  formatDayHeader,
  formatDayLabel,
  formatDuration,
  formatDurationMs,
  formatFileSize,
  formatPages,
  formatRelativeDay,
  getDateBucketLabel,
} from "@/lib/format"

const NOW = new Date("2026-03-15T12:00:00.000Z")

beforeEach(() => {
  setSystemTime(NOW)
})

afterEach(() => {
  setSystemTime()
})

describe("absolute formatting", () => {
  test("formatDate renders a Spanish short date", () => {
    expect(formatDate("2026-03-05T10:00:00.000Z")).toBe("5 mar 2026")
  })

  test("formatDateTime renders a dash for a missing value", () => {
    expect(formatDateTime(null)).toBe("—")
  })

  test("formatDateTime includes the year and seconds on request", () => {
    const value = formatDateTime("2026-03-05T10:04:09.000Z", {
      includeYear: true,
      includeSeconds: true,
    })
    expect(value).toContain("2026")
    expect(value).toContain("10:04:09")
  })

  test("formatDayHeader capitalizes the first letter", () => {
    expect(formatDayHeader("lunes, 2 mar")).toBe("Lunes, 2 mar")
  })
})

describe("durations", () => {
  test("formatDurationMs switches unit with the scale", () => {
    expect(formatDurationMs(250)).toBe("250 ms")
    expect(formatDurationMs(1500)).toBe("1.5 s")
    expect(formatDurationMs(150_000)).toBe("3 min")
  })

  test("formatDuration measures between two instants", () => {
    expect(
      formatDuration("2026-03-15T10:00:00.000Z", "2026-03-15T10:00:02.000Z")
    ).toBe("2.0 s")
    expect(formatDuration("2026-03-15T10:00:00.000Z", null)).toBe("—")
  })
})

describe("relative labels", () => {
  test("formatDayLabel names today and yesterday", () => {
    expect(formatDayLabel("2026-03-15T08:00:00.000Z")).toBe("Hoy")
    expect(formatDayLabel("2026-03-14T08:00:00.000Z")).toBe("Ayer")
  })

  test("formatDayLabel adds the year only for another year", () => {
    expect(formatDayLabel("2026-03-02T08:00:00.000Z")).not.toContain("2026")
    expect(formatDayLabel("2025-03-02T08:00:00.000Z")).toContain("2025")
  })

  test("formatRelativeDay counts days within a week", () => {
    expect(formatRelativeDay("2026-03-15T01:00:00.000Z")).toBe("Hoy")
    expect(formatRelativeDay("2026-03-14T01:00:00.000Z")).toBe("Ayer")
    expect(formatRelativeDay("2026-03-12T01:00:00.000Z")).toBe("Hace 3 días")
    expect(formatRelativeDay("2026-03-01T01:00:00.000Z")).toBe("1/3/2026")
    expect(formatRelativeDay("not a date")).toBe("—")
  })

  test("getDateBucketLabel groups by recency", () => {
    expect(getDateBucketLabel("2026-03-15T01:00:00.000Z")).toBe("Hoy")
    expect(getDateBucketLabel("2026-03-10T01:00:00.000Z")).toBe("Esta semana")
    expect(getDateBucketLabel("2026-02-20T01:00:00.000Z")).toBe("Este mes")
    expect(getDateBucketLabel("2026-01-01T01:00:00.000Z")).toBe(
      "Últimos 3 meses"
    )
    expect(getDateBucketLabel("2025-06-01T01:00:00.000Z")).toBe(
      "Más de 3 meses"
    )
    expect(getDateBucketLabel("not a date")).toBe("Más de 3 meses")
  })
})

describe("formatFileSize", () => {
  test("keeps bytes whole and uses one decimal above them", () => {
    expect(formatFileSize(512)).toBe("512 B")
    expect(formatFileSize(1536)).toBe("1,5 KB")
    expect(formatFileSize(20 * 1024 * 1024)).toBe("20 MB")
  })
})

describe("formatPages", () => {
  test("numbers pages from 1, sorted, and joins ranges of three or more", () => {
    expect(formatPages([])).toBe("—")
    expect(formatPages([0])).toBe("1")
    expect(formatPages([2, 0])).toBe("1, 3")
    expect(formatPages([0, 1])).toBe("1, 2")
    expect(formatPages([2, 1, 0])).toBe("1–3")
  })
})
