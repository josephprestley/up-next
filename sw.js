/* Up Next works offline: the app's own files come from the network when it's there and from this cache when it isn't.
   Your shows are cached separately by Firebase. GitHub Pages tells browsers to keep files for 10 minutes, so every file
   is checked with GitHub first (a quick "has it changed?") and an update shows up the next time the app opens. */
const CACHE = "up-next-v3";
const SHELL = ["./", "index.html", "runtime.js", "config.js", "firebase.js", "gb.js", "gb.css", "manifest.webmanifest", "episodes.json", "icons/icon-192.png", "icons/apple-touch-icon.png"];
const fresh = (u) => new Request(u, { cache: "no-cache", credentials: "same-origin" });
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL.map(fresh))).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;   // Firebase, TVmaze, fonts and the Worker go straight out
  e.respondWith(fetch(fresh(url.href)).then((res) => (res.redirected ? fetch(req) : res)).then((res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || (req.mode === "navigate" ? caches.match("index.html") : Response.error()))));
});
