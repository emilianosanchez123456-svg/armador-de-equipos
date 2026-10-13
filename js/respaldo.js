/* =========================================================
   respaldo.js — Botones "Exportar datos" e "Importar datos".

   Exportar: descarga un archivo .json con todos los datos.
   Importar: lee un archivo .json, lo revisa, pide confirmación,
             descarga automáticamente una copia de los datos actuales
             (por si el archivo era el equivocado) y recién ahí reemplaza.
   ========================================================= */

// Tamaño máximo de archivo que aceptamos (10 MB es muchísimo para estos datos).
const TAMANIO_MAXIMO_IMPORTAR = 10 * 1024 * 1024;

const Respaldo = {
  // Conecta los botones del encabezado con sus funciones.
  conectarBotones() {
    const selectorArchivo = document.getElementById("archivo-importar");

    document.getElementById("boton-exportar").addEventListener("click", () => this.exportar());

    document.getElementById("boton-importar").addEventListener("click", () => {
      // Limpiamos el valor para que funcione aunque se elija dos veces el mismo archivo.
      selectorArchivo.value = "";
      selectorArchivo.click();
    });

    selectorArchivo.addEventListener("change", () => {
      const archivo = selectorArchivo.files[0];
      if (archivo) this.importar(archivo);
    });
  },

  // Descarga todos los datos en un archivo.
  exportar() {
    const nombre = Datos.nombreArchivoRespaldo(new Date());
    UI.descargarArchivo(nombre, Datos.textoParaExportar(Datos.actuales));
    this.anotarRespaldo();
    UI.actualizarRecordatorios();
    UI.avisar(
      'Listo: se descargó el archivo "' + nombre + '". Guardalo en un lugar seguro, ' +
        'o abrilo en otro dispositivo con "Importar datos".'
    );
  },

  // Anota que los datos actuales ya tienen una copia (así no se recuerda exportar).
  anotarRespaldo() {
    Datos.guardarPreferencias({
      ultimaExportacion: new Date().toISOString(),
      primerCambioSinExportar: null,
      posponerRespaldoHasta: null,
    });
  },

  // Arma la descripción "3 deportes, 12 jugadores y 5 partidos".
  describir(resumen) {
    return (
      UI.plural(resumen.deportes, "deporte", "deportes") + ", " +
      UI.plural(resumen.jugadores, "jugador", "jugadores") + " y " +
      UI.plural(resumen.partidos, "partido", "partidos")
    );
  },

  // Importa un archivo elegido por la persona.
  // "async" significa que adentro podemos esperar cosas (leer el archivo,
  // esperar la respuesta de la confirmación) usando "await".
  async importar(archivo) {
    const errorGeneral =
      'Ese archivo no es un respaldo del Armador de Equipos. Elegí el archivo .json que descargaste con "Exportar datos".';

    if (archivo.size > TAMANIO_MAXIMO_IMPORTAR) {
      UI.avisar(errorGeneral, "error");
      return;
    }

    // 1) Leer el archivo
    let texto;
    try {
      texto = await archivo.text();
    } catch (error) {
      UI.avisar("No se pudo leer el archivo. Probá elegirlo de nuevo.", "error");
      return;
    }

    // 2) Convertir el texto en datos
    let nuevos;
    try {
      nuevos = JSON.parse(texto);
    } catch (error) {
      UI.avisar(errorGeneral, "error");
      return;
    }

    // 3) Revisar que tenga la forma correcta
    const revision = Datos.validar(nuevos);
    if (!revision.ok) {
      UI.avisar("No se puede importar este archivo. " + revision.errores[0], "error");
      return;
    }
    Datos.completar(nuevos);
    delete nuevos.exportadoEl; // dato informativo del archivo, no hace falta guardarlo

    // 4) Pedir confirmación mostrando qué se va a reemplazar
    const seguro = await UI.confirmar({
      titulo: "¿Reemplazar tus datos?",
      mensajeHtml:
        "<p>Los datos de este dispositivo se van a cambiar por los del archivo:</p>" +
        "<ul>" +
        "<li><strong>Ahora tenés:</strong> " + UI.escapar(this.describir(Datos.resumen(Datos.actuales))) + "</li>" +
        "<li><strong>El archivo trae:</strong> " + UI.escapar(this.describir(Datos.resumen(nuevos))) + "</li>" +
        "</ul>" +
        "<p>Por las dudas, antes de reemplazar se va a descargar una copia de tus datos actuales.</p>",
      textoConfirmar: "Sí, reemplazar",
      textoCancelar: "No, dejar todo como está",
      peligroso: true,
    });
    if (!seguro) {
      UI.avisar("No se cambió nada.", "info");
      return;
    }

    // 5) Copia automática de los datos actuales
    const nombreCopia = Datos.nombreArchivoCopia(new Date());
    UI.descargarArchivo(nombreCopia, Datos.textoParaExportar(Datos.actuales));

    // 6) Reemplazar, guardar y volver a dibujar la pantalla
    Datos.actuales = nuevos;
    UI.guardarCambios();
    this.anotarRespaldo(); // los datos nuevos vienen de un archivo: ya tienen copia
    UI.redibujar();
    UI.avisar(
      'Datos importados. Tus datos anteriores quedaron guardados en el archivo "' + nombreCopia +
        '", por si los necesitás.'
    );
  },
};
