/* =========================================================
   tests.js — Pruebas automáticas. Se ven abriendo tests.html.

   Cómo se escribe una prueba:
     prueba("descripción de lo que debería pasar", () => {
       esperarIgual(valorReal, valorEsperado);
     });
   Si algo no da lo esperado, la prueba aparece en rojo con el detalle.
   ========================================================= */

/* ---------- Mini sistema de pruebas ---------- */

const resultadosPruebas = []; // { grupo, nombre, paso, detalle }
let grupoActual = "General";

// Agrupa las pruebas que siguen bajo un título.
function grupo(nombre) {
  grupoActual = nombre;
}

// Corre una prueba y anota si pasó o falló.
function prueba(nombre, funcion) {
  try {
    funcion();
    resultadosPruebas.push({ grupo: grupoActual, nombre, paso: true, detalle: "" });
  } catch (error) {
    resultadosPruebas.push({ grupo: grupoActual, nombre, paso: false, detalle: error.message });
  }
}

// Falla si los dos valores no son iguales (compara también listas y objetos).
function esperarIgual(real, esperado) {
  const textoReal = JSON.stringify(real);
  const textoEsperado = JSON.stringify(esperado);
  if (textoReal !== textoEsperado) {
    throw new Error("Se esperaba: " + textoEsperado + "\nPero dio:    " + textoReal);
  }
}

// Falla si la condición no se cumple.
function esperarQue(condicion, mensaje) {
  if (!condicion) throw new Error(mensaje || "La condición no se cumplió");
}

/* ---------- Pruebas de datos.js ---------- */

grupo("Datos iniciales");

prueba("Arranca con Fútbol y Vóley", () => {
  const datos = Datos.crearDatosIniciales();
  esperarIgual(datos.deportes.map((d) => d.nombre), ["Fútbol", "Vóley"]);
});

prueba("Fútbol trae la posición Arquero y Vóley la posición Armador", () => {
  const datos = Datos.crearDatosIniciales();
  esperarIgual(datos.deportes[0].posiciones, ["Arquero"]);
  esperarIgual(datos.deportes[1].posiciones, ["Armador"]);
});

prueba("Arranca sin jugadores ni partidos", () => {
  const datos = Datos.crearDatosIniciales();
  esperarIgual(Datos.resumen(datos), { deportes: 2, jugadores: 0, partidos: 0 });
});

prueba("Los ids creados no se repiten", () => {
  const ids = new Set();
  for (let i = 0; i < 500; i++) ids.add(Datos.crearId("x"));
  esperarIgual(ids.size, 500);
});

grupo("Revisión de archivos (validar)");

prueba("Acepta los datos iniciales", () => {
  esperarIgual(Datos.validar(Datos.crearDatosIniciales()).ok, true);
});

prueba("Rechaza algo que no es un objeto", () => {
  esperarIgual(Datos.validar(null).ok, false);
  esperarIgual(Datos.validar([1, 2, 3]).ok, false);
  esperarIgual(Datos.validar("hola").ok, false);
});

prueba("Rechaza un JSON de otra app (sin nuestra marca)", () => {
  const revision = Datos.validar({ deportes: [], jugadores: [], partidos: [] });
  esperarIgual(revision.ok, false);
  esperarQue(revision.errores[0].includes("no es un respaldo"), "El mensaje debería explicar que no es un respaldo");
});

prueba("Rechaza un archivo de una versión más nueva", () => {
  const datos = Datos.crearDatosIniciales();
  datos.version = VERSION_DATOS + 1;
  const revision = Datos.validar(datos);
  esperarIgual(revision.ok, false);
  esperarQue(revision.errores[0].includes("versión más nueva"), "El mensaje debería hablar de la versión");
});

prueba("Rechaza si falta la lista de jugadores", () => {
  const datos = Datos.crearDatosIniciales();
  delete datos.jugadores;
  esperarIgual(Datos.validar(datos).ok, false);
});

prueba("Rechaza un jugador sin nombre", () => {
  const datos = Datos.crearDatosIniciales();
  datos.jugadores.push({ id: "j1", porDeporte: {} });
  esperarIgual(Datos.validar(datos).ok, false);
});

prueba("Rechaza ids repetidos", () => {
  const datos = Datos.crearDatosIniciales();
  datos.jugadores.push({ id: "j1", nombre: "Ana", porDeporte: {} });
  datos.jugadores.push({ id: "j1", nombre: "Beto", porDeporte: {} });
  esperarIgual(Datos.validar(datos).ok, false);
});

grupo("Completar datos incompletos");

prueba("Agrega listas que falten en deportes y jugadores", () => {
  const datos = {
    app: MARCA_APP,
    version: 1,
    deportes: [{ id: "d1", nombre: "Handball" }],
    jugadores: [{ id: "j1", nombre: "Ana", porDeporte: { d1: { nota: 7 } } }],
    partidos: [{ id: "p1", deporteId: "d1", equipos: [] }],
  };
  Datos.completar(datos);
  esperarIgual(datos.deportes[0].posiciones, []);
  esperarIgual(datos.deportes[0].reglas, []);
  esperarIgual(datos.jugadores[0].porDeporte.d1.historialNotas, []);
  esperarIgual(datos.jugadores[0].porDeporte.d1.posicion, null);
  esperarIgual(datos.partidos[0].resultado, null);
});

prueba("Saca entradas de deporte dañadas de un jugador", () => {
  const datos = Datos.crearDatosIniciales();
  datos.jugadores.push({ id: "j1", nombre: "Ana", porDeporte: { d1: null, d2: { nota: 5 } } });
  Datos.completar(datos);
  esperarIgual(Object.keys(datos.jugadores[0].porDeporte), ["d2"]);
});

grupo("Nombres de archivo");

prueba("El respaldo se llama armador-equipos-AAAA-MM-DD.json", () => {
  const fecha = new Date(2026, 9, 3, 15, 7); // 3 de octubre de 2026, 15:07 (los meses arrancan en 0)
  esperarIgual(Datos.nombreArchivoRespaldo(fecha), "armador-equipos-2026-10-03.json");
});

prueba("La copia antes de importar lleva fecha y hora", () => {
  const fecha = new Date(2026, 9, 3, 15, 7);
  esperarIgual(Datos.nombreArchivoCopia(fecha), "armador-equipos-copia-antes-de-importar-2026-10-03-1507.json");
});

prueba("Exportar y volver a leer da los mismos datos", () => {
  const datos = Datos.crearDatosIniciales();
  datos.jugadores.push({ id: "j1", nombre: "Ana", porDeporte: {} });
  const leido = JSON.parse(Datos.textoParaExportar(datos));
  esperarIgual(Datos.validar(leido).ok, true);
  esperarIgual(leido.jugadores, datos.jugadores);
  esperarIgual(leido.deportes, datos.deportes);
});

/* ---------- Pruebas de cambios.js ---------- */

// Arma datos de prueba: los deportes iniciales y una forma fácil de obtener sus ids.
function datosDePrueba() {
  const datos = Datos.crearDatosIniciales();
  const futbol = datos.deportes[0].id;
  const voley = datos.deportes[1].id;
  return { datos, futbol, voley };
}

grupo("Nombres");

prueba("Limpia espacios de más", () => {
  esperarIgual(Cambios.limpiarNombre("  Juan    Pérez  "), "Juan Pérez");
});

prueba("Para comparar, ignora mayúsculas y tildes", () => {
  esperarIgual(Cambios.normalizar(" JOSÉ  María "), "jose maria");
});

grupo("Notas");

prueba("Acepta solo enteros del 1 al 10", () => {
  esperarIgual(Cambios.leerNota("7"), 7);
  esperarIgual(Cambios.leerNota(1), 1);
  esperarIgual(Cambios.leerNota(10), 10);
  esperarIgual(Cambios.leerNota(0), null);
  esperarIgual(Cambios.leerNota(11), null);
  esperarIgual(Cambios.leerNota("7.5"), null);
  esperarIgual(Cambios.leerNota("hola"), null);
  esperarIgual(Cambios.leerNota(""), null);
});

prueba("La primera nota queda en el historial como 'Nota inicial'", () => {
  const { datos, futbol } = datosDePrueba();
  const { jugador } = Cambios.agregarJugador(datos, "Ana", { [futbol]: 8 });
  esperarIgual(Cambios.notaDe(jugador, futbol), 8);
  esperarIgual(jugador.porDeporte[futbol].historialNotas.map((h) => [h.nota, h.motivo]), [[8, "Nota inicial"]]);
});

prueba("Cambiar la nota NO pisa la anterior: se agrega al historial", () => {
  const { datos, futbol } = datosDePrueba();
  const { jugador } = Cambios.agregarJugador(datos, "Ana", { [futbol]: 8 });
  Cambios.cambiarNota(datos, jugador.id, futbol, 6, "Cambio manual", new Date(2026, 9, 20));
  esperarIgual(Cambios.notaDe(jugador, futbol), 6);
  esperarIgual(jugador.porDeporte[futbol].historialNotas.map((h) => h.nota), [8, 6]);
});

prueba("Poner la misma nota que ya tenía no agrega nada al historial", () => {
  const { datos, futbol } = datosDePrueba();
  const { jugador } = Cambios.agregarJugador(datos, "Ana", { [futbol]: 8 });
  const resultado = Cambios.cambiarNota(datos, jugador.id, futbol, 8);
  esperarIgual(resultado.cambio, false);
  esperarIgual(jugador.porDeporte[futbol].historialNotas.length, 1);
});

prueba("Cada deporte tiene su propia nota", () => {
  const { datos, futbol, voley } = datosDePrueba();
  const { jugador } = Cambios.agregarJugador(datos, "Ana", { [futbol]: 10, [voley]: 3 });
  esperarIgual([Cambios.notaDe(jugador, futbol), Cambios.notaDe(jugador, voley)], [10, 3]);
});

prueba("Un jugador puede no tener nota en un deporte", () => {
  const { datos, futbol, voley } = datosDePrueba();
  const { jugador } = Cambios.agregarJugador(datos, "Ana", { [futbol]: 7 });
  esperarIgual(Cambios.notaDe(jugador, voley), null);
});

prueba("Rechaza una nota inválida", () => {
  const { datos, futbol } = datosDePrueba();
  const { jugador } = Cambios.agregarJugador(datos, "Ana");
  esperarIgual(Cambios.cambiarNota(datos, jugador.id, futbol, 11).ok, false);
  esperarIgual(Cambios.agregarJugador(datos, "Beto", { [futbol]: 0 }).ok, false);
  esperarIgual(datos.jugadores.length, 1); // Beto no se agregó
});

grupo("Jugadores");

prueba("No deja agregar un nombre repetido (aunque cambien mayúsculas o tildes)", () => {
  const { datos } = datosDePrueba();
  Cambios.agregarJugador(datos, "José");
  const resultado = Cambios.agregarJugador(datos, "  jose ");
  esperarIgual(resultado.ok, false);
  esperarQue(resultado.error.includes("Ya hay un jugador"), "El mensaje debería avisar que ya existe");
  esperarIgual(datos.jugadores.length, 1);
});

prueba("No deja agregar un jugador sin nombre", () => {
  const { datos } = datosDePrueba();
  esperarIgual(Cambios.agregarJugador(datos, "   ").ok, false);
});

prueba("Renombrar a un nombre que ya usa otro jugador da error", () => {
  const { datos } = datosDePrueba();
  Cambios.agregarJugador(datos, "Ana");
  const beto = Cambios.agregarJugador(datos, "Beto").jugador;
  esperarIgual(Cambios.renombrarJugador(datos, beto.id, "ANA").ok, false);
  esperarIgual(beto.nombre, "Beto");
});

prueba("Renombrar cambiando solo mayúsculas del propio nombre está permitido", () => {
  const { datos } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "ana").jugador;
  esperarIgual(Cambios.renombrarJugador(datos, ana.id, "Ana").ok, true);
  esperarIgual(ana.nombre, "Ana");
});

prueba("Posición: necesita nota en ese deporte y que la posición exista", () => {
  const { datos, futbol, voley } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana", { [futbol]: 7 }).jugador;
  esperarIgual(Cambios.cambiarPosicion(datos, ana.id, futbol, "Arquero").ok, true);
  esperarIgual(Cambios.posicionDe(ana, futbol), "Arquero");
  esperarIgual(Cambios.cambiarPosicion(datos, ana.id, voley, "Armador").ok, false); // sin nota en vóley
  esperarIgual(Cambios.cambiarPosicion(datos, ana.id, futbol, "Delantero").ok, false); // no existe
});

prueba("Borrar un jugador saca también sus reglas", () => {
  const { datos, futbol } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana").jugador;
  const beto = Cambios.agregarJugador(datos, "Beto").jugador;
  const caro = Cambios.agregarJugador(datos, "Caro").jugador;
  Cambios.agregarRegla(datos, futbol, "separados", ana.id, beto.id);
  Cambios.agregarRegla(datos, futbol, "juntos", beto.id, caro.id);
  const resultado = Cambios.borrarJugador(datos, beto.id);
  esperarIgual(resultado.reglasBorradas, 2);
  esperarIgual(datos.deportes[0].reglas.length, 0);
  esperarIgual(datos.jugadores.map((j) => j.nombre), ["Ana", "Caro"]);
});

prueba("Borrar un jugador no toca los partidos guardados", () => {
  const { datos, futbol } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana", { [futbol]: 7 }).jugador;
  datos.partidos.push({
    id: "p1", deporteId: futbol, fecha: "2026-10-01T20:00:00.000Z",
    equipos: [{ nombre: "Equipo 1", jugadores: [{ jugadorId: ana.id, nombre: "Ana", nota: 7 }] }],
  });
  Cambios.borrarJugador(datos, ana.id);
  esperarIgual(datos.partidos[0].equipos[0].jugadores[0].nombre, "Ana");
});

grupo("Deportes y posiciones");

prueba("Agregar un deporte nuevo (arranca sin posiciones ni reglas)", () => {
  const { datos } = datosDePrueba();
  const { deporte } = Cambios.agregarDeporte(datos, "Básquet");
  esperarIgual([deporte.nombre, deporte.posiciones, deporte.reglas], ["Básquet", [], []]);
});

prueba("No deja repetir un deporte", () => {
  const { datos } = datosDePrueba();
  esperarIgual(Cambios.agregarDeporte(datos, "futbol").ok, false);
});

prueba("No deja repetir una posición en el mismo deporte", () => {
  const { datos, futbol } = datosDePrueba();
  esperarIgual(Cambios.agregarPosicion(datos, futbol, "ARQUERO").ok, false);
  esperarIgual(Cambios.agregarPosicion(datos, futbol, "Defensor").ok, true);
  esperarIgual(datos.deportes[0].posiciones, ["Arquero", "Defensor"]);
});

prueba("Quitar una posición deja sin posición a quienes la tenían", () => {
  const { datos, futbol } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana", { [futbol]: 7 }).jugador;
  Cambios.cambiarPosicion(datos, ana.id, futbol, "Arquero");
  const resultado = Cambios.quitarPosicion(datos, futbol, "Arquero");
  esperarIgual(resultado.jugadoresAfectados, 1);
  esperarIgual(Cambios.posicionDe(ana, futbol), null);
  esperarIgual(datos.deportes[0].posiciones, []);
});

prueba("No deja borrar un deporte que tiene partidos guardados", () => {
  const { datos, futbol } = datosDePrueba();
  datos.partidos.push({ id: "p1", deporteId: futbol, equipos: [] });
  esperarIgual(Cambios.borrarDeporte(datos, futbol).ok, false);
  esperarIgual(datos.deportes.length, 2);
});

prueba("No deja borrar el último deporte", () => {
  const { datos, futbol, voley } = datosDePrueba();
  esperarIgual(Cambios.borrarDeporte(datos, voley).ok, true);
  esperarIgual(Cambios.borrarDeporte(datos, futbol).ok, false);
});

prueba("Borrar un deporte saca las notas de los jugadores en ese deporte", () => {
  const { datos, futbol, voley } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana", { [futbol]: 7, [voley]: 4 }).jugador;
  Cambios.borrarDeporte(datos, voley);
  esperarIgual(Object.keys(ana.porDeporte), [futbol]);
});

grupo("Reglas juntos / separados");

prueba("Agregar una regla entre dos jugadores", () => {
  const { datos, futbol } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana").jugador;
  const beto = Cambios.agregarJugador(datos, "Beto").jugador;
  const { regla } = Cambios.agregarRegla(datos, futbol, "separados", ana.id, beto.id);
  esperarIgual([regla.tipo, regla.jugadores], ["separados", [ana.id, beto.id]]);
});

prueba("No deja una regla de un jugador consigo mismo", () => {
  const { datos, futbol } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana").jugador;
  esperarIgual(Cambios.agregarRegla(datos, futbol, "juntos", ana.id, ana.id).ok, false);
});

prueba("No deja dos reglas para la misma pareja (aunque se elijan al revés)", () => {
  const { datos, futbol } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana").jugador;
  const beto = Cambios.agregarJugador(datos, "Beto").jugador;
  Cambios.agregarRegla(datos, futbol, "juntos", ana.id, beto.id);
  esperarIgual(Cambios.agregarRegla(datos, futbol, "separados", beto.id, ana.id).ok, false);
});

prueba("Las reglas son de cada deporte por separado", () => {
  const { datos, futbol, voley } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana").jugador;
  const beto = Cambios.agregarJugador(datos, "Beto").jugador;
  Cambios.agregarRegla(datos, futbol, "juntos", ana.id, beto.id);
  esperarIgual(Cambios.agregarRegla(datos, voley, "separados", ana.id, beto.id).ok, true);
});

prueba("Agregar un jugador con nota y posición en un deporte", () => {
  const { datos, futbol, voley } = datosDePrueba();
  const resultado = Cambios.agregarJugador(datos, "Ana", { [futbol]: 7, [voley]: 5 }, { [futbol]: "Arquero" });
  esperarIgual(resultado.ok, true);
  esperarIgual(Cambios.posicionDe(resultado.jugador, futbol), "Arquero");
  esperarIgual(Cambios.posicionDe(resultado.jugador, voley), null);
});

prueba("No deja agregar una posición sin nota en ese deporte, ni una posición que no existe", () => {
  const { datos, futbol, voley } = datosDePrueba();
  esperarIgual(Cambios.agregarJugador(datos, "Ana", { [voley]: 5 }, { [futbol]: "Arquero" }).ok, false);
  esperarIgual(Cambios.agregarJugador(datos, "Ana", { [futbol]: 5 }, { [futbol]: "Delantero" }).ok, false);
  esperarIgual(datos.jugadores.length, 0); // no se agregó nada
});

grupo("Búsqueda de jugadores por nombre");

prueba("Encuentra al jugador aunque se escriba sin tildes ni mayúsculas", () => {
  const { datos } = datosDePrueba();
  const jose = Cambios.agregarJugador(datos, "José Pérez").jugador;
  esperarIgual(Cambios.buscarJugadorPorNombre(datos, "  jose   perez ").id, jose.id);
  esperarIgual(Cambios.buscarJugadorPorNombre(datos, "Josefina"), null);
});

prueba("Agregar regla escribiendo los nombres", () => {
  const { datos, futbol } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana").jugador;
  const beto = Cambios.agregarJugador(datos, "Beto").jugador;
  const resultado = Cambios.agregarReglaPorNombres(datos, futbol, "juntos", "ana", "BETO");
  esperarIgual(resultado.ok, true);
  esperarIgual(resultado.regla.jugadores, [ana.id, beto.id]);
});

prueba("Agregar regla con un nombre que no existe da un error claro", () => {
  const { datos, futbol } = datosDePrueba();
  Cambios.agregarJugador(datos, "Ana");
  const resultado = Cambios.agregarReglaPorNombres(datos, futbol, "juntos", "Ana", "Zoe");
  esperarIgual(resultado.ok, false);
  esperarQue(resultado.error.includes('"Zoe"'), "El mensaje debería nombrar a Zoe");
  esperarIgual(Cambios.agregarReglaPorNombres(datos, futbol, "juntos", "Ana", "  ").ok, false);
});

/* ---------- Pruebas de balanceo.js ---------- */

// Arma un jugador de prueba: jug("Ana", 7) o jug("Ana", 7, "Arquero").
function jug(nombre, nota, posicion = null) {
  return { id: nombre, nombre, nota, posicion };
}

// Arma equipos con azar "fijo" (semilla), para que la prueba dé siempre igual.
function armarDePrueba(jugadores, cantidadEquipos, reglas = [], semilla = 42) {
  return Balanceo.armar({ jugadores, cantidadEquipos, reglas }, Balanceo.crearAzar(semilla));
}

// Nombres de cada equipo, ordenados, para comparar fácil: [["Ana","Beto"],["Caro","Dani"]]
function nombresPorEquipo(combinacion) {
  return combinacion.equipos.map((e) => e.jugadores.map((j) => j.nombre).sort()).sort();
}

// ¿Están estos dos en el mismo equipo?
function juntos(combinacion, nombreA, nombreB) {
  return combinacion.equipos.some((e) => e.jugadores.some((j) => j.nombre === nombreA) && e.jugadores.some((j) => j.nombre === nombreB));
}

grupo("Balanceo: cantidad de jugadores por equipo");

prueba("10 jugadores en 2 equipos: 5 y 5, parejo", () => {
  const r = Balanceo.analizarCantidad(10, 2);
  esperarIgual([r.tamanios, r.parejo, r.sobran, r.faltan], [[5, 5], true, 0, 0]);
});

prueba("11 jugadores en 2 equipos: 6 y 5 (sobra 1, o falta 1 para 6 contra 6)", () => {
  const r = Balanceo.analizarCantidad(11, 2);
  esperarIgual([r.tamanios, r.parejo, r.sobran, r.faltan], [[6, 5], false, 1, 1]);
});

prueba("7 jugadores en 3 equipos: 3, 2 y 2", () => {
  esperarIgual(Balanceo.analizarCantidad(7, 3).tamanios, [3, 2, 2]);
});

prueba("No arma con menos jugadores que equipos, ni con menos de 2 equipos", () => {
  esperarIgual(armarDePrueba([jug("A", 5), jug("B", 5)], 3).ok, false);
  esperarIgual(armarDePrueba([jug("A", 5), jug("B", 5)], 1).ok, false);
});

prueba("Avisa si a alguien le falta la nota", () => {
  const r = armarDePrueba([jug("Ana", 5), jug("Beto", null)], 2);
  esperarIgual(r.ok, false);
  esperarQue(r.error.includes("Beto"), "El mensaje debería nombrar a Beto");
});

grupo("Balanceo: equipos parejos");

prueba("Notas 10, 1, 1, 10 → dos equipos de 11 (diferencia 0)", () => {
  const mejor = armarDePrueba([jug("A", 10), jug("B", 1), jug("C", 1), jug("D", 10)], 2).opciones[0];
  esperarIgual(mejor.diferencia, 0);
  esperarIgual(mejor.equipos.map((e) => e.total), [11, 11]);
});

prueba("Todos los jugadores quedan en algún equipo, una sola vez", () => {
  const jugadores = [jug("A", 9), jug("B", 8), jug("C", 7), jug("D", 6), jug("E", 5), jug("F", 4), jug("G", 3)];
  const mejor = armarDePrueba(jugadores, 3).opciones[0];
  const todos = mejor.equipos.flatMap((e) => e.jugadores.map((j) => j.nombre)).sort();
  esperarIgual(todos, ["A", "B", "C", "D", "E", "F", "G"]);
  esperarIgual(mejor.equipos.map((e) => e.jugadores.length).sort(), [2, 2, 3]);
});

prueba("10 jugadores variados en 2 equipos: encuentra la diferencia mínima posible", () => {
  // Suma total 62 → lo mejor posible es 31 contra 31.
  const notas = [10, 9, 8, 7, 6, 6, 5, 4, 4, 3];
  const jugadores = notas.map((n, i) => jug("J" + i, n));
  esperarIgual(armarDePrueba(jugadores, 2).opciones[0].diferencia, 0);
});

prueba("Equipos de distinta cantidad: empareja la SUMA (5 jugadores → 3 contra 2)", () => {
  // 10+5 = 15 contra 5+4+6 = 15
  const jugadores = [jug("A", 10), jug("B", 5), jug("C", 5), jug("D", 4), jug("E", 6)];
  const mejor = armarDePrueba(jugadores, 2).opciones[0];
  esperarIgual(mejor.diferencia, 0);
  esperarIgual(mejor.mismaCantidad, false);
  esperarIgual(mejor.equipos.map((e) => e.jugadores.length).sort(), [2, 3]);
});

prueba("Calcula total y promedio de cada equipo", () => {
  const mejor = armarDePrueba([jug("A", 10), jug("B", 5), jug("C", 5), jug("D", 4), jug("E", 6)], 2).opciones[0];
  const equipoDeDos = mejor.equipos.find((e) => e.jugadores.length === 2);
  const equipoDeTres = mejor.equipos.find((e) => e.jugadores.length === 3);
  esperarIgual([equipoDeDos.total, equipoDeDos.promedio], [15, 7.5]);
  esperarIgual([equipoDeTres.total, equipoDeTres.promedio], [15, 5]);
  esperarIgual(mejor.diferenciaPromedio, 2.5);
});

prueba("Con la misma semilla de azar, da el mismo resultado", () => {
  const jugadores = [jug("A", 9), jug("B", 7), jug("C", 7), jug("D", 6), jug("E", 5), jug("F", 3)];
  const r1 = armarDePrueba(jugadores, 2, [], 7);
  const r2 = armarDePrueba(jugadores, 2, [], 7);
  esperarIgual(r1.opciones.map((o) => o.clave), r2.opciones.map((o) => o.clave));
});

grupo("Balanceo: posiciones clave");

prueba("Dos arqueros quedan en equipos distintos (aunque juntos también daría parejo)", () => {
  // {A,B} contra {C,D} también da 11 a 11, pero junta a los dos arqueros.
  const jugadores = [jug("A", 10, "Arquero"), jug("B", 1, "Arquero"), jug("C", 10), jug("D", 1)];
  const r = armarDePrueba(jugadores, 2);
  r.opciones.filter((o) => Balanceo.esBuena(o, r.opciones[0])).forEach((o) => {
    esperarQue(!juntos(o, "A", "B"), "Los arqueros no deberían quedar juntos");
  });
  esperarIgual(r.opciones[0].diferencia, 0);
  esperarIgual(r.avisosGenerales, []);
});

prueba("3 arqueros para 2 equipos: queda 2 y 1, y avisa", () => {
  const jugadores = [jug("A", 5, "Arquero"), jug("B", 5, "Arquero"), jug("C", 5, "Arquero"), jug("D", 5), jug("E", 5), jug("F", 5)];
  const r = armarDePrueba(jugadores, 2);
  const arquerosPorEquipo = r.opciones[0].equipos.map((e) => e.jugadores.filter((j) => j.posicion === "Arquero").length).sort();
  esperarIgual(arquerosPorEquipo, [1, 2]);
  esperarIgual(r.avisosGenerales.length, 1);
  esperarQue(r.avisosGenerales[0].includes("Arquero"), "El aviso debería nombrar la posición");
  esperarIgual(r.opciones[0].avisos, []); // no es un "incumplimiento": es inevitable
});

prueba("1 arquero para 2 equipos: avisa que un equipo queda sin arquero", () => {
  const r = armarDePrueba([jug("A", 5, "Arquero"), jug("B", 5), jug("C", 5), jug("D", 5)], 2);
  esperarIgual(r.avisosGenerales.length, 1);
  esperarQue(r.avisosGenerales[0].includes("sin"), "El aviso debería decir que un equipo queda sin");
});

grupo("Balanceo: reglas juntos / separados");

prueba("Siempre separados se respeta aunque juntos quedaría más parejo", () => {
  // Lo más parejo sería {A,B} contra {C,D} (10 a 10), pero A y B van separados.
  const jugadores = [jug("A", 5), jug("B", 5), jug("C", 9), jug("D", 1)];
  const reglas = [{ tipo: "separados", jugadores: ["A", "B"] }];
  const mejor = armarDePrueba(jugadores, 2, reglas).opciones[0];
  esperarQue(!juntos(mejor, "A", "B"), "A y B deberían estar separados");
  esperarIgual(mejor.avisos, []);
});

prueba("Siempre juntos se respeta aunque quede desparejo", () => {
  const jugadores = [jug("A", 10), jug("B", 10), jug("C", 1), jug("D", 1)];
  const reglas = [{ tipo: "juntos", jugadores: ["A", "B"] }];
  const mejor = armarDePrueba(jugadores, 2, reglas).opciones[0];
  esperarQue(juntos(mejor, "A", "B"), "A y B deberían estar juntos");
  esperarIgual(mejor.diferencia, 18);
  esperarIgual(mejor.avisos, []);
});

prueba("Grupo de 3 'siempre juntos' (A-B y B-C) queda completo en un equipo", () => {
  const jugadores = [jug("A", 8), jug("B", 3), jug("C", 5), jug("D", 7), jug("E", 6), jug("F", 3)];
  const reglas = [
    { tipo: "juntos", jugadores: ["A", "B"] },
    { tipo: "juntos", jugadores: ["B", "C"] },
  ];
  const mejor = armarDePrueba(jugadores, 2, reglas).opciones[0];
  esperarQue(juntos(mejor, "A", "B") && juntos(mejor, "B", "C"), "A, B y C deberían estar juntos");
  esperarIgual(mejor.avisos, []);
});

prueba("Regla con alguien que no vino: se ignora sin avisos", () => {
  // "Zoe" no está entre los presentes.
  const jugadores = [jug("A", 10), jug("B", 1), jug("C", 1), jug("D", 10)];
  const reglas = [
    { tipo: "separados", jugadores: ["A", "Zoe"] },
    { tipo: "juntos", jugadores: ["Zoe", "D"] },
  ];
  const r = armarDePrueba(jugadores, 2, reglas);
  esperarIgual(r.ok, true);
  esperarIgual(r.avisosGenerales, []);
  esperarIgual(r.opciones[0].avisos, []);
  esperarIgual(r.opciones[0].diferencia, 0); // arma igual de parejo que sin la regla
  esperarIgual(Balanceo.reglasQueAplican(jugadores, reglas), []);
});

prueba("Reglas imposibles (A, B y C todos separados en 2 equipos): avisa cuál y arma igual", () => {
  const jugadores = [jug("A", 5), jug("B", 5), jug("C", 5), jug("D", 5)];
  const reglas = [
    { tipo: "separados", jugadores: ["A", "B"] },
    { tipo: "separados", jugadores: ["B", "C"] },
    { tipo: "separados", jugadores: ["A", "C"] },
  ];
  const r = armarDePrueba(jugadores, 2, reglas);
  const mejor = r.opciones[0];
  esperarIgual(r.ok, true);
  esperarIgual(mejor.avisos.length, 1); // solo una se rompe (la mínima posible)
  esperarQue(mejor.avisos[0].includes("siempre separados"), "El aviso debería decir qué regla no se cumplió");
  esperarIgual(mejor.equipos.map((e) => e.jugadores.length), [2, 2]);
});

prueba("Juntos y separados que se contradicen: avisa", () => {
  // A con B, B con C, pero A separado de C → imposible.
  const jugadores = [jug("A", 5), jug("B", 5), jug("C", 5), jug("D", 5), jug("E", 5), jug("F", 5)];
  const reglas = [
    { tipo: "juntos", jugadores: ["A", "B"] },
    { tipo: "juntos", jugadores: ["B", "C"] },
    { tipo: "separados", jugadores: ["A", "C"] },
  ];
  const mejor = armarDePrueba(jugadores, 2, reglas).opciones[0];
  esperarIgual(mejor.avisos.length, 1);
});

grupo("Balanceo: \"Otra combinación\"");

prueba("Da una combinación distinta, igual de pareja o casi", () => {
  const notas = [9, 8, 8, 7, 6, 6, 5, 5, 4, 3];
  const jugadores = notas.map((n, i) => jug("J" + i, n));
  const r = armarDePrueba(jugadores, 2);
  const primera = r.opciones[0];
  const otra = Balanceo.elegirOtra(r.opciones, [primera.clave]);
  esperarQue(otra !== null, "Debería haber otra combinación");
  esperarQue(otra.clave !== primera.clave, "Debería ser distinta");
  esperarQue(otra.diferencia <= primera.diferencia + Balanceo.TOLERANCIA, "Debería ser pareja o casi");
});

prueba("La otra combinación cambia compañeros de verdad (no solo uno)", () => {
  const notas = [9, 8, 8, 7, 6, 6, 5, 5, 4, 3];
  const jugadores = notas.map((n, i) => jug("J" + i, n));
  const r = armarDePrueba(jugadores, 2);
  const primera = r.opciones[0];
  const otra = Balanceo.elegirOtra(r.opciones, [primera.clave]);
  // Cambiar un solo jugador de cada equipo cambia 16 parejas; pedimos más que eso.
  esperarQue(Balanceo.distancia(primera, otra) > 16, "Debería cambiar varios compañeros");
});

prueba("Nunca repite una combinación ya mostrada", () => {
  const notas = [9, 8, 8, 7, 6, 6, 5, 5];
  const jugadores = notas.map((n, i) => jug("J" + i, n));
  const r = armarDePrueba(jugadores, 2);
  const mostradas = [r.opciones[0].clave];
  let siguiente = Balanceo.elegirOtra(r.opciones, mostradas);
  while (siguiente) {
    esperarQue(!mostradas.includes(siguiente.clave), "Se repitió una combinación");
    mostradas.push(siguiente.clave);
    siguiente = Balanceo.elegirOtra(r.opciones, mostradas);
  }
  esperarIgual(mostradas.length, Balanceo.contarBuenas(r.opciones));
});

prueba("Si no hay otra combinación posible, devuelve null", () => {
  const r = armarDePrueba([jug("A", 5), jug("B", 5)], 2);
  esperarIgual(r.opciones.length, 1);
  esperarIgual(Balanceo.elegirOtra(r.opciones, [r.opciones[0].clave]), null);
});

grupo("Balanceo: velocidad");

prueba("30 jugadores en 3 equipos con reglas y posiciones: tarda menos de 3 segundos", () => {
  const azar = Balanceo.crearAzar(1);
  const jugadores = [];
  for (let i = 0; i < 30; i++) {
    jugadores.push(jug("J" + i, 1 + Math.floor(azar() * 10), i < 3 ? "Arquero" : null));
  }
  const reglas = [
    { tipo: "separados", jugadores: ["J3", "J4"] },
    { tipo: "juntos", jugadores: ["J5", "J6"] },
  ];
  const inicio = Date.now();
  const r = armarDePrueba(jugadores, 3, reglas);
  const demora = Date.now() - inicio;
  esperarIgual(r.opciones[0].avisos, []);
  esperarQue(demora < 3000, "Tardó " + demora + " ms");
});

/* ---------- Pruebas para la pantalla "Armar equipos" ---------- */

grupo("Armar equipos: sumar jugadores desde la lista");

prueba("Un nombre nuevo crea al jugador con nota y posición", () => {
  const { datos, futbol } = datosDePrueba();
  const r = Cambios.sumarJugadorAlDeporte(datos, "Ana", futbol, "8", "Arquero");
  esperarIgual([r.ok, r.caso], [true, "nuevo"]);
  esperarIgual([Cambios.notaDe(r.jugador, futbol), Cambios.posicionDe(r.jugador, futbol)], [8, "Arquero"]);
});

prueba("Un nombre nuevo sin nota da error y no crea nada", () => {
  const { datos, futbol } = datosDePrueba();
  esperarIgual(Cambios.sumarJugadorAlDeporte(datos, "Ana", futbol, "").ok, false);
  esperarIgual(datos.jugadores.length, 0);
});

prueba("Si ya existe con nota en el deporte, no cambia nada", () => {
  const { datos, futbol } = datosDePrueba();
  Cambios.agregarJugador(datos, "Ana", { [futbol]: 8 });
  const r = Cambios.sumarJugadorAlDeporte(datos, "ana", futbol, "3");
  esperarIgual([r.ok, r.caso, Cambios.notaDe(r.jugador, futbol)], [true, "ya-estaba", 8]);
  esperarIgual(datos.jugadores.length, 1);
});

prueba("Si ya existe sin nota en el deporte, pide la nota mostrando la de otros deportes", () => {
  const { datos, futbol, voley } = datosDePrueba();
  Cambios.agregarJugador(datos, "Ana", { [voley]: 7 });
  const sinNota = Cambios.sumarJugadorAlDeporte(datos, "Ana", futbol, "");
  esperarIgual(sinNota.ok, false);
  esperarQue(sinNota.error.includes("En Vóley tiene 7"), "Debería mostrar la nota de Vóley como referencia: " + sinNota.error);
  const conNota = Cambios.sumarJugadorAlDeporte(datos, "Ana", futbol, "4");
  esperarIgual([conNota.ok, conNota.caso, Cambios.notaDe(conNota.jugador, futbol)], [true, "nota-nueva", 4]);
  esperarIgual(datos.jugadores.length, 1);
});

prueba("Texto de notas en otros deportes", () => {
  const { datos, futbol, voley } = datosDePrueba();
  const basquet = Cambios.agregarDeporte(datos, "Básquet").deporte.id;
  const ana = Cambios.agregarJugador(datos, "Ana", { [futbol]: 9, [voley]: 7, [basquet]: 5 }).jugador;
  esperarIgual(Cambios.textoNotasEnOtros(datos, ana, futbol), "En Vóley tiene 7 y en Básquet tiene 5.");
  const beto = Cambios.agregarJugador(datos, "Beto", { [futbol]: 9 }).jugador;
  esperarIgual(Cambios.textoNotasEnOtros(datos, beto, futbol), "");
});

grupo("Armar equipos: guardar el partido");

prueba("Confirmar partido guarda equipos, notas del momento, totales y sin resultado", () => {
  const { datos, futbol } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana", { [futbol]: 10 }, { [futbol]: "Arquero" }).jugador;
  const beto = Cambios.agregarJugador(datos, "Beto", { [futbol]: 4 }).jugador;
  const jugadores = [ana, beto].map((j) => ({ id: j.id, nombre: j.nombre, nota: Cambios.notaDe(j, futbol), posicion: Cambios.posicionDe(j, futbol) }));
  const combinacion = Balanceo.armar({ jugadores, cantidadEquipos: 2, reglas: [] }, Balanceo.crearAzar(1)).opciones[0];

  const partido = Cambios.crearPartido(datos, futbol, combinacion, new Date(2026, 9, 13, 20, 0));
  esperarIgual(datos.partidos.length, 1);
  esperarIgual(partido.equipos.map((e) => e.nombre), ["Equipo 1", "Equipo 2"]);
  esperarIgual(partido.diferencia, 6);
  esperarIgual([partido.resultado, partido.evaluacion, partido.comentario], [null, null, ""]);
  const anaEnPartido = partido.equipos.flatMap((e) => e.jugadores).find((j) => j.nombre === "Ana");
  esperarIgual(anaEnPartido, { jugadorId: ana.id, nombre: "Ana", nota: 10, posicion: "Arquero" });
});

prueba("Cambiar después la nota del jugador no cambia el partido guardado", () => {
  const { datos, futbol } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana", { [futbol]: 10 }).jugador;
  const beto = Cambios.agregarJugador(datos, "Beto", { [futbol]: 4 }).jugador;
  const jugadores = [ana, beto].map((j) => ({ id: j.id, nombre: j.nombre, nota: Cambios.notaDe(j, futbol), posicion: null }));
  const combinacion = Balanceo.armar({ jugadores, cantidadEquipos: 2, reglas: [] }, Balanceo.crearAzar(1)).opciones[0];
  const partido = Cambios.crearPartido(datos, futbol, combinacion);
  Cambios.cambiarNota(datos, ana.id, futbol, 3);
  Cambios.renombrarJugador(datos, ana.id, "Anita");
  const anaEnPartido = partido.equipos.flatMap((e) => e.jugadores).find((j) => j.jugadorId === ana.id);
  esperarIgual([anaEnPartido.nombre, anaEnPartido.nota], ["Ana", 10]);
});

prueba("Encuentra el último partido de un deporte", () => {
  const { datos, futbol, voley } = datosDePrueba();
  datos.partidos.push({ id: "p1", deporteId: futbol, fecha: "2026-10-01T20:00:00.000Z", equipos: [] });
  datos.partidos.push({ id: "p2", deporteId: futbol, fecha: "2026-10-08T20:00:00.000Z", equipos: [] });
  datos.partidos.push({ id: "p3", deporteId: voley, fecha: "2026-10-10T20:00:00.000Z", equipos: [] });
  esperarIgual(Cambios.ultimoPartido(datos, futbol).id, "p2");
  esperarIgual(Cambios.ultimoPartido(datos, "otro"), null);
});

grupo("Armar equipos: texto para WhatsApp");

prueba("El texto tiene deporte, fecha, equipos y jugadores, pero NO las notas", () => {
  const combinacion = armarDePrueba([jug("Ana", 10, "Arquero"), jug("Beto", 1), jug("Caro", 1), jug("Dani", 10)], 2).opciones[0];
  const texto = Balanceo.textoParaCompartir("Fútbol", combinacion, new Date(2026, 9, 3));
  esperarQue(texto.startsWith("⚽ *Fútbol* · 03/10/2026"), "Debería empezar con el deporte y la fecha:\n" + texto);
  esperarQue(texto.includes("*Equipo 1*") && texto.includes("*Equipo 2*"), "Debería tener los dos equipos");
  esperarQue(texto.includes("• Ana (Arquero)"), "Debería mostrar la posición de Ana");
  // Las líneas de jugadores (las que empiezan con "•") no tienen que tener números.
  const lineasJugadores = texto.split("\n").filter((l) => l.startsWith("•"));
  esperarIgual(lineasJugadores.length, 4);
  esperarQue(lineasJugadores.every((l) => !/\d/.test(l)), "No debería mostrar notas:\n" + texto);
});

prueba("Ícono según el deporte", () => {
  esperarIgual([Balanceo.iconoDeporte("Fútbol 5"), Balanceo.iconoDeporte("VOLEY"), Balanceo.iconoDeporte("Ajedrez")], ["⚽", "🏐", "🏆"]);
});

/* ---------- Pruebas del historial ---------- */

// Partido de prueba: Equipo 1 = Ana(8) + Beto(4), Equipo 2 = Caro(7) + Dani(5).
function partidoDePrueba() {
  const { datos, futbol } = datosDePrueba();
  const partido = {
    id: "p1",
    fecha: new Date(2026, 9, 13, 20, 30).toISOString(),
    deporteId: futbol,
    equipos: [
      { nombre: "Equipo 1", jugadores: [{ jugadorId: "a", nombre: "Ana", nota: 8, posicion: null }, { jugadorId: "b", nombre: "Beto", nota: 4, posicion: null }], total: 12, promedio: 6 },
      { nombre: "Equipo 2", jugadores: [{ jugadorId: "c", nombre: "Caro", nota: 7, posicion: null }, { jugadorId: "d", nombre: "Dani", nota: 5, posicion: null }], total: 12, promedio: 6 },
    ],
    diferencia: 0,
    mismaCantidad: true,
    resultado: null,
    evaluacion: null,
    comentario: "",
  };
  datos.partidos.push(partido);
  return { datos, partido };
}

grupo("Historial: resultado, evaluación y comentario");

prueba("Cargar resultado, evaluación y comentario", () => {
  const { datos, partido } = partidoDePrueba();
  const r = Cambios.editarPartido(datos, "p1", { resultado: ["3", "2"], evaluacion: "Parejo", comentario: "  Muy lindo partido " });
  esperarIgual(r.ok, true);
  esperarIgual([partido.resultado, partido.evaluacion, partido.comentario], [[3, 2], "Parejo", "Muy lindo partido"]);
});

prueba("Resultado todo vacío = todavía sin resultado", () => {
  const { datos, partido } = partidoDePrueba();
  Cambios.editarPartido(datos, "p1", { resultado: ["3", "2"] });
  Cambios.editarPartido(datos, "p1", { resultado: ["", ""] });
  esperarIgual(partido.resultado, null);
});

prueba("Resultado a medias, negativo o con coma: da error y no cambia nada", () => {
  const { datos, partido } = partidoDePrueba();
  esperarIgual(Cambios.editarPartido(datos, "p1", { resultado: ["3", ""], comentario: "x" }).ok, false);
  esperarIgual(Cambios.editarPartido(datos, "p1", { resultado: ["-1", "2"] }).ok, false);
  esperarIgual(Cambios.editarPartido(datos, "p1", { resultado: ["1.5", "2"] }).ok, false);
  esperarIgual(Cambios.editarPartido(datos, "p1", { resultado: ["dos", "2"] }).ok, false);
  esperarIgual([partido.resultado, partido.comentario], [null, ""]);
});

prueba("Evaluación inválida da error; vacía la borra", () => {
  const { datos, partido } = partidoDePrueba();
  esperarIgual(Cambios.editarPartido(datos, "p1", { evaluacion: "Más o menos" }).ok, false);
  Cambios.editarPartido(datos, "p1", { evaluacion: "Muy desparejo" });
  Cambios.editarPartido(datos, "p1", { evaluacion: "" });
  esperarIgual(partido.evaluacion, null);
});

prueba("Comentario muy largo da error", () => {
  const { datos } = partidoDePrueba();
  esperarIgual(Cambios.editarPartido(datos, "p1", { comentario: "a".repeat(LARGO_MAXIMO_COMENTARIO + 1) }).ok, false);
});

prueba("Cambiar la fecha conserva la hora", () => {
  const { datos, partido } = partidoDePrueba();
  esperarIgual(Cambios.fechaParaCampo(partido.fecha), "2026-10-13");
  Cambios.editarPartido(datos, "p1", { fecha: "2026-10-20" });
  const nueva = new Date(partido.fecha);
  esperarIgual([nueva.getDate(), nueva.getMonth() + 1, nueva.getHours(), nueva.getMinutes()], [20, 10, 20, 30]);
  esperarIgual(Cambios.editarPartido(datos, "p1", { fecha: "2026-02-31" }).ok, false);
  esperarIgual(Cambios.editarPartido(datos, "p1", { fecha: "" }).ok, false);
});

grupo("Historial: corregir equipos");

prueba("Mover un jugador de equipo recalcula totales, promedios y diferencia", () => {
  const { datos, partido } = partidoDePrueba();
  Cambios.editarPartido(datos, "p1", { asignacion: { b: 1 } }); // Beto pasa al Equipo 2
  esperarIgual(partido.equipos.map((e) => e.jugadores.map((j) => j.nombre)), [["Ana"], ["Caro", "Dani", "Beto"]]);
  esperarIgual(partido.equipos.map((e) => [e.total, e.promedio]), [[8, 8], [16, 5.33]]);
  esperarIgual([partido.diferencia, partido.mismaCantidad], [8, false]);
});

prueba("Marcar que alguien no jugó lo saca del partido", () => {
  const { datos, partido } = partidoDePrueba();
  Cambios.editarPartido(datos, "p1", { asignacion: { d: -1 } });
  esperarIgual(partido.equipos[1].jugadores.map((j) => j.nombre), ["Caro"]);
  esperarIgual(partido.equipos[1].total, 7);
});

prueba("No deja un equipo vacío", () => {
  const { datos, partido } = partidoDePrueba();
  const r = Cambios.editarPartido(datos, "p1", { asignacion: { a: 1, b: 1 } });
  esperarIgual(r.ok, false);
  esperarQue(r.error.includes("Equipo 1"), "Debería decir qué equipo queda vacío");
  esperarIgual(partido.equipos[0].jugadores.length, 2);
});

grupo("Historial: ganador y borrar");

prueba("Ganador, empate y sin resultado", () => {
  const { partido } = partidoDePrueba();
  esperarIgual(Cambios.ganadorDe(partido), null);
  partido.resultado = [3, 1];
  esperarIgual(Cambios.ganadorDe(partido), { ganadores: [0], empate: false });
  partido.resultado = [2, 2];
  esperarIgual(Cambios.ganadorDe(partido), { ganadores: [0, 1], empate: true });
});

prueba("Con 3 equipos, empate entre los dos primeros", () => {
  esperarIgual(Cambios.ganadorDe({ resultado: [2, 2, 1] }), { ganadores: [0, 1], empate: true });
});

prueba("Borrar un partido", () => {
  const { datos } = partidoDePrueba();
  esperarIgual(Cambios.borrarPartido(datos, "p1").ok, true);
  esperarIgual(datos.partidos.length, 0);
  esperarIgual(Cambios.borrarPartido(datos, "p1").ok, false);
});

/* ---------- Pruebas de calculos.js (estadísticas) ---------- */

// Partido rápido para estadísticas: equipos con ids de jugadores, resultado y evaluación.
function partidoRapido(deporteId, equipos, resultado, evaluacion = null, diferencia = 0) {
  return {
    id: Datos.crearId("par"),
    fecha: new Date().toISOString(),
    deporteId,
    equipos: equipos.map((ids, i) => ({
      nombre: "Equipo " + (i + 1),
      jugadores: ids.map((id) => ({ jugadorId: id, nombre: id, nota: 5, posicion: null })),
    })),
    diferencia,
    resultado,
    evaluacion,
    comentario: "",
  };
}

grupo("Estadísticas: resultado de un jugador");

prueba("Ganado, perdido, empatado, sin resultado y no jugó", () => {
  const p = partidoRapido("f", [["a", "b"], ["c", "d"]], [3, 1]);
  esperarIgual(
    ["a", "c", "z"].map((id) => Calculos.resultadoDeJugador(p, id)),
    ["ganado", "perdido", null]
  );
  p.resultado = [2, 2];
  esperarIgual(Calculos.resultadoDeJugador(p, "c"), "empatado");
  p.resultado = null;
  esperarIgual(Calculos.resultadoDeJugador(p, "a"), "sin-resultado");
});

prueba("Con 3 equipos y empate arriba, el tercero perdió", () => {
  const p = partidoRapido("f", [["a"], ["b"], ["c"]], [2, 2, 0]);
  esperarIgual(["a", "b", "c"].map((id) => Calculos.resultadoDeJugador(p, id)), ["empatado", "empatado", "perdido"]);
});

grupo("Estadísticas por deporte");

prueba("Cuenta parejos, desparejos, sin evaluar, empates y diferencia promedio", () => {
  const { datos, futbol, voley } = datosDePrueba();
  datos.partidos.push(
    partidoRapido(futbol, [["a"], ["b"]], [3, 1], "Parejo", 2), // diferencia de resultado 2
    partidoRapido(futbol, [["a"], ["b"]], [2, 2], "Algo desparejo", 0), // 0, empate
    partidoRapido(futbol, [["a"], ["b"]], [5, 0], "Muy desparejo", 4), // 5
    partidoRapido(futbol, [["a"], ["b"]], null, null, 1), // sin resultado ni evaluación
    partidoRapido(voley, [["a"], ["b"]], [3, 0], "Parejo") // otro deporte: no cuenta
  );
  const e = Calculos.estadisticasDeporte(datos, futbol);
  esperarIgual([e.total, e.conResultado, e.parejos, e.desparejos, e.sinEvaluar, e.evaluados, e.empates], [4, 3, 1, 2, 1, 3, 1]);
  esperarIgual(e.evaluaciones, { Parejo: 1, "Algo desparejo": 1, "Muy desparejo": 1 });
  esperarIgual(e.diferenciaPromedioResultado, 2.33); // (2 + 0 + 5) / 3
  esperarIgual(e.diferenciaPromedioNotas, 1.75); // (2 + 0 + 4 + 1) / 4
});

prueba("Si no se evaluó a mano, cuenta la evaluación automática según el resultado", () => {
  const { datos, futbol } = datosDePrueba();
  datos.partidos.push(
    partidoRapido(futbol, [["a"], ["b"]], [4, 1]), // automática: Muy desparejo
    partidoRapido(futbol, [["a"], ["b"]], [4, 1], "Parejo"), // a mano manda: Parejo
    partidoRapido(futbol, [["a"], ["b"]], null) // sin resultado: sin evaluar
  );
  const e = Calculos.estadisticasDeporte(datos, futbol);
  esperarIgual(e.evaluaciones, { Parejo: 1, "Algo desparejo": 0, "Muy desparejo": 1 });
  esperarIgual([e.automaticas, e.sinEvaluar, e.evaluados], [1, 1, 2]);
});

grupo("Evaluación automática según el resultado");

prueba("Fútbol: 1-0 y 2-1 parejo, 3-1 algo desparejo, 4-1 muy desparejo, empate parejo", () => {
  esperarIgual(
    [[1, 0], [2, 1], [3, 1], [4, 1], [2, 2], [0, 0]].map((r) => Calculos.evaluacionAutomatica(r)),
    ["Parejo", "Parejo", "Algo desparejo", "Muy desparejo", "Parejo", "Parejo"]
  );
});

prueba("Vóley por sets: 3-2 parejo, 3-1 algo desparejo, 3-0 muy desparejo", () => {
  esperarIgual(
    [[3, 2], [3, 1], [3, 0]].map((r) => Calculos.evaluacionAutomatica(r)),
    ["Parejo", "Algo desparejo", "Muy desparejo"]
  );
});

prueba("Por puntos (básquet): 80-75 parejo, 80-60 algo desparejo, 80-40 muy desparejo", () => {
  esperarIgual(
    [[80, 75], [80, 60], [80, 40]].map((r) => Calculos.evaluacionAutomatica(r)),
    ["Parejo", "Algo desparejo", "Muy desparejo"]
  );
});

prueba("Sin resultado no hay evaluación automática; la elegida a mano siempre manda", () => {
  esperarIgual(Calculos.evaluacionAutomatica(null), null);
  esperarIgual(Calculos.evaluacionFinal({ resultado: [5, 0], evaluacion: "Parejo" }), "Parejo");
  esperarIgual(Calculos.evaluacionFinal({ resultado: [5, 0], evaluacion: null }), "Muy desparejo");
  esperarIgual(Calculos.evaluacionFinal({ resultado: null, evaluacion: null }), null);
});

grupo("Estadísticas por deporte (continuación)");

prueba("Deporte sin partidos: todo en cero y promedios vacíos", () => {
  const { datos, voley } = datosDePrueba();
  const e = Calculos.estadisticasDeporte(datos, voley);
  esperarIgual([e.total, e.diferenciaPromedioResultado, e.diferenciaPromedioNotas], [0, null, null]);
});

grupo("Estadísticas por jugador");

prueba("Ganados, empatados y perdidos por deporte, con porcentaje", () => {
  const { datos, futbol, voley } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana", { [futbol]: 7, [voley]: 4 }).jugador;
  const a = ana.id;
  datos.partidos.push(
    partidoRapido(futbol, [[a], ["x"]], [3, 1]), // ganó
    partidoRapido(futbol, [["x"], [a]], [3, 1]), // perdió
    partidoRapido(futbol, [[a], ["x"]], [1, 1]), // empató
    partidoRapido(futbol, [[a], ["x"]], [2, 0]), // ganó
    partidoRapido(futbol, [[a], ["x"]], null), // sin resultado
    partidoRapido(futbol, [["x"], ["y"]], [2, 0]) // no jugó
  );
  const [enFutbol, enVoley] = Calculos.estadisticasJugador(datos, a);
  esperarIgual(
    [enFutbol.jugados, enFutbol.ganados, enFutbol.empatados, enFutbol.perdidos, enFutbol.sinResultado, enFutbol.porcentajeGanados],
    [5, 2, 1, 1, 1, 50]
  );
  esperarIgual([enVoley.nombreDeporte, enVoley.jugados, enVoley.nota, enVoley.porcentajeGanados], ["Vóley", 0, 4, null]);
  esperarIgual(Calculos.partidosJugados(datos, a), 5);
});

prueba("Incluye la evolución de la nota", () => {
  const { datos, futbol } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana", { [futbol]: 7 }).jugador;
  Cambios.cambiarNota(datos, ana.id, futbol, 8);
  esperarIgual(Calculos.estadisticasJugador(datos, ana.id)[0].historial.map((h) => h.nota), [7, 8]);
});

prueba("No muestra deportes donde ni jugó ni tiene nota", () => {
  const { datos, futbol } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana", { [futbol]: 7 }).jugador;
  esperarIgual(Calculos.estadisticasJugador(datos, ana.id).map((e) => e.nombreDeporte), ["Fútbol"]);
});

prueba("Sigue contando partidos de alguien aunque ya no tenga nota en ese deporte", () => {
  const { datos, voley } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana").jugador;
  datos.partidos.push(partidoRapido(voley, [[ana.id], ["x"]], [3, 0]));
  const [enVoley] = Calculos.estadisticasJugador(datos, ana.id);
  esperarIgual([enVoley.nombreDeporte, enVoley.ganados, enVoley.nota], ["Vóley", 1, null]);
});

/* ---------- Pruebas de sugerencias de notas ---------- */

// Prepara a "Ana" (nota 7 en fútbol desde el 1/1/2026) y una función para sumar partidos
// donde Ana juega en el Equipo 1 contra un rival, con las notas totales que se elijan.
function escenarioSugerencias(notaAna = 7) {
  const { datos, futbol } = datosDePrueba();
  const ana = Cambios.agregarJugador(datos, "Ana", { [futbol]: notaAna }, {}, new Date(2026, 0, 1)).jugador;
  let dia = 1;
  // jugar(resultado, notaCompañero, notaRival1, notaRival2, mes)
  const jugar = (resultado, companero = 5, rival1 = 6, rival2 = 6, mes = 1) => {
    datos.partidos.push({
      id: Datos.crearId("par"),
      fecha: new Date(2026, mes, dia++, 20).toISOString(),
      deporteId: futbol,
      equipos: [
        { nombre: "Equipo 1", jugadores: [{ jugadorId: ana.id, nombre: "Ana", nota: notaAna }, { jugadorId: "x", nombre: "X", nota: companero }] },
        { nombre: "Equipo 2", jugadores: [{ jugadorId: "y", nombre: "Y", nota: rival1 }, { jugadorId: "z", nombre: "Z", nota: rival2 }] },
      ],
      resultado,
    });
  };
  const sugerenciasDeAna = () => Calculos.sugerencias(datos).filter((s) => s.jugadorId === ana.id);
  return { datos, futbol, ana, jugar, sugerenciasDeAna };
}

grupo("Sugerencias de notas");

prueba("Con solo 2 partidos no sugiere nada (mínimo 3)", () => {
  const { jugar, sugerenciasDeAna } = escenarioSugerencias();
  jugar([3, 0]);
  jugar([2, 1]);
  esperarIgual(sugerenciasDeAna(), []);
});

prueba("Gana 3 de 3 con equipos parejos → sugiere subir 1, explicando el motivo", () => {
  const { jugar, sugerenciasDeAna } = escenarioSugerencias();
  jugar([3, 0]);
  jugar([2, 1]);
  jugar([1, 0]);
  const [s] = sugerenciasDeAna();
  esperarIgual([s.notaActual, s.notaSugerida, s.direccion], [7, 8, 1]);
  esperarIgual(
    s.motivo,
    "En sus últimos 3 partidos con nota 7 ganó 3, siempre con un equipo de igual o menos nota que el rival: parece rendir más de lo que dice su nota."
  );
});

prueba("Pierde 3 de 3 con equipos parejos → sugiere bajar 1", () => {
  const { jugar, sugerenciasDeAna } = escenarioSugerencias();
  jugar([0, 2]);
  jugar([1, 3]);
  jugar([0, 1]);
  const [s] = sugerenciasDeAna();
  esperarIgual([s.notaSugerida, s.direccion], [6, -1]);
  esperarQue(s.motivo.includes("perdió 3") && s.motivo.includes("rendir menos"), s.motivo);
});

prueba("Gana 2 y pierde 1: no alcanza para sugerir", () => {
  const { jugar, sugerenciasDeAna } = escenarioSugerencias();
  jugar([3, 0]);
  jugar([0, 1]);
  jugar([2, 1]);
  esperarIgual(sugerenciasDeAna(), []);
});

prueba("Gana 4 de 5 parejos → sugiere subir", () => {
  const { jugar, sugerenciasDeAna } = escenarioSugerencias();
  [[1, 0], [2, 0], [0, 1], [3, 2], [1, 0]].forEach((r) => jugar(r));
  esperarIgual(sugerenciasDeAna().map((s) => s.notaSugerida), [8]);
});

prueba("Si ganaba porque su equipo tenía mucha más nota, no sugiere subir", () => {
  const { jugar, sugerenciasDeAna } = escenarioSugerencias();
  // Equipo de Ana: 7 + 10 = 17. Rivales: 4 + 5 = 9 (8 puntos de ventaja).
  jugar([3, 0], 10, 4, 5);
  jugar([2, 0], 10, 4, 5);
  jugar([1, 0], 10, 4, 5);
  esperarIgual(sugerenciasDeAna(), []);
});

prueba("Empates parejos no generan sugerencias", () => {
  const { jugar, sugerenciasDeAna } = escenarioSugerencias();
  jugar([1, 1]);
  jugar([0, 0]);
  jugar([2, 2]);
  esperarIgual(sugerenciasDeAna(), []);
});

prueba("Nunca sugiere más de 10 ni menos de 1", () => {
  const alto = escenarioSugerencias(10);
  [[1, 0], [2, 0], [3, 0]].forEach((r) => alto.jugar(r));
  esperarIgual(alto.sugerenciasDeAna(), []);
  const bajo = escenarioSugerencias(1);
  [[0, 1], [0, 2], [0, 3]].forEach((r) => bajo.jugar(r));
  esperarIgual(bajo.sugerenciasDeAna(), []);
});

prueba("No cuenta partidos sin resultado ni anteriores al último cambio de nota", () => {
  const { datos, futbol, ana, jugar, sugerenciasDeAna } = escenarioSugerencias();
  jugar([3, 0]);
  jugar([2, 0]);
  jugar([1, 0]);
  jugar(null);
  // Le cambian la nota después de esos partidos: se empieza a contar de nuevo.
  Cambios.cambiarNota(datos, ana.id, futbol, 8, "Cambio manual", new Date(2026, 5, 1));
  esperarIgual(sugerenciasDeAna(), []);
});

prueba("Aceptar: cambia la nota, queda en el historial y la sugerencia desaparece", () => {
  const { datos, futbol, ana, jugar, sugerenciasDeAna } = escenarioSugerencias();
  [[3, 0], [2, 0], [1, 0]].forEach((r) => jugar(r));
  Cambios.aceptarSugerencia(datos, sugerenciasDeAna()[0], new Date(2026, 5, 1));
  esperarIgual(Cambios.notaDe(ana, futbol), 8);
  const ultimo = ana.porDeporte[futbol].historialNotas.slice(-1)[0];
  esperarIgual([ultimo.nota, ultimo.motivo], [8, "Sugerencia aceptada"]);
  esperarIgual(sugerenciasDeAna(), []);
});

prueba("Rechazar: la nota no cambia y no vuelve a sugerirse hasta que juegue 3 partidos más", () => {
  const { datos, futbol, ana, jugar, sugerenciasDeAna } = escenarioSugerencias();
  [[3, 0], [2, 0], [1, 0]].forEach((r) => jugar(r));
  Cambios.rechazarSugerencia(datos, sugerenciasDeAna()[0], new Date(2026, 2, 1));
  esperarIgual(Cambios.notaDe(ana, futbol), 7);
  esperarIgual(sugerenciasDeAna(), []);
  // Juega 3 partidos más (en abril, después del rechazo) y los vuelve a ganar todos.
  [[1, 0], [2, 0], [4, 1]].forEach((r) => jugar(r, 5, 6, 6, 3));
  esperarIgual(sugerenciasDeAna().map((s) => s.notaSugerida), [8]);
});

/* ---------- Recordatorios ---------- */

grupo("Recordatorios");

prueba("Partidos pendientes: sin resultado y de días anteriores (no los de hoy)", () => {
  const { datos, futbol } = datosDePrueba();
  const ahora = new Date(2026, 9, 13, 21, 0);
  const partido = (id, fecha, resultado) => ({ id, deporteId: futbol, fecha: fecha.toISOString(), equipos: [], resultado });
  datos.partidos.push(
    partido("viejo", new Date(2026, 9, 6, 20), null),
    partido("ayer", new Date(2026, 9, 12, 22), null),
    partido("hoy", new Date(2026, 9, 13, 19), null),
    partido("con-resultado", new Date(2026, 9, 1, 20), [1, 0])
  );
  esperarIgual(Calculos.partidosPendientes(datos, ahora).map((p) => p.id), ["viejo", "ayer"]);
});

prueba("Recordar respaldo: solo con cambios sin exportar hace 14 días o más", () => {
  const ahora = new Date(2026, 9, 20);
  const haceDias = (n) => new Date(ahora.getTime() - n * 24 * 60 * 60 * 1000).toISOString();
  esperarIgual(Datos.hayQueRecordarRespaldo({}, ahora), false); // sin cambios pendientes
  esperarIgual(Datos.hayQueRecordarRespaldo({ primerCambioSinExportar: haceDias(10) }, ahora), false);
  esperarIgual(Datos.hayQueRecordarRespaldo({ primerCambioSinExportar: haceDias(15) }, ahora), true);
});

prueba("Recordar respaldo: \"Recordármelo en unos días\" lo pospone", () => {
  const ahora = new Date(2026, 9, 20);
  const preferencias = {
    primerCambioSinExportar: new Date(2026, 8, 1).toISOString(),
    posponerRespaldoHasta: new Date(2026, 9, 22).toISOString(),
  };
  esperarIgual(Datos.hayQueRecordarRespaldo(preferencias, ahora), false);
  esperarIgual(Datos.hayQueRecordarRespaldo(preferencias, new Date(2026, 9, 23)), true);
});

/* ---------- Mostrar resultados en la página ---------- */

function mostrarResultados() {
  // Si se corre fuera del navegador (por ejemplo con Node), mostramos en la consola.
  if (typeof document === "undefined") {
    resultadosPruebas.forEach((r) => {
      console.log((r.paso ? "OK    " : "FALLA ") + r.grupo + " › " + r.nombre + (r.paso ? "" : "\n      " + r.detalle));
    });
    return;
  }

  const escapar = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fallas = resultadosPruebas.filter((r) => !r.paso).length;
  const total = resultadosPruebas.length;

  const resumen = document.getElementById("resumen");
  resumen.textContent =
    fallas === 0
      ? "✔ Pasaron las " + total + " pruebas"
      : "✘ Fallaron " + fallas + " de " + total + " pruebas";
  resumen.className = "resumen " + (fallas === 0 ? "todo-bien" : "hay-fallas");

  let html = "";
  let grupoAnterior = null;
  resultadosPruebas.forEach((r) => {
    if (r.grupo !== grupoAnterior) {
      if (grupoAnterior !== null) html += "</ul>";
      html += "<h2>" + escapar(r.grupo) + "</h2><ul>";
      grupoAnterior = r.grupo;
    }
    html += '<li class="' + (r.paso ? "paso" : "falla") + '">' + (r.paso ? "✔ " : "✘ ") + escapar(r.nombre);
    if (!r.paso) html += '<span class="detalle">' + escapar(r.detalle) + "</span>";
    html += "</li>";
  });
  html += "</ul>";
  document.getElementById("resultados").innerHTML = html;
}

mostrarResultados();
