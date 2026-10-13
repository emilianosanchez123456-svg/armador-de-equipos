/* =========================================================
   pantalla-historial.js — Pantalla "Historial".
   - Lista de partidos, del más nuevo al más viejo, filtrable por deporte
   - Cargar resultado, evaluación ("Parejo", etc.) y comentario
   - Editar (fecha, resultado, equipos) y borrar, con confirmación
   ========================================================= */

// Cuántos partidos se muestran de entrada (y cuántos más con "Mostrar más").
const PARTIDOS_POR_TANDA = 20;

Pantallas.historial = {
  titulo: "Historial",

  estado: {
    filtro: "todos", // "todos" o el id de un deporte
    editandoId: null, // partido que se está editando
    limite: PARTIDOS_POR_TANDA,
  },

  /* ---------- Dibujo ---------- */

  dibujar(contenedor) {
    const datos = Datos.actuales;
    let html = '<div id="pantalla-historial">';
    html += '<h2 class="pantalla-titulo">Historial de partidos</h2>';

    if (datos.partidos.length === 0) {
      html += UI.htmlVacio({
        icono: "📋",
        titulo: "Todavía no hay partidos",
        texto:
          'Cuando armes equipos y toques "Confirmar partido", el partido va a aparecer acá. ' +
          "Después vas a poder cargar el resultado.",
        boton: { texto: "Armar equipos", irA: "armar" },
      });
      contenedor.innerHTML = html + "</div>";
      return;
    }

    // Si el filtro apunta a un deporte que ya no tiene partidos, volvemos a "Todos".
    if (this.estado.filtro !== "todos" && !datos.partidos.some((p) => p.deporteId === this.estado.filtro)) {
      this.estado.filtro = "todos";
    }

    html +=
      '<p class="pantalla-descripcion">Los partidos que confirmaste, del más nuevo al más viejo. ' +
      "Cargá el resultado cuando termine cada uno: así las estadísticas y las sugerencias de notas son más precisas.</p>";

    html += this.htmlFiltros();
    html += this.htmlPendientes();

    const lista = this.partidosFiltrados();
    lista.slice(0, this.estado.limite).forEach((partido) => {
      html += partido.id === this.estado.editandoId ? this.htmlEditor(partido) : this.htmlPartido(partido);
    });

    if (lista.length > this.estado.limite) {
      html +=
        '<p class="centrado"><button type="button" class="boton boton-secundario" data-accion="mostrar-mas">' +
        "Mostrar más partidos (quedan " + (lista.length - this.estado.limite) + ")</button></p>";
    }

    html += "</div>";
    contenedor.innerHTML = html;
    this.conectarEventos(contenedor.querySelector("#pantalla-historial"));
  },

  // Partidos del filtro elegido, del más nuevo al más viejo.
  partidosFiltrados() {
    return Datos.actuales.partidos
      .filter((p) => this.estado.filtro === "todos" || p.deporteId === this.estado.filtro)
      .slice()
      .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  },

  // Botones para filtrar por deporte (solo los deportes que tienen partidos).
  htmlFiltros() {
    const datos = Datos.actuales;
    const conPartidos = datos.deportes.filter((d) => datos.partidos.some((p) => p.deporteId === d.id));
    if (conPartidos.length < 2) return ""; // con un solo deporte no hace falta filtrar

    const boton = (valor, texto, cantidad) =>
      '<button type="button" class="filtro' + (this.estado.filtro === valor ? " filtro-activo" : "") +
      '" data-accion="filtrar" data-filtro="' + valor + '" aria-pressed="' + (this.estado.filtro === valor) + '">' +
      texto + ' <span class="filtro-cantidad">' + cantidad + "</span></button>";

    let html = '<div class="filtros" role="group" aria-label="Filtrar por deporte">';
    html += boton("todos", "Todos", datos.partidos.length);
    conPartidos.forEach((d) => {
      html += boton(
        d.id,
        Balanceo.iconoDeporte(d.nombre) + " " + UI.escapar(d.nombre),
        datos.partidos.filter((p) => p.deporteId === d.id).length
      );
    });
    html += "</div>";
    return html;
  },

  // Aviso de cuántos partidos (del filtro) no tienen resultado.
  htmlPendientes() {
    const pendientes = this.partidosFiltrados().filter((p) => !p.resultado).length;
    if (pendientes === 0) return "";
    return (
      '<p class="caja-aviso">' +
      (pendientes === 1 ? "Hay 1 partido sin resultado." : "Hay " + pendientes + " partidos sin resultado.") +
      ' Tocá "Cargar resultado" en cada uno.</p>'
    );
  },

  // Tarjeta de un partido (modo "ver").
  htmlPartido(partido) {
    const deporte = Cambios.buscarDeporte(Datos.actuales, partido.deporteId);
    const nombreDeporte = deporte ? deporte.nombre : "Deporte borrado";
    const ganador = Cambios.ganadorDe(partido);

    let html =
      '<article class="tarjeta partido">' +
      '<div class="tarjeta-cabecera">' +
      "  <h3>" + Balanceo.iconoDeporte(nombreDeporte) + " " + UI.escapar(nombreDeporte) +
      ' <span class="partido-fecha">· ' + this.fechaLarga(partido.fecha) + "</span></h3>" +
      (partido.resultado
        ? '  <span class="estado-partido estado-listo">' + this.textoResultado(partido, ganador) + "</span>"
        : '  <span class="estado-partido estado-pendiente">Falta el resultado</span>') +
      "</div>";

    // Equipos
    html += '<div class="partido-equipos">';
    partido.equipos.forEach((equipo, i) => {
      const gano = ganador && !ganador.empate && ganador.ganadores.includes(i);
      html +=
        '<div class="partido-equipo equipo-color-' + (i % 6) + (gano ? " partido-equipo-ganador" : "") + '">' +
        '<div class="partido-equipo-cabecera">' +
        "  <strong>" + UI.escapar(equipo.nombre) + "</strong>" +
        (gano ? ' <span class="etiqueta">Ganó</span>' : "") +
        (partido.resultado ? '  <span class="partido-marcador">' + partido.resultado[i] + "</span>" : "") +
        "</div>" +
        '<p class="partido-equipo-jugadores">' +
        equipo.jugadores.map((j) => UI.escapar(j.nombre) + (j.posicion ? " (" + UI.escapar(j.posicion) + ")" : "")).join(", ") +
        "</p>" +
        '<p class="texto-suave partido-equipo-totales">Nota total ' + equipo.total + " · promedio " + UI.numero(equipo.promedio) + "</p>" +
        "</div>";
    });
    html += "</div>";

    // Evaluación, comentario y datos del armado
    html += '<p class="texto-suave">Diferencia de notas entre equipos: ' + UI.plural(partido.diferencia, "punto", "puntos") + "</p>";
    const evaluacion = Calculos.evaluacionFinal(partido);
    if (evaluacion) {
      html +=
        '<p>¿Fue parejo? <span class="evaluacion ' + this.claseEvaluacion(evaluacion) + '">' + evaluacion + "</span>" +
        ' <span class="texto-suave">' + (partido.evaluacion ? "(elegido a mano)" : "(automático, según el resultado)") + "</span></p>";
    }
    if (partido.comentario) {
      html += '<p class="partido-comentario">“' + UI.escapar(partido.comentario) + "”</p>";
    }

    // Botones
    html +=
      '<div class="acciones">' +
      (partido.resultado
        ? '<button type="button" class="boton boton-secundario" data-accion="editar" data-id="' + partido.id + '">Editar</button>'
        : '<button type="button" class="boton boton-principal" data-accion="editar" data-id="' + partido.id + '">Cargar resultado</button>') +
      '<button type="button" class="boton boton-peligro-borde" data-accion="borrar" data-id="' + partido.id + '">Borrar</button>' +
      "</div>";

    html += "</article>";
    return html;
  },

  // "3 a 2 · Ganó Equipo 1", "2 a 2 · Empate"
  textoResultado(partido, ganador) {
    const marcador = partido.resultado.join(" a ");
    if (!ganador.empate) return marcador + " · Ganó " + UI.escapar(partido.equipos[ganador.ganadores[0]].nombre);
    if (ganador.ganadores.length === partido.equipos.length) return marcador + " · Empate";
    return marcador + " · Empate entre " + UI.listaConY(ganador.ganadores.map((i) => UI.escapar(partido.equipos[i].nombre)));
  },

  claseEvaluacion(evaluacion) {
    if (evaluacion === "Parejo") return "evaluacion-parejo";
    if (evaluacion === "Algo desparejo") return "evaluacion-algo";
    return "evaluacion-muy";
  },

  // "lunes 13/10/2026"
  fechaLarga(textoFecha) {
    const fecha = new Date(textoFecha);
    const dia = fecha.toLocaleDateString("es-AR", { weekday: "long" });
    return dia + " " + UI.fechaLegible(textoFecha);
  },

  // Formulario para cargar resultado / editar un partido.
  htmlEditor(partido) {
    const id = partido.id;
    const deporte = Cambios.buscarDeporte(Datos.actuales, partido.deporteId);
    const nombreDeporte = deporte ? deporte.nombre : "Deporte borrado";

    let html =
      '<article class="tarjeta tarjeta-editando partido">' +
      '<form class="form-partido" data-id="' + id + '" novalidate>' +
      "<h3>" + Balanceo.iconoDeporte(nombreDeporte) + " " + UI.escapar(nombreDeporte) + ' <span class="partido-fecha">· ' +
      this.fechaLarga(partido.fecha) + "</span></h3>";

    // Resultado
    html +=
      '<fieldset class="campo">' +
      "<legend>Resultado</legend>" +
      '<p class="ayuda">Goles, puntos o sets de cada equipo. Dejalo vacío si todavía no se jugó.</p>' +
      '<div class="grilla-resultado">';
    partido.equipos.forEach((equipo, i) => {
      const valor = partido.resultado ? partido.resultado[i] : "";
      html +=
        '<div class="campo-chico">' +
        '  <label class="etiqueta-campo" for="resultado-' + id + "-" + i + '">' + UI.escapar(equipo.nombre) + "</label>" +
        '  <input type="number" id="resultado-' + id + "-" + i + '" name="resultado" data-equipo="' + i +
        '" inputmode="numeric" min="0" max="999" step="1" value="' + valor + '">' +
        '  <span class="ayuda-equipo">' + UI.escapar(this.resumenJugadores(equipo)) + "</span>" +
        "</div>";
    });
    html += "</div></fieldset>";

    // Evaluación: "Automática" (la calcula la app con el resultado) o elegida a mano.
    html +=
      '<fieldset class="campo"><legend>¿Qué tan parejo fue?</legend>' +
      '<p class="ayuda">Si dejás "Automática", la app lo decide sola con el resultado. Si te pareció distinto, elegilo a mano.</p>' +
      '<div class="opciones-evaluacion">';
    [""].concat(EVALUACIONES).forEach((opcion, i) => {
      const idOpcion = "evaluacion-" + id + "-" + i;
      const elegida = (partido.evaluacion || "") === opcion;
      // (&nbsp; = espacio que no desaparece dentro del botón)
      const texto = opcion || "Automática:&nbsp;" + '<span class="texto-automatica">' + this.textoAutomatica(partido.resultado) + "</span>";
      html +=
        '<input type="radio" class="solo-lectores opcion-radio" name="evaluacion-' + id + '" id="' + idOpcion + '" value="' + opcion + '"' +
        (elegida ? " checked" : "") + ">" +
        '<label class="opcion-evaluacion ' + (opcion ? this.claseEvaluacion(opcion) : "evaluacion-ninguna") + '" for="' + idOpcion + '">' +
        texto + "</label>";
    });
    html += "</div></fieldset>";

    // Comentario
    html +=
      '<div class="campo">' +
      '  <label for="comentario-' + id + '">Comentario (opcional)</label>' +
      '  <textarea id="comentario-' + id + '" name="comentario" rows="3" maxlength="' + LARGO_MAXIMO_COMENTARIO +
      '" placeholder="Ej: Faltó un arquero, Juan se fue lesionado...">' + UI.escapar(partido.comentario || "") + "</textarea>" +
      "</div>";

    // Fecha
    html +=
      '<div class="campo campo-fecha">' +
      '  <label for="fecha-' + id + '">Fecha</label>' +
      '  <input type="date" id="fecha-' + id + '" name="fecha" value="' + Cambios.fechaParaCampo(partido.fecha) + '">' +
      "</div>";

    // Corregir equipos (desplegable, porque se usa poco)
    html +=
      '<details class="corregir-equipos">' +
      "<summary>Corregir equipos (si alguien cambió de equipo o no jugó)</summary>" +
      '<ul class="lista-items">';
    partido.equipos.forEach((equipo, i) => {
      equipo.jugadores.forEach((j) => {
        const idCampo = "asignacion-" + id + "-" + j.jugadorId;
        html +=
          '<li class="fila-item">' +
          '  <label for="' + idCampo + '">' + UI.escapar(j.nombre) + ' <span class="texto-suave">(nota ' + j.nota + ")</span></label>" +
          '  <select id="' + idCampo + '" name="asignacion" data-jugador="' + UI.escapar(j.jugadorId) + '" class="select-angosto">' +
          partido.equipos
            .map((e, k) => '<option value="' + k + '"' + (k === i ? " selected" : "") + ">" + UI.escapar(e.nombre) + "</option>")
            .join("") +
          '    <option value="-1">No jugó</option>' +
          "  </select>" +
          "</li>";
      });
    });
    html += "</ul></details>";

    html +=
      '<p class="error-campo" role="alert" hidden></p>' +
      '<div class="acciones">' +
      '  <button type="submit" class="boton boton-principal">Guardar</button>' +
      '  <button type="button" class="boton boton-secundario" data-accion="cancelar">Cancelar</button>' +
      "</div>" +
      "</form></article>";
    return html;
  },

  // Texto de la opción "Automática": la evaluación calculada, o qué falta para calcularla.
  textoAutomatica(resultado) {
    return Calculos.evaluacionAutomatica(resultado) || "cargá el resultado";
  },

  // Mientras se escribe el resultado, actualiza lo que dice la opción "Automática".
  actualizarAutomatica(formulario) {
    const valores = Array.from(formulario.querySelectorAll('input[name="resultado"]')).map((c) => c.value);
    const lectura = Cambios.leerResultado(valores, valores.length);
    const zona = formulario.querySelector(".texto-automatica");
    if (zona) zona.textContent = this.textoAutomatica(lectura.error ? null : lectura.valor);
  },

  // "Ana, Beto y 3 más" (para recordar qué equipo es cuál al cargar el resultado)
  resumenJugadores(equipo) {
    const nombres = equipo.jugadores.map((j) => j.nombre);
    if (nombres.length <= 3) return UI.listaConY(nombres);
    return nombres.slice(0, 2).join(", ") + " y " + (nombres.length - 2) + " más";
  },

  /* ---------- Eventos ---------- */

  conectarEventos(raiz) {
    raiz.addEventListener("click", (evento) => {
      const boton = evento.target.closest("button[data-accion]");
      if (!boton) return;

      switch (boton.dataset.accion) {
        case "filtrar":
          this.estado.filtro = boton.dataset.filtro;
          this.estado.limite = PARTIDOS_POR_TANDA;
          UI.redibujar();
          break;
        case "mostrar-mas":
          this.estado.limite += PARTIDOS_POR_TANDA;
          UI.redibujar();
          break;
        case "editar":
          this.abrirEditor(boton.dataset.id);
          break;
        case "cancelar":
          this.estado.editandoId = null;
          UI.redibujar();
          break;
        case "borrar":
          this.borrar(boton.dataset.id);
          break;
      }
    });

    raiz.addEventListener("submit", (evento) => {
      evento.preventDefault();
      this.guardar(evento.target);
    });

    // Al escribir el resultado, se actualiza la evaluación automática.
    raiz.addEventListener("input", (evento) => {
      if (evento.target.name === "resultado") this.actualizarAutomatica(evento.target.form);
    });
  },

  abrirEditor(partidoId) {
    this.estado.editandoId = partidoId;
    UI.redibujar();
    const primerResultado = document.getElementById("resultado-" + partidoId + "-0");
    if (primerResultado) {
      primerResultado.closest("article").scrollIntoView({ block: "start", behavior: "smooth" });
      primerResultado.focus({ preventScroll: true });
    }
  },

  guardar(formulario) {
    const partidoId = formulario.dataset.id;
    const elegida = formulario.querySelector('input[type="radio"]:checked');
    const asignacion = {};
    formulario.querySelectorAll('select[name="asignacion"]').forEach((lista) => {
      asignacion[lista.dataset.jugador] = Number(lista.value);
    });

    const sugerenciasAntes = Calculos.sugerencias(Datos.actuales).length;
    const resultado = Cambios.editarPartido(Datos.actuales, partidoId, {
      resultado: Array.from(formulario.querySelectorAll('input[name="resultado"]')).map((campo) => campo.value),
      evaluacion: elegida ? elegida.value : null,
      comentario: formulario.querySelector('[name="comentario"]').value,
      fecha: formulario.querySelector('[name="fecha"]').value,
      asignacion,
    });

    if (!resultado.ok) {
      UI.mostrarError(formulario.querySelector(".error-campo"), resultado.error);
      return;
    }
    UI.guardarCambios();
    this.estado.editandoId = null;
    UI.redibujar();
    // Si con este resultado aparecieron sugerencias de notas nuevas, avisamos dónde verlas.
    const sugerenciasNuevas = Calculos.sugerencias(Datos.actuales).length - sugerenciasAntes;
    if (sugerenciasNuevas > 0) {
      UI.avisar(
        "Partido guardado. Hay " + UI.plural(sugerenciasNuevas, "sugerencia nueva", "sugerencias nuevas") +
          " de notas: miralas en la pantalla Jugadores."
      );
    } else {
      UI.avisar("Partido guardado.");
    }
  },

  async borrar(partidoId) {
    const partido = Cambios.buscarPartido(Datos.actuales, partidoId);
    if (!partido) return;
    const deporte = Cambios.buscarDeporte(Datos.actuales, partido.deporteId);

    const seguro = await UI.confirmar({
      titulo: "¿Borrar este partido?",
      mensaje:
        "Partido de " + (deporte ? deporte.nombre : "deporte borrado") + " del " + this.fechaLarga(partido.fecha) + ". " +
        "Se pierde su resultado y deja de contar para las estadísticas. Vas a tener unos segundos para deshacerlo.",
      textoConfirmar: "Sí, borrar",
      textoCancelar: "No, cancelar",
      peligroso: true,
    });
    if (!seguro) return;

    const copiaAntes = JSON.stringify(Datos.actuales); // para poder deshacer
    Cambios.borrarPartido(Datos.actuales, partidoId);
    UI.guardarCambios();
    if (this.estado.editandoId === partidoId) this.estado.editandoId = null;
    UI.redibujar();
    UI.ofrecerDeshacer("Se borró el partido.", copiaAntes);
  },
};
