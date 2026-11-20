export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { title, message, appId, restApiKey } = req.body;

  try {
    const response = await fetch('https://onesignal.com', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Key ${restApiKey}`
      },
      body: JSON.stringify({
        app_id: appId,
        included_segments: ['All'],
        headings: { en: title },
        contents: { en: message }
      })
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
