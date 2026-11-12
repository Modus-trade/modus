import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL("../src/deadline.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
});
const {
  deadlineDate,
  deadlineLocalInput,
  calendarDays,
  localDateKey,
  parseDeadlineInput,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("legacy unset deadlines leave the date input empty", () => {
  assert.equal(deadlineLocalInput(null), "");
  assert.equal(deadlineLocalInput(undefined), "");
});

test("calendar weeks start on Monday and include leap days and year boundaries", () => {
  for (const [year, month, first, last] of [
    [2024, 1, "2024-01-29", "2024-03-10"],
    [2026, 11, "2026-11-30", "2027-01-10"],
  ]) {
    const days = calendarDays(year, month);
    assert.equal(days.length, 42);
    assert.equal(days[0].getDay(), 1);
    assert.equal(localDateKey(days[0]), first);
    assert.equal(localDateKey(days[41]), last);
    assert.equal(new Set(days.map(localDateKey)).size, 42);
  }
  assert.ok(
    calendarDays(2024, 1).some((date) => localDateKey(date) === "2024-02-29"),
  );
});

test("invalid dates and times cannot silently roll over into another deadline", () => {
  for (const value of [
    "",
    "2026-02-29T12:00",
    "2026-04-31T12:00",
    "2026-13-01T12:00",
    "2026-11-12T24:00",
    "2026-11-12T18:60",
    "2026-11-12",
  ])
    assert.equal(parseDeadlineInput(value), null, value);
});

test("the picker preserves local time and rejects skipped daylight-saving times", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Asia/Qyzylorda";
    assert.equal(
      parseDeadlineInput("2026-11-12T18:45").toISOString(),
      "2026-11-12T13:45:00.000Z",
    );
    process.env.TZ = "America/New_York";
    assert.equal(parseDeadlineInput("2026-03-08T02:30"), null);
    assert.equal(
      parseDeadlineInput("2026-07-01T08:30").toISOString(),
      "2026-07-01T12:30:00.000Z",
    );
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("server UTC dates and explicit offsets represent the same deadline", () => {
  const expected = "2026-11-11T12:30:00.000Z";
  for (const value of [
    "2026-11-11T12:30:00",
    "2026-11-11T12:30:00Z",
    "2026-11-11T17:30:00+05:00",
  ]) {
    assert.equal(deadlineDate(value).toISOString(), expected);
  }
});

test("the local editor round-trips UTC across timezones and daylight saving", () => {
  const previous = process.env.TZ;
  try {
    for (const [zone, utc, local] of [
      ["Asia/Qyzylorda", "2026-11-11T12:30:00Z", "2026-11-11T17:30"],
      ["America/New_York", "2026-07-01T12:30:00Z", "2026-07-01T08:30"],
      ["America/New_York", "2026-12-01T12:30:00Z", "2026-12-01T07:30"],
    ]) {
      process.env.TZ = zone;
      assert.equal(deadlineLocalInput(utc), local);
      assert.equal(new Date(local).toISOString(), utc.replace("Z", ".000Z"));
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
