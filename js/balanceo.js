/* =========================================================
   balanceo.js — El algoritmo que arma equipos parejos.

   No toca la pantalla ni guarda nada: recibe los jugadores presentes
   y devuelve combinaciones de equipos. Por eso se puede probar en tests.html.

   CÓMO FUNCIONA (resumen):
   1. Reparto inicial: se ordena a los jugadores por nota (con un poco de azar
      para no salir siempre igual) y se reparten "en serpiente":
      equipo 1, 2, 3, 3, 2, 1, 1, 2, 3...
   2. Mejora: se prueban intercambios de jugadores entre equipos (y pasar uno de
      un equipo a otro, si los equipos tienen distinta cantidad). Si el cambio
      deja los equipos más parejos o cumple más reglas, se queda.
   3. Esto se repite muchas veces desde repartos iniciales distintos, y se juntan
      todas las combinaciones distintas que salieron, ordenadas de mejor a peor.

   CÓMO SE MIDE QUÉ TAN BUENA ES UNA COMBINACIÓN ("costo", cuanto menos, mejor):
   - Cada regla juntos/separados que no se cumple suma muchísimo (1000).
   - Cada posición clave mal repartida (ej: dos arqueros juntos pudiendo
     evitarlo) también suma 1000.
   - Después se suma la diferencia entre el equipo con más nota total y el
     de menos. Así, primero se respetan las reglas y después se empareja.
   ========================================================= */

const Balanceo = {
  // Cuántas veces se arma desde cero (más = mejores opciones, pero más lento).
  REINICIOS: 120,

  // "Otra combinación" acepta equipos con hasta esta diferencia de puntos
  // más que la mejor encontrada (para que sigan siendo parejos o casi).
  TOLERANCIA: 2,

  // Lo que "pesa" no cumplir una regla o repartir mal una posición.
  PENALIDAD: 1000,

  /* ---------- Ayudas ---------- */

  // Crea un generador de números al azar que siempre da la misma secuencia
  // para la misma "semilla". Sirve para que las pruebas den siempre igual.
  // (Algoritmo conocido como "mulberry32".)
  crearAzar(semilla) {
    let estado = semilla >>> 0;
    return function () {
      estado = (estado + 0x6d2b79f5) >>> 0;
      let t = estado;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  // Calcula cómo se reparten N jugadores en E equipos.
  // Ej: 11 jugadores en 2 equipos → tamanios [6, 5], sobran 1, faltan 1 (para 6 contra 6).
  analizarCantidad(cantidadJugadores, cantidadEquipos) {
    const base = Math.floor(cantidadJugadores / cantidadEquipos);
    const resto = cantidadJugadores % cantidadEquipos;
    const tamanios = [];
    for (let i = 0; i < cantidadEquipos; i++) {
      tamanios.push(i < resto ? base + 1 : base);
    }
    return {
      tamanios, // cantidad de jugadores de cada equipo
      parejo: resto === 0, // ¿todos los equipos con la misma cantidad?
      sobran: resto, // jugadores de más para equipos iguales de "base"
      faltan: resto === 0 ? 0 : cantidadEquipos - resto, // jugadores que faltan para equipos iguales de "base + 1"
      base, // cantidad del equipo más chico
    };
  },

  // Deja solo las reglas cuyos DOS jugadores están presentes.
  // Si alguno no vino, la regla simplemente no se usa (sin avisar).
  reglasQueAplican(jugadores, reglas) {
    const presentes = new Set(jugadores.map((j) => j.id));
    return reglas.filter((r) => presentes.has(r.jugadores[0]) && presentes.has(r.jugadores[1]));
  },

  // Revisa que se puedan armar equipos. Devuelve el problema (texto) o null si está todo bien.
  validar(entrada) {
    const { jugadores, cantidadEquipos } = entrada;
    if (!Number.isInteger(cantidadEquipos) || cantidadEquipos < 2) {
      return "Elegí al menos 2 equipos.";
    }
    if (jugadores.length < cantidadEquipos) {
      return (
        "Hay " + jugadores.length + (jugadores.length === 1 ? " jugador" : " jugadores") + " para " + cantidadEquipos +
        " equipos. Hace falta al menos 1 jugador por equipo."
      );
    }
    for (const jugador of jugadores) {
      if (!Number.isInteger(jugador.nota) || jugador.nota < 1 || jugador.nota > 10) {
        return "A " + jugador.nombre + " le falta la nota (tiene que ser del 1 al 10).";
      }
    }
    return null;
  },

  /* ---------- Función principal ---------- */

  // Arma equipos.
  // entrada: {
  //   jugadores: [{ id, nombre, nota, posicion }]   (solo los presentes)
  //   cantidadEquipos: número
  //   reglas: [{ tipo: "juntos"|"separados", jugadores: [idA, idB] }]   (las del deporte)
  // }
  // azar: función que da números al azar entre 0 y 1 (por defecto Math.random).
  //
  // Devuelve { ok: false, error } o
  //          { ok: true, opciones: [combinaciones de mejor a peor], avisosGenerales: [textos] }
  armar(entrada, azar = Math.random, reinicios = this.REINICIOS) {
    const error = this.validar(entrada);
    if (error) return { ok: false, error };

    const contexto = this.prepararContexto(entrada);
    const encontradas = new Map(); // clave → combinación (para no repetir)

    for (let vuelta = 0; vuelta < reinicios; vuelta++) {
      const asignacion = this.repartoInicial(contexto, azar);
      this.mejorar(asignacion, contexto);
      const combinacion = this.armarCombinacion(asignacion, contexto);
      if (!encontradas.has(combinacion.clave)) encontradas.set(combinacion.clave, combinacion);
    }

    const opciones = Array.from(encontradas.values()).sort((a, b) => a.costo - b.costo);
    return { ok: true, opciones, avisosGenerales: this.avisosDePosiciones(contexto) };
  },

  /* ---------- Preparación ---------- */

  // Pasa los datos a una forma cómoda para calcular rápido:
  // cada jugador se identifica por su número de orden (0, 1, 2...).
  prepararContexto(entrada) {
    const jugadores = entrada.jugadores;
    const cantidadEquipos = entrada.cantidadEquipos;
    const indicePorId = new Map(jugadores.map((j, i) => [j.id, i]));

    // Posiciones clave presentes (ej: ["Arquero"]) y cuántos hay de cada una.
    const posiciones = [];
    jugadores.forEach((j) => {
      if (j.posicion && !posiciones.includes(j.posicion)) posiciones.push(j.posicion);
    });
    const posicionDe = jugadores.map((j) => (j.posicion ? posiciones.indexOf(j.posicion) : -1));
    const cuantosPorPosicion = posiciones.map((_, p) => posicionDe.filter((x) => x === p).length);

    // Reglas que aplican hoy, con los números de orden de los jugadores.
    const reglas = this.reglasQueAplican(jugadores, entrada.reglas || []).map((r) => ({
      tipo: r.tipo,
      a: indicePorId.get(r.jugadores[0]),
      b: indicePorId.get(r.jugadores[1]),
    }));

    return {
      jugadores,
      cantidadEquipos,
      notas: jugadores.map((j) => j.nota),
      tamanios: this.analizarCantidad(jugadores.length, cantidadEquipos).tamanios,
      posiciones,
      posicionDe,
      cuantosPorPosicion,
      reglas,
    };
  },

  /* ---------- Paso 1: reparto inicial "en serpiente" ---------- */

  // Devuelve una lista donde asignacion[i] = número de equipo del jugador i.
  repartoInicial(contexto, azar) {
    const { notas, cantidadEquipos, tamanios } = contexto;

    // Ordenamos de mayor a menor nota, con un "ruido" al azar de hasta ±1,5 puntos
    // para que no salga siempre el mismo orden entre jugadores parecidos.
    const conRuido = notas.map((nota, i) => ({ i, valor: nota + (azar() - 0.5) * 3 }));
    conRuido.sort((x, y) => y.valor - x.valor);

    const asignacion = new Array(notas.length);
    const ocupados = new Array(cantidadEquipos).fill(0);
    let equipo = 0;
    let direccion = 1; // 1 = avanzando, -1 = volviendo

    // Pasa al siguiente equipo en serpiente: 0,1,2,2,1,0,0,1,2...
    const avanzar = () => {
      equipo += direccion;
      if (equipo === cantidadEquipos) {
        equipo = cantidadEquipos - 1;
        direccion = -1;
      } else if (equipo === -1) {
        equipo = 0;
        direccion = 1;
      }
    };

    conRuido.forEach(({ i }) => {
      // Si el equipo ya está completo, seguimos al próximo.
      while (ocupados[equipo] >= tamanios[equipo]) avanzar();
      asignacion[i] = equipo;
      ocupados[equipo]++;
      avanzar();
    });
    return asignacion;
  },

  /* ---------- Cálculo del "costo" de una combinación ---------- */

  // Devuelve { costo, violaciones, totales }. Cuanto menor el costo, mejor.
  calcularCosto(asignacion, contexto) {
    const { notas, cantidadEquipos, posicionDe, posiciones, cuantosPorPosicion, reglas } = contexto;
    const cantidadPosiciones = posiciones.length;

    const totales = new Array(cantidadEquipos).fill(0);
    const conteo = new Array(cantidadEquipos * cantidadPosiciones).fill(0); // [equipo][posición]
    for (let i = 0; i < notas.length; i++) {
      totales[asignacion[i]] += notas[i];
      if (posicionDe[i] >= 0) conteo[asignacion[i] * cantidadPosiciones + posicionDe[i]]++;
    }

    let violaciones = 0;

    // Reglas juntos / separados
    for (const regla of reglas) {
      const mismoEquipo = asignacion[regla.a] === asignacion[regla.b];
      if (regla.tipo === "separados" && mismoEquipo) violaciones++;
      if (regla.tipo === "juntos" && !mismoEquipo) violaciones++;
    }

    // Posiciones: cada equipo debería tener su "parte justa".
    // Ej: 2 arqueros y 2 equipos → 1 cada uno. 3 arqueros y 2 equipos → 1 o 2.
    for (let p = 0; p < cantidadPosiciones; p++) {
      const piso = Math.floor(cuantosPorPosicion[p] / cantidadEquipos);
      const techo = Math.ceil(cuantosPorPosicion[p] / cantidadEquipos);
      for (let e = 0; e < cantidadEquipos; e++) {
        const tiene = conteo[e * cantidadPosiciones + p];
        if (tiene > techo) violaciones += tiene - techo;
        if (tiene < piso) violaciones += piso - tiene;
      }
    }

    // Parejo: diferencia entre el equipo de más nota total y el de menos.
    const maximo = Math.max(...totales);
    const minimo = Math.min(...totales);
    // Desempate fino: qué tan lejos está cada equipo del promedio (útil con 3 o más equipos).
    const media = totales.reduce((s, t) => s + t, 0) / cantidadEquipos;
    const desvio = totales.reduce((s, t) => s + (t - media) * (t - media), 0);

    return {
      costo: violaciones * this.PENALIDAD + (maximo - minimo) + desvio * 0.0001,
      violaciones,
      totales,
    };
  },

  /* ---------- Paso 2: mejorar con intercambios ---------- */

  // Modifica la asignación probando cambios mientras alguno mejore el costo.
  mejorar(asignacion, contexto) {
    const cantidad = asignacion.length;
    const tamanioMinimo = Math.min(...contexto.tamanios);
    const tamanioMaximo = Math.max(...contexto.tamanios);
    const ocupados = new Array(contexto.cantidadEquipos).fill(0);
    asignacion.forEach((e) => ocupados[e]++);

    let costoActual = this.calcularCosto(asignacion, contexto).costo;
    let mejoro = true;
    let vueltas = 0;

    while (mejoro && vueltas < 50) {
      mejoro = false;
      vueltas++;

      // a) Intercambiar dos jugadores de equipos distintos
      for (let a = 0; a < cantidad; a++) {
        for (let b = a + 1; b < cantidad; b++) {
          const equipoA = asignacion[a];
          const equipoB = asignacion[b];
          if (equipoA === equipoB) continue;

          asignacion[a] = equipoB;
          asignacion[b] = equipoA;
          const nuevo = this.calcularCosto(asignacion, contexto).costo;
          if (nuevo < costoActual - 1e-9) {
            costoActual = nuevo; // nos quedamos con el cambio
            mejoro = true;
          } else {
            asignacion[a] = equipoA; // lo deshacemos
            asignacion[b] = equipoB;
          }
        }
      }

      // b) Pasar un jugador de un equipo grande a uno chico
      //    (solo si los equipos tienen distinta cantidad, ej: 6 y 5)
      if (tamanioMaximo > tamanioMinimo) {
        for (let a = 0; a < cantidad; a++) {
          const origen = asignacion[a];
          if (ocupados[origen] !== tamanioMaximo) continue;
          for (let destino = 0; destino < contexto.cantidadEquipos; destino++) {
            if (destino === origen || ocupados[destino] !== tamanioMinimo) continue;

            asignacion[a] = destino;
            const nuevo = this.calcularCosto(asignacion, contexto).costo;
            if (nuevo < costoActual - 1e-9) {
              costoActual = nuevo;
              ocupados[origen]--;
              ocupados[destino]++;
              mejoro = true;
              break;
            }
            asignacion[a] = origen;
          }
        }
      }
    }
  },

  /* ---------- Resultado ---------- */

  // Convierte una asignación en una combinación lista para mostrar.
  armarCombinacion(asignacion, contexto) {
    const { jugadores, cantidadEquipos, reglas, posiciones, cuantosPorPosicion } = contexto;
    const calculo = this.calcularCosto(asignacion, contexto);

    // Jugadores de cada equipo, de mayor a menor nota.
    let equipos = [];
    for (let e = 0; e < cantidadEquipos; e++) equipos.push([]);
    jugadores.forEach((j, i) => equipos[asignacion[i]].push(j));
    equipos.forEach((lista) => lista.sort((x, y) => y.nota - x.nota || x.nombre.localeCompare(y.nombre, "es")));

    // Ordenamos los equipos siempre igual, así la misma combinación tiene la misma "clave".
    const claveDe = (lista) => lista.map((j) => j.id).sort().join(",");
    equipos.sort((x, y) => (claveDe(x) < claveDe(y) ? -1 : 1));

    const resumen = equipos.map((lista) => {
      const total = lista.reduce((s, j) => s + j.nota, 0);
      return { jugadores: lista, total, promedio: Math.round((total / lista.length) * 100) / 100 };
    });
    const totales = resumen.map((r) => r.total);
    const promedios = resumen.map((r) => r.promedio);

    // Qué no se pudo cumplir (en lenguaje simple).
    const avisos = [];
    reglas.forEach((regla) => {
      const mismoEquipo = asignacion[regla.a] === asignacion[regla.b];
      const incumplida = (regla.tipo === "separados" && mismoEquipo) || (regla.tipo === "juntos" && !mismoEquipo);
      if (incumplida) {
        avisos.push(
          'No se pudo cumplir la regla "' + jugadores[regla.a].nombre + " y " + jugadores[regla.b].nombre +
            ": siempre " + regla.tipo + '" (choca con otras reglas o con la cantidad de equipos).'
        );
      }
    });
    posiciones.forEach((posicion, p) => {
      const piso = Math.floor(cuantosPorPosicion[p] / cantidadEquipos);
      const techo = Math.ceil(cuantosPorPosicion[p] / cantidadEquipos);
      const malRepartida = resumen.some((r) => {
        const tiene = r.jugadores.filter((j) => j.posicion === posicion).length;
        return tiene > techo || tiene < piso;
      });
      if (malRepartida) {
        avisos.push('No se pudo repartir bien la posición "' + posicion + '" entre los equipos (por las reglas juntos/separados).');
      }
    });

    return {
      equipos: resumen,
      diferencia: Math.max(...totales) - Math.min(...totales),
      diferenciaPromedio: Math.round((Math.max(...promedios) - Math.min(...promedios)) * 100) / 100,
      mismaCantidad: resumen.every((r) => r.jugadores.length === resumen[0].jugadores.length),
      violaciones: calculo.violaciones,
      avisos,
      costo: calculo.costo,
      clave: equipos.map(claveDe).join("|"),
    };
  },

  // Avisos que no dependen de la combinación: posiciones que no alcanzan o sobran.
  avisosDePosiciones(contexto) {
    const { posiciones, cuantosPorPosicion, cantidadEquipos } = contexto;
    const avisos = [];
    posiciones.forEach((posicion, p) => {
      const cuantos = cuantosPorPosicion[p];
      if (cuantos > cantidadEquipos) {
        avisos.push(
          "Hay " + cuantos + ' jugadores con la posición "' + posicion + '" para ' + cantidadEquipos +
            " equipos: algún equipo va a tener más de uno."
        );
      } else if (cuantos < cantidadEquipos) {
        avisos.push(
          "Hay " + (cuantos === 1 ? "solo 1 jugador" : cuantos + " jugadores") + ' con la posición "' + posicion + '" para ' +
            cantidadEquipos + ' equipos: algún equipo va a quedar sin "' + posicion + '".'
        );
      }
    });
    return avisos;
  },

  /* ---------- "Otra combinación" ---------- */

  // ¿Es casi tan buena como la mejor? (cumple lo mismo y la diferencia es parecida)
  esBuena(combinacion, mejor) {
    return combinacion.violaciones <= mejor.violaciones && combinacion.diferencia <= mejor.diferencia + this.TOLERANCIA;
  },

  // Cuántas combinaciones buenas hay en total.
  contarBuenas(opciones) {
    return opciones.filter((o) => this.esBuena(o, opciones[0])).length;
  },

  // Conjunto de parejas de compañeros de equipo: "idA|idB".
  parejasDeCompaneros(combinacion) {
    const parejas = new Set();
    combinacion.equipos.forEach((equipo) => {
      const ids = equipo.jugadores.map((j) => j.id).sort();
      for (let x = 0; x < ids.length; x++) {
        for (let y = x + 1; y < ids.length; y++) parejas.add(ids[x] + "|" + ids[y]);
      }
    });
    return parejas;
  },

  // Qué tan distintas son dos combinaciones: cuántas parejas de compañeros cambian.
  distancia(combinacionA, combinacionB) {
    const a = this.parejasDeCompaneros(combinacionA);
    const b = this.parejasDeCompaneros(combinacionB);
    let distintas = 0;
    a.forEach((p) => {
      if (!b.has(p)) distintas++;
    });
    b.forEach((p) => {
      if (!a.has(p)) distintas++;
    });
    return distintas;
  },

  /* ---------- Texto para compartir ---------- */

  // Un emoji según el deporte (para el texto de WhatsApp y los botones).
  iconoDeporte(nombreDeporte) {
    const nombre = String(nombreDeporte).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (nombre.includes("futbol")) return "⚽";
    if (nombre.includes("voley") || nombre.includes("volei")) return "🏐";
    if (nombre.includes("basquet") || nombre.includes("basket")) return "🏀";
    if (nombre.includes("tenis") || nombre.includes("padel")) return "🎾";
    if (nombre.includes("rugby")) return "🏉";
    if (nombre.includes("hockey")) return "🏑";
    return "🏆";
  },

  // Texto simple para pegar en WhatsApp. A propósito NO incluye las notas
  // (para que nadie se sienta mal al ver su número en el grupo).
  // Los *asteriscos* hacen que WhatsApp lo muestre en negrita.
  textoParaCompartir(nombreDeporte, combinacion, fecha) {
    const dos = (n) => String(n).padStart(2, "0");
    const fechaTexto = dos(fecha.getDate()) + "/" + dos(fecha.getMonth() + 1) + "/" + fecha.getFullYear();
    const lineas = [this.iconoDeporte(nombreDeporte) + " *" + nombreDeporte + "* · " + fechaTexto];
    combinacion.equipos.forEach((equipo, i) => {
      lineas.push("");
      lineas.push("*Equipo " + (i + 1) + "*");
      equipo.jugadores.forEach((j) => {
        lineas.push("• " + j.nombre + (j.posicion ? " (" + j.posicion + ")" : ""));
      });
    });
    return lineas.join("\n");
  },

  // Elige la próxima combinación para mostrar con "Otra combinación".
  // - Solo entre las buenas (parejas o casi).
  // - Que no se haya mostrado antes (clavesMostradas).
  // - De esas, la MÁS DISTINTA a las ya mostradas, para que cambien de verdad los compañeros.
  // Devuelve la combinación, o null si ya se mostraron todas las buenas.
  elegirOtra(opciones, clavesMostradas) {
    if (opciones.length === 0) return null;
    const mejor = opciones[0];
    const candidatas = opciones.filter((o) => this.esBuena(o, mejor) && !clavesMostradas.includes(o.clave));
    if (candidatas.length === 0) return null;

    const mostradas = opciones.filter((o) => clavesMostradas.includes(o.clave));
    if (mostradas.length === 0) return candidatas[0];

    let elegida = null;
    let mayorDistancia = -1;
    candidatas.forEach((candidata) => {
      // Distancia a la mostrada más parecida (queremos que esa sea grande).
      const distanciaMinima = Math.min(...mostradas.map((m) => this.distancia(candidata, m)));
      // Si empatan, gana la más pareja (menor costo), que ya viene primero en la lista.
      if (distanciaMinima > mayorDistancia) {
        mayorDistancia = distanciaMinima;
        elegida = candidata;
      }
    });
    return elegida;
  },
};
