# Car Maintenance Log

A small, self-hosted vehicle maintenance tracker. It reads maintenance records straight from one or
more live Google Sheets (or any published CSV), works out when each service was last done and when
it's next due, and shows it all in a single-page React dashboard served by a Node/Express backend.

## Features

- Live data source — no database. Point it at a published Google Sheet CSV and edit the sheet to
  update the app.
- Supports either one sheet per vehicle or a single shared sheet with a `Vehicle` column.
- Automatically computes the most recent service per vehicle/service-type pair, plus the next due
  mileage and/or date based on configurable intervals.
- Server-side response caching (`CACHE_TTL_MINUTES`) so the sheet isn't refetched on every request.
- Single Docker image: the Express server serves both the API and the built React app.

## Tech Stack

| Layer | Stack |
| --- | --- |
| Frontend | React 19 + Vite 7 |
| Backend | Node.js + Express |
| Data source | Google Sheets published as CSV (or any CSV URL) |
| Packaging | Docker (multi-stage build), npm workspaces |
| CI/CD | GitHub Actions and Gitea Actions, both building/pushing to GHCR |

## Project Structure

```
├── client/           React frontend (Vite)
│   └── src/
├── server/           Express API + Google Sheet fetching/parsing
│   └── src/
├── examples/         Sample CSV for a shared maintenance sheet
├── Dockerfile         Multi-stage build: install → build client → run server
├── .github/workflows  GitHub Actions build/publish pipeline
└── .gitea/workflows   Gitea Actions build/publish pipeline
```

## Google Sheet Format

Publish each Google Sheet so it can be read as CSV (`File > Share > Publish to web`, format: CSV).

**Recommended: one sheet per vehicle.** The vehicle name comes from `VEHICLE_SHEETS` in `.env`, so
the sheet itself only needs:

| Column | Required | Example |
| --- | --- | --- |
| `Service Type` | Yes | `Oil Change` |
| `Service Date` | Yes | `2026-03-01` |
| `Mileage` | Yes | `45210` |
| `Interval Miles` | No | `5000` |
| `Interval Days` | No | `180` |
| `Notes` | No | `Full synthetic` |

**Legacy: one shared sheet for all vehicles.** Add a `Vehicle` column and set `GOOGLE_SHEET_ID` or
`SHEET_CSV_URL` instead of `VEHICLE_SHEETS`:

| Column | Required | Example |
| --- | --- | --- |
| `Vehicle` | Yes | `2018 Toyota Tacoma` |
| `Service Type` | Yes | `Oil Change` |
| `Service Date` | Yes | `2026-03-01` |
| `Mileage` | Yes | `45210` |
| `Interval Miles` | No | `5000` |
| `Interval Days` | No | `180` |
| `Notes` | No | `Full synthetic` |

The app uses the most recent matching record for each `Vehicle + Service Type` pair (by date, then
mileage as a tiebreaker).

## Environment Variables

Copy `.env.example` to `.env` and fill in your values.

| Variable | Description |
| --- | --- |
| `VEHICLE_SHEETS` | JSON array for the one-sheet-per-vehicle setup. See below. Takes priority over the shared-sheet variables. |
| `GOOGLE_SHEET_ID` | Shared-sheet setup: the Google Sheet ID to read. |
| `GOOGLE_SHEET_GID` | Shared-sheet setup: the sheet tab's `gid` (defaults to `0`). |
| `SHEET_CSV_URL` | Shared-sheet setup: a direct CSV URL, used instead of `GOOGLE_SHEET_ID`. Useful for testing with any public CSV. |
| `CACHE_TTL_MINUTES` | How long fetched sheet data is cached before being refetched. Default `10`. |
| `VITE_API_BASE_URL` | Base path the frontend uses to call the API. Default `/api`. |
| `PORT` | Port the Express server listens on. Default `4000`. |

### Multiple Vehicle Sheets

Set `VEHICLE_SHEETS` to a JSON array. Each entry needs a `vehicle` name and either a `sheetId`
(with optional `gid`) or a direct `csvUrl`:

```env
VEHICLE_SHEETS=[{"vehicle":"2018 Toyota Tacoma","sheetId":"SHEETID1","gid":"0"},{"vehicle":"2020 Honda CR-V","sheetId":"SHEETID2","gid":"0"}]
```

Direct CSV URLs work too, and can be mixed with `sheetId` entries:

```env
VEHICLE_SHEETS=[{"vehicle":"2018 Toyota Tacoma","csvUrl":"https://example.com/tacoma.csv"},{"vehicle":"2020 Honda CR-V","csvUrl":"https://example.com/crv.csv"}]
```

When `VEHICLE_SHEETS` is set, `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_GID`, and `SHEET_CSV_URL` are ignored.

## Example Sheet Data

Use [`examples/sample-maintenance-log.csv`](examples/sample-maintenance-log.csv) as a starting
point for the shared-sheet format:

| Vehicle | Service Type | Service Date | Mileage | Interval Miles | Interval Days | Notes |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `2018 Toyota Tacoma` | `Oil Change` | `2026-01-15` | `45210` | `5000` | `180` | `Full synthetic oil and OEM filter` |
| `2020 Honda CR-V` | `Brake Fluid` | `2025-09-05` | `34100` |  | `730` | `Full brake fluid flush` |
| `2016 Ford F-150` | `Transmission Service` | `2025-08-14` | `81200` | `30000` | `730` | `Transmission fluid service` |

Selecting `2018 Toyota Tacoma` / `Oil Change` from that data shows:

- Last performed: `Jan 15, 2026` at `45,210 mi`
- Next due mileage: `50,210 mi`
- Next due date: about `180 days` later

### Quick Google Sheets Setup

1. Create a new Google Sheet (or one per vehicle).
2. Import `examples/sample-maintenance-log.csv`, or lay out the same columns yourself.
3. `File > Share > Publish to web`, and publish as CSV.
4. Put the sheet ID(s) or CSV URL(s) into `.env` as `VEHICLE_SHEETS` (or `GOOGLE_SHEET_ID` /
   `SHEET_CSV_URL` for the shared-sheet setup).

## Getting Started

### Local Development

```bash
npm install
npm run dev
```

This runs the Express API (with `--watch`) and the Vite dev server concurrently. The client proxies
API calls to `VITE_API_BASE_URL`.

Run backend tests:

```bash
npm test
```

### Run With Docker

1. Copy `.env.example` to `.env` and fill in your Google Sheet values.
2. Build the image:

   ```bash
   docker build -t car-maintenance .
   ```

3. Run the container:

   ```bash
   docker run --env-file .env -p 4000:4000 car-maintenance
   ```

4. Open:

   - Frontend: `http://localhost:4000`
   - API: `http://localhost:4000/api/maintenance`

The frontend uses relative `/api` requests by default, so the same image works across environments
without rebuilding.

## API

| Endpoint | Description |
| --- | --- |
| `GET /api/health` | Liveness check, returns `{ ok: true }`. |
| `GET /api/maintenance` | Fetches (or returns cached) sheet data: vehicles, service types, and the computed last/next-due summary for each. |

## CI/CD

Two equivalent pipelines run on pushes to `staging` or `main`:

- [`.github/workflows/build.yaml`](.github/workflows/build.yaml) — GitHub Actions, pushes to
  GHCR (`ghcr.io/<owner>/car-maintenance`).
- [`.gitea/workflows/build.yaml`](.gitea/workflows/build.yaml) — Gitea Actions, pushes to the
  Gitea instance's own container registry (`git.polettis.com/rpoletti/car-maintenance`) using a
  personal access token stored as the `PACKAGE_TOKEN` secret.

Both run the same steps:

1. `npm ci`
2. Run backend tests (`npm test -w server`)
3. Build the React frontend (`npm run build -w client`)
4. Build and push a Docker image, tagged `staging` or `latest` to match the branch

No app URL needs to be known at build time — the frontend only ever calls a relative `/api` path.
If you want to record a deployment URL for your own automation, a repo variable like `APP_BASE_URL`
(e.g. `https://car-maintenance.yourdomain.com`) is a reasonable place for it; it isn't read by the
build itself.

## Notes

- For a single shared sheet, set `GOOGLE_SHEET_ID` or `SHEET_CSV_URL` and include the `Vehicle`
  column in that sheet.
- To try the app without Google Sheets, point `SHEET_CSV_URL` at any publicly accessible CSV that
  has the required columns.
- Sheet data is cached in memory for `CACHE_TTL_MINUTES`; the dashboard shows when the current data
  was cached.
