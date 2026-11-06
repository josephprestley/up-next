/* Daily Spin works offline: its files come from the network when it answers within 2.5 seconds and from this cache
   otherwise. It also keeps the shared runtime (../runtime.js, ../firebase.js, ../config.js), which pages it controls
   load from outside its folder, and the Google fonts once they've loaded. Up Next has its own worker and cache. */
const CACHE = "daily-spin-v1";
const SHELL = ["./", "index.html", "rewards.js", "art.js", "art_rooms_b.js", "gb.js", "gb.css", "manifest.webmanifest", "icons/icon-192.png", "icons/apple-touch-icon.png", "../runtime.js", "../firebase.js", "../config.js"];
const fresh = (u) => new Request(u, { cache: "no-cache", credentials: "same-origin" });
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map(fresh))).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("daily-spin-") && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (FONTS.test(req.url)) {   // fonts: the saved copy right away, refreshed in the background
    e.respondWith(caches.open(CACHE).then((c) => c.match(req).then((hit) => { const net = fetch(req).then((r) => { if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }).catch(() => hit); return hit || net; })));
    return;
  }
  if (url.origin !== location.origin) return;   // Firebase and the Worker go straight out
  const net = fetch(fresh(url.href)).then((res) => (res.redirected ? fetch(req) : res)).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  });
  const cached = () => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : null));
  // on one bar of signal, don't hang on GitHub: after 2.5 s use the saved copy if there is one
  e.respondWith(new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { cached().then((hit) => { if (hit && !done) { done = true; resolve(hit); } }); }, 2500);
    net.then((res) => { if (!done) { done = true; clearTimeout(t); resolve(res); } })
      .catch(() => cached().then((hit) => { if (!done) { done = true; clearTimeout(t); resolve(hit || Response.error()); } }));
  }));
});
