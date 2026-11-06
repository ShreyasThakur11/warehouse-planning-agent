/* Small SVG charts drawn from data, with a readout on hover or with the arrow keys.
   Every mark takes its colour from a class in site.css, so both themes stay in step. */
(function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";

  function s(tag, attrs, parent) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(node);
    return node;
  }

  function niceMax(v) {
    if (v <= 0) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var steps = [1, 2, 2.5, 5, 10];
    for (var i = 0; i < steps.length; i++) if (steps[i] * p >= v) return steps[i] * p;
    return 10 * p;
  }

  /* How many gridlines make each step a round number: 250 in steps of 50, not 62.5. */
  function niceTicks(yMax) {
    var counts = [5, 4, 2];
    for (var i = 0; i < counts.length; i++) {
      var step = yMax / counts[i];
      var m = step / Math.pow(10, Math.floor(Math.log10(step)));
      if (Number.isInteger(step) && [1, 2, 2.5, 5].some(function (n) { return Math.abs(n - m) < 1e-9; })) return counts[i];
    }
    return 4;
  }

  function frame(host, width, height, pad, yMax, ticks, format) {
    WPA.clear(host);
    var svg = s("svg", { viewBox: "0 0 " + width + " " + height, role: "img" }, host);
    var grid = s("g", { "class": "grid" }, svg);
    for (var i = 0; i <= ticks; i++) {
      var v = (yMax / ticks) * i;
      var y = pad.t + (height - pad.t - pad.b) * (1 - v / yMax);
      s("line", { x1: pad.l, x2: width - pad.r, y1: y, y2: y }, grid);
      var t = s("text", { x: pad.l - 8, y: y + 4, "text-anchor": "end" }, svg);
      t.textContent = format(v);
    }
    var tip = WPA.el("div", { cls: "tip hidden", role: "status" });
    host.appendChild(tip);
    return { svg: svg, tip: tip };
  }

  /* The readout follows the pointer, or the arrow keys once the chart has focus. */
  function readout(host, svg, tip, width, xs, lines) {
    var at = xs.length - 1;
    function place(i) {
      at = i;
      var scale = width / svg.getBoundingClientRect().width;
      tip.textContent = lines(i);
      tip.classList.remove("hidden");
      tip.style.left = (xs[i] / scale) + "px";
      tip.style.top = "18px";
    }
    var hit = s("rect", { x: 0, y: 0, width: width, height: "100%", "class": "hit" }, svg);
    hit.addEventListener("mousemove", function (evt) {
      var box = svg.getBoundingClientRect();
      var x = (evt.clientX - box.left) * (width / box.width);
      var best = 0;
      for (var i = 1; i < xs.length; i++) if (Math.abs(xs[i] - x) < Math.abs(xs[best] - x)) best = i;
      place(best);
    });
    hit.addEventListener("mouseleave", function () { tip.classList.add("hidden"); });
    host.tabIndex = 0;
    host.onfocus = function () { place(at); };
    host.onblur = function () { tip.classList.add("hidden"); };
    host.onkeydown = function (evt) {
      if (evt.key === "ArrowLeft" && at > 0) { place(at - 1); evt.preventDefault(); }
      if (evt.key === "ArrowRight" && at < xs.length - 1) { place(at + 1); evt.preventDefault(); }
    };
  }

  function has(v) { return v !== null && v !== undefined; }

  /* Pairs shipped as a grey line, then the forecast as a blue line inside its likely range. */
  function forecast(host, history, days, shippedToday) {
    var W = 640, H = 270, pad = { t: 16, r: 14, b: 34, l: 52 };
    var points = history.map(function (d) { return { date: d.date, shipped: d.pairs }; });
    days.forEach(function (d, i) {
      points.push({ date: d.date, f: d.pairs, low: d.low, high: d.high, shipped: i === 0 ? shippedToday : null });
    });
    var top = 0;
    points.forEach(function (p) { top = Math.max(top, p.shipped || 0, p.high || 0); });
    var yMax = niceMax(top * 1.05);
    var f = frame(host, W, H, pad, yMax, niceTicks(yMax), WPA.num);
    var n = points.length;
    var x = function (i) { return pad.l + (W - pad.l - pad.r) * (n === 1 ? 0.5 : i / (n - 1)); };
    var y = function (v) { return pad.t + (H - pad.t - pad.b) * (1 - v / yMax); };
    var first = history.length;
    var ahead = points.slice(first);

    var upper = ahead.map(function (p, k) { return x(first + k) + "," + y(p.high); });
    var lower = ahead.map(function (p, k) { return x(first + k) + "," + y(p.low); }).reverse();
    s("polygon", { points: upper.concat(lower).join(" "), "class": "band" }, f.svg);
    if (first > 0) {
      var mid = (x(first - 1) + x(first)) / 2;
      s("line", { x1: mid, x2: mid, y1: pad.t, y2: H - pad.b, "class": "divider" }, f.svg);
      var label = s("text", { x: mid + 4, y: pad.t + 2 }, f.svg);
      label.textContent = "plan day";
    }
    var past = [];
    points.forEach(function (p, i) { if (i < first && has(p.shipped)) past.push(x(i) + "," + y(p.shipped)); });
    s("polyline", { points: past.join(" "), "class": "past" }, f.svg);
    s("polyline", { points: ahead.map(function (p, k) { return x(first + k) + "," + y(p.f); }).join(" "), "class": "ahead" }, f.svg);
    ahead.forEach(function (p, k) { s("circle", { cx: x(first + k), cy: y(p.f), r: 4, "class": "dot" }, f.svg); });
    if (has(shippedToday)) s("circle", { cx: x(first), cy: y(shippedToday), r: 5, "class": "dot shipped" }, f.svg);

    var every = Math.max(1, Math.ceil(n / 7));
    points.forEach(function (p, i) {
      var keep = i === first || (i % every === 0 && Math.abs(i - first) >= Math.ceil(every / 2));
      if (!keep) return;
      var t = s("text", { x: x(i), y: H - pad.b + 18, "text-anchor": "middle" }, f.svg);
      t.textContent = WPA.shortDate(p.date);
    });
    readout(host, f.svg, f.tip, W, points.map(function (_, i) { return x(i); }), function (i) {
      var p = points[i];
      var parts = [WPA.weekday(p.date) + " " + WPA.shortDate(p.date)];
      if (has(p.f)) parts.push("forecast " + WPA.num(p.f) + " (" + WPA.num(p.low) + " to " + WPA.num(p.high) + ")");
      if (has(p.shipped)) parts.push("shipped " + WPA.num(p.shipped));
      return parts.join(" · ");
    });
    f.svg.setAttribute("aria-label", "Pairs shipped on the last " + history.length +
      " working days, and the forecast for the next " + days.length);
  }

  /* One bar per day for the plan, a lighter cap for a day that runs high, and the roster as a dashed line. */
  function workers(host, days, roster) {
    var W = 380, H = 270, pad = { t: 16, r: 10, b: 34, l: 30 };
    var top = roster;
    days.forEach(function (d) { top = Math.max(top, d.workers_if_high, d.workers); });
    var yMax = Math.max(4, top + 1);
    var f = frame(host, W, H, pad, yMax, yMax, function (v) { return String(Math.round(v)); });
    var n = days.length;
    var slot = (W - pad.l - pad.r) / n;
    var bw = Math.min(34, slot * 0.56);
    var y = function (v) { return pad.t + (H - pad.t - pad.b) * (1 - v / yMax); };
    var xs = [];
    days.forEach(function (d, i) {
      var cx = pad.l + slot * (i + 0.5);
      xs.push(cx);
      if (d.workers_if_high > d.workers) {
        s("rect", { x: cx - bw / 2, y: y(d.workers_if_high), width: bw, height: y(d.workers) - y(d.workers_if_high) - 2, rx: 4, "class": "bar-soft" }, f.svg);
      }
      s("rect", { x: cx - bw / 2, y: y(d.workers), width: bw, height: y(0) - y(d.workers), rx: 4, "class": "bar" }, f.svg);
      var t = s("text", { x: cx, y: H - pad.b + 18, "text-anchor": "middle" }, f.svg);
      t.textContent = d.weekday;
    });
    s("line", { x1: pad.l, x2: W - pad.r, y1: y(roster), y2: y(roster), "class": "roster" }, f.svg);
    readout(host, f.svg, f.tip, W, xs, function (i) {
      var d = days[i];
      return d.weekday + " " + WPA.shortDate(d.date) + " · " + WPA.plural(d.workers, "worker") +
        (d.workers_if_high > d.workers ? ", " + d.workers_if_high + " if high" : "") +
        " · " + d.hours + " h of work";
    });
    f.svg.setAttribute("aria-label", "Workers planned for each of the next " + n + " working days");
  }

  /* Up to two lines across the whole replay, with an optional band. */
  function series(host, rows, opts) {
    var W = 1000, H = opts.height || 250, pad = { t: 14, r: 14, b: 34, l: 54 };
    var top = 0;
    rows.forEach(function (r) {
      opts.keys.forEach(function (k) { if (has(r[k])) top = Math.max(top, r[k]); });
      if (opts.band && has(r[opts.band[1]])) top = Math.max(top, r[opts.band[1]]);
    });
    var yMax = opts.yMax || niceMax(top * 1.05);
    var ticks = opts.ticks || niceTicks(yMax);
    var f = frame(host, W, H, pad, yMax, ticks, opts.format || WPA.num);
    var n = rows.length;
    var x = function (i) { return pad.l + (W - pad.l - pad.r) * (i / Math.max(1, n - 1)); };
    var y = function (v) { return pad.t + (H - pad.t - pad.b) * (1 - v / yMax); };
    if (opts.band) {
      var up = [], down = [];
      rows.forEach(function (r, i) { up.push(x(i) + "," + y(r[opts.band[1]])); down.push(x(i) + "," + y(r[opts.band[0]])); });
      s("polygon", { points: up.concat(down.reverse()).join(" "), "class": "band" }, f.svg);
    }
    opts.keys.forEach(function (k, j) {
      var pts = [];
      rows.forEach(function (r, i) { if (has(r[k])) pts.push(x(i) + "," + y(r[k])); });
      s("polyline", { points: pts.join(" "), "class": opts.classes[j] }, f.svg);
    });
    var last = "";
    rows.forEach(function (r, i) {
      var month = r.date.slice(0, 7);
      if (month === last) return;
      last = month;
      var t = s("text", { x: x(i), y: H - pad.b + 18, "text-anchor": "start" }, f.svg);
      t.textContent = WPA.shortDate(r.date).split(" ")[1] + " " + r.date.slice(0, 4);
    });
    readout(host, f.svg, f.tip, W, rows.map(function (_, i) { return x(i); }), function (i) { return opts.tip(rows[i]); });
    f.svg.setAttribute("aria-label", opts.label);
  }

  window.WPACharts = { forecast: forecast, workers: workers, series: series };
})();
