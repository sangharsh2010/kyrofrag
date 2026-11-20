export const ONESIGNAL_APP_ID = 'd14dfa44-900a-443b-8673-3bded6064242';
export const ONESIGNAL_REST_API_KEY =
  'os_v2_app_2fg7ureqbjcdxbtthppnmbsciinnhtlqce6unh4bmu3ecw2232fya2mclpl4ifeta15fodwjqqj3seuqr2tma755frwoecu6roabfq4q';

interface OneSignalInstance {
  init: (config: { appId: string; allowLocalhostAsSecureOrigin?: boolean }) => Promise<void>;
  login?: (externalId: string) => Promise<void>;
  User?: {
    addTag?: (key: string, value: string) => Promise<void> | void;
  };
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

export function initOneSignalForUser(userId: string, userEmail?: string): void {
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
      if (userEmail && OneSignal.User && typeof OneSignal.User.addTag === 'function') {
        await Promise.resolve(
          OneSignal.User.addTag('email', userEmail.trim().toLowerCase())
        ).catch(() => {});
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

export async function sendOneSignalNotification(params: {
  title: string;
  message: string;
  targetEmail?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const payload: {
      title: string;
      message: string;
      appId: string;
      restApiKey: string;
      targetEmail?: string;
    } = {
      title: params.title,
      message: params.message,
      appId: ONESIGNAL_APP_ID,
      restApiKey: ONESIGNAL_REST_API_KEY,
    };

    if (params.targetEmail && params.targetEmail.trim()) {
      payload.targetEmail = params.targetEmail.trim().toLowerCase();
    }

    const response = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const resData = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };

    if (!response.ok || resData.ok === false) {
      return {
        ok: false,
        error: resData.error || `HTTP ${response.status}`,
      };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error sending notification',
    };
  }
}

export async function sendOneSignalBroadcast(params: {
  title: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  return sendOneSignalNotification({
    title: params.title,
    message: params.message,
  });
}
