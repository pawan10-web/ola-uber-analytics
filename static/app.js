const $ = s => document.querySelector(s);
const api = async (url, opts) => {
  const r = await fetch(url, opts);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
};
const {nf, esc, COLORS} = Charts;
const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
const trim = x => String(+x.toFixed(1));
const compact = (n, axis) => n >= 1e7 ? '₹' + trim(n / 1e7) + 'Cr' : n >= 1e5 ? '₹' + trim(n / 1e5) + 'L' : n >= 1e3 && axis ? '₹' + trim(n / 1e3) + 'k' : nf(n);
const f2 = v => Number(v).toFixed(2);
let META = null;

/* ---------- tabs ---------- */
function showTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  history.replaceState(null, '', '#' + name);
  if (name === 'queries') loadQueries();
  if (name === 'explorer') loadExplorer();
  if (name === 'playground' && !window._pgRan) { window._pgRan = true; runPlayground(); }
}
$('#tabs').addEventListener('click', e => { if (e.target.dataset.tab) showTab(e.target.dataset.tab); });

/* ---------- dashboard ---------- */
const filt = {vehicles: new Set(), from: '', to: ''};

function filterQS() {
  const p = new URLSearchParams();
  filt.vehicles.forEach(v => p.append('vehicle', v));
  if (filt.from) p.set('date_from', filt.from);
  if (filt.to) p.set('date_to', filt.to);
  return p.toString();
}

function buildFilters() {
  $('#f-from').min = $('#f-to').min = META.date_min;
  $('#f-from').max = $('#f-to').max = META.date_max;
  $('#f-vehicles').innerHTML = META.vehicles.map(v => `<button class="chip" data-v="${esc(v)}">${esc(v)}</button>`).join('');
  $('#f-vehicles').addEventListener('click', e => {
    const v = e.target.dataset.v; if (!v) return;
    filt.vehicles.has(v) ? filt.vehicles.delete(v) : filt.vehicles.add(v);
    e.target.classList.toggle('on');
    loadDashboard();
  });
  $('#f-from').onchange = e => { filt.from = e.target.value; loadDashboard(); };
  $('#f-to').onchange = e => { filt.to = e.target.value; loadDashboard(); };
  $('#f-reset').onclick = () => {
    filt.vehicles.clear(); filt.from = filt.to = '';
    $('#f-from').value = $('#f-to').value = '';
    document.querySelectorAll('.chip.on').forEach(c => c.classList.remove('on'));
    loadDashboard();
  };
}

const statusPill = s => {
  const c = s === 'Success' ? 'Success' : s === 'Canceled by Driver' ? 'cd' : s === 'Canceled by Customer' ? 'cc' : 'nf';
  return `<span class="pill ${c}">${esc(s)}</span>`;
};

async function loadDashboard() {
  const d = await api('/api/dashboard?' + filterQS());
  const k = d.kpis, pct = (a, b) => b ? (100 * a / b).toFixed(1) + '%' : '—';

  $('#kpis').innerHTML = [
    ['Total bookings', nf(k.total), 'all statuses', COLORS[1]],
    ['Success rate', pct(k.success, k.total), nf(k.success) + ' completed', COLORS[0]],
    ['Cancelled', pct(k.cancel_customer + k.cancel_driver, k.total),
      `${nf(k.cancel_customer)} customer · ${nf(k.cancel_driver)} driver`, COLORS[3]],
    ['Driver not found', pct(k.no_driver, k.total), nf(k.no_driver) + ' bookings', COLORS[7]],
    ['Revenue', inr(k.revenue || 0), 'successful rides', COLORS[2]],
    ['Avg booking value', inr(k.avg_value || 0), 'per successful ride', COLORS[4]],
    ['Avg distance', (k.avg_distance || 0).toFixed(1) + ' km', 'successful rides', COLORS[5]],
    ['Avg rating', `${(k.avg_driver_rating || 0).toFixed(2)} / ${(k.avg_customer_rating || 0).toFixed(2)}`, 'driver / customer', COLORS[6]],
  ].map(([l, v, s, c]) => `<div class="kpi" style="--k:${c}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');

  Charts.line($('#c-daily'), d.daily.map(x => x.day), [
    {name: 'All bookings', color: COLORS[1], values: d.daily.map(x => x.total)},
    {name: 'Successful', color: COLORS[0], values: d.daily.map(x => x.success)},
    {name: 'Cancelled', color: COLORS[3], values: d.daily.map(x => x.cancelled)},
  ]);
  const stCol = {'Success': COLORS[0], 'Canceled by Driver': COLORS[3], 'Canceled by Customer': COLORS[2], 'Driver Not Found': COLORS[7]};
  Charts.donut($('#c-status'), d.status.map(x => x.label), d.status.map(x => x.n), {colors: d.status.map(x => stCol[x.label])});

  Charts.bar($('#c-revenue'), d.vehicles.map(x => x.vehicle), d.vehicles.map(x => x.revenue), {fmt: (v, axis) => axis ? compact(v, true) : inr(v), color: COLORS[2]});
  Charts.donut($('#c-payment'), d.payment.map(x => x.label), d.payment.map(x => x.n));
  Charts.bar($('#c-hourly'), d.hourly.map(x => x.label), d.hourly.map(x => x.n), {color: COLORS[5]});
  Charts.heatmap($('#c-heat'), d.heatmap);

  Charts.hbar($('#c-cc'), d.cancel_customer.map(x => x.label), d.cancel_customer.map(x => x.n), {color: COLORS[2]});
  Charts.hbar($('#c-cd'), d.cancel_driver.map(x => x.label), d.cancel_driver.map(x => x.n), {color: COLORS[3]});
  Charts.hbar($('#c-inc'), d.incomplete.map(x => x.label), d.incomplete.map(x => x.n), {color: COLORS[4]});
  Charts.hbar($('#c-pick'), d.pickups.map(x => x.label), d.pickups.map(x => x.n), {color: COLORS[1]});
  Charts.hbar($('#c-routes'), d.routes.map(x => x.label), d.routes.map(x => x.n), {color: COLORS[0]});

  Charts.table($('#t-customers'), [
    {label: 'Customer', key: 'customer'}, {label: 'Rides', key: 'rides', num: 1},
    {label: 'Spent', key: 'spent', num: 1, fmt: inr}], d.top_customers);
  Charts.table($('#t-vehicles'), [
    {label: 'Vehicle', key: 'vehicle'}, {label: 'Bookings', key: 'bookings', num: 1, fmt: nf},
    {label: 'Success %', key: 'success_rate', num: 1, fmt: v => v + '%'},
    {label: 'Revenue', key: 'revenue', num: 1, fmt: inr},
    {label: 'Avg km', key: 'avg_distance', num: 1, fmt: v => Number(v).toFixed(1)}, {label: 'Driver ★', key: 'driver_rating', num: 1, fmt: f2},
    {label: 'Customer ★', key: 'customer_rating', num: 1, fmt: f2}], d.vehicles);
}

/* ---------- generic result table ---------- */
function resultTable(el, res) {
  if (!res.rows.length) { el.innerHTML = '<div class="empty">Query returned no rows.</div>'; return; }
  const th = res.columns.map(c => `<th>${esc(c)}</th>`).join('');
  const tr = res.rows.map(r => '<tr>' + r.map(v =>
    `<td class="${typeof v === 'number' ? 'n' : ''}">${v == null ? '<span class="muted">NULL</span>' : esc(v)}</td>`).join('') + '</tr>').join('');
  el.innerHTML = `<div class="muted" style="margin-bottom:6px">${res.rows.length}${res.truncated ? '+' : ''} row(s) · ${res.ms} ms${res.truncated ? ' · truncated to 1000 rows' : ''}</div>
    <div class="tbl-wrap" style="max-height:420px"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

/* ---------- predefined queries ---------- */
let queriesLoaded = false;
async function loadQueries() {
  if (queriesLoaded) return; queriesLoaded = true;
  const list = await api('/api/queries');
  let html = '', last = '', n = 0;
  list.forEach(q => {
    if (q.group !== last) { html += `<div class="group-title">${q.group === 'Original' ? 'Original project queries' : 'Extended analysis'}</div>`; last = q.group; }
    n++;
    html += `<details class="card q" data-id="${q.id}">
      <summary><span class="no ${q.group === 'Extended' ? 'ext' : ''}">${n}</span><div><b>${esc(q.title)}</b><span>${esc(q.description)}</span></div></summary>
      <div class="body"><pre>${esc(q.sql)}</pre>
        <div class="row"><button class="primary run">▶ Run</button><button class="ghost open">Open in playground</button></div>
        <div class="out"></div></div></details>`;
  });
  $('#query-list').innerHTML = html;
  $('#query-list').addEventListener('click', async e => {
    const d = e.target.closest('details'); if (!d) return;
    if (e.target.classList.contains('run')) {
      try { resultTable(d.querySelector('.out'), await api(`/api/queries/${d.dataset.id}/run`)); }
      catch (err) { d.querySelector('.out').innerHTML = `<div class="err">${esc(err.message)}</div>`; }
    }
    if (e.target.classList.contains('open')) {
      $('#sql').value = d.querySelector('pre').textContent; window._pgRan = true; showTab('playground'); runPlayground();
    }
  });
  $('#query-list').addEventListener('toggle', e => {
    const d = e.target; if (d.open && !d.dataset.ran) { d.dataset.ran = 1; d.querySelector('.run').click(); }
  }, true);
}

/* ---------- playground ---------- */
async function runPlayground() {
  $('#pg-meta').textContent = 'Running…';
  try {
    const res = await api('/api/sql', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({sql: $('#sql').value})});
    $('#pg-meta').textContent = '';
    resultTable($('#pg-result'), res);
  } catch (err) {
    $('#pg-meta').textContent = '';
    $('#pg-result').innerHTML = `<div class="err">${esc(err.message)}</div>`;
  }
}
$('#run').onclick = runPlayground;
$('#sql').addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') runPlayground(); });

/* ---------- data explorer ---------- */
const X = {page: 1, per: 20, total: 0};
let xTimer;
async function loadExplorer() {
  const p = new URLSearchParams({page: X.page, per_page: X.per, q: $('#x-q').value, status: $('#x-status').value, vehicle: $('#x-vehicle').value});
  const d = await api('/api/data?' + p);
  X.total = d.total;
  $('#x-count').textContent = nf(d.total) + ' matching bookings';
  Charts.table($('#x-table'), [
    {label: 'Date', key: 'Event_Date'}, {label: 'Time', key: 'Event_Time'}, {label: 'Booking ID', key: 'Booking_ID'},
    {label: 'Status', html: r => statusPill(r.Booking_Status)}, {label: 'Customer', key: 'Customer_ID'},
    {label: 'Vehicle', key: 'Vehicle_Type'}, {label: 'Pickup', key: 'Pickup_Location'}, {label: 'Drop', key: 'Drop_Location'},
    {label: 'Value', key: 'Booking_Value', num: 1, fmt: inr}, {label: 'Payment', key: 'Payment_Method'},
    {label: 'km', key: 'Ride_Distance', num: 1}, {label: 'Driver ★', key: 'Driver_Ratings', num: 1}, {label: 'Cust ★', key: 'Customer_Rating', num: 1},
  ], d.rows);
  const pages = Math.max(1, Math.ceil(d.total / X.per));
  $('#x-page').textContent = `Page ${d.page} of ${nf(pages)}`;
  $('#x-prev').disabled = d.page <= 1; $('#x-next').disabled = d.page >= pages;
}
const resetAndLoad = () => { X.page = 1; loadExplorer(); };
$('#x-q').addEventListener('input', () => { clearTimeout(xTimer); xTimer = setTimeout(resetAndLoad, 300); });
$('#x-status').onchange = $('#x-vehicle').onchange = resetAndLoad;
$('#x-prev').onclick = () => { X.page--; loadExplorer(); };
$('#x-next').onclick = () => { X.page++; loadExplorer(); };

/* ---------- init ---------- */
(async function init() {
  META = await api('/api/meta');
  buildFilters();
  $('#x-status').innerHTML += META.statuses.map(s => `<option>${esc(s)}</option>`).join('');
  $('#x-vehicle').innerHTML += META.vehicles.map(s => `<option>${esc(s)}</option>`).join('');
  $('#schema').innerHTML = META.schema.map(c => `<li data-c="${esc(c.name)}"><b>${esc(c.name)}</b><span>${esc(c.type.toLowerCase())}</span></li>`).join('');
  $('#schema').onclick = e => {
    const li = e.target.closest('li'); if (!li) return;
    const t = $('#sql'); t.setRangeText(li.dataset.c, t.selectionStart, t.selectionEnd, 'end'); t.focus();
  };
  $('#about-stats').innerHTML = [
    [nf(META.total_rows), 'bookings'], [META.vehicles.length, 'vehicle types'], [META.schema.length, 'columns'],
    [META.date_min + ' → ' + META.date_max.slice(5), 'period'],
  ].map(([b, s]) => `<div><b>${b}</b><span>${s}</span></div>`).join('');
  await loadDashboard();
  const h = location.hash.slice(1);
  if (['queries', 'playground', 'explorer', 'about'].includes(h)) showTab(h);
})().catch(e => document.body.insertAdjacentHTML('afterbegin', `<div class="err" style="margin:20px">Failed to load: ${esc(e.message)}</div>`));
