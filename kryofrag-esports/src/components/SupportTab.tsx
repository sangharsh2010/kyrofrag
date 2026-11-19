import React from 'react';
import { ArrowRight, Copy, Globe, Headphones, LogOut, MessageCircle } from 'lucide-react';
import { copyToClipboard, formatSupportHref } from '../lib/formatters';
import type { AppSettings } from '../types/esports';

interface SupportTabProps {
  userId: string;
  userEmail: string;
  userIgn?: string;
  userMobileNumber?: string;
  settings: AppSettings;
  onLogout: () => void;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SupportTab: React.FC<SupportTabProps> = ({
  userId,
  userEmail,
  userIgn,
  userMobileNumber,
  settings,
  onLogout,
  onToast,
}) => {
  const handleCopyUid = async () => {
    const ok = await copyToClipboard(userId);
    if (ok) onToast('User ID copied!', 'success');
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-5 space-y-4">
        {/* Profile Card */}
        <div className="card-surface rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00FF88]/25 to-[#FF5500]/25 border border-[#00FF88]/40 flex items-center justify-center font-gaming text-xl font-bold text-[#00FF88] shrink-0">
              FF
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                Player Account
              </p>
              <p className="text-sm font-semibold text-white truncate">{userEmail}</p>
              {(userIgn || userMobileNumber) && (
                <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5 flex-wrap">
                  {userIgn && (
                    <span>
                      IGN: <span className="font-semibold text-[#00FF88]">{userIgn}</span>
                    </span>
                  )}
                  {userIgn && userMobileNumber && (
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                  )}
                  {userMobileNumber && (
                    <span className="font-mono-code tabular-nums">{userMobileNumber}</span>
                  )}
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-slate-400 font-mono-code truncate">
                  UID: {userId}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUid}
                  className="text-[11px] px-2 py-0.5 rounded bg-[#0B0E14] border border-white/10 text-[#00FF88] hover:border-[#00FF88] inline-flex items-center gap-1 shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  Copy
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="w-full min-h-[44px] py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider hover:bg-red-500/20 transition flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout Account
          </button>
        </div>

        {/* Community & Support Links */}
        <div className="card-surface rounded-2xl p-5 space-y-3">
          <h3 className="font-gaming text-lg font-bold uppercase text-white">
            Support &amp; Community
          </h3>

          <a
            href={settings.whatsappChannel || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-[#00FF88]/10 border border-[#00FF88]/40 text-[#00FF88] font-semibold text-sm flex items-center justify-between hover:bg-[#00FF88]/20 transition glow-green-sm"
          >
            <span className="flex items-center gap-2.5">
              <MessageCircle className="w-5 h-5" />
              Join WhatsApp Channel
            </span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <a
            href={formatSupportHref(settings.whatsappSupport)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-[#FF5500]/10 border border-[#FF5500]/40 text-[#FF5500] font-semibold text-sm flex items-center justify-between hover:bg-[#FF5500]/20 transition"
          >
            <span className="flex items-center gap-2.5">
              <Headphones className="w-5 h-5" />
              WhatsApp Customer Support
            </span>
            <ArrowRight className="w-4 h-4" />
          </a>

          <a
            href={settings.socialLink || '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-sky-500/10 border border-sky-400/40 text-sky-400 font-semibold text-sm flex items-center justify-between hover:bg-sky-500/20 transition"
          >
            <span className="flex items-center gap-2.5">
              <Globe className="w-5 h-5" />
              YouTube / Telegram
            </span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Tournament Rules */}
      <div className="lg:col-span-7 card-surface rounded-2xl p-5 space-y-3">
        <h3 className="font-gaming text-xl font-bold uppercase text-white">
          Tournament Rules
        </h3>
        <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
          {settings.rules}
        </div>
      </div>
    </section>
  );
};
