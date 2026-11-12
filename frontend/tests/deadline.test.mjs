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
const { deadlineDate, deadlineLocalInput } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("legacy unset deadlines leave the date input empty", () => {
  assert.equal(deadlineLocalInput(null), "");
  assert.equal(deadlineLocalInput(undefined), "");
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
