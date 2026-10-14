# 🚖 Ola Ride Analytics — Big Data Analytics Mini Project

A web version of the Ola ride-data analysis. It runs **locally in your browser** (`http://localhost:5000`)
— no MySQL, no Power BI, no internet needed.

## What it does
| Tab | Features |
|---|---|
| **Dashboard** | 8 KPI cards, daily trend, booking-status donut, revenue by vehicle, payment split, hourly demand, weekday×hour heatmap, cancellation/incomplete reasons, top pickups & routes, top customers, vehicle scorecard. Filter by **date range** and **vehicle type**. |
| **SQL Queries** | The 10 queries from the original project + 6 extended ones (window functions). Each one shows its SQL and runs live. |
| **SQL Playground** | Write your own `SELECT` queries (read-only, safe). Click a column name to insert it. |
| **Data Explorer** | Search, filter and page through all 20,407 bookings. |
| **About** | Pipeline, tech stack, data-quality notes (useful for your viva/report). |

## How to run
1. Install **Python 3.9+** (check: `python --version`).
2. Open a terminal in this folder and install Flask:
   ```
   pip install -r requirements.txt
   ```
3. Start the app:
   ```
   python app.py
   ```
4. Open **http://localhost:5000** in your browser. Stop with `Ctrl + C`.

On first start the app reads `data/Bookings.csv`, cleans it and builds `data/ola.db` (takes ~1 second).

## Project structure
```
ola-bda-dashboard/
├── app.py               # Flask server: ETL (CSV→SQLite), REST API, SQL runner
├── requirements.txt
├── data/Bookings.csv    # raw dataset
├── templates/index.html # page layout
├── static/
│   ├── style.css
│   ├── charts.js        # hand-written SVG chart library (no external libs)
│   └── app.js           # dashboard logic, tabs, playground, explorer
└── original/            # your original SQL file, Power BI file and README
```

## Data pipeline
`CSV → clean (drop ~82k blank rows, "null"→NULL, fix types) → SQLite → SQL aggregation → Flask JSON API → browser charts`

## REST API (for your report)
| Endpoint | Purpose |
|---|---|
| `GET /api/dashboard?vehicle=Bike&date_from=…&date_to=…` | all KPIs & chart data |
| `GET /api/queries`, `GET /api/queries/<id>/run` | predefined SQL queries |
| `POST /api/sql` `{"sql": "SELECT …"}` | read-only SQL playground |
| `GET /api/data?page=1&q=…&status=…&vehicle=…` | paginated raw data |
| `GET /api/meta` | filters, schema, date range |

## Notes
* Dataset: 20,407 Ola bookings, Bengaluru, 1–30 July 2024.
* Revenue = sum of `Booking_Value` where `Booking_Status = 'Success'` (cancelled rows also carry a value).
* SQL dialect is SQLite; the original MySQL queries needed no change except removing `CREATE VIEW`.
* Port busy? Change `port=5000` at the bottom of `app.py`.
