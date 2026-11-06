/* Daily Spin's Trello rewards (Nov 5, moved here from Home Base's dashboard when Daily Spin became its own app).
   A personal card that reaches Done (Personal board → Done, or a Chief of Staff card labeled Personal in Done, or one
   ticked complete and left on Today) pays Easy 1, Medium 3, Hard 6 spins (an unsized card 1, a Hard card done before noon
   doubled), at most 30 card spins a day. Three or more personal cards done in a day pays 10 spins and a wood chest, and
   a week with 5+ personal cards pays a payday chest (silver for 15+). Both pay late if the app wasn't opened that day.
   Work cards never pay. Trello is read through Joey's Worker (named lists only); every award is written in one Firestore
   transaction with the ledger, so a card pays once however many devices see it. The game collects the rewards from
   lake/world/grants exactly as it did from Home Base. */
(function () {
  "use strict";
  const TZ = "America/Chicago";
  const SIZES = ["Hard", "Medium", "Easy"], SPINS = { Easy: 1, Medium: 3, Hard: 6 };
  const CARD_CAP = 30, BUSY_DAY = 3, BUDGET = 10, FLOOR_DAYS = 50, WEEKS_BACK = 4;
  const isDone = (name) => /^(done|complete|completed|finished)$/i.test(String(name || "").trim());
  const shortId = (id) => String(id || "").split("/").pop();
  const labelNames = (c) => (c.labels || []).map((l) => l.name);
  const sizeOf = (c) => { const n = labelNames(c); return SIZES.find((s) => n.includes(s)) || null; };

  // ---- Chicago time
  const fDay = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const fParts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", hourCycle: "h23", weekday: "short" });
  const dayKey = (t) => fDay.format(new Date(t));
  const hourOf = (t) => +fParts.formatToParts(new Date(t)).find((p) => p.type === "hour").value % 24;
  const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dowOf = (t) => DOW[fParts.formatToParts(new Date(t)).find((p) => p.type === "weekday").value];
  const addDays = (key, n) => { const d = new Date(key + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  // midnight in Chicago at the start of a day key, as a timestamp (the offset is read at 06:00 UTC, before a 2 AM change)
  const fOff = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "shortOffset" });
  const offsetMin = (t) => { const z = (fOff.formatToParts(new Date(t)).find((p) => p.type === "timeZoneName") || {}).value || "GMT"; const m = z.match(/GMT([+-])(\d+)(?::(\d+))?/); return m ? (m[1] === "-" ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : 0; };
  const startOf = (key) => { const u = Date.parse(key + "T00:00:00Z"); return u - offsetMin(u + 6 * 3600000) * 60000; };
  const mondayOf = (key) => { const dow = new Date(key + "T12:00:00Z").getUTCDay(); return addDays(key, -((dow + 6) % 7)); };

  let db = null, uid = null, trello = null, timer = null, running = null;
  const state = { lastScan: 0, error: null, paid: 0 };
  const W = window.SpinRewards = {
    state,
    attach(opts) { db = opts.db; uid = opts.uid; if (!timer) timer = setInterval(() => { W.scan().catch(() => {}); }, 10 * 60000); },
    scan() { if (!running) running = scanOnce().finally(() => { running = null; }); return running; },
    _t: { dayKey, hourOf, dowOf, startOf, mondayOf, addDays, completionTime, plan },   // for the tests
  };

  async function getTrello() {
    if (trello) return trello;
    const C = window.__wc; if (!C || typeof C.use !== "function") return null;
    trello = await C.use("trello");
    return trello;
  }
  const path = (doc) => "data/users/" + uid + "/lake/world/" + doc;

  // when a card was completed: its newest move into Done (or tick "complete"); 0 when its history shows it came back out
  // (or nothing datable); null when the history can't be read (the caller falls back to its last activity)
  async function completionTime(t, c) {
    let p;
    try { p = await t.read("activity", { card: shortId(c.id) }); } catch (e) { return null; }
    let at = null;
    for (const a of (p && p.activity) || []) {
      const k = String(a.displayKey || ""), into = !!(a.listAfter && isDone(a.listAfter.name)), out = !!(a.listBefore && isDone(a.listBefore.name) && a.listAfter && !isDone(a.listAfter.name));
      const on = /complete/i.test(k) && !/incomplete/i.test(k), off = /incomplete/i.test(k);
      if (into || on) at = Date.parse(a.date) || at;
      else if (out || off) { if (at != null) break; return 0; }
      else if (at == null && /create_card|copy_card|convert/i.test(k) && isDone(c.list && c.list.name)) at = Date.parse(a.date) || null;
    }
    return at == null ? (p && p.pageInfo && p.pageInfo.hasNextPage ? null : 0) : at;
  }

  // what this scan would pay, given the ledger as it stands (pure: the transaction runs it again on the server's copy)
  function plan(ledger, seen, now) {
    const L = ledger, grants = [], newPaid = {};
    const since = L.since || now, floor = Math.max(since, now - FLOOR_DAYS * 86400000);
    const perDay = {};
    Object.keys(L.paid || {}).forEach((k) => { const p = L.paid[k], d = k.split("@")[1]; if (p && p.p && d) perDay[d] = (perDay[d] || 0) + (p.s || 0); });
    for (const x of seen) {
      const t = x.t;
      if (!t || t < floor) continue;
      const sid = shortId(x.c.id), day = dayKey(t), key = sid + "@" + day;
      if ((L.paid || {})[key] || newPaid[key]) continue;
      const size = sizeOf(x.c);
      let spins = SPINS[size] || 1;
      const frog = size === "Hard" && hourOf(t) < 12;
      if (frog) spins *= 2;
      const room = Math.max(0, CARD_CAP - (perDay[day] || 0)), pay = Math.min(spins, room);
      perDay[day] = (perDay[day] || 0) + pay;
      newPaid[key] = { at: t, s: pay, z: size, p: 1, n: String(x.c.name || "").slice(0, 90), b: x.board };
      if (pay > 0) grants.push({ id: "card:" + sid + ":" + day, kind: "card", spins: pay, title: x.c.name || "A card", size: size || "Unsized", note: (size || "Unsized") + (frog ? ", before noon (doubled)" : "") + (pay < spins ? ", over today's 30-spin card limit" : "") + " · " + x.board, at: t });
    }
    // busy days: 3+ personal cards done (paid late if need be)
    const all = Object.assign({}, L.paid || {}, newPaid), cards = {};
    Object.keys(all).forEach((k) => { const p = all[k], d = k.split("@")[1]; if (p && p.p && d && (p.at || 0) >= since) cards[d] = (cards[d] || 0) + 1; });
    const today = dayKey(now), cleared = {};
    Object.keys(cards).forEach((d) => {
      if (cards[d] >= BUSY_DAY && !(L.cleared || {})[d] && d >= addDays(today, -FLOOR_DAYS)) { cleared[d] = true; grants.push({ id: "home:" + d, kind: "day", spins: 10, chest: "wood", title: "Three personal cards done" + (d === today ? " today" : " on " + d), at: startOf(d) + 12 * 3600000 }); }
    });
    // paydays: every finished week (Monday to Sunday) of the last four that hasn't paid; this week's from Sunday 6 PM
    const paydays = {}, thisMon = mondayOf(today);
    for (let i = 0; i <= WEEKS_BACK; i++) {
      const wk = addDays(thisMon, -7 * i), end = startOf(addDays(wk, 7));
      const due = i > 0 || (dowOf(now) === 0 && hourOf(now) >= 18);
      if (!due || (L.paydays || {})[wk] || since >= end) continue;
      const a = startOf(wk), n = Object.values(all).filter((p) => p && p.p && p.at >= a && p.at < end && p.at >= since).length;
      paydays[wk] = true;
      const chest = n >= 15 ? "silver" : n >= 5 ? "wood" : null;
      if (chest) grants.push({ id: "payday:" + wk, kind: "payday", chest, title: "Payday: " + n + " personal cards the week of " + wk, at: end - 1 });
    }
    return { grants, newPaid, cleared, paydays };
  }

  async function scanOnce() {
    if (!db || !uid) return { skipped: "no_db" };
    if (typeof navigator !== "undefined" && navigator.onLine === false) return { skipped: "offline" };
    const t = await getTrello(); if (!t) return { skipped: "no_trello" };
    const now = Date.now();
    // the ledger as last saved (the transaction re-reads it from the server before writing)
    let ledger;
    try { const s = await db.doc(path("ledger")).get(); ledger = (s && s.exists && s.data()) || {}; } catch (e) { ledger = {}; }
    ledger.paid = ledger.paid || {}; ledger.done = ledger.done || {};
    if (!ledger.since) ledger.since = now;
    const seen = [], doneMap = Object.assign({}, ledger.done), reopen = [];
    let budget = BUDGET;
    const when = async (c) => {
      const sid = shortId(c.id);
      if (doneMap[sid] != null) return doneMap[sid];
      const la = Date.parse(c.lastActivityAt) || 0;
      let at;
      if (la && la > now - 36 * 3600000) { if (budget <= 0) return undefined; budget--; const v = await completionTime(t, c); at = v == null ? la : v; }
      else at = la;
      doneMap[sid] = at;
      return at;
    };
    try {
      const lists = [["personalDone", "Personal", false], ["cosDone", "Chief of Staff", true], ["personalToday", "Personal", false], ["cosToday", "Chief of Staff", true]];
      for (const [name, board, cos] of lists) {
        const done = /Done$/.test(name);
        const r = await t.read("cards", { list: name, filter: done ? "all" : "open" });
        for (const c of (r && r.cards && r.cards.nodes) || []) {
          if (!c || !c.id) continue;
          if (cos && !labelNames(c).includes("Personal")) continue;
          if (!done) {
            if (c.closed) continue;
            if (!(c.complete || c.dueComplete)) { reopen.push(shortId(c.id)); continue; }   // back in play: its next completion is new
          }
          const at = await when(c);
          if (at === undefined) continue;
          seen.push({ c, t: at, board });
        }
      }
    } catch (e) { state.error = (e && e.code) || "trello"; return { error: state.error }; }
    reopen.forEach((sid) => { delete doneMap[sid]; });
    // write: ledger and grants together, from the server's copies, or not at all
    let result = null;
    try {
      result = await db.transaction(async (tx) => {
        const ls = await tx.get(path("ledger")), gs = await tx.get(path("grants"));
        const L = (ls.exists && ls.data()) || {};
        L.v = 2; L.paid = L.paid || {}; L.done = L.done || {}; L.paydays = L.paydays || {}; L.cleared = L.cleared || {};
        if (!L.since) L.since = ledger.since;
        const p = plan(L, seen, Date.now());
        Object.assign(L.paid, p.newPaid); Object.assign(L.cleared, p.cleared); Object.assign(L.paydays, p.paydays);
        Object.keys(doneMap).forEach((sid) => { if (L.done[sid] == null) L.done[sid] = doneMap[sid]; });
        reopen.forEach((sid) => { delete L.done[sid]; });
        // keep the ledger small: paid marks for 55 days, completion times for 70
        const cut = Date.now() - 55 * 86400000, dcut = Date.now() - 70 * 86400000;
        Object.keys(L.paid).forEach((k) => { if ((L.paid[k].at || 0) < cut) delete L.paid[k]; });
        Object.keys(L.done).forEach((k) => { if (L.done[k] && L.done[k] < dcut) delete L.done[k]; });
        Object.keys(L.cleared).forEach((d) => { if (d < dayKey(cut)) delete L.cleared[d]; });
        L.lastScan = Date.now();
        const list = ((gs.exists && (gs.data() || {}).list) || []).filter((g) => g && g.id);
        const have = new Set(list.map((g) => g.id)), added = p.grants.filter((g) => !have.has(g.id));
        const keep = list.concat(added).filter((g) => (g.at || 0) >= Date.now() - 45 * 86400000).slice(-400);
        tx.set(path("ledger"), L);
        tx.set(path("grants"), { list: keep, updatedAt: Date.now() });
        return { added: added.length };
      });
    } catch (e) { state.error = "save"; return { error: "save" }; }
    state.lastScan = Date.now(); state.error = null; state.paid = result ? result.added : 0;
    return result;
  }
})();
