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

  const email = (body && body.email) ? body.email.trim() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Correo inválido' });
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': process.env.CLAVE_API_BREVO,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ email, updateEnabled: true })
    });

    if (response.status === 201 || response.status === 204) {
      return res.status(200).json({ ok: true });
    }

    const data = await response.json().catch(() => ({}));
    if (data.code === 'duplicate_parameter') {
      return res.status(200).json({ ok: true, already: true });
    }

    return res.status(500).json({ error: data.message || 'Error al suscribir' });
  } catch (err) {
    return res.status(500).json({ error: 'Error de conexión' });
  }
};
