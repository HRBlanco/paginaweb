const { consultarDisponibilidad } = require('./disponibilidad.js');

function aMinutos(hm) {
  const [h, m] = String(hm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) { body = {}; }
  }

  const { nombre, email, fecha, hora, mensaje, confirm_url, reject_url, postpone_url } = body || {};

  if (!nombre || !email || !fecha || !hora) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  // La validación del navegador se puede saltar, así que se vuelve a comprobar
  // contra el calendario. Si el calendario no responde, se deja pasar la
  // solicitud: es preferible revisarla a mano que perderla.
  try {
    const { ocupadas } = await consultarDisponibilidad(60);
    const minuto = aMinutos(hora);
    const choca = ocupadas.some(o =>
      o.fecha === fecha && minuto >= aMinutos(o.inicio) && minuto < aMinutos(o.fin)
    );
    if (choca) {
      return res.status(409).json({
        error: 'Esa hora ya está reservada. Por favor elige otra en el calendario.'
      });
    }
  } catch (err) {
    console.warn('No se pudo verificar el calendario:', err.message);
  }

  const accionesHtml = (confirm_url && reject_url && postpone_url) ? `
    <p style="font-size:14px;font-weight:bold;margin-bottom:16px;">¿Qué deseas hacer con esta solicitud?</p>
    <div>
      <a href="${confirm_url}" style="background:#22c55e;color:white;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:0 8px 8px 0;">✓ Aceptar</a>
      <a href="${reject_url}" style="background:#ef4444;color:white;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin:0 8px 8px 0;">✗ Rechazar</a>
      <a href="${postpone_url}" style="background:#f59e0b;color:white;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;margin-bottom:8px;">⏱ Posponer</a>
    </div>` : '';

  const htmlContent = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1c3350;">
  <div style="background:#ec7ca0;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:white;margin:0;font-size:22px;">Nueva solicitud de reserva</h1>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #fce7f3;border-top:none;">
    <p style="font-size:15px;margin-bottom:20px;">Ha llegado una nueva solicitud de cita desde el sitio web:</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:8px 0;color:#666;width:130px;">Nombre</td><td style="padding:8px 0;font-weight:bold;">${nombre}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Correo</td><td style="padding:8px 0;"><a href="mailto:${email}" style="color:#ec7ca0;">${email}</a></td></tr>
      <tr><td style="padding:8px 0;color:#666;">Fecha</td><td style="padding:8px 0;font-weight:bold;">${fecha}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Hora</td><td style="padding:8px 0;font-weight:bold;">${hora}</td></tr>
      ${mensaje ? `<tr><td style="padding:8px 0;color:#666;vertical-align:top;">Mensaje</td><td style="padding:8px 0;">${mensaje}</td></tr>` : ''}
    </table>
    ${accionesHtml}
  </div>
  <div style="background:#fff5f7;padding:16px;border-radius:0 0 12px 12px;text-align:center;font-size:12px;color:#999;">
    Enviado desde anyurivasquez.com
  </div>
</div>`;

  try {
    const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.CLAVE_API_BREVO,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'Web Anyuri Vásquez', email: 'anyuri.vasquez99@gmail.com' },
        to: [{ email: 'anyuri.vasquez99@gmail.com', name: 'Lic. Anyuri Vásquez' }],
        subject: `Nueva reserva: ${nombre} — ${fecha} ${hora}`,
        htmlContent
      })
    });

    const status = brevoRes.status;
    let data = {};
    try { data = await brevoRes.json(); } catch (_) {}
    console.log('Brevo reserva:', status, JSON.stringify(data));

    if (status >= 200 && status < 300) return res.status(200).json({ ok: true });
    console.error('Brevo reserva error:', status, JSON.stringify(data));
    return res.status(500).json({ error: data.message || 'Error Brevo ' + status });
  } catch (err) {
    console.error('Fetch error:', err.message);
    return res.status(500).json({ error: 'Error de conexión' });
  }
};
