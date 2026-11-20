interface NotifyRequestBody {
  title?: string;
  message?: string;
  targetEmail?: string;
  appId?: string;
  restApiKey?: string;
}

interface NotifyRequest {
  method?: string;
  body?: NotifyRequestBody;
}

interface NotifyResponse {
  status: (code: number) => NotifyResponse;
  json: (data: unknown) => void;
}

const DEFAULT_ONESIGNAL_APP_ID = 'd14dfa44-900a-443b-8673-3bded6064242';
const DEFAULT_ONESIGNAL_REST_API_KEY =
  'os_v2_app_2fg7ureqbjcdxbtthppnmbsciinnhtlqce6unh4bmu3ecw2232fya2mclpl4ifeta15fodwjqqj3seuqr2tma755frwoecu6roabfq4q';

export default async function handler(req: NotifyRequest, res: NotifyResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  const { title, message, targetEmail, appId, restApiKey } = req.body || {};

  if (!title || !message) {
    res.status(400).json({ ok: false, error: 'Both title and message are required.' });
    return;
  }

  const resolvedAppId = String(appId || process.env.ONESIGNAL_APP_ID || DEFAULT_ONESIGNAL_APP_ID).trim();
  const resolvedRestApiKey = String(
    restApiKey || process.env.ONESIGNAL_REST_API_KEY || DEFAULT_ONESIGNAL_REST_API_KEY
  ).trim();

  const payload: Record<string, unknown> = {
    app_id: resolvedAppId,
    headings: { en: String(title) },
    contents: { en: String(message) },
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

  try {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${resolvedRestApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => ({}))) as {
      id?: string;
      errors?: string[] | Record<string, unknown>;
    };

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        errMsg = data.errors.join(', ');
      } else if (data.errors && typeof data.errors === 'object') {
        errMsg = JSON.stringify(data.errors);
      }
      res.status(response.status).json({ ok: false, error: errMsg });
      return;
    }

    res.status(200).json({ ok: true, id: data.id || null });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to send OneSignal notification.',
    });
  }
}
