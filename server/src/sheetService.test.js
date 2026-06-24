import test from "node:test";
import assert from "node:assert/strict";
import { __internal__, getMaintenanceData } from "./sheetService.js";

const { parseCsv, parseVehicleSheetsConfig, mapRows, summarizeRecords } = __internal__();
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

test("mapRows can assign a vehicle from a per-vehicle sheet config", () => {
  const rows = [
    ["Service Type", "Service Date", "Mileage", "Interval Miles", "Interval Days"],
    ["Oil Change", "2026-01-10", "12345", "5000", "180"]
  ];

  const records = mapRows(rows, "Tacoma", false);
  assert.equal(records[0].vehicle, "Tacoma");
  assert.equal(records[0].serviceType, "Oil Change");
});

test("parseVehicleSheetsConfig accepts sheet IDs and CSV URLs", () => {
  const originalConfig = process.env.VEHICLE_SHEETS;
  process.env.VEHICLE_SHEETS = JSON.stringify([
    { vehicle: "Tacoma", sheetId: "abc123", gid: "456" },
    { vehicle: "CR-V", csvUrl: "https://example.com/crv.csv" }
  ]);

  const sources = parseVehicleSheetsConfig();
  assert.deepEqual(sources, [
    {
      vehicle: "Tacoma",
      url: "https://docs.google.com/spreadsheets/d/abc123/export?format=csv&gid=456"
    },
    {
      vehicle: "CR-V",
      url: "https://example.com/crv.csv"
    }
  ]);

  if (originalConfig === undefined) {
    delete process.env.VEHICLE_SHEETS;
  } else {
    process.env.VEHICLE_SHEETS = originalConfig;
  }
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

test("getMaintenanceData labels network fetch failures", async () => {
  const originalConfig = process.env.VEHICLE_SHEETS;
  const originalFetch = globalThis.fetch;
  process.env.VEHICLE_SHEETS = JSON.stringify([
    { vehicle: "Tacoma", csvUrl: "https://example.com/tacoma.csv" }
  ]);
  globalThis.fetch = async () => {
    throw new Error("fetch failed");
  };

  await assert.rejects(
    () => getMaintenanceData(),
    /Unable to fetch Tacoma from its configured sheet URL: fetch failed/
  );

  globalThis.fetch = originalFetch;
  if (originalConfig === undefined) {
    delete process.env.VEHICLE_SHEETS;
  } else {
    process.env.VEHICLE_SHEETS = originalConfig;
  }
});
