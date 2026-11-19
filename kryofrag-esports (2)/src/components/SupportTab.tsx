import React, { useEffect, useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import {
  ArrowRight,
  Copy,
  Globe,
  Headphones,
  KeyRound,
  LogOut,
  MessageCircle,
  Save,
  UserCheck,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { copyToClipboard, formatSupportHref } from '../lib/formatters';
import type { AppSettings } from '../types/esports';

interface SupportTabProps {
  userId: string;
  userEmail: string;
  userIgn?: string;
  userMobileNumber?: string;
  matchesPlayedCount: number;
  settings: AppSettings;
  onLogout: () => void;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SupportTab: React.FC<SupportTabProps> = ({
  userId,
  userEmail,
  userIgn,
  userMobileNumber,
  matchesPlayedCount,
  settings,
  onLogout,
  onToast,
}) => {
  const [ignInput, setIgnInput] = useState(userIgn || '');
  const [mobileInput, setMobileInput] = useState(userMobileNumber || '');
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    setIgnInput(userIgn || '');
  }, [userIgn]);

  useEffect(() => {
    setMobileInput(userMobileNumber || '');
  }, [userMobileNumber]);

  const handleCopyUid = async () => {
    const ok = await copyToClipboard(userId);
    if (ok) onToast('User ID copied!', 'success');
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');

    const cleanIgn = ignInput.trim();
    const cleanMobile = mobileInput.trim();

    if (!cleanIgn) {
      setProfileError('Please enter your Free Fire In-Game Name (IGN).');
      return;
    }

    const digitsOnly = cleanMobile.replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      setProfileError('Please enter a valid 10-digit Mobile / WhatsApp Number.');
      return;
    }

    setSavingProfile(true);
    try {
      await setDoc(
        doc(db, 'users', userId),
        {
          ign: cleanIgn,
          mobileNumber: cleanMobile,
        },
        { merge: true }
      ).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`)
      );

      onToast('Profile updated successfully!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      setProfileError(msg);
      onToast(msg, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!userEmail) {
      onToast('No email address associated with this account.', 'error');
      return;
    }
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, userEmail);
      onToast(`Password reset link sent to ${userEmail}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send reset email.';
      onToast(msg.replace('Firebase: ', ''), 'error');
    } finally {
      setSendingReset(false);
    }
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT COLUMN: MY PROFILE & EDIT FORM */}
      <div className="lg:col-span-6 space-y-4">
        <div className="card-surface rounded-2xl p-5 space-y-5">
          {/* Profile Summary Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00FF88]/25 to-[#FF5500]/25 border border-[#00FF88]/40 flex items-center justify-center text-[#00FF88] shrink-0">
                <UserCheck className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h2 className="font-gaming text-2xl font-bold uppercase text-white leading-none">
                  My Profile
                </h2>
                <p className="text-xs text-slate-400 truncate mt-1">{userEmail}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] text-slate-500 font-mono-code truncate">
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
          </div>

          {/* Current Stats & Details Snapshot */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-xl bg-[#0B0E14] border border-white/5">
              <span className="text-[11px] text-slate-400 block">Current IGN</span>
              <span className="text-xs font-bold text-[#00FF88] truncate block mt-0.5">
                {userIgn || 'Not set'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#0B0E14] border border-white/5">
              <span className="text-[11px] text-slate-400 block">WhatsApp / Mobile</span>
              <span className="text-xs font-mono-code font-semibold text-white truncate block mt-0.5 tabular-nums">
                {userMobileNumber || 'Not set'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#0B0E14] border border-white/5">
              <span className="text-[11px] text-slate-400 block">Matches Played</span>
              <span className="font-gaming text-lg font-bold text-[#FF5500] leading-tight block mt-0.5 tabular-nums">
                {matchesPlayedCount}
              </span>
            </div>
          </div>

          {/* Edit Profile Form */}
          <form onSubmit={handleSaveProfile} className="space-y-3.5 pt-1 border-t border-white/10">
            <h3 className="font-gaming text-lg font-bold uppercase text-white pt-1">
              Edit Profile
            </h3>

            <div>
              <label
                htmlFor="profile-ign-input"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Free Fire In-Game Name (IGN)
              </label>
              <input
                id="profile-ign-input"
                type="text"
                required
                maxLength={30}
                value={ignInput}
                onChange={(e) => setIgnInput(e.target.value)}
                placeholder="Enter your exact FF IGN"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88] transition"
              />
            </div>

            <div>
              <label
                htmlFor="profile-mobile-input"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Mobile / WhatsApp Number
              </label>
              <input
                id="profile-mobile-input"
                type="tel"
                inputMode="tel"
                required
                maxLength={15}
                value={mobileInput}
                onChange={(e) => setMobileInput(e.target.value)}
                placeholder="e.g., 9876543210"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88] transition"
              />
            </div>

            <div>
              <label
                htmlFor="profile-email-readonly"
                className="block text-xs font-medium text-slate-400 mb-1.5"
              >
                Email Address (Read-only)
              </label>
              <input
                id="profile-email-readonly"
                type="email"
                readOnly
                disabled
                value={userEmail}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B0E14]/60 border border-white/5 text-sm text-slate-400 cursor-not-allowed"
              />
            </div>

            {profileError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
                {profileError}
              </div>
            )}

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full min-h-[46px] py-2.5 rounded-xl bg-[#00FF88] text-[#0B0E14] font-gaming font-bold text-base uppercase tracking-wider hover:brightness-110 transition glow-green-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {savingProfile ? 'Saving Profile...' : 'Save Profile'}
            </button>
          </form>

          {/* Security & Account Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              disabled={sendingReset}
              onClick={handleChangePassword}
              className="min-h-[46px] py-2.5 px-4 rounded-xl bg-[#1C222E] border border-white/15 text-slate-200 text-xs font-bold uppercase tracking-wider hover:border-[#00FF88] hover:text-[#00FF88] transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" />
              {sendingReset ? 'Sending Email...' : 'Change Password'}
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="min-h-[46px] py-2.5 px-4 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold uppercase tracking-wider hover:bg-red-500/25 transition flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: COMMUNITY SUPPORT & TOURNAMENT RULES */}
      <div className="lg:col-span-6 space-y-4">
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

        <div className="card-surface rounded-2xl p-5 space-y-3">
          <h3 className="font-gaming text-xl font-bold uppercase text-white">
            Tournament Rules
          </h3>
          <div className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {settings.rules}
          </div>
        </div>
      </div>
    </section>
  );
};
