/* serviceWorker.js */
// (参考) https://developer.mozilla.org/ja/docs/Web/Progressive_web_apps/Offline_Service_workers
'use strict';

const cacheName = 'BackGammonVsAI-v20261008';
const ORIGIN = location.origin; //ポート番号を含むorigin(LAN内IP:ポートなどでも動作させる)

const contentToCache = [
  ORIGIN + '/GammonAppWithAI/',
  ORIGIN + '/GammonAppWithAI/index.html',
  ORIGIN + '/GammonAppWithAI/help.html',
  ORIGIN + '/GammonAppWithAI/manifest.json',
  ORIGIN + '/GammonAppWithAI/css/bgApplication.css',
  ORIGIN + '/GammonAppWithAI/css/bgAppBoard.css',
  ORIGIN + '/GammonAppWithAI/js/BgGame_class.js',
  ORIGIN + '/GammonAppWithAI/js/BgAiWildbg_class.js',
  ORIGIN + '/GammonAppWithAI/js/BgAiGammonNet_class.js',
  ORIGIN + '/GammonAppWithAI/js/BgKifu_class.js',
  ORIGIN + '/GammonAppWithAI/js/BgDomUtil_class.js',
  ORIGIN + '/GammonAppWithAI/js/BgAppBoard_class.js',
  ORIGIN + '/GammonAppWithAI/js/BgSvgChequer_class.js',
  ORIGIN + '/GammonAppWithAI/icon/favicon.ico',
  ORIGIN + '/GammonAppWithAI/icon/apple-touch-icon.png',
  ORIGIN + '/GammonAppWithAI/icon/android-chrome-96x96.png',
  ORIGIN + '/GammonAppWithAI/icon/android-chrome-192x192.png',
  ORIGIN + '/GammonAppWithAI/icon/android-chrome-512x512.png',
  ORIGIN + '/GammonAppWithAI/wasm/wildbg/wildbg_worker.js',
  ORIGIN + '/GammonAppWithAI/wasm/wildbg/wildbg_engine.js',
  ORIGIN + '/GammonAppWithAI/wasm/wildbg/wildbg_engine_bg.wasm',
  ORIGIN + '/GammonAppWithAI/wasm/gammonnet/gammonnet_worker.js',
  ORIGIN + '/GammonAppWithAI/wasm/gammonnet/evaluator.mjs',
  ORIGIN + '/GammonAppWithAI/wasm/gammonnet/gammonnet-simd.mjs',
  ORIGIN + '/GammonAppWithAI/wasm/gammonnet/gammonnet-simd.wasm',
  ORIGIN + '/GammonAppWithAI/wasm/gammonnet/manifest.json',
  ORIGIN + '/GammonAppWithAI/wasm/gammonnet/strehl-prob5-512-512-256-256_v1.6.0_2026-10-06.bin16',
  ORIGIN + '/GammonAppWithAI/wasm/gammonnet/strehl-prune-32_v1.6.0_2026-10-06.bin16',
  ORIGIN + '/GammonAppWithAI/js/BgAiGnubg_class.js',
  ORIGIN + '/GammonAppWithAI/wasm/gnubg/gnubg_worker.js',
  ORIGIN + '/GammonAppWithAI/wasm/gnubg/gnubg.js',
  ORIGIN + '/GammonAppWithAI/wasm/gnubg/gnubg.wasm',
  ORIGIN + '/GammonAppWithAI/wasm/gnubg/gnubg.data',
  ORIGIN + '/css/font-awesome-animation.min.css',
  ORIGIN + '/js/BgUtil_class.js',
  ORIGIN + '/js/BgXgid_class.js',
  ORIGIN + '/js/fontawesome-inuse.min.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(cacheName).then((cache) => {
      return cache.addAll(contentToCache);
    })
  );
  self.skipWaiting();
});
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((r) => {
      return r || fetch(e.request).then((response) => {
        //正常応答(200番台)かつhttp(s)のGETだけキャッシュする
        //(404/500のキャッシュ固定化や、chrome-extension: 等のエラーを防ぐ)
        if (response.ok && e.request.method === 'GET' && e.request.url.startsWith('http')) {
          const copy = response.clone();
          caches.open(cacheName).then((cache) => cache.put(e.request, copy));
        }
        return response;
      }).catch(() => Response.error()); //オフラインで未キャッシュの場合は通常のネットワークエラーとして扱う
    })
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        const [kyappname, kyversion] = key.split('-');
        const [cnappname, cnversion] = cacheName.split('-');
        if (kyappname === cnappname && kyversion !== cnversion) {
          return caches.delete(key);
        }
      }));
    })
  );
});
