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

  const { name, email, message } = body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Datos incompletos' });
  }

  const htmlContent = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1c3350;">
  <div style="background:#ec7ca0;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:white;margin:0;font-size:22px;">Nueva consulta desde el sitio web</h1>
  </div>
  <div style="background:#fff;padding:32px;border:1px solid #fce7f3;border-top:none;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
      <tr><td style="padding:8px 0;color:#666;width:130px;">Nombre</td><td style="padding:8px 0;font-weight:bold;">${name}</td></tr>
      <tr><td style="padding:8px 0;color:#666;">Correo</td><td style="padding:8px 0;"><a href="mailto:${email}" style="color:#ec7ca0;">${email}</a></td></tr>
      <tr><td style="padding:8px 0;color:#666;vertical-align:top;">Mensaje</td><td style="padding:8px 0;">${message}</td></tr>
    </table>
    <a href="mailto:${email}" style="background:#ec7ca0;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;display:inline-block;">Responder a ${name}</a>
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
        sender: { name: 'Web Anyuri Vásquez', email: 'hola@anyurivasquez.com' },
        to: [{ email: 'anyuri.vasquez99@gmail.com', name: 'Lic. Anyuri Vásquez' }],
        subject: `Consulta de ${name}`,
        htmlContent
      })
    });

    const status = brevoRes.status;
    let data = {};
    try { data = await brevoRes.json(); } catch (_) {}
    console.log('Brevo contacto:', status, JSON.stringify(data));

    if (status >= 200 && status < 300) return res.status(200).json({ ok: true });
    console.error('Brevo contacto error:', status, JSON.stringify(data));
    return res.status(500).json({ error: data.message || 'Error Brevo ' + status });
  } catch (err) {
    console.error('Fetch error:', err.message);
    return res.status(500).json({ error: 'Error de conexión' });
  }
};
