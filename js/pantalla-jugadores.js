/* =========================================================
   pantalla-jugadores.js — Pantalla "Jugadores".
   - Agregar jugadores: nombre, y de a un deporte por vez su nota y posición clave
   - Buscar en la lista
   - Editar nombre, notas y posición clave (cada cambio de nota
     queda en el historial con la fecha)
   - Ver la evolución de la nota
   - Borrar (los partidos viejos se mantienen)
   ========================================================= */

Pantallas.jugadores = {
  titulo: "Jugadores",

  // Cosas que hay que recordar aunque se redibuje la pantalla.
  estado: {
    busqueda: "", // lo escrito en el buscador
    editandoId: null, // id del jugador que se está editando (o null)
    formularioAbierto: false, // si se ve el formulario "Agregar jugador"
    nombreInicial: "", // nombre para precargar en el formulario (desde el buscador)
  },

  // Lo que se va cargando en el formulario "Agregar jugador", deporte por deporte.
  nuevo: {
    cargados: [], // deportes ya sumados: [{ deporteId, nota, posicion }]
    deporteId: "", // deporte elegido en el desplegable ahora
    nota: "", // nota elegida para ese deporte
    posicion: "", // posición elegida para ese deporte ("" = ninguna)
  },

  // Deja el formulario "Agregar jugador" vacío.
  reiniciarNuevo() {
    this.nuevo = { cargados: [], deporteId: "", nota: "", posicion: "" };
  },

  /* ---------- Dibujo ---------- */

  dibujar(contenedor) {
    const datos = Datos.actuales;

    let html = '<div id="pantalla-jugadores">';
    html += '<h2 class="pantalla-titulo">Jugadores</h2>';
    html +=
      '<p class="pantalla-descripcion">Cargá a las personas que juegan y poneles una nota del 1 al 10 en cada deporte. ' +
      "Con esas notas la app arma equipos parejos.</p>";

    if (datos.jugadores.length === 0) {
      // Sin jugadores: el formulario se muestra directo, sin buscador.
      html += this.htmlFormularioNuevo(false);
      html += UI.htmlVacio({
        icono: "👥",
        titulo: "Todavía no hay jugadores",
        texto: "Agregá el primero con el formulario de arriba: escribí el nombre, elegí el deporte y su nota.",
      });
    } else {
      // Sugerencias de notas (si hay alguna para revisar).
      html += this.htmlSugerencias();

      // Con jugadores: arriba el buscador y el botón para abrir el formulario.
      html +=
        '<div class="barra-herramientas">' +
        '  <div class="campo">' +
        '    <label for="buscar-jugador">Buscar jugador</label>' +
        '    <input type="search" id="buscar-jugador" placeholder="Escribí un nombre" autocomplete="off" value="' +
        UI.escapar(this.estado.busqueda) + '">' +
        "  </div>" +
        (this.estado.formularioAbierto
          ? ""
          : '  <button type="button" class="boton boton-principal" data-accion="abrir-formulario">Agregar jugador</button>') +
        "</div>";
      if (this.estado.formularioAbierto) {
        html += this.htmlFormularioNuevo(true);
      }
      html += '<div id="lista-jugadores"></div>';
    }
    html += "</div>";

    contenedor.innerHTML = html;
    this.conectarEventos(contenedor.querySelector("#pantalla-jugadores"));
    this.dibujarPartesNuevo();
    this.dibujarLista();
  },

  /* ---------- Sugerencias de notas ---------- */

  // Recuadro con las sugerencias (calculadas en calculos.js). Cada una se acepta o rechaza.
  htmlSugerencias() {
    const sugerencias = Calculos.sugerencias(Datos.actuales);
    if (sugerencias.length === 0) return "";

    let html =
      '<section class="tarjeta tarjeta-sugerencias" aria-labelledby="titulo-sugerencias">' +
      '<h3 id="titulo-sugerencias">💡 Sugerencias de notas (' + sugerencias.length + ")</h3>" +
      '<p class="ayuda">La app compara los resultados de los partidos con las notas. Son solo sugerencias: ' +
      "nada cambia si no tocás \"Aceptar\". Si rechazás una, no vuelve a aparecer hasta que esa persona juegue " +
      MINIMO_PARTIDOS_SUGERENCIA + " partidos más.</p>" +
      '<ul class="lista-sugerencias">';

    sugerencias.forEach((s) => {
      const datosBoton = ' data-jugador="' + s.jugadorId + '" data-deporte="' + s.deporteId + '"';
      html +=
        '<li class="sugerencia">' +
        '<p class="sugerencia-titulo"><strong>' + UI.escapar(s.nombre) + "</strong> · " +
        Balanceo.iconoDeporte(s.nombreDeporte) + " " + UI.escapar(s.nombreDeporte) + ": " +
        '<span class="sugerencia-cambio">' + s.notaActual + " → " + s.notaSugerida + "</span>" +
        ' <span class="texto-suave">(' + (s.direccion === 1 ? "subir" : "bajar") + " 1 punto)</span></p>" +
        '<p class="sugerencia-motivo">' + UI.escapar(s.motivo) + "</p>" +
        '<div class="acciones">' +
        '  <button type="button" class="boton boton-principal boton-chico" data-accion="aceptar-sugerencia"' + datosBoton + ">" +
        "Aceptar (" + (s.direccion === 1 ? "subir" : "bajar") + " a " + s.notaSugerida + ")</button>" +
        '  <button type="button" class="boton boton-secundario boton-chico" data-accion="rechazar-sugerencia"' + datosBoton + ">" +
        "Rechazar (dejar en " + s.notaActual + ")</button>" +
        "</div>" +
        "</li>";
    });
    html += "</ul></section>";
    return html;
  },

  // Busca la sugerencia del botón tocado (se recalcula, por si algo cambió).
  buscarSugerencia(boton) {
    return Calculos.sugerencias(Datos.actuales).find(
      (s) => s.jugadorId === boton.dataset.jugador && s.deporteId === boton.dataset.deporte
    );
  },

  aceptarSugerencia(boton) {
    const sugerencia = this.buscarSugerencia(boton);
    if (!sugerencia) return;
    Cambios.aceptarSugerencia(Datos.actuales, sugerencia);
    UI.guardarCambios();
    UI.redibujar();
    UI.avisar("Listo: " + sugerencia.nombre + " ahora tiene " + sugerencia.notaSugerida + " en " + sugerencia.nombreDeporte + ".");
  },

  rechazarSugerencia(boton) {
    const sugerencia = this.buscarSugerencia(boton);
    if (!sugerencia) return;
    Cambios.rechazarSugerencia(Datos.actuales, sugerencia);
    UI.guardarCambios();
    UI.redibujar();
    UI.avisar(sugerencia.nombre + " sigue con " + sugerencia.notaActual + " en " + sugerencia.nombreDeporte + ".", "info");
  },

  /* ---------- Formulario "Agregar jugador" ----------
     Funciona de a un deporte por vez:
       1. Nombre
       2. Deporte (desplegable) → aparecen Nota y Posición clave
       3. "Listo, guardar jugador" o "Sumar otro deporte"
     Lo que se va eligiendo se guarda en this.nuevo, y solo se redibuja la parte
     de deportes (así no se borra el nombre escrito). */

  // El "esqueleto" del formulario. Las partes de deportes las completa dibujarPartesNuevo().
  // conCerrar: muestra el botón "Cerrar" (cuando ya hay jugadores y el formulario se abrió con el botón).
  htmlFormularioNuevo(conCerrar) {
    return (
      '<form id="form-nuevo-jugador" class="tarjeta tarjeta-editando" data-con-cerrar="' + (conCerrar ? "si" : "no") + '" novalidate>' +
      "<h3>Agregar jugador</h3>" +
      '<div class="campo">' +
      '  <label for="nuevo-nombre">Nombre</label>' +
      '  <input type="text" id="nuevo-nombre" maxlength="' + LARGO_MAXIMO_NOMBRE + '" autocomplete="off" placeholder="Ej: Juan Pérez" value="' +
      UI.escapar(this.estado.nombreInicial) + '">' +
      "</div>" +
      '<div id="nuevo-partes"></div>' +
      "</form>"
    );
  },

  // Dibuja la parte de deportes del formulario: los ya sumados, el desplegable,
  // la nota y posición del deporte elegido, y los botones.
  dibujarPartesNuevo() {
    const zona = document.getElementById("nuevo-partes");
    if (!zona) return;

    const datos = Datos.actuales;
    const nuevo = this.nuevo;
    const yaCargados = nuevo.cargados.map((c) => c.deporteId);
    const disponibles = datos.deportes.filter((d) => !yaCargados.includes(d.id));
    const elegido = Cambios.buscarDeporte(datos, nuevo.deporteId);
    let html = "";

    // 1) Deportes ya sumados
    if (nuevo.cargados.length > 0) {
      html += '<div class="campo"><span class="etiqueta-campo">Deportes cargados</span><ul class="lista-items">';
      nuevo.cargados.forEach((c) => {
        const deporte = Cambios.buscarDeporte(datos, c.deporteId);
        html +=
          '<li class="fila-item">' +
          "  <span><strong>" + UI.escapar(deporte.nombre) + "</strong>: nota " + c.nota +
          (c.posicion ? " · " + UI.escapar(c.posicion) : "") + "</span>" +
          '  <button type="button" class="boton boton-secundario boton-chico" data-accion="quitar-cargado" data-deporte="' +
          c.deporteId + '">Quitar</button>' +
          "</li>";
      });
      html += "</ul></div>";
    }

    // 2) Desplegable de deporte (solo los que todavía no se sumaron)
    if (disponibles.length > 0) {
      html +=
        '<div class="campo">' +
        '  <label for="nuevo-deporte">' + (nuevo.cargados.length > 0 ? "Otro deporte (opcional)" : "Deporte") + "</label>" +
        '  <select id="nuevo-deporte">' +
        '    <option value="">Elegí un deporte…</option>' +
        disponibles
          .map((d) => '<option value="' + d.id + '"' + (d.id === nuevo.deporteId ? " selected" : "") + ">" + UI.escapar(d.nombre) + "</option>")
          .join("") +
        "  </select>" +
        "</div>";
    } else {
      html += '<p class="ayuda">Ya cargaste todos los deportes.</p>';
    }

    // 3) Nota y posición del deporte elegido
    if (elegido) {
      html +=
        '<div class="bloque-deporte">' +
        '<div class="grilla-campos">' +
        '  <div class="campo-chico">' +
        '    <label class="etiqueta-campo" for="nuevo-nota">Nota en ' + UI.escapar(elegido.nombre) + "</label>" +
        '    <select id="nuevo-nota">' +
        UI.opcionesNota(nuevo.nota === "" ? null : Number(nuevo.nota), "Elegí…") +
        "    </select>" +
        "  </div>";
      if (elegido.posiciones.length > 0) {
        html +=
          '  <div class="campo-chico">' +
          '    <label class="etiqueta-campo" for="nuevo-posicion">Posición clave (opcional)</label>' +
          '    <select id="nuevo-posicion">' +
          '      <option value="">Ninguna</option>' +
          elegido.posiciones
            .map((p) => '<option value="' + UI.escapar(p) + '"' + (p === nuevo.posicion ? " selected" : "") + ">" + UI.escapar(p) + "</option>")
            .join("") +
          "    </select>" +
          "  </div>";
      }
      html +=
        "</div>" +
        '<p class="ayuda">La nota va del 1 (le cuesta) al 10 (el mejor).</p>' +
        "</div>";
    }

    // 4) Mensaje de error y botones
    const conCerrar = document.getElementById("form-nuevo-jugador").dataset.conCerrar === "si";
    // "Sumar otro deporte" solo tiene sentido si hay un deporte elegido y quedan otros por sumar.
    const puedeSumarOtro = elegido && disponibles.length > 1;
    html +=
      '<p class="error-campo" id="error-nuevo" role="alert" hidden></p>' +
      '<div class="acciones">' +
      '  <button type="submit" class="boton boton-principal">Listo, guardar jugador</button>' +
      (puedeSumarOtro ? '  <button type="button" class="boton boton-secundario" data-accion="sumar-deporte">Sumar otro deporte</button>' : "") +
      (conCerrar ? '  <button type="button" class="boton boton-secundario" data-accion="cerrar-formulario">Cerrar</button>' : "") +
      "</div>";

    zona.innerHTML = html;
  },

  // Revisa el deporte elegido ahora. Devuelve { deporteId, nota, posicion } o un mensaje de error.
  // Si no hay deporte elegido devuelve null.
  leerDeporteElegido() {
    const nuevo = this.nuevo;
    if (nuevo.deporteId === "") return null;
    const deporte = Cambios.buscarDeporte(Datos.actuales, nuevo.deporteId);
    if (nuevo.nota === "") return { error: "Elegí la nota en " + deporte.nombre + "." };
    return { deporteId: nuevo.deporteId, nota: Number(nuevo.nota), posicion: nuevo.posicion || null };
  },

  // Botón "Sumar otro deporte": pasa el deporte elegido a la lista de cargados.
  sumarDeporte() {
    const elegido = this.leerDeporteElegido();
    const errorCampo = document.getElementById("error-nuevo");
    if (elegido === null) {
      UI.mostrarError(errorCampo, "Primero elegí un deporte.");
      return;
    }
    if (elegido.error) {
      UI.mostrarError(errorCampo, elegido.error);
      document.getElementById("nuevo-nota").focus();
      return;
    }
    this.nuevo.cargados.push(elegido);
    this.nuevo.deporteId = "";
    this.nuevo.nota = "";
    this.nuevo.posicion = "";
    this.dibujarPartesNuevo();
    const desplegable = document.getElementById("nuevo-deporte");
    if (desplegable) desplegable.focus();
  },

  // Dibuja solo la lista (así el buscador no pierde lo escrito mientras tipeás).
  dibujarLista() {
    const lista = document.getElementById("lista-jugadores");
    if (!lista) return;

    const buscado = Cambios.normalizar(this.estado.busqueda);
    const todos = Cambios.ordenarPorNombre(Datos.actuales.jugadores);
    const encontrados = todos.filter((j) => Cambios.normalizar(j.nombre).includes(buscado));

    let html = '<p class="contador">';
    html += buscado
      ? "Mostrando " + encontrados.length + " de " + UI.plural(todos.length, "jugador", "jugadores")
      : UI.plural(todos.length, "jugador", "jugadores");
    html += "</p>";

    if (encontrados.length === 0) {
      const escrito = Cambios.limpiarNombre(this.estado.busqueda);
      html +=
        '<div class="vacio">' +
        '<p>No hay ningún jugador que se llame "' + UI.escapar(escrito) + '". Revisá cómo está escrito, o agregalo como jugador nuevo.</p>' +
        '<p><button type="button" class="boton boton-principal" data-accion="agregar-desde-busqueda">Agregar a "' +
        UI.escapar(escrito) + '"</button></p>' +
        "</div>";
    }

    encontrados.forEach((jugador) => {
      html += jugador.id === this.estado.editandoId ? this.htmlEditor(jugador) : this.htmlTarjeta(jugador);
    });

    lista.innerHTML = html;
  },

  // Tarjeta de un jugador (modo "ver").
  htmlTarjeta(jugador) {
    let html =
      '<article class="tarjeta tarjeta-jugador">' +
      '<div class="tarjeta-cabecera">' +
      "  <h3>" + UI.escapar(jugador.nombre) + "</h3>" +
      '  <button type="button" class="boton boton-secundario boton-chico" data-accion="editar" data-id="' + jugador.id +
      '">Editar</button>' +
      "</div>" +
      '<div class="chips">';

    Datos.actuales.deportes.forEach((deporte) => {
      const nota = Cambios.notaDe(jugador, deporte.id);
      const posicion = Cambios.posicionDe(jugador, deporte.id);
      if (nota === null) {
        html += '<span class="chip chip-vacio">' + UI.escapar(deporte.nombre) + ": sin nota</span>";
      } else {
        html +=
          '<span class="chip">' + UI.escapar(deporte.nombre) + ": <strong>" + nota + "</strong>" +
          (posicion ? " · " + UI.escapar(posicion) : "") + "</span>";
      }
    });

    html += "</div></article>";
    return html;
  },

  // Tarjeta de un jugador (modo "editar").
  htmlEditor(jugador) {
    const idCampoNombre = "editar-nombre-" + jugador.id;
    let html =
      '<article class="tarjeta tarjeta-jugador tarjeta-editando">' +
      '<form class="form-editar" data-id="' + jugador.id + '" novalidate>' +
      "<h3>Editar a " + UI.escapar(jugador.nombre) + "</h3>" +
      '<div class="campo">' +
      '  <label for="' + idCampoNombre + '">Nombre</label>' +
      '  <input type="text" id="' + idCampoNombre + '" name="nombre" maxlength="' + LARGO_MAXIMO_NOMBRE +
      '" autocomplete="off" value="' + UI.escapar(jugador.nombre) + '">' +
      "</div>";

    Datos.actuales.deportes.forEach((deporte) => {
      const nota = Cambios.notaDe(jugador, deporte.id);
      const posicion = Cambios.posicionDe(jugador, deporte.id);

      const idNota = "editar-nota-" + jugador.id + "-" + deporte.id;
      const idPosicion = "editar-posicion-" + jugador.id + "-" + deporte.id;
      html +=
        '<fieldset class="bloque-deporte">' +
        "<legend>" + UI.escapar(deporte.nombre) + "</legend>" +
        '<div class="grilla-campos">' +
        '<div class="campo-chico">' +
        '  <label class="etiqueta-campo" for="' + idNota + '">Nota</label>' +
        // Si ya tiene nota, no se ofrece "Sin nota" (para no perder su historial por error).
        '  <select id="' + idNota + '" name="nota" data-deporte="' + deporte.id + '">' + UI.opcionesNota(nota, nota === null ? "Sin nota" : null) + "</select>" +
        "</div>";

      if (deporte.posiciones.length > 0) {
        html +=
          '<div class="campo-chico">' +
          '  <label class="etiqueta-campo" for="' + idPosicion + '">Posición clave</label>' +
          '  <select id="' + idPosicion + '" name="posicion" data-deporte="' + deporte.id + '">' +
          '    <option value="">Ninguna</option>' +
          deporte.posiciones
            .map((p) => '<option value="' + UI.escapar(p) + '"' + (p === posicion ? " selected" : "") + ">" + UI.escapar(p) + "</option>")
            .join("") +
          "  </select>" +
          "</div>";
      }

      html += "</div>";
      html += this.htmlEvolucion(jugador, deporte.id);
      html += "</fieldset>";
    });

    html +=
      '<p class="error-campo" role="alert" hidden></p>' +
      '<div class="acciones">' +
      '  <button type="submit" class="boton boton-principal">Guardar cambios</button>' +
      '  <button type="button" class="boton boton-secundario" data-accion="cancelar">Cancelar</button>' +
      '  <button type="button" class="boton boton-peligro-borde" data-accion="borrar" data-id="' + jugador.id +
      '">Borrar jugador</button>' +
      "</div>" +
      "</form></article>";
    return html;
  },

  // Lista desplegable con la evolución de la nota en un deporte (de la más nueva a la más vieja).
  htmlEvolucion(jugador, deporteId) {
    const info = jugador.porDeporte[deporteId];
    if (!info || info.historialNotas.length === 0) return "";

    const historial = info.historialNotas.slice().reverse();
    let html =
      '<details class="evolucion">' +
      "<summary>Ver cómo cambió la nota (" + UI.plural(historial.length, "registro", "registros") + ")</summary>" +
      "<ul>";
    historial.forEach((registro) => {
      html +=
        "<li>" + UI.fechaLegible(registro.fecha) + ": nota <strong>" + registro.nota + "</strong>" +
        ' <span class="texto-suave">(' + UI.escapar(registro.motivo) + ")</span></li>";
    });
    html += "</ul></details>";
    return html;
  },

  /* ---------- Eventos (clics, formularios, buscador) ---------- */

  conectarEventos(raiz) {
    const buscador = raiz.querySelector("#buscar-jugador");
    if (buscador) {
      buscador.addEventListener("input", () => {
        this.estado.busqueda = buscador.value;
        this.dibujarLista();
      });
    }

    // Un solo escuchador para todos los botones de la pantalla (se fija en "data-accion").
    raiz.addEventListener("click", (evento) => {
      const boton = evento.target.closest("[data-accion]");
      if (!boton) return;

      switch (boton.dataset.accion) {
        case "abrir-formulario":
          this.abrirFormulario("");
          break;
        case "agregar-desde-busqueda":
          // Abre el formulario con el nombre que se buscó ya escrito.
          this.abrirFormulario(Cambios.limpiarNombre(this.estado.busqueda));
          break;
        case "cerrar-formulario":
          this.estado.formularioAbierto = false;
          this.estado.nombreInicial = "";
          this.reiniciarNuevo();
          UI.redibujar();
          break;
        case "sumar-deporte":
          this.sumarDeporte();
          break;
        case "aceptar-sugerencia":
          this.aceptarSugerencia(boton);
          break;
        case "rechazar-sugerencia":
          this.rechazarSugerencia(boton);
          break;
        case "quitar-cargado":
          // Saca un deporte de los ya sumados (vuelve a aparecer en el desplegable).
          this.nuevo.cargados = this.nuevo.cargados.filter((c) => c.deporteId !== boton.dataset.deporte);
          this.dibujarPartesNuevo();
          break;
        case "editar":
          this.abrirEditor(boton.dataset.id);
          break;
        case "cancelar":
          this.cerrarEditor();
          break;
        case "borrar":
          this.borrar(boton.dataset.id);
          break;
      }
    });

    // Desplegables del formulario "Agregar jugador": recordamos lo elegido.
    raiz.addEventListener("change", (evento) => {
      const campo = evento.target;
      if (campo.id === "nuevo-deporte") {
        // Cambió el deporte: se muestran la nota y posición de ese deporte.
        this.nuevo.deporteId = campo.value;
        this.nuevo.nota = "";
        this.nuevo.posicion = "";
        this.dibujarPartesNuevo();
        const nota = document.getElementById("nuevo-nota");
        if (nota) nota.focus();
      }
      if (campo.id === "nuevo-nota") this.nuevo.nota = campo.value;
      if (campo.id === "nuevo-posicion") this.nuevo.posicion = campo.value;
    });

    // Formularios: "Agregar jugador" o el editor de un jugador.
    raiz.addEventListener("submit", (evento) => {
      evento.preventDefault(); // que no recargue la página
      if (evento.target.id === "form-nuevo-jugador") {
        this.agregar(evento.target);
      } else {
        this.guardarEdicion(evento.target);
      }
    });
  },

  /* ---------- Acciones ---------- */

  // Muestra el formulario "Agregar jugador" (opcionalmente con un nombre ya escrito).
  abrirFormulario(nombre) {
    this.estado.formularioAbierto = true;
    this.estado.nombreInicial = nombre;
    this.reiniciarNuevo();
    UI.redibujar();
    const campo = document.getElementById("nuevo-nombre");
    campo.closest("form").scrollIntoView({ block: "nearest", behavior: "smooth" });
    campo.focus({ preventScroll: true });
  },

  // Botón "Listo, guardar jugador".
  agregar(formulario) {
    const campoNombre = formulario.querySelector("#nuevo-nombre");
    const errorCampo = document.getElementById("error-nuevo");

    // Juntamos los deportes ya sumados + el que está elegido ahora (si hay uno).
    const deportes = this.nuevo.cargados.slice();
    const elegido = this.leerDeporteElegido();
    if (elegido && elegido.error) {
      UI.mostrarError(errorCampo, elegido.error);
      document.getElementById("nuevo-nota").focus();
      return;
    }
    if (elegido) deportes.push(elegido);

    if (deportes.length === 0) {
      UI.mostrarError(errorCampo, "Elegí al menos un deporte y su nota.");
      document.getElementById("nuevo-deporte").focus();
      return;
    }

    const notas = {};
    const posiciones = {};
    deportes.forEach((d) => {
      notas[d.deporteId] = d.nota;
      if (d.posicion) posiciones[d.deporteId] = d.posicion;
    });

    const resultado = Cambios.agregarJugador(Datos.actuales, campoNombre.value, notas, posiciones);
    if (!resultado.ok) {
      UI.mostrarError(errorCampo, resultado.error);
      campoNombre.focus();
      return;
    }

    UI.guardarCambios();
    // El formulario queda abierto y vacío (para cargar varios seguidos) y se limpia el buscador.
    this.estado.busqueda = "";
    this.estado.formularioAbierto = true;
    this.estado.nombreInicial = "";
    this.reiniciarNuevo();
    UI.redibujar();
    UI.avisar('Listo: se agregó a "' + resultado.jugador.nombre + '". Podés cargar a la siguiente persona.');

    // El cursor vuelve al nombre, para cargar al siguiente rápido.
    document.getElementById("nuevo-nombre").focus();
  },

  abrirEditor(jugadorId) {
    this.estado.editandoId = jugadorId;
    this.dibujarLista();
    const campo = document.getElementById("editar-nombre-" + jugadorId);
    if (campo) {
      campo.closest(".tarjeta").scrollIntoView({ block: "nearest", behavior: "smooth" });
      campo.focus({ preventScroll: true });
    }
  },

  cerrarEditor() {
    this.estado.editandoId = null;
    this.dibujarLista();
  },

  guardarEdicion(formulario) {
    const datos = Datos.actuales;
    const jugadorId = formulario.dataset.id;
    const errorCampo = formulario.querySelector(".error-campo");

    // 1) Revisamos todo antes de cambiar nada.
    const elegido = {}; // { idDeporte: { nota, posicion } }
    formulario.querySelectorAll('select[name="nota"]').forEach((lista) => {
      elegido[lista.dataset.deporte] = { nota: lista.value, posicion: null };
    });
    formulario.querySelectorAll('select[name="posicion"]').forEach((lista) => {
      elegido[lista.dataset.deporte].posicion = lista.value || null;
    });

    for (const deporteId of Object.keys(elegido)) {
      if (elegido[deporteId].posicion && elegido[deporteId].nota === "") {
        const deporte = Cambios.buscarDeporte(datos, deporteId);
        UI.mostrarError(errorCampo, "Para elegir una posición en " + deporte.nombre + ", primero elegí la nota en ese deporte.");
        return;
      }
    }

    // 2) Nombre (si el nombre está repetido, se corta acá y no se cambia nada).
    const resultado = Cambios.renombrarJugador(datos, jugadorId, formulario.querySelector('[name="nombre"]').value);
    if (!resultado.ok) {
      UI.mostrarError(errorCampo, resultado.error);
      formulario.querySelector('[name="nombre"]').focus();
      return;
    }

    // 3) Notas y posiciones. Cada nota distinta queda registrada en el historial.
    for (const deporteId of Object.keys(elegido)) {
      if (elegido[deporteId].nota !== "") {
        Cambios.cambiarNota(datos, jugadorId, deporteId, elegido[deporteId].nota, "Cambio manual");
      }
      Cambios.cambiarPosicion(datos, jugadorId, deporteId, elegido[deporteId].posicion);
    }

    UI.guardarCambios();
    this.estado.editandoId = null;
    this.dibujarLista();
    UI.avisar("Se guardaron los cambios de " + Cambios.buscarJugador(datos, jugadorId).nombre + ".");
  },

  async borrar(jugadorId) {
    const datos = Datos.actuales;
    const jugador = Cambios.buscarJugador(datos, jugadorId);
    if (!jugador) return;

    const reglas = Cambios.contarReglasDeJugador(datos, jugadorId);
    let mensaje = "<p>Se borra de la lista de jugadores junto con sus notas.";
    if (reglas > 0) {
      mensaje += " También se quita de " + UI.plural(reglas, "regla", "reglas") + " de juntos/separados.";
    }
    mensaje += "</p><p>Los partidos en los que jugó se mantienen en el historial.</p>";

    const seguro = await UI.confirmar({
      titulo: "¿Borrar a " + jugador.nombre + "?",
      mensajeHtml: mensaje,
      textoConfirmar: "Sí, borrar",
      textoCancelar: "No, cancelar",
      peligroso: true,
    });
    if (!seguro) return;

    const copiaAntes = JSON.stringify(datos); // para poder deshacer
    Cambios.borrarJugador(datos, jugadorId);
    UI.guardarCambios();
    this.estado.editandoId = null;
    UI.redibujar();
    UI.ofrecerDeshacer("Se borró a " + jugador.nombre + ".", copiaAntes);
  },
};
