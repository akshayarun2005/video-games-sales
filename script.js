(function () {
  'use strict';
  var root = document.documentElement;
  root.classList.add('js');

  var SETS = window.VG;
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Categorical colours for the four regions (validated for colour-blind separation on the dark surface)
  var COLOR = { na: '#3987e5', eu: '#d95926', jp: '#199e70', ot: '#9085e9' };
  var NINTENDO = ['Wii', 'DS', 'GB', 'NES', '3DS', 'SNES', 'GBA', 'N64', 'GC', 'WiiU', 'GBC', '3DS'];
  var SHORT = {
    'Sony Computer Entertainment': 'Sony Comp. Ent.', 'Take-Two Interactive': 'Take-Two',
    'Microsoft Game Studios': 'Microsoft Studios', 'Konami Digital Entertainment': 'Konami',
    'Namco Bandai Games': 'Namco Bandai', 'Electronic Arts': 'Electronic Arts'
  };

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function svg(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function h(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function f1(n) { return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function f0(n) { return Math.round(n).toLocaleString('en-US'); }
  function sum(rows) { return rows.reduce(function (s, r) { return s + r[1]; }, 0); }
  function desc(a, b) { return b[1] - a[1]; }
  function niceStep(max) {
    var steps = [1, 2, 5, 10, 20, 25, 40, 50, 100, 200, 250, 500, 1000];
    for (var i = 0; i < steps.length; i++) if (max / steps[i] <= 6) return steps[i];
    return 1000;
  }
  function short(name) { return SHORT[name] || name; }

  /* ---------- derived numbers (pure, per dataset) ---------- */
  function calc(set) {
    var S = { set: set, tot: set.total, n: set.n };
    S.g = set.genre.slice().sort(desc);
    S.p = set.platform.slice().sort(desc);
    S.pb = set.publisher.slice().sort(desc);
    var pc = function (v) { return v / S.tot * 100; };
    S.pct = pc;
    S.top2 = pc(sum(S.g.slice(0, 2)));
    S.top3 = pc(sum(S.g.slice(0, 3)));
    S.small4 = S.g.slice(-4);
    S.small4pct = pc(sum(S.small4));
    S.mid = S.g.slice(2, 7);
    S.nin = S.p.filter(function (r) { return NINTENDO.indexOf(r[0]) > -1; });
    S.ninPct = pc(sum(S.nin));
    S.top10pct = pc(sum(S.p));
    S.pbTop3pct = pc(sum(S.pb.slice(0, 3)));
    S.reg = {};
    set.region.forEach(function (r) { S.reg[r.k] = r; });
    S.naeu = S.reg.na.pct + S.reg.eu.pct;
    S.yt = sum(set.year);
    S.peak = set.year.slice().sort(desc)[0];
    var yshare = function (a, b) { return sum(set.year.filter(function (r) { return r[0] >= a && r[0] <= b; })) / S.yt * 100; };
    S.boom = yshare(2004, 2009);
    S.early = yshare(0, 1999);
    S.pubShare = function (name) { var r = S.pb.filter(function (x) { return x[0] === name; })[0]; return r ? pc(r[1]) : null; };
    return S;
  }

  var ST = calc(SETS.top), SF = calc(SETS.full);
  var cur = 'top', D = SETS.top, S = ST;

  /* ---------- tooltip ---------- */
  var tip = $('tip'), tipTimer;
  function showTip(html, x, y, auto) {
    tip.innerHTML = html;
    tip.hidden = false;
    var r = tip.getBoundingClientRect();
    var tx = Math.min(window.innerWidth - r.width - 8, Math.max(8, x + 14));
    var ty = y - r.height - 14;
    if (ty < 8) ty = y + 18;
    tip.style.left = tx + 'px';
    tip.style.top = ty + 'px';
    clearTimeout(tipTimer);
    if (auto) tipTimer = setTimeout(hideTip, 2200);
  }
  function hideTip() { tip.hidden = true; }

  /* ---------- state ---------- */
  var st = { key: 'genre', sort: 'value', metric: 'units', hmetric: 'sales', from: 0, to: 0, orig: false };
  var pinned = {};
  var host = $('host'), controls = $('controls'), detail = $('detail'), facts = $('facts');

  var META = {
    genre: { title: 'Global sales by genre', sub: 'Combined sales by genre. Click a bar to pin it.', img: 'assets/genre.webp', alt: 'Original Matplotlib bar chart of global sales by genre', noun: 'Genre' },
    platform: { title: 'Top platforms by combined global sales', sub: 'The ten platforms with the highest combined sales.', img: 'assets/platform.webp', alt: 'Original Matplotlib bar chart of the top platforms by combined global sales', noun: 'Platform' },
    publisher: { title: 'Top publishers by combined global sales', sub: 'The ten publishers with the highest combined sales.', noun: 'Publisher' },
    region: { title: 'Regional sales contribution', sub: 'Share of total sales by region. Hover or tap a slice.', img: 'assets/region.webp', alt: 'Original Matplotlib pie chart of regional sales contribution' },
    year: { title: 'Global sales by release year', sub: 'Combined sales by release year. Years with no titles are skipped.', img: 'assets/year.webp', alt: 'Original Matplotlib line chart of global sales by release year' },
    heat: { title: 'Genre × platform heatmap', sub: 'Combined sales for each genre on the ten top platforms. Hover, tap or use the arrow keys.' }
  };

  function resetForSet() {
    D = SETS[cur]; S = cur === 'top' ? ST : SF;
    var yrs = D.year;
    st.from = yrs[0][0]; st.to = yrs[yrs.length - 1][0];
    pinned = { genre: S.g[0][0], platform: S.p[0][0], publisher: S.pb[0][0], region: 'na', heat: null };
  }

  /* ---------- small UI builders ---------- */
  function seg(label, options, current, onPick) {
    var wrap = h('div', 'ctl');
    wrap.appendChild(h('span', 'ctl-label', label));
    var g = h('div', 'seg');
    g.setAttribute('role', 'group');
    g.setAttribute('aria-label', label);
    options.forEach(function (o) {
      var b = h('button', null, o[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', o[0] === current ? 'true' : 'false');
      b.addEventListener('click', function () {
        onPick(o[0]);
        Array.prototype.forEach.call(g.children, function (c, i) {
          c.setAttribute('aria-pressed', options[i][0] === o[0] ? 'true' : 'false');
        });
      });
      g.appendChild(b);
    });
    wrap.appendChild(g);
    return wrap;
  }
  function setDetail(html) { detail.innerHTML = html; }
  function dl(items) {
    return '<dl>' + items.map(function (i) { return '<div><dt>' + i[0] + '</dt><dd>' + i[1] + '</dd></div>'; }).join('') + '</dl>';
  }

  /* ---------- BAR CHART (genre / platform / publisher) ---------- */
  function barDetail(name) {
    var sorted = D[st.key].slice().sort(desc);
    var row = sorted.filter(function (r) { return r[0] === name; })[0];
    var rank = sorted.indexOf(row) + 1;
    setDetail(
      '<p class="eyebrow">' + META[st.key].noun + '</p>' +
      '<div class="d-name">' + esc(name) + '</div>' +
      '<div class="d-val">' + f1(row[1]) + '<small>million units</small></div>' +
      dl([['Share of ' + (cur === 'top' ? 'sample' : 'all sales'), f1(S.pct(row[1])) + '%'], ['Games', f0(row[2])], ['Rank', '#' + rank + ' of ' + sorted.length], ['Compared with leader', rank === 1 ? 'Leader' : f1(row[1] / sorted[0][1] * 100) + '%']])
    );
  }

  function barChart() {
    var rows = D[st.key].slice();
    if (st.sort === 'alpha') rows.sort(function (a, b) { return a[0].localeCompare(b[0]); });
    else rows.sort(desc);

    var asPct = st.metric === 'pct';
    var val = function (r) { return asPct ? S.pct(r[1]) : r[1]; };
    var w = Math.max(280, host.clientWidth);
    var small = w < 480;
    var maxLen = Math.max.apply(null, rows.map(function (r) { return short(r[0]).length; }));
    var labelW = Math.min(w * 0.45, Math.max(small ? 84 : 100, maxLen * 6.9 + 18));
    var padR = small ? 56 : 66, rowH = small ? 32 : 36, bh = small ? 18 : 22, padT = 6, padB = 30;
    var maxV = Math.max.apply(null, rows.map(val));
    var step = niceStep(maxV);
    var nice = Math.ceil(maxV / step) * step;
    var H = padT + rows.length * rowH + padB;
    var x = function (v) { return labelW + v / nice * (w - labelW - padR); };
    var fmtTick = function (t) { return asPct ? t + '%' : t.toLocaleString('en-US'); };

    var s = svg('svg', { viewBox: '0 0 ' + w + ' ' + H, width: w, height: H, role: 'group', 'aria-label': META[st.key].title });
    for (var t = 0; t <= nice; t += step) {
      svg('line', { x1: x(t), x2: x(t), y1: padT, y2: H - padB, class: t === 0 ? 'axis' : 'grid' }, s);
      var tx = svg('text', { x: x(t), y: H - 10, 'text-anchor': 'middle', class: 'tick' }, s);
      tx.textContent = fmtTick(t);
    }

    var groups = [];
    rows.forEach(function (r, i) {
      var top = padT + i * rowH, y0 = top + (rowH - bh) / 2, v = val(r);
      var g = svg('g', { class: 'row', tabindex: 0, role: 'img', 'data-name': r[0],
        'aria-label': r[0] + ': ' + f1(r[1]) + ' million units, ' + f1(S.pct(r[1])) + ' percent of sales' }, s);
      svg('rect', { x: 0, y: top, width: w, height: rowH, fill: 'transparent' }, g);
      var nm = svg('text', { x: labelW - 10, y: y0 + bh / 2 + 4.5, 'text-anchor': 'end', class: 'lbl' }, g);
      nm.textContent = short(r[0]);
      var bw = Math.max(6, x(v) - labelW);
      svg('path', { class: 'bar', style: 'animation-delay:' + (reduce ? 0 : i * 35) + 'ms',
        d: 'M' + labelW + ' ' + y0 + 'h' + (bw - 4) + 'a4 4 0 0 1 4 4v' + (bh - 8) + 'a4 4 0 0 1 -4 4h-' + (bw - 4) + 'z' }, g);
      var vt = svg('text', { x: labelW + bw + 8, y: y0 + bh / 2 + 4.5, class: 'val' }, g);
      vt.textContent = asPct ? f1(v) + '%' : (r[1] >= 1000 ? f0(r[1]) : f1(r[1]));
      groups.push(g);

      var tipHtml = '<strong>' + esc(r[0]) + '</strong><br>' + f1(r[1]) + 'M units · ' + f1(S.pct(r[1])) + '% of sales';
      g.addEventListener('pointerenter', function () { activate(r[0]); });
      g.addEventListener('pointermove', function (e) { showTip(tipHtml, e.clientX, e.clientY, e.pointerType !== 'mouse'); });
      g.addEventListener('pointerleave', function () { hideTip(); activate(pinned[st.key]); });
      g.addEventListener('focus', function () { activate(r[0]); });
      g.addEventListener('blur', function () { activate(pinned[st.key]); });
      g.addEventListener('click', function () { pinned[st.key] = r[0]; activate(r[0]); });
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pinned[st.key] = r[0]; activate(r[0]); }
      });
    });

    function activate(name) {
      groups.forEach(function (g) {
        var on = g.getAttribute('data-name') === name;
        g.classList.toggle('on', on);
        g.classList.toggle('dim', !on);
      });
      barDetail(name);
    }
    host.innerHTML = '';
    host.appendChild(s);
    activate(pinned[st.key]);
  }

  /* ---------- DONUT (region) ---------- */
  function donutChart() {
    var w = host.clientWidth;
    var size = w < 560 ? Math.min(300, Math.max(220, w - 8)) : 300;
    var cx = size / 2, cy = size / 2, r = size * 0.36, sw = size * 0.15, C = 2 * Math.PI * r, gap = 3;

    var wrap = h('div', 'donut-wrap');
    var s = svg('svg', { viewBox: '0 0 ' + size + ' ' + size, width: size, height: size, role: 'group', 'aria-label': 'Donut chart of regional sales share' }, wrap);
    var big = svg('text', { x: cx, y: cy + 6, 'text-anchor': 'middle', class: 'c-big' }, s);
    var small = svg('text', { x: cx, y: cy + 28, 'text-anchor': 'middle', class: 'c-small' }, s);
    var legend = h('ul', 'legend');
    var segs = {}, items = {};
    var start = 0;

    D.region.forEach(function (reg) {
      var len = reg.pct / 100 * C;
      var c = svg('circle', { class: 'seg', cx: cx, cy: cy, r: r, fill: 'none', stroke: COLOR[reg.k], 'stroke-width': sw,
        'stroke-dasharray': (len - gap) + ' ' + (C - len + gap), 'stroke-dashoffset': -(start + gap / 2),
        transform: 'rotate(-90 ' + cx + ' ' + cy + ')', tabindex: 0, role: 'img', 'data-k': reg.k,
        'aria-label': reg.name + ': ' + f1(reg.pct) + ' percent of sales' }, s);
      start += len;
      segs[reg.k] = c;

      var li = h('li');
      var b = h('button', 'lg', '<i style="background:' + COLOR[reg.k] + '"></i><span>' + reg.name + '</span><b>' + f1(reg.pct) + '%</b>');
      b.type = 'button';
      li.appendChild(b);
      legend.appendChild(li);
      items[reg.k] = b;

      var tipHtml = '<strong>' + reg.name + '</strong><br>' + f1(reg.pct) + '% · ' + f0(reg.units) + 'M units';
      [c, b].forEach(function (el) {
        el.addEventListener('pointerenter', function () { activate(reg.k); });
        el.addEventListener('focus', function () { activate(reg.k); });
        el.addEventListener('blur', function () { activate(pinned.region); });
        el.addEventListener('click', function () { pinned.region = reg.k; activate(reg.k); });
        el.addEventListener('pointerleave', function () { hideTip(); activate(pinned.region); });
      });
      c.addEventListener('pointermove', function (e) { showTip(tipHtml, e.clientX, e.clientY, e.pointerType !== 'mouse'); });
    });

    function activate(k) {
      var reg = S.reg[k];
      D.region.forEach(function (r) {
        var on = r.k === k;
        segs[r.k].classList.toggle('on', on);
        segs[r.k].classList.toggle('dim', !on);
        items[r.k].classList.toggle('on', on);
      });
      big.textContent = f1(reg.pct) + '%';
      small.textContent = reg.name;
      var rank = D.region.slice().sort(function (a, b) { return b.pct - a.pct; }).map(function (r) { return r.k; }).indexOf(k) + 1;
      setDetail(
        '<p class="eyebrow">Region</p><div class="d-name">' + reg.name + '</div>' +
        '<div class="d-val">' + f1(reg.pct) + '%<small>of sales</small></div>' +
        dl([['Units', f0(reg.units) + 'M'], ['Rank', '#' + rank + ' of 4'], ['Compared with Japan', k === 'jp' ? 'Baseline' : f1(reg.pct / S.reg.jp.pct) + '×']])
      );
    }

    host.innerHTML = '';
    wrap.appendChild(legend);
    host.appendChild(wrap);
    activate(pinned.region);
  }

  /* ---------- LINE CHART (release year) ---------- */
  function inRange(r) { return r[0] >= st.from && r[0] <= st.to; }

  function yearSummary() {
    var pts = D.year.filter(inRange);
    if (!pts.length) {
      setDetail('<p class="eyebrow">Selected range</p><div class="d-name">' + st.from + '–' + st.to + '</div><p class="d-empty">No titles were released in this range.</p>');
      return;
    }
    var pk = pts.slice().sort(desc)[0], tot = sum(pts);
    setDetail(
      '<p class="eyebrow">Selected range</p><div class="d-name">' + st.from + '–' + st.to + '</div>' +
      '<div class="d-val">' + f1(tot) + '<small>million units</small></div>' +
      dl([['Share of dated sales', f1(tot / S.yt * 100) + '%'], ['Games', f0(pts.reduce(function (a, r) { return a + r[2]; }, 0))], ['Peak year', pk[0] + ' (' + f1(pk[1]) + 'M)']])
    );
  }
  function yearDetail(r) {
    var rank = D.year.slice().sort(desc).map(function (p) { return p[0]; }).indexOf(r[0]) + 1;
    setDetail(
      '<p class="eyebrow">Release year</p><div class="d-name">' + r[0] + '</div>' +
      '<div class="d-val">' + f1(r[1]) + '<small>million units</small></div>' +
      dl([['Share of dated sales', f1(r[1] / S.yt * 100) + '%'], ['Games', f0(r[2])], ['Rank among years', '#' + rank + ' of ' + D.year.length], ['Compared with peak', r === S.peak ? 'Peak year' : f1(r[1] / S.peak[1] * 100) + '%']])
    );
  }

  function lineChart() {
    var w = Math.max(280, host.clientWidth), small = w < 480;
    var H = small ? 280 : 340, pad = { l: small ? 42 : 50, r: 16, t: 26, b: 32 };
    var all = D.year;
    var x0 = all[0][0], x1 = all[all.length - 1][0];
    var maxV = S.peak[1], step = niceStep(maxV), yMax = Math.max(Math.ceil(maxV / step) * step, maxV * 1.12);
    var x = function (yr) { return pad.l + (yr - x0) / (x1 - x0) * (w - pad.l - pad.r); };
    var y = function (v) { return H - pad.b - v / yMax * (H - pad.t - pad.b); };

    var s = svg('svg', { viewBox: '0 0 ' + w + ' ' + H, width: w, height: H, tabindex: 0, role: 'img',
      'aria-label': 'Line chart of global sales by release year. Use the left and right arrow keys to step through years.' });
    for (var v = 0; v <= yMax; v += step) {
      svg('line', { x1: pad.l, x2: w - pad.r, y1: y(v), y2: y(v), class: v === 0 ? 'axis' : 'grid' }, s);
      var t = svg('text', { x: pad.l - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'tick' }, s);
      t.textContent = v.toLocaleString('en-US');
    }
    for (var yr = Math.ceil(x0 / 5) * 5; yr <= x1; yr += 5) {
      var tt = svg('text', { x: x(yr), y: H - 10, 'text-anchor': 'middle', class: 'tick' }, s);
      tt.textContent = yr;
    }

    var pts = all.filter(inRange);
    svg('path', { class: 'line-faint', d: all.map(function (r, i) { return (i ? 'L' : 'M') + x(r[0]) + ' ' + y(r[1]); }).join('') }, s);
    if (pts.length > 1) {
      svg('path', { class: 'line', d: pts.map(function (r, i) { return (i ? 'L' : 'M') + x(r[0]) + ' ' + y(r[1]); }).join('') }, s);
    }
    var dotR = all.length > 34 ? 3.4 : 4.5;
    all.forEach(function (r) {
      svg('circle', { class: inRange(r) ? 'pt' : 'pt out', cx: x(r[0]), cy: y(r[1]), r: inRange(r) ? dotR : 2.6 }, s);
    });

    if (pts.length) {
      var pk = pts.slice().sort(desc)[0];
      var anchor = x(pk[0]) > w - 90 ? 'end' : (x(pk[0]) < pad.l + 70 ? 'start' : 'middle');
      var pl = svg('text', { x: x(pk[0]), y: y(pk[1]) - 12, 'text-anchor': anchor, class: 'peak' }, s);
      pl.textContent = 'Peak ' + pk[0] + ': ' + f0(pk[1]) + 'M';
    }

    var cross = svg('line', { class: 'cross', y1: pad.t, y2: H - pad.b, x1: 0, x2: 0, visibility: 'hidden' }, s);
    var ring = svg('circle', { class: 'ring', r: 7, cx: 0, cy: 0, visibility: 'hidden' }, s);
    var curI = -1;

    function focusIdx(i, ev) {
      curI = i;
      var r = all[i];
      cross.setAttribute('x1', x(r[0])); cross.setAttribute('x2', x(r[0])); cross.setAttribute('visibility', 'visible');
      ring.setAttribute('cx', x(r[0])); ring.setAttribute('cy', y(r[1])); ring.setAttribute('visibility', 'visible');
      yearDetail(r);
      var bb = s.getBoundingClientRect();
      var px = ev ? ev.clientX : bb.left + x(r[0]) * (bb.width / w);
      var py = ev ? ev.clientY : bb.top + y(r[1]) * (bb.height / H);
      showTip('<strong>' + r[0] + '</strong><br>' + f1(r[1]) + 'M units · ' + f0(r[2]) + ' games', px, py, ev && ev.pointerType !== 'mouse');
    }
    function clear() {
      curI = -1;
      cross.setAttribute('visibility', 'hidden'); ring.setAttribute('visibility', 'hidden');
      hideTip(); yearSummary();
    }
    function nearest(ev) {
      var bb = s.getBoundingClientRect();
      var px = (ev.clientX - bb.left) * (w / bb.width), best = 0, bd = 1e9;
      all.forEach(function (r, i) { var d = Math.abs(x(r[0]) - px); if (d < bd) { bd = d; best = i; } });
      return best;
    }
    s.addEventListener('pointermove', function (ev) { focusIdx(nearest(ev), ev); });
    s.addEventListener('pointerdown', function (ev) { focusIdx(nearest(ev), ev); });
    s.addEventListener('pointerleave', clear);
    s.addEventListener('blur', clear);
    s.addEventListener('keydown', function (e) {
      var n = curI;
      if (e.key === 'ArrowRight') n = Math.min(all.length - 1, curI + 1);
      else if (e.key === 'ArrowLeft') n = curI < 0 ? 0 : Math.max(0, curI - 1);
      else if (e.key === 'Home') n = 0;
      else if (e.key === 'End') n = all.length - 1;
      else if (e.key === 'Escape') { clear(); return; }
      else return;
      e.preventDefault();
      focusIdx(n);
    });

    host.innerHTML = '';
    host.appendChild(s);
    yearSummary();
  }

  /* ---------- HEATMAP (genre x platform) ---------- */
  function heatChart() {
    var H = D.heat, gens = H.genres, plats = H.platforms;
    var asGames = st.hmetric === 'games';
    var M = asGames ? H.games : H.sales;
    var w = Math.max(520, host.clientWidth);
    var small = w < 600;
    var labelW = 100, top = 34, cell = (w - labelW - 6) / plats.length, ch = small ? 30 : 36, bottom = 44;
    var Ht = top + gens.length * ch + bottom;
    var maxV = 0;
    M.forEach(function (row) { row.forEach(function (v) { if (v > maxV) maxV = v; }); });

    var s = svg('svg', { viewBox: '0 0 ' + w + ' ' + Ht, width: w, height: Ht, tabindex: 0, role: 'img',
      'aria-label': 'Heatmap of ' + (asGames ? 'game counts' : 'sales') + ' by genre and platform. Use the arrow keys to move between cells.' });

    // colour ramp: single hue, dark to light (sqrt scale so mid values stay readable)
    function mix(t) {
      var a = [27, 39, 68], b = [120, 220, 190];
      var c = a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); });
      return 'rgb(' + c.join(',') + ')';
    }
    plats.forEach(function (p, j) {
      var tx = svg('text', { x: labelW + j * cell + cell / 2, y: top - 12, 'text-anchor': 'middle', class: 'lbl' }, s);
      tx.textContent = p;
    });
    gens.forEach(function (g, i) {
      var tx = svg('text', { x: labelW - 10, y: top + i * ch + ch / 2 + 4.5, 'text-anchor': 'end', class: 'lbl' }, s);
      tx.textContent = g;
    });
    var cells = [];
    gens.forEach(function (g, i) {
      cells[i] = [];
      plats.forEach(function (p, j) {
        var v = M[i][j], t = maxV ? Math.sqrt(v / maxV) : 0;
        var rect = svg('rect', { class: 'hcell', x: labelW + j * cell + 1.5, y: top + i * ch + 1.5, width: cell - 3, height: ch - 3, rx: 5,
          fill: v > 0 ? mix(t) : 'rgba(255,255,255,.035)' }, s);
        cells[i][j] = rect;
        if (v > 0 && cell >= 40) {
          var lab = svg('text', { x: labelW + j * cell + cell / 2, y: top + i * ch + ch / 2 + 4, 'text-anchor': 'middle', class: 'hval',
            fill: t > 0.55 ? '#0b1a16' : '#d5deec' }, s);
          lab.textContent = asGames ? v : (v >= 100 ? Math.round(v) : f1(v));
        }
      });
    });
    // legend
    var gid = 'hg' + Math.floor(Math.random() * 1e6);
    var defs = svg('defs', {}, s);
    var lg = svg('linearGradient', { id: gid, x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    for (var k = 0; k <= 10; k++) svg('stop', { offset: (k * 10) + '%', 'stop-color': mix(Math.sqrt(k / 10)) }, lg);
    var ly = Ht - 24;
    svg('rect', { x: labelW, y: ly, width: 160, height: 10, rx: 5, fill: 'url(#' + gid + ')' }, s);
    var l0 = svg('text', { x: labelW, y: ly + 24, class: 'tick' }, s); l0.textContent = '0';
    var l1 = svg('text', { x: labelW + 160, y: ly + 24, class: 'tick', 'text-anchor': 'end' }, s); l1.textContent = (asGames ? f0(maxV) : f0(maxV) + 'M');
    var l2 = svg('text', { x: labelW + 172, y: ly + 9, class: 'tick' }, s); l2.textContent = asGames ? 'games' : 'million units';
    var ring = svg('rect', { class: 'hring', width: cell - 3, height: ch - 3, rx: 5, visibility: 'hidden' }, s);

    // find strongest cell by sales
    var best = [0, 0];
    H.sales.forEach(function (row, i) { row.forEach(function (v, j) { if (v > H.sales[best[0]][best[1]]) best = [i, j]; }); });
    if (!pinned.heat) pinned.heat = best;
    var focusC = null;

    function heatDetail(i, j) {
      var v = H.sales[i][j], n = H.games[i][j];
      var ptot = D.platform.filter(function (r) { return r[0] === plats[j]; })[0][1];
      setDetail(
        '<p class="eyebrow">Genre × platform</p><div class="d-name">' + esc(gens[i]) + ' on ' + esc(plats[j]) + '</div>' +
        '<div class="d-val">' + (n ? f1(v) : '0') + '<small>million units</small></div>' +
        dl([['Games', f0(n)], ['Share of all sales', f1(S.pct(v)) + '%'], ['Share of ' + esc(plats[j]) + ' sales', f1(v / ptot * 100) + '%']])
      );
    }
    function setActive(i, j, ev) {
      focusC = [i, j];
      ring.setAttribute('x', labelW + j * cell + 1.5); ring.setAttribute('y', top + i * ch + 1.5); ring.setAttribute('visibility', 'visible');
      heatDetail(i, j);
      var n = H.games[i][j];
      var tipHtml = '<strong>' + esc(gens[i]) + ' on ' + esc(plats[j]) + '</strong><br>' + (n ? f1(H.sales[i][j]) + 'M units · ' + n + (n === 1 ? ' game' : ' games') : 'No games');
      var bb = s.getBoundingClientRect();
      var px = ev ? ev.clientX : bb.left + (labelW + j * cell + cell / 2) * (bb.width / w);
      var py = ev ? ev.clientY : bb.top + (top + i * ch + ch / 2) * (bb.height / Ht);
      showTip(tipHtml, px, py, ev && ev.pointerType !== 'mouse');
    }
    function pinnedView() {
      hideTip(); focusC = null;
      ring.setAttribute('x', labelW + pinned.heat[1] * cell + 1.5); ring.setAttribute('y', top + pinned.heat[0] * ch + 1.5); ring.setAttribute('visibility', 'visible');
      heatDetail(pinned.heat[0], pinned.heat[1]);
    }
    function cellAt(ev) {
      var bb = s.getBoundingClientRect();
      var px = (ev.clientX - bb.left) * (w / bb.width), py = (ev.clientY - bb.top) * (Ht / bb.height);
      var j = Math.floor((px - labelW) / cell), i = Math.floor((py - top) / ch);
      return (i >= 0 && i < gens.length && j >= 0 && j < plats.length) ? [i, j] : null;
    }
    s.addEventListener('pointermove', function (ev) { var c = cellAt(ev); if (c) setActive(c[0], c[1], ev); else pinnedView(); });
    s.addEventListener('pointerdown', function (ev) { var c = cellAt(ev); if (c) { pinned.heat = c; setActive(c[0], c[1], ev); } });
    s.addEventListener('pointerleave', pinnedView);
    s.addEventListener('focus', function () { if (!focusC) setActive(pinned.heat[0], pinned.heat[1]); });
    s.addEventListener('blur', pinnedView);
    s.addEventListener('keydown', function (e) {
      var c = focusC || pinned.heat, i = c[0], j = c[1];
      if (e.key === 'ArrowRight') j = Math.min(plats.length - 1, j + 1);
      else if (e.key === 'ArrowLeft') j = Math.max(0, j - 1);
      else if (e.key === 'ArrowDown') i = Math.min(gens.length - 1, i + 1);
      else if (e.key === 'ArrowUp') i = Math.max(0, i - 1);
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pinned.heat = [i, j]; return; }
      else if (e.key === 'Escape') { pinnedView(); return; }
      else return;
      e.preventDefault();
      setActive(i, j);
    });

    host.innerHTML = '';
    host.appendChild(s);
    pinnedView();
  }

  /* ---------- controls ---------- */
  function buildControls() {
    controls.innerHTML = '';
    if (st.key === 'genre' || st.key === 'platform' || st.key === 'publisher') {
      controls.appendChild(seg('Sort', [['value', 'Highest first'], ['alpha', 'A–Z']], st.sort, function (v) { st.sort = v; drawChart(); }));
      controls.appendChild(seg('Show', [['units', 'Million units'], ['pct', '% of sales']], st.metric, function (v) { st.metric = v; drawChart(); }));
    } else if (st.key === 'heat') {
      controls.appendChild(seg('Show', [['sales', 'Million units'], ['games', 'Number of games']], st.hmetric, function (v) { st.hmetric = v; drawChart(); }));
    } else if (st.key === 'year') {
      var y0 = D.year[0][0], y1 = D.year[D.year.length - 1][0];
      var presets = [['all', 'All years', y0, y1], ['pre', 'Before 2000', y0, 1999], ['2000s', '2000–2009', 2000, 2009], ['2010', '2010 onward', 2010, y1]];
      var curP = '';
      presets.forEach(function (p) { if (p[2] === st.from && p[3] === st.to) curP = p[0]; });
      var from = h('input'), to = h('input');
      var fo = h('output', null, st.from), too = h('output', null, st.to);
      function unpress() { Array.prototype.forEach.call(segEl.querySelectorAll('button'), function (b2) { b2.setAttribute('aria-pressed', 'false'); }); }
      var segEl = seg('Range', presets.map(function (p) { return [p[0], p[1]]; }), curP, function (k) {
        var p = presets.filter(function (q) { return q[0] === k; })[0];
        st.from = p[2]; st.to = p[3];
        from.value = st.from; to.value = st.to; fo.textContent = st.from; too.textContent = st.to;
        drawChart();
      });
      controls.appendChild(segEl);
      var sl = h('div', 'ctl sliders');
      [[from, fo, 'From', st.from], [to, too, 'To', st.to]].forEach(function (a) {
        var lab = h('label', 'slider');
        lab.appendChild(h('span', null, a[2]));
        a[0].type = 'range'; a[0].min = y0; a[0].max = y1; a[0].step = 1; a[0].value = a[3];
        a[0].setAttribute('aria-label', a[2] + ' year');
        lab.appendChild(a[0]); lab.appendChild(a[1]);
        sl.appendChild(lab);
      });
      from.addEventListener('input', function () {
        var a = +from.value, b = +to.value; if (a > b) b = a;
        st.from = a; st.to = b; to.value = b; fo.textContent = a; too.textContent = b; unpress(); drawChart();
      });
      to.addEventListener('input', function () {
        var b = +to.value, a = +from.value; if (b < a) a = b;
        st.from = a; st.to = b; from.value = a; fo.textContent = a; too.textContent = b; unpress(); drawChart();
      });
      controls.appendChild(sl);
    }
  }

  /* ---------- table + facts + note ---------- */
  function buildTable() {
    var rows, head, k = st.key;
    var base = cur === 'top' ? 'sample' : 'all sales';
    if (k === 'genre' || k === 'platform' || k === 'publisher') {
      head = [META[k].noun, 'Million units', '% of ' + base, 'Games'];
      rows = D[k].slice().sort(desc).map(function (r) { return [esc(r[0]), f1(r[1]), f1(S.pct(r[1])) + '%', f0(r[2])]; });
    } else if (k === 'region') {
      head = ['Region', 'Share of sales', 'Million units'];
      rows = D.region.map(function (r) { return [r.name, f1(r.pct) + '%', f1(r.units)]; });
    } else if (k === 'year') {
      head = ['Release year', 'Million units', '% of dated sales', 'Games'];
      rows = D.year.map(function (r) { return [r[0], f1(r[1]), f1(r[1] / S.yt * 100) + '%', f0(r[2])]; });
    } else {
      head = ['Genre'].concat(D.heat.platforms);
      rows = D.heat.genres.map(function (g, i) { return [esc(g)].concat(D.heat.sales[i].map(function (v) { return v ? f1(v) : '–'; })); });
    }
    var html = '<div class="tbl-scroll"><table><thead><tr>' + head.map(function (x) { return '<th scope="col">' + x + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr>' + r.map(function (c, i) { return '<' + (i ? 'td' : 'th scope="row"') + '>' + c + '</' + (i ? 'td' : 'th') + '>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
    $('tableHost').innerHTML = html;
  }

  function buildFacts() {
    var list = [], k = st.key, scope = cur === 'top' ? 'sample sales' : 'all sales';
    if (k === 'genre') {
      var missing = (cur === 'full') ? [] : SF.g.filter(function (r) { return !D.genre.some(function (x) { return x[0] === r[0]; }); });
      list = [
        S.g[0][0] + ' and ' + S.g[1][0] + ' together make up <b>' + f1(S.top2) + '%</b> of ' + scope + '.',
        'The four smallest genres (' + S.small4.map(function (r) { return r[0]; }).reverse().join(', ') + ') add up to <b>' + f1(S.small4pct) + '%</b>.',
        missing.length ? missing.map(function (r) { return r[0]; }).join(' and ') + ' has no title in the top 100, yet makes up <b>' + f1(SF.pct(missing[0][1])) + '%</b> of all sales.' :
          'Ranks 3 to 7 form a middle tier, from <b>' + f0(S.mid[S.mid.length - 1][1]) + 'M to ' + f0(S.mid[0][1]) + 'M</b> units each.'
      ];
    } else if (k === 'platform') {
      list = [
        S.p[0][0] + ' leads with <b>' + f1(S.pct(S.p[0][1])) + '%</b> of ' + scope + ', <b>' + f1(S.p[0][1] / S.p[1][1]) + '×</b> the runner-up (' + S.p[1][0] + ').',
        '<b>' + S.nin.length + ' of the top ' + S.p.length + '</b> are Nintendo systems (' + S.nin.map(function (r) { return r[0]; }).join(', ') + '), together <b>' + f1(S.ninPct) + '%</b> of sales.',
        'These ten platforms cover <b>' + f1(S.top10pct) + '%</b> of ' + (cur === 'top' ? 'the sample' : 'all sales') + '.'
      ];
    } else if (k === 'publisher') {
      list = [
        S.pb[0][0] + ' leads with <b>' + f1(S.pct(S.pb[0][1])) + '%</b> of ' + scope + '.',
        'The top three publishers (' + S.pb.slice(0, 3).map(function (r) { return short(r[0]); }).join(', ') + ') together hold <b>' + f1(S.pbTop3pct) + '%</b>.',
        cur === 'top' ? 'Compare with all games, where ' + SF.pb[0][0] + ' holds only <b>' + f1(SF.pct(SF.pb[0][1])) + '%</b>.' :
          'Publishers with no known name are left out (58 games).'
      ];
    } else if (k === 'region') {
      list = [
        'North America and Europe together account for <b>' + f1(S.naeu) + '%</b> of sales.',
        'North America sells about <b>' + f1(S.reg.na.pct / S.reg.jp.pct) + '×</b> as much as Japan.',
        'Total in this view: <b>' + f0(S.tot) + 'M</b> units across ' + f0(S.n) + ' games.'
      ];
    } else if (k === 'year') {
      list = [
        'Sales peak with <b>' + S.peak[0] + '</b> releases at about <b>' + f0(S.peak[1]) + 'M</b> units.',
        'Titles released 2004–2009 contribute <b>' + f1(S.boom) + '%</b> of dated sales in six release years.',
        'Titles from before 2000 contribute <b>' + f1(S.early) + '%</b>.'
      ];
    } else {
      var Hh = D.heat, flat = [];
      Hh.sales.forEach(function (row, i) { row.forEach(function (v, j) { flat.push([i, j, v]); }); });
      flat.sort(function (a, b) { return b[2] - a[2]; });
      var empty = flat.filter(function (c) { return c[2] === 0; }).length;
      list = [
        'Strongest combination: <b>' + esc(Hh.genres[flat[0][0]]) + ' on ' + esc(Hh.platforms[flat[0][1]]) + '</b> (' + f0(flat[0][2]) + 'M units).',
        'Next: <b>' + esc(Hh.genres[flat[1][0]]) + ' on ' + esc(Hh.platforms[flat[1][1]]) + '</b> (' + f0(flat[1][2]) + 'M) and <b>' + esc(Hh.genres[flat[2][0]]) + ' on ' + esc(Hh.platforms[flat[2][1]]) + '</b> (' + f0(flat[2][2]) + 'M).',
        empty ? '<b>' + empty + ' of ' + flat.length + '</b> combinations have no title in this sample, so sales cluster around a few genre and platform pairings.' :
          'Every genre has at least one game on each of these platforms.'
      ];
    }
    facts.innerHTML = list.map(function (l) { return '<li>' + l + '</li>'; }).join('');
  }

  function buildNote() {
    var n = $('chartNote'), msg = '';
    if (st.key === 'year' && !st.orig) {
      if (cur === 'full') msg = 'Coverage note: the file has 344 titles for 2016 and only 3 for 2017, so the drop after 2015 mostly reflects incomplete data, not a real fall in sales. ' + f0(D.yearMissing) + ' games without a release year are excluded.';
      else msg = 'Years with no top-100 title are not plotted. Later years may be lower partly because newer titles have had less time to sell.';
    }
    n.hidden = !msg; n.textContent = msg;
  }

  /* ---------- draw ---------- */
  var lastW = 0;
  function hasOrig() { return cur === 'top' && !!META[st.key].img; }
  function drawChart() {
    hideTip();
    if (st.orig && hasOrig()) {
      host.classList.remove('scroll');
      host.innerHTML = '<div class="orig"><img src="' + META[st.key].img + '" alt="' + META[st.key].alt + '" loading="lazy"></div>';
      return;
    }
    lastW = host.clientWidth;
    host.classList.toggle('scroll', st.key === 'heat');
    if (st.key === 'region') donutChart();
    else if (st.key === 'year') lineChart();
    else if (st.key === 'heat') heatChart();
    else barChart();
  }

  function render() {
    if (!hasOrig()) st.orig = false;
    var m = META[st.key];
    $('cTitle').textContent = m.title;
    $('cSub').textContent = m.sub;
    $('badge').textContent = D.label + ' · ' + f0(D.n) + ' games · ' + f0(D.total) + 'M units';
    var ob = $('origBtn');
    ob.hidden = !hasOrig();
    ob.textContent = st.orig ? 'Back to the interactive chart' : 'Compare with the original Matplotlib chart';
    ob.setAttribute('aria-pressed', st.orig ? 'true' : 'false');
    controls.hidden = st.orig;
    buildControls();
    buildTable();
    buildFacts();
    drawChart();
    buildNote();
    if (st.orig) {
      setDetail('<p class="eyebrow">Original chart</p><div class="d-name">As generated in Python</div><p class="d-empty">This is the Matplotlib / Seaborn output from the project notebook. Switch back to hover over values.</p>');
    }
  }

  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs [role="tab"]'));
  function selectTab(key, focus) {
    st.key = key; st.orig = false;
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-key') === key;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on) { $('panel').setAttribute('aria-labelledby', t.id); if (focus) t.focus(); }
    });
    render();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t.getAttribute('data-key')); });
    t.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
      if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
      if (n !== null) { e.preventDefault(); selectTab(tabs[n].getAttribute('data-key'), true); }
    });
  });
  $('origBtn').addEventListener('click', function () { st.orig = !st.orig; render(); });

  function setDataset(name) {
    cur = name;
    resetForSet();
    Array.prototype.forEach.call($('setSeg').children, function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-set') === name ? 'true' : 'false');
    });
    st.orig = false;
    render();
  }
  Array.prototype.forEach.call($('setSeg').children, function (b) {
    b.addEventListener('click', function () { setDataset(b.getAttribute('data-set')); });
  });

  if ('ResizeObserver' in window) {
    var raf;
    new ResizeObserver(function () {
      if (st.orig) return;
      if (Math.abs(host.clientWidth - lastW) < 2) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(drawChart);
    }).observe(host);
  }

  /* ---------- headline tiles + findings (the project's top-100 analysis) ---------- */
  function listJoin(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  $('tiles').innerHTML = [
    ['≈' + Math.round(ST.top3) + '%', 'of sample sales come from three genres: ' + listJoin(ST.g.slice(0, 3).map(function (r) { return r[0]; }))],
    ['≈' + Math.round(ST.pct(ST.p[0][1])) + '%', 'of sales come from ' + ST.p[0][0] + ' games, the top-selling platform'],
    [f1(ST.naeu) + '%', 'of sales come from North America and Europe combined'],
    [String(ST.peak[0]), 'is the peak release year, at roughly ' + f0(ST.peak[1]) + 'M units']
  ].map(function (t) { return '<div class="tile"><b>' + t[0] + '</b><span>' + t[1] + '</span></div>'; }).join('');

  var wiiSports = SETS.top.topTitle;
  var missingG = SF.g.filter(function (r) { return !SETS.top.genre.some(function (x) { return x[0] === r[0]; }); });
  var findings = [
    { key: 'genre', set: 'top', title: 'A few genres dominate',
      text: ST.g[0][0] + ', ' + ST.g[1][0] + ' and ' + ST.g[2][0] + ' account for about ' + f1(ST.top3) + '% of the sample\'s sales. The four smallest genres together reach only ' + f1(ST.small4pct) + '%, so success among the top 100 is concentrated rather than evenly spread.' },
    { key: 'platform', set: 'top', title: 'Nintendo systems carry the sample',
      text: ST.p[0][0] + ' alone represents ' + f1(ST.pct(ST.p[0][1])) + '% of sales, and ' + ST.nin.length + ' Nintendo systems in the top ten make up ' + f1(ST.ninPct) + '%. One title, ' + wiiSports[0] + ' at ' + wiiSports[1] + 'M units, is ' + f1(wiiSports[1] / ST.tot * 100) + '% of the whole sample.' },
    { key: 'region', set: 'top', title: 'Sales are mostly a Western story',
      text: 'North America (' + f1(ST.reg.na.pct) + '%) and Europe (' + f1(ST.reg.eu.pct) + '%) together contribute ' + f1(ST.naeu) + '% of sales. North America sells about ' + f1(ST.reg.na.pct / ST.reg.jp.pct) + '× as much as Japan (' + f1(ST.reg.jp.pct) + '%). The same pattern holds across all games (' + f1(SF.naeu) + '% for North America and Europe).' },
    { key: 'year', set: 'top', title: 'A mid-2000s boom',
      text: 'Titles released between 2004 and 2009 contribute ' + f1(ST.boom) + '% of dated sales in only six release years, peaking at roughly ' + f0(ST.peak[1]) + 'M units for ' + ST.peak[0] + '. Totals fall after 2013, which may partly reflect newer titles having had less time to sell.' },
    { key: 'publisher', set: 'full', wide: true, title: 'The top 100 is not the whole market',
      text: 'Nintendo accounts for ' + f1(ST.pubShare('Nintendo')) + '% of top-100 sales but only ' + f1(SF.pubShare('Nintendo')) + '% across all ' + f0(SF.n) + ' games. ' + ST.g[0][0] + ' leads genres in the sample, while ' + SF.g[0][0] + ' leads overall; ' + SF.p[0][0] + ' (not ' + ST.p[0][0] + ') is the top platform overall; and ' + (missingG.length ? listJoin(missingG.map(function (r) { return r[0]; })) + ' has no title in the top 100 at all. ' : '') + 'Blockbusters shape the sample, which is why the conclusions are limited to it.' }
  ];
  $('findingsList').innerHTML = '';
  findings.forEach(function (f, i) {
    var c = h('article', 'finding reveal' + (f.wide ? ' wide' : ''));
    c.innerHTML = '<span class="num">' + (i + 1) + '</span><h3>' + f.title + '</h3><p>' + f.text + '</p>';
    var b = h('button', 'link', f.set === 'full' ? 'Compare both views in the dashboard →' : 'See it in the dashboard →');
    b.type = 'button';
    b.addEventListener('click', function () {
      if (cur !== f.set) setDataset(f.set);
      selectTab(f.key);
      $('dashboard').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
    c.appendChild(b);
    $('findingsList').appendChild(c);
  });

  /* ---------- DATA EXPLORER (lazy-loaded) ---------- */
  var ex = { data: null, loading: false, q: '', genre: '', plat: '', sort: 'rank', dir: 1, page: 0, list: [], per: 15 };
  var COLS = [['rank', 'Rank'], ['name', 'Title'], ['plat', 'Platform'], ['year', 'Year'], ['genre', 'Genre'], ['pub', 'Publisher'], ['sales', 'Sales (M)']];

  function loadExplorer() {
    if (ex.data || ex.loading) return;
    ex.loading = true;
    var sc = document.createElement('script');
    sc.src = 'assets/games.js';
    sc.charset = 'utf-8';
    sc.onload = function () { ex.data = window.VG_GAMES; ex.loading = false; initExplorer(); };
    sc.onerror = function () { ex.loading = false; $('exCount').textContent = 'The game list could not be loaded. Check your connection and refresh the page.'; };
    document.body.appendChild(sc);
  }

  function initExplorer() {
    var d = ex.data;
    d.genres.forEach(function (g, i) { var o = document.createElement('option'); o.value = i; o.textContent = g; $('exGenre').appendChild(o); });
    d.platforms.forEach(function (p, i) { var o = document.createElement('option'); o.value = i; o.textContent = p; $('exPlat').appendChild(o); });
    var qt;
    $('exQ').addEventListener('input', function () { clearTimeout(qt); qt = setTimeout(function () { ex.q = $('exQ').value.trim().toLowerCase(); ex.page = 0; exUpdate(); }, 160); });
    $('exGenre').addEventListener('change', function () { ex.genre = this.value; ex.page = 0; exUpdate(); });
    $('exPlat').addEventListener('change', function () { ex.plat = this.value; ex.page = 0; exUpdate(); });
    $('exReset').addEventListener('click', function () {
      $('exQ').value = ''; $('exGenre').value = ''; $('exPlat').value = '';
      ex.q = ''; ex.genre = ''; ex.plat = ''; ex.sort = 'rank'; ex.dir = 1; ex.page = 0; exUpdate();
    });
    $('exPrev').addEventListener('click', function () { if (ex.page > 0) { ex.page--; exRender(); } });
    $('exNext').addEventListener('click', function () { if ((ex.page + 1) * ex.per < ex.list.length) { ex.page++; exRender(); } });
    exUpdate();
  }

  function exUpdate() {
    var d = ex.data;
    ex.list = d.rows.filter(function (r) {
      if (ex.genre !== '' && r[4] !== +ex.genre) return false;
      if (ex.plat !== '' && r[2] !== +ex.plat) return false;
      if (ex.q && r[1].toLowerCase().indexOf(ex.q) < 0 && d.publishers[r[5]].toLowerCase().indexOf(ex.q) < 0) return false;
      return true;
    });
    var key = { rank: 0, name: 1, plat: 2, year: 3, genre: 4, pub: 5, sales: 6 }[ex.sort], dir = ex.dir;
    var names = { 2: d.platforms, 4: d.genres, 5: d.publishers };
    ex.list.sort(function (a, b) {
      var x = a[key], y = b[key];
      if (key === 3) { if (!x && !y) return 0; if (!x) return 1; if (!y) return -1; } // unknown years always last
      if (names[key]) { x = names[key][x]; y = names[key][y]; }
      if (typeof x === 'string') return dir * x.localeCompare(y);
      return dir * (x - y);
    });
    exRender();
  }

  function exRender() {
    var d = ex.data, n = ex.list.length, pages = Math.max(1, Math.ceil(n / ex.per));
    var tot = ex.list.reduce(function (s, r) { return s + r[6]; }, 0);
    $('exCount').innerHTML = '<b>' + f0(n) + '</b> game' + (n === 1 ? '' : 's') + ' · ' + f0(tot) + 'M units combined';
    var start = ex.page * ex.per, rows = ex.list.slice(start, start + ex.per);
    var head = COLS.map(function (c) {
      var on = ex.sort === c[0];
      return '<th scope="col" aria-sort="' + (on ? (ex.dir > 0 ? 'ascending' : 'descending') : 'none') + '"><button type="button" class="sortbtn' + (on ? ' on' : '') + '" data-sort="' + c[0] + '">' + c[1] + (on ? (ex.dir > 0 ? ' ↑' : ' ↓') : '') + '</button></th>';
    }).join('');
    var body = rows.map(function (r) {
      return '<tr><td>' + r[0] + '</td><th scope="row">' + esc(r[1]) + '</th><td>' + esc(d.platforms[r[2]]) + '</td><td>' + (r[3] || '–') + '</td><td>' + esc(d.genres[r[4]]) + '</td><td>' + esc(d.publishers[r[5]]) + '</td><td>' + f1(r[6]) + '</td></tr>';
    }).join('');
    $('exTable').innerHTML = '<table class="ex-tbl"><thead><tr>' + head + '</tr></thead><tbody>' + (body || '<tr><td colspan="7" class="empty">No games match these filters.</td></tr>') + '</tbody></table>';
    Array.prototype.forEach.call($('exTable').querySelectorAll('.sortbtn'), function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-sort');
        if (ex.sort === k) ex.dir = -ex.dir; else { ex.sort = k; ex.dir = (k === 'sales') ? -1 : 1; }
        ex.page = 0; exUpdate();
      });
    });
    $('exPage').textContent = 'Page ' + (ex.page + 1) + ' of ' + f0(pages);
    $('exPrev').disabled = ex.page === 0;
    $('exNext').disabled = ex.page >= pages - 1;
  }

  /* ---------- page polish: reveal, counters, nav highlight, progress ---------- */
  function count(el) {
    var end = parseFloat(el.dataset.count), dec = parseInt(el.dataset.dec || '0', 10);
    if (reduce) return;
    var start = performance.now(), dur = 1200;
    (function tick(now) {
      var p = Math.min((now - start) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (end * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        en.target.querySelectorAll('[data-count]').forEach(count);
        io.unobserve(en.target);
      });
    }, { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(function (el) { io.observe(el); });
    var st2 = document.querySelector('.stats');
    var o2 = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { st2.querySelectorAll('[data-count]').forEach(count); o2.disconnect(); }
    }, { threshold: 0.3 });
    o2.observe(st2);

    var links = {};
    document.querySelectorAll('.nav nav a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
    var o3 = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && links[en.target.id]) {
          Object.keys(links).forEach(function (k) { links[k].classList.toggle('active', k === en.target.id); });
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    Object.keys(links).forEach(function (id) { var s = document.getElementById(id); if (s) o3.observe(s); });

    var o4 = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { loadExplorer(); o4.disconnect(); }
    }, { rootMargin: '800px 0px' });
    o4.observe($('explorer'));
  } else {
    document.querySelectorAll('.reveal').forEach(function (el) { el.classList.add('in'); });
    loadExplorer();
  }

  var prog = $('progress');
  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
  }
  window.addEventListener('scroll', function () { onScroll(); hideTip(); }, { passive: true });
  onScroll();

  /* links from the Objectives section: switch dataset and/or chart, then the anchor scrolls to the dashboard */
  Array.prototype.forEach.call(document.querySelectorAll('a[data-go], a[data-set]'), function (a) {
    a.addEventListener('click', function () {
      var ds = a.getAttribute('data-set'), key = a.getAttribute('data-go');
      if (ds) setDataset(ds);
      if (key) selectTab(key);
    });
  });

  resetForSet();
  selectTab('genre');
})();
