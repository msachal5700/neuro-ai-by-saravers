// Neuro AI — NVIDIA proxy (Vercel serverless function)
// The browser cannot call NVIDIA's API directly (NVIDIA does not send CORS
// headers, so the browser blocks it with "Failed to fetch"). This function
// runs on the site's own Vercel deployment: the page sends the chat request
// here (same origin), and this function forwards it to NVIDIA server-side
// with the owner's key, which arrives in the x-nvidia-key header and is
// never stored anywhere.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const key = req.headers['x-nvidia-key'] || process.env.NVIDIA_API_KEY;
    if (!key) {
      res.status(400).json({ error: 'No NVIDIA API key supplied' });
      return;
    }
    const body =
      typeof req.body === 'string'
        ? JSON.parse(req.body || '{}')
        : req.body || {};
    const { model, messages, temperature, max_tokens } = body;
    if (!model || !Array.isArray(messages)) {
      res.status(400).json({ error: 'model and messages are required' });
      return;
    }
    let base = 'https://integrate.api.nvidia.com/v1';
    if (
      typeof body.baseUrl === 'string' &&
      body.baseUrl.startsWith('https://integrate.api.nvidia.com')
    ) {
      base = body.baseUrl.replace(/\/+$/, '');
    }
    const upstream = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: typeof temperature === 'number' ? temperature : 0.6,
        max_tokens: typeof max_tokens === 'number' ? max_tokens : 1024,
        stream: false,
      }),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (e) {
    res
      .status(502)
      .json({ error: 'Proxy error: ' + ((e && e.message) || 'unknown') });
  }
}
