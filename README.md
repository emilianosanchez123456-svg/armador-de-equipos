# Armador de Equipos

App web para armar equipos parejos (fútbol, vóley o cualquier deporte) a partir de una nota del 1 al 10 de cada jugador. Guarda jugadores, notas, partidos y resultados, muestra estadísticas y sugiere ajustes de notas.

## Cómo usarla

- **En el celular o la compu:** abrí el link de GitHub Pages. Desde el celular se puede "instalar" (menú del navegador → *Agregar a pantalla de inicio*) y funciona sin internet.
- **Sin internet ni servidor:** descargá la carpeta y abrí `index.html` con doble clic.

Los datos se guardan **solo en el navegador de cada dispositivo**. Para tener una copia o pasarlos a otro dispositivo, usá **Exportar datos** e **Importar datos**.

## Archivos

| Archivo | Qué tiene |
|---|---|
| `index.html` | La página de la app |
| `styles.css` | Colores, tamaños y versión celular |
| `js/datos.js` | Forma de los datos, guardado y respaldo |
| `js/cambios.js` | Cambios sobre jugadores, deportes y partidos |
| `js/balanceo.js` | El algoritmo que arma los equipos |
| `js/calculos.js` | Estadísticas, evaluación automática y sugerencias de notas |
| `js/ui.js`, `js/respaldo.js`, `js/inicio.js` | Herramientas de pantalla, exportar/importar y arranque |
| `js/pantalla-*.js` | Cada pantalla de la app |
| `tests.html` + `js/tests.js` | Pruebas automáticas: abrí `tests.html` y tienen que estar todas en verde |
| `manifest.webmanifest`, `sw.js`, `iconos/` | Para instalarla en el celular y usarla sin internet |

Hecha con HTML, CSS y JavaScript puro, sin frameworks.
