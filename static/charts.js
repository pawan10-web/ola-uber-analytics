/* Tiny dependency-free chart helpers (SVG + HTML). Works fully offline. */
const Charts = (() => {
  const COLORS = ['#1f9d55','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#14b8a6','#ec4899','#64748b'];
  const nf = n => (n ?? 0).toLocaleString('en-IN', {maximumFractionDigits: 1});
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const tip = () => document.getElementById('tip');

  // one global tooltip, driven by data-tip attributes
  document.addEventListener('mousemove', e => {
    const t = tip(), el = e.target.closest('[data-tip]');
    if (!el) { t.classList.remove('on'); return; }
    t.innerHTML = el.dataset.tip;
    t.style.left = Math.min(e.clientX + 14, innerWidth - 270) + 'px';
    t.style.top = (e.clientY + 14) + 'px';
    t.classList.add('on');
  });

  function niceMax(v) {
    if (v <= 0) return 1;
    const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
  }
  const empty = el => el.innerHTML = '<div class="empty">No data for the selected filters</div>';

  /* vertical bar chart */
  function bar(el, labels, values, o = {}) {
    if (!values.length || !values.some(v => v > 0)) return empty(el);
    const W = 560, H = 260, m = {l: 48, r: 8, t: 10, b: 30};
    const max = niceMax(Math.max(...values)), iw = W - m.l - m.r, ih = H - m.t - m.b;
    const bw = iw / values.length, fmt = o.fmt || nf;
    let s = `<svg viewBox="0 0 ${W} ${H}">`;
    for (let i = 0; i <= 4; i++) {
      const y = m.t + ih - ih * i / 4;
      s += `<line class="grid-line" x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/>
            <text x="${m.l - 6}" y="${y + 4}" text-anchor="end">${fmt(max * i / 4, true)}</text>`;
    }
    values.forEach((v, i) => {
      const h = ih * v / max, x = m.l + i * bw + bw * .15, y = m.t + ih - h;
      const col = o.colors ? o.colors[i % o.colors.length] : (o.color || COLORS[1]);
      s += `<rect x="${x}" y="${y}" width="${bw * .7}" height="${h}" rx="4" fill="${col}" data-tip="<b>${esc(labels[i])}</b><br>${fmt(v)}"/>
            <text x="${x + bw * .35}" y="${H - 10}" text-anchor="middle">${esc(labels[i])}</text>`;
    });
    el.innerHTML = s + '</svg>';
  }

  /* line / area chart, several series */
  function line(el, labels, series, o = {}) {
    if (!labels.length) return empty(el);
    const W = 760, H = 270, m = {l: 48, r: 14, t: 10, b: 30};
    const max = niceMax(Math.max(...series.flatMap(s => s.values))), iw = W - m.l - m.r, ih = H - m.t - m.b;
    const X = i => m.l + (labels.length === 1 ? iw / 2 : iw * i / (labels.length - 1));
    const Y = v => m.t + ih - ih * v / max;
    let s = `<svg viewBox="0 0 ${W} ${H}">`;
    for (let i = 0; i <= 4; i++) {
      const y = m.t + ih - ih * i / 4;
      s += `<line class="grid-line" x1="${m.l}" x2="${W - m.r}" y1="${y}" y2="${y}"/><text x="${m.l - 6}" y="${y + 4}" text-anchor="end">${nf(max * i / 4)}</text>`;
    }
    const step = Math.max(1, Math.ceil(labels.length / 8));
    labels.forEach((l, i) => { if (i % step === 0) s += `<text x="${X(i)}" y="${H - 10}" text-anchor="middle">${esc(l.slice(5))}</text>`; });
    series.forEach((se, k) => {
      const pts = se.values.map((v, i) => `${X(i)},${Y(v)}`).join(' ');
      if (k === 0) s += `<polygon points="${X(0)},${Y(0)} ${pts} ${X(labels.length - 1)},${Y(0)}" fill="${se.color}" opacity=".10"/>`;
      s += `<polyline points="${pts}" fill="none" stroke="${se.color}" stroke-width="2.2" stroke-linejoin="round"/>`;
    });
    labels.forEach((l, i) => {
      const t = `<b>${esc(l)}</b>` + series.map(se => `<br><span style="color:${se.color}">●</span> ${esc(se.name)}: ${nf(se.values[i])}`).join('');
      s += `<rect x="${X(i) - iw / labels.length / 2}" y="${m.t}" width="${iw / labels.length}" height="${ih}" fill="transparent" data-tip='${t.replace(/'/g, '&#39;')}'/>`;
    });
    el.innerHTML = s + '</svg>' +
      `<div class="legend">${series.map(se => `<span><i style="background:${se.color}"></i>${esc(se.name)}</span>`).join('')}</div>`;
  }

  /* donut with legend */
  function donut(el, labels, values, o = {}) {
    const total = values.reduce((a, b) => a + b, 0);
    if (!total) return empty(el);
    const R = 60, C = 2 * Math.PI * R, colors = o.colors || COLORS;
    let off = 0, s = `<svg viewBox="0 0 160 160"><g transform="rotate(-90 80 80)">`;
    values.forEach((v, i) => {
      const len = C * v / total;
      s += `<circle cx="80" cy="80" r="${R}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="26"
             stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-off}"
             data-tip="<b>${esc(labels[i])}</b><br>${nf(v)} (${(100 * v / total).toFixed(1)}%)"/>`;
      off += len;
    });
    s += `</g><text x="80" y="78" text-anchor="middle" style="font-size:18px;font-weight:700;fill:var(--text)">${nf(total)}</text>
          <text x="80" y="94" text-anchor="middle">total</text></svg>`;
    const lg = labels.map((l, i) => `<span><i style="background:${colors[i % colors.length]}"></i>${esc(l)}<b>${(100 * values[i] / total).toFixed(1)}%</b></span>`).join('');
    el.innerHTML = `<div class="donut-wrap">${s}<div class="legend">${lg}</div></div>`;
  }

  /* horizontal bars (HTML, handles long labels) */
  function hbar(el, labels, values, o = {}) {
    if (!values.length) return empty(el);
    const max = Math.max(...values), col = o.color || COLORS[1];
    el.innerHTML = `<div class="hbars">` + labels.map((l, i) =>
      `<div class="hbar" data-tip="<b>${esc(l)}</b><br>${nf(values[i])}">
        <span class="lab">${esc(l)}</span>
        <span class="track"><span class="fill" style="width:${100 * values[i] / max}%;background:${col}"></span></span>
        <span class="val">${nf(values[i])}</span></div>`).join('') + `</div>`;
  }

  /* weekday x hour heatmap */
  function heatmap(el, cells) {
    if (!cells.length) return empty(el);
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], grid = {};
    let max = 0, min = Infinity;
    cells.forEach(c => { grid[c.dow + '-' + c.hr] = c.n; max = Math.max(max, c.n); min = Math.min(min, c.n); });
    const span = Math.max(max - min, 1);
    let s = `<div class="heat"><span></span>` + [...Array(24).keys()].map(h => `<span class="hd">${h}</span>`).join('');
    for (let d = 0; d < 7; d++) {
      s += `<span class="rl">${days[d]}</span>`;
      for (let h = 0; h < 24; h++) {
        const n = grid[d + '-' + h] || 0;
        s += `<span class="cell" style="opacity:${(0.12 + 0.88 * (n - min) / span).toFixed(2)}" data-tip="<b>${days[d]} ${String(h).padStart(2,'0')}:00</b><br>${nf(n)} bookings"></span>`;
      }
    }
    el.innerHTML = s + `</div><div class="heat-legend">Low <span class="bar"></span> High (range ${nf(min)}–${nf(max)} bookings per cell)</div>`;
  }

  /* generic table */
  function table(el, cols, rows) {
    if (!rows.length) return empty(el);
    const th = cols.map(c => `<th class="${c.num ? 'n' : ''}">${esc(c.label)}</th>`).join('');
    const tr = rows.map(r => '<tr>' + cols.map(c => {
      const raw = typeof c.get === 'function' ? c.get(r) : r[c.key];
      const v = c.html ? c.html(r) : (raw == null ? '<span class="muted">—</span>' : esc(c.fmt ? c.fmt(raw) : raw));
      return `<td class="${c.num ? 'n' : ''}">${v}</td>`;
    }).join('') + '</tr>').join('');
    el.innerHTML = `<div class="tbl-wrap"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
  }

  return {COLORS, nf, esc, bar, line, donut, hbar, heatmap, table};
})();
