import React, { useEffect, useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  ExternalLink,
  Flag,
  Globe,
  Headphones,
  KeyRound,
  Lock,
  LogOut,
  MessageCircle,
  Pencil,
  Save,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { copyToClipboard, formatSupportHref, formatTimestamp } from '../lib/formatters';
import type { AppSettings, ComplaintTicket, TournamentMatch } from '../types/esports';

interface SupportTabProps {
  userId: string;
  userEmail: string;
  userIgn?: string;
  userMobileNumber?: string;
  userFfUid?: string;
  userFfUidLocked?: boolean;
  matchesPlayedCount: number;
  matches: TournamentMatch[];
  complaints: ComplaintTicket[];
  settings: AppSettings;
  whatsappChannelOverride?: string;
  whatsappSupportOverride?: string;
  telegramLink?: string;
  instagramLink?: string;
  onLogout: () => void;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SupportTab: React.FC<SupportTabProps> = ({
  userId,
  userEmail,
  userIgn,
  userMobileNumber,
  userFfUid,
  userFfUidLocked,
  matchesPlayedCount,
  matches,
  complaints,
  settings,
  whatsappChannelOverride,
  whatsappSupportOverride,
  telegramLink,
  instagramLink,
  onLogout,
  onToast,
}) => {
  const [editing, setEditing] = useState(false);
  const [ignInput, setIgnInput] = useState(userIgn || '');
  const [mobileInput, setMobileInput] = useState(userMobileNumber || '');
  const [ffUidInput, setFfUidInput] = useState(userFfUid || '');
  const [ffUidError, setFfUidError] = useState('');
  const [savingFfUid, setSavingFfUid] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  // Complaint / Dispute Ticket State
  const [ticketMatchId, setTicketMatchId] = useState('');
  const [ticketCustomMatchId, setTicketCustomMatchId] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketScreenshot, setTicketScreenshot] = useState('');
  const [ticketError, setTicketError] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);

  useEffect(() => {
    setIgnInput(userIgn || '');
  }, [userIgn]);

  useEffect(() => {
    setMobileInput(userMobileNumber || '');
  }, [userMobileNumber]);

  useEffect(() => {
    setFfUidInput(userFfUid || '');
  }, [userFfUid]);

  const isFfLocked = Boolean(userFfUidLocked && userFfUid);

  const handleCopyUid = async () => {
    const ok = await copyToClipboard(userId);
    if (ok) onToast('User ID copied!', 'success');
  };

  const handleLockFfUid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFfLocked) return;
    setFfUidError('');

    const cleanFfUid = ffUidInput.replace(/\D/g, '').trim();
    if (!/^\d{10}$/.test(cleanFfUid)) {
      setFfUidError('Please enter your exact 10-digit Free Fire UID.');
      return;
    }

    setSavingFfUid(true);
    try {
      await setDoc(
        doc(db, 'users', userId),
        {
          ffUid: cleanFfUid,
          ffUidLocked: true,
        },
        { merge: true }
      ).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`)
      );

      onToast('Free Fire UID verified & locked!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to lock Free Fire UID.';
      setFfUidError(msg);
      onToast(msg, 'error');
    } finally {
      setSavingFfUid(false);
    }
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

      setEditing(false);
      onToast('Profile changes saved!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      setProfileError(msg);
      onToast(msg, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleResetPassword = async () => {
    if (!userEmail) {
      onToast('No email address associated with this account.', 'error');
      return;
    }
    setSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, userEmail);
      onToast(`Password reset email sent to ${userEmail}`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send reset email.';
      onToast(msg.replace('Firebase: ', ''), 'error');
    } finally {
      setSendingReset(false);
    }
  };

  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    setTicketError('');

    const selectedMatch = matches.find((m) => m.id === ticketMatchId);
    const finalMatchId =
      ticketMatchId === 'OTHER'
        ? ticketCustomMatchId.trim() || 'General'
        : ticketMatchId.trim() || 'General';
    const finalMatchTitle = selectedMatch
      ? selectedMatch.title
      : ticketMatchId === 'OTHER'
        ? ticketCustomMatchId.trim() || 'General Issue'
        : 'General Support';

    const cleanMsg = ticketMessage.trim();
    const cleanShot = ticketScreenshot.trim();

    if (!cleanMsg || cleanMsg.length < 8) {
      setTicketError('Please describe the issue clearly (at least 8 characters).');
      return;
    }

    setSubmittingTicket(true);
    try {
      await addDoc(collection(db, 'complaints'), {
        uid: userId,
        email: userEmail,
        ign: userIgn || '',
        matchId: finalMatchId,
        matchTitle: finalMatchTitle,
        message: cleanMsg,
        screenshotUrl: cleanShot,
        status: 'Open',
        adminNote: '',
        createdAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.CREATE, 'complaints'));

      setTicketMatchId('');
      setTicketCustomMatchId('');
      setTicketMessage('');
      setTicketScreenshot('');
      onToast('Issue report submitted! Admin will review it shortly.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit complaint.';
      setTicketError(msg);
      onToast(msg, 'error');
    } finally {
      setSubmittingTicket(false);
    }
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT COLUMN: MY PROFILE & EDIT DETAILS */}
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

            <button
              type="button"
              onClick={() => {
                setProfileError('');
                setEditing((prev) => !prev);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#0B0E14] border border-[#00FF88]/40 text-[#00FF88] text-xs font-bold uppercase tracking-wider hover:bg-[#00FF88] hover:text-[#0B0E14] transition inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap"
            >
              {editing ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </>
              ) : (
                <>
                  <Pencil className="w-3.5 h-3.5" />
                  Edit Profile
                </>
              )}
            </button>
          </div>

          {/* Current Details Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-[#0B0E14] border border-white/5">
              <span className="text-[11px] text-slate-400 block">Free Fire IGN</span>
              <span className="text-sm font-bold text-[#00FF88] truncate block mt-0.5">
                {userIgn || 'Not set'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#0B0E14] border border-white/5">
              <span className="text-[11px] text-slate-400 block">Mobile / WhatsApp</span>
              <span className="text-sm font-mono-code font-semibold text-white truncate block mt-0.5 tabular-nums">
                {userMobileNumber || 'Not set'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#0B0E14] border border-white/5">
              <span className="text-[11px] text-slate-400 block">Email (Read-only)</span>
              <span className="text-xs font-medium text-slate-300 truncate block mt-1">
                {userEmail}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-[#0B0E14] border border-white/5">
              <span className="text-[11px] text-slate-400 block">Matches Joined</span>
              <span className="font-gaming text-xl font-bold text-[#FF5500] leading-tight block mt-0.5 tabular-nums">
                {matchesPlayedCount}
              </span>
            </div>
          </div>

          {/* 10-Digit Free Fire UID Verification Lock */}
          <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/10 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {isFfLocked ? (
                  <ShieldCheck className="w-4 h-4 text-[#00FF88]" />
                ) : (
                  <Lock className="w-4 h-4 text-amber-400" />
                )}
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Free Fire UID Verification
                </span>
              </div>
              {isFfLocked ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-[10px] font-bold uppercase tracking-wider">
                  <Lock className="w-2.5 h-2.5" />
                  Verified / Locked
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                  One-Time Lock
                </span>
              )}
            </div>

            {isFfLocked ? (
              <div className="space-y-2">
                <input
                  type="text"
                  readOnly
                  disabled
                  value={userFfUid}
                  aria-label="Locked Free Fire UID"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#151A23] border border-[#00FF88]/30 text-sm font-mono-code font-bold tracking-widest text-[#00FF88] cursor-not-allowed"
                />
                <p className="text-[11px] text-slate-400">
                  Your 10-digit Free Fire UID is verified and permanently locked. Only Admin can
                  edit or unlock it.
                </p>
              </div>
            ) : (
              <form onSubmit={handleLockFfUid} className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <input
                    id="ff-uid-lock-input"
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    required
                    value={ffUidInput}
                    onChange={(e) => {
                      setFfUidError('');
                      setFfUidInput(e.target.value.replace(/\D/g, '').slice(0, 10));
                    }}
                    placeholder="Enter 10-digit Free Fire UID"
                    className="flex-1 min-h-[42px] px-3.5 py-2 rounded-xl bg-[#151A23] border border-white/15 text-sm font-mono-code font-bold tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88]"
                  />
                  <button
                    type="submit"
                    disabled={savingFfUid}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#00FF88] text-[#0B0E14] font-gaming font-bold text-sm uppercase tracking-wider hover:brightness-110 transition shrink-0 disabled:opacity-60"
                  >
                    {savingFfUid ? 'Locking...' : 'Verify & Lock'}
                  </button>
                </div>
                {ffUidError && (
                  <p className="text-xs text-red-400">{ffUidError}</p>
                )}
                <p className="text-[11px] text-amber-300/90">
                  Warning: Once saved, your Free Fire UID cannot be changed by you. Double-check
                  all 10 digits before locking.
                </p>
              </form>
            )}
          </div>

          {/* Edit Profile Form */}
          {editing && (
            <form
              onSubmit={handleSaveProfile}
              className="space-y-3.5 pt-3 border-t border-white/10"
            >
              <h3 className="font-gaming text-lg font-bold uppercase text-white">
                Edit Profile Details
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
                  10-Digit Mobile / WhatsApp Number
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
                {savingProfile ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </form>
          )}

          {/* Security & Session Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              disabled={sendingReset}
              onClick={handleResetPassword}
              className="min-h-[46px] py-2.5 px-4 rounded-xl bg-[#1C222E] border border-white/15 text-slate-200 text-xs font-bold uppercase tracking-wider hover:border-[#00FF88] hover:text-[#00FF88] transition flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <KeyRound className="w-4 h-4" />
              {sendingReset ? 'Sending Link...' : 'Reset Password'}
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
            href={whatsappChannelOverride?.trim() || settings.whatsappChannel || '#'}
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
            href={formatSupportHref(whatsappSupportOverride?.trim() || settings.whatsappSupport)}
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

          {telegramLink?.trim() ? (
            <a
              href={telegramLink.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-sky-500/10 border border-sky-400/40 text-sky-400 font-semibold text-sm flex items-center justify-between hover:bg-sky-500/20 transition"
            >
              <span className="flex items-center gap-2.5">
                <Globe className="w-5 h-5" />
                Join Telegram
              </span>
              <ArrowRight className="w-4 h-4" />
            </a>
          ) : null}

          {instagramLink?.trim() ? (
            <a
              href={instagramLink.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-pink-500/10 border border-pink-400/40 text-pink-400 font-semibold text-sm flex items-center justify-between hover:bg-pink-500/20 transition"
            >
              <span className="flex items-center gap-2.5">
                <Globe className="w-5 h-5" />
                Follow on Instagram
              </span>
              <ArrowRight className="w-4 h-4" />
            </a>
          ) : null}

          {!telegramLink?.trim() && !instagramLink?.trim() && (
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
          )}
        </div>

        {/* Report Issue / Dispute Ticket */}
        <div className="card-surface rounded-2xl p-5 space-y-4 border border-[#FF5500]/30">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#FF5500]/15 border border-[#FF5500]/40 flex items-center justify-center text-[#FF5500] shrink-0">
              <Flag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-gaming text-xl font-bold uppercase text-white">
                Report Issue / Dispute Ticket
              </h3>
              <p className="text-xs text-slate-400">
                Report hackers, missing kill payouts, or payment disputes directly to Admin.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmitComplaint} className="space-y-3">
            <div>
              <label
                htmlFor="ticket-match-select"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Select Match / Issue Category
              </label>
              <select
                id="ticket-match-select"
                value={ticketMatchId}
                onChange={(e) => setTicketMatchId(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
              >
                <option value="">General Support / Wallet Issue</option>
                {matches.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title} ({m.type} · {m.map})
                  </option>
                ))}
                <option value="OTHER">Enter Match ID Manually...</option>
              </select>
            </div>

            {ticketMatchId === 'OTHER' && (
              <div>
                <label
                  htmlFor="ticket-custom-match"
                  className="block text-xs font-medium text-slate-300 mb-1"
                >
                  Match ID / Reference
                </label>
                <input
                  id="ticket-custom-match"
                  type="text"
                  value={ticketCustomMatchId}
                  onChange={(e) => setTicketCustomMatchId(e.target.value)}
                  placeholder="Paste Match ID or Title"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="ticket-message-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Describe Your Issue
              </label>
              <textarea
                id="ticket-message-input"
                rows={3}
                required
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                placeholder="Explain what happened (player IGN, kills count, or UTR details)..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <div>
              <label
                htmlFor="ticket-screenshot-input"
                className="block text-xs font-medium text-slate-300 mb-1"
              >
                Screenshot Proof URL (Optional)
              </label>
              <input
                id="ticket-screenshot-input"
                type="url"
                value={ticketScreenshot}
                onChange={(e) => setTicketScreenshot(e.target.value)}
                placeholder="https://ibb.co/... or image link"
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            {ticketError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2">
                {ticketError}
              </div>
            )}

            <button
              type="submit"
              disabled={submittingTicket}
              className="w-full min-h-[46px] py-2.5 rounded-xl bg-gradient-to-r from-[#FF5500] to-[#FF7722] text-white font-gaming font-bold text-base uppercase tracking-wider hover:brightness-110 transition disabled:opacity-60"
            >
              {submittingTicket ? 'Submitting Ticket...' : 'Submit Dispute Ticket'}
            </button>
          </form>

          {complaints.length > 0 && (
            <div className="pt-3 border-t border-white/10 space-y-2.5">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Your Tickets ({complaints.length})
              </p>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {complaints.map((c) => {
                  const resolved = c.status === 'Resolved';
                  return (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-[#0B0E14] border border-white/10 space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">
                          {c.matchTitle || c.matchId || 'Support Ticket'}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                            resolved
                              ? 'bg-[#00FF88]/15 text-[#00FF88]'
                              : 'bg-amber-400/15 text-amber-300'
                          }`}
                        >
                          {resolved ? (
                            <CheckCircle2 className="w-2.5 h-2.5" />
                          ) : (
                            <AlertCircle className="w-2.5 h-2.5" />
                          )}
                          {c.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 whitespace-pre-line">{c.message}</p>
                      {c.screenshotUrl && (
                        <a
                          href={c.screenshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-sky-400 hover:underline"
                        >
                          View Screenshot
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {c.adminNote && (
                        <p className="text-[11px] text-[#00FF88] bg-[#00FF88]/10 border border-[#00FF88]/25 rounded-lg px-2.5 py-1.5">
                          Admin Reply: {c.adminNote}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500">{formatTimestamp(c.createdAt)}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
