/* The Track record page: every plan in the replay, checked against what happened. */
(function () {
  "use strict";
  var el = WPA.el, num = WPA.num, plural = WPA.plural;
  var $ = function (id) { return document.getElementById(id); };

  var CHECKS = {
    crew: "More workers needed than the roster holds",
    short: "Expected demand the racks cannot cover",
    spike: "A SKU selling at 3 times its usual rate",
    missing: "SKU sizes with no box in the racks (weekly)",
    reslot: "Idle boxes on levels 1-2 (weekly)"
  };

  function set(id, text) { $(id).textContent = text; }

  function signed(pct) {
    if (pct === null || pct === undefined) return "n/a";
    return (pct > 0 ? "+" : pct < 0 ? "−" : "") + Math.abs(pct) + "%";
  }

  function render(index) {
    var s = index.scores, f = s.forecast, w = s.workers, r = s.replenishment;
    set("intro", "The agent planned all " + s.days + " working days from " + WPA.longDate(s.first_day) + " to " +
      WPA.longDate(s.last_day) + ", each from the orders before it only, exactly as on the morning itself. Each plan was then checked against what the records show happened.");

    set("s-miss", f.miss_pct + "%");
    set("s-miss-note", "of pairs shipped; the same weekday last week missed by " + f.same_weekday_last_week_miss_pct + "%");
    set("s-range", f.in_range_pct + "%");
    set("s-range-note", "forecasts ran " + (f.bias_pct >= 0 ? f.bias_pct + "% high" : Math.abs(f.bias_pct) + "% low") + " overall");
    set("s-workers", w.covered_pct + "%");
    set("s-workers-note", w.covered_if_high_pct + "% when staffed for a high day; short on " + plural(w.short_days, "day"));
    set("s-boxes", r.useful_pct + "%");
    set("s-boxes-note", num(r.boxes_useful) + " of " + num(r.boxes_moved) + " boxes; " + r.caught_pct + "% of the boxes that had to come down");

    var rows = index.days.filter(function (d) { return d.actual; }).map(function (d) {
      return {
        date: d.date, pairs: d.pairs, low: d.low, high: d.high, shipped: d.actual.pairs,
        planned: d.workers, needed: d.actual.workers_needed, moved: d.boxes, useful: d.actual.boxes_useful
      };
    });
    WPACharts.series($("pairs-chart"), rows, {
      keys: ["shipped", "pairs"], classes: ["past thin", "ahead thin"], band: ["low", "high"], height: 280,
      label: "Pairs forecast and shipped on each of the " + rows.length + " days in the replay",
      tip: function (d) { return WPA.weekday(d.date) + " " + WPA.shortDate(d.date) + " " + d.date.slice(0, 4) + " · forecast " + num(d.pairs) + " (" + num(d.low) + " to " + num(d.high) + ") · shipped " + num(d.shipped); }
    });
    var top = 0;
    rows.forEach(function (d) { top = Math.max(top, d.planned, d.needed); });
    WPACharts.series($("workers-chart"), rows, {
      keys: ["needed", "planned"], classes: ["past thin", "ahead thin"], yMax: top + 1, ticks: top + 1, height: 240,
      format: function (v) { return String(Math.round(v)); },
      label: "Workers planned and needed on each day in the replay",
      tip: function (d) { return WPA.shortDate(d.date) + " " + d.date.slice(0, 4) + " · planned " + d.planned + " · needed " + d.needed; }
    });
    WPACharts.series($("boxes-chart"), rows, {
      keys: ["moved", "useful"], classes: ["past thin", "ahead thin"], height: 240,
      label: "Boxes moved down and boxes that were needed on each day in the replay",
      tip: function (d) { return WPA.shortDate(d.date) + " " + d.date.slice(0, 4) + " · moved " + num(d.moved) + " · needed " + num(d.useful); }
    });

    var weak = $("weak");
    function add(label, text) { weak.appendChild(el("li", null, [el("b", { text: label + " " }), text])); }
    add("Daily demand swings hard.", "The miss is " + f.miss_pct + "% of pairs shipped. That beats the simplest rule (" +
      f.same_weekday_last_week_miss_pct + "%), but one day can ship ten times the next, so the likely range is wide and still holds only " + f.in_range_pct + "% of days.");
    add("Demand for one SKU in one size is lumpy.", "Only " + r.useful_pct + "% of the boxes brought down were needed within the " +
      plural(index.settings.cover_days, "working day") + " they were meant to cover, and they caught " + r.caught_pct +
      "% of the boxes that had to come down. A box is cheap to move, so the agent still brings down what the forecast points to, and says so.");
    add("Workers.", "The plan matched the workers needed exactly on " + w.exact_pct + "% of days, was short on " +
      plural(w.short_days, "day") + " and over on " + plural(w.over_days, "day") + ". Staffing for a high day covers " + w.covered_if_high_pct + "%.");
    add("One storage snapshot.", "The records hold one picture of what sat where, so every morning starts from it. A live warehouse system would feed the real position each day.");

    var methods = WPA.clear($("methods"));
    Object.keys(f.methods_used).sort(function (a, b) { return f.methods_used[b] - f.methods_used[a]; }).forEach(function (name) {
      methods.appendChild(el("tr", null, [el("td", { text: name }), el("td", { cls: "num", text: num(f.methods_used[name]) })]));
    });
    var checks = WPA.clear($("checks"));
    Object.keys(CHECKS).forEach(function (kind) {
      checks.appendChild(el("tr", null, [el("td", { text: CHECKS[kind] }), el("td", { cls: "num", text: num(s.checks[kind] || 0) })]));
    });

    var body = WPA.clear($("days"));
    index.days.forEach(function (d) {
      var a = d.actual;
      var miss = a && d.pairs ? Math.round(100 * (a.pairs - d.pairs) / d.pairs) : null;
      body.appendChild(el("tr", null, [
        el("td", null, [el("a", { href: "./#" + d.date, text: d.weekday + " " + WPA.shortDate(d.date) + " " + d.date.slice(0, 4) })]),
        el("td", { cls: "num", text: num(d.pairs) }),
        el("td", { cls: "num", text: num(d.low) + " to " + num(d.high) }),
        el("td", { cls: "num", text: a ? num(a.pairs) : "not yet" }),
        el("td", { cls: "num", text: a ? signed(miss) : "" }),
        el("td", { cls: "num", text: String(d.workers) }),
        el("td", { cls: "num", text: a ? String(a.workers_needed) : "" }),
        el("td", { cls: "num", text: num(d.boxes) }),
        el("td", { cls: "num", text: a ? num(a.boxes_useful) : "" }),
        el("td", { cls: "num", text: String(d.issues) })
      ]));
    });
  }

  WPA.getJSON("data/index.json").then(function (index) {
    render(index);
    $("loading").classList.add("hidden");
    $("page").classList.remove("hidden");
  }).catch(function (err) {
    if (window.console) console.error(err);
    $("loading").classList.add("hidden");
    $("failed").classList.remove("hidden");
  });
})();
