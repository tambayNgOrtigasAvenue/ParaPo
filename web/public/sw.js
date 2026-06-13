// ParaPo service worker — offline-first shell caching.
// Network transactions are queued in IndexedDB by the app (see lib/queue.ts);
// this SW only ensures the app shell loads without connectivity.
const CACHE = "parapo-shell-v1";
const SHELL = ["/", "/onboarding", "/driver", "/commuter", "/coop", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Never cache Stellar RPC/Horizon or oracle calls — always go to network.
  if (/stellar\.org|localhost:4000/.test(url.host + url.pathname)) return;

  // Stale-while-revalidate for same-origin shell assets.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res && res.status === 200) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
