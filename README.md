# car-maintenance

This project is a dockerized vehicle maintenance tracker with:

- A `Node.js` server that reads one or more live Google Sheets published as CSV
- A `React` frontend served by that same Node container
- Automatic calculation of the last performed service and next due date or mileage

## Google Sheet Format

Publish each Google Sheet so it can be read as CSV.

For the recommended one-sheet-per-vehicle setup, each vehicle sheet should include these columns:

| Column | Required | Example |
| --- | --- | --- |
| `Service Type` | Yes | `Oil Change` |
| `Service Date` | Yes | `2026-03-01` |
| `Mileage` | Yes | `45210` |
| `Interval Miles` | No | `5000` |
| `Interval Days` | No | `180` |
| `Notes` | No | `Full synthetic` |

The vehicle name comes from `VEHICLE_SHEETS` in your `.env` file.

If you prefer the legacy shared-sheet setup, include a `Vehicle` column too:

| Column | Required | Example |
| --- | --- | --- |
| `Vehicle` | Yes | `2018 Toyota Tacoma` |
| `Service Type` | Yes | `Oil Change` |
| `Service Date` | Yes | `2026-03-01` |
| `Mileage` | Yes | `45210` |
| `Interval Miles` | No | `5000` |
| `Interval Days` | No | `180` |
| `Notes` | No | `Full synthetic` |

The app uses the most recent matching record for each `Vehicle + Service Type` pair.

## Multiple Vehicle Sheets

Set `VEHICLE_SHEETS` to a JSON array. Each entry needs a `vehicle` name and either a `sheetId` with optional `gid`, or a direct `csvUrl`.

```env
VEHICLE_SHEETS=[{"vehicle":"2018 Toyota Tacoma","sheetId":"SHEETID1","gid":"0"},{"vehicle":"2020 Honda CR-V","sheetId":"SHEETID2","gid":"0"}]
```

Direct CSV URLs work too:

```env
VEHICLE_SHEETS=[{"vehicle":"2018 Toyota Tacoma","csvUrl":"https://example.com/tacoma.csv"},{"vehicle":"2020 Honda CR-V","csvUrl":"https://example.com/crv.csv"}]
```

When `VEHICLE_SHEETS` is set, the app ignores `GOOGLE_SHEET_ID`, `GOOGLE_SHEET_GID`, and `SHEET_CSV_URL`.

## Example Sheet Data

You can use the sample file at [`examples/sample-maintenance-log.csv`](examples/sample-maintenance-log.csv) to create a shared Google Sheet.

Example rows:

| Vehicle | Service Type | Service Date | Mileage | Interval Miles | Interval Days | Notes |
| --- | --- | --- | ---: | ---: | ---: | --- |
| `2018 Toyota Tacoma` | `Oil Change` | `2026-01-15` | `45210` | `5000` | `180` | `Full synthetic oil and OEM filter` |
| `2020 Honda CR-V` | `Brake Fluid` | `2025-09-05` | `34100` |  | `730` | `Full brake fluid flush` |
| `2016 Ford F-150` | `Transmission Service` | `2025-08-14` | `81200` | `30000` | `730` | `Transmission fluid service` |

If you select `2018 Toyota Tacoma` and `Oil Change`, the app will show:

- Last performed: `Jan 15, 2026` at `45,210 mi`
- Next due mileage: `50,210 mi`
- Next due date: about `180 days` later

## Quick Google Sheets Setup

1. Create a new Google Sheet.
2. Import [`examples/sample-maintenance-log.csv`](examples/sample-maintenance-log.csv), or create one sheet per vehicle using the same columns without `Vehicle`.
3. In Google Sheets, use `File > Share > Publish to web`.
4. Publish the sheet as CSV.
5. Put the sheet IDs or CSV URLs into `.env` as `VEHICLE_SHEETS`.

## Run With Docker

1. Copy `.env.example` to `.env`
2. Fill in your Google Sheet values
3. Build the image:

```bash
docker build -t car-maintenance .
```

4. Run the container:

```bash
docker run --env-file .env -p 4000:4000 car-maintenance
```

Then open:

- Frontend: `http://localhost:4000`
- API: `http://localhost:4000/api/maintenance`

## Local Development

Install dependencies:

```bash
npm install
```

Run both apps:

```bash
npm run dev
```

## GitHub Actions Build

The repo includes [`build.yaml`](d:/Coding%20Projects%20/Car%20Maintenance%20Web%20App/.github/workflows/build.yaml) for GitHub Actions.

It will:

- install dependencies with `npm ci`
- run the backend tests
- build the React frontend
- build and push a Docker image to `ghcr.io`

Published image:

- `ghcr.io/<your-github-owner>/car-maintenance`

No app URL variable is required just to build the image.

The frontend uses relative `/api` requests, so the same image can work in different environments without rebuilding it.

If you want to store the public deployment URL in GitHub for later deployment automation, use a repository variable like:

- `APP_BASE_URL`

Example:

```text
https://car-maintenance.yourdomain.com
```

That value is for your deployment process and environment configuration, not for the image build itself.

## Notes

- If you want one shared sheet instead, set `GOOGLE_SHEET_ID` or `SHEET_CSV_URL` and include the `Vehicle` column.
- The backend caches sheet results for `CACHE_TTL_MINUTES` to avoid refetching on every request.
- If you want to test without Google Sheets first, point `SHEET_CSV_URL` at any publicly accessible CSV with the same columns.
