const REQUIRED_COLUMNS = [
  "serviceType",
  "serviceDate",
  "mileage"
];

const DEFAULT_CACHE_TTL_MINUTES = Number(process.env.CACHE_TTL_MINUTES || 10);

let cache = {
  expiresAt: 0,
  payload: null
};

function buildGoogleSheetUrl(sheetId, gid = "0") {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
}

function parseVehicleSheetsConfig() {
  if (!process.env.VEHICLE_SHEETS) {
    return [];
  }

  let entries;
  try {
    entries = JSON.parse(process.env.VEHICLE_SHEETS);
  } catch {
    throw new Error("VEHICLE_SHEETS must be valid JSON.");
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("VEHICLE_SHEETS must be a non-empty JSON array.");
  }

  return entries.map((entry, index) => {
    const vehicle = String(entry.vehicle || "").trim();
    const csvUrl = String(entry.csvUrl || "").trim();
    const sheetId = String(entry.sheetId || "").trim();
    const gid = String(entry.gid || "0").trim();

    if (!vehicle) {
      throw new Error(`VEHICLE_SHEETS entry ${index + 1} is missing a vehicle name.`);
    }

    if (!csvUrl && !sheetId) {
      throw new Error(`VEHICLE_SHEETS entry ${index + 1} for ${vehicle} is missing csvUrl or sheetId.`);
    }

    return {
      vehicle,
      url: csvUrl || buildGoogleSheetUrl(sheetId, gid)
    };
  });
}

function buildSharedSheetUrl() {
  if (process.env.SHEET_CSV_URL) {
    return process.env.SHEET_CSV_URL;
  }

  const sheetId = process.env.GOOGLE_SHEET_ID;
  const gid = process.env.GOOGLE_SHEET_GID || "0";

  if (!sheetId) {
    throw new Error("Missing GOOGLE_SHEET_ID or SHEET_CSV_URL environment variable.");
  }

  return buildGoogleSheetUrl(sheetId, gid);
}

function getSheetSources() {
  const vehicleSheets = parseVehicleSheetsConfig();

  if (vehicleSheets.length > 0) {
    return vehicleSheets.map((source) => ({
      ...source,
      requiresVehicleColumn: false
    }));
  }

  return [
    {
      vehicle: null,
      url: buildSharedSheetUrl(),
      requiresVehicleColumn: true
    }
  ];
}

function describeSource(source) {
  return source.vehicle || "shared maintenance sheet";
}

function describeFetchError(error) {
  if (!(error instanceof Error)) {
    return "fetch failed";
  }

  const cause = error.cause instanceof Error ? ` (${error.cause.message})` : "";
  return `${error.message}${cause}`;
}

function parseCsv(csvText) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      row.push(current);
      current = "";
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    if (row.some((cell) => cell.trim() !== "")) {
      rows.push(row);
    }
  }

  return rows;
}

function normalizeHeader(value) {
  return value.trim().replace(/\s+/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

function mapRows(rows, defaultVehicle = null, requiresVehicleColumn = true) {
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);
  const records = rows.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = (values[index] || "").trim();
    });
    return record;
  });

  const requiredColumns = requiresVehicleColumn ? ["vehicle", ...REQUIRED_COLUMNS] : REQUIRED_COLUMNS;
  const missing = requiredColumns.filter((key) => !headers.includes(normalizeHeader(key)));
  if (missing.length > 0) {
    throw new Error(`Google Sheet is missing required columns: ${missing.join(", ")}`);
  }

  return records.map((record) => ({
    vehicle: defaultVehicle || record.vehicle,
    serviceType: record.servicetype,
    serviceDate: parseDate(record.servicedate),
    serviceDateLabel: record.servicedate,
    mileage: parseNumber(record.mileage),
    intervalMiles: parseNumber(record.intervalmiles),
    intervalDays: parseNumber(record.intervaldays),
    notes: record.notes || ""
  })).filter((record) => record.vehicle && record.serviceType && record.serviceDate && Number.isFinite(record.mileage));
}

function parseNumber(value) {
  if (!value) {
    return null;
  }

  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const trimmed = String(value).trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDate(date) {
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

function addDays(date, days) {
  if (!date || !Number.isFinite(days)) {
    return null;
  }

  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function compareRecords(a, b) {
  if (a.serviceDate.getTime() !== b.serviceDate.getTime()) {
    return b.serviceDate.getTime() - a.serviceDate.getTime();
  }

  return (b.mileage || 0) - (a.mileage || 0);
}

function summarizeRecords(records, sheetSources = null) {
  const vehicleMap = new Map();
  const serviceMap = new Map();
  const cachedAt = new Date().toISOString();

  for (const record of records) {
    if (!vehicleMap.has(record.vehicle)) {
      vehicleMap.set(record.vehicle, new Set());
    }
    vehicleMap.get(record.vehicle).add(record.serviceType);

    const key = `${record.vehicle}::${record.serviceType}`;
    const existing = serviceMap.get(key);

    if (!existing || compareRecords(record, existing) < 0) {
      serviceMap.set(key, record);
    }
  }

  const vehicles = Array.from(vehicleMap.entries())
    .map(([name, serviceTypes]) => ({
      name,
      serviceTypes: Array.from(serviceTypes).sort((a, b) => a.localeCompare(b))
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const services = Array.from(serviceMap.entries()).map(([key, record]) => {
    const nextMileage = Number.isFinite(record.intervalMiles) ? record.mileage + record.intervalMiles : null;
    const nextDate = Number.isFinite(record.intervalDays) ? addDays(record.serviceDate, record.intervalDays) : null;

    return {
      id: key,
      vehicle: record.vehicle,
      serviceType: record.serviceType,
      lastPerformed: {
        mileage: record.mileage,
        date: formatDate(record.serviceDate)
      },
      nextDue: {
        mileage: nextMileage,
        date: formatDate(nextDate)
      },
      interval: {
        miles: record.intervalMiles,
        days: record.intervalDays
      },
      notes: record.notes
    };
  }).sort((a, b) => a.vehicle.localeCompare(b.vehicle) || a.serviceType.localeCompare(b.serviceType));

  return {
    sheetUrl: sheetSources?.length === 1 ? sheetSources[0].url : null,
    sheetUrls: sheetSources?.map(({ vehicle, url }) => ({ vehicle, url })) || [],
    cachedAt,
    refreshedAt: cachedAt,
    vehicles,
    services
  };
}

export async function getMaintenanceData() {
  if (cache.payload && Date.now() < cache.expiresAt) {
    return cache.payload;
  }

  const sheetSources = getSheetSources();
  const recordGroups = await Promise.all(sheetSources.map(async (source) => {
    let response;
    try {
      response = await fetch(source.url);
    } catch (error) {
      const message = describeFetchError(error);
      throw new Error(`Unable to fetch ${describeSource(source)} from its configured sheet URL: ${message}`);
    }

    if (!response.ok) {
      throw new Error(`Unable to fetch ${describeSource(source)}. Received status ${response.status}.`);
    }

    const csvText = await response.text();
    const rows = parseCsv(csvText);
    return mapRows(rows, source.vehicle, source.requiresVehicleColumn);
  }));

  const payload = summarizeRecords(recordGroups.flat(), sheetSources);

  cache = {
    payload,
    expiresAt: Date.now() + DEFAULT_CACHE_TTL_MINUTES * 60 * 1000
  };

  return payload;
}

export function __internal__() {
  return {
    parseCsv,
    parseVehicleSheetsConfig,
    getSheetSources,
    mapRows,
    summarizeRecords,
    formatDate
  };
}
