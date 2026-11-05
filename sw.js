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

// episode alerts from the Worker: show them, and open Up Next when one is tapped
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Up Next", {
    body: d.body || "A new episode is out.", tag: d.tag || undefined, icon: "icons/icon-192.png", badge: "icons/icon-192.png", data: { url: d.url || "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
    const w = wins.find((c) => c.url.startsWith(self.registration.scope));
    return w ? w.focus() : self.clients.openWindow(url);
  }));
});
