/* Shared by every page: the theme switch, number and date formats, and the replay clock. */
(function () {
  "use strict";

  var KEY = "wpa-theme";
  function stored() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function store(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* private window: the choice lasts this visit */ }
  }
  function systemDark() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function current() {
    var set = document.documentElement.getAttribute("data-theme");
    if (set) return set;
    return systemDark() ? "dark" : "light";
  }
  var saved = stored();
  if (saved === "light" || saved === "dark") document.documentElement.setAttribute("data-theme", saved);

  function label(button) {
    button.textContent = current() === "dark" ? "Light" : "Dark";
  }
  document.addEventListener("DOMContentLoaded", function () {
    var button = document.querySelector(".theme");
    if (!button) return;
    label(button);
    button.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      store(next);
      label(button);
      document.dispatchEvent(new CustomEvent("themechange"));
    });
  });

  var DAY = 86400000;
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December"];
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  function parse(iso) {
    var p = iso.split("-");
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
  }

  window.WPA = {
    num: function (n) {
      if (n === null || n === undefined || isNaN(n)) return "n/a";
      return Math.round(n).toLocaleString("en-US");
    },
    plural: function (n, word, many) {
      return WPA.num(n) + " " + (n === 1 ? word : (many || word + "s"));
    },
    longDate: function (iso) {
      var d = parse(iso);
      return WEEKDAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear();
    },
    shortDate: function (iso) {
      var d = parse(iso);
      return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()].slice(0, 3);
    },
    weekday: function (iso) {
      return WEEKDAYS[parse(iso).getUTCDay()].slice(0, 3);
    },
    /* The same sum as replay_index in replay.py: each calendar day moves the replay on one day. */
    replayIndex: function (start, count, now) {
      var t = now || new Date();
      var today = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
      var offset = Math.round((today - parse(start).getTime()) / DAY);
      return ((offset % count) + count) % count;
    },
    getJSON: function (path) {
      return fetch(path, { cache: "no-cache" }).then(function (r) {
        if (!r.ok) throw new Error(path + " " + r.status);
        return r.json();
      });
    },
    el: function (tag, attrs, children) {
      var node = document.createElement(tag);
      if (attrs) {
        Object.keys(attrs).forEach(function (k) {
          if (k === "text") node.textContent = attrs[k];
          else if (k === "cls") node.className = attrs[k];
          else node.setAttribute(k, attrs[k]);
        });
      }
      (children || []).forEach(function (c) {
        if (c === null || c === undefined) return;
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
      return node;
    },
    clear: function (node) {
      while (node.firstChild) node.removeChild(node.firstChild);
      return node;
    }
  };
})();
