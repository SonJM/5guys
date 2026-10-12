import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const code = ts.transpileModule(
  await readFile(new URL("../src/lib/planner.ts", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
const { shiftTimes, addDays, validDay, parseVisionRows, relinkVisionRows, shiftDisplayColor, overlaps, commonWindows, recurringDays } =
  await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );
test("common windows span midnight and reject gaps", () => {
  const start = Date.parse("2026-09-29T23:30:00+09:00");
  const rows = ["a", "b"].flatMap((user_id) =>
    Array.from({ length: 4 }, (_, i) => ({
      user_id,
      username: user_id,
      slot: new Date(start + i * 1800000).toISOString(),
      available: true,
      confirmed: true,
    })),
  );
  assert.equal(commonWindows(rows, 2).length, 1);
  assert.equal(
    commonWindows(
      rows.filter((r, i) => i !== 5),
      2,
    ).length,
    0,
  );
  assert.equal(commonWindows(rows.map((r) => ({ ...r, confirmed: false })), 2).length, 1);
  assert.equal(commonWindows(rows, 0.75).length, 0);
});
test("overnight shifts cross month/year boundaries in Korean time", () => {
  const result = shiftTimes("2026-12-31", {
    start_time: "22:00",
    end_time: "07:00",
    end_day_offset: 1,
    is_off: false,
  });
  assert.equal(result.starts_at, "2026-12-31T13:00:00.000Z");
  assert.equal(result.ends_at, "2026-12-31T22:00:00.000Z");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});
test("invalid dates and nonpositive shift durations are rejected", () => {
  assert.equal(validDay("2026-02-29"), false);
  assert.equal(validDay("2028-02-29"), true);
  assert.throws(() =>
    shiftTimes("2026-09-01", {
      start_time: "18:00",
      end_time: "09:00",
      end_day_offset: 0,
      is_off: false,
    }),
  );
});
test("touching event boundaries do not overlap", () => {
  assert.equal(
    overlaps(
      "2026-09-01T09:00Z",
      "2026-09-01T10:00Z",
      "2026-09-01T10:00Z",
      "2026-09-01T11:00Z",
    ),
    false,
  );
});
const patterns = [
  {
    id: "night",
    label: "야간",
    aliases: ["N"],
    start_time: "22:00",
    end_time: "07:00",
    end_day_offset: 1,
    is_off: false,
  },
];
test("vision results automatically include known shifts and leave unknown labels for review", () => {
  const rows = parseVisionRows(
    [
      { day: 1, label: "N", confidence: 0.95 },
      { day: 2, label: "무료 쿠폰" },
    ],
    patterns,
  );
  assert.equal(rows[0].patternId, "night");
  assert.equal(rows[0].included, true);
  assert.equal(rows[1].patternId, "");
  assert.equal(rows[1].included, false);
});
test("vision results reject impossible day numbers and duplicate rows", () => {
  for (const rows of [
    [{ day: 0, label: "N" }],
    [{ day: 32, label: "N" }],
    [
      { day: 1, label: "N" },
      { day: 1, label: "D" },
    ],
  ])
    assert.throws(() => parseVisionRows(rows, patterns));
});
test("ambiguous aliases require explicit user mapping", () => {
  const rows = parseVisionRows([{ day: 1, label: "N" }], [
    ...patterns,
    { ...patterns[0], id: "other", label: "다른 야간" },
  ]);
  assert.equal(rows[0].patternId, "");
});
test("work display colors distinguish patterns that share a stored default color", () => {
  const same = [
    { ...patterns[0], color: "#0f766e" },
    { ...patterns[0], id: "day", label: "주간", color: "#0f766e" },
  ];
  assert.notEqual(shiftDisplayColor(same[0], same), shiftDisplayColor(same[1], same));
  assert.equal(shiftDisplayColor({ ...same[0], color: "#123456" }, [{ ...same[0], color: "#123456" }]), "#123456");
});
test("adding a work pattern relinks existing analysis while preserving manual exclusions", () => {
  const rows = [
    { day: 1, label: 'N', patternId: '', included: false, confidence: 0.9 },
    { day: 2, label: 'N', patternId: 'night', included: false, confidence: 0.9, manual: true },
    { day: 3, label: 'N', patternId: '', included: false, confidence: 0.9, manual: true },
  ];
  const linked = relinkVisionRows(rows, patterns);
  assert.equal(linked[0].patternId, 'night');
  assert.equal(linked[0].included, true);
  assert.equal(linked[1].included, false);
  assert.equal(linked[2].patternId, '');
  const removed = relinkVisionRows(linked, []);
  assert.equal(removed[1].patternId, '');
  assert.equal(removed[1].included, false);
});
test("repeating appointments keep selected weekdays and monthly calendar dates", () => {
  assert.deepEqual(recurringDays('2026-10-05', 'weekly', 1, 4, [1, 3]),
    ['2026-10-05', '2026-10-07', '2026-10-12', '2026-10-14']);
  assert.deepEqual(recurringDays('2026-01-31', 'monthly', 1, 3),
    ['2026-01-31', '2026-03-31', '2026-05-31']);
  assert.deepEqual(recurringDays('2026-10-05', 'none', 1, 3), ['2026-10-05']);
  assert.throws(() => recurringDays('2026-10-05', 'daily', 0, 3));
});
