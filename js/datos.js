/* =========================================================
   datos.js — Todo lo relacionado con los DATOS de la app:
   - cómo son al principio (Fútbol y Vóley cargados)
   - guardarlos y leerlos del navegador (localStorage)
   - revisar que un archivo de respaldo sea válido
   - preparar el texto y el nombre del archivo para exportar

   Este archivo NO toca la pantalla: solo maneja datos.

   FORMA DE LOS DATOS (resumen):
   {
     app: "armador-de-equipos",   // marca para reconocer nuestros archivos
     version: 1,
     deportes: [ { id, nombre, posiciones: ["Arquero"],
                   reglas: [ { id, tipo: "juntos" | "separados", jugadores: [idA, idB] } ] } ],
     jugadores: [ { id, nombre,
                    porDeporte: { idDeporte: { nota, posicion,
                                               historialNotas: [ { nota, fecha, motivo } ] } } } ],
     partidos: [ { id, fecha, deporteId, equipos: [...], resultado, evaluacion, comentario } ]
   }
   ========================================================= */

// Nombre con el que se guarda todo en el navegador.
const CLAVE_GUARDADO = "armadorEquipos.datos";

// Si algún día cambia la forma de los datos, se sube este número.
const VERSION_DATOS = 1;

// Marca que llevan nuestros datos y archivos de respaldo.
const MARCA_APP = "armador-de-equipos";

const Datos = {
  // Los datos que está usando la app en este momento.
  actuales: null,

  // Pasa a false si el navegador no deja guardar (ej: modo privado muy estricto).
  sePuedeGuardar: true,

  /* ---------- Funciones "puras" (no guardan nada, solo calculan) ---------- */

  // Crea un identificador único, ej: "jug-lq2x9a-k3f8d".
  // Usamos ids en vez de nombres para que cambiar un nombre no rompa nada.
  crearId(prefijo) {
    const tiempo = Date.now().toString(36);
    const azar = Math.random().toString(36).slice(2, 7);
    return prefijo + "-" + tiempo + "-" + azar;
  },

  // Datos con los que arranca la app la primera vez.
  crearDatosIniciales() {
    return {
      app: MARCA_APP,
      version: VERSION_DATOS,
      deportes: [
        { id: this.crearId("dep"), nombre: "Fútbol", posiciones: ["Arquero"], reglas: [] },
        { id: this.crearId("dep"), nombre: "Vóley", posiciones: ["Armador"], reglas: [] },
      ],
      jugadores: [],
      partidos: [],
    };
  },

  // Revisa si algo tiene la forma de nuestros datos.
  // Devuelve { ok: true/false, errores: [lista de problemas en lenguaje simple] }.
  validar(obj) {
    const errores = [];
    const esObjeto = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

    if (!esObjeto(obj) || obj.app !== MARCA_APP) {
      errores.push("El archivo no es un respaldo del Armador de Equipos.");
      return { ok: false, errores };
    }
    if (typeof obj.version !== "number" || obj.version > VERSION_DATOS) {
      errores.push("El archivo es de una versión más nueva de la app. Actualizá la app antes de importarlo.");
      return { ok: false, errores };
    }
    if (!Array.isArray(obj.deportes) || !Array.isArray(obj.jugadores) || !Array.isArray(obj.partidos)) {
      errores.push("Al archivo le faltan partes (deportes, jugadores o partidos). Puede estar incompleto o dañado.");
      return { ok: false, errores };
    }

    obj.deportes.forEach((dep, i) => {
      if (!esObjeto(dep) || typeof dep.id !== "string" || typeof dep.nombre !== "string") {
        errores.push("El deporte número " + (i + 1) + " está dañado.");
      }
    });
    obj.jugadores.forEach((jug, i) => {
      if (!esObjeto(jug) || typeof jug.id !== "string" || typeof jug.nombre !== "string") {
        errores.push("El jugador número " + (i + 1) + " está dañado.");
      }
    });
    obj.partidos.forEach((par, i) => {
      if (!esObjeto(par) || typeof par.id !== "string" || !Array.isArray(par.equipos)) {
        errores.push("El partido número " + (i + 1) + " está dañado.");
      }
    });

    // Los ids no se pueden repetir, porque se usan para encontrar cada cosa.
    const hayRepetidos = (lista) => {
      const ids = lista.filter(esObjeto).map((x) => x.id);
      return new Set(ids).size !== ids.length;
    };
    if (hayRepetidos(obj.deportes) || hayRepetidos(obj.jugadores) || hayRepetidos(obj.partidos)) {
      errores.push("El archivo tiene elementos repetidos. Puede estar dañado.");
    }

    return { ok: errores.length === 0, errores };
  },

  // Completa campos que puedan faltar (ej: un deporte sin lista de reglas).
  // Así el resto de la app puede confiar en que todo existe.
  // Ojo: modifica el objeto que recibe y lo devuelve.
  completar(obj) {
    obj.deportes.forEach((dep) => {
      if (!Array.isArray(dep.posiciones)) dep.posiciones = [];
      if (!Array.isArray(dep.reglas)) dep.reglas = [];
    });
    obj.jugadores.forEach((jug) => {
      if (jug.porDeporte === null || typeof jug.porDeporte !== "object") jug.porDeporte = {};
      Object.keys(jug.porDeporte).forEach((idDeporte) => {
        const info = jug.porDeporte[idDeporte];
        // Si una entrada está rota, la sacamos.
        if (info === null || typeof info !== "object") {
          delete jug.porDeporte[idDeporte];
          return;
        }
        if (!Array.isArray(info.historialNotas)) info.historialNotas = [];
        if (info.posicion === undefined) info.posicion = null;
      });
    });
    obj.partidos.forEach((par) => {
      if (par.resultado === undefined) par.resultado = null;
      if (par.evaluacion === undefined) par.evaluacion = null;
      if (par.comentario === undefined) par.comentario = "";
    });
    return obj;
  },

  // Cuenta cuántas cosas hay. Sirve para mostrar "12 jugadores, 4 partidos".
  resumen(datos) {
    return {
      deportes: datos.deportes.length,
      jugadores: datos.jugadores.length,
      partidos: datos.partidos.length,
    };
  },

  // Convierte los datos en el texto que va dentro del archivo .json.
  textoParaExportar(datos) {
    const copia = Object.assign({}, datos, { exportadoEl: new Date().toISOString() });
    return JSON.stringify(copia, null, 2);
  },

  // "2026-10-13" (usa la fecha local, no la de Greenwich)
  fechaCorta(fecha) {
    const dos = (n) => String(n).padStart(2, "0");
    return fecha.getFullYear() + "-" + dos(fecha.getMonth() + 1) + "-" + dos(fecha.getDate());
  },

  // Nombre del archivo que se descarga con "Exportar datos".
  // Ej: "armador-equipos-2026-10-13.json"
  nombreArchivoRespaldo(fecha) {
    return "armador-equipos-" + this.fechaCorta(fecha) + ".json";
  },

  // Nombre de la copia automática que se descarga antes de importar.
  // Lleva la hora para no confundirse con otras copias del mismo día.
  // Ej: "armador-equipos-copia-antes-de-importar-2026-10-13-1530.json"
  nombreArchivoCopia(fecha) {
    const dos = (n) => String(n).padStart(2, "0");
    const hora = dos(fecha.getHours()) + dos(fecha.getMinutes());
    return "armador-equipos-copia-antes-de-importar-" + this.fechaCorta(fecha) + "-" + hora + ".json";
  },

  /* ---------- Funciones que leen o escriben en el navegador ---------- */

  // Lee los datos guardados. Si es la primera vez, crea los iniciales.
  // Devuelve { aviso: null } si todo salió bien, o { aviso: "texto" } si hubo un problema.
  cargar() {
    let texto = null;
    try {
      texto = localStorage.getItem(CLAVE_GUARDADO);
    } catch (error) {
      // El navegador no deja usar localStorage.
      this.sePuedeGuardar = false;
      this.actuales = this.crearDatosIniciales();
      return {
        aviso:
          "Este navegador no permite guardar datos, así que lo que cargues se va a perder al cerrar la página. " +
          "Probá abrir la app con otro navegador (por ejemplo Chrome) o fuera del modo incógnito.",
      };
    }

    // Primera vez que se abre la app.
    if (texto === null) {
      this.actuales = this.crearDatosIniciales();
      this.guardar(false); // false: no cuenta como "cambio sin respaldar"
      return { aviso: null };
    }

    try {
      const obj = JSON.parse(texto);
      const revision = this.validar(obj);
      if (!revision.ok) throw new Error(revision.errores.join(" "));
      this.actuales = this.completar(obj);
      return { aviso: null };
    } catch (error) {
      // Los datos guardados están dañados. Guardamos una copia aparte
      // (para no perderlos del todo) y empezamos de cero.
      try {
        localStorage.setItem(CLAVE_GUARDADO + ".danado." + Date.now(), texto);
      } catch (e) {
        // Si tampoco se puede guardar la copia, seguimos igual.
      }
      this.actuales = this.crearDatosIniciales();
      this.guardar();
      return {
        aviso:
          "Los datos guardados estaban dañados y no se pudieron leer, así que la app empezó de cero. " +
          "Si tenés un archivo de respaldo, usá \"Importar datos\" para recuperarlos.",
      };
    }
  },

  // Cuántas veces se guardó desde que se abrió la app.
  // Sirve para "Deshacer": si hubo otro cambio después, ya no se puede deshacer.
  contadorCambios: 0,

  // Guarda los datos actuales en el navegador. Devuelve true si salió bien.
  // anotarCambio: si es true, recuerda que hay cambios sin respaldar (para el recordatorio).
  guardar(anotarCambio = true) {
    if (!this.sePuedeGuardar) return false;
    try {
      localStorage.setItem(CLAVE_GUARDADO, JSON.stringify(this.actuales));
      this.contadorCambios++;
      if (anotarCambio && !this.leerPreferencias().primerCambioSinExportar) {
        this.guardarPreferencias({ primerCambioSinExportar: new Date().toISOString() });
      }
      return true;
    } catch (error) {
      // Por ejemplo: el navegador se quedó sin espacio.
      return false;
    }
  },

  /* ---------- Preferencias de este dispositivo ----------
     Cosas que NO son datos del grupo (no se exportan): si ya se vio la guía,
     cuándo se exportó por última vez, etc. Se guardan aparte. */

  leerPreferencias() {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_PREFERENCIAS)) || {};
    } catch (error) {
      return {};
    }
  },

  guardarPreferencias(cambios) {
    const preferencias = Object.assign(this.leerPreferencias(), cambios);
    try {
      localStorage.setItem(CLAVE_PREFERENCIAS, JSON.stringify(preferencias));
    } catch (error) {
      // Si no se puede guardar, no pasa nada grave: solo se volverá a mostrar algún aviso.
    }
    return preferencias;
  },

  // ¿Hay que recordar que exporten una copia?
  // Sí, si hay cambios sin respaldar desde hace DIAS_RECORDAR_RESPALDO días o más
  // (y no tocaron "Recordármelo más tarde" hace poco).
  hayQueRecordarRespaldo(preferencias, ahora) {
    if (!preferencias.primerCambioSinExportar) return false;
    if (preferencias.posponerRespaldoHasta && ahora < new Date(preferencias.posponerRespaldoHasta)) return false;
    const dias = (ahora - new Date(preferencias.primerCambioSinExportar)) / (24 * 60 * 60 * 1000);
    return dias >= DIAS_RECORDAR_RESPALDO;
  },
};

// Dónde se guardan las preferencias de este dispositivo.
const CLAVE_PREFERENCIAS = "armadorEquipos.preferencias";

// Cada cuántos días con cambios sin exportar se recuerda hacer una copia.
const DIAS_RECORDAR_RESPALDO = 14;

// Si tocan "Recordármelo más tarde", se vuelve a recordar después de estos días.
const DIAS_POSPONER_RESPALDO = 3;
