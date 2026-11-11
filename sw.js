/* Service worker: lets the app open offline.
   Large static files are cache-first; pages and config are network-first (fresh when online, cached when offline).
   Firebase / Google API traffic is never touched here. */
const CACHE = "servants-v5";
const SHELL = ["./", "index.html", "firebase-config.js", "firebase-bundle.js", "exceljs.min.js", "manifest.webmanifest", "icon-180.png", "icon-192.png", "icon-512.png"];
const STATIC = /(exceljs\.min\.js|firebase-bundle\.js|icon-\d+\.png)$/;
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});
const timeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("timeout")), ms); p.then(v => { clearTimeout(t); res(v) }, e => { clearTimeout(t); rej(e) }); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const same = url.origin === self.location.origin;
  if (!same && !FONT_HOSTS.includes(url.hostname)) return;
  const staticFile = !same || STATIC.test(url.pathname);
  e.respondWith(caches.open(CACHE).then(async c => {
    if (staticFile) {
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      try { const r = await fetch(req); if (r && (r.ok || r.type === "opaque")) c.put(req, r.clone()); return r; }
      catch (err) { return new Response("", { status: 504 }); }
    }
    try {
      const r = await timeout(fetch(req), 4000);
      if (r && r.ok) c.put(req, r.clone());
      return r;
    } catch (err) {
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === "navigate") { const idx = await c.match("index.html"); if (idx) return idx; }
      return new Response("", { status: 504 });
    }
  }));
});
