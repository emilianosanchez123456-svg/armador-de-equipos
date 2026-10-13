/* =========================================================
   inicio.js — Arranca la app. Va siempre último en index.html,
   porque usa cosas de todos los archivos anteriores.
   ========================================================= */

// 1) Leer los datos guardados (o crear los iniciales la primera vez).
const resultadoCarga = Datos.cargar();
if (resultadoCarga.aviso) {
  UI.mostrarAvisoFijo(resultadoCarga.aviso);
}

// 2) Activar los botones Exportar / Importar y los del recordatorio de respaldo.
Respaldo.conectarBotones();
UI.conectarRecordatorios();

// 3) Cada vez que se toca una opción del menú, cambia la "#..." de la dirección:
//    dibujamos la pantalla nueva y volvemos arriba de todo.
window.addEventListener("hashchange", () => {
  UI.mostrarPantallaSegunDireccion();
  window.scrollTo(0, 0);
});

// 4) Dibujar la primera pantalla.
UI.mostrarPantallaSegunDireccion();

// 5) Solo cuando la app está publicada en internet (no abierta con doble clic):
//    - el "manifest", que permite instalarla en el celular con su ícono;
//    - el "service worker" (sw.js), que guarda una copia de la app para que abra sin internet.
if (location.protocol === "https:" || location.protocol === "http:") {
  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = "manifest.webmanifest";
  document.head.appendChild(manifest);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // Si no se puede, la app funciona igual (solo que necesita internet para abrir).
    });
  }
}
