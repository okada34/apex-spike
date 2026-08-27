/**
 * Service Worker。
 *
 * やること
 *   1. 画面のHTMLとアイコンを端末に持っておく（電波が悪くても開ける）
 *   2. 出すのは手元のものを先、裏で新しいものを取ってきて次回に備える
 *
 * やらないこと
 *   - GAS（script.google.com）への問い合わせは触らない。
 *     数字の控えは画面側が localStorage で持っているので、ここで二重に持つと
 *     「どちらが新しいか」が分からなくなる
 *   - Googleフォントも触らない。ブラウザ自身の仕組みに任せる
 *
 * 版を上げると、次に開いたときに古い控えが捨てられる。
 * 画面のHTMLを直したら、ここの数字を1つ進めること。
 */
var VERSION = 'apex-v57';

/** 最初に持っておくもの。sw.js から見た相対パス */
var SHELL = [
  './',
  'home/', 'ranking/', 'circle/', 'mypage/', 'settings/', 'record/',
  'manifest.webmanifest',
  'icons/pwa-192x192.png',
  'icons/pwa-512x512.png',
  'icons/maskable-512x512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-64.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      // 1つでも失敗すると全部が入らないので、1件ずつ入れて失敗は見逃す
      return Promise.all(SHELL.map(function (u) {
        return c.add(new Request(u, { cache: 'reload' })).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === VERSION ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  // 自分のところ以外（GAS・フォント）は素通し
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.open(VERSION).then(function (cache) {
      return cache.match(req).then(function (hit) {
        // 裏で新しいものを取りに行く。次に開いたときはそちらが出る
        var fresh = fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function () { return null; });

        // 手元にあるならそれを先に返す。無ければ通信を待つ
        return hit || fresh.then(function (res) {
          if (res) return res;
          // 通信もできず控えも無い。画面遷移ならホームを出す
          if (req.mode === 'navigate') return cache.match('home/');
          return new Response('', { status: 504, statusText: 'オフラインです' });
        });
      });
    })
  );
});
