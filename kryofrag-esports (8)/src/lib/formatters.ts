import type { FirestoreTime } from '../types/esports';

export function getMillis(ts: FirestoreTime): number {
  if (!ts) return 0;
  if (typeof ts === 'object' && 'toMillis' in ts && typeof ts.toMillis === 'function') {
    return ts.toMillis();
  }
  if (typeof ts === 'object' && 'seconds' in ts && typeof ts.seconds === 'number') {
    return ts.seconds * 1000;
  }
  const d = new Date(ts as string | Date).getTime();
  return Number.isNaN(d) ? 0 : d;
}

export function formatTimestamp(ts: FirestoreTime): string {
  if (!ts) return 'Just now';
  let date: Date;
  if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
    date = ts.toDate();
  } else if (typeof ts === 'object' && 'seconds' in ts && typeof ts.seconds === 'number') {
    date = new Date(ts.seconds * 1000);
  } else {
    date = new Date(ts as string | Date);
  }
  if (Number.isNaN(date.getTime())) return String(ts);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatMatchDate(dtStr?: string): string {
  if (!dtStr) return 'TBA';
  const d = new Date(dtStr);
  if (Number.isNaN(d.getTime())) return dtStr;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatSupportHref(val?: string): string {
  const v = (val || '').trim();
  if (!v) return '#';
  if (/^https?:\/\//i.test(v)) return v;
  const digits = v.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '#';
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export function generateReferralCode(uid: string): string {
  let hash = 2166136261;
  for (let i = 0; i < uid.length; i++) {
    hash ^= uid.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const numPart = String(1000 + (Math.abs(hash) % 9000));
  const suffix = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() || 'FF';
  return `KRYO${numPart}${suffix}`;
}

export function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return [hrs, mins, secs].map((v) => String(v).padStart(2, '0')).join(':');
}
