// Calendario de disponibilidad de la página de agenda.
// Lee /api/disponibilidad y pinta los próximos 15 días con sus horas libres.
// Al elegir una hora, rellena el formulario de solicitud.

(function () {
  var contenedor = document.getElementById('calendario-disponibilidad');
  if (!contenedor) return;

  var DIAS = 15;
  var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
               'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var ABREV = { 'domingo': 'dom', 'lunes': 'lun', 'martes': 'mar',
                'miércoles': 'mié', 'jueves': 'jue', 'viernes': 'vie', 'sábado': 'sáb' };

  var datos = null;
  var fechaActiva = null;

  // Expuesto para que el formulario pueda validar contra lo mismo que se pinta.
  window.Disponibilidad = {
    cargado: false,
    ocupadas: [],
    dias: [],
    // ¿Choca esta fecha/hora con una cita ya agendada?
    estaOcupado: function (fecha, hora) {
      if (!this.cargado || !hora) return false;
      var min = aMinutos(hora);
      return this.ocupadas.some(function (o) {
        return o.fecha === fecha && min >= aMinutos(o.inicio) && min < aMinutos(o.fin);
      });
    },
    // ¿Es un día en el que normalmente hay atención?
    hayAtencion: function (fecha) {
      if (!this.cargado) return true;
      var d = this.dias.find(function (x) { return x.fecha === fecha; });
      return d ? d.atiende : true;
    }
  };

  function aMinutos(hm) {
    var p = String(hm).split(':');
    return (+p[0] || 0) * 60 + (+p[1] || 0);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function libresDe(dia) {
    return dia.slots.filter(function (s) { return s.estado === 'libre'; }).length;
  }

  // --- Estados de carga -----------------------------------------------------

  function pintarCargando() {
    var pastillas = '';
    for (var i = 0; i < 7; i++) {
      pastillas += '<div class="animate-pulse shrink-0 w-[74px] h-[78px] rounded-xl bg-rose-100/70"></div>';
    }
    contenedor.innerHTML =
      '<div class="flex gap-2 overflow-hidden mb-5">' + pastillas + '</div>' +
      '<div class="animate-pulse h-4 w-52 bg-rose-100/70 rounded mb-4"></div>' +
      '<div class="grid grid-cols-3 sm:grid-cols-4 gap-2">' +
        '<div class="animate-pulse h-10 rounded-lg bg-rose-100/70"></div>'.repeat(8) +
      '</div>';
  }

  function pintarError() {
    contenedor.innerHTML =
      '<div class="text-center py-8 px-4">' +
        '<i class="far fa-calendar-times text-3xl text-rose-300 mb-3"></i>' +
        '<p class="text-navy-800 font-semibold mb-1">No pudimos cargar la disponibilidad</p>' +
        '<p class="text-sm text-navy-700/70">Puedes enviar tu solicitud igualmente y te confirmaremos la hora por correo.</p>' +
      '</div>';
  }

  // --- Pintado --------------------------------------------------------------

  function pintar() {
    var dias = datos.dias;

    var tira = dias.map(function (d) {
      var libres = libresDe(d);
      var activo = d.fecha === fechaActiva;
      var clases, contenido;

      if (!d.atiende || libres === 0) {
        clases = 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed';
        contenido = '<span class="text-[10px] leading-tight">sin<br>atención</span>';
      } else if (activo) {
        clases = 'bg-rose-400 border-rose-400 text-white shadow-md';
        contenido = '<span class="text-[10px] font-semibold">' + libres + ' hrs</span>';
      } else {
        clases = 'bg-white border-rose-200 text-navy-800 hover:border-rose-400 hover:shadow-sm cursor-pointer';
        contenido = '<span class="text-[10px] font-semibold text-rose-500">' + libres + ' hrs</span>';
      }

      return '<button type="button" data-fecha="' + d.fecha + '"' +
        (d.atiende && libres ? '' : ' disabled') +
        ' class="dia-pastilla shrink-0 w-[74px] py-2 rounded-xl border-2 flex flex-col items-center gap-0.5 transition ' + clases + '">' +
          '<span class="text-[11px] uppercase tracking-wide opacity-80">' + esc(ABREV[d.diaSemana] || d.diaSemana) + '</span>' +
          '<span class="text-xl font-bold leading-none">' + d.numeroDia + '</span>' +
          contenido +
        '</button>';
    }).join('');

    var seleccionado = dias.find(function (d) { return d.fecha === fechaActiva; });
    var panel;

    if (!seleccionado) {
      panel = '<p class="text-sm text-navy-700/70 text-center py-6">' +
        'No hay horas disponibles en los próximos ' + DIAS + ' días. ' +
        'Envía tu solicitud y te propondremos una fecha.</p>';
    } else {
      var partes = seleccionado.fecha.split('-');
      var titulo = seleccionado.diaSemana + ' ' + (+partes[2]) + ' de ' + MESES[+partes[1] - 1];

      var botones = seleccionado.slots.map(function (s) {
        if (s.estado === 'pasado') {
          return '<span class="py-2.5 px-1 rounded-lg border border-slate-100 text-slate-300 text-sm text-center select-none">' + s.hora + '</span>';
        }
        if (s.estado === 'ocupado') {
          return '<span title="Hora ya reservada" class="py-2.5 px-1 rounded-lg border border-slate-200 bg-slate-100 text-slate-400 text-sm text-center line-through select-none">' + s.hora + '</span>';
        }
        return '<button type="button" data-hora="' + s.hora + '" ' +
          'class="slot-libre py-2.5 px-1 rounded-lg border-2 border-rose-200 text-navy-800 text-sm font-medium text-center hover:bg-rose-400 hover:border-rose-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-rose-300 transition">' +
          s.hora + '</button>';
      }).join('');

      panel =
        '<p class="text-sm font-semibold text-navy-800 mb-1 capitalize">' + esc(titulo) + '</p>' +
        '<p class="text-xs text-navy-700/60 mb-3">Toca una hora para completar el formulario</p>' +
        '<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">' + botones + '</div>';
    }

    contenedor.innerHTML =
      '<div class="flex gap-2 overflow-x-auto pb-2 mb-5 -mx-1 px-1 scroll-smooth">' + tira + '</div>' +
      '<div id="panel-horas">' + panel + '</div>' +
      '<div class="flex flex-wrap gap-x-5 gap-y-1.5 mt-4 pt-3 border-t border-rose-100 text-xs text-navy-700/70">' +
        '<span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded border-2 border-rose-300 inline-block"></span>Disponible</span>' +
        '<span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-slate-200 inline-block"></span>Reservada</span>' +
        '<span class="flex items-center gap-1.5"><i class="far fa-clock"></i>Hora de Chile</span>' +
      '</div>';

    var activa = contenedor.querySelector('.dia-pastilla.bg-rose-400');
    if (activa && activa.scrollIntoView) {
      activa.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  // --- Interacción ----------------------------------------------------------

  contenedor.addEventListener('click', function (e) {
    var pastilla = e.target.closest('.dia-pastilla');
    if (pastilla && !pastilla.disabled) {
      fechaActiva = pastilla.dataset.fecha;
      pintar();
      return;
    }

    var slot = e.target.closest('.slot-libre');
    if (slot) elegirHora(fechaActiva, slot.dataset.hora);
  });

  function elegirHora(fecha, hora) {
    var campoFecha = document.getElementById('fecha');
    var campoHora = document.getElementById('hora');
    if (!campoFecha || !campoHora) return;

    campoFecha.value = fecha;
    campoHora.disabled = false;
    campoHora.value = hora;

    // Avisar a los validadores que ya escuchan estos campos.
    campoFecha.dispatchEvent(new Event('change', { bubbles: true }));
    campoHora.dispatchEvent(new Event('change', { bubbles: true }));

    var form = document.getElementById('reservaForm');
    if (form && form.scrollIntoView) {
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Destello para que se note que el formulario se completó solo.
    [campoFecha, campoHora].forEach(function (campo) {
      campo.classList.add('ring-2', 'ring-rose-400');
      setTimeout(function () { campo.classList.remove('ring-2', 'ring-rose-400'); }, 1600);
    });
  }

  // --- Aviso en vivo bajo el campo de hora ----------------------------------

  (function vigilarFormulario() {
    var campoFecha = document.getElementById('fecha');
    var campoHora = document.getElementById('hora');
    if (!campoFecha || !campoHora) return;

    // La página tiene otro validador sobre este mismo campo, así que sólo
    // se toca la validez del navegador cuando el aviso es nuestro.
    var errorPropio = false;

    function aviso() {
      var el = document.getElementById('aviso_ocupado');
      if (!el) {
        el = document.createElement('p');
        el.id = 'aviso_ocupado';
        campoHora.parentElement.appendChild(el);
      }
      return el;
    }

    function revisar() {
      var el = aviso();
      var fecha = campoFecha.value;
      var hora = campoHora.value;

      function limpiar() {
        el.textContent = '';
        el.style.display = 'none';
        if (errorPropio) { campoHora.setCustomValidity(''); errorPropio = false; }
      }

      if (!fecha || !hora || !window.Disponibilidad.cargado) return limpiar();

      if (window.Disponibilidad.estaOcupado(fecha, hora)) {
        el.textContent = 'Esa hora ya está reservada. Elige otra del calendario.';
        el.className = 'text-sm mt-1 text-red-600 font-medium';
        el.style.display = '';
        campoHora.setCustomValidity('Esa hora ya está reservada');
        errorPropio = true;
        return;
      }

      if (!window.Disponibilidad.hayAtencion(fecha)) {
        el.textContent = 'Ese día no hay atención habitual, pero puedes enviar la solicitud.';
        el.className = 'text-sm mt-1 text-amber-600';
        el.style.display = '';
        if (errorPropio) { campoHora.setCustomValidity(''); errorPropio = false; }
        return;
      }

      limpiar();
    }

    // La página tiene su propio validador sobre el campo de hora y lo registra
    // después que éste, así que borraría el aviso. Aplazando un tick, esta
    // comprobación corre siempre la última sin depender del orden de scripts.
    function programar() { setTimeout(revisar, 0); }

    campoFecha.addEventListener('change', programar);
    campoHora.addEventListener('change', programar);
    campoHora.addEventListener('input', programar);
    document.addEventListener('disponibilidad:lista', programar);
  })();

  // --- Arranque -------------------------------------------------------------

  pintarCargando();

  fetch('/api/disponibilidad?dias=' + DIAS)
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || !d.ok || !d.dias) throw new Error('respuesta inválida');

      datos = d;
      window.Disponibilidad.cargado = true;
      window.Disponibilidad.ocupadas = d.ocupadas || [];
      window.Disponibilidad.dias = d.dias;

      var primero = d.dias.find(function (x) { return x.atiende && libresDe(x) > 0; });
      fechaActiva = primero ? primero.fecha : null;

      pintar();
      document.dispatchEvent(new CustomEvent('disponibilidad:lista'));
    })
    .catch(function (err) {
      console.error('Disponibilidad:', err.message);
      pintarError();
    });
})();
