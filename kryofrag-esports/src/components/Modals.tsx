import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
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
