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
const { shiftTimes, addDays, validDay, parseVisionRows, relinkVisionRows, reviewDates, changeReviewPeriod, shiftDisplayColor, overlaps, commonWindows, recurringDays } =
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
      { date: "2026-10-01", label: "N", confidence: 0.95 },
      { date: "2026-10-02", label: "무료 쿠폰" },
    ],
    patterns,
  );
  assert.equal(rows[0].patternId, "night");
  assert.equal(rows[0].included, true);
  assert.equal(rows[1].patternId, "");
  assert.equal(rows[1].included, false);
});
test("vision results reject impossible dates and duplicate rows", () => {
  for (const rows of [
    [{ date: "2026-02-29", label: "N" }],
    [{ date: "2026-10-32", label: "N" }],
    [
      { date: "2026-10-01", label: "N" },
      { date: "2026-10-01", label: "D" },
    ],
  ])
    assert.throws(() => parseVisionRows(rows, patterns));
});
test("ambiguous aliases require explicit user mapping", () => {
  const rows = parseVisionRows([{ date: "2026-10-01", label: "N" }], [
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
    { key: '1', date: '2026-10-01', dateLabel: '1', label: 'N', patternId: '', included: false, confidence: 0.9 },
    { key: '2', date: '2026-10-02', dateLabel: '2', label: 'N', patternId: 'night', included: false, confidence: 0.9, manual: true },
    { key: '3', date: '2026-10-03', dateLabel: '3', label: 'N', patternId: '', included: false, confidence: 0.9, manual: true },
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
test('weekly photo dates cross month and year without losing their date', () => {
  const dates = reviewDates('2026-12-28', '2027-01-03');
  assert.equal(dates.length, 7);
  const rows = parseVisionRows(dates.map(date => ({date, label: 'N', confidence: 0.98})), patterns);
  assert.deepEqual(rows.map(row => row.date), dates);
  assert.ok(rows.every(row => row.included));
  assert.equal(reviewDates('2026-01-01', '2026-03-04').length, 0);
  assert.equal(reviewDates('2026-10-10', '2026-10-01').length, 0);
});
test('uncertain dates stay excluded until a unique date can be inferred from a confirmed period', () => {
  const rows = parseVisionRows([{date: null, dateLabel: '월요일', label: 'N'}, {date: null, dateLabel: '1/1', label: 'N'}], patterns);
  assert.ok(rows.every(row => !row.included && !row.date));
  const linked = changeReviewPeriod(rows, '', '2026-12-28', '2027-01-03');
  assert.deepEqual(linked.map(row => row.date), ['2026-12-28', '2027-01-01']);
  assert.ok(linked.every(row => row.included));
  assert.equal(changeReviewPeriod(rows, '', '2026-12-28', '2027-01-10')[0].date, '');
});
test('period corrections shift dates while preserving explicit exclusions', () => {
  const rows = parseVisionRows([{date: '2026-12-31', label: 'N'}], patterns);
  rows[0].manual = true; rows[0].included = false;
  const changed = changeReviewPeriod(rows, '2026-12-28', '2027-01-04', '2027-01-10');
  assert.equal(changed[0].date, '2027-01-07');
  assert.equal(changed[0].included, false);
});
