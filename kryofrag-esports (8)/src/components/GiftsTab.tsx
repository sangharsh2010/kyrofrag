import React, { useState } from 'react';
import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { CheckCircle2, Clock, Copy, Gift, Share2, Ticket } from 'lucide-react';
import { db } from '../lib/firebase';
import { copyToClipboard } from '../lib/formatters';
import type { ReferralBonusSettings } from '../types/esports';

interface GiftsTabProps {
  userId: string;
  referralCode: string;
  referralStatus?: 'none' | 'pending' | 'credited';
  referredByCode?: string;
  redeemedPromoCodes: string[];
  referralBonus: ReferralBonusSettings;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const GiftsTab: React.FC<GiftsTabProps> = ({
  userId,
  referralCode,
  referralStatus,
  referredByCode,
  redeemedPromoCodes,
  referralBonus,
  onToast,
}) => {
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState('');
  const [redeeming, setRedeeming] = useState(false);

  const handleCopyCode = async () => {
    if (!referralCode) return;
    const ok = await copyToClipboard(referralCode);
    if (ok) onToast(`Referral code "${referralCode}" copied!`, 'success');
  };

  const handleRedeemPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoError('');

    const cleanCode = promoInput.trim().toUpperCase();
    if (!cleanCode) {
      setPromoError('Please enter a promo code.');
      return;
    }

    if (redeemedPromoCodes.includes(cleanCode)) {
      setPromoError('You have already redeemed this promo code.');
      return;
    }

    setRedeeming(true);
    try {
      let rewardedCoins = 0;

      await runTransaction(db, async (tx) => {
        const promoRef = doc(db, 'promoCodes', cleanCode);
        const userRef = doc(db, 'users', userId);

        const [promoSnap, userSnap] = await Promise.all([
          tx.get(promoRef),
          tx.get(userRef),
        ]);

        if (!promoSnap.exists()) {
          throw new Error('Invalid or expired promo code.');
        }
        if (!userSnap.exists()) {
          throw new Error('User profile not found.');
        }

        const pData = promoSnap.data();
        const usedCount = Number(pData.usedCount || 0);
        const maxUses = Number(pData.maxUses || 0);
        const coins = Math.max(0, Math.floor(Number(pData.coins || 0)));

        if (maxUses > 0 && usedCount >= maxUses) {
          throw new Error('This promo code has reached its maximum usage limit.');
        }
        if (coins <= 0) {
          throw new Error('This promo code has no coin reward configured.');
        }

        const uData = userSnap.data();
        const alreadyRedeemed = Array.isArray(uData.redeemedPromoCodes)
          ? (uData.redeemedPromoCodes as string[])
          : [];

        if (alreadyRedeemed.includes(cleanCode)) {
          throw new Error('You have already redeemed this promo code!');
        }

        const curBal = Number(uData.walletBalance || 0);
        rewardedCoins = coins;

        tx.update(promoRef, {
          usedCount: usedCount + 1,
        });

        tx.update(userRef, {
          walletBalance: curBal + coins,
          redeemedPromoCodes: [...alreadyRedeemed, cleanCode],
        });

        tx.set(doc(collection(db, 'transactions')), {
          uid: userId,
          type: 'Promo Code',
          amount: coins,
          isCredit: true,
          status: 'Completed',
          description: `Redeemed Promo Code: ${cleanCode}`,
          createdAt: serverTimestamp(),
        });
      });

      setPromoInput('');
      onToast(`+${rewardedCoins} Coins credited from "${cleanCode}"!`, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to redeem promo code.';
      setPromoError(msg);
      onToast(msg, 'error');
    } finally {
      setRedeeming(false);
    }
  };

  const referrerCoins = Math.max(0, Number(referralBonus.referrerCoins ?? 3));
  const refereeCoins = Math.max(0, Number(referralBonus.refereeCoins ?? 3));

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* LEFT SECTION: REDEEM PROMO CODE BOX */}
      <div className="lg:col-span-6 card-surface rounded-2xl p-5 space-y-4 border border-[#00FF88]/25">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#00FF88]/15 border border-[#00FF88]/40 flex items-center justify-center text-[#00FF88] shrink-0">
            <Ticket className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-gaming text-2xl font-bold uppercase text-white leading-none">
              Redeem Promo Code
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter secret giveaway codes to claim instant wallet coins.
            </p>
          </div>
        </div>

        <form onSubmit={handleRedeemPromo} className="space-y-3">
          <div>
            <label
              htmlFor="promo-code-input"
              className="block text-xs font-medium text-slate-300 mb-1.5"
            >
              Secret Promo Code
            </label>
            <div className="flex items-center gap-2">
              <input
                id="promo-code-input"
                type="text"
                maxLength={24}
                value={promoInput}
                onChange={(e) => {
                  setPromoError('');
                  setPromoInput(e.target.value.toUpperCase());
                }}
                placeholder="e.g., FREE10"
                className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm font-mono-code font-bold uppercase tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88] transition"
              />
              <button
                type="submit"
                disabled={redeeming}
                className="min-h-[46px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00CC6E] text-[#0B0E14] font-gaming font-bold text-base uppercase tracking-wider hover:brightness-110 transition glow-green-sm shrink-0 disabled:opacity-60"
              >
                {redeeming ? 'Checking...' : 'Redeem'}
              </button>
            </div>
          </div>

          {promoError && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
              {promoError}
            </div>
          )}
        </form>

        {redeemedPromoCodes.length > 0 && (
          <div className="pt-3 border-t border-white/10 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Your Claimed Codes ({redeemedPromoCodes.length})
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {redeemedPromoCodes.map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#00FF88]/10 border border-[#00FF88]/30 text-[#00FF88] text-xs font-mono-code font-bold"
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {code}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT SECTION: REFER & EARN CARD */}
      <div className="lg:col-span-6 card-surface rounded-2xl p-5 space-y-4 border border-[#FF5500]/30">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-[#FF5500]/15 border border-[#FF5500]/40 flex items-center justify-center text-[#FF5500] shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-gaming text-2xl font-bold uppercase text-white leading-none">
              Refer &amp; Earn
            </h2>
            <p className="text-xs text-slate-400 mt-1 tabular-nums">
              Invite friends and earn{' '}
              <span className="text-[#00FF88] font-bold">{referrerCoins} Coins</span> each · Friend
              gets <span className="text-amber-400 font-bold">{refereeCoins} Coins</span>
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/10 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block">
            Your Unique Referral Code
          </span>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <code className="font-mono-code text-xl sm:text-2xl font-bold tracking-widest text-[#00FF88]">
              {referralCode || '---'}
            </code>
            <button
              type="button"
              onClick={handleCopyCode}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-[#00FF88] text-[#0B0E14] font-gaming font-bold text-sm uppercase tracking-wider hover:brightness-110 transition inline-flex items-center gap-1.5 glow-green-sm shrink-0"
            >
              <Copy className="w-4 h-4" />
              Copy Code
            </button>
          </div>
        </div>

        <p className="text-xs text-amber-300/95 bg-amber-400/10 border border-amber-400/30 rounded-xl px-3.5 py-2.5 leading-relaxed">
          Note: You will only receive your referral reward after the referred user plays a match or
          makes a deposit.
        </p>

        {referredByCode && (referralStatus === 'pending' || referralStatus === 'credited') && (
          <div className="p-3 rounded-xl bg-[#0B0E14] border border-white/10 flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-400">
              Signup Referral ({referredByCode})
            </span>
            {referralStatus === 'credited' ? (
              <span className="inline-flex items-center gap-1 font-bold text-[#00FF88]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Unlocked &amp; Credited
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-bold text-amber-400">
                <Clock className="w-3.5 h-3.5" />
                Pending First Match / Deposit
              </span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 text-[11px] text-slate-400 pt-1">
          <Share2 className="w-3.5 h-3.5 text-[#00FF88] shrink-0" />
          <span>Share your code with squadmates before they sign up to earn rewards!</span>
        </div>
      </div>
    </section>
  );
};
