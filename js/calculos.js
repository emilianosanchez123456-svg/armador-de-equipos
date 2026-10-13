/* =========================================================
   calculos.js — Cuentas para las estadísticas (y, más adelante,
   para las sugerencias de notas).

   No toca la pantalla ni guarda nada: recibe los datos y devuelve números.
   Por eso se puede probar en tests.html.
   ========================================================= */

// Mínimo de partidos (con resultado, desde el último cambio de nota) para sugerir algo.
const MINIMO_PARTIDOS_SUGERENCIA = 3;

// Qué tan "por encima o por debajo de lo esperado" tiene que rendir para sugerir ±1.
// 0,3 equivale, por ejemplo, a ganar 3 de 3 o 4 de 5 partidos parejos.
const UMBRAL_SUGERENCIA = 0.3;

const Calculos = {
  /* ---------- Ayudas ---------- */

  // Redondea a 2 decimales: 1.3333 → 1.33
  redondear(numero) {
    return Math.round(numero * 100) / 100;
  },

  // Promedio de una lista de números (null si está vacía).
  promedio(lista) {
    if (lista.length === 0) return null;
    return this.redondear(lista.reduce((s, x) => s + x, 0) / lista.length);
  },

  // Porcentaje entero: porcentaje(7, 12) → 58. Null si el total es 0.
  porcentaje(parte, total) {
    if (total === 0) return null;
    return Math.round((parte / total) * 100);
  },

  // ¿Cómo le fue a un jugador en un partido?
  // Devuelve "ganado", "empatado", "perdido", "sin-resultado",
  // o null si ese jugador no jugó ese partido.
  resultadoDeJugador(partido, jugadorId) {
    const equipo = partido.equipos.findIndex((e) => e.jugadores.some((j) => j.jugadorId === jugadorId));
    if (equipo === -1) return null;
    const ganador = Cambios.ganadorDe(partido);
    if (!ganador) return "sin-resultado";
    if (!ganador.ganadores.includes(equipo)) return "perdido";
    return ganador.empate ? "empatado" : "ganado";
  },

  /* ---------- Evaluación automática ("¿fue parejo?") ---------- */

  // Calcula sola si un partido fue parejo según el resultado.
  // Mira dos cosas, para que sirva en cualquier deporte:
  //   - la diferencia (ganador menos perdedor), y
  //   - qué tan grande es esa diferencia comparada con el puntaje del ganador.
  // Ejemplos: fútbol 2 a 1 → Parejo, 3 a 1 → Algo desparejo, 4 a 1 → Muy desparejo;
  //           vóley (sets) 3 a 2 → Parejo, 3 a 0 → Muy desparejo;
  //           básquet 80 a 75 → Parejo, 80 a 60 → Algo desparejo, 80 a 40 → Muy desparejo.
  // Devuelve null si no hay resultado.
  evaluacionAutomatica(resultado) {
    if (!resultado || resultado.length < 2) return null;
    const maximo = Math.max(...resultado);
    const diferencia = maximo - Math.min(...resultado);
    if (diferencia === 0) return "Parejo";

    const proporcion = diferencia / maximo; // 1 a 0 → 1; 80 a 75 → 0,06
    if (diferencia <= 1 || proporcion <= 0.15) return "Parejo";
    if (diferencia >= 3 && proporcion >= 0.5) return "Muy desparejo";
    return "Algo desparejo";
  },

  // La evaluación que vale para un partido: la elegida a mano, o si no, la automática.
  evaluacionFinal(partido) {
    return partido.evaluacion || this.evaluacionAutomatica(partido.resultado);
  },

  /* ---------- Partidos pendientes ---------- */

  // Partidos sin resultado de días anteriores (los de hoy quizás todavía no se jugaron),
  // del más viejo al más nuevo.
  partidosPendientes(datos, ahora = new Date()) {
    const inicioDeHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).toISOString();
    return datos.partidos
      .filter((p) => !p.resultado && p.fecha < inicioDeHoy)
      .sort((a, b) => (a.fecha < b.fecha ? -1 : 1));
  },

  /* ---------- Por deporte ---------- */

  // Resumen de los partidos de un deporte.
  estadisticasDeporte(datos, deporteId) {
    const partidos = datos.partidos.filter((p) => p.deporteId === deporteId);
    const conResultado = partidos.filter((p) => p.resultado);

    // Evaluaciones: cuántos "Parejo", "Algo desparejo", "Muy desparejo" y sin evaluar.
    // Si no se eligió a mano, se usa la automática (según el resultado).
    const evaluaciones = {};
    EVALUACIONES.forEach((e) => (evaluaciones[e] = 0));
    let sinEvaluar = 0;
    let automaticas = 0;
    partidos.forEach((p) => {
      const final = this.evaluacionFinal(p);
      if (final && evaluaciones[final] !== undefined) {
        evaluaciones[final]++;
        if (!p.evaluacion) automaticas++;
      } else {
        sinEvaluar++;
      }
    });

    // Diferencia de resultado: ganador menos perdedor (ej: 3 a 1 → 2).
    const diferenciasResultado = conResultado.map((p) => Math.max(...p.resultado) - Math.min(...p.resultado));

    return {
      total: partidos.length,
      conResultado: conResultado.length,
      evaluaciones,
      sinEvaluar,
      automaticas, // cuántas evaluaciones salieron solas del resultado
      evaluados: partidos.length - sinEvaluar,
      parejos: evaluaciones["Parejo"],
      desparejos: evaluaciones["Algo desparejo"] + evaluaciones["Muy desparejo"],
      empates: conResultado.filter((p) => Cambios.ganadorDe(p).empate).length,
      diferenciaPromedioResultado: this.promedio(diferenciasResultado),
      diferenciaPromedioNotas: this.promedio(partidos.map((p) => p.diferencia)),
    };
  },

  /* ---------- Por jugador ---------- */

  // Estadísticas de un jugador, una por cada deporte donde tiene nota o jugó.
  // Devuelve [{ deporteId, nombreDeporte, nota, jugados, ganados, empatados, perdidos,
  //             sinResultado, conResultado, porcentajeGanados, historial }]
  estadisticasJugador(datos, jugadorId) {
    const jugador = Cambios.buscarJugador(datos, jugadorId);
    const lista = [];

    datos.deportes.forEach((deporte) => {
      const cuenta = { ganado: 0, empatado: 0, perdido: 0, "sin-resultado": 0 };
      let jugados = 0;
      datos.partidos
        .filter((p) => p.deporteId === deporte.id)
        .forEach((p) => {
          const resultado = this.resultadoDeJugador(p, jugadorId);
          if (resultado === null) return; // no jugó
          jugados++;
          cuenta[resultado]++;
        });

      const nota = jugador ? Cambios.notaDe(jugador, deporte.id) : null;
      if (jugados === 0 && nota === null) return; // ni jugó ni tiene nota: no lo mostramos

      const info = jugador && jugador.porDeporte[deporte.id];
      const conResultado = cuenta.ganado + cuenta.empatado + cuenta.perdido;
      lista.push({
        deporteId: deporte.id,
        nombreDeporte: deporte.nombre,
        nota,
        jugados,
        ganados: cuenta.ganado,
        empatados: cuenta.empatado,
        perdidos: cuenta.perdido,
        sinResultado: cuenta["sin-resultado"],
        conResultado,
        porcentajeGanados: this.porcentaje(cuenta.ganado, conResultado),
        historial: info ? info.historialNotas.slice() : [],
      });
    });
    return lista;
  },

  // Total de partidos jugados por un jugador (todos los deportes).
  partidosJugados(datos, jugadorId) {
    return datos.partidos.filter((p) => this.resultadoDeJugador(p, jugadorId) !== null).length;
  },

  /* ---------- Sugerencias de ajuste de notas ----------

     IDEA: si alguien gana más de lo que se esperaba según las notas de los equipos,
     quizás su nota es baja (y al revés).

     Para cada partido con resultado se calcula:
     - "Ventaja": nota total de su equipo menos el promedio de los rivales.
     - "Esperado": qué tan probable era ganar con esa ventaja (con equipos
       parejos, 50% en 2 equipos; más si su equipo tenía más nota).
     - "Real": 1 si ganó, 0,5 si empató (2 equipos), 0 si perdió.
     El "rendimiento" es el promedio de (real - esperado). Si es claramente
     positivo, se sugiere +1; si es claramente negativo, -1.

     Solo se cuentan los partidos jugados DESPUÉS del último cambio de nota
     (o del último "Rechazar"), así no se sugiere lo mismo una y otra vez. */

  // Ventaja en puntos de nota que hace "esperable" ganar (más grande = más gradual).
  ESCALA_VENTAJA: 4,

  // Probabilidad "esperada" de ganar según la ventaja de nota.
  // Con 2 equipos parejos (ventaja 0) da 0,5; con 3 equipos parejos, 0,33.
  esperadoDe(ventaja, cantidadEquipos) {
    const curva = 1 / (1 + Math.exp(-ventaja / this.ESCALA_VENTAJA)); // entre 0 y 1, 0,5 si ventaja = 0
    return Math.min(1, (2 / cantidadEquipos) * curva);
  },

  // Analiza los partidos recientes de un jugador en un deporte.
  // Devuelve null si no tiene nota en ese deporte.
  analizarRendimiento(datos, jugador, deporteId) {
    const info = jugador.porDeporte[deporteId];
    if (!info || typeof info.nota !== "number") return null;

    // Desde cuándo contar: último cambio de nota o último "Rechazar" (lo más nuevo).
    const historial = info.historialNotas;
    let desde = historial.length > 0 ? historial[historial.length - 1].fecha : "";
    if (info.sugerenciaRechazadaEl && info.sugerenciaRechazadaEl > desde) desde = info.sugerenciaRechazadaEl;

    const analisis = { partidos: 0, ganados: 0, empatados: 0, perdidos: 0, sinVentaja: 0, conVentaja: 0, rendimiento: 0 };
    let suma = 0;

    datos.partidos.forEach((partido) => {
      if (partido.deporteId !== deporteId || !partido.resultado || !(partido.fecha > desde)) return;
      const equipo = partido.equipos.findIndex((e) => e.jugadores.some((j) => j.jugadorId === jugador.id));
      if (equipo === -1) return; // no jugó

      const cantidadEquipos = partido.equipos.length;
      const totales = partido.equipos.map((e) => e.jugadores.reduce((s, j) => s + j.nota, 0));
      const totalRivales = totales.reduce((s, t) => s + t, 0) - totales[equipo];
      const ventaja = totales[equipo] - totalRivales / (cantidadEquipos - 1);

      const ganador = Cambios.ganadorDe(partido);
      const real = ganador.ganadores.includes(equipo) ? 1 / ganador.ganadores.length : 0;
      suma += real - this.esperadoDe(ventaja, cantidadEquipos);

      analisis.partidos++;
      if (!ganador.ganadores.includes(equipo)) analisis.perdidos++;
      else if (ganador.empate) analisis.empatados++;
      else analisis.ganados++;
      if (ventaja <= 0) analisis.sinVentaja++; // su equipo tenía igual o menos nota
      if (ventaja >= 0) analisis.conVentaja++; // su equipo tenía igual o más nota
    });

    if (analisis.partidos > 0) analisis.rendimiento = this.redondear(suma / analisis.partidos);
    return analisis;
  },

  // Todas las sugerencias de notas para revisar, las más claras primero.
  sugerencias(datos) {
    const lista = [];
    datos.jugadores.forEach((jugador) => {
      datos.deportes.forEach((deporte) => {
        const analisis = this.analizarRendimiento(datos, jugador, deporte.id);
        if (!analisis || analisis.partidos < MINIMO_PARTIDOS_SUGERENCIA) return;

        const nota = jugador.porDeporte[deporte.id].nota;
        let direccion = 0;
        if (analisis.rendimiento >= UMBRAL_SUGERENCIA && nota < 10) direccion = 1;
        if (analisis.rendimiento <= -UMBRAL_SUGERENCIA && nota > 1) direccion = -1;
        if (direccion === 0) return;

        lista.push({
          jugadorId: jugador.id,
          nombre: jugador.nombre,
          deporteId: deporte.id,
          nombreDeporte: deporte.nombre,
          notaActual: nota,
          notaSugerida: nota + direccion,
          direccion,
          analisis,
          motivo: this.textoMotivo(nota, direccion, analisis),
        });
      });
    });
    lista.sort((a, b) => Math.abs(b.analisis.rendimiento) - Math.abs(a.analisis.rendimiento));
    return lista;
  },

  // La explicación en una frase. Ej:
  // "En sus últimos 4 partidos con nota 7 ganó 4, siempre con un equipo de igual o menos nota
  //  que el rival: parece rendir más de lo que dice su nota."
  textoMotivo(nota, direccion, a) {
    const veces = (n) => (n === 1 ? "1 vez" : n + " veces");
    let texto = "En sus últimos " + a.partidos + " partidos con nota " + nota + " ";

    if (direccion === 1) {
      texto += "ganó " + a.ganados + (a.empatados > 0 ? " y empató " + a.empatados : "");
      if (a.sinVentaja === a.partidos) texto += ", siempre con un equipo de igual o menos nota que el rival";
      else if (a.sinVentaja > 0) texto += ", " + veces(a.sinVentaja) + " con un equipo de igual o menos nota que el rival";
      return texto + ": parece rendir más de lo que dice su nota.";
    }

    texto += "perdió " + a.perdidos + (a.empatados > 0 ? " y empató " + a.empatados : "");
    if (a.conVentaja === a.partidos) texto += ", siempre con un equipo de igual o más nota que el rival";
    else if (a.conVentaja > 0) texto += ", " + veces(a.conVentaja) + " con un equipo de igual o más nota que el rival";
    return texto + ": parece rendir menos de lo que dice su nota.";
  },
};
