/* My Closet, standalone: the pieces claude.ai provided inside Home Base, rebuilt on Joey's own services.
   This is Up Next's runtime (../runtime.js) with the closet's additions. It is a separate file on purpose, so Up Next and
   Daily Spin keep running on the shared one while the closet settles.
   - db: Firebase Firestore under data/users/<uid>/closet/ (items, outfits, weeks, settings, photos, thumbs, drafts),
     kept on the device for offline use. Waits for sign-in, so the path always has the uid. collection().doc() with no id
     makes a new id. A save made offline counts as saved once it's safely on the device (it syncs when the signal returns).
   - user: Firebase sign-in with email and password (works inside a home-screen app on an iPhone)
   - sample: Claude through Joey's Cloudflare Worker, with photos (shrunk here) and answers limits() for the closet
   - assets: a photo is stored as two small JPEG documents (full: longest side 1,000 px; thumb: within 600x750), read once
     per device and kept in Cache Storage. Photos are never listened to, so they cost one read each.
   - backup: "Download my closet" and "Restore from file" (keeps ids; can safely be run again)
   - lake: stand-in for Home Base's map state: today's weather and forecast from Open-Meteo (free, no key), and the dress
     call from the Worker when it has one
   - downloads: an ordinary file download
   Each page asks for these through window.__wc.use(name), exactly as it did on claude.ai. The page's <html> says which app
   it is (data-app-name) and whether new sign-ins are offered (data-signup="off"). */
import {
  initializeApp, getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signOut, setPersistence, indexedDBLocalPersistence, browserLocalPersistence,
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, memoryLocalCache,
  collection, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot,
} from "../firebase.js";
import CONFIG from "../config.js";

const gate = document.getElementById("hb-gate");
const APP = document.documentElement.dataset.appName || "My Closet";
const SIGNUP = document.documentElement.dataset.signup !== "off";
const IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const STANDALONE = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
// a home-screen app keeps its own storage, so on an iPhone the closet asks to be added to the Home Screen before sign-in
let installFirst = document.documentElement.dataset.installFirst === "on" && IOS && !STANDALONE;
const $g = (sel) => gate.querySelector(sel);
const err = (code, message) => Object.assign(new Error(message || code), { code });
const HOME = { lat: 44.5133, lon: -88.0133, tz: "America/Chicago" };   // Green Bay, for the weather

// ------------------------------------------------------------------ sign-in screen
let mode = "in";   // "in" = sign in, "up" = make an account
function showGate(state, note) {
  if (state === "form" && installFirst && $g('[data-show="install"]')) state = "install";
  document.documentElement.classList.add("hb-gated");
  gate.hidden = false;
  $g("[data-state]").dataset.state = state;
  if (state === "install") $g("#hb-title").textContent = "Add " + APP + " to your Home Screen";
  $g("#hb-note").textContent = note || "";
  if (state === "form") { paintMode(); setTimeout(() => { try { $g("#hb-email").focus(); } catch (e) {} }, 50); }
}
function hideGate() { gate.hidden = true; document.documentElement.classList.remove("hb-gated"); }
function paintMode() {
  if (!SIGNUP) mode = "in";
  $g("#hb-title").textContent = mode === "up" ? "Make your " + APP + " sign-in" : "Sign in to " + APP;
  $g("#hb-go").textContent = mode === "up" ? "Create my sign-in" : "Sign in";
  $g("#hb-switch").textContent = mode === "up" ? "I already have one" : "First time? Make your sign-in";
  $g("#hb-switch").hidden = !SIGNUP;
  $g("#hb-pass").autocomplete = mode === "up" ? "new-password" : "current-password";
  $g("#hb-forgot").hidden = mode === "up";
}
const AUTH_MSG = {
  "auth/invalid-credential": "That email and password don't match. Try again, or reset your password.",
  "auth/invalid-login-credentials": "That email and password don't match. Try again, or reset your password.",
  "auth/wrong-password": "That password isn't right.",
  "auth/user-not-found": "There's no sign-in for that email yet. Make one with \"First time?\".",
  "auth/email-already-in-use": "There's already a sign-in for that email. Choose \"I already have one\".",
  "auth/weak-password": "Use at least 6 characters.",
  "auth/invalid-email": "That doesn't look like an email address.",
  "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.",
  "auth/network-request-failed": "No connection. Check the Wi-Fi and try again.",
  "auth/operation-not-allowed": "Email sign-in isn't turned on in Firebase yet (Authentication → Sign-in method).",
  "auth/admin-restricted-operation": "New sign-ins are turned off for this app.",
};

// ------------------------------------------------------------------ the runtime
let resolveRt;
const rtReady = new Promise((r) => (resolveRt = r));
window.__hbRuntime.attach(rtReady);

function localOnly(note) {
  // without the database the closet still opens, saved in this browser only
  resolveRt({ use: async () => null });
  showGate("local", note);
}

if (!CONFIG || !CONFIG.firebase || !CONFIG.firebase.apiKey) {
  localOnly(APP + " isn't connected to its database yet.");
} else {
  start();
}

// ------------------------------------------------------------------ small helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (data) => JSON.parse(JSON.stringify(data));
// a write that is waiting on the network is safe on this device, so after `ms` it counts as saved; a refusal (rules,
// bad data) that comes later is reported to the page instead of being lost
function settle(p, ms = 3500) {
  return new Promise((resolve, reject) => {
    let over = false;
    const t = setTimeout(() => { over = true; resolve(); }, ms);
    p.then(() => { if (!over) { clearTimeout(t); resolve(); } }, (e) => {
      if (!over) { clearTimeout(t); reject(e); }
      else document.dispatchEvent(new CustomEvent("closet:write-failed", { detail: e }));
    });
  });
}
async function pool(list, n, fn) {
  let i = 0;
  const run = async () => { while (i < list.length) { const k = i++; await fn(list[k], k); } };
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, run));
}
const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);

// a photo as a JPEG data URL: longest side at most `max` pixels (or inside box w x h), halved in steps so fine stripes don't shimmer
async function loadBitmap(blob) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch (e) { /* fall through */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(blob);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(err("format")); };
    img.src = url;
  });
}
const dim = (b) => [b.naturalWidth || b.width, b.naturalHeight || b.height];
function canvasOf(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function shrink(bmp, tw, th) {
  let [w, h] = dim(bmp), src = bmp;
  while (w / 2 >= tw && h / 2 >= th) {   // halve while the next halving still stays above the target
    const c = canvasOf(w / 2, h / 2); const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, c.width, c.height);
    src = c; w = c.width; h = c.height;
  }
  const c = canvasOf(tw, th); const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
function fitInside(bmp, boxW, boxH) {
  const [w, h] = dim(bmp), k = Math.min(1, boxW / w, boxH / h);
  return [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
}
async function jpegSizes(blob) {
  const bmp = await loadBitmap(blob);
  const [fw, fh] = fitInside(bmp, 1000, 1000), [tw, th] = fitInside(bmp, 600, 750);
  const full = shrink(bmp, fw, fh).toDataURL("image/jpeg", 0.82);
  const thumb = shrink(bmp, tw, th).toDataURL("image/jpeg", 0.78);
  if (bmp.close) try { bmp.close(); } catch (e) {}
  return { full, thumb, w: fw, h: fh };
}
async function jpegBox(blob, max, q) {
  if (typeof blob === "string") return blob;   // already a data URL
  const bmp = await loadBitmap(blob);
  const [w, h] = fitInside(bmp, max, max);
  const out = shrink(bmp, w, h).toDataURL("image/jpeg", q);
  if (bmp.close) try { bmp.close(); } catch (e) {}
  return out;
}
const dataBytes = (u) => Math.round((u.length - u.indexOf(",") - 1) * 0.75);
async function dataToBlob(u) { return (await fetch(u)).blob(); }

// ------------------------------------------------------------------ the rest, once Firebase is there
function start() {
  const app = initializeApp(CONFIG.firebase);
  const auth = getAuth(app);
  setPersistence(auth, indexedDBLocalPersistence).catch(() => setPersistence(auth, browserLocalPersistence).catch(() => {}));
  let fs;
  try { fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
  catch (e) { fs = initializeFirestore(app, { localCache: memoryLocalCache() }); }

  let resolveUser;
  const signedIn = new Promise((r) => (resolveUser = r));
  let current = null;
  const base = async () => "data/users/" + (await signedIn).uid + "/closet/";

  // ---- db: the same calls the closet made on claude.ai, rooted at data/users/<uid>/closet/
  const docSnap = (s) => ({ id: s.id, exists: s.exists(), data: () => s.data(), metadata: s.metadata });
  const querySnap = (q) => ({ docs: q.docs.map(docSnap), size: q.size, empty: q.empty, metadata: q.metadata });
  const mkDb = (root) => {
    const docRef = (path, ref) => {
      const r = ref || doc(fs, root + path);
      return {
        id: r.id, path,
        get: async () => docSnap(await getDoc(r)),
        set: (data) => settle(setDoc(r, clean(data))),
        delete: () => settle(deleteDoc(r)),
        onSnapshot: (cb, onErr) => onSnapshot(r, { includeMetadataChanges: true }, (s) => cb(docSnap(s)), onErr),
      };
    };
    const colRef = (path) => {
      const c = collection(fs, root + path);
      return {
        path,
        // no id: Firestore makes a new one (without this every new piece would be written to the same place)
        doc: (id) => (id ? docRef(path + "/" + id) : docRef(path + "/", doc(c))),
        get: async () => querySnap(await getDocs(c)),
        onSnapshot: (cb, onErr) => onSnapshot(c, { includeMetadataChanges: true }, (q) => cb(querySnap(q)), onErr),
      };
    };
    const docAny = (path) => docRef(path);
    return { collection: colRef, doc: docAny };
  };
  let dbP = null;
  const getDb = () => dbP || (dbP = base().then(mkDb));

  // ---- user
  const user = { id: async () => (await signedIn).uid, email: async () => (await signedIn).email || "", isOwner: async () => true };

  // ---- sample: Claude through the Worker (photos are shrunk to fit the Worker's size limit)
  const MAX_BODY = 3_000_000;   // characters of photo data per call
  const sample = CONFIG.workerUrl ? {
    limits: async () => ({ images: true, maxImages: 40, maxBytes: MAX_BODY }),
    json: async (prompt, opts) => {
      opts = opts || {};
      const u = await signedIn;
      let token;
      try { token = await u.getIdToken(); } catch (e) { throw err("auth"); }
      let images = [];
      if (opts.images && opts.images.length) {
        for (const side of (opts.imageSide ? [opts.imageSide, 640, 480, 360] : [1000, 800, 640, 480])) {
          images = [];
          for (const b of opts.images) images.push(await jpegBox(b, side, 0.8));
          if (images.reduce((n, x) => n + x.length, 0) <= MAX_BODY) break;
        }
        if (images.reduce((n, x) => n + x.length, 0) > MAX_BODY) throw err("too_large");
      }
      let res;
      try {
        res = await fetch(CONFIG.workerUrl, {
          method: "POST", signal: opts.signal,
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({ prompt: String(prompt), tier: opts.modelTier || "default", images, closet: true, maxTokens: opts.maxTokens || undefined, feature: opts.feature || undefined }),
        });
      } catch (e) { if (e && e.name === "AbortError") throw e; throw err("network"); }
      if (res.status === 429) throw err("rate_limited");
      if (res.status === 401 || res.status === 403) throw err("not_granted");
      const body = await res.json().catch(() => null);
      if (!res.ok || !body || !("json" in body)) throw err((body && body.error) || "failed");
      return body.json;
    },
  } : null;

  // ---- assets: a photo is two small JPEG documents (full, thumb), read once per device and kept in Cache Storage
  const CACHE_NAME = "closet-photos-v1";
  const memo = new Map();   // "kind:id" -> Promise<objectURL>
  const urls = new Map();   // "kind:id" -> objectURL, once it has loaded (so a redraw can use it right away)
  const keyReq = (kind, id) => new Request(location.origin + "/__closet_photo/" + kind + "/" + encodeURIComponent(id));
  async function cacheGet(kind, id) {
    try { const c = await caches.open(CACHE_NAME); const r = await c.match(keyReq(kind, id)); return r ? await r.blob() : null; } catch (e) { return null; }
  }
  async function cachePut(kind, id, blob) { try { const c = await caches.open(CACHE_NAME); await c.put(keyReq(kind, id), new Response(blob, { headers: { "content-type": "image/jpeg" } })); } catch (e) {} }
  async function cacheDel(id) { try { const c = await caches.open(CACHE_NAME); await c.delete(keyReq("full", id)); await c.delete(keyReq("thumb", id)); } catch (e) {} }
  const COL = { full: "photos", thumb: "thumbs" };
  async function loadBlob(kind, id) {
    let blob = await cacheGet(kind, id);
    if (blob) return blob;
    const db = await getDb();
    const s = await db.doc(COL[kind] + "/" + id).get();
    if (!s.exists) return null;
    const d = s.data();
    if (!d || typeof d.jpeg !== "string") return null;
    blob = await dataToBlob(d.jpeg);
    cachePut(kind, id, blob);
    return blob;
  }
  // an object URL for a photo (kind "thumb" falls back to the full photo and the other way round); null if it isn't there
  function photoUrl(id, kind) {
    kind = kind === "full" ? "full" : "thumb";
    const k = kind + ":" + id;
    if (!memo.has(k)) {
      memo.set(k, (async () => {
        let blob = await loadBlob(kind, id);
        if (!blob) blob = await loadBlob(kind === "full" ? "thumb" : "full", id);
        return blob ? URL.createObjectURL(blob) : null;
      })().then((u) => { if (!u) memo.delete(k); else urls.set(k, u); return u; }, (e) => { memo.delete(k); throw e; }));
    }
    return memo.get(k);
  }
  function forget(id) {
    for (const kind of ["full", "thumb"]) { const k = kind + ":" + id; const p = memo.get(k); memo.delete(k); urls.delete(k); if (p) p.then((u) => u && URL.revokeObjectURL(u), () => {}); }
  }
  async function storePhoto(id, sizes) {
    const db = await getDb(), at = new Date().toISOString();
    await Promise.all([
      db.doc("photos/" + id).set({ jpeg: sizes.full, w: sizes.w || null, bytes: dataBytes(sizes.full), at }),
      db.doc("thumbs/" + id).set({ jpeg: sizes.thumb, bytes: dataBytes(sizes.thumb), at }),
    ]);
    const [fb, tb] = await Promise.all([dataToBlob(sizes.full), dataToBlob(sizes.thumb)]);
    cachePut("full", id, fb); cachePut("thumb", id, tb);
    forget(id);
  }
  const assets = {
    upload: async (blob) => {
      let sizes;
      try { sizes = await jpegSizes(blob); } catch (e) { throw err("format"); }
      // Firestore holds a document up to 1 MiB; a photo that is still bigger after shrinking is turned away
      if (sizes.full.length > 900000) throw err("quota_exceeded");
      const id = "p" + newId();
      await storePhoto(id, sizes);
      return { id, url: URL.createObjectURL(await dataToBlob(sizes.full)) };
    },
    delete: async (id) => {
      if (!id) return;
      const db = await getDb();
      forget(id); cacheDel(id);
      await Promise.all([db.doc("photos/" + id).delete(), db.doc("thumbs/" + id).delete()]);
    },
    url: photoUrl,
    peek: (id, kind) => urls.get((kind === "full" ? "full" : "thumb") + ":" + id) || null,
    put: storePhoto,
    blob: async (id) => { const u = await photoUrl(id, "full"); return u ? (await fetch(u)).blob() : null; },
  };

  // ---- downloads
  const downloads = {
    save: async ({ filename, data, mimeType }) => {
      const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType || "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = filename || "download";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    },
  };

  // ---- backup: the whole closet as one file, and back from one
  const FORMAT = "my-closet";
  const backup = {
    format: FORMAT,
    exportAll: async (onProgress) => {
      const db = await getDb(), say = (m) => onProgress && onProgress(m);
      const grab = async (name) => { const q = await db.collection(name).get(); const o = {}; q.docs.forEach((d) => { o[d.id] = d.data(); }); return o; };
      say("Reading your pieces…");
      const [items, outfits, weeks] = [await grab("items"), await grab("outfits"), await grab("weeks")];
      const sdoc = await db.doc("settings/main").get();
      say("Reading photos…");
      const full = await grab("photos"), thumb = await grab("thumbs");
      const photos = {};
      for (const id of new Set([...Object.keys(full), ...Object.keys(thumb)])) photos[id] = { full: (full[id] || thumb[id]).jpeg, thumb: (thumb[id] || full[id]).jpeg };
      return { format: FORMAT, version: 1, exportedAt: new Date().toISOString(), items, outfits, weeks, settings: sdoc.exists ? sdoc.data() : null, photos };
    },
    // overwrite: false keeps anything already here (safe to run again); true replaces pieces with the file's copy
    restore: async (file, opts, onProgress) => {
      opts = opts || {};
      if (!file || file.format !== FORMAT || !file.items) throw err("not_a_closet_file");
      const db = await getDb(), say = (p) => onProgress && onProgress(p);
      const have = { items: new Set(), outfits: new Set(), weeks: new Set(), photos: new Set() };
      for (const name of ["items", "outfits", "weeks"]) (await db.collection(name).get()).docs.forEach((d) => have[name].add(d.id));
      (await db.collection("thumbs").get()).docs.forEach((d) => have.photos.add(d.id));
      const jobs = [];
      for (const name of ["items", "outfits", "weeks"]) for (const [id, data] of Object.entries(file[name] || {})) {
        if (opts.overwrite || !have[name].has(id)) jobs.push({ kind: name, id, data });
      }
      if (file.settings && (opts.overwrite || !(await db.doc("settings/main").get()).exists)) jobs.push({ kind: "settings", id: "main", data: file.settings });
      for (const [id, p] of Object.entries(file.photos || {})) if (opts.overwrite || !have.photos.has(id)) jobs.push({ kind: "photo", id, data: p });
      const total = jobs.length; let done = 0, failed = [];
      say({ phase: "writing", done, total });
      // photos first, then the pieces that point at them
      jobs.sort((a, b) => (a.kind === "photo" ? 0 : 1) - (b.kind === "photo" ? 0 : 1));
      await pool(jobs, 4, async (j) => {
        try {
          // a restore waits for the server to confirm each write (no timeout): that is how it knows everything arrived
          if (j.kind === "photo") {
            const at = new Date().toISOString();
            await setDoc(doc(fs, (await base()) + "photos/" + j.id), { jpeg: j.data.full, bytes: dataBytes(j.data.full), at });
            await setDoc(doc(fs, (await base()) + "thumbs/" + j.id), { jpeg: j.data.thumb, bytes: dataBytes(j.data.thumb), at });
            forget(j.id);
          } else {
            const path = j.kind === "settings" ? "settings/main" : j.kind + "/" + j.id;
            await setDoc(doc(fs, (await base()) + path), clean(j.data));
          }
        } catch (e) { failed.push({ kind: j.kind, id: j.id, code: e && e.code }); }
        say({ phase: "writing", done: ++done, total });
      });
      say({ phase: "checking", done, total });
      // check: every piece, outfit and week from the file is now here, and a few photos open
      const got = {};
      for (const name of ["items", "outfits", "weeks"]) got[name] = new Set((await db.collection(name).get()).docs.map((d) => d.id));
      const missing = [];
      for (const name of ["items", "outfits", "weeks"]) for (const id of Object.keys(file[name] || {})) if (!got[name].has(id)) missing.push(name + "/" + id);
      const photoIds = Object.keys(file.photos || {}), sample = [];
      for (let i = 0; i < Math.min(5, photoIds.length); i++) sample.push(photoIds[Math.floor((i * photoIds.length) / Math.min(5, photoIds.length))]);
      const badPhotos = [];
      for (const id of sample) { const s = await db.doc("thumbs/" + id).get(); if (!s.exists) badPhotos.push(id); }
      return {
        wrote: done - failed.length, failed, missing, badPhotos,
        counts: { items: Object.keys(file.items || {}).length, outfits: Object.keys(file.outfits || {}).length, weeks: Object.keys(file.weeks || {}).length, photos: photoIds.length },
        ok: !failed.length && !missing.length && !badPhotos.length,
      };
    },
  };

  // ---- lake: today's weather and forecast (Open-Meteo), and the dress call from the Worker when it has one
  const lake = window.lake;   // the page's own script (a stub in index.html's head) is already listening
  const WX = (c) => c === 0 ? "Clear" : c <= 2 ? "Partly cloudy" : c === 3 ? "Cloudy" : c <= 48 ? "Fog" : c <= 57 ? "Drizzle" : c <= 65 ? "Rain" : c <= 67 ? "Freezing rain" : c <= 77 ? "Snow" : c <= 82 ? "Rain showers" : c <= 86 ? "Snow showers" : "Thunderstorms";
  async function weather() {
    const key = "closet-weather";
    let w = null;
    try {
      const q = new URLSearchParams({ latitude: HOME.lat, longitude: HOME.lon, current: "temperature_2m,weather_code", daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code", temperature_unit: "fahrenheit", timezone: HOME.tz, forecast_days: "7" });
      const r = await fetch("https://api.open-meteo.com/v1/forecast?" + q, { cache: "no-store" });
      if (!r.ok) throw 0;
      const j = await r.json();
      const cur = j.current || {}, d = j.daily || {};
      const wet = Number((d.precipitation_probability_max || [])[0]) >= 40;
      const phrase = WX(Number((d.weather_code || [])[0]));
      w = {
        at: Date.now(),
        weather: typeof cur.temperature_2m === "number" ? { temp: Math.round(cur.temperature_2m), phrase: WX(Number(cur.weather_code)) } : null,
        forecast: typeof (d.temperature_2m_min || [])[0] === "number" ? { low: Math.round(d.temperature_2m_min[0]), high: Math.round(d.temperature_2m_max[0]), precip: wet ? phrase : "" } : null,
        days: (d.time || []).map((t, i) => ({ date: t, low: Math.round(d.temperature_2m_min[i]), high: Math.round(d.temperature_2m_max[i]), pop: d.precipitation_probability_max[i], phrase: WX(Number(d.weather_code[i])) })),
      };
      try { localStorage.setItem(key, JSON.stringify(w)); } catch (e) {}
    } catch (e) {
      try { const s = JSON.parse(localStorage.getItem(key) || "null"); if (s && Date.now() - s.at < 12 * 3600 * 1000) w = s; } catch (x) {}
    }
    return w;
  }
  async function dressCall() {
    if (!CONFIG.workerUrl) return null;
    try { const r = await window.__hbAccount.call({ closet: "dress" }); return r && r.dress ? r : null; } catch (e) { return null; }
  }
  async function refreshLake() {
    const [w, d] = await Promise.all([weather(), dressCall()]);
    const st = { weather: w && w.weather, forecast: w && w.forecast, days: w && w.days, dress: d && d.dress, dressDays: d && d.days };
    st.at = Date.now();
    lake._set(st);
  }
  signedIn.then(() => { refreshLake(); setInterval(refreshLake, 30 * 60 * 1000); document.addEventListener("visibilitychange", () => { if (!document.hidden && Date.now() - ((lake.state && lake.state.at) || 0) > 10 * 60 * 1000) refreshLake(); }); });

  const caps = { db: null, user, sample, assets, downloads, backup, lake };
  resolveRt({ use: async (name) => (name === "db" ? getDb() : caps[name] || null) });

  // ---- account details for the closet's "Your closet" panel
  window.__hbAccount = {
    get email() { return current ? current.email || "" : ""; },
    get uid() { return current ? current.uid : ""; },
    get claude() { return !!sample; },
    signOut: async () => { await signOut(auth); location.reload(); },
    // anything else the Worker does for Joey, with his sign-in
    call: async (body) => {
      if (!CONFIG.workerUrl) throw err("no_worker");
      const u = await signedIn;
      const res = await fetch(CONFIG.workerUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + (await u.getIdToken()) }, body: JSON.stringify(body) }).catch(() => { throw err("network"); });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw err((j && j.error) || "failed");
      return j || {};
    },
  };

  // ---- the sign-in screen
  $g("#hb-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $g("#hb-email").value.trim(), pass = $g("#hb-pass").value;
    if (!email || !pass) { $g("#hb-msg").textContent = "Enter your email and a password."; return; }
    $g("#hb-go").disabled = true; $g("#hb-msg").textContent = mode === "up" ? "Making your sign-in…" : "Signing in…";
    try {
      if (mode === "up") await createUserWithEmailAndPassword(auth, email, pass);
      else await signInWithEmailAndPassword(auth, email, pass);
      $g("#hb-msg").textContent = "";
    } catch (ex) {
      $g("#hb-msg").textContent = AUTH_MSG[ex && ex.code] || "That didn't work (" + ((ex && ex.code) || "unknown") + "). Try again.";
    } finally { $g("#hb-go").disabled = false; }
  });
  $g("#hb-switch").addEventListener("click", () => { mode = mode === "up" ? "in" : "up"; $g("#hb-msg").textContent = ""; paintMode(); });
  $g("#hb-forgot").addEventListener("click", async () => {
    const email = $g("#hb-email").value.trim();
    if (!email) { $g("#hb-msg").textContent = "Type your email first, then tap \"Forgot password\"."; return; }
    try { await sendPasswordResetEmail(auth, email); $g("#hb-msg").textContent = "A reset link is on its way to " + email + "."; }
    catch (ex) { $g("#hb-msg").textContent = AUTH_MSG[ex && ex.code] || "Couldn't send the reset email."; }
  });

  onAuthStateChanged(auth, (u) => {
    if (u) {
      const switched = current && current.uid !== u.uid;
      current = u; hideGate(); resolveUser(u);
      if (switched) location.reload();
    } else if (current) { location.reload(); }
    else showGate("form");
  });
}

// the "use it on this device only" button on the not-set-up screen, and "sign in here anyway" on the install screen
gate.addEventListener("click", (e) => {
  if (e.target.closest("#hb-local")) hideGate();
  if (e.target.closest("#hb-anyway")) { installFirst = false; showGate("form"); }
});
