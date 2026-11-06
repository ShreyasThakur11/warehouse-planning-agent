/* The Today page: one day's plan, as the agent made it that morning. */
(function () {
  "use strict";
  var el = WPA.el, num = WPA.num, plural = WPA.plural;
  var $ = function (id) { return document.getElementById(id); };

  var index = null, todayAt = 0, cache = {}, showing = null;

  var CHIP = { observe: "OBSERVE", decide: "DECIDE", act: "TOOL", check: "CHECK", escalate: "ASK", report: "BRIEF" };
  var STAGES = [
    ["Observe", function (s) { return s.kind === "observe" || s.tool === "read_orders" || s.tool === "check_yesterday"; }],
    ["Decide", function (s) { return s.kind === "decide" || s.tool === "compare_forecast_methods"; }],
    ["Act", function (s) { return s.kind === "act" && ["read_orders", "check_yesterday", "compare_forecast_methods", "check_plan"].indexOf(s.tool) < 0; }],
    ["Check", function (s) { return s.kind === "check" || s.tool === "check_plan"; }],
    ["Report", function (s) { return s.kind === "report" || s.kind === "escalate"; }]
  ];

  function at(date) {
    for (var i = 0; i < index.days.length; i++) if (index.days[i].date === date) return i;
    return -1;
  }

  function fromHash() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ""));
    var i = /^\d{4}-\d{2}-\d{2}$/.test(h) ? at(h) : -1;
    return i < 0 ? todayAt : i;
  }

  function load(i) {
    var date = index.days[i].date;
    if (cache[date]) return Promise.resolve(cache[date]);
    return WPA.getJSON("data/days/" + date + ".json").then(function (d) { cache[date] = d; return d; });
  }

  function go(i, push) {
    if (i < 0 || i >= index.days.length) return;
    var date = index.days[i].date;
    if (push) {
      var hash = i === todayAt ? location.pathname + location.search : "#" + date;
      history.pushState(null, "", hash);
    }
    load(i).then(function (plan) {
      showing = i;
      render(plan, i);
      $("loading").classList.add("hidden");
      $("page").classList.remove("hidden");
    }).catch(function (err) {
      if (window.console) console.error(err);
      $("loading").classList.add("hidden");
      $("failed").classList.remove("hidden");
    });
  }

  function setText(id, text) { $(id).textContent = text; }

  function header(plan, i) {
    var n = index.days.length, isToday = i === todayAt;
    setText("replay-line", (isToday ? "Today in the live replay · " : "Replay · ") + "day " + (i + 1) + " of " + n);
    setText("title", "Plan for " + WPA.longDate(plan.day));
    var feed = plan.feed || {};
    var made = "Planned before the day began, from " + plural(feed.history_days || 0, "working day") +
      " of orders, the last on " + WPA.longDate(feed.last_day) + ".";
    if (i === n - 1) made += " This is the first working day after the records end, so there is nothing yet to check it against.";
    else if (isToday) made += " The records end on " + WPA.longDate(index.records.last_day) + ", so the dashboard replays them: each calendar day shows the next working day.";
    setText("made", made);
    $("day").value = plan.day;
    $("prev").disabled = i === 0;
    $("next").disabled = i === n - 1;
    $("today").disabled = isToday;
    setText("brain", plan.brain);
    setText("brief", plan.brief);
    document.title = "Plan for " + WPA.shortDate(plan.day) + " " + plan.day.slice(0, 4) + " · Warehouse Planning Agent";
  }

  function kpis(plan) {
    var r = plan, f = r.forecast.today, w = r.workers.today, rep = r.replenishment;
    setText("k-pairs", num(f.pairs));
    setText("k-pairs-note", "likely " + num(f.low) + " to " + num(f.high));
    setText("k-lines", num(f.lines));
    setText("k-lines-note", "in about " + plural(f.orders, "order"));
    setText("k-workers", num(w.workers));
    setText("k-workers-note", (w.workers_if_high > w.workers ? w.workers_if_high + " if the day runs high · " : "") + w.hours + " h of work");
    setText("k-boxes", num(rep.boxes));
    setText("k-boxes-note", "from levels 3-4 to 1-2, for " + plural(rep.skus, "SKU size"));
  }

  function run(plan) {
    var loop = WPA.clear($("loop"));
    STAGES.forEach(function (stage, k) {
      var count = plan.steps.filter(stage[1]).length;
      loop.appendChild(el("li", null, [(k + 1) + " " + stage[0] + " ", el("b", { text: String(count) })]));
    });
    var list = WPA.clear($("run"));
    plan.steps.forEach(function (step) {
      var text = el("div", null, [
        step.tool ? el("span", { cls: "tool", text: step.tool }) : null,
        el("span", { cls: "text", text: step.text })
      ]);
      list.appendChild(el("li", null, [el("span", { cls: "chip " + step.kind, text: CHIP[step.kind] || step.kind.toUpperCase() }), text]));
    });
  }

  function charts(plan) {
    var r = plan, methods = r.methods.methods || [];
    var best = methods.filter(function (m) { return m.method === r.forecast.method; })[0];
    setText("method", "Method chosen this morning: " + r.forecast.method_name.toLowerCase() +
      (best ? ", which missed by " + best.miss_pct + "% over the last " + r.methods.scored_days + " working days." : "."));
    WPACharts.forecast($("forecast-chart"), plan.recent || [], r.forecast.days, plan.actual ? plan.actual.pairs : null);

    var w = r.workers;
    var why = plan.decisions.staff_to === "high"
      ? "Staffed to the top of the range: " + r.yesterday.days_above_forecast_of_last_5 + " of the last 5 days ran above forecast."
      : "Staffed to the expected volume.";
    setText("workers-note", why + " Each worker gives " + w.productive_hours_per_worker + " productive hours; " + w.crew_on_roster + " are on the roster.");
    WPACharts.workers($("workers-chart"), w.days, w.crew_on_roster);
  }

  function trendTag(s) {
    var change = (s.change_pct > 0 ? "+" : s.change_pct < 0 ? "−" : "") + Math.abs(s.change_pct) + "%";
    if (s.trend === "rising") return el("span", { cls: "tag up", text: "rising " + change });
    if (s.trend === "falling") return el("span", { cls: "tag", text: "falling " + change });
    return el("span", { cls: "tag", text: "steady" });
  }

  function skus(plan) {
    var k = plan.skus;
    setText("skus-note", "The " + k.skus.length + " SKUs expected to sell most over the next " + plural(k.horizon_days, "working day") +
      ". Together they make " + k.top_share_pct + "% of the " + num(k.horizon_pairs) + " pairs expected." +
      " Sales class is measured on the last 40 working days (A: the SKUs behind 80% of pairs); the catalogue's own class is shown where it differs.");
    var body = WPA.clear($("skus"));
    k.skus.forEach(function (s) {
      var cls = s.measured_class + (s.catalogue_class && s.catalogue_class !== s.measured_class ? " (catalogue " + s.catalogue_class + ")" : "");
      body.appendChild(el("tr", null, [
        el("td", null, [el("code", { text: s.sku })]),
        el("td", { cls: "num", text: num(s.expected_pairs) }),
        el("td", { cls: "num", text: s.share_pct + "%" }),
        el("td", null, [trendTag(s)]),
        el("td", { cls: "num", text: num(s.boxes_l1_l2) }),
        el("td", { cls: "num", text: num(s.boxes_l3_l4) }),
        el("td", { cls: "num", text: s.days_on_l1_l2 === null ? "n/a" : String(s.days_on_l1_l2) }),
        el("td", { text: cls })
      ]));
    });
  }

  function moves(plan) {
    var rep = plan.replenishment;
    var note = plural(rep.boxes, "box", "boxes") + " in " + plural(rep.tasks, "move") + " for " + plural(rep.skus, "SKU size") +
      ", enough to cover until " + WPA.longDate(rep.cover_until) + ". The nearest reserve box comes down first.";
    if (rep.new_faces) note += " " + plural(rep.new_faces, "SKU size") + " get a new pick face on levels 1-2.";
    setText("moves-note", note);
    // One row per SKU size and destination, in the agent's order, listing every reserve box it takes.
    var groups = [], byKey = {};
    rep.moves.forEach(function (m) {
      var key = m.sku + "|" + m.size + "|" + m.to;
      if (!byKey[key]) {
        byKey[key] = { sku: m.sku, size: m.size, to: m.to, to_level: m.to_level, boxes: 0, from: [], new_face: m.new_face, on: m.on_l1_l2, needed: m.needed };
        groups.push(byKey[key]);
      }
      byKey[key].boxes += m.boxes;
      byKey[key].from.push(m.from + " L" + m.from_level);
    });
    var body = WPA.clear($("moves")), more = $("more-moves"), shown = 15;
    function draw(limit) {
      WPA.clear(body);
      groups.slice(0, limit).forEach(function (g, i) {
        var why = g.new_face
          ? el("span", { cls: "tag new", text: "new pick face" })
          : document.createTextNode(num(g.on) + " on L1-2, " + num(g.needed) + " needed");
        body.appendChild(el("tr", null, [
          el("td", { cls: "num", text: String(i + 1) }),
          el("td", null, [el("code", { text: g.sku })]),
          el("td", { text: g.size }),
          el("td", { cls: "num", text: String(g.boxes) }),
          el("td", { cls: "from" }, [el("code", { text: g.from.join(", ") })]),
          el("td", null, [el("code", { text: g.to }), " L" + g.to_level]),
          el("td", { cls: "why" }, [why])
        ]));
      });
      if (groups.length > limit) {
        more.textContent = "Show all " + plural(groups.length, "SKU size");
        more.classList.remove("hidden");
      } else {
        more.classList.add("hidden");
      }
    }
    more.onclick = function () { draw(groups.length); };
    draw(shown);
    if (!groups.length) body.appendChild(el("tr", null, [el("td", { colspan: "7", text: "Levels 1-2 already hold enough for the next " + plural(rep.cover_days, "working day") + "." })]));

    var notes = WPA.clear($("rep-notes"));
    function add(label, text) { notes.appendChild(el("li", null, [el("b", { text: label + " " }), text])); }
    function examples(list) {
      return list.slice(0, 3).map(function (e) { return e.sku + " (" + plural(e.pairs, "pair") + ")"; }).join(", ");
    }
    if (rep.swaps && rep.swaps.length) {
      var sw = rep.swaps[0];
      add("Make room first.", plural(rep.swaps.length, "box", "boxes") + " that have not sold in 40 working days move up to levels 3-4 to free slots for the new pick faces, for example " +
        sw.sku_up + " from " + sw.from + " to " + sw.to + ".");
    }
    if (rep.short && rep.short.skus) add("Will run short.", plural(rep.short.skus, "SKU size") + " need about " + plural(rep.short.pairs, "pair") +
      " more than the racks hold at all: " + examples(rep.short.examples) + ".");
    if (rep.not_in_racks && rep.not_in_racks.skus) add("Not in the racks.", plural(rep.not_in_racks.skus, "SKU size") + " expected to sell, about " +
      plural(rep.not_in_racks.pairs, "pair") + ", have no box in the racks: " + examples(rep.not_in_racks.examples) + ".");
    if (rep.unsold_on_l1_l2 && rep.unsold_on_l1_l2.boxes) add("Idle on levels 1-2.", plural(rep.unsold_on_l1_l2.boxes, "box", "boxes") +
      " of " + plural(rep.unsold_on_l1_l2.skus, "SKU size") + " have not sold in " + rep.unsold_on_l1_l2.days + " working days.");
  }

  function checks(plan) {
    var c = plan.checks, list = WPA.clear($("checks"));
    if (!c.issues.length) {
      list.appendChild(el("li", { text: "Nothing needs the supervisor today. The plan is ready." }));
      return;
    }
    c.issues.forEach(function (issue) {
      var urgent = issue.kind === "crew" || issue.kind === "short";
      list.appendChild(el("li", { cls: urgent ? "escalate" : "" }, [
        urgent ? el("b", { text: "Needs a decision. " }) : null,
        issue.text
      ]));
    });
  }

  function result(label, value, note) {
    return el("div", { cls: "result" }, [
      el("div", { cls: "label", text: label }),
      el("div", { cls: "value", text: value }),
      el("div", { cls: "note", text: note })
    ]);
  }

  function results(plan, i) {
    var a = plan.actual, box = WPA.clear($("results")), r = plan;
    if (!a) {
      setText("result-note", "This day comes after the records end, so there is nothing to check the plan against.");
      return;
    }
    function fill() {
      WPA.clear(box);
      var f = r.forecast.today, miss = a.miss_pct;
      var missText = miss === 0 ? "exactly on the forecast" : Math.abs(miss) + "% " + (miss > 0 ? "above" : "below") + " the forecast";
      box.appendChild(result("Pairs shipped", num(a.pairs), missText + (a.in_range ? ", inside the range" : ", outside the range")));
      box.appendChild(result("Order lines", num(a.lines), "forecast " + num(f.lines)));
      box.appendChild(result("Workers the day needed", num(a.workers_needed), "planned " + a.workers_planned +
        (a.workers_if_high > a.workers_planned ? ", " + a.workers_if_high + " if high" : "")));
      box.appendChild(result("Boxes that had to come down", num(a.boxes_needed), "moved " + num(a.boxes_moved) + ", " + num(a.boxes_useful) + " of them needed"));
    }
    setText("result-note", "What the records show for this day. The agent could not see any of it when it planned.");
    if (i === todayAt) {
      var reveal = el("button", { cls: "btn", type: "button", text: "Show how the day went" });
      reveal.onclick = fill;
      box.appendChild(reveal);
    } else {
      fill();
    }
  }

  function render(plan, i) {
    header(plan, i);
    if (!plan.forecast) {
      setText("brief", plan.brief || "There was not enough history to plan this day.");
      return;
    }
    kpis(plan);
    run(plan);
    charts(plan);
    skus(plan);
    moves(plan);
    checks(plan);
    results(plan, i);
  }

  function picker() {
    var select = WPA.clear($("day"));
    index.days.forEach(function (d, i) {
      var label = d.weekday + " " + WPA.shortDate(d.date) + " " + d.date.slice(0, 4) + (i === todayAt ? " (today)" : "");
      select.appendChild(el("option", { value: d.date, text: label }));
    });
    select.addEventListener("change", function () { go(at(select.value), true); });
    $("prev").addEventListener("click", function () { go(showing - 1, true); });
    $("next").addEventListener("click", function () { go(showing + 1, true); });
    $("today").addEventListener("click", function () { go(todayAt, true); });
    window.addEventListener("popstate", function () { go(fromHash(), false); });
    window.addEventListener("hashchange", function () { go(fromHash(), false); });
  }

  WPA.getJSON("data/index.json").then(function (data) {
    index = data;
    todayAt = WPA.replayIndex(index.replay_start, index.days.length);
    picker();
    go(fromHash(), false);
  }).catch(function (err) {
      if (window.console) console.error(err);
    $("loading").classList.add("hidden");
    $("failed").classList.remove("hidden");
  });
})();
