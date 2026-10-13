/* =========================================================
   ui.js — Herramientas de pantalla que usan todas las pantallas:
   - cambiar de pantalla con el menú
   - mostrar avisos cortos ("Listo", "Hubo un problema...")
   - pedir confirmación antes de borrar o reemplazar
   - descargar archivos
   - armar el mensaje de "todavía no hay datos"
   ========================================================= */

// Acá se registra cada pantalla. Cada archivo pantalla-*.js agrega la suya así:
//   Pantallas.historial = { titulo: "Historial", dibujar(contenedor) { ... } };
//
// OJO al escribir una pantalla: no agregar escuchadores (addEventListener) al
// "contenedor" que recibe dibujar(), porque es siempre el mismo <main> y se
// acumularían cada vez que se redibuja. Agregarlos a elementos creados adentro.
const Pantallas = {};

const UI = {
  // Nombre de la pantalla que se está viendo (ej: "armar").
  pantallaActual: null,

  /* ---------- Navegación ---------- */

  // Mira la parte "#..." de la dirección y dibuja esa pantalla.
  // Si no existe, muestra "Armar equipos", que es la pantalla de inicio.
  mostrarPantallaSegunDireccion() {
    let nombre = location.hash.replace("#", "");
    if (!Pantallas[nombre]) nombre = "armar";
    this.pantallaActual = nombre;

    // Marcar en el menú cuál es la pantalla actual.
    document.querySelectorAll(".menu-boton").forEach((boton) => {
      if (boton.dataset.pantalla === nombre) {
        boton.setAttribute("aria-current", "page");
      } else {
        boton.removeAttribute("aria-current");
      }
    });

    this.redibujar();
    document.title = Pantallas[nombre].titulo + " · Armador de Equipos";
  },

  // Vuelve a dibujar la pantalla actual (por ejemplo, después de importar datos).
  redibujar() {
    const contenedor = document.getElementById("pantalla");
    contenedor.innerHTML = "";
    Pantallas[this.pantallaActual].dibujar(contenedor);
    this.actualizarInsignias();
    this.actualizarRecordatorios();
  },

  /* ---------- Recordatorio de respaldo ---------- */

  // Si hace tiempo que hay cambios sin exportar, muestra un recordatorio arriba de la pantalla.
  actualizarRecordatorios() {
    const zona = document.getElementById("recordatorios");
    if (!zona) return;
    const preferencias = Datos.leerPreferencias();
    const mostrar = Datos.actuales.jugadores.length > 0 && Datos.hayQueRecordarRespaldo(preferencias, new Date());
    if (!mostrar) {
      zona.innerHTML = "";
      return;
    }

    let cuando = "Todavía no guardaste ninguna copia de tus datos.";
    if (preferencias.ultimaExportacion) {
      const dias = Math.floor((new Date() - new Date(preferencias.ultimaExportacion)) / (24 * 60 * 60 * 1000));
      cuando = "Hace " + this.plural(dias, "día", "días") + " que no guardás una copia de tus datos.";
    }
    zona.innerHTML =
      '<div class="caja-aviso recordatorio" role="status">' +
      "<p><strong>💾 " + cuando + "</strong> Si se borra el navegador o cambiás de celular, se pierden. " +
      "Exportá una copia y guardala (por ejemplo, mandátela por WhatsApp o mail).</p>" +
      '<div class="acciones">' +
      '  <button type="button" class="boton boton-principal boton-chico" data-recordatorio="exportar">Exportar datos ahora</button>' +
      '  <button type="button" class="boton boton-secundario boton-chico" data-recordatorio="posponer">Recordármelo en unos días</button>' +
      "</div></div>";
  },

  // Botones del recordatorio (se conectan una sola vez al arrancar).
  conectarRecordatorios() {
    document.getElementById("recordatorios").addEventListener("click", (evento) => {
      const boton = evento.target.closest("[data-recordatorio]");
      if (!boton) return;
      if (boton.dataset.recordatorio === "exportar") {
        Respaldo.exportar();
      } else {
        const despues = new Date(Date.now() + DIAS_POSPONER_RESPALDO * 24 * 60 * 60 * 1000);
        Datos.guardarPreferencias({ posponerRespaldoHasta: despues.toISOString() });
        this.actualizarRecordatorios();
      }
    });
  },

  /* ---------- Deshacer ---------- */

  // Después de borrar algo, muestra un aviso con el botón "Deshacer" por unos segundos.
  // copiaAntes: los datos (como texto JSON) de ANTES de borrar.
  ofrecerDeshacer(mensaje, copiaAntes) {
    const marca = Datos.contadorCambios; // si después se guarda otra cosa, ya no se puede deshacer
    this.avisar(mensaje, "exito", {
      texto: "Deshacer",
      alTocar: () => {
        if (Datos.contadorCambios !== marca) {
          this.avisar("Ya no se puede deshacer porque hubo otros cambios después.", "info");
          return;
        }
        Datos.actuales = JSON.parse(copiaAntes);
        this.guardarCambios();
        this.redibujar();
        this.avisar("Listo, se deshizo.", "info");
      },
    });
  },

  // Muestra un numerito en "Jugadores" del menú si hay sugerencias de notas para revisar.
  actualizarInsignias() {
    const enlace = document.querySelector('.menu-boton[data-pantalla="jugadores"]');
    if (!enlace) return;
    const anterior = enlace.querySelector(".insignia");
    if (anterior) anterior.remove();

    const cantidad = Calculos.sugerencias(Datos.actuales).length;
    if (cantidad > 0) {
      const insignia = document.createElement("span");
      insignia.className = "insignia";
      insignia.textContent = cantidad;
      insignia.title = this.plural(cantidad, "sugerencia de nota para revisar", "sugerencias de notas para revisar");
      insignia.setAttribute("aria-label", insignia.title);
      enlace.appendChild(insignia);
    }
  },

  /* ---------- Textos seguros ---------- */

  // Convierte un texto para mostrarlo tal cual en la pantalla.
  // IMPORTANTE: usar siempre con nombres o comentarios escritos por personas,
  // así un nombre como "<b>Juan</b>" se ve como texto y no rompe la página
  // (esto importa porque se pueden importar archivos que vienen de otros).
  escapar(texto) {
    return String(texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  // Elige singular o plural según la cantidad: plural(1, "jugador", "jugadores") → "1 jugador"
  plural(cantidad, singular, plural) {
    return cantidad + " " + (cantidad === 1 ? singular : plural);
  },

  // Muestra un número con coma decimal: 6.75 → "6,75"
  numero(valor) {
    return Number(valor).toLocaleString("es-AR", { maximumFractionDigits: 2 });
  },

  // Une una lista con comas y "y": [6, 6, 5] → "6, 6 y 5"
  listaConY(lista) {
    if (lista.length <= 1) return lista.join("");
    return lista.slice(0, -1).join(", ") + " y " + lista[lista.length - 1];
  },

  // Copia un texto al portapapeles. Devuelve una promesa con true si se pudo.
  async copiarTexto(texto) {
    // Forma moderna
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(texto);
        return true;
      }
    } catch (error) {
      // seguimos con la forma vieja
    }
    // Forma vieja (funciona en más navegadores): un cuadro de texto oculto
    try {
      const cuadro = document.createElement("textarea");
      cuadro.value = texto;
      cuadro.setAttribute("readonly", "");
      cuadro.style.position = "fixed";
      cuadro.style.opacity = "0";
      document.body.appendChild(cuadro);
      cuadro.select();
      const salioBien = document.execCommand("copy");
      cuadro.remove();
      return salioBien;
    } catch (error) {
      return false;
    }
  },

  // Muestra una fecha guardada (ej: "2026-10-13T18:30:00Z") como "13/10/2026".
  fechaLegible(textoFecha) {
    return new Date(textoFecha).toLocaleDateString("es-AR");
  },

  /* ---------- Avisos ---------- */

  // Muestra un mensaje corto abajo de la pantalla.
  // tipo: "exito" (verde), "error" (rojo) o "info" (gris).
  // Los de éxito e info se van solos; los de error quedan hasta que se cierran.
  // accion (opcional): { texto, alTocar } agrega un botón al aviso (ej: "Deshacer").
  avisar(mensaje, tipo = "exito", accion = null) {
    const caja = document.getElementById("avisos");
    const aviso = document.createElement("div");
    aviso.className = "aviso aviso-" + tipo;
    aviso.setAttribute("role", tipo === "error" ? "alert" : "status");
    aviso.innerHTML =
      "<p>" + this.escapar(mensaje) + "</p>" +
      (accion ? '<button type="button" class="aviso-accion">' + this.escapar(accion.texto) + "</button>" : "") +
      '<button type="button" class="aviso-cerrar" aria-label="Cerrar aviso">✕</button>';
    aviso.querySelector(".aviso-cerrar").addEventListener("click", () => aviso.remove());
    if (accion) {
      aviso.querySelector(".aviso-accion").addEventListener("click", () => {
        aviso.remove();
        accion.alTocar();
      });
    }
    caja.appendChild(aviso);

    if (tipo !== "error") {
      // Con botón, el aviso dura más para dar tiempo a tocarlo.
      setTimeout(() => aviso.remove(), accion ? 9000 : 5000);
    }
  },

  // Muestra un aviso amarillo que queda fijo arriba (para problemas importantes).
  mostrarAvisoFijo(mensaje) {
    const caja = document.getElementById("aviso-fijo");
    caja.innerHTML = '<div class="aviso-fijo" role="alert"><p>' + this.escapar(mensaje) + "</p></div>";
    caja.hidden = false;
  },

  // Si no se pudo guardar, avisa qué hacer. Devuelve true si se guardó bien.
  guardarCambios() {
    const salioBien = Datos.guardar();
    if (!salioBien && Datos.sePuedeGuardar) {
      this.avisar(
        "No se pudieron guardar los cambios. Puede que el navegador no tenga más espacio. " +
          "Tocá \"Exportar datos\" para no perder lo que cargaste.",
        "error"
      );
    }
    return salioBien;
  },

  /* ---------- Confirmación ---------- */

  // Abre una ventana que pregunta antes de hacer algo importante.
  // Devuelve una "promesa": hay que esperarla con await. Ej:
  //   const seguro = await UI.confirmar({ titulo: "¿Borrar a Juan?", mensaje: "..." });
  //   if (seguro) { ...borrar... }
  //
  // Opciones:
  //   titulo, mensaje (texto común) o mensajeHtml (HTML ya preparado y seguro),
  //   textoConfirmar, textoCancelar,
  //   peligroso: true pinta el botón de rojo (para borrar o reemplazar).
  confirmar({ titulo, mensaje = "", mensajeHtml = null, textoConfirmar = "Aceptar", textoCancelar = "Cancelar", peligroso = false }) {
    const dialogo = document.getElementById("dialogo");
    const botonSi = document.getElementById("dialogo-confirmar");
    const botonNo = document.getElementById("dialogo-cancelar");

    document.getElementById("dialogo-titulo").textContent = titulo;
    document.getElementById("dialogo-mensaje").innerHTML =
      mensajeHtml !== null ? mensajeHtml : "<p>" + this.escapar(mensaje) + "</p>";
    botonSi.textContent = textoConfirmar;
    botonNo.textContent = textoCancelar;
    botonSi.className = "boton " + (peligroso ? "boton-peligro" : "boton-principal");

    return new Promise((resolver) => {
      const terminar = (respuesta) => {
        dialogo.close();
        resolver(respuesta);
      };
      // Usamos "onclick =" (y no addEventListener) para que cada vez
      // reemplace al anterior y no se acumulen.
      botonSi.onclick = () => terminar(true);
      botonNo.onclick = () => terminar(false);
      // Tecla Escape = cancelar.
      dialogo.oncancel = (evento) => {
        evento.preventDefault();
        terminar(false);
      };

      dialogo.showModal();
      // El foco arranca en "Cancelar", la opción segura.
      botonNo.focus();
    });
  },

  /* ---------- Archivos ---------- */

  // Hace que el navegador descargue un archivo con el texto indicado.
  descargarArchivo(nombreArchivo, contenido) {
    const archivo = new Blob([contenido], { type: "application/json" });
    const direccion = URL.createObjectURL(archivo);
    const enlace = document.createElement("a");
    enlace.href = direccion;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    // Liberamos la memoria un rato después, cuando la descarga ya arrancó.
    setTimeout(() => URL.revokeObjectURL(direccion), 2000);
  },

  /* ---------- Formularios ---------- */

  // Opciones de una lista desplegable de notas (1 al 10).
  // textoVacio (opcional): agrega al principio una opción sin valor con ese texto
  // (ej: "Sin nota" o "Elegí…"). Si es null, no la agrega.
  opcionesNota(seleccionada, textoVacio = null) {
    let html = "";
    if (textoVacio) {
      html += '<option value=""' + (seleccionada === null ? " selected" : "") + ">" + this.escapar(textoVacio) + "</option>";
    }
    for (let nota = 1; nota <= 10; nota++) {
      html += '<option value="' + nota + '"' + (seleccionada === nota ? " selected" : "") + ">" + nota + "</option>";
    }
    return html;
  },

  // Muestra un mensaje de error en un párrafo <p class="error-campo" hidden>.
  // Si el mensaje es null, lo oculta.
  mostrarError(parrafo, mensaje) {
    if (!parrafo) return;
    if (mensaje) {
      parrafo.textContent = mensaje;
      parrafo.hidden = false;
    } else {
      parrafo.textContent = "";
      parrafo.hidden = true;
    }
  },

  /* ---------- Pantallas vacías ---------- */

  // Arma el cuadro que se muestra cuando todavía no hay datos.
  // boton (opcional): { texto, irA } — irA es el nombre de una pantalla, ej: "jugadores".
  htmlVacio({ icono = "", titulo, texto, boton = null }) {
    let html = '<div class="vacio">';
    if (icono) html += '<div class="vacio-icono" aria-hidden="true">' + icono + "</div>";
    html += "<h3>" + this.escapar(titulo) + "</h3>";
    html += "<p>" + this.escapar(texto) + "</p>";
    if (boton) {
      html += '<p><a class="boton boton-principal" href="#' + boton.irA + '">' + this.escapar(boton.texto) + "</a></p>";
    }
    html += "</div>";
    return html;
  },
};
