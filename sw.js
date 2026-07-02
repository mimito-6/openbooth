/* ============================================================
   OpenBooth — Service Worker
   Precache app shell, serve cache-first so the app cold-starts
   with no network (venue Wi-Fi is unreliable). Bump CACHE on
   each release; old caches are purged on activate.
   ============================================================ */
const CACHE = "openbooth-v25";
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "icons/icon.svg",
  "css/tokens.css",
  "css/app.css",
  "css/theme-press.css",
  "css/theme-cotton.css",
  "css/theme-market.css",
  "css/theme-koishi.css",
  "css/theme-linen.css",
  "css/theme-graphite.css",
  "css/theme-sage.css",
  "css/theme-sabi.css",
  "css/theme-titanium.css",
  "css/theme-gunmetal.css",
  "css/theme-chrome.css",
  "css/theme-folio.css",
  "css/theme-halftone.css",
  "css/theme-zine.css",
  "css/theme-spec.css",
  "css/theme-pixel.css",
  "fonts/space-grotesk-latin.woff2",
  "fonts/fraunces-latin.woff2",
  "fonts/quicksand-latin.woff2",
  "fonts/outfit-latin.woff2",
  "fonts/archivo-black-latin.woff2",
  "fonts/ibm-plex-mono-latin.woff2",
  "fonts/ibm-plex-mono-600-latin.woff2",
  "fonts/silkscreen-latin.woff2",
  "js/i18n.js",
  "js/util.js",
  "js/icons.js",
  "js/components.js",
  "js/store.js",
  "js/pricing.js",
  "js/inventory.js",
  "js/stats.js",
  "js/router.js",
  "js/views/home.js",
  "js/views/front.js",
  "js/views/stock.js",
  "js/views/event.js",
  "js/views/pickup.js",
  "js/views/pay.js",
  "js/views/record.js",
  "js/views/settings.js",
  "js/app.js",
  // optional receipt add-on — precache so offline checkout can still render/print
  "js/openbooth-receipt-bridge.global.js",
  "js/openbooth-receipt.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          // runtime-cache same-origin GETs (e.g. presets) for offline reuse
          if (res && res.status === 200 && new URL(req.url).origin === location.origin) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match("index.html"));
    })
  );
});
