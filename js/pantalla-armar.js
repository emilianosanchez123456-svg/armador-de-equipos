/* =========================================================
   pantalla-armar.js — Pantalla "Armar equipos" (la de inicio).

   Funciona por pasos, uno a la vez:
     1. Deporte          → botones grandes con cada deporte
     2. Quiénes juegan   → lista para marcar presentes, con buscador,
                           nota editable y "Agregar jugador nuevo"
     3. Cantidad de equipos → botones 2, 3, 4...; avisa si sobran o faltan
     4. Equipos          → resultado, "Otra combinación", "Copiar equipos",
                           "Confirmar partido"

   La lógica de cómo se arman los equipos está en balanceo.js;
   acá solo está la pantalla.
   ========================================================= */

// Máximo de equipos que se ofrecen en el paso 3.
const MAXIMO_EQUIPOS = 8;

Pantallas.armar = {
  titulo: "Armar equipos",

  // Todo lo que se va eligiendo. Queda guardado mientras la app esté abierta
  // (si vas a otra pantalla y volvés, sigue igual).
  estado: {
    paso: 1,
    deporteId: null,
    presentesPorDeporte: {}, // { idDeporte: [ids de jugadores marcados] }
    busqueda: "",
    formularioAbierto: false, // formulario "Agregar jugador nuevo" del paso 2
    nombreInicial: "",
    cantidadEquipos: null,
    resultado: null, // lo que devuelve Balanceo.armar
    actual: null, // combinación que se está mostrando
    mostradas: [], // claves de las combinaciones ya mostradas
    confirmado: false, // si ya se guardó el partido
    soloMarcados: false, // paso 2: mostrar solo a los marcados
    verGuia: false, // si se abrió "¿Cómo funciona?"
  },

  /* ---------- Ayudas ---------- */

  deporte() {
    return Cambios.buscarDeporte(Datos.actuales, this.estado.deporteId);
  },

  // Ids de los jugadores marcados en el deporte elegido (sacando los que se borraron).
  presentes() {
    const id = this.estado.deporteId;
    const lista = (this.estado.presentesPorDeporte[id] || []).filter((j) => Cambios.buscarJugador(Datos.actuales, j));
    this.estado.presentesPorDeporte[id] = lista;
    return lista;
  },

  estaPresente(jugadorId) {
    return this.presentes().includes(jugadorId);
  },

  marcar(jugadorId, presente) {
    const lista = this.presentes().filter((id) => id !== jugadorId);
    if (presente) lista.push(jugadorId);
    this.estado.presentesPorDeporte[this.estado.deporteId] = lista;
    this.olvidarEquipos();
  },

  // Si cambian los presentes o las notas, los equipos armados ya no sirven.
  olvidarEquipos() {
    this.estado.resultado = null;
    this.estado.actual = null;
    this.estado.mostradas = [];
    this.estado.confirmado = false;
  },

  // Presentes que todavía no tienen nota en este deporte.
  presentesSinNota() {
    return this.presentes()
      .map((id) => Cambios.buscarJugador(Datos.actuales, id))
      .filter((j) => Cambios.notaDe(j, this.estado.deporteId) === null);
  },

  // ¿Hasta qué paso se puede llegar con lo elegido?
  pasoMaximo() {
    if (!this.deporte()) return 1;
    if (this.presentes().length < 2 || this.presentesSinNota().length > 0) return 2;
    if (!this.estado.actual) return 3;
    return 4;
  },

  irAPaso(paso) {
    this.estado.paso = Math.min(paso, this.pasoMaximo());
    UI.redibujar();
    window.scrollTo(0, 0);
  },

  /* ---------- Dibujo general ---------- */

  dibujar(contenedor) {
    // Si el deporte elegido se borró, o el paso ya no es posible, acomodamos.
    if (this.estado.deporteId && !this.deporte()) {
      this.estado.deporteId = null;
      this.olvidarEquipos();
    }
    this.estado.paso = Math.min(this.estado.paso, this.pasoMaximo());

    let html = '<div id="pantalla-armar">';
    html +=
      '<div class="titulo-con-ayuda">' +
      '  <h2 class="pantalla-titulo">Armar equipos</h2>' +
      '  <button type="button" class="boton-ayuda" data-accion="ver-guia" aria-expanded="' + this.mostrarGuia() + '">¿Cómo funciona?</button>' +
      "</div>";
    if (this.mostrarGuia()) html += this.htmlGuia();
    html += this.htmlPasos();

    if (this.estado.paso === 1) html += this.htmlPendientes() + this.htmlPaso1();
    if (this.estado.paso === 2) html += this.htmlPaso2();
    if (this.estado.paso === 3) html += this.htmlPaso3();
    if (this.estado.paso === 4) html += this.htmlPaso4();

    html += "</div>";
    contenedor.innerHTML = html;
    this.conectarEventos(contenedor.querySelector("#pantalla-armar"));

    if (this.estado.paso === 2) {
      this.dibujarListaPresentes();
      this.actualizarBarra();
    }
  },

  // Fila de pasos numerados arriba. Se puede tocar un paso para volver a él.
  htmlPasos() {
    const nombres = ["Deporte", "Quiénes juegan", "Cantidad de equipos", "Equipos"];
    const maximo = this.pasoMaximo();
    let html = '<ol class="pasos">';
    nombres.forEach((nombre, i) => {
      const numero = i + 1;
      let clase = "paso";
      if (numero === this.estado.paso) clase += " paso-activo";
      else if (numero < this.estado.paso) clase += " paso-hecho";
      html +=
        "<li>" +
        '<button type="button" class="' + clase + '" data-accion="ir-paso" data-paso="' + numero + '"' +
        (numero > maximo ? " disabled" : "") +
        (numero === this.estado.paso ? ' aria-current="step"' : "") + ">" +
        '<span class="paso-numero">' + (numero < this.estado.paso ? "✓" : numero) + "</span>" +
        '<span class="paso-nombre">' + nombre + "</span>" +
        "</button></li>";
    });
    html += "</ol>";
    return html;
  },

  /* ---------- Guía "¿Cómo funciona?" y recordatorios ---------- */

  // La guía se muestra sola la primera vez (hasta tocar "Entendido"),
  // y después cuando se toca "¿Cómo funciona?".
  mostrarGuia() {
    return this.estado.verGuia || (!Datos.leerPreferencias().guiaVista && this.estado.paso === 1);
  },

  htmlGuia() {
    return (
      '<section class="tarjeta guia" aria-labelledby="titulo-guia">' +
      '<h3 id="titulo-guia">👋 ¿Cómo funciona?</h3>' +
      '<ol class="guia-pasos">' +
      "<li><strong>Cargá a los jugadores</strong> con una nota del 1 (le cuesta) al 10 (el mejor) en cada deporte. " +
      "Podés hacerlo en \"Jugadores\" o directamente en el paso 2.</li>" +
      "<li><strong>Marcá quiénes vienen</strong> y elegí cuántos equipos: la app los arma parejos según las notas. " +
      "Si no te convencen, tocá \"Otra combinación\".</li>" +
      "<li><strong>Después del partido, cargá el resultado</strong> en \"Historial\". Con eso la app aprende y te sugiere ajustar notas.</li>" +
      "</ol>" +
      '<p class="guia-nota">📱 <strong>Tus datos se guardan solo en este dispositivo.</strong> Para no perderlos o pasarlos a otro celular, ' +
      "tocá \"Exportar datos\" (arriba de todo) de vez en cuando y guardá el archivo.</p>" +
      '<button type="button" class="boton boton-principal" data-accion="cerrar-guia">Entendido</button>' +
      "</section>"
    );
  },

  // Aviso de partidos de días anteriores que todavía no tienen resultado.
  htmlPendientes() {
    const pendientes = Calculos.partidosPendientes(Datos.actuales);
    if (pendientes.length === 0) return "";
    const detalle = pendientes
      .slice(0, 3)
      .map((p) => {
        const deporte = Cambios.buscarDeporte(Datos.actuales, p.deporteId);
        return (deporte ? UI.escapar(deporte.nombre) : "Partido") + " del " + UI.fechaLegible(p.fecha);
      })
      .join(", ");
    return (
      '<div class="caja-aviso" role="status">' +
      "<p>📋 <strong>" +
      (pendientes.length === 1 ? "Tenés 1 partido sin resultado" : "Tenés " + pendientes.length + " partidos sin resultado") +
      "</strong> (" + detalle + (pendientes.length > 3 ? " y más" : "") + "). " +
      "Cargalo para que las estadísticas y las sugerencias de notas sean más precisas.</p>" +
      '<a class="boton boton-secundario boton-chico" href="#historial">Cargar ' + (pendientes.length === 1 ? "el resultado" : "los resultados") + "</a>" +
      "</div>"
    );
  },

  /* ---------- Paso 1: deporte ---------- */

  htmlPaso1() {
    const datos = Datos.actuales;
    let html = '<section class="tarjeta"><h3>1. ¿Qué deporte van a jugar?</h3><div class="grilla-deportes">';
    datos.deportes.forEach((deporte) => {
      const conNota = Cambios.contarJugadoresDeDeporte(datos, deporte.id);
      html +=
        '<button type="button" class="boton-deporte' + (deporte.id === this.estado.deporteId ? " elegido" : "") +
        '" data-accion="elegir-deporte" data-deporte="' + deporte.id + '">' +
        '<span class="boton-deporte-icono" aria-hidden="true">' + Balanceo.iconoDeporte(deporte.nombre) + "</span>" +
        '<span class="boton-deporte-nombre">' + UI.escapar(deporte.nombre) + "</span>" +
        '<span class="boton-deporte-detalle">' + UI.plural(conNota, "jugador con nota", "jugadores con nota") + "</span>" +
        "</button>";
    });
    html +=
      "</div>" +
      '<p class="ayuda">¿No está el deporte que buscás? Agregalo en <a href="#deportes">Deportes</a>.</p>' +
      "</section>";
    return html;
  },

  /* ---------- Paso 2: quiénes juegan ---------- */

  htmlPaso2() {
    const deporte = this.deporte();
    const datos = Datos.actuales;
    let html =
      '<section class="tarjeta">' +
      "<h3>2. ¿Quiénes juegan hoy? <span class=\"texto-suave\">(" + UI.escapar(deporte.nombre) + ")</span></h3>" +
      '<p class="ayuda">Marcá a los que vienen. Al lado de cada uno está su nota en ' + UI.escapar(deporte.nombre) +
      ": si hace falta, cambiala ahí mismo.</p>";

    if (datos.jugadores.length > 0) {
      html +=
        '<div class="barra-herramientas">' +
        '  <div class="campo">' +
        '    <label for="buscar-presente">Buscar jugador</label>' +
        '    <input type="search" id="buscar-presente" placeholder="Escribí un nombre" autocomplete="off" value="' +
        UI.escapar(this.estado.busqueda) + '">' +
        "  </div>" +
        (this.estado.formularioAbierto
          ? ""
          : '  <button type="button" class="boton boton-secundario" data-accion="abrir-formulario">Agregar jugador nuevo</button>') +
        "</div>";
    }

    if (this.estado.formularioAbierto || datos.jugadores.length === 0) {
      html += this.htmlFormularioNuevo(deporte, datos.jugadores.length > 0);
    }

    // Atajos para marcar rápido
    const ultimo = Cambios.ultimoPartido(datos, deporte.id);
    const atajos = [];
    if (ultimo) {
      atajos.push(
        '<button type="button" class="boton boton-secundario boton-chico" data-accion="marcar-ultimo">' +
          "Marcar los del último partido (" + UI.fechaLegible(ultimo.fecha) + ")</button>"
      );
    }
    if (this.presentes().length > 0) {
      atajos.push(
        '<button type="button" class="boton boton-secundario boton-chico" data-accion="solo-marcados" aria-pressed="' +
          this.estado.soloMarcados + '">' +
          (this.estado.soloMarcados ? "Ver a todos" : "Ver solo marcados") + "</button>"
      );
      atajos.push('<button type="button" class="boton boton-secundario boton-chico" data-accion="desmarcar-todos">Desmarcar a todos</button>');
    }
    if (atajos.length > 0) html += '<div class="atajos">' + atajos.join("") + "</div>";

    html += '<div id="lista-presentes"></div>';
    html += "</section>";

    // Barra fija abajo: cuántos hay marcados + botón para seguir
    html +=
      '<div class="barra-fija-abajo">' +
      '  <p id="error-presentes" class="error-campo" role="alert" hidden></p>' +
      '  <div class="barra-fija-contenido">' +
      '    <span id="contador-presentes" class="contador-presentes" aria-live="polite"></span>' +
      '    <button type="button" class="boton boton-principal" data-accion="siguiente-paso3">Siguiente: cantidad de equipos</button>' +
      "  </div>" +
      "</div>";
    return html;
  },

  // Formulario para sumar a alguien que no está en la lista (o no tiene nota en este deporte).
  htmlFormularioNuevo(deporte, conCerrar) {
    let html =
      '<form id="form-nuevo-presente" class="caja-formulario" novalidate>' +
      "<h4>Agregar jugador</h4>" +
      '<div class="grilla-campos">' +
      '  <div class="campo-chico">' +
      '    <label class="etiqueta-campo" for="nuevo-presente-nombre">Nombre</label>' +
      '    <input type="text" id="nuevo-presente-nombre" maxlength="' + LARGO_MAXIMO_NOMBRE +
      '" autocomplete="off" placeholder="Ej: Juan Pérez" value="' + UI.escapar(this.estado.nombreInicial) + '">' +
      "  </div>" +
      '  <div class="campo-chico">' +
      '    <label class="etiqueta-campo" for="nuevo-presente-nota">Nota en ' + UI.escapar(deporte.nombre) + "</label>" +
      '    <select id="nuevo-presente-nota">' + UI.opcionesNota(null, "Elegí…") + "</select>" +
      "  </div>";
    if (deporte.posiciones.length > 0) {
      html +=
        '  <div class="campo-chico">' +
        '    <label class="etiqueta-campo" for="nuevo-presente-posicion">Posición clave (opcional)</label>' +
        '    <select id="nuevo-presente-posicion"><option value="">Ninguna</option>' +
        deporte.posiciones.map((p) => '<option value="' + UI.escapar(p) + '">' + UI.escapar(p) + "</option>").join("") +
        "    </select>" +
        "  </div>";
    }
    html +=
      "</div>" +
      '<p id="pista-nuevo-presente" class="ayuda" aria-live="polite"></p>' +
      '<p id="error-nuevo-presente" class="error-campo" role="alert" hidden></p>' +
      '<div class="acciones">' +
      '  <button type="submit" class="boton boton-principal">Agregar y marcar</button>' +
      (conCerrar ? '  <button type="button" class="boton boton-secundario" data-accion="cerrar-formulario">Cerrar</button>' : "") +
      "</div>" +
      "</form>";
    return html;
  },

  // Dibuja la lista de jugadores para marcar (solo la lista, así el buscador no pierde lo escrito).
  dibujarListaPresentes() {
    const zona = document.getElementById("lista-presentes");
    if (!zona) return;
    const datos = Datos.actuales;
    const deporte = this.deporte();

    if (datos.jugadores.length === 0) {
      zona.innerHTML = UI.htmlVacio({
        icono: "👥",
        titulo: "Todavía no hay jugadores",
        texto: "Agregá a los que juegan hoy con el formulario de arriba. Quedan guardados para la próxima.",
      });
      return;
    }

    const buscado = Cambios.normalizar(this.estado.busqueda);
    const soloMarcados = this.estado.soloMarcados && this.presentes().length > 0;
    const visibles = Cambios.ordenarPorNombre(datos.jugadores).filter(
      (j) => Cambios.normalizar(j.nombre).includes(buscado) && (!soloMarcados || this.estaPresente(j.id))
    );
    const conNota = visibles.filter((j) => Cambios.notaDe(j, deporte.id) !== null);
    const sinNota = visibles.filter((j) => Cambios.notaDe(j, deporte.id) === null);

    let html = "";
    if (visibles.length === 0 && soloMarcados) {
      html += '<p class="texto-suave">Ninguno de los marcados se llama "' + UI.escapar(this.estado.busqueda.trim()) + '".</p>';
    } else if (visibles.length === 0) {
      const escrito = Cambios.limpiarNombre(this.estado.busqueda);
      html +=
        '<div class="vacio">' +
        '<p>No hay ningún jugador que se llame "' + UI.escapar(escrito) + '".</p>' +
        '<p><button type="button" class="boton boton-principal" data-accion="agregar-desde-busqueda">Agregar a "' +
        UI.escapar(escrito) + '"</button></p>' +
        "</div>";
    }
    if (conNota.length > 0) {
      html += '<ul class="lista-presentes">' + conNota.map((j) => this.htmlFila(j)).join("") + "</ul>";
    }
    if (sinNota.length > 0) {
      html +=
        '<h4 class="subtitulo-lista">Sin nota en ' + UI.escapar(deporte.nombre) + "</h4>" +
        '<p class="ayuda">Si alguno juega hoy, marcalo y elegí su nota.</p>' +
        '<ul class="lista-presentes">' + sinNota.map((j) => this.htmlFila(j)).join("") + "</ul>";
    }
    zona.innerHTML = html;
  },

  // Una fila de la lista: casilla para marcar, nombre, posición y nota.
  htmlFila(jugador) {
    const deporte = this.deporte();
    const nota = Cambios.notaDe(jugador, deporte.id);
    const posicion = Cambios.posicionDe(jugador, deporte.id);
    const presente = this.estaPresente(jugador.id);
    const faltaNota = presente && nota === null;
    const idCasilla = "presente-" + jugador.id;
    const idNota = "nota-presente-" + jugador.id;

    let clase = "fila-presente";
    if (presente) clase += " marcado";
    if (faltaNota) clase += " falta-nota";

    let html =
      '<li class="' + clase + '" data-fila="' + jugador.id + '">' +
      '<label class="fila-presente-marca" for="' + idCasilla + '">' +
      '  <input type="checkbox" id="' + idCasilla + '" data-accion="marcar" data-id="' + jugador.id + '"' + (presente ? " checked" : "") + ">" +
      '  <span class="fila-presente-nombre">' + UI.escapar(jugador.nombre) + "</span>" +
      (posicion ? ' <span class="etiqueta">' + UI.escapar(posicion) + "</span>" : "") +
      "</label>" +
      '<div class="fila-presente-nota">' +
      '  <label class="solo-lectores" for="' + idNota + '">Nota de ' + UI.escapar(jugador.nombre) + " en " + UI.escapar(deporte.nombre) + "</label>" +
      '  <select id="' + idNota + '" data-accion="nota" data-id="' + jugador.id + '">' +
      UI.opcionesNota(nota, nota === null ? "Sin nota" : null) +
      "  </select>" +
      "</div>";

    if (faltaNota) {
      const referencia = Cambios.textoNotasEnOtros(Datos.actuales, jugador, deporte.id);
      html += '<p class="fila-presente-aviso">Elegí su nota para que pueda jugar.' + (referencia ? " " + UI.escapar(referencia) : "") + "</p>";
    }
    html += "</li>";
    return html;
  },

  // Redibuja una sola fila (para no perder el lugar en la lista).
  actualizarFila(jugadorId) {
    const fila = document.querySelector('[data-fila="' + jugadorId + '"]');
    const jugador = Cambios.buscarJugador(Datos.actuales, jugadorId);
    if (fila && jugador) fila.outerHTML = this.htmlFila(jugador);
  },

  // Actualiza el contador de la barra de abajo.
  actualizarBarra() {
    const contador = document.getElementById("contador-presentes");
    if (!contador) return;
    const cantidad = this.presentes().length;
    contador.innerHTML = "<strong>" + UI.plural(cantidad, "marcado", "marcados") + "</strong>";
    UI.mostrarError(document.getElementById("error-presentes"), null);
  },

  // Muestra una pista mientras se escribe el nombre en "Agregar jugador":
  // si ya existe, avisa (y muestra su nota en otros deportes como referencia).
  actualizarPista() {
    const campo = document.getElementById("nuevo-presente-nombre");
    const pista = document.getElementById("pista-nuevo-presente");
    if (!campo || !pista) return;
    const datos = Datos.actuales;
    const deporte = this.deporte();
    const existente = Cambios.buscarJugadorPorNombre(datos, campo.value);

    if (!existente) {
      pista.textContent = "";
      return;
    }
    const nota = Cambios.notaDe(existente, deporte.id);
    if (nota !== null) {
      pista.textContent = existente.nombre + " ya está en la lista (nota " + nota + "). Tocá \"Agregar y marcar\" y queda marcado.";
    } else {
      const referencia = Cambios.textoNotasEnOtros(datos, existente, deporte.id);
      pista.textContent =
        existente.nombre + " ya está cargado, pero no tiene nota en " + deporte.nombre + "." +
        (referencia ? " " + referencia : "") + " Elegí su nota.";
    }
  },

  // Botón "Agregar y marcar".
  agregarPresente() {
    const deporte = this.deporte();
    const campoNombre = document.getElementById("nuevo-presente-nombre");
    const campoNota = document.getElementById("nuevo-presente-nota");
    const campoPosicion = document.getElementById("nuevo-presente-posicion");

    const resultado = Cambios.sumarJugadorAlDeporte(
      Datos.actuales,
      campoNombre.value,
      deporte.id,
      campoNota.value,
      campoPosicion ? campoPosicion.value || null : null
    );
    if (!resultado.ok) {
      UI.mostrarError(document.getElementById("error-nuevo-presente"), resultado.error);
      (campoNombre.value.trim() === "" ? campoNombre : campoNota).focus();
      return;
    }

    this.marcar(resultado.jugador.id, true);
    UI.guardarCambios();
    this.estado.busqueda = "";
    this.estado.nombreInicial = "";
    this.estado.formularioAbierto = true; // queda abierto para sumar a otro
    UI.redibujar();

    const nombre = resultado.jugador.nombre;
    if (resultado.caso === "nuevo") UI.avisar("Se agregó a " + nombre + " y quedó marcado.");
    if (resultado.caso === "nota-nueva") UI.avisar("Se le puso nota a " + nombre + " en " + deporte.nombre + " y quedó marcado.");
    if (resultado.caso === "ya-estaba") UI.avisar(nombre + " ya estaba en la lista: quedó marcado.", "info");
    document.getElementById("nuevo-presente-nombre").focus();
  },

  // Botón "Siguiente: cantidad de equipos": revisa que se pueda seguir.
  siguienteAPaso3() {
    const error = document.getElementById("error-presentes");
    const cantidad = this.presentes().length;
    if (cantidad < 2) {
      UI.mostrarError(error, "Marcá al menos 2 jugadores para poder armar equipos." + (cantidad === 1 ? " Por ahora hay 1." : ""));
      return;
    }
    const sinNota = this.presentesSinNota();
    if (sinNota.length > 0) {
      UI.mostrarError(
        error,
        "Falta la nota de " + UI.listaConY(sinNota.map((j) => j.nombre)) + ". Elegila al lado de su nombre (aparece marcado en amarillo)."
      );
      const primero = document.getElementById("nota-presente-" + sinNota[0].id);
      if (primero) {
        primero.closest("li").scrollIntoView({ block: "center", behavior: "smooth" });
        primero.focus({ preventScroll: true });
      }
      return;
    }
    this.irAPaso(3);
  },

  /* ---------- Paso 3: cantidad de equipos ---------- */

  htmlPaso3() {
    const cantidadJugadores = this.presentes().length;
    // Se ofrecen cantidades donde cada equipo tenga al menos 2 jugadores (y siempre al menos "2 equipos").
    const maximo = Math.max(2, Math.min(MAXIMO_EQUIPOS, Math.floor(cantidadJugadores / 2)));
    let html =
      '<section class="tarjeta">' +
      "<h3>3. ¿Cuántos equipos?</h3>" +
      "<p>Hay <strong>" + UI.plural(cantidadJugadores, "jugador marcado", "jugadores marcados") + "</strong>.</p>" +
      '<div class="grilla-cantidades">';

    for (let equipos = 2; equipos <= maximo; equipos++) {
      const analisis = Balanceo.analizarCantidad(cantidadJugadores, equipos);
      // "de 5" si quedan iguales, "de 6 y 5" si no.
      const detalle = analisis.parejo ? "de " + analisis.base : "de " + (analisis.base + 1) + " y " + analisis.base;
      html +=
        '<button type="button" class="boton-cantidad' + (equipos === this.estado.cantidadEquipos ? " elegido" : "") +
        '" data-accion="elegir-cantidad" data-cantidad="' + equipos + '">' +
        '<span class="boton-cantidad-numero">' + equipos + "</span>" +
        "<span>equipos</span>" +
        '<span class="boton-cantidad-detalle">' + detalle + "</span>" +
        (analisis.parejo ? "" : '<span class="boton-cantidad-aviso">no quedan iguales</span>') +
        "</button>";
    }
    html += "</div>";

    // Si eligió una cantidad que no queda pareja, preguntamos qué hacer.
    const elegida = this.estado.cantidadEquipos;
    if (elegida && elegida <= maximo) {
      const analisis = Balanceo.analizarCantidad(cantidadJugadores, elegida);
      if (!analisis.parejo) html += this.htmlAvisoCantidad(cantidadJugadores, elegida, analisis);
    }

    html += "</section>";
    return html;
  },

  // Aviso cuando los jugadores no se reparten justo: cuántos sobran o faltan, y qué hacer.
  htmlAvisoCantidad(cantidadJugadores, equipos, analisis) {
    const tamanios = UI.listaConY(analisis.tamanios);
    const sobran = UI.plural(analisis.sobran, "jugador", "jugadores");
    const faltan = UI.plural(analisis.faltan, "jugador", "jugadores");
    return (
      '<div class="caja-aviso" role="alert">' +
      "<p><strong>Con " + cantidadJugadores + " jugadores, los " + equipos + " equipos no quedan con la misma cantidad:</strong> quedarían de " +
      tamanios + ".</p>" +
      "<p>Para que queden iguales, " + (analisis.sobran === 1 ? "sobra " : "sobran ") + sobran + " (equipos de " + analisis.base + ") o " +
      (analisis.faltan === 1 ? "falta " : "faltan ") + faltan + " (equipos de " + (analisis.base + 1) + ").</p>" +
      '<div class="acciones">' +
      '  <button type="button" class="boton boton-secundario" data-accion="volver-a-agregar">Agregar jugadores</button>' +
      '  <button type="button" class="boton boton-principal" data-accion="seguir-distinta">Seguir con equipos de ' + tamanios + "</button>" +
      "</div>" +
      "</div>"
    );
  },

  elegirCantidad(cantidad) {
    this.estado.cantidadEquipos = cantidad;
    this.olvidarEquipos();
    const analisis = Balanceo.analizarCantidad(this.presentes().length, cantidad);
    if (analisis.parejo) {
      this.armarEquipos();
    } else {
      UI.redibujar(); // muestra el aviso con las dos opciones
    }
  },

  // Llama al algoritmo y pasa al paso 4.
  armarEquipos() {
    const deporte = this.deporte();
    const jugadores = this.presentes().map((id) => {
      const j = Cambios.buscarJugador(Datos.actuales, id);
      return { id: j.id, nombre: j.nombre, nota: Cambios.notaDe(j, deporte.id), posicion: Cambios.posicionDe(j, deporte.id) };
    });

    const resultado = Balanceo.armar({ jugadores, cantidadEquipos: this.estado.cantidadEquipos, reglas: deporte.reglas });
    if (!resultado.ok) {
      UI.avisar(resultado.error, "error");
      return;
    }
    this.estado.resultado = resultado;
    this.estado.actual = resultado.opciones[0];
    this.estado.mostradas = [resultado.opciones[0].clave];
    this.estado.confirmado = false;
    this.irAPaso(4);
  },

  /* ---------- Paso 4: equipos ---------- */

  htmlPaso4() {
    const { resultado, actual, confirmado } = this.estado;
    const deporte = this.deporte();
    let html = '<section class="seccion-equipos"><h3>4. Equipos de ' + UI.escapar(deporte.nombre) + "</h3>";

    // Avisos (posiciones que no alcanzan, reglas que no se pudieron cumplir)
    const avisos = resultado.avisosGenerales.concat(actual.avisos);
    if (avisos.length > 0) {
      html += '<div class="caja-aviso"><ul>' + avisos.map((a) => "<li>" + UI.escapar(a) + "</li>").join("") + "</ul></div>";
    }

    // Resumen de qué tan parejos quedaron
    html += '<div class="resumen-diferencia">' + this.htmlResumenDiferencia(actual) + "</div>";

    // Los equipos
    html += '<div class="grilla-equipos">';
    actual.equipos.forEach((equipo, i) => {
      html +=
        '<article class="tarjeta equipo equipo-color-' + (i % 6) + '">' +
        "<h4>Equipo " + (i + 1) + "</h4>" +
        '<p class="equipo-totales">Total <strong>' + equipo.total + "</strong> · Promedio <strong>" + UI.numero(equipo.promedio) +
        "</strong> · " + UI.plural(equipo.jugadores.length, "jugador", "jugadores") + "</p>" +
        '<ul class="equipo-jugadores">';
      equipo.jugadores.forEach((j) => {
        html +=
          "<li>" +
          '<span class="equipo-jugador-nombre">' + UI.escapar(j.nombre) +
          (j.posicion ? ' <span class="etiqueta">' + UI.escapar(j.posicion) + "</span>" : "") + "</span>" +
          '<span class="equipo-jugador-nota" title="Nota">' + j.nota + "</span>" +
          "</li>";
      });
      html += "</ul></article>";
    });
    html += "</div>";

    if (!confirmado) {
      const buenas = Balanceo.contarBuenas(resultado.opciones);
      html +=
        '<p class="texto-suave">Combinación ' + this.estado.mostradas.length + " de " + buenas +
        (buenas === 1 ? " posible igual de pareja." : " igual de parejas (o casi).") + "</p>" +
        '<div class="acciones acciones-equipos">' +
        '  <button type="button" class="boton boton-principal" data-accion="confirmar">Confirmar partido</button>' +
        '  <button type="button" class="boton boton-secundario" data-accion="otra">Otra combinación</button>' +
        '  <button type="button" class="boton boton-secundario" data-accion="copiar">Copiar equipos</button>' +
        "</div>" +
        '<p class="ayuda">"Confirmar partido" lo guarda en el Historial para cargar el resultado después. ' +
        '"Copiar equipos" copia un texto para pegar en WhatsApp (sin las notas).</p>';
    } else {
      html +=
        '<div class="caja-exito" role="status">' +
        "<p><strong>✓ Partido guardado en el Historial.</strong> Cuando termine, cargá ahí el resultado.</p>" +
        "</div>" +
        '<div class="acciones acciones-equipos">' +
        '  <button type="button" class="boton boton-secundario" data-accion="copiar">Copiar equipos</button>' +
        '  <a class="boton boton-secundario" href="#historial">Ir al historial</a>' +
        '  <button type="button" class="boton boton-principal" data-accion="nuevo-partido">Armar otro partido</button>' +
        "</div>";
    }
    html += '<div id="zona-texto-copiar"></div>';
    html += "</section>";
    return html;
  },

  // "Diferencia entre equipos: 1 punto · Muy parejos" (+ aclaración si tienen distinta cantidad).
  htmlResumenDiferencia(combinacion) {
    const dif = combinacion.diferencia;
    let calificacion;
    if (dif === 0) calificacion = "¡Totalmente parejos!";
    else if (dif <= 2) calificacion = "Muy parejos";
    else if (dif <= 5) calificacion = "Bastante parejos";
    else calificacion = "Algo desparejos (es lo más parejo posible con estas notas y reglas)";

    let html =
      "<p>Diferencia de nota total entre equipos: <strong>" + UI.plural(dif, "punto", "puntos") + "</strong> · " + calificacion + "</p>";
    if (!combinacion.mismaCantidad) {
      html +=
        '<p class="ayuda">Los equipos tienen distinta cantidad de jugadores, así que se emparejó la <strong>suma</strong> de notas ' +
        "(el equipo con menos jugadores tiene jugadores un poco mejores). Diferencia de promedio: " +
        UI.numero(combinacion.diferenciaPromedio) + ".</p>";
    }
    return html;
  },

  otraCombinacion() {
    const { resultado, mostradas } = this.estado;
    const siguiente = Balanceo.elegirOtra(resultado.opciones, mostradas);
    if (siguiente) {
      this.estado.actual = siguiente;
      this.estado.mostradas.push(siguiente.clave);
      UI.redibujar();
      return;
    }
    const buenas = Balanceo.contarBuenas(resultado.opciones);
    if (buenas === 1) {
      UI.avisar("Con estos jugadores no hay otra combinación igual de pareja.", "info");
      return;
    }
    // Ya se mostraron todas: volvemos a empezar por la mejor.
    this.estado.actual = resultado.opciones[0];
    this.estado.mostradas = [resultado.opciones[0].clave];
    UI.redibujar();
    UI.avisar("Ya viste las " + buenas + " combinaciones parejas. Volvemos a la primera.", "info");
  },

  async copiar() {
    const texto = Balanceo.textoParaCompartir(this.deporte().nombre, this.estado.actual, new Date());
    const salioBien = await UI.copiarTexto(texto);
    if (salioBien) {
      UI.avisar("Equipos copiados. Abrí WhatsApp y pegalos en el grupo.");
      return;
    }
    // Si el navegador no deja copiar solo, mostramos el texto para copiarlo a mano.
    const zona = document.getElementById("zona-texto-copiar");
    zona.innerHTML =
      '<div class="campo">' +
      '<label for="texto-copiar">No se pudo copiar automáticamente. Mantené apretado el texto (o seleccionalo) y copialo:</label>' +
      '<textarea id="texto-copiar" class="texto-copiar" rows="10" readonly>' + UI.escapar(texto) + "</textarea>" +
      "</div>";
    const cuadro = document.getElementById("texto-copiar");
    cuadro.focus();
    cuadro.select();
  },

  confirmarPartido() {
    if (this.estado.confirmado) return;
    Cambios.crearPartido(Datos.actuales, this.estado.deporteId, this.estado.actual);
    UI.guardarCambios();
    this.estado.confirmado = true;
    UI.redibujar(); // la caja verde "Partido guardado" ya avisa, no hace falta otro mensaje
  },

  /* ---------- Eventos ---------- */

  conectarEventos(raiz) {
    // Clics en botones (se fijan en "data-accion")
    raiz.addEventListener("click", (evento) => {
      const boton = evento.target.closest("button[data-accion]");
      if (!boton) return;

      switch (boton.dataset.accion) {
        case "ir-paso":
          this.irAPaso(Number(boton.dataset.paso));
          break;
        case "elegir-deporte":
          if (this.estado.deporteId !== boton.dataset.deporte) {
            this.estado.deporteId = boton.dataset.deporte;
            this.estado.busqueda = "";
            this.estado.cantidadEquipos = null;
            this.olvidarEquipos();
          }
          this.irAPaso(2);
          break;
        case "abrir-formulario":
          this.estado.formularioAbierto = true;
          this.estado.nombreInicial = "";
          UI.redibujar();
          document.getElementById("nuevo-presente-nombre").focus();
          break;
        case "agregar-desde-busqueda":
          this.estado.formularioAbierto = true;
          this.estado.nombreInicial = Cambios.limpiarNombre(this.estado.busqueda);
          UI.redibujar();
          this.actualizarPista();
          document.getElementById("nuevo-presente-nota").focus();
          break;
        case "cerrar-formulario":
          this.estado.formularioAbierto = false;
          UI.redibujar();
          break;
        case "marcar-ultimo": {
          const ultimo = Cambios.ultimoPartido(Datos.actuales, this.estado.deporteId);
          let cantidad = 0;
          ultimo.equipos.forEach((e) =>
            e.jugadores.forEach((j) => {
              if (Cambios.buscarJugador(Datos.actuales, j.jugadorId) && !this.estaPresente(j.jugadorId)) {
                this.marcar(j.jugadorId, true);
                cantidad++;
              }
            })
          );
          UI.redibujar();
          UI.avisar(cantidad > 0 ? "Se marcaron " + UI.plural(cantidad, "jugador", "jugadores") + " del último partido." : "Ya estaban todos marcados.", "info");
          break;
        }
        case "desmarcar-todos":
          this.estado.presentesPorDeporte[this.estado.deporteId] = [];
          this.estado.soloMarcados = false;
          this.olvidarEquipos();
          UI.redibujar();
          break;
        case "solo-marcados":
          this.estado.soloMarcados = !this.estado.soloMarcados;
          UI.redibujar();
          break;
        case "ver-guia":
          this.estado.verGuia = !this.mostrarGuia();
          if (!this.estado.verGuia) Datos.guardarPreferencias({ guiaVista: true });
          UI.redibujar();
          break;
        case "cerrar-guia":
          this.estado.verGuia = false;
          Datos.guardarPreferencias({ guiaVista: true });
          UI.redibujar();
          break;
        case "siguiente-paso3":
          this.siguienteAPaso3();
          break;
        case "elegir-cantidad":
          this.elegirCantidad(Number(boton.dataset.cantidad));
          break;
        case "volver-a-agregar":
          this.estado.formularioAbierto = true;
          this.irAPaso(2);
          break;
        case "seguir-distinta":
          this.armarEquipos();
          break;
        case "otra":
          this.otraCombinacion();
          break;
        case "copiar":
          this.copiar();
          break;
        case "confirmar":
          this.confirmarPartido();
          break;
        case "nuevo-partido":
          // Vuelve al paso 2 con el mismo deporte y los mismos marcados (lo más común es repetir).
          this.olvidarEquipos();
          this.estado.cantidadEquipos = null;
          this.irAPaso(2);
          break;
      }
    });

    // Casillas (marcar presente) y notas en la lista
    raiz.addEventListener("change", (evento) => {
      const campo = evento.target;
      const jugadorId = campo.dataset.id;

      if (campo.dataset.accion === "marcar") {
        this.marcar(jugadorId, campo.checked);
        this.actualizarFila(jugadorId);
        this.actualizarBarra();
        // Si lo marcó y no tiene nota, llevamos el cursor a la nota.
        if (campo.checked && Cambios.notaDe(Cambios.buscarJugador(Datos.actuales, jugadorId), this.estado.deporteId) === null) {
          document.getElementById("nota-presente-" + jugadorId).focus();
        } else {
          document.getElementById("presente-" + jugadorId).focus();
        }
      }

      if (campo.dataset.accion === "nota" && campo.value !== "") {
        // La nota se guarda al instante (y queda en el historial de notas del jugador).
        Cambios.cambiarNota(Datos.actuales, jugadorId, this.estado.deporteId, campo.value, "Ajuste al armar equipos");
        UI.guardarCambios();
        this.olvidarEquipos();
        this.actualizarFila(jugadorId);
        document.getElementById("nota-presente-" + jugadorId).focus();
      }
    });

    // Escribir en el buscador o en el nombre del jugador nuevo
    raiz.addEventListener("input", (evento) => {
      if (evento.target.id === "buscar-presente") {
        this.estado.busqueda = evento.target.value;
        this.dibujarListaPresentes();
      }
      if (evento.target.id === "nuevo-presente-nombre") this.actualizarPista();
    });

    // Formulario "Agregar jugador"
    raiz.addEventListener("submit", (evento) => {
      evento.preventDefault();
      if (evento.target.id === "form-nuevo-presente") this.agregarPresente();
    });
  },
};
