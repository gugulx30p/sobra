const CACHE_STATIC = "sobra-static-v1";
const CACHE_API = "sobra-api-v1";
const APP_SHELL = ["./", "./index.html", "./manifest.json", "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/icon-maskable-512.png", "./icons/apple-touch-icon.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_STATIC).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => ![CACHE_STATIC, CACHE_API].includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_STATIC);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === "opaque")) cache.put(request, response.clone()).catch(() => {});
  return response;
}
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_API);
  const cached = await cache.match(request);
  const update = fetch(request).then(response => {
    if (response && (response.ok || response.type === "opaque")) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  if (cached) { update.catch(() => {}); return cached; }
  return (await update) || new Response(JSON.stringify({ error: "offline", cached: false }), {status: 503, headers: {"Content-Type":"application/json"}});
}
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    if (/api\.bcb\.gov\.br|api\.coingecko\.com|brapi\.dev|query1\.finance\.yahoo\.com|rss2json\.com|allorigins\.win|api\.allorigins\.win/i.test(url.hostname)) {
      event.respondWith(staleWhileRevalidate(req));
    }
    return;
  }
  if (req.mode === "navigate" || /\.(?:html|css|js|mjs|json|svg|png|webp|avif|woff2?)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req));
  }
});
