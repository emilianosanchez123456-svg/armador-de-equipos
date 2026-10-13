/* =========================================================
   pantalla-deportes.js — Pantalla "Deportes".
   - Agregar, renombrar y borrar deportes
   - Posiciones clave de cada deporte (ej: Arquero)
   - Reglas "siempre juntos" / "siempre separados"
   ========================================================= */

Pantallas.deportes = {
  titulo: "Deportes",

  estado: {
    renombrandoId: null, // id del deporte al que se le está cambiando el nombre
    busqueda: "", // lo escrito en el buscador de deportes
    formularioAbierto: false, // si se ve el formulario "Agregar deporte"
    nombreInicial: "", // nombre para precargar en el formulario (desde el buscador)
  },

  /* ---------- Dibujo ---------- */

  dibujar(contenedor) {
    const datos = Datos.actuales;

    let html = '<div id="pantalla-deportes">';
    html += '<h2 class="pantalla-titulo">Deportes</h2>';
    html +=
      '<p class="pantalla-descripcion">Los deportes que podés elegir al armar equipos. ' +
      "En cada uno podés indicar posiciones clave y reglas para ciertos jugadores.</p>";

    // Arriba: buscador y botón para agregar
    html +=
      '<div class="barra-herramientas">' +
      '  <div class="campo">' +
      '    <label for="buscar-deporte">Buscar deporte</label>' +
      '    <input type="search" id="buscar-deporte" placeholder="Escribí un deporte" autocomplete="off" value="' +
      UI.escapar(this.estado.busqueda) + '">' +
      "  </div>" +
      (this.estado.formularioAbierto
        ? ""
        : '  <button type="button" class="boton boton-principal" data-accion="abrir-formulario">Agregar deporte</button>') +
      "</div>";

    // Formulario para agregar un deporte (se abre con el botón)
    if (this.estado.formularioAbierto) {
      html +=
        '<form class="tarjeta tarjeta-editando" data-form="nuevo-deporte" novalidate>' +
        "<h3>Agregar deporte</h3>" +
        '<div class="campo">' +
        '  <label for="nuevo-deporte">Nombre del deporte</label>' +
        '  <input type="text" id="nuevo-deporte" maxlength="' + LARGO_MAXIMO_NOMBRE +
        '" autocomplete="off" placeholder="Ej: Básquet" value="' + UI.escapar(this.estado.nombreInicial) + '">' +
        "</div>" +
        '<p class="error-campo" role="alert" hidden></p>' +
        '<div class="acciones">' +
        '  <button type="submit" class="boton boton-principal">Agregar deporte</button>' +
        '  <button type="button" class="boton boton-secundario" data-accion="cerrar-formulario">Cerrar</button>' +
        "</div>" +
        "</form>";
    }

    // Nombres de todos los jugadores, para las sugerencias al escribir en las reglas.
    html += '<datalist id="nombres-jugadores">';
    Cambios.ordenarPorNombre(datos.jugadores).forEach((j) => {
      html += '<option value="' + UI.escapar(j.nombre) + '"></option>';
    });
    html += "</datalist>";

    html += '<div id="lista-deportes"></div>';
    html += "</div>";

    contenedor.innerHTML = html;
    this.conectarEventos(contenedor.querySelector("#pantalla-deportes"));
    this.dibujarLista();
  },

  // Dibuja solo las tarjetas de deportes que coinciden con la búsqueda
  // (así el buscador no pierde lo escrito mientras tipeás).
  dibujarLista() {
    const lista = document.getElementById("lista-deportes");
    if (!lista) return;

    const buscado = Cambios.normalizar(this.estado.busqueda);
    const todos = Datos.actuales.deportes;
    const encontrados = todos.filter((d) => Cambios.normalizar(d.nombre).includes(buscado));

    let html = "";
    if (buscado) {
      html += '<p class="contador">Mostrando ' + encontrados.length + " de " + UI.plural(todos.length, "deporte", "deportes") + "</p>";
    }

    if (encontrados.length === 0) {
      const escrito = Cambios.limpiarNombre(this.estado.busqueda);
      html +=
        '<div class="vacio">' +
        '<p>No hay ningún deporte que se llame "' + UI.escapar(escrito) + '". Revisá cómo está escrito, o agregalo como deporte nuevo.</p>' +
        '<p><button type="button" class="boton boton-principal" data-accion="agregar-desde-busqueda">Agregar "' +
        UI.escapar(escrito) + '"</button></p>' +
        "</div>";
    }

    encontrados.forEach((deporte) => {
      html += this.htmlDeporte(deporte);
    });
    lista.innerHTML = html;
  },

  // Muestra el formulario "Agregar deporte" (opcionalmente con un nombre ya escrito).
  abrirFormulario(nombre) {
    this.estado.formularioAbierto = true;
    this.estado.nombreInicial = nombre;
    UI.redibujar();
    document.getElementById("nuevo-deporte").focus();
  },

  // Tarjeta completa de un deporte.
  htmlDeporte(deporte) {
    let html = '<article class="tarjeta tarjeta-deporte">';

    // Cabecera: nombre (o formulario para cambiarlo)
    if (this.estado.renombrandoId === deporte.id) {
      html +=
        '<form data-form="renombrar" data-deporte="' + deporte.id + '" novalidate>' +
        '<div class="fila-form">' +
        '  <div class="campo">' +
        '    <label for="renombrar-' + deporte.id + '">Nuevo nombre</label>' +
        '    <input type="text" id="renombrar-' + deporte.id + '" maxlength="' + LARGO_MAXIMO_NOMBRE +
        '" autocomplete="off" value="' + UI.escapar(deporte.nombre) + '">' +
        "  </div>" +
        '  <button type="submit" class="boton boton-principal">Guardar</button>' +
        '  <button type="button" class="boton boton-secundario" data-accion="cancelar-renombrar">Cancelar</button>' +
        "</div>" +
        '<p class="error-campo" role="alert" hidden></p>' +
        "</form>";
    } else {
      html +=
        '<div class="tarjeta-cabecera">' +
        "  <h3>" + UI.escapar(deporte.nombre) + "</h3>" +
        '  <button type="button" class="boton boton-secundario boton-chico" data-accion="renombrar" data-deporte="' +
        deporte.id + '">Cambiar nombre</button>' +
        "</div>";
    }

    html += this.htmlPosiciones(deporte);
    html += this.htmlReglas(deporte);

    html +=
      '<div class="seccion">' +
      '  <button type="button" class="boton boton-peligro-borde" data-accion="borrar-deporte" data-deporte="' +
      deporte.id + '">Borrar ' + UI.escapar(deporte.nombre) + "</button>" +
      "</div>";

    html += "</article>";
    return html;
  },

  // Sección "Posiciones clave".
  htmlPosiciones(deporte) {
    let html =
      '<section class="seccion">' +
      "<h4>Posiciones clave</h4>" +
      '<p class="ayuda">Se reparten entre los equipos. Por ejemplo: que no queden dos arqueros en el mismo equipo.</p>';

    if (deporte.posiciones.length === 0) {
      html += '<p class="texto-suave">Sin posiciones clave.</p>';
    } else {
      html += '<ul class="lista-items">';
      deporte.posiciones.forEach((posicion) => {
        const cantidad = Cambios.contarJugadoresConPosicion(Datos.actuales, deporte.id, posicion);
        html +=
          '<li class="fila-item">' +
          '  <span><span class="etiqueta">' + UI.escapar(posicion) + "</span> " +
          '  <span class="texto-suave">(la tiene' + (cantidad === 1 ? "" : "n") + " " + UI.plural(cantidad, "jugador", "jugadores") +
          ")</span></span>" +
          '  <button type="button" class="boton boton-secundario boton-chico" data-accion="quitar-posicion" data-deporte="' +
          deporte.id + '" data-posicion="' + UI.escapar(posicion) + '">Quitar</button>' +
          "</li>";
      });
      html += "</ul>";
    }

    html +=
      '<form data-form="agregar-posicion" data-deporte="' + deporte.id + '" novalidate>' +
      '<div class="fila-form">' +
      '  <div class="campo">' +
      '    <label for="posicion-' + deporte.id + '">Nueva posición</label>' +
      '    <input type="text" id="posicion-' + deporte.id + '" maxlength="' + LARGO_MAXIMO_NOMBRE +
      '" autocomplete="off" placeholder="Ej: Arquero">' +
      "  </div>" +
      '  <button type="submit" class="boton boton-secundario">Agregar posición</button>' +
      "</div>" +
      '<p class="error-campo" role="alert" hidden></p>' +
      "</form>" +
      "</section>";
    return html;
  },

  // Sección "Reglas" (siempre juntos / siempre separados).
  htmlReglas(deporte) {
    const datos = Datos.actuales;
    let html =
      '<section class="seccion">' +
      "<h4>Reglas</h4>" +
      '<p class="ayuda">Para que dos personas jueguen siempre en el mismo equipo o siempre en equipos distintos. ' +
      "Si alguna de las dos no viene ese día, la regla simplemente no se usa.</p>";

    if (deporte.reglas.length === 0) {
      html += '<p class="texto-suave">Todavía no hay reglas.</p>';
    } else {
      html += '<ul class="lista-items">';
      deporte.reglas.forEach((regla) => {
        html +=
          '<li class="fila-item">' +
          "  <span>" + this.htmlTextoRegla(regla) + "</span>" +
          '  <button type="button" class="boton boton-secundario boton-chico" data-accion="quitar-regla" data-deporte="' +
          deporte.id + '" data-regla="' + regla.id + '">Quitar</button>' +
          "</li>";
      });
      html += "</ul>";
    }

    if (datos.jugadores.length < 2) {
      html +=
        '<p class="texto-suave">Para crear reglas necesitás al menos 2 jugadores cargados. ' +
        '<a href="#jugadores">Ir a Jugadores</a></p>';
    } else {
      // Los jugadores se escriben (con sugerencias de la lista "nombres-jugadores"),
      // así no hay que recorrer una lista larguísima para encontrar a uno.
      const id = deporte.id;
      const campoJugador = (nombreCampo, idCampo) =>
        '<input type="text" id="' + idCampo + '" name="' + nombreCampo + '" list="nombres-jugadores" ' +
        'autocomplete="off" placeholder="Escribí un nombre">';
      html +=
        '<form data-form="agregar-regla" data-deporte="' + id + '" novalidate>' +
        '<div class="fila-form fila-regla">' +
        '  <div class="campo">' +
        '    <label for="regla-a-' + id + '">Jugador</label>' +
        campoJugador("jugadorA", "regla-a-" + id) +
        "  </div>" +
        '  <div class="campo">' +
        '    <label for="regla-tipo-' + id + '">Van</label>' +
        '    <select id="regla-tipo-' + id + '" name="tipo">' +
        '      <option value="separados">siempre separados</option>' +
        '      <option value="juntos">siempre juntos</option>' +
        "    </select>" +
        "  </div>" +
        '  <div class="campo">' +
        '    <label for="regla-b-' + id + '">Con</label>' +
        campoJugador("jugadorB", "regla-b-" + id) +
        "  </div>" +
        '  <button type="submit" class="boton boton-secundario">Agregar regla</button>' +
        "</div>" +
        '<p class="error-campo" role="alert" hidden></p>' +
        "</form>";
    }

    html += "</section>";
    return html;
  },

  // "Ana y Beto: siempre separados"
  htmlTextoRegla(regla) {
    const nombres = regla.jugadores.map((id) => {
      const jugador = Cambios.buscarJugador(Datos.actuales, id);
      return jugador ? UI.escapar(jugador.nombre) : "(jugador borrado)";
    });
    return "<strong>" + nombres[0] + "</strong> y <strong>" + nombres[1] + "</strong>: siempre " + regla.tipo;
  },

  /* ---------- Eventos ---------- */

  conectarEventos(raiz) {
    // Buscador: al escribir, redibuja solo la lista de deportes.
    const buscador = raiz.querySelector("#buscar-deporte");
    buscador.addEventListener("input", () => {
      this.estado.busqueda = buscador.value;
      this.dibujarLista();
    });

    // Botones (se fijan en "data-accion")
    raiz.addEventListener("click", (evento) => {
      const boton = evento.target.closest("[data-accion]");
      if (!boton) return;
      const deporteId = boton.dataset.deporte;

      switch (boton.dataset.accion) {
        case "abrir-formulario":
          this.abrirFormulario("");
          break;
        case "agregar-desde-busqueda":
          this.abrirFormulario(Cambios.limpiarNombre(this.estado.busqueda));
          break;
        case "cerrar-formulario":
          this.estado.formularioAbierto = false;
          this.estado.nombreInicial = "";
          UI.redibujar();
          break;
        case "renombrar":
          this.estado.renombrandoId = deporteId;
          UI.redibujar();
          document.getElementById("renombrar-" + deporteId).focus();
          break;
        case "cancelar-renombrar":
          this.estado.renombrandoId = null;
          UI.redibujar();
          break;
        case "quitar-posicion":
          this.quitarPosicion(deporteId, boton.dataset.posicion);
          break;
        case "quitar-regla":
          this.quitarRegla(deporteId, boton.dataset.regla);
          break;
        case "borrar-deporte":
          this.borrarDeporte(deporteId);
          break;
      }
    });

    // Formularios (se fijan en "data-form")
    raiz.addEventListener("submit", (evento) => {
      evento.preventDefault();
      const formulario = evento.target;
      const deporteId = formulario.dataset.deporte;
      const datos = Datos.actuales;
      let resultado;
      let mensaje;

      switch (formulario.dataset.form) {
        case "nuevo-deporte":
          resultado = Cambios.agregarDeporte(datos, formulario.querySelector("input").value);
          if (resultado.ok) {
            // Cerramos el formulario y mostramos el deporte nuevo.
            this.estado.formularioAbierto = false;
            this.estado.nombreInicial = "";
            this.estado.busqueda = resultado.deporte.nombre;
            mensaje = "Se agregó " + resultado.deporte.nombre + ". Ahora podés cargarle posiciones clave y reglas.";
          }
          break;
        case "renombrar":
          resultado = Cambios.renombrarDeporte(datos, deporteId, formulario.querySelector("input").value);
          if (resultado.ok) {
            this.estado.renombrandoId = null;
            mensaje = "Se cambió el nombre.";
          }
          break;
        case "agregar-posicion":
          resultado = Cambios.agregarPosicion(datos, deporteId, formulario.querySelector("input").value);
          if (resultado.ok) mensaje = "Se agregó la posición. Asignala a cada jugador desde la pantalla Jugadores.";
          break;
        case "agregar-regla":
          resultado = Cambios.agregarReglaPorNombres(
            datos,
            deporteId,
            formulario.querySelector('[name="tipo"]').value,
            formulario.querySelector('[name="jugadorA"]').value,
            formulario.querySelector('[name="jugadorB"]').value
          );
          if (resultado.ok) mensaje = "Se agregó la regla.";
          break;
        default:
          return;
      }

      if (!resultado.ok) {
        // Mostramos el problema debajo del formulario, sin borrar lo escrito.
        UI.mostrarError(formulario.querySelector(".error-campo"), resultado.error);
        return;
      }
      UI.guardarCambios();
      UI.redibujar();
      UI.avisar(mensaje);
    });
  },

  /* ---------- Acciones que piden confirmación ---------- */

  async quitarPosicion(deporteId, posicion) {
    const datos = Datos.actuales;
    const deporte = Cambios.buscarDeporte(datos, deporteId);
    const cantidad = Cambios.contarJugadoresConPosicion(datos, deporteId, posicion);

    const seguro = await UI.confirmar({
      titulo: '¿Quitar la posición "' + posicion + '" de ' + deporte.nombre + "?",
      mensaje:
        cantidad > 0
          ? UI.plural(cantidad, "jugador tiene", "jugadores tienen") + " esta posición y van a quedar sin posición en " + deporte.nombre + "."
          : "Ningún jugador tiene esta posición todavía.",
      textoConfirmar: "Sí, quitar",
      textoCancelar: "No, cancelar",
      peligroso: true,
    });
    if (!seguro) return;

    const copiaAntes = JSON.stringify(datos); // para poder deshacer
    Cambios.quitarPosicion(datos, deporteId, posicion);
    UI.guardarCambios();
    UI.redibujar();
    UI.ofrecerDeshacer("Se quitó la posición " + posicion + ".", copiaAntes);
  },

  async quitarRegla(deporteId, reglaId) {
    const datos = Datos.actuales;
    const deporte = Cambios.buscarDeporte(datos, deporteId);
    const regla = deporte.reglas.find((r) => r.id === reglaId);
    if (!regla) return;

    const seguro = await UI.confirmar({
      titulo: "¿Quitar esta regla?",
      mensajeHtml: "<p>" + this.htmlTextoRegla(regla) + " (en " + UI.escapar(deporte.nombre) + ")</p>",
      textoConfirmar: "Sí, quitar",
      textoCancelar: "No, cancelar",
      peligroso: true,
    });
    if (!seguro) return;

    const copiaAntes = JSON.stringify(datos); // para poder deshacer
    Cambios.quitarRegla(datos, deporteId, reglaId);
    UI.guardarCambios();
    UI.redibujar();
    UI.ofrecerDeshacer("Se quitó la regla.", copiaAntes);
  },

  async borrarDeporte(deporteId) {
    const datos = Datos.actuales;
    const deporte = Cambios.buscarDeporte(datos, deporteId);

    // Si no se puede borrar, explicamos por qué sin preguntar nada.
    const problema = Cambios.problemaParaBorrarDeporte(datos, deporteId);
    if (problema) {
      UI.avisar(problema, "error");
      return;
    }

    const conNota = Cambios.contarJugadoresDeDeporte(datos, deporteId);
    let mensaje = "Se borran también sus posiciones clave y reglas.";
    if (conNota > 0) {
      mensaje += " " + UI.plural(conNota, "jugador tiene", "jugadores tienen") + " nota en " + deporte.nombre + " y esas notas se pierden.";
    }
    mensaje += " Vas a tener unos segundos para deshacerlo.";

    const seguro = await UI.confirmar({
      titulo: "¿Borrar " + deporte.nombre + "?",
      mensaje,
      textoConfirmar: "Sí, borrar",
      textoCancelar: "No, cancelar",
      peligroso: true,
    });
    if (!seguro) return;

    const copiaAntes = JSON.stringify(datos); // para poder deshacer
    Cambios.borrarDeporte(datos, deporteId);
    UI.guardarCambios();
    this.estado.renombrandoId = null;
    UI.redibujar();
    UI.ofrecerDeshacer("Se borró " + deporte.nombre + ".", copiaAntes);
  },
};
