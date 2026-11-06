/* The How it works page: the settings and the records, read from the same file as the dashboard. */
(function () {
  "use strict";
  var el = WPA.el, num = WPA.num;

  var REPORT = "Original project report";
  var ASSUMED = "Assumption";
  function rows(s) {
    return [
      ["Levels pickers reach from the floor", s.pick_levels.join(" and "), REPORT],
      ["Levels that hold reserve stock", s.reserve_levels.join(" and "), REPORT],
      ["Working days levels 1-2 should cover", s.cover_days, REPORT],
      ["Time at each stop", s.seconds_per_stop + " s", REPORT],
      ["Time for each pair", s.seconds_per_pair + " s", REPORT],
      ["Setup for each trolley run", s.seconds_per_run_setup + " s", REPORT],
      ["Walk for each trolley run, at 1 m/s", s.metres_per_run + " m", "Route simulation of the recorded routes"],
      ["Time to bring one box down", s.seconds_per_box_moved + " s", ASSUMED],
      ["Shift", s.shift_hours + " h", ASSUMED],
      ["Allowance for breaks, fatigue and delay", s.allowance_pct + "%", ASSUMED],
      ["Productive hours a worker gives", s.productive_hours + " h", "Shift less allowance"],
      ["Workers on the roster", s.crew_on_roster, ASSUMED],
      ["Working days of orders before a first plan", s.min_history_days, "Chosen"],
      ["Recent days used to choose the forecast method", s.backtest_days, "Chosen"],
      ["Working days forecast ahead", s.horizon_days, "Chosen"]
    ];
  }

  function render(index) {
    var s = index.settings, r = index.records;
    document.querySelectorAll("[data-setting]").forEach(function (node) {
      node.textContent = String(s[node.getAttribute("data-setting")]);
    });
    var body = WPA.clear(document.getElementById("settings"));
    rows(s).forEach(function (row) {
      body.appendChild(el("tr", null, [
        el("td", { text: row[0] }),
        el("td", { cls: "num", text: String(row[1]) }),
        el("td", { text: row[2] })
      ]));
    });
    var facts = WPA.clear(document.getElementById("records"));
    [
      ["Warehouse", "A footwear manufacturer's warehouse in Sherbrooke, Canada"],
      ["Days", num(r.working_days) + " working days, " + WPA.longDate(r.first_day) + " to " + WPA.longDate(r.last_day)],
      ["Orders", num(r.order_lines) + " order lines, " + num(r.pairs) + " pairs"],
      ["SKUs", num(r.skus) + " references, each in several sizes"],
      ["Racks", num(r.locations) + " locations holding " + num(r.boxes) + " boxes"],
      ["Levels 1-2", num(r.boxes_l1_l2) + " boxes"],
      ["Levels 3-4", num(r.boxes_l3_l4) + " boxes"]
    ].forEach(function (f) {
      facts.appendChild(el("dt", { text: f[0] }));
      facts.appendChild(el("dd", { text: f[1] }));
    });
  }

  WPA.getJSON("data/index.json").then(render).catch(function (err) {
    if (window.console) console.error(err);
  });
})();
