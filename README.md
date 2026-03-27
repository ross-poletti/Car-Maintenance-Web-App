# car-maintenance

This project is a dockerized vehicle maintenance tracker with:

- A `Node.js` API that reads a live Google Sheet published as CSV
- A `React` frontend for selecting a vehicle and maintenance type
- Automatic calculation of the last performed service and next due date or mileage

## Google Sheet Format

Publish your Google Sheet so it can be read as CSV, then make sure the sheet includes these columns:

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

## Example Sheet Data

You can use the sample file at [`examples/sample-maintenance-log.csv`](d:/Coding%20Projects%20/Car%20Maintenance%20Web%20App/examples/sample-maintenance-log.csv) to create your Google Sheet.

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
2. Import [`examples/sample-maintenance-log.csv`](d:/Coding%20Projects%20/Car%20Maintenance%20Web%20App/examples/sample-maintenance-log.csv).
3. In Google Sheets, use `File > Share > Publish to web`.
4. Publish the sheet as CSV.
5. Put the sheet ID into `.env` as `GOOGLE_SHEET_ID`.

## Run With Docker

1. Copy `.env.example` to `.env`
2. Fill in your Google Sheet values
3. Start the app:

```bash
docker compose up --build
```

Then open:

- Frontend: `http://localhost:3000`
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
- build and push Docker images to `ghcr.io`

Published images:

- `ghcr.io/<your-github-owner>/car-maintenance-api`
- `ghcr.io/<your-github-owner>/car-maintenance-web`

Set this GitHub Actions repository variable before building:

- `VITE_API_BASE_URL`

The frontend no longer relies on a hard-coded `localhost` API URL. By default it expects the API to be available at a relative path.

If your deployment serves the frontend and API from the same host, this should usually be:

```text
/api
```

If your deployment serves the API from a different domain, set `VITE_API_BASE_URL` to that full public URL during the image build.

## Notes

- If you already have a direct CSV export URL, you can set `SHEET_CSV_URL` instead of `GOOGLE_SHEET_ID`.
- The backend caches sheet results for `CACHE_TTL_MINUTES` to avoid refetching on every request.
- If you want to test without Google Sheets first, point `SHEET_CSV_URL` at any publicly accessible CSV with the same columns.
