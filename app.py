"""
Ola Ride Analytics - local web dashboard (Flask + SQLite)

Run:   python app.py
Open:  http://localhost:5000
"""
import csv
import os
import re
import sqlite3
import time
from datetime import datetime

from flask import Flask, jsonify, render_template, request

BASE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE, "data", "Bookings.csv")
DB_PATH = os.path.join(BASE, "data", "ola.db")

app = Flask(__name__)

# --------------------------------------------------------------------------
# 1. INGEST + CLEAN  (CSV -> SQLite)
# --------------------------------------------------------------------------
SCHEMA = """
CREATE TABLE bookings (
    Event_Date TEXT,
    Event_Time TEXT,
    Booking_ID TEXT PRIMARY KEY,
    Booking_Status TEXT,
    Customer_ID TEXT,
    Vehicle_Type TEXT,
    Pickup_Location TEXT,
    Drop_Location TEXT,
    V_TAT INTEGER,
    C_TAT INTEGER,
    Canceled_Rides_by_Customer TEXT,
    Canceled_Rides_by_Driver TEXT,
    Incomplete_Rides TEXT,
    Incomplete_Rides_Reason TEXT,
    Booking_Value INTEGER,
    Payment_Method TEXT,
    Ride_Distance INTEGER,
    Driver_Ratings REAL,
    Customer_Rating REAL
);
CREATE INDEX idx_date ON bookings(Event_Date);
CREATE INDEX idx_vehicle ON bookings(Vehicle_Type);
CREATE INDEX idx_status ON bookings(Booking_Status);
"""


def _null(v):
    v = (v or "").strip()
    return None if v == "" or v.lower() in ("null", "nan", "none") else v


def _num(v, cast=float):
    v = _null(v)
    if v is None:
        return None
    try:
        return cast(float(v))
    except ValueError:
        return None


def build_database():
    """Read Bookings.csv, clean it, and load it into SQLite."""
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    con = sqlite3.connect(DB_PATH)
    con.executescript(SCHEMA)

    rows, skipped = [], 0
    with open(CSV_PATH, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        next(reader)  # header
        for r in reader:
            r = (r + [""] * 19)[:19]
            # the raw file has ~82k completely blank rows -> drop them
            if not _null(r[0]) or not _null(r[2]):
                skipped += 1
                continue
            date_s = r[0].strip()
            event_date = date_s.split(" ")[0]
            try:
                t = datetime.strptime(r[1].strip(), "%H:%M:%S").strftime("%H:%M:%S")
            except ValueError:
                t = None
            rows.append((
                event_date, t, r[2].strip(), _null(r[3]), _null(r[4]), _null(r[5]),
                _null(r[6]), _null(r[7]), _num(r[8], int), _num(r[9], int),
                _null(r[10]), _null(r[11]), _null(r[12]), _null(r[13]),
                _num(r[14], int), _null(r[15]), _num(r[16], int),
                _num(r[17]), _num(r[18]),
            ))
    con.executemany("INSERT OR IGNORE INTO bookings VALUES (%s)" % ",".join("?" * 19), rows)
    con.commit()
    con.close()
    print(f"[ETL] loaded {len(rows):,} bookings, dropped {skipped:,} blank rows")


def ensure_db():
    if (not os.path.exists(DB_PATH)
            or os.path.getmtime(DB_PATH) < os.path.getmtime(CSV_PATH)):
        build_database()


def db():
    """Read-only connection (so the SQL playground can never modify data)."""
    con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    return con


def rows(con, sql, params=()):
    return [dict(r) for r in con.execute(sql, params).fetchall()]


# --------------------------------------------------------------------------
# 2. FILTERS
# --------------------------------------------------------------------------
def where_clause(extra=None):
    conds, params = [], []
    vehicles = [v for v in request.args.getlist("vehicle") if v]
    if vehicles:
        conds.append("Vehicle_Type IN (%s)" % ",".join("?" * len(vehicles)))
        params += vehicles
    if request.args.get("date_from"):
        conds.append("Event_Date >= ?")
        params.append(request.args["date_from"])
    if request.args.get("date_to"):
        conds.append("Event_Date <= ?")
        params.append(request.args["date_to"])
    if extra:
        conds.append(extra)
    return (" WHERE " + " AND ".join(conds)) if conds else "", params


# --------------------------------------------------------------------------
# 3. PAGES + API
# --------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/meta")
def meta():
    con = db()
    out = {
        "vehicles": [r["Vehicle_Type"] for r in rows(con, "SELECT DISTINCT Vehicle_Type FROM bookings ORDER BY 1")],
        "statuses": [r["Booking_Status"] for r in rows(con, "SELECT DISTINCT Booking_Status FROM bookings ORDER BY 1")],
        "date_min": con.execute("SELECT MIN(Event_Date) FROM bookings").fetchone()[0],
        "date_max": con.execute("SELECT MAX(Event_Date) FROM bookings").fetchone()[0],
        "schema": rows(con, "PRAGMA table_info(bookings)"),
        "total_rows": con.execute("SELECT COUNT(*) FROM bookings").fetchone()[0],
    }
    return jsonify(out)


@app.route("/api/dashboard")
def dashboard():
    con = db()
    W, P = where_clause()
    WS, PS = where_clause("Booking_Status = 'Success'")

    k = rows(con, f"""
        SELECT COUNT(*) AS total,
               SUM(Booking_Status='Success') AS success,
               SUM(Booking_Status='Canceled by Customer') AS cancel_customer,
               SUM(Booking_Status='Canceled by Driver') AS cancel_driver,
               SUM(Booking_Status='Driver Not Found') AS no_driver,
               SUM(CASE WHEN Booking_Status='Success' THEN Booking_Value END) AS revenue,
               AVG(CASE WHEN Booking_Status='Success' THEN Booking_Value END) AS avg_value,
               AVG(CASE WHEN Booking_Status='Success' THEN Ride_Distance END) AS avg_distance,
               AVG(Driver_Ratings) AS avg_driver_rating,
               AVG(Customer_Rating) AS avg_customer_rating
        FROM bookings {W}""", P)[0]

    def group(col, extra=None, where=None, order="n DESC", limit=None, value="COUNT(*)"):
        w, p = where_clause(extra) if where is None else where
        sql = f"SELECT {col} AS label, {value} AS n FROM bookings {w} GROUP BY {col} ORDER BY {order}"
        if limit:
            sql += f" LIMIT {limit}"
        return rows(con, sql, p)

    daily = rows(con, f"""
        SELECT Event_Date AS day, COUNT(*) AS total,
               SUM(Booking_Status='Success') AS success,
               SUM(Booking_Status LIKE 'Canceled%') AS cancelled
        FROM bookings {W} GROUP BY Event_Date ORDER BY Event_Date""", P)

    hourly = rows(con, f"""
        SELECT CAST(strftime('%H', Event_Time) AS INTEGER) AS label, COUNT(*) AS n
        FROM bookings {W} GROUP BY 1 ORDER BY 1""", P)

    heat = rows(con, f"""
        SELECT CAST(strftime('%w', Event_Date) AS INTEGER) AS dow,
               CAST(strftime('%H', Event_Time) AS INTEGER) AS hr, COUNT(*) AS n
        FROM bookings {W} GROUP BY 1, 2""", P)

    vehicles = rows(con, f"""
        SELECT Vehicle_Type AS vehicle, COUNT(*) AS bookings,
               ROUND(100.0*SUM(Booking_Status='Success')/COUNT(*), 1) AS success_rate,
               COALESCE(SUM(CASE WHEN Booking_Status='Success' THEN Booking_Value END),0) AS revenue,
               ROUND(AVG(CASE WHEN Booking_Status='Success' THEN Ride_Distance END),1) AS avg_distance,
               ROUND(AVG(Driver_Ratings),2) AS driver_rating,
               ROUND(AVG(Customer_Rating),2) AS customer_rating
        FROM bookings {W} GROUP BY Vehicle_Type ORDER BY revenue DESC""", P)

    top_customers = rows(con, f"""
        SELECT Customer_ID AS customer, COUNT(*) AS rides,
               COALESCE(SUM(CASE WHEN Booking_Status='Success' THEN Booking_Value END),0) AS spent
        FROM bookings {W} GROUP BY Customer_ID ORDER BY rides DESC, spent DESC LIMIT 5""", P)

    return jsonify({
        "kpis": k,
        "daily": daily,
        "status": group("Booking_Status"),
        "payment": group("Payment_Method", "Payment_Method IS NOT NULL"),
        "hourly": hourly,
        "heatmap": heat,
        "vehicles": vehicles,
        "cancel_customer": group("Canceled_Rides_by_Customer", "Canceled_Rides_by_Customer IS NOT NULL"),
        "cancel_driver": group("Canceled_Rides_by_Driver", "Canceled_Rides_by_Driver IS NOT NULL"),
        "incomplete": group("Incomplete_Rides_Reason", "Incomplete_Rides_Reason IS NOT NULL"),
        "pickups": group("Pickup_Location", limit=10),
        "routes": group("Pickup_Location || ' → ' || Drop_Location", limit=8),
        "top_customers": top_customers,
    })


# ---- Predefined SQL (the 10 from the original project + 6 extended) -------
QUERIES = [
    # ---- original 10 ----
    ("Original", "Successful bookings",
     "Retrieve all successful bookings.",
     "SELECT * FROM bookings\nWHERE Booking_Status = 'Success'\nLIMIT 100;"),
    ("Original", "Average ride distance per vehicle type",
     "Average distance travelled for each vehicle category.",
     "SELECT Vehicle_Type, ROUND(AVG(Ride_Distance), 2) AS avg_distance\nFROM bookings\nGROUP BY Vehicle_Type;"),
    ("Original", "Rides cancelled by customers",
     "Total number of rides cancelled by customers.",
     "SELECT COUNT(*) AS cancelled_by_customers\nFROM bookings\nWHERE Booking_Status = 'Canceled by Customer';"),
    ("Original", "Top 5 customers by bookings",
     "Customers who booked the highest number of rides.",
     "SELECT Customer_ID, COUNT(Booking_ID) AS total_rides\nFROM bookings\nGROUP BY Customer_ID\nORDER BY total_rides DESC\nLIMIT 5;"),
    ("Original", "Driver cancellations: personal & car issues",
     "Rides cancelled by drivers because of personal or car-related issues.",
     "SELECT COUNT(*) AS cancelled_personal_car_issue\nFROM bookings\nWHERE Canceled_Rides_by_Driver = 'Personal & Car related issue';"),
    ("Original", "Max & min driver rating for Prime Sedan",
     "Highest and lowest driver rating among Prime Sedan bookings.",
     "SELECT MAX(Driver_Ratings) AS max_driver_rating,\n       MIN(Driver_Ratings) AS min_driver_rating\nFROM bookings\nWHERE Vehicle_Type = 'Prime Sedan';"),
    ("Original", "Rides paid by UPI",
     "All rides where the payment was made using UPI.",
     "SELECT * FROM bookings\nWHERE Payment_Method = 'UPI'\nLIMIT 100;"),
    ("Original", "Average customer rating per vehicle type",
     "How customers rate each vehicle category on average.",
     "SELECT Vehicle_Type, ROUND(AVG(Customer_Rating), 2) AS avg_customer_rating\nFROM bookings\nGROUP BY Vehicle_Type;"),
    ("Original", "Total value of successful rides",
     "Total booking value of all rides completed successfully.",
     "SELECT SUM(Booking_Value) AS total_successful_ride_value\nFROM bookings\nWHERE Booking_Status = 'Success';"),
    ("Original", "Incomplete rides with reason",
     "All incomplete rides along with the reason.",
     "SELECT Customer_ID, Booking_ID, Incomplete_Rides, Incomplete_Rides_Reason\nFROM bookings\nWHERE Incomplete_Rides = 'Yes';"),
    # ---- extended ----
    ("Extended", "Cancellation rate by vehicle type",
     "Share of bookings that ended in a cancellation, per vehicle.",
     "SELECT Vehicle_Type,\n       COUNT(*) AS total,\n       SUM(Booking_Status LIKE 'Canceled%') AS cancelled,\n       ROUND(100.0 * SUM(Booking_Status LIKE 'Canceled%') / COUNT(*), 2) AS cancel_rate_pct\nFROM bookings\nGROUP BY Vehicle_Type\nORDER BY cancel_rate_pct DESC;"),
    ("Extended", "Revenue by payment method",
     "Which payment mode brings in the most money (successful rides).",
     "SELECT Payment_Method,\n       COUNT(*) AS rides,\n       SUM(Booking_Value) AS revenue,\n       ROUND(AVG(Booking_Value), 1) AS avg_value\nFROM bookings\nWHERE Booking_Status = 'Success'\nGROUP BY Payment_Method\nORDER BY revenue DESC;"),
    ("Extended", "Peak booking hours",
     "Busiest hours of the day.",
     "SELECT CAST(strftime('%H', Event_Time) AS INTEGER) AS hour_of_day,\n       COUNT(*) AS bookings\nFROM bookings\nGROUP BY hour_of_day\nORDER BY bookings DESC\nLIMIT 5;"),
    ("Extended", "Top 10 routes",
     "Most frequently booked pickup → drop routes.",
     "SELECT Pickup_Location || ' -> ' || Drop_Location AS route,\n       COUNT(*) AS bookings\nFROM bookings\nGROUP BY route\nORDER BY bookings DESC\nLIMIT 10;"),
    ("Extended", "Rank vehicles by revenue within each payment method (window function)",
     "Uses RANK() OVER (PARTITION BY ...) to rank vehicle types inside every payment method.",
     "SELECT Payment_Method, Vehicle_Type,\n       SUM(Booking_Value) AS revenue,\n       RANK() OVER (PARTITION BY Payment_Method\n                    ORDER BY SUM(Booking_Value) DESC) AS rank_in_method\nFROM bookings\nWHERE Booking_Status = 'Success'\nGROUP BY Payment_Method, Vehicle_Type;"),
    ("Extended", "Running (cumulative) revenue per day (window function)",
     "Daily revenue and a running total using SUM() OVER (ORDER BY ...).",
     "WITH daily AS (\n  SELECT Event_Date, SUM(Booking_Value) AS revenue\n  FROM bookings\n  WHERE Booking_Status = 'Success'\n  GROUP BY Event_Date\n)\nSELECT Event_Date, revenue,\n       SUM(revenue) OVER (ORDER BY Event_Date) AS cumulative_revenue\nFROM daily;"),
]


@app.route("/api/queries")
def list_queries():
    return jsonify([{"id": i, "group": g, "title": t, "description": d, "sql": s}
                    for i, (g, t, d, s) in enumerate(QUERIES)])


# ---- Safe SQL runner --------------------------------------------------------
MAX_ROWS = 1000


def run_sql(sql):
    sql = (sql or "").strip().rstrip(";").strip()
    if not sql:
        raise ValueError("Please enter a query.")
    if ";" in sql:
        raise ValueError("Only a single statement is allowed.")
    if not re.match(r"^(select|with)\b", sql, re.I):
        raise ValueError("Only SELECT queries are allowed (read-only playground).")
    con = db()
    started = time.time()
    # abort runaway queries after ~3s
    con.set_progress_handler(lambda: 1 if time.time() - started > 3 else 0, 10000)
    try:
        cur = con.execute(sql)
        cols = [c[0] for c in cur.description]
        data = cur.fetchmany(MAX_ROWS + 1)
    except sqlite3.Error as e:
        raise ValueError(str(e))
    truncated = len(data) > MAX_ROWS
    data = data[:MAX_ROWS]
    return {
        "columns": cols,
        "rows": [list(r) for r in data],
        "truncated": truncated,
        "ms": round((time.time() - started) * 1000, 1),
    }


@app.route("/api/queries/<int:qid>/run")
def run_predefined(qid):
    if not 0 <= qid < len(QUERIES):
        return jsonify({"error": "Unknown query"}), 404
    return jsonify(run_sql(QUERIES[qid][3]))


@app.route("/api/sql", methods=["POST"])
def sql_endpoint():
    try:
        return jsonify(run_sql((request.get_json(silent=True) or {}).get("sql")))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/data")
def data_explorer():
    con = db()
    page = max(int(request.args.get("page", 1)), 1)
    per = min(max(int(request.args.get("per_page", 20)), 1), 100)
    conds, params = [], []
    if request.args.get("status"):
        conds.append("Booking_Status = ?")
        params.append(request.args["status"])
    if request.args.get("vehicle"):
        conds.append("Vehicle_Type = ?")
        params.append(request.args["vehicle"])
    q = request.args.get("q", "").strip()
    if q:
        conds.append("(Booking_ID LIKE ? OR Customer_ID LIKE ? OR Pickup_Location LIKE ? OR Drop_Location LIKE ?)")
        params += [f"%{q}%"] * 4
    W = (" WHERE " + " AND ".join(conds)) if conds else ""
    total = con.execute(f"SELECT COUNT(*) FROM bookings{W}", params).fetchone()[0]
    data = rows(con, f"""SELECT Event_Date, Event_Time, Booking_ID, Booking_Status, Customer_ID,
        Vehicle_Type, Pickup_Location, Drop_Location, Booking_Value, Payment_Method,
        Ride_Distance, Driver_Ratings, Customer_Rating
        FROM bookings{W} ORDER BY Event_Date DESC, Event_Time DESC LIMIT ? OFFSET ?""",
        params + [per, (page - 1) * per])
    return jsonify({"total": total, "page": page, "per_page": per, "rows": data})


if __name__ == "__main__":
    ensure_db()
    print("\n  Ola Ride Analytics running  ->  http://localhost:5000\n")
    app.run(host="127.0.0.1", port=5000, debug=False)
