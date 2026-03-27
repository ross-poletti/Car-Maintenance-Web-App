import test from "node:test";
import assert from "node:assert/strict";
import { __internal__ } from "./sheetService.js";

const { parseCsv, mapRows, summarizeRecords } = __internal__();
process.env.SHEET_CSV_URL = 'https://example.com/maintenance.csv';

test("parseCsv handles quoted commas", () => {
  const rows = parseCsv("vehicle,notes\nTacoma,\"Oil, filter, and inspect\"");
  assert.equal(rows[1][1], "Oil, filter, and inspect");
});

test("mapRows normalizes records", () => {
  const rows = [
    ["Vehicle", "Service Type", "Service Date", "Mileage", "Interval Miles", "Interval Days"],
    ["Tacoma", "Oil Change", "2026-01-10", "12345", "5000", "180"]
  ];

  const records = mapRows(rows);
  assert.equal(records[0].vehicle, "Tacoma");
  assert.equal(records[0].serviceType, "Oil Change");
  assert.equal(records[0].mileage, 12345);
  assert.equal(records[0].intervalMiles, 5000);
});

test("summarizeRecords keeps the latest service and computes due values", () => {
  const records = mapRows([
    ["Vehicle", "Service Type", "Service Date", "Mileage", "Interval Miles", "Interval Days"],
    ["Tacoma", "Oil Change", "2025-08-10", "12000", "5000", "180"],
    ["Tacoma", "Oil Change", "2026-02-05", "17000", "5000", "180"]
  ]);

  const summary = summarizeRecords(records);
  const service = summary.services[0];

  assert.equal(service.lastPerformed.mileage, 17000);
  assert.equal(service.nextDue.mileage, 22000);
  assert.ok(service.nextDue.date);
});

