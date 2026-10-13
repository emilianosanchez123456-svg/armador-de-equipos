/* =========================================================
   pantalla-estadisticas.js — Pantalla "Estadísticas".
   - Por deporte: partidos parejos / desparejos, diferencia promedio de resultado
   - Por jugador: partidos jugados, ganados / empatados / perdidos por deporte,
     y la evolución de su nota (gráfico + lista)

   Las cuentas están en calculos.js; acá solo se dibujan.
   ========================================================= */

// Colores de las evaluaciones (verificados para personas daltónicas;
// siempre van acompañados de su texto y su número).
const COLORES_EVALUACION = {
  Parejo: "#1e7b4f",
  "Algo desparejo": "#e0a21a",
  "Muy desparejo": "#d9603b",
  "Sin evaluar": "#c9cfcb",
};

Pantallas.estadisticas = {
  titulo: "Estadísticas",

  estado: {
    vista: "deportes", // "deportes" o "jugadores"
    busqueda: "",
    jugadorId: null, // jugador abierto en detalle
  },

  /* ---------- Dibujo general ---------- */

  dibujar(contenedor) {
    const datos = Datos.actuales;
    let html = '<div id="pantalla-estadisticas"><h2 class="pantalla-titulo">Estadísticas</h2>';

    if (datos.partidos.length === 0 && datos.jugadores.length === 0) {
      html += UI.htmlVacio({
        icono: "📊",
        titulo: "Todavía no hay estadísticas",
        texto:
          "Las estadísticas se arman con los partidos que guardes. Cargá jugadores, armá equipos, " +
          "confirmá el partido y después cargá el resultado.",
        boton: { texto: "Armar equipos", irA: "armar" },
      });
      contenedor.innerHTML = html + "</div>";
      return;
    }

    // Selector de vista: "Por deporte" / "Por jugador"
    const botonVista = (valor, texto) =>
      '<button type="button" class="filtro' + (this.estado.vista === valor ? " filtro-activo" : "") +
      '" data-accion="vista" data-vista="' + valor + '" aria-pressed="' + (this.estado.vista === valor) + '">' + texto + "</button>";
    html +=
      '<div class="filtros" role="group" aria-label="Ver estadísticas">' +
      botonVista("deportes", "Por deporte") +
      botonVista("jugadores", "Por jugador") +
      "</div>";

    html += this.estado.vista === "deportes" ? this.htmlPorDeporte() : this.htmlPorJugador();
    html += "</div>";

    contenedor.innerHTML = html;
    this.conectarEventos(contenedor.querySelector("#pantalla-estadisticas"));
    if (this.estado.vista === "jugadores") this.dibujarListaJugadores();
  },

  /* ---------- Por deporte ---------- */

  htmlPorDeporte() {
    const datos = Datos.actuales;
    if (datos.partidos.length === 0) {
      return UI.htmlVacio({
        icono: "📊",
        titulo: "Todavía no hay partidos",
        texto: 'Cuando confirmes partidos y cargues su resultado en el Historial, acá vas a ver si los equipos salieron parejos.',
        boton: { texto: "Armar equipos", irA: "armar" },
      });
    }

    let html = "";
    const sinPartidos = [];
    datos.deportes.forEach((deporte) => {
      const e = Calculos.estadisticasDeporte(datos, deporte.id);
      if (e.total === 0) {
        sinPartidos.push(deporte.nombre);
        return;
      }
      html +=
        '<article class="tarjeta">' +
        "<h3>" + Balanceo.iconoDeporte(deporte.nombre) + " " + UI.escapar(deporte.nombre) + "</h3>" +
        '<div class="grilla-numeros">' +
        this.htmlNumero(e.total, e.total === 1 ? "partido" : "partidos") +
        this.htmlNumero(e.conResultado, "con resultado") +
        this.htmlNumero(e.diferenciaPromedioResultado === null ? "—" : UI.numero(e.diferenciaPromedioResultado), "diferencia promedio de resultado") +
        this.htmlNumero(e.empates, e.empates === 1 ? "empate" : "empates") +
        "</div>";

      // ¿Qué tan parejos fueron?
      html += "<h4>¿Qué tan parejos fueron?</h4>";
      if (e.evaluados === 0) {
        html +=
          '<p class="texto-suave">Todavía no hay partidos con resultado. Cuando lo cargues en el Historial, ' +
          "la app calcula sola si fue parejo (y también lo podés elegir a mano).</p>";
      } else {
        html +=
          "<p>De " + UI.plural(e.evaluados, "partido evaluado", "partidos evaluados") + ", <strong>" +
          UI.plural(e.parejos, "fue parejo", "fueron parejos") + "</strong> (" + Calculos.porcentaje(e.parejos, e.evaluados) +
          "%) y <strong>" + UI.plural(e.desparejos, "fue desparejo", "fueron desparejos") + "</strong>.</p>";
        html += this.htmlBarraEvaluaciones(e);
        if (e.automaticas > 0) {
          html +=
            '<p class="ayuda">' +
            (e.automaticas === 1
              ? "1 partido no se evaluó a mano: se usó la evaluación automática según el resultado."
              : e.automaticas + " partidos no se evaluaron a mano: se usó la evaluación automática según el resultado.") +
            "</p>";
        }
      }

      html +=
        '<p class="ayuda">"Diferencia promedio de resultado": cuántos goles, puntos o sets de diferencia hubo en promedio ' +
        "entre ganador y perdedor. Cuanto más baja, más parejos los partidos. " +
        "Diferencia promedio de notas al armar: " + UI.numero(e.diferenciaPromedioNotas) + ".</p>";
      html += "</article>";
    });

    if (sinPartidos.length > 0) {
      html += '<p class="texto-suave">Todavía sin partidos: ' + UI.escapar(UI.listaConY(sinPartidos)) + ".</p>";
    }
    return html;
  },

  // Número grande con su explicación debajo.
  htmlNumero(valor, etiqueta) {
    return (
      '<div class="numero-destacado">' +
      '<span class="numero-destacado-valor">' + valor + "</span>" +
      '<span class="numero-destacado-etiqueta">' + etiqueta + "</span>" +
      "</div>"
    );
  },

  // Barra dividida: cuántos Parejo / Algo desparejo / Muy desparejo / Sin evaluar.
  // Cada parte tiene su leyenda con texto y número (el color nunca va solo).
  htmlBarraEvaluaciones(e) {
    const partes = EVALUACIONES.map((nombre) => ({ nombre, cantidad: e.evaluaciones[nombre] }));
    partes.push({ nombre: "Sin evaluar", cantidad: e.sinEvaluar });
    const visibles = partes.filter((p) => p.cantidad > 0);

    let html = '<div class="barra-evaluaciones" role="img" aria-label="' +
      visibles.map((p) => p.nombre + ": " + p.cantidad).join(", ") + '">';
    visibles.forEach((p) => {
      html +=
        '<span class="barra-evaluaciones-parte" style="flex-grow:' + p.cantidad + ";background:" + COLORES_EVALUACION[p.nombre] +
        '" title="' + p.nombre + ": " + p.cantidad + '"></span>';
    });
    html += '</div><ul class="leyenda">';
    partes.forEach((p) => {
      html +=
        '<li><span class="leyenda-muestra" style="background:' + COLORES_EVALUACION[p.nombre] + '"></span>' +
        p.nombre + ": <strong>" + p.cantidad + "</strong></li>";
    });
    html += "</ul>";
    return html;
  },

  /* ---------- Por jugador ---------- */

  htmlPorJugador() {
    if (Datos.actuales.jugadores.length === 0) {
      return UI.htmlVacio({
        icono: "👥",
        titulo: "Todavía no hay jugadores",
        texto: "Agregá jugadores en la pantalla Jugadores para ver sus estadísticas.",
        boton: { texto: "Ir a Jugadores", irA: "jugadores" },
      });
    }
    return (
      '<div class="campo">' +
      '  <label for="buscar-estadistica">Buscar jugador</label>' +
      '  <input type="search" id="buscar-estadistica" placeholder="Escribí un nombre" autocomplete="off" value="' +
      UI.escapar(this.estado.busqueda) + '">' +
      "</div>" +
      '<div id="lista-estadisticas"></div>'
    );
  },

  // Lista de jugadores (se redibuja sola al buscar, para no perder lo escrito).
  dibujarListaJugadores() {
    const zona = document.getElementById("lista-estadisticas");
    if (!zona) return;
    const datos = Datos.actuales;
    const buscado = Cambios.normalizar(this.estado.busqueda);
    const jugadores = Cambios.ordenarPorNombre(datos.jugadores).filter((j) => Cambios.normalizar(j.nombre).includes(buscado));

    if (jugadores.length === 0) {
      zona.innerHTML = '<p class="texto-suave">No hay ningún jugador que se llame "' + UI.escapar(this.estado.busqueda.trim()) + '".</p>';
      return;
    }

    let html = "";
    jugadores.forEach((jugador) => {
      if (jugador.id === this.estado.jugadorId) {
        html += this.htmlDetalleJugador(jugador);
        return;
      }
      const jugados = Calculos.partidosJugados(datos, jugador.id);
      html +=
        '<div class="tarjeta fila-estadistica">' +
        "<div><strong>" + UI.escapar(jugador.nombre) + "</strong>" +
        '<span class="texto-suave"> · ' + UI.plural(jugados, "partido", "partidos") + "</span></div>" +
        '<button type="button" class="boton boton-secundario boton-chico" data-accion="ver-jugador" data-id="' + jugador.id +
        '">Ver estadísticas</button>' +
        "</div>";
    });
    zona.innerHTML = html;
    this.dibujarGraficos();
  },

  // Detalle de un jugador: un bloque por deporte.
  htmlDetalleJugador(jugador) {
    const estadisticas = Calculos.estadisticasJugador(Datos.actuales, jugador.id);
    let html =
      '<article class="tarjeta tarjeta-editando" id="detalle-jugador">' +
      '<div class="tarjeta-cabecera">' +
      "  <h3>" + UI.escapar(jugador.nombre) + "</h3>" +
      '  <button type="button" class="boton boton-secundario boton-chico" data-accion="cerrar-jugador">Cerrar</button>' +
      "</div>";

    if (estadisticas.length === 0) {
      html += '<p class="texto-suave">Todavía no tiene notas ni partidos.</p>';
    }

    estadisticas.forEach((e) => {
      html +=
        '<section class="seccion">' +
        "<h4>" + Balanceo.iconoDeporte(e.nombreDeporte) + " " + UI.escapar(e.nombreDeporte) + "</h4>" +
        '<div class="grilla-numeros">' +
        this.htmlNumero(e.jugados, e.jugados === 1 ? "jugado" : "jugados") +
        this.htmlNumero(e.ganados, e.ganados === 1 ? "ganado" : "ganados") +
        this.htmlNumero(e.empatados, e.empatados === 1 ? "empatado" : "empatados") +
        this.htmlNumero(e.perdidos, e.perdidos === 1 ? "perdido" : "perdidos") +
        this.htmlNumero(e.nota === null ? "—" : e.nota, "nota actual") +
        "</div>";

      if (e.conResultado > 0) {
        html += "<p>Ganó el <strong>" + e.porcentajeGanados + "%</strong> de los partidos con resultado.";
      } else if (e.jugados > 0) {
        html += "<p>Todavía no hay resultados cargados de sus partidos.";
      } else {
        html += "<p>Todavía no jugó partidos de " + UI.escapar(e.nombreDeporte) + ".";
      }
      if (e.sinResultado > 0 && e.conResultado > 0) {
        html +=
          ' <span class="texto-suave">(' +
          (e.sinResultado === 1 ? "1 partido sin resultado no cuenta" : e.sinResultado + " partidos sin resultado no cuentan") +
          ")</span>";
      }
      html += "</p>";

      html += this.htmlEvolucion(jugador, e);
      html += "</section>";
    });

    html += "</article>";
    return html;
  },

  // Evolución de la nota: gráfico (si cambió al menos una vez) + lista.
  htmlEvolucion(jugador, e) {
    const historial = e.historial;
    if (historial.length === 0) return "";
    if (historial.length === 1) {
      return '<p class="texto-suave">Nota ' + historial[0].nota + " desde el " + UI.fechaLegible(historial[0].fecha) + " (nunca cambió).</p>";
    }

    let html =
      '<h5 class="titulo-grafico">Evolución de la nota en ' + UI.escapar(e.nombreDeporte) + "</h5>" +
      // El gráfico se dibuja después (dibujarGraficos), cuando ya se sabe el ancho disponible.
      '<div class="grafico-nota" data-jugador="' + jugador.id + '" data-deporte="' + e.deporteId + '"></div>' +
      '<details class="evolucion"><summary>Ver la lista de cambios (' + historial.length + ")</summary><ul>";
    historial
      .slice()
      .reverse()
      .forEach((r) => {
        html +=
          "<li>" + UI.fechaLegible(r.fecha) + ": nota <strong>" + r.nota + "</strong>" +
          ' <span class="texto-suave">(' + UI.escapar(r.motivo) + ")</span></li>";
      });
    html += "</ul></details>";
    return html;
  },

  /* ---------- Gráfico de evolución de la nota ---------- */

  // Dibuja todos los gráficos que haya en pantalla, según su ancho real.
  dibujarGraficos() {
    document.querySelectorAll(".grafico-nota").forEach((caja) => {
      const jugador = Cambios.buscarJugador(Datos.actuales, caja.dataset.jugador);
      if (!jugador) return;
      const info = jugador.porDeporte[caja.dataset.deporte];
      if (!info) return;
      caja.innerHTML = this.svgEvolucion(info.historialNotas, caja.clientWidth || 320);
    });
  },

  // Arma el gráfico (SVG). Línea "en escalera": la nota se mantiene igual
  // hasta el próximo cambio. Cada cambio es un punto; al pasar el mouse
  // (o tocarlo) se ve la fecha y el motivo.
  svgEvolucion(historial, ancho) {
    const alto = 200;
    const margen = { arriba: 14, derecha: 34, abajo: 30, izquierda: 30 };
    const anchoPlot = ancho - margen.izquierda - margen.derecha;
    const altoPlot = alto - margen.arriba - margen.abajo;
    const cantidad = historial.length;

    // Posición de cada cambio (repartidos parejo de izquierda a derecha) y de cada nota (0 abajo, 10 arriba).
    const x = (i) => margen.izquierda + (cantidad === 1 ? anchoPlot / 2 : (i * anchoPlot) / (cantidad - 1));
    const y = (nota) => margen.arriba + altoPlot - (nota / 10) * altoPlot;

    let svg =
      '<svg class="svg-grafico" width="' + ancho + '" height="' + alto + '" viewBox="0 0 ' + ancho + " " + alto +
      '" role="img" aria-label="Evolución de la nota: ' +
      historial.map((r) => UI.fechaLegible(r.fecha) + " nota " + r.nota).join(", ") + '">';

    // Líneas guía (finas y suaves) en 0, 5 y 10
    [0, 5, 10].forEach((valor) => {
      svg +=
        '<line x1="' + margen.izquierda + '" x2="' + (ancho - margen.derecha) + '" y1="' + y(valor) + '" y2="' + y(valor) +
        '" class="grafico-guia"/>' +
        '<text x="' + (margen.izquierda - 8) + '" y="' + (y(valor) + 4) + '" class="grafico-eje" text-anchor="end">' + valor + "</text>";
    });

    // Línea en escalera
    let camino = "M" + x(0) + " " + y(historial[0].nota);
    for (let i = 1; i < cantidad; i++) {
      camino += " H" + x(i) + " V" + y(historial[i].nota);
    }
    svg += '<path d="' + camino + '" class="grafico-linea"/>';

    // Puntos (con un área invisible más grande para tocarlos fácil)
    historial.forEach((r, i) => {
      const texto = UI.fechaLegible(r.fecha) + ": nota " + r.nota + " (" + UI.escapar(r.motivo) + ")";
      svg +=
        '<g class="grafico-punto" tabindex="0" data-texto="' + texto + '" data-x="' + x(i) + '" data-y="' + y(r.nota) + '">' +
        '<circle cx="' + x(i) + '" cy="' + y(r.nota) + '" r="14" class="grafico-zona"/>' +
        '<circle cx="' + x(i) + '" cy="' + y(r.nota) + '" r="5" class="grafico-marca"/>' +
        "</g>";
    });

    // Etiqueta directa solo en el último punto (la nota actual)
    const ultimo = historial[cantidad - 1];
    svg +=
      '<text x="' + (x(cantidad - 1) + 10) + '" y="' + (y(ultimo.nota) + 4) + '" class="grafico-etiqueta">' + ultimo.nota + "</text>";

    // Fechas del primer y último cambio, abajo
    svg +=
      '<text x="' + x(0) + '" y="' + (alto - 8) + '" class="grafico-eje" text-anchor="start">' + UI.fechaLegible(historial[0].fecha) + "</text>" +
      '<text x="' + x(cantidad - 1) + '" y="' + (alto - 8) + '" class="grafico-eje" text-anchor="end">' +
      UI.fechaLegible(ultimo.fecha) + "</text>";

    svg += "</svg>";
    return '<div class="grafico-contenedor">' + svg + '<div class="grafico-globo" hidden></div></div>';
  },

  // Muestra el globito con la fecha y la nota de un punto.
  mostrarGlobo(punto) {
    const contenedor = punto.closest(".grafico-contenedor");
    const globo = contenedor.querySelector(".grafico-globo");
    globo.textContent = punto.dataset.texto;
    globo.hidden = false;
    // Lo ubicamos arriba del punto, sin que se salga por los costados.
    const xPunto = Number(punto.dataset.x);
    const yPunto = Number(punto.dataset.y);
    const anchoGlobo = globo.offsetWidth;
    const izquierda = Math.max(0, Math.min(xPunto - anchoGlobo / 2, contenedor.clientWidth - anchoGlobo));
    globo.style.left = izquierda + "px";
    // Si no entra arriba del punto, va abajo.
    const arriba = yPunto - globo.offsetHeight - 12;
    globo.style.top = (arriba >= 0 ? arriba : yPunto + 16) + "px";
  },

  ocultarGlobos() {
    document.querySelectorAll(".grafico-globo").forEach((g) => (g.hidden = true));
  },

  /* ---------- Eventos ---------- */

  conectarEventos(raiz) {
    raiz.addEventListener("click", (evento) => {
      const boton = evento.target.closest("button[data-accion]");
      if (!boton) return;
      switch (boton.dataset.accion) {
        case "vista":
          this.estado.vista = boton.dataset.vista;
          UI.redibujar();
          break;
        case "ver-jugador":
          this.estado.jugadorId = boton.dataset.id;
          this.dibujarListaJugadores();
          document.getElementById("detalle-jugador").scrollIntoView({ block: "start", behavior: "smooth" });
          break;
        case "cerrar-jugador":
          this.estado.jugadorId = null;
          this.dibujarListaJugadores();
          break;
      }
    });

    raiz.addEventListener("input", (evento) => {
      if (evento.target.id === "buscar-estadistica") {
        this.estado.busqueda = evento.target.value;
        this.dibujarListaJugadores();
      }
    });

    // Globito del gráfico: con el mouse, con el teclado (Tab) o tocando el punto.
    const alEntrar = (evento) => {
      const punto = evento.target.closest && evento.target.closest(".grafico-punto");
      if (punto) this.mostrarGlobo(punto);
    };
    const alSalir = (evento) => {
      if (evento.target.closest && evento.target.closest(".grafico-punto")) this.ocultarGlobos();
    };
    raiz.addEventListener("mouseover", alEntrar);
    raiz.addEventListener("focusin", alEntrar);
    raiz.addEventListener("mouseout", alSalir);
    raiz.addEventListener("focusout", alSalir);

    // Si cambia el ancho de la ventana (ej: girar el celular), redibujamos los gráficos.
    if (!this.escuchandoTamanio) {
      this.escuchandoTamanio = true;
      let espera = null;
      window.addEventListener("resize", () => {
        clearTimeout(espera);
        espera = setTimeout(() => {
          if (UI.pantallaActual === "estadisticas") this.dibujarGraficos();
        }, 150);
      });
    }
  },
};
