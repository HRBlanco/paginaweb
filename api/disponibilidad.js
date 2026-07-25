// Lee el calendario público de Google (feed .ics) y devuelve la disponibilidad
// de los próximos días, ya convertida a hora de Chile.
//
// No necesita API key ni cuenta de servicio: el calendario está publicado,
// y Google entrega las recurrencias ya expandidas en el feed.

const CALENDAR_ID = process.env.ID_CALENDARIO ||
  '2d2a6e4e9312a51b6a8fe9dedffa242b0eff81461e1bdb03181a69025f9f01d4@group.calendar.google.com';

const TZ = 'America/Santiago';

// Un evento de 4 h o más NO es una cita: es el bloque de horario de atención
// que Google crea con los "Programas de citas". Esos definen cuándo atiende
// Anyuri. Los eventos más cortos sí son citas y ocupan la hora.
const MIN_JORNADA = 240;   // minutos
const SLOT = 60;           // duración de cada hueco, en minutos
const DIAS_POR_DEFECTO = 15;
const MARGEN_HOY = 60;     // no ofrecer horas a menos de 1 h de ahora

// Horario que se aplica a los días sin bloque propio en el calendario.
// Coincide con el que anuncia el formulario de la página.
const JORNADA_FALLBACK = { inicio: '08:00', fin: '21:00' };

const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// --- Utilidades de zona horaria -------------------------------------------

const partesTZ = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

// Convierte un instante absoluto a la fecha/hora que marca el reloj en Chile.
function enChile(date) {
  const p = {};
  for (const parte of partesTZ.formatToParts(date)) p[parte.type] = parte.value;
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    minutos: (+p.hour) * 60 + (+p.minute)
  };
}

// Camino inverso: una hora de reloj chilena -> instante absoluto.
// Itera porque el desfase cambia con el horario de verano.
function desdeChile(y, mes, d, h, min) {
  const objetivo = Date.UTC(y, mes - 1, d, h, min);
  let ts = objetivo;
  for (let i = 0; i < 3; i++) {
    const p = enChile(new Date(ts));
    const [py, pm, pd] = p.fecha.split('-').map(Number);
    const actual = Date.UTC(py, pm - 1, pd, Math.floor(p.minutos / 60), p.minutos % 60);
    const desfase = objetivo - actual;
    if (desfase === 0) break;
    ts += desfase;
  }
  return ts;
}

function hhmm(minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, '0');
  const m = String(minutos % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function aMinutos(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// --- Lectura del calendario ------------------------------------------------

// Las líneas largas del formato .ics vienen partidas: las continuaciones
// empiezan con espacio o tabulación y hay que volver a unirlas.
function desdoblarLineas(texto) {
  return texto.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

// DTSTART puede venir de tres formas:
//   20260725T210000Z              -> instante UTC
//   TZID=...:20260725T170000      -> hora local del calendario
//   VALUE=DATE:20260725           -> día completo
function leerFecha(propiedad, valor) {
  const soloFecha = /VALUE=DATE(?!-TIME)/.test(propiedad);
  const limpio = valor.trim();

  if (soloFecha || /^\d{8}$/.test(limpio)) {
    const y = +limpio.slice(0, 4), mo = +limpio.slice(4, 6), d = +limpio.slice(6, 8);
    return { ts: desdeChile(y, mo, d, 0, 0), diaCompleto: true };
  }

  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/.exec(limpio);
  if (!m) return null;

  const [, y, mo, d, h, mi, , esUTC] = m;
  const ts = esUTC
    ? Date.UTC(+y, +mo - 1, +d, +h, +mi)
    : desdeChile(+y, +mo, +d, +h, +mi); // sin Z: hora de reloj chilena

  return { ts, diaCompleto: false };
}

function parsearEventos(ics) {
  const lineas = desdoblarLineas(ics).split('\n');
  const eventos = [];
  let actual = null;

  for (const linea of lineas) {
    if (linea.startsWith('BEGIN:VEVENT')) { actual = {}; continue; }

    if (linea.startsWith('END:VEVENT')) {
      if (actual && actual.inicio && actual.fin) eventos.push(actual);
      actual = null;
      continue;
    }

    if (!actual) continue;

    const corte = linea.indexOf(':');
    if (corte === -1) continue;
    const propiedad = linea.slice(0, corte);
    const valor = linea.slice(corte + 1);
    const nombre = propiedad.split(';')[0].toUpperCase();

    if (nombre === 'DTSTART') actual.inicio = leerFecha(propiedad, valor);
    else if (nombre === 'DTEND') actual.fin = leerFecha(propiedad, valor);
    else if (nombre === 'STATUS') actual.estado = valor.trim().toUpperCase();
    else if (nombre === 'TRANSP') actual.transp = valor.trim().toUpperCase();
  }

  // Los cancelados y los marcados como "disponible" no ocupan.
  return eventos.filter(e =>
    e.inicio && e.fin &&
    e.estado !== 'CANCELLED' &&
    e.transp !== 'TRANSPARENT'
  );
}

async function descargarCalendario() {
  const url = 'https://calendar.google.com/calendar/ical/' +
    encodeURIComponent(CALENDAR_ID) + '/public/basic.ics';

  const resp = await fetch(url, { headers: { 'Accept': 'text/calendar' } });
  if (!resp.ok) throw new Error('El calendario respondió ' + resp.status);
  return resp.text();
}

// --- Construcción de la disponibilidad -------------------------------------

function construirDias(eventos, numDias) {
  const ahora = Date.now();
  const hoy = enChile(new Date(ahora));
  const [hoyY, hoyM, hoyD] = hoy.fecha.split('-').map(Number);

  // Sólo interesan los eventos que tocan la ventana que vamos a mostrar.
  const desde = desdeChile(hoyY, hoyM, hoyD, 0, 0);
  const hasta = desde + numDias * 24 * 60 * 60 * 1000;
  const enRango = eventos.filter(e => e.inicio.ts < hasta && e.fin.ts > desde);

  const jornadas = enRango.filter(e => (e.fin.ts - e.inicio.ts) / 60000 >= MIN_JORNADA);
  const citas    = enRango.filter(e => (e.fin.ts - e.inicio.ts) / 60000 <  MIN_JORNADA);

  const dias = [];

  for (let i = 0; i < numDias; i++) {
    const inicioDia = desdeChile(hoyY, hoyM, hoyD + i, 0, 0);
    const fechaObj = new Date(inicioDia);
    const fecha = enChile(fechaObj).fecha;
    const [y, mo, d] = fecha.split('-').map(Number);
    const finDia = desdeChile(y, mo, d + 1, 0, 0);
    const diaSemana = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();

    // ¿Qué franja atiende ese día? La marcan los bloques del calendario.
    let apertura = null, cierre = null;
    for (const j of jornadas) {
      if (j.inicio.ts >= finDia || j.fin.ts <= inicioDia) continue;
      const ini = j.inicio.ts <= inicioDia ? 0    : enChile(new Date(j.inicio.ts)).minutos;
      const fin = j.fin.ts    >= finDia    ? 1440 : enChile(new Date(j.fin.ts)).minutos;
      apertura = apertura === null ? ini : Math.min(apertura, ini);
      cierre   = cierre   === null ? fin : Math.max(cierre, fin);
    }

    // Los días sin bloque propio (fin de semana, lunes) también admiten
    // solicitudes: se les aplica el horario que anuncia la página.
    if (apertura === null) {
      apertura = aMinutos(JORNADA_FALLBACK.inicio);
      cierre   = aMinutos(JORNADA_FALLBACK.fin);
    }

    if (apertura === null || cierre === null || cierre - apertura < SLOT) {
      dias.push({
        fecha,
        diaSemana: NOMBRE_DIA[diaSemana],
        numeroDia: d,
        atiende: false,
        slots: []
      });
      continue;
    }

    const slots = [];
    for (let m = apertura; m + SLOT <= cierre; m += SLOT) {
      const slotIni = inicioDia + m * 60000;
      const slotFin = slotIni + SLOT * 60000;

      let estado = 'libre';

      // Horas que ya pasaron (o demasiado próximas) no se pueden pedir.
      if (slotIni < ahora + MARGEN_HOY * 60000) {
        estado = 'pasado';
      } else if (citas.some(c => c.inicio.ts < slotFin && c.fin.ts > slotIni)) {
        estado = 'ocupado';
      }

      slots.push({ hora: hhmm(m), estado });
    }

    dias.push({
      fecha,
      diaSemana: NOMBRE_DIA[diaSemana],
      numeroDia: d,
      atiende: slots.some(s => s.estado === 'libre'),
      jornada: { inicio: hhmm(apertura), fin: hhmm(cierre) },
      slots
    });
  }

  // Las citas se listan aparte, incluidos los días sin horario de atención:
  // Anyuri a veces agenda fuera de su horario habitual y esas horas también
  // tienen que quedar bloqueadas.
  const ocupadas = [];
  for (const c of citas) {
    const ini = enChile(new Date(c.inicio.ts));
    const fin = enChile(new Date(c.fin.ts));
    ocupadas.push({
      fecha: ini.fecha,
      inicio: hhmm(ini.minutos),
      fin: fin.fecha === ini.fecha ? hhmm(fin.minutos) : '24:00'
    });
  }
  ocupadas.sort((a, b) => (a.fecha + a.inicio).localeCompare(b.fecha + b.inicio));

  return { dias, ocupadas };
}

// --- Handler ---------------------------------------------------------------

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });

  const pedidos = parseInt((req.query && req.query.dias) || '', 10);
  const numDias = Math.min(Math.max(pedidos || DIAS_POR_DEFECTO, 1), 60);

  try {
    const ics = await descargarCalendario();
    const eventos = parsearEventos(ics);
    const { dias, ocupadas } = construirDias(eventos, numDias);

    // Se cachea 5 minutos en el CDN para no consultar a Google en cada visita.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      ok: true,
      zona: TZ,
      slotMinutos: SLOT,
      dias,
      ocupadas
    });
  } catch (err) {
    console.error('Error de disponibilidad:', err.message);
    return res.status(502).json({ ok: false, error: 'No se pudo leer el calendario' });
  }
};

// Reutilizado por api/reserva.js para revalidar del lado del servidor.
module.exports.consultarDisponibilidad = async function (numDias) {
  const ics = await descargarCalendario();
  return construirDias(parsearEventos(ics), numDias || DIAS_POR_DEFECTO);
};
