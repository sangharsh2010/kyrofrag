export const ONESIGNAL_APP_ID = 'd14dfa44-900a-443b-8673-3bded6064242';
export const ONESIGNAL_REST_API_KEY =
  'os_v2_app_2fg7ureqbjcdxbtthppnmbsciinnhtlqce6unh4bmu3ecw2232fya2mclpl4ifeta15fodwjqqj3seuqr2tma755frwoecu6roabfq4q';

interface OneSignalInstance {
  init: (config: { appId: string; allowLocalhostAsSecureOrigin?: boolean }) => Promise<void>;
  login?: (externalId: string) => Promise<void>;
  Slidedown?: {
    promptPush: () => Promise<void>;
  };
  Notifications?: {
    requestPermission: () => Promise<void>;
  };
}

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalInstance) => void | Promise<void>>;
  }
}

let initialized = false;

export function initOneSignalForUser(userId: string): void {
  if (typeof window === 'undefined' || !ONESIGNAL_APP_ID) return;

  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async (OneSignal) => {
    try {
      if (!initialized) {
        initialized = true;
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
        });
      }
      if (userId && typeof OneSignal.login === 'function') {
        await OneSignal.login(userId).catch(() => {});
      }
      if (OneSignal.Slidedown && typeof OneSignal.Slidedown.promptPush === 'function') {
        await OneSignal.Slidedown.promptPush().catch(() => {});
      } else if (
        OneSignal.Notifications &&
        typeof OneSignal.Notifications.requestPermission === 'function'
      ) {
        await OneSignal.Notifications.requestPermission().catch(() => {});
      }
    } catch (err) {
      console.warn('OneSignal initialization notice:', err);
    }
  });
}

export async function sendOneSignalBroadcast(params: {
  title: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        included_segments: ['All'],
        headings: { en: params.title },
        contents: { en: params.message },
      }),
    });

    if (!response.ok) {
      let errText = `HTTP ${response.status}`;
      try {
        const errJson = (await response.json()) as { errors?: string[] | Record<string, unknown> };
        if (Array.isArray(errJson.errors) && errJson.errors.length > 0) {
          errText = errJson.errors.join(', ');
        }
      } catch {
        // ignore JSON parse errors
      }
      return { ok: false, error: errText };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error sending notification',
    };
  }
}
