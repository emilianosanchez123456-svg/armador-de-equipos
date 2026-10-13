/* =========================================================
   cambios.js — Funciones que CAMBIAN los datos de jugadores y deportes:
   agregar un jugador, cambiar una nota, agregar una regla, etc.

   Todas reciben los datos como primer parámetro y los modifican.
   No tocan la pantalla ni guardan en el navegador: de eso se encarga
   quien las llama. Así se pueden probar fácil en tests.html.

   Todas las que pueden fallar devuelven:
     { ok: true, ... }                       si salió bien
     { ok: false, error: "mensaje simple" }  si no se pudo, con el motivo
   ========================================================= */

// Largo máximo de un nombre (de jugador, deporte o posición).
const LARGO_MAXIMO_NOMBRE = 40;

// Largo máximo del comentario de un partido.
const LARGO_MAXIMO_COMENTARIO = 500;

// Evaluaciones posibles de "qué tan parejo fue" un partido.
const EVALUACIONES = ["Parejo", "Algo desparejo", "Muy desparejo"];

const Cambios = {
  /* ---------- Ayudas generales ---------- */

  // Saca espacios de más: "  Juan   Pérez " → "Juan Pérez"
  limpiarNombre(texto) {
    return String(texto || "").trim().replace(/\s+/g, " ");
  },

  // Versión "para comparar": sin mayúsculas ni tildes.
  // Así "José", "jose" y "JOSE " se consideran el mismo nombre.
  normalizar(texto) {
    return this.limpiarNombre(texto)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  },

  // Revisa un nombre recién escrito. Devuelve el mensaje de error o null si está bien.
  // queEs: "el jugador", "el deporte", "la posición" (para armar el mensaje).
  problemaConNombre(nombre, queEs) {
    if (nombre === "") return "Escribí el nombre de " + queEs + ".";
    if (nombre.length > LARGO_MAXIMO_NOMBRE) {
      return "El nombre es muy largo. Usá como máximo " + LARGO_MAXIMO_NOMBRE + " letras.";
    }
    return null;
  },

  // Convierte lo elegido en una nota válida (entero del 1 al 10) o null si no lo es.
  leerNota(valor) {
    if (valor === "" || valor === null || valor === undefined) return null;
    const numero = Number(valor);
    if (!Number.isInteger(numero) || numero < 1 || numero > 10) return null;
    return numero;
  },

  buscarJugador(datos, jugadorId) {
    return datos.jugadores.find((j) => j.id === jugadorId) || null;
  },

  buscarDeporte(datos, deporteId) {
    return datos.deportes.find((d) => d.id === deporteId) || null;
  },

  // Nota de un jugador en un deporte, o null si no tiene.
  notaDe(jugador, deporteId) {
    const info = jugador.porDeporte[deporteId];
    return info && typeof info.nota === "number" ? info.nota : null;
  },

  // Posición clave de un jugador en un deporte, o null si no tiene.
  posicionDe(jugador, deporteId) {
    const info = jugador.porDeporte[deporteId];
    return info && info.posicion ? info.posicion : null;
  },

  // Devuelve una copia de la lista ordenada alfabéticamente por nombre.
  ordenarPorNombre(lista) {
    return lista.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  },

  // Busca en una lista algo con el mismo nombre (sin importar mayúsculas ni tildes).
  // exceptoId sirve para no compararse consigo mismo al renombrar.
  buscarNombreRepetido(lista, nombre, exceptoId = null) {
    const buscado = this.normalizar(nombre);
    return lista.find((x) => x.id !== exceptoId && this.normalizar(x.nombre) === buscado) || null;
  },

  /* ---------- Jugadores ---------- */

  // Agrega un jugador nuevo.
  // notas (opcional): { idDeporte: nota } con las notas iniciales.
  // posiciones (opcional): { idDeporte: "Arquero" } con la posición clave en cada deporte.
  agregarJugador(datos, nombreEscrito, notas = {}, posiciones = {}, fecha = new Date()) {
    const nombre = this.limpiarNombre(nombreEscrito);
    const problema = this.problemaConNombre(nombre, "el jugador");
    if (problema) return { ok: false, error: problema };

    const repetido = this.buscarNombreRepetido(datos.jugadores, nombre);
    if (repetido) {
      return {
        ok: false,
        error:
          'Ya hay un jugador llamado "' + repetido.nombre + '". ' +
          "Si es otra persona, agregale algo para diferenciarlos, como la inicial del apellido o un apodo.",
      };
    }

    // Revisamos todas las notas y posiciones antes de agregar nada.
    for (const deporteId of Object.keys(notas)) {
      if (!this.buscarDeporte(datos, deporteId)) return { ok: false, error: "No se encontró uno de los deportes elegidos." };
      if (this.leerNota(notas[deporteId]) === null) {
        return { ok: false, error: "Las notas tienen que ser números enteros del 1 al 10." };
      }
    }
    for (const deporteId of Object.keys(posiciones)) {
      const posicion = posiciones[deporteId];
      if (!posicion) continue;
      const deporte = this.buscarDeporte(datos, deporteId);
      if (!deporte || !deporte.posiciones.includes(posicion)) {
        return { ok: false, error: 'La posición "' + posicion + '" no existe en ese deporte.' };
      }
      if (notas[deporteId] === undefined) {
        return { ok: false, error: "Para elegir la posición en " + deporte.nombre + ", primero elegí la nota en ese deporte." };
      }
    }

    const jugador = { id: Datos.crearId("jug"), nombre, porDeporte: {} };
    datos.jugadores.push(jugador);
    for (const deporteId of Object.keys(notas)) {
      this.cambiarNota(datos, jugador.id, deporteId, notas[deporteId], "Nota inicial", fecha);
      if (posiciones[deporteId]) this.cambiarPosicion(datos, jugador.id, deporteId, posiciones[deporteId]);
    }
    return { ok: true, jugador };
  },

  // Cambia el nombre de un jugador. Los partidos viejos conservan el nombre que tenía.
  renombrarJugador(datos, jugadorId, nombreEscrito) {
    const jugador = this.buscarJugador(datos, jugadorId);
    if (!jugador) return { ok: false, error: "No se encontró ese jugador." };

    const nombre = this.limpiarNombre(nombreEscrito);
    const problema = this.problemaConNombre(nombre, "el jugador");
    if (problema) return { ok: false, error: problema };

    const repetido = this.buscarNombreRepetido(datos.jugadores, nombre, jugadorId);
    if (repetido) {
      return { ok: false, error: 'Ya hay otro jugador llamado "' + repetido.nombre + '". Elegí un nombre distinto.' };
    }

    jugador.nombre = nombre;
    return { ok: true };
  },

  // Cambia la nota de un jugador en un deporte.
  // La nota anterior NO se pisa: se agrega una entrada al historial con la fecha y el motivo.
  // Si la nota es igual a la que ya tenía, no hace nada (devuelve cambio: false).
  cambiarNota(datos, jugadorId, deporteId, notaElegida, motivo = "Cambio manual", fecha = new Date()) {
    const jugador = this.buscarJugador(datos, jugadorId);
    if (!jugador) return { ok: false, error: "No se encontró ese jugador." };
    if (!this.buscarDeporte(datos, deporteId)) return { ok: false, error: "No se encontró ese deporte." };

    const nota = this.leerNota(notaElegida);
    if (nota === null) return { ok: false, error: "La nota tiene que ser un número entero del 1 al 10." };

    // Si nunca tuvo nota en este deporte, creamos su lugar.
    if (!jugador.porDeporte[deporteId]) {
      jugador.porDeporte[deporteId] = { nota: null, posicion: null, historialNotas: [] };
    }
    const info = jugador.porDeporte[deporteId];

    if (info.nota === nota) return { ok: true, cambio: false };

    info.nota = nota;
    info.historialNotas.push({ nota, fecha: fecha.toISOString(), motivo });
    return { ok: true, cambio: true };
  },

  // Cambia la posición clave de un jugador en un deporte (null = ninguna).
  // Hace falta que el jugador ya tenga nota en ese deporte.
  cambiarPosicion(datos, jugadorId, deporteId, posicion) {
    const jugador = this.buscarJugador(datos, jugadorId);
    const deporte = this.buscarDeporte(datos, deporteId);
    if (!jugador || !deporte) return { ok: false, error: "No se encontró el jugador o el deporte." };

    const info = jugador.porDeporte[deporteId];
    if (posicion && (!info || info.nota === null)) {
      return {
        ok: false,
        error: "Para elegir la posición de " + jugador.nombre + " en " + deporte.nombre + ", primero ponele una nota en ese deporte.",
      };
    }
    if (posicion && !deporte.posiciones.includes(posicion)) {
      return { ok: false, error: deporte.nombre + ' no tiene la posición "' + posicion + '".' };
    }
    if (info) info.posicion = posicion || null;
    return { ok: true };
  },

  // Cuántas reglas (juntos/separados) incluyen a un jugador, en todos los deportes.
  contarReglasDeJugador(datos, jugadorId) {
    let cantidad = 0;
    datos.deportes.forEach((dep) => {
      cantidad += dep.reglas.filter((r) => r.jugadores.includes(jugadorId)).length;
    });
    return cantidad;
  },

  // Borra un jugador y las reglas donde aparece.
  // Los partidos viejos NO se tocan: guardan su propia copia del nombre y la nota.
  borrarJugador(datos, jugadorId) {
    const jugador = this.buscarJugador(datos, jugadorId);
    if (!jugador) return { ok: false, error: "No se encontró ese jugador." };

    const reglasBorradas = this.contarReglasDeJugador(datos, jugadorId);
    datos.deportes.forEach((dep) => {
      dep.reglas = dep.reglas.filter((r) => !r.jugadores.includes(jugadorId));
    });
    datos.jugadores = datos.jugadores.filter((j) => j.id !== jugadorId);
    return { ok: true, reglasBorradas };
  },

  /* ---------- Deportes ---------- */

  agregarDeporte(datos, nombreEscrito) {
    const nombre = this.limpiarNombre(nombreEscrito);
    const problema = this.problemaConNombre(nombre, "el deporte");
    if (problema) return { ok: false, error: problema };

    const repetido = this.buscarNombreRepetido(datos.deportes, nombre);
    if (repetido) return { ok: false, error: 'Ya existe el deporte "' + repetido.nombre + '".' };

    const deporte = { id: Datos.crearId("dep"), nombre, posiciones: [], reglas: [] };
    datos.deportes.push(deporte);
    return { ok: true, deporte };
  },

  renombrarDeporte(datos, deporteId, nombreEscrito) {
    const deporte = this.buscarDeporte(datos, deporteId);
    if (!deporte) return { ok: false, error: "No se encontró ese deporte." };

    const nombre = this.limpiarNombre(nombreEscrito);
    const problema = this.problemaConNombre(nombre, "el deporte");
    if (problema) return { ok: false, error: problema };

    const repetido = this.buscarNombreRepetido(datos.deportes, nombre, deporteId);
    if (repetido) return { ok: false, error: 'Ya existe el deporte "' + repetido.nombre + '".' };

    deporte.nombre = nombre;
    return { ok: true };
  },

  // Cuántos partidos del historial son de un deporte.
  contarPartidosDeDeporte(datos, deporteId) {
    return datos.partidos.filter((p) => p.deporteId === deporteId).length;
  },

  // Revisa si un deporte se puede borrar. Devuelve el motivo si NO se puede, o null si se puede.
  // No se puede si tiene partidos guardados (se perderían) o si es el último.
  problemaParaBorrarDeporte(datos, deporteId) {
    const deporte = this.buscarDeporte(datos, deporteId);
    if (!deporte) return "No se encontró ese deporte.";
    if (datos.deportes.length === 1) return "Tiene que quedar al menos un deporte.";

    const partidos = this.contarPartidosDeDeporte(datos, deporteId);
    if (partidos > 0) {
      return (
        deporte.nombre + " tiene " + partidos + (partidos === 1 ? " partido guardado" : " partidos guardados") +
        " en el historial, así que no se puede borrar (se perderían). Si no lo usan más, podés dejarlo sin problema."
      );
    }
    return null;
  },

  // Cuántos jugadores tienen nota en un deporte.
  contarJugadoresDeDeporte(datos, deporteId) {
    return datos.jugadores.filter((j) => this.notaDe(j, deporteId) !== null).length;
  },

  // Borra un deporte y las notas que tenían los jugadores en él.
  borrarDeporte(datos, deporteId) {
    const problema = this.problemaParaBorrarDeporte(datos, deporteId);
    if (problema) return { ok: false, error: problema };

    datos.jugadores.forEach((j) => {
      delete j.porDeporte[deporteId];
    });
    datos.deportes = datos.deportes.filter((d) => d.id !== deporteId);
    return { ok: true };
  },

  agregarPosicion(datos, deporteId, nombreEscrito) {
    const deporte = this.buscarDeporte(datos, deporteId);
    if (!deporte) return { ok: false, error: "No se encontró ese deporte." };

    const nombre = this.limpiarNombre(nombreEscrito);
    const problema = this.problemaConNombre(nombre, "la posición");
    if (problema) return { ok: false, error: problema };

    const repetida = deporte.posiciones.find((p) => this.normalizar(p) === this.normalizar(nombre));
    if (repetida) return { ok: false, error: deporte.nombre + ' ya tiene la posición "' + repetida + '".' };

    deporte.posiciones.push(nombre);
    return { ok: true };
  },

  // Cuántos jugadores tienen una posición en un deporte.
  contarJugadoresConPosicion(datos, deporteId, posicion) {
    return datos.jugadores.filter((j) => this.posicionDe(j, deporteId) === posicion).length;
  },

  // Quita una posición de un deporte. Los jugadores que la tenían quedan sin posición.
  quitarPosicion(datos, deporteId, posicion) {
    const deporte = this.buscarDeporte(datos, deporteId);
    if (!deporte) return { ok: false, error: "No se encontró ese deporte." };

    deporte.posiciones = deporte.posiciones.filter((p) => p !== posicion);
    let jugadoresAfectados = 0;
    datos.jugadores.forEach((j) => {
      const info = j.porDeporte[deporteId];
      if (info && info.posicion === posicion) {
        info.posicion = null;
        jugadoresAfectados++;
      }
    });
    return { ok: true, jugadoresAfectados };
  },

  // Agrega una regla "siempre juntos" o "siempre separados" entre dos jugadores.
  agregarRegla(datos, deporteId, tipo, jugadorA, jugadorB) {
    const deporte = this.buscarDeporte(datos, deporteId);
    if (!deporte) return { ok: false, error: "No se encontró ese deporte." };
    if (tipo !== "juntos" && tipo !== "separados") return { ok: false, error: "Elegí si van juntos o separados." };

    const a = this.buscarJugador(datos, jugadorA);
    const b = this.buscarJugador(datos, jugadorB);
    if (!a || !b) return { ok: false, error: "Elegí los dos jugadores de la regla." };
    if (a.id === b.id) return { ok: false, error: "Elegí dos jugadores distintos." };

    // Solo una regla por pareja (en cualquier orden).
    const existente = deporte.reglas.find((r) => r.jugadores.includes(a.id) && r.jugadores.includes(b.id));
    if (existente) {
      return {
        ok: false,
        error: a.nombre + " y " + b.nombre + " ya tienen una regla (siempre " + existente.tipo + "). Si querés cambiarla, quitá esa primero.",
      };
    }

    const regla = { id: Datos.crearId("reg"), tipo, jugadores: [a.id, b.id] };
    deporte.reglas.push(regla);
    return { ok: true, regla };
  },

  // Busca un jugador por nombre (sin importar mayúsculas, tildes ni espacios de más).
  buscarJugadorPorNombre(datos, nombre) {
    return this.buscarNombreRepetido(datos.jugadores, nombre);
  },

  // Igual que agregarRegla, pero recibe los NOMBRES escritos en vez de los ids.
  // Sirve para el formulario donde se escriben los nombres con sugerencias.
  agregarReglaPorNombres(datos, deporteId, tipo, nombreA, nombreB) {
    const escritos = [this.limpiarNombre(nombreA), this.limpiarNombre(nombreB)];
    if (escritos[0] === "" || escritos[1] === "") {
      return { ok: false, error: "Escribí el nombre de los dos jugadores." };
    }
    const ids = [];
    for (const nombre of escritos) {
      const jugador = this.buscarJugadorPorNombre(datos, nombre);
      if (!jugador) {
        return {
          ok: false,
          error: 'No hay ningún jugador llamado "' + nombre + '". Revisá cómo está escrito o agregalo en la pantalla Jugadores.',
        };
      }
      ids.push(jugador.id);
    }
    return this.agregarRegla(datos, deporteId, tipo, ids[0], ids[1]);
  },

  /* ---------- Para la pantalla "Armar equipos" ---------- */

  // Texto con las notas de un jugador en los OTROS deportes, como referencia.
  // Ej: "En Vóley tiene 7." — o "" si no tiene nota en ningún otro.
  textoNotasEnOtros(datos, jugador, deporteId) {
    const partes = [];
    datos.deportes.forEach((dep) => {
      const nota = this.notaDe(jugador, dep.id);
      if (dep.id !== deporteId && nota !== null) partes.push("en " + dep.nombre + " tiene " + nota);
    });
    if (partes.length === 0) return "";
    const texto = partes.length === 1 ? partes[0] : partes.slice(0, -1).join(", ") + " y " + partes[partes.length - 1];
    return texto.charAt(0).toUpperCase() + texto.slice(1) + ".";
  },

  // Suma a alguien al deporte desde "Armar equipos", escribiendo su nombre:
  // - Si no existe: lo crea con la nota (y posición) elegida.
  // - Si existe pero no tiene nota en este deporte: le pone la nota elegida (y pide que la elijan si falta).
  // - Si existe y ya tiene nota: no cambia nada (después se puede ajustar en la lista).
  // Devuelve { ok, jugador, caso: "nuevo" | "nota-nueva" | "ya-estaba" } o { ok: false, error }.
  sumarJugadorAlDeporte(datos, nombreEscrito, deporteId, notaElegida, posicion = null, fecha = new Date()) {
    const deporte = this.buscarDeporte(datos, deporteId);
    if (!deporte) return { ok: false, error: "No se encontró ese deporte." };

    const nombre = this.limpiarNombre(nombreEscrito);
    const problema = this.problemaConNombre(nombre, "el jugador");
    if (problema) return { ok: false, error: problema };

    const nota = this.leerNota(notaElegida);
    const existente = this.buscarJugadorPorNombre(datos, nombre);

    if (existente) {
      if (this.notaDe(existente, deporteId) !== null) return { ok: true, jugador: existente, caso: "ya-estaba" };
      if (nota === null) {
        const referencia = this.textoNotasEnOtros(datos, existente, deporteId);
        return {
          ok: false,
          error:
            existente.nombre + " ya está cargado pero no tiene nota en " + deporte.nombre + "." +
            (referencia ? " " + referencia : "") + " Elegí su nota.",
        };
      }
      this.cambiarNota(datos, existente.id, deporteId, nota, "Nota inicial", fecha);
      if (posicion) this.cambiarPosicion(datos, existente.id, deporteId, posicion);
      return { ok: true, jugador: existente, caso: "nota-nueva" };
    }

    if (nota === null) return { ok: false, error: "Elegí la nota de " + nombre + " en " + deporte.nombre + "." };
    const resultado = this.agregarJugador(datos, nombre, { [deporteId]: nota }, posicion ? { [deporteId]: posicion } : {}, fecha);
    if (!resultado.ok) return resultado;
    return { ok: true, jugador: resultado.jugador, caso: "nuevo" };
  },

  // Guarda un partido en el historial a partir de una combinación de Balanceo.
  // Guarda una COPIA del nombre, nota y posición de cada jugador en ese momento,
  // así el partido no cambia aunque después se edite o borre al jugador.
  crearPartido(datos, deporteId, combinacion, fecha = new Date()) {
    const partido = {
      id: Datos.crearId("par"),
      fecha: fecha.toISOString(),
      deporteId,
      equipos: combinacion.equipos.map((equipo, i) => ({
        nombre: "Equipo " + (i + 1),
        jugadores: equipo.jugadores.map((j) => ({
          jugadorId: j.id,
          nombre: j.nombre,
          nota: j.nota,
          posicion: j.posicion || null,
        })),
        total: equipo.total,
        promedio: equipo.promedio,
      })),
      diferencia: combinacion.diferencia,
      mismaCantidad: combinacion.mismaCantidad,
      resultado: null, // se carga después: un número por equipo
      evaluacion: null, // "Parejo", "Algo desparejo" o "Muy desparejo"
      comentario: "",
    };
    datos.partidos.push(partido);
    return partido;
  },

  /* ---------- Historial de partidos ---------- */

  buscarPartido(datos, partidoId) {
    return datos.partidos.find((p) => p.id === partidoId) || null;
  },

  // Fecha guardada → texto para un campo de fecha: "2026-10-13" (fecha local).
  fechaParaCampo(textoFecha) {
    const f = new Date(textoFecha);
    const dos = (n) => String(n).padStart(2, "0");
    return f.getFullYear() + "-" + dos(f.getMonth() + 1) + "-" + dos(f.getDate());
  },

  // Texto de un campo de fecha ("2026-10-13") → fecha guardable, conservando la hora anterior.
  // Devuelve null si la fecha no es válida.
  leerFechaDeCampo(texto, fechaAnterior) {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto || ""));
    if (!partes) return null;
    const anterior = new Date(fechaAnterior);
    const anio = Number(partes[1]);
    const mes = Number(partes[2]) - 1;
    const dia = Number(partes[3]);
    const nueva = new Date(anio, mes, dia, anterior.getHours() || 12, anterior.getMinutes());
    if (nueva.getFullYear() !== anio || nueva.getMonth() !== mes || nueva.getDate() !== dia) return null;
    return nueva.toISOString();
  },

  // Revisa el resultado escrito (un valor por equipo).
  // - Todos vacíos → sin resultado (null).
  // - Todos con números enteros de 0 en adelante → la lista de números.
  // - Algunos vacíos o algo que no es número → error.
  leerResultado(valores, cantidadEquipos) {
    const textos = valores.map((v) => String(v === null || v === undefined ? "" : v).trim());
    if (textos.length !== cantidadEquipos) return { error: "Falta el resultado de algún equipo." };
    if (textos.every((t) => t === "")) return { valor: null };
    if (textos.some((t) => t === "")) {
      return { error: "Completá el resultado de todos los equipos (o dejalos todos vacíos si todavía no se jugó)." };
    }
    const numeros = textos.map(Number);
    if (numeros.some((n) => !Number.isInteger(n) || n < 0 || n > 999)) {
      return { error: "El resultado tiene que ser un número entero, de 0 en adelante (goles, puntos o sets)." };
    }
    return { valor: numeros };
  },

  // Vuelve a calcular total, promedio y diferencia de un partido (después de mover jugadores).
  recalcularPartido(partido) {
    partido.equipos.forEach((equipo) => {
      // De mayor a menor nota, igual que al armar los equipos.
      equipo.jugadores.sort((x, y) => y.nota - x.nota || x.nombre.localeCompare(y.nombre, "es"));
      equipo.total = equipo.jugadores.reduce((s, j) => s + j.nota, 0);
      equipo.promedio = Math.round((equipo.total / equipo.jugadores.length) * 100) / 100;
    });
    const totales = partido.equipos.map((e) => e.total);
    partido.diferencia = Math.max(...totales) - Math.min(...totales);
    partido.mismaCantidad = partido.equipos.every((e) => e.jugadores.length === partido.equipos[0].jugadores.length);
  },

  // Edita un partido. "cambios" puede tener (todo opcional):
  //   fecha: "2026-10-13"
  //   resultado: ["3", "2"]  (un valor por equipo; todos vacíos = sin resultado)
  //   evaluacion: "Parejo" | "Algo desparejo" | "Muy desparejo" | null
  //   comentario: "texto"
  //   asignacion: { idJugador: número de equipo (0, 1...) o -1 si no jugó }
  // Revisa todo antes de cambiar nada.
  editarPartido(datos, partidoId, cambios) {
    const partido = this.buscarPartido(datos, partidoId);
    if (!partido) return { ok: false, error: "No se encontró ese partido." };
    const cantidadEquipos = partido.equipos.length;

    // Fecha
    let fecha = partido.fecha;
    if (cambios.fecha !== undefined) {
      fecha = this.leerFechaDeCampo(cambios.fecha, partido.fecha);
      if (!fecha) return { ok: false, error: "La fecha no es válida. Elegila de nuevo." };
    }

    // Resultado
    let resultado = partido.resultado;
    if (cambios.resultado !== undefined) {
      const lectura = this.leerResultado(cambios.resultado, cantidadEquipos);
      if (lectura.error) return { ok: false, error: lectura.error };
      resultado = lectura.valor;
    }

    // Evaluación
    let evaluacion = partido.evaluacion;
    if (cambios.evaluacion !== undefined) {
      evaluacion = cambios.evaluacion || null;
      if (evaluacion !== null && !EVALUACIONES.includes(evaluacion)) {
        return { ok: false, error: "Elegí una evaluación de la lista." };
      }
    }

    // Comentario
    let comentario = partido.comentario;
    if (cambios.comentario !== undefined) {
      comentario = String(cambios.comentario).trim();
      if (comentario.length > LARGO_MAXIMO_COMENTARIO) {
        return { ok: false, error: "El comentario es muy largo. Usá como máximo " + LARGO_MAXIMO_COMENTARIO + " letras." };
      }
    }

    // Equipos (si alguien cambió de equipo o no jugó)
    let nuevosEquipos = null;
    if (cambios.asignacion) {
      const todos = partido.equipos.flatMap((e, i) => e.jugadores.map((j) => ({ jugador: j, equipoAnterior: i })));
      nuevosEquipos = partido.equipos.map((e) => ({ nombre: e.nombre, jugadores: [], total: 0, promedio: 0 }));
      todos.forEach(({ jugador, equipoAnterior }) => {
        const elegido = cambios.asignacion[jugador.jugadorId];
        const destino = elegido === undefined ? equipoAnterior : Number(elegido);
        if (destino >= 0 && destino < cantidadEquipos) nuevosEquipos[destino].jugadores.push(jugador);
      });
      const vacio = nuevosEquipos.find((e) => e.jugadores.length === 0);
      if (vacio) return { ok: false, error: vacio.nombre + " quedaría sin jugadores. Cada equipo tiene que tener al menos uno." };
    }

    // Todo bien: aplicamos los cambios.
    partido.fecha = fecha;
    partido.resultado = resultado;
    partido.evaluacion = evaluacion;
    partido.comentario = comentario;
    if (nuevosEquipos) {
      partido.equipos = nuevosEquipos;
      this.recalcularPartido(partido);
    }
    return { ok: true, partido };
  },

  borrarPartido(datos, partidoId) {
    if (!this.buscarPartido(datos, partidoId)) return { ok: false, error: "No se encontró ese partido." };
    datos.partidos = datos.partidos.filter((p) => p.id !== partidoId);
    return { ok: true };
  },

  // Quién ganó un partido. Devuelve null si no tiene resultado, o
  // { ganadores: [números de equipo con más puntos], empate: true/false }.
  ganadorDe(partido) {
    if (!partido.resultado) return null;
    const maximo = Math.max(...partido.resultado);
    const ganadores = [];
    partido.resultado.forEach((valor, i) => {
      if (valor === maximo) ganadores.push(i);
    });
    return { ganadores, empate: ganadores.length > 1 };
  },

  /* ---------- Sugerencias de notas ---------- */

  // Aceptar una sugerencia: cambia la nota y queda en el historial como "Sugerencia aceptada".
  aceptarSugerencia(datos, sugerencia, fecha = new Date()) {
    return this.cambiarNota(datos, sugerencia.jugadorId, sugerencia.deporteId, sugerencia.notaSugerida, "Sugerencia aceptada", fecha);
  },

  // Rechazar una sugerencia: la nota no cambia, y se anota la fecha para que
  // los partidos anteriores no vuelvan a generar la misma sugerencia.
  rechazarSugerencia(datos, sugerencia, fecha = new Date()) {
    const jugador = this.buscarJugador(datos, sugerencia.jugadorId);
    const info = jugador && jugador.porDeporte[sugerencia.deporteId];
    if (!info) return { ok: false, error: "No se encontró ese jugador o deporte." };
    info.sugerenciaRechazadaEl = fecha.toISOString();
    return { ok: true };
  },

  // El último partido guardado de un deporte (o null).
  ultimoPartido(datos, deporteId) {
    const delDeporte = datos.partidos.filter((p) => p.deporteId === deporteId);
    if (delDeporte.length === 0) return null;
    return delDeporte.reduce((ultimo, p) => (p.fecha > ultimo.fecha ? p : ultimo));
  },

  quitarRegla(datos, deporteId, reglaId) {
    const deporte = this.buscarDeporte(datos, deporteId);
    if (!deporte) return { ok: false, error: "No se encontró ese deporte." };
    deporte.reglas = deporte.reglas.filter((r) => r.id !== reglaId);
    return { ok: true };
  },
};
