/* VERSION: 9.1.0 */
/* sw.js - Service Worker with improved update detection */

// IMPORTANT: Bump this version number when deploying updates
// This ensures users get new code instead of stale cache
const CACHE_VERSION = 29;
const CACHE_NAME = `internode-player-v${CACHE_VERSION}`;

const ASSETS = [
  './index.html',
  './html/eq.html',
  './html/info.html',
  './html/playlist.html',
  './html/menubar.html',
  './html/captions.html',
  './html/stream.html',
  './html/video-filters.html',
  './html/keybinds.html',
  './html/changelog.html',
  './css/base.css',
  './css/ui-base.css',
  './css/modals-core.css',
  './css/modal-eq.css',
  './css/modal-readme.css',
  './css/modal-video.css',
  './css/modal-keybinds.css',
  './css/menubar.css',
  './css/player.css',
  './css/sidebar.css',
  './js/app.js',
  './js/app-events.js',
  './js/ui-elements.js',
  './js/store.js',
  './js/worker-metadata.js',
  './js/player.js',
  './js/audio.js',
  './js/subtitles.js',
  './js/thumbnails.js',
  './js/playlist-manager.js',
  './js/ui-manager.js',
  './js/stream.js',
  './js/eq.js',
  './js/eq-presets.js',
  './js/converter.js',
  './js/logger.js',
  './js/video-manager.js',
  './js/keybind-manager.js',
  './js/version.js', 
  './js/jsmediatags.min.js',
  './js/subtitles-octopus-min.js'
];

// Install - cache all assets
self.addEventListener('install', (e) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        // Cache all assets, but don't fail if one fails
        return Promise.allSettled(
          ASSETS.map(asset => 
            cache.add(asset).catch(err => {
              console.warn(`Failed to cache ${asset}:`, err);
            })
          )
        );
      })
  );
});

// Activate - clean old caches and claim clients
self.addEventListener('activate', (e) => {
  e.waitUntil(
    Promise.all([
      // Take control of all clients immediately
      self.clients.claim(),
      
      // Delete all old caches
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME && key.startsWith('internode-player-')) {
              console.log('Deleting old cache:', key);
              return caches.delete(key);
            }
          })
        );
      })
  ])
  );
});

// Fetch - Stale-while-revalidate strategy for better updates
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
  // Only handle same-origin requests
  if (url.origin !== location.origin) {
    return;
  }
  
  // For navigation requests, try network first (ensures fresh HTML)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          // Cache the fresh response
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(e.request);
        })
    );
    return;
  }
  
  // For assets, use stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      // Start fetching new version in background
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        // Update cache with fresh response
        if (networkResponse.ok) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Network failed, that's ok if we have cache
        return cachedResponse;
      });
      
      // Return cached response immediately, or wait for network
      return cachedResponse || fetchPromise;
    })
  );
});

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Allow clients to request cache clear
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
});