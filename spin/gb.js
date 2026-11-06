/* Home Base: small shared helpers for app pages (load after bridge.js).
   GB.hero(el, opts) fills a .gb-hero with the app's header text; it redraws when the dashboard sends a new state. GB.toast(msg, action) shows the shared toast.
   GB.dialog(layer, opts) gives a sheet or dialog the shared keyboard behavior; GB.focusKey()/GB.refocus(k) keep focus
   on the same control across a re-render; GB.taskMoves(o) moves Trello cards to Done with a race-safe Undo;
   GB.status(el, state, text) shows a loading/empty/stale/failed/saving/saved line. */
(function () {
  var SKY = { dawn: ["#9fb4d6", "#f6c9a4"], day: ["#6fa7cf", "#bcdcec"], dusk: ["#4e5d93", "#f2a679"], night: ["#0c1530", "#26375a"] };
  var GROUND = { spring: "#86a35a", summer: "#7f9a5c", fall: "#8e9a55", winter: "#eef3f6" };
  function hourPhase() { var h = new Date().getHours(); return h < 6 || h >= 20 ? "night" : h < 8 ? "dawn" : h >= 18 ? "dusk" : "day"; }
  function seasonNow() { var m = new Date().getMonth(); return m < 2 || m === 11 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "fall"; }
  // a stable way to find "the same" control after a re-render: its id, or its first data-* attribute
  function cssq(v) { return String(v).replace(/["\\]/g, "\\$&"); }
  function keyOf(el) {
    if (!el || el === document.body || el === document.documentElement || !el.getAttribute) return null;
    if (el.id) return { sel: "#" + (window.CSS && CSS.escape ? CSS.escape(el.id) : el.id) };
    for (var i = 0; i < el.attributes.length; i++) { var at = el.attributes[i]; if (/^data-/.test(at.name) && !/^data-gb-/.test(at.name)) return { sel: el.tagName.toLowerCase() + "[" + at.name + '="' + cssq(at.value) + '"]' }; }
    return null;
  }
  function findKey(k) { if (!k) return null; try { return document.querySelector(k.sel); } catch (e) { return null; } }
  var GB = {
    _uid: 0,
    SKY: SKY,
    state: function () { return (window.lake && window.lake.state) || { phase: hourPhase(), season: seasonNow(), snowy: seasonNow() === "winter" }; },
    ctx: function (st) {
      st = st || GB.state();
      var phase = st.phase || hourPhase(), season = st.season || seasonNow();
      return { phase: phase, season: season, dim: phase !== "day", dark: phase === "night", snowy: !!st.snowy, xmas: !!st.xmas, halloween: !!st.halloween, cozy: !!st.cozy, lateNight: !!st.lateNight, st: st };
    },
    /* The app's header: eyebrow, title and a line under it, in the app's own colors (Home Base has no town art).
       opts: { eyebrow, title, sub } or a function (ctx) -> those; it redraws when the dashboard sends a new state.
       An old room's art option is ignored. */
    hero: function (el, opts) {
      if (!el) return;
      opts = opts || {};
      el.classList.add("gb-hero");
      if (!el.querySelector(".gb-txt")) el.innerHTML = '<div class="gb-txt"><p class="gb-eyebrow"></p><h1></h1><p class="gb-sub"></p></div>';
      var draw = function () {
        var c = GB.ctx();
        var o = typeof opts === "function" ? opts(c) : opts;
        el.querySelector(".gb-eyebrow").textContent = o.eyebrow || "";
        el.querySelector("h1").textContent = o.title || "";
        el.querySelector(".gb-sub").textContent = o.sub || "";
      };
      draw();
      if (window.lake && window.lake.on) window.lake.on("state", draw);
      return { redraw: draw };
    },
    /* Moving a Trello card to Done with Undo, safely. One record per card stays until every move has settled: a second
       click while the first move is still in flight records the reversal, and the move back runs as soon as the first one
       lands. Each move's returned card is checked for the list it actually landed in.
       o: { move(v, where) -> Promise<tool result>      where: "done" | "back"
            listFor(v, where) -> the list id it should land in
            render()                                     redraw the rows (use moves.going(id), moves.busy(id))
            done(v)      landed in Done and settled: offer Undo
            back(v)      moved back after having landed in Done
            fail(v, err, where)  a move didn't go through (where says which)
            finish(v)    the Undo window closed with the card in Done
            linger       ms the record stays after landing in Done (default 6000) }
       Returns { toggle(id, make), undo(id), going(id), busy(id), get(id), forEach(fn), size() }. */
    taskMoves: function (o) {
      var ops = new Map(), linger = o.linger || 6000;
      var tail = function (x) { x = String(x || ""); var i = x.lastIndexOf("/"); return i >= 0 ? x.slice(i + 1) : x; };
      function listIn(x, depth) {
        if (!x || depth > 6) return null;
        if (typeof x === "string") { if (depth === 0) { try { return listIn(JSON.parse(x), 1); } catch (e) { return null; } } return null; }
        if (Array.isArray(x)) { for (var i = 0; i < x.length; i++) { var a = listIn(x[i], depth + 1); if (a) return a; } return null; }
        if (typeof x === "object") {
          if (typeof x.idList === "string") return x.idList;
          if (typeof x.listId === "string") return x.listId;
          if (x.list && typeof x.list === "object" && typeof x.list.id === "string") return x.list.id;
          for (var k in x) { if (k === "labels" || k === "members" || k === "board") continue; var b = listIn(x[k], depth + 1); if (b) return b; }
        }
        return null;
      }
      function landed(r) {
        if (!r) return null;
        var got = listIn(r.structuredContent, 1) || listIn(r.payload, 1);
        if (!got && Array.isArray(r.content)) r.content.forEach(function (c) { if (!got && c && c.type === "text") got = listIn(c.text, 0); });
        return got;
      }
      function settle(v) {
        v.busy = false;
        if (v.at === "done") {
          if (v.want !== "done") { run(v); return; }
          o.done && o.done(v);
          clearTimeout(v.timer);
          v.timer = setTimeout(function () { if (ops.get(v.id) === v && !v.busy && v.at === "done" && v.want === "done") { ops.delete(v.id); o.finish && o.finish(v); o.render(); } }, linger);
        } else {
          ops.delete(v.id);
          if (v.wasDone) o.back && o.back(v);
        }
        o.render();
      }
      function run(v) {
        if (v.busy) return;
        if (v.at === v.want) { settle(v); return; }
        v.busy = true; o.render();
        var where = v.want === "done" ? "done" : "back";
        Promise.resolve().then(function () { return o.move(v, where); }).then(function (r) {
          var got = landed(r), want = o.listFor ? o.listFor(v, where) : null;
          if (got && want && tail(got) !== tail(want)) throw Object.assign(new Error("The card is in another list now."), { code: "wrong_list" });
          v.at = where; if (where === "done") v.wasDone = true;
          v.busy = false; run(v);
        }).catch(function (e) {
          v.busy = false;
          if (where === "done") {
            var wanted = v.want === "done";
            v.at = v.want = "back"; ops.delete(v.id); o.render();
            if (wanted) o.fail && o.fail(v, e, where);
          } else {
            v.at = v.want = "done"; o.fail && o.fail(v, e, where); settle(v);
          }
        });
      }
      return {
        toggle: function (id, make) {
          var v = ops.get(id);
          if (v) { clearTimeout(v.timer); v.want = v.want === "done" ? "back" : "done"; o.render(); run(v); return v; }
          v = make ? make() : null; if (!v) return null;
          v.id = id; v.at = "back"; v.want = "done"; v.busy = false; v.wasDone = false; v.timer = null;
          ops.set(id, v); o.render(); run(v); return v;
        },
        undo: function (id) { var v = ops.get(id); if (v && v.want === "done") this.toggle(id); },
        going: function (id) { var v = ops.get(id); return !!v && v.want === "done"; },
        busy: function (id) { var v = ops.get(id); return !!v && v.busy; },
        get: function (id) { return ops.get(id); },
        has: function (id) { return ops.has(id); },
        forEach: function (fn) { ops.forEach(function (v, id) { fn(v, id); }); },
        size: function () { return ops.size; }
      };
    },
    /* One dialog behavior for every room: an accessible name, focus kept inside (Tab and Shift+Tab), the rest of the page
       inert, Escape closes, and focus goes back to whatever opened it (or the control that replaced it after a re-render).
       GB.dialog(layer, opts) -> { el, opener, close(silent) }
         layer: the full-screen layer (.gb-scrim or a room's overlay) holding the [role="dialog"] box; it is un-hidden here
         opts: { label (else the box's first heading names it), initial (selector or list of selectors to focus first),
                 opener (default: the focused element), onClose(silent), escape: false to keep Escape for the page }
       close(true) closes without moving focus (when another dialog replaces this one). */
    dialog: function (layer, opts) {
      opts = opts || {};
      if (layer.__gbd) layer.__gbd.close(true);
      var box = layer.getAttribute("role") === "dialog" ? layer : (layer.querySelector('[role="dialog"]') || layer.firstElementChild || layer);
      var opener = opts.opener || document.activeElement;
      var openerKey = keyOf(opener);
      box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true");
      if (!box.hasAttribute("tabindex")) box.setAttribute("tabindex", "-1");
      var h = box.querySelector("h1,h2,h3,h4");
      if (opts.label) { box.setAttribute("aria-label", opts.label); box.removeAttribute("aria-labelledby"); }
      else if (h) { if (!h.id) h.id = "gbdlg" + (++GB._uid); box.setAttribute("aria-labelledby", h.id); box.removeAttribute("aria-label"); }
      layer.hidden = false;
      // everything else on the page goes inert: each sibling on the way up to <body>
      var made = [];
      for (var n = layer; n && n.parentElement && n !== document.body; n = n.parentElement) {
        Array.prototype.forEach.call(n.parentElement.children, function (sib) {
          if (sib === n || sib.hasAttribute("inert") || /^(SCRIPT|STYLE|LINK)$/.test(sib.tagName) || sib.classList.contains("gb-toast")) return;
          sib.setAttribute("inert", ""); sib.setAttribute("data-gb-inert", ""); made.push(sib);
        });
      }
      document.documentElement.classList.add("gb-modal-open");
      function focusables() {
        return Array.prototype.filter.call(box.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),summary,[tabindex]:not([tabindex="-1"])'), function (x) {
          return !x.closest("[hidden],[inert]") && (typeof x.checkVisibility !== "function" || x.checkVisibility());
        });
      }
      function onKey(e) {
        if (closed || layer.hidden || !layer.isConnected) return;
        if (e.key === "Escape" && opts.escape !== false) { e.preventDefault(); e.stopPropagation(); handle.close(); return; }
        if (e.key !== "Tab") return;
        var items = focusables(), a = document.activeElement;
        if (!items.length) { e.preventDefault(); box.focus(); return; }
        var first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (a === first || a === box || !box.contains(a))) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && (a === last || !box.contains(a))) { e.preventDefault(); first.focus(); }
      }
      function onFocusIn(e) { if (!closed && !layer.hidden && layer.isConnected && !box.contains(e.target) && !(e.target.closest && e.target.closest(".gb-toast"))) { var it = focusables(); (it[0] || box).focus(); } }
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("focusin", onFocusIn, true);
      var closed = false;
      var handle = {
        el: box, opener: opener,
        close: function (silent) {
          if (closed) return; closed = true;
          document.removeEventListener("keydown", onKey, true); document.removeEventListener("focusin", onFocusIn, true);
          made.forEach(function (x) { x.removeAttribute("inert"); x.removeAttribute("data-gb-inert"); });
          if (!document.querySelector("[data-gb-inert]")) document.documentElement.classList.remove("gb-modal-open");
          layer.hidden = true; if (layer.__gbd === handle) layer.__gbd = null;
          if (opts.onClose) { try { opts.onClose(!!silent); } catch (err) {} }
          if (!silent) { var back = opener && opener.isConnected ? opener : findKey(openerKey); if (back && typeof back.focus === "function") { try { back.focus(); } catch (err) {} } }
        }
      };
      layer.__gbd = handle;
      var start = null, sels = opts.initial ? [].concat(opts.initial) : [];
      for (var i = 0; i < sels.length && !start; i++) start = box.querySelector(sels[i]);
      if (!start) { var it = focusables(); start = it.filter(function (x) { return /^(INPUT|SELECT|TEXTAREA)$/.test(x.tagName); })[0] || it[0] || box; }
      try { start.focus(); } catch (err) {}
      return handle;
    },
    /* Keep keyboard focus on "the same control" across a re-render that replaces it: call before, then after.
       var k = GB.focusKey(); render(); GB.refocus(k);  (works for elements with an id or a data-* attribute) */
    focusKey: function (el) { return keyOf(el || document.activeElement); },
    refocus: function (k) {
      if (!k) return; var a = document.activeElement;
      if (a && a !== document.body && a.isConnected && keyOf(a) && keyOf(a).sel === k.sel) return;
      var el = findKey(k); if (el && typeof el.focus === "function") { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
    },
    /* One status line for every room, so loading, empty, stale, failed, saving, saved and queued read differently
       (each has its own mark and wording, not just a color). state "" hides it. action: { label, run } adds a button.
       It only touches the DOM when something changed, so a once-a-minute redraw doesn't re-announce it. */
    status: function (el, state, text, action) {
      if (!el) return;
      el.classList.add("gb-status");
      var sig = (state || "") + "|" + (text || "") + "|" + (action && action.label || "");
      if (el.__gbs === sig) return; el.__gbs = sig;
      if (!state || !text) { el.hidden = true; el.removeAttribute("data-state"); el.textContent = ""; return; }
      el.hidden = false; el.setAttribute("data-state", state); el.setAttribute("role", "status"); el.setAttribute("aria-live", state === "failed" ? "assertive" : "polite");
      el.textContent = "";
      var ic = document.createElement("span"); ic.className = "gb-status-ic"; ic.setAttribute("aria-hidden", "true");
      ic.textContent = { failed: "!", stale: "↻", saved: "✓", queued: "↑" }[state] || "";
      var t = document.createElement("span"); t.className = "gb-status-tx"; t.textContent = text;
      el.appendChild(ic); el.appendChild(t);
      if (action && action.label) { var b = document.createElement("button"); b.type = "button"; b.className = "gb-btn small"; b.textContent = action.label; b.addEventListener("click", action.run); el.appendChild(b); }
    },
    toast: function (msg, actionLabel, onAction, ms) {
      // replaces the last toast made here; a page's own toast element (#toast.gb-toast) is only hidden, never removed,
      // or that page's own toast() would have nothing to write into afterwards
      var old = document.querySelector(".gb-toast[data-gb-made]"); if (old) old.remove();
      Array.prototype.forEach.call(document.querySelectorAll(".gb-toast:not([data-gb-made])"), function (x) { x.hidden = true; });
      var t = document.createElement("div"); t.className = "gb-toast"; t.setAttribute("data-gb-made", ""); t.setAttribute("role", "status");
      var s = document.createElement("span"); s.textContent = msg; t.appendChild(s);
      if (actionLabel) { var b = document.createElement("button"); b.type = "button"; b.textContent = actionLabel; b.onclick = function () { t.remove(); if (onAction) onAction(); }; t.appendChild(b); }
      document.body.appendChild(t);
      setTimeout(function () { t.remove(); }, ms || 5000);
      return t;
    }
  };
  window.GB = GB;

  /* Escape in a room goes back to the map, but only when nothing in the room wants it first: a GB.dialog (it handles
     Escape itself, in the capture phase), a room's own sheet ([aria-modal] or role="dialog" that's showing), a key
     handler that already used it (preventDefault), or a text field that still has something typed in it.
     Registered now, so it runs before the rooms' own later Escape listeners and still sees their sheets as open.
     A room can keep Escape entirely with GB.keepEscape = function () { return true; }. */
  function showing(d) {
    if (d.closest("[hidden],[inert]")) return false;
    if (d.tagName === "DIALOG" && !d.open) return false;
    return typeof d.checkVisibility === "function" ? d.checkVisibility() : true;
  }
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || e.defaultPrevented || e.repeat || e.isComposing) return;
    var lake = window.lake;
    if (!lake || !lake.inWorld) return;
    try { if (typeof GB.keepEscape === "function" && GB.keepEscape(e)) return; } catch (err) {}
    if (document.documentElement.classList.contains("gb-modal-open")) return;
    if (Array.prototype.some.call(document.querySelectorAll('[aria-modal="true"],[role="dialog"],[role="alertdialog"],dialog'), showing)) return;
    var t = e.target;
    if (t && t.matches && t.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]),textarea,select,[contenteditable="true"]') && (t.value || t.textContent && t.isContentEditable)) return;
    lake.emit("leave-room", {});
  });
})();
