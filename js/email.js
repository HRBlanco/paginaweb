(function(){
  // Inicializa EmailJS (reemplaza TU_USER_ID por tu ID real de EmailJS)
  if (typeof emailjs !== 'undefined') {
    emailjs.init("VoD7d1Up0F4Efmkm5");
  }

  // Manejador para formulario de contacto (foro)
  var contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', function(event){
      event.preventDefault();
      emailjs.sendForm('service_jp2089a','template_0yv0vwp', this)
      .then(function(){
        alert("Consulta enviada correctamente!");
        contactForm.reset();
      }, function(err){
        alert("Error al enviar: "+JSON.stringify(err));
      });
    });
  }

  // Manejador para formulario de reserva (agenda)
  var reservaForm = document.getElementById('reservaForm');
  if (reservaForm) {
    // Configuración: URL base y token de Apps Script (compartido)
    var BASE_URL = 'https://script.google.com/macros/s/AKfycbxtjlEV0UAcaAZkyJJ7O6YskVnaFbJ9JvsqoBg5GQJxwgJNNI-utZsMqpRokNBYsonq1g/exec';
    var TOKEN = 'tkn_4f1b2c9e8a7d40f3b6a1d2c5e7f9a0b3';

    // Config por defecto (editable por la dueña desde HTML data-attributes)
    var CONFIG = {
      jornada: { inicio: '08:00', fin: '21:00' },
      no_laborables: [], // array de YYYY-MM-DD (si no usamos Apps Script, quedará vacío)
      bloquear_finde: true
    };

    // Sobrescribir desde atributos del formulario para que la dueña lo cambie sin código
    (function applyHtmlDataConfig(){
      try {
        var ini = reservaForm.dataset.inicio || reservaForm.getAttribute('data-inicio');
        var fin = reservaForm.dataset.fin || reservaForm.getAttribute('data-fin');
        var bf  = reservaForm.dataset.bloquearFinde || reservaForm.getAttribute('data-bloquear-finde');
        if (ini && /\d{2}:\d{2}/.test(ini)) CONFIG.jornada.inicio = ini;
        if (fin && /\d{2}:\d{2}/.test(fin)) CONFIG.jornada.fin = fin;
        if (typeof bf === 'string') CONFIG.bloquear_finde = (/^(1|true|si|sí)$/i).test(bf);
      } catch(_) {}
    })();

    // Utilidades de validación
    function parseHM(hm){ var a = (hm||'').split(':'); return {h: +(a[0]||0), m: +(a[1]||0)}; }
    function inBusinessHours(date, hm, jornada){
      var t = parseHM(hm);
      var ji = parseHM(jornada.inicio), jf = parseHM(jornada.fin);
      var d0 = new Date(date.getFullYear(), date.getMonth(), date.getDate(), t.h, t.m, 0, 0);
      var di = new Date(date.getFullYear(), date.getMonth(), date.getDate(), ji.h, ji.m, 0, 0);
      var df = new Date(date.getFullYear(), date.getMonth(), date.getDate(), jf.h, jf.m, 0, 0);
      return d0 >= di && d0 <= df;
    }
    function isWeekend(date){ var d = date.getDay(); return d === 0 || d === 6; }
    function todayISO(){ var n = new Date(); var mm = String(n.getMonth()+1).padStart(2,'0'); var dd = String(n.getDate()).padStart(2,'0'); return n.getFullYear()+"-"+mm+"-"+dd; }
    function generateNonce(){ try{ var u=new Uint8Array(16); crypto.getRandomValues(u); return Array.from(u).map(b=>b.toString(16).padStart(2,'0')).join(''); }catch(e){ return Date.now().toString(16)+Math.random().toString(16).slice(2); } }
    function roundUpTo15(date){ var d=new Date(date.getTime()); d.setMinutes(Math.ceil(d.getMinutes()/15)*15,0,0); return d; }
    function timeOnDate(date, hm){ var p = parseHM(hm); return new Date(date.getFullYear(), date.getMonth(), date.getDate(), p.h, p.m, 0, 0); }

    // Opcional: Cargar configuración desde Apps Script (si existe y deseas usarla)
    // Si no quieres depender del backend, esto se ignora sin problema.
    (function loadConfig(){
      var url = BASE_URL + '?accion=config&token=' + encodeURIComponent(TOKEN);
      fetch(url, { method: 'GET' })
        .then(function(r){ return r.ok ? r.json() : null; })
        .then(function(data){
          if (data && typeof data === 'object') {
            if (data.jornada && data.jornada.inicio && data.jornada.fin) CONFIG.jornada = data.jornada;
            if (Array.isArray(data.no_laborables)) CONFIG.no_laborables = data.no_laborables;
            if (typeof data.bloquear_finde === 'boolean') CONFIG.bloquear_finde = data.bloquear_finde;
          }
        })
        .catch(function(){ /* silencioso: usará defaults o data-attributes */ });
    })();

    reservaForm.addEventListener('submit', function(event){
      event.preventDefault();
      // Datos
      var nombre = (reservaForm.nombre.value||'').trim();
      var email  = (reservaForm.email.value||'').trim();
      var fecha  = reservaForm.fecha.value;
      var hora   = reservaForm.hora.value;
      var motivo = (reservaForm.mensaje.value||'').trim();

      // Validaciones front (fecha futura, no laborables y jornada)
      if (!nombre || !email || !fecha || !hora) { alert('Por favor completa nombre, correo, fecha y hora.'); return; }
      if (fecha < todayISO()) { alert('La fecha debe ser futura.'); return; }
      var dateObj = new Date(fecha + 'T00:00:00');
      if (CONFIG.bloquear_finde && isWeekend(dateObj)) { alert('No se atiende fines de semana. Elige un día hábil.'); return; }
      if (CONFIG.no_laborables && CONFIG.no_laborables.indexOf(fecha) !== -1) { alert('La fecha seleccionada está marcada como no laborable.'); return; }
      if (!inBusinessHours(dateObj, hora, CONFIG.jornada)) { alert('La hora debe estar dentro de la jornada ('+CONFIG.jornada.inicio+' a '+CONFIG.jornada.fin+').'); return; }

      // Regla adicional: si la reserva es para HOY, exigir al menos +1 hora desde ahora (redondeado a 15min)
      if (fecha === todayISO()) {
        var now = new Date();
        var threshold = roundUpTo15(new Date(now.getTime() + 60*60*1000));
        var chosen = timeOnDate(dateObj, hora);
        if (chosen < threshold) {
          var hh = String(threshold.getHours()).padStart(2,'0');
          var mm = String(threshold.getMinutes()).padStart(2,'0');
          alert('Para reservas de hoy, selecciona una hora a partir de las '+hh+':'+mm+'.');
          return;
        }
      }

      // Seguridad: expira en 2 horas y nonce de uso único (Apps Script los validará)
      var exp = Date.now() + 2 * 60 * 60 * 1000; // +2h en ms
      var nonce = generateNonce();

      // Construye enlace de confirmación
      var params = new URLSearchParams({
        token: TOKEN,
        exp: String(exp),
        nonce: nonce,
        nombre: nombre,
        email: email,
        fecha: fecha,
        hora: hora,
        mensaje: motivo
      });
      var qs = '?' + params.toString();
      var confirmUrl = BASE_URL + qs + '&accion=aceptar';
      var rejectUrl  = BASE_URL + qs + '&accion=rechazar';
      var postponeUrl= BASE_URL + qs + '&accion=posponer';
      var hidden;
      hidden = document.getElementById('confirm_url'); if (hidden) hidden.value = confirmUrl;
      hidden = document.getElementById('reject_url');  if (hidden) hidden.value = rejectUrl;
      hidden = document.getElementById('postpone_url');if (hidden) hidden.value = postponeUrl;

      // Enviar con EmailJS usando plantilla de reservas
      emailjs.sendForm('service_jp2089a','template_gu91hqk', this)
      .then(function(){
        alert("Solicitud de reserva enviada. Te contactaremos para confirmar.");
        reservaForm.reset();
      }, function(err){
        alert("Error al enviar la solicitud: "+JSON.stringify(err));
      });
    });
  }
})();
