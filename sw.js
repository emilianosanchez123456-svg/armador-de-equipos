/* =========================================================
   sw.js — "Service worker": guarda una copia de los archivos de la app
   en el celular, así se puede abrir aunque no haya internet.

   Solo funciona cuando la app está publicada (GitHub Pages);
   abierta con doble clic no se usa.

   Estrategia: primero intenta bajar la versión nueva de internet
   (así las actualizaciones llegan solas); si no hay conexión, usa la copia.

   IMPORTANTE: si agregás un archivo nuevo a la app, sumalo a ARCHIVOS
   y cambiá VERSION (ej: "armador-v2").
   ========================================================= */

const VERSION = "armador-v1";

const ARCHIVOS = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "js/datos.js",
  "js/cambios.js",
  "js/balanceo.js",
  "js/calculos.js",
  "js/ui.js",
  "js/respaldo.js",
  "js/pantalla-armar.js",
  "js/pantalla-historial.js",
  "js/pantalla-estadisticas.js",
  "js/pantalla-jugadores.js",
  "js/pantalla-deportes.js",
  "js/inicio.js",
  "iconos/icono-180.png",
  "iconos/icono-192.png",
  "iconos/icono-512.png",
];

// Al instalarse: guarda todos los archivos.
self.addEventListener("install", (evento) => {
  evento.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(ARCHIVOS)));
  self.skipWaiting();
});

// Al activarse: borra copias de versiones viejas.
self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches.keys().then((nombres) => Promise.all(nombres.filter((n) => n !== VERSION).map((n) => caches.delete(n))))
  );
  self.clients.claim();
});

// Cada vez que la app pide un archivo: internet primero, copia si no hay conexión.
self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;
  evento.respondWith(
    fetch(evento.request)
      .then((respuesta) => {
        if (respuesta.ok && new URL(evento.request.url).origin === self.location.origin) {
          const copia = respuesta.clone();
          caches.open(VERSION).then((cache) => cache.put(evento.request, copia));
        }
        return respuesta;
      })
      .catch(() => caches.match(evento.request, { ignoreSearch: true }))
  );
});
