import React from 'react';
import {
  AlertTriangle,
  Crown,
  Crosshair,
  Download,
  ExternalLink,
  MessageCircle,
  ShieldCheck,
  Trophy,
  X,
} from 'lucide-react';
import { formatMatchDate } from '../lib/formatters';
import type { TournamentMatch } from '../types/esports';

interface LowBalanceModalProps {
  open: boolean;
  requiredCoins: number;
  onClose: () => void;
  onGoToWallet: () => void;
}

export const LowBalanceModal: React.FC<LowBalanceModalProps> = ({
  open,
  requiredCoins,
  onClose,
  onGoToWallet,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] modal-backdrop flex items-center justify-center p-4">
      <div className="w-full max-w-sm card-surface rounded-2xl p-6 border border-[#FF5500]/50 space-y-4 text-center glow-orange">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FF5500]/15 border border-[#FF5500]/40 flex items-center justify-center text-[#FF5500]">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h3 className="font-gaming text-2xl font-bold uppercase text-white">
          Low Wallet Balance
        </h3>
        <p className="text-sm text-slate-300 leading-relaxed">
          Insufficient Balance! You need at least{' '}
          <span className="font-bold text-[#FF5500] tabular-nums">{requiredCoins}</span> coins to
          join.
        </p>
        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-xs font-bold uppercase text-slate-300 hover:text-white transition"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onGoToWallet}
            className="min-h-[44px] py-2.5 rounded-xl bg-[#00FF88] text-[#0B0E14] text-xs font-bold uppercase tracking-wider hover:brightness-110 transition"
          >
            Go to Wallet
          </button>
        </div>
      </div>
    </div>
  );
};

interface JoinIgnModalProps {
  match: TournamentMatch | null;
  ign: string;
  selectedTeam: number | null;
  selectedSlot: string;
  submitting: boolean;
  onIgnChange: (value: string) => void;
  onSlotChange: (teamNumber: number, slotLetter: string) => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const JoinIgnModal: React.FC<JoinIgnModalProps> = ({
  match,
  ign,
  selectedTeam,
  selectedSlot,
  submitting,
  onIgnChange,
  onSlotChange,
  onCancel,
  onSubmit,
}) => {
  if (!match) return null;

  const mode = (match.type || 'Solo').toLowerCase();
  const isTeamMode = mode === 'duo' || mode === 'squad';
  const teamSize = mode === 'duo' ? 2 : mode === 'squad' ? 4 : 1;
  const slotLetters = mode === 'duo' ? ['A', 'B'] : ['A', 'B', 'C', 'D'];
  const maxSlots = Math.max(teamSize, Number(match.maxSlots || 48));
  const totalTeams = isTeamMode ? Math.max(1, Math.ceil(maxSlots / teamSize)) : 0;
  const participants = Array.isArray(match.participants) ? match.participants : [];

  const activeTeam = selectedTeam && selectedTeam >= 1 && selectedTeam <= totalTeams ? selectedTeam : 1;

  const getOccupant = (teamNum: number, letter: string) =>
    participants.find(
      (p) => Number(p.teamNumber) === teamNum && (p.slotLetter || '').toUpperCase() === letter
    );

  const countTeamFilled = (teamNum: number) =>
    participants.filter((p) => Number(p.teamNumber) === teamNum).length;

  return (
    <div className="fixed inset-0 z-[70] modal-backdrop flex items-center justify-center p-4">
      <div className="w-full max-w-md card-surface rounded-2xl p-5 sm:p-6 border border-[#00FF88]/40 space-y-4 glow-green max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#00FF88]">
              Match Registration · {match.type}
            </span>
            <h3 className="font-gaming text-2xl font-bold uppercase text-white mt-0.5 truncate">
              {match.title}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Entry Fee:{' '}
              <span className="text-[#00FF88] font-bold tabular-nums">
                {Number(match.entryFee || 0)} Coins
              </span>{' '}
              will be deducted from your wallet.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close registration modal"
            className="min-w-[36px] min-h-[36px] rounded-lg bg-[#0B0E14] text-slate-400 hover:text-white flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="join-ign-input"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Free Fire In-Game Name (IGN)
            </label>
            <input
              id="join-ign-input"
              type="text"
              required
              autoFocus
              maxLength={30}
              value={ign}
              onChange={(e) => onIgnChange(e.target.value)}
              placeholder="Enter your exact FF IGN"
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-white/15 text-sm text-white focus:outline-none focus:border-[#00FF88]"
            />
          </div>

          {isTeamMode && (
            <div className="space-y-3 p-3.5 rounded-xl bg-[#0B0E14] border border-white/10">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Select Team &amp; Seat Slot
                </span>
                {selectedTeam && selectedSlot && (
                  <span className="px-2 py-0.5 rounded bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-[11px] font-bold">
                    Team {selectedTeam} - Slot {selectedSlot}
                  </span>
                )}
              </div>

              {/* Team Picker */}
              <div>
                <span className="block text-[11px] text-slate-400 mb-1.5">
                  Choose Team (1–{totalTeams})
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {Array.from({ length: totalTeams }, (_, i) => i + 1).map((teamNum) => {
                    const filled = countTeamFilled(teamNum);
                    const full = filled >= teamSize;
                    const isSelectedTeam = activeTeam === teamNum;

                    return (
                      <button
                        key={teamNum}
                        type="button"
                        onClick={() => {
                          const firstOpen =
                            slotLetters.find((l) => !getOccupant(teamNum, l)) || slotLetters[0];
                          onSlotChange(teamNum, firstOpen);
                        }}
                        className={`min-h-[36px] px-1.5 py-1 rounded-lg border text-[11px] font-bold transition tabular-nums ${
                          isSelectedTeam
                            ? 'bg-[#00FF88] text-[#0B0E14] border-[#00FF88]'
                            : full
                              ? 'bg-[#151A23] border-white/5 text-slate-500'
                              : 'bg-[#151A23] border-white/10 text-slate-200 hover:border-[#00FF88]/50'
                        }`}
                      >
                        T{teamNum} ({filled}/{teamSize})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slot Picker for active Team */}
              <div>
                <span className="block text-[11px] text-slate-400 mb-1.5">
                  Team {activeTeam} Slots
                </span>
                <div className={`grid gap-2 ${teamSize === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'}`}>
                  {slotLetters.map((letter) => {
                    const occupant = getOccupant(activeTeam, letter);
                    const isSelected = activeTeam === selectedTeam && selectedSlot === letter;

                    return (
                      <button
                        key={letter}
                        type="button"
                        disabled={Boolean(occupant)}
                        onClick={() => onSlotChange(activeTeam, letter)}
                        className={`p-2 rounded-xl border text-left transition ${
                          occupant
                            ? 'bg-slate-900/70 border-white/5 text-slate-500 cursor-not-allowed'
                            : isSelected
                              ? 'bg-[#00FF88]/15 border-[#00FF88] text-[#00FF88]'
                              : 'bg-[#151A23] border-white/10 text-white hover:border-[#00FF88]/50'
                        }`}
                      >
                        <span className="block text-xs font-bold uppercase">Slot {letter}</span>
                        <span className="block text-[10px] truncate mt-0.5 text-slate-400">
                          {occupant ? occupant.ign : isSelected ? 'Selected' : 'Available'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-xs font-bold uppercase text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] py-2.5 rounded-xl bg-[#00FF88] text-[#0B0E14] text-xs font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-60"
            >
              {submitting ? 'Joining...' : 'Confirm Join'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  onCancel,
  onConfirm,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] modal-backdrop flex items-center justify-center p-4">
      <div className="w-full max-w-xs card-surface rounded-2xl p-5 border border-white/15 space-y-4 text-center">
        <h3 className="font-gaming text-xl font-bold uppercase text-white">{title}</h3>
        <p className="text-xs text-slate-300 leading-relaxed">{message}</p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[42px] py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-xs font-bold uppercase text-slate-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[42px] py-2 rounded-xl bg-red-500 text-white text-xs font-bold uppercase hover:bg-red-600"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

interface MatchLeaderboardModalProps {
  match: TournamentMatch | null;
  currentUserId: string;
  onClose: () => void;
}

export const MatchLeaderboardModal: React.FC<MatchLeaderboardModalProps> = ({
  match,
  currentUserId,
  onClose,
}) => {
  if (!match) return null;

  const sortedResults = [...(Array.isArray(match.results) ? match.results : [])].sort((a, b) => {
    if (a.rank && b.rank && a.rank !== b.rank) return a.rank - b.rank;
    if (b.coinsWon !== a.coinsWon) return b.coinsWon - a.coinsWon;
    return b.kills - a.kills;
  });

  return (
    <div className="fixed inset-0 z-[75] modal-backdrop flex items-center justify-center p-4">
      <div className="w-full max-w-lg card-surface rounded-2xl p-5 sm:p-6 border border-[#00FF88]/35 space-y-4 max-h-[88vh] flex flex-col glow-green">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-bold uppercase text-[#00FF88]">Final Leaderboard</span>
              <span aria-hidden="true">·</span>
              <span>{match.type}</span>
              <span aria-hidden="true">·</span>
              <span>{match.map}</span>
            </div>
            <h3 className="font-gaming text-2xl font-bold uppercase text-white mt-0.5 truncate">
              {match.title}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {formatMatchDate(match.dateTime)} · Per Kill: {Number(match.perKill || 0)} Coins ·
              Booyah: {Number(match.booyahPrize || 0)} Coins
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close leaderboard modal"
            className="min-w-[36px] min-h-[36px] rounded-lg bg-[#0B0E14] text-slate-400 hover:text-white flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scoreboard List */}
        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
          {sortedResults.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 bg-[#0B0E14] rounded-xl border border-white/5">
              No scoreboard entries recorded for this match.
            </div>
          ) : (
            sortedResults.map((entry, idx) => {
              const rank = entry.rank || idx + 1;
              const isMe = entry.uid === currentUserId;
              const rankColor =
                rank === 1
                  ? 'text-amber-400 border-amber-400/40 bg-amber-400/10'
                  : rank === 2
                    ? 'text-slate-200 border-slate-400/40 bg-slate-400/10'
                    : rank === 3
                      ? 'text-[#FF5500] border-[#FF5500]/40 bg-[#FF5500]/10'
                      : 'text-slate-400 border-white/10 bg-[#151A23]';

              return (
                <div
                  key={`${entry.uid}-${idx}`}
                  className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                    isMe
                      ? 'bg-[#00FF88]/10 border-[#00FF88]/45'
                      : 'bg-[#0B0E14] border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-9 h-9 rounded-lg border flex items-center justify-center font-gaming text-base font-bold tabular-nums shrink-0 ${rankColor}`}
                    >
                      #{rank}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">
                          {entry.ign}
                        </span>
                        {isMe && (
                          <span className="text-[10px] font-bold uppercase text-[#00FF88]">
                            (You)
                          </span>
                        )}
                        {entry.isBooyah && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider shrink-0">
                            <Crown className="w-3 h-3" />
                            Booyah
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Crosshair className="w-3 h-3 text-[#FF5500]" />
                          {Number(entry.kills || 0)}{' '}
                          {Number(entry.kills || 0) === 1 ? 'Kill' : 'Kills'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="flex items-center justify-end gap-1">
                      <Trophy
                        className={`w-3.5 h-3.5 ${
                          entry.coinsWon > 0 ? 'text-[#00FF88]' : 'text-slate-600'
                        }`}
                      />
                      <span
                        className={`font-gaming text-lg font-bold tabular-nums ${
                          entry.coinsWon > 0 ? 'text-[#00FF88]' : 'text-slate-400'
                        }`}
                      >
                        +{Number(entry.coinsWon || 0)}
                      </span>
                    </div>
                    <span className="block text-[10px] text-slate-500 uppercase">Coins Won</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

interface ForceUpdateModalProps {
  open: boolean;
  message: string;
  downloadUrl: string;
}

export const ForceUpdateModal: React.FC<ForceUpdateModalProps> = ({
  open,
  message,
  downloadUrl,
}) => {
  if (!open) return null;

  const safeUrl = (downloadUrl || '').trim();

  return (
    <div className="fixed inset-0 z-[95] modal-backdrop flex items-center justify-center p-4">
      <div className="w-full max-w-sm card-surface rounded-2xl p-6 border border-[#FF5500]/60 space-y-5 text-center glow-orange">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FF5500]/15 border border-[#FF5500]/50 flex items-center justify-center text-[#FF5500]">
          <Download className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF5500]">
            Mandatory App Update
          </span>
          <h3 className="font-gaming text-2xl font-bold uppercase text-white">
            Update App Now
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {message ||
              'A new version of KryoFrag Esports is available. Please update your APK to continue.'}
          </p>
        </div>
        {safeUrl ? (
          <a
            href={safeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00CC6E] text-[#0B0E14] font-gaming font-bold text-base uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 transition glow-green-sm"
          >
            <Download className="w-4 h-4" />
            Update App Now
            <ExternalLink className="w-4 h-4" />
          </a>
        ) : (
          <div className="px-4 py-3 rounded-xl bg-[#0B0E14] border border-white/10 text-xs text-amber-300">
            Update link is being updated by Admin. Please check back shortly.
          </div>
        )}
      </div>
    </div>
  );
};

interface AntiCheatRulesModalProps {
  match: TournamentMatch | null;
  rulesText: string;
  onCancel: () => void;
  onAgree: () => void;
}

export const AntiCheatRulesModal: React.FC<AntiCheatRulesModalProps> = ({
  match,
  rulesText,
  onCancel,
  onAgree,
}) => {
  if (!match) return null;

  return (
    <div className="fixed inset-0 z-[70] modal-backdrop flex items-center justify-center p-4">
      <div className="w-full max-w-md card-surface rounded-2xl p-6 border border-[#FF5500]/45 space-y-4 glow-orange">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#FF5500]/15 border border-[#FF5500]/40 flex items-center justify-center text-[#FF5500] shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF5500]">
                Anti-Cheat &amp; Fair Play
              </span>
              <h3 className="font-gaming text-2xl font-bold uppercase text-white leading-tight">
                Match Rules Confirmation
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close anti-cheat modal"
            className="min-w-[36px] min-h-[36px] rounded-lg bg-[#0B0E14] text-slate-400 hover:text-white flex items-center justify-center shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/10 text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line max-h-56 overflow-y-auto">
          {rulesText}
        </div>

        <p className="text-[11px] text-slate-400">
          Match: <span className="text-white font-semibold">{match.title}</span> · Entry Fee:{' '}
          <span className="text-[#00FF88] font-bold tabular-nums">
            {Number(match.entryFee || 0)} Coins
          </span>
        </p>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-xs font-bold uppercase text-slate-300 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAgree}
            className="min-h-[44px] py-2.5 rounded-xl bg-[#00FF88] text-[#0B0E14] text-xs font-bold uppercase tracking-wider hover:brightness-110 transition glow-green-sm"
          >
            I Agree &amp; Continue
          </button>
        </div>
      </div>
    </div>
  );
};

interface WhatsappChannelPopupModalProps {
  open: boolean;
  message: string;
  channelUrl: string;
  onClose: () => void;
  onJoinClick: () => void;
}

export const WhatsappChannelPopupModal: React.FC<WhatsappChannelPopupModalProps> = ({
  open,
  message,
  channelUrl,
  onClose,
  onJoinClick,
}) => {
  if (!open) return null;

  const safeHref = (channelUrl || '').trim() || '#';

  return (
    <div className="fixed inset-0 z-[72] modal-backdrop flex items-center justify-center p-4">
      <div className="w-full max-w-sm card-surface rounded-2xl p-6 border border-[#00FF88]/45 space-y-4 text-center glow-green relative">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close WhatsApp channel popup"
          className="absolute top-3.5 right-3.5 min-w-[34px] min-h-[34px] rounded-lg bg-[#0B0E14] text-slate-400 hover:text-white flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#00FF88]/15 border border-[#00FF88]/40 flex items-center justify-center text-[#00FF88]">
          <MessageCircle className="w-7 h-7" />
        </div>

        <div className="space-y-1.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-[#00FF88]">
            Official Community
          </span>
          <h3 className="font-gaming text-2xl font-bold uppercase text-white">
            WhatsApp Channel
          </h3>
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
            {message || 'Join this channel for offers and free matches'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-xs font-bold uppercase text-slate-300 hover:text-white transition"
          >
            Close
          </button>
          <a
            href={safeHref}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onJoinClick}
            className="min-h-[44px] py-2.5 px-3 rounded-xl bg-[#00FF88] text-[#0B0E14] text-xs font-bold uppercase tracking-wider hover:brightness-110 transition flex items-center justify-center gap-1.5 glow-green-sm"
          >
            Join Now
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
