import React from 'react';
import { AlertTriangle, Crown, Crosshair, Trophy, X } from 'lucide-react';
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
  submitting: boolean;
  onIgnChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const JoinIgnModal: React.FC<JoinIgnModalProps> = ({
  match,
  ign,
  submitting,
  onIgnChange,
  onCancel,
  onSubmit,
}) => {
  if (!match) return null;

  return (
    <div className="fixed inset-0 z-[70] modal-backdrop flex items-center justify-center p-4">
      <div className="w-full max-w-sm card-surface rounded-2xl p-6 border border-[#00FF88]/40 space-y-4 glow-green">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#00FF88]">
              Match Registration
            </span>
            <h3 className="font-gaming text-2xl font-bold uppercase text-white mt-0.5">
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
            className="min-w-[36px] min-h-[36px] rounded-lg bg-[#0B0E14] text-slate-400 hover:text-white flex items-center justify-center"
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
  onCancel: () => void;
  onConfirm: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
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
            Confirm
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
