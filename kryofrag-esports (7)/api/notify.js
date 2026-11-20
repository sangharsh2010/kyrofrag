export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { title, message, appId, restApiKey, targetEmail } = req.body || {};

    if (!title || !message || !appId || !restApiKey) {
      return res.status(400).json({
        ok: false,
        error: 'Missing required fields: title, message, appId, or restApiKey.',
      });
    }

    const payload = {
      app_id: appId,
      headings: { en: title },
      contents: { en: message },
    };

    if (targetEmail && String(targetEmail).trim()) {
      payload.filters = [
        {
          field: 'tag',
          key: 'email',
          relation: '=',
          value: String(targetEmail).trim().toLowerCase(),
        },
      ];
    } else {
      payload.included_segments = ['All'];
    }

    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Key ' + restApiKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = Array.isArray(data.errors)
        ? data.errors.join(', ')
        : data.errors
          ? JSON.stringify(data.errors)
          : `OneSignal HTTP ${response.status}`;
      return res.status(response.status).json({ ok: false, error: errorMsg, ...data });
    }

    return res.status(200).json({ ok: true, ...data });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    });
  }
}
