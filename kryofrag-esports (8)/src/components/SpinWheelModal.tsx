import React, { useEffect, useState } from 'react';
import { collection, doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { Clock, Disc, Sparkles, Trophy, X } from 'lucide-react';
import { db } from '../lib/firebase';
import { formatCountdown } from '../lib/formatters';
import type { SpinSegment, SpinWheelSettings } from '../types/esports';

interface SpinWheelModalProps {
  open: boolean;
  userId: string;
  lastSpinTime: number;
  spinSettings: SpinWheelSettings;
  onClose: () => void;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const WHEEL_COLORS = [
  '#151A23',
  '#00CC6E',
  '#1C222E',
  '#FF5500',
  '#111827',
  '#F59E0B',
  '#1E293B',
  '#00FF88',
];

function pickWeightedSegmentIndex(segments: SpinSegment[]): number {
  const weights = segments.map((s) => Math.max(0, Number(s.weight || 0)));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  if (totalWeight <= 0) {
    return Math.floor(Math.random() * segments.length);
  }
  let r = Math.random() * totalWeight;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return segments.length - 1;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeWedge(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M',
    cx,
    cy,
    'L',
    start.x,
    start.y,
    'A',
    r,
    r,
    0,
    largeArc,
    0,
    end.x,
    end.y,
    'Z',
  ].join(' ');
}

export const SpinWheelModal: React.FC<SpinWheelModalProps> = ({
  open,
  userId,
  lastSpinTime,
  spinSettings,
  onClose,
  onToast,
}) => {
  const [now, setNow] = useState(() => Date.now());
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [resultBanner, setResultBanner] = useState<{ label: string; coins: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  if (!open) return null;

  const segments =
    Array.isArray(spinSettings.segments) && spinSettings.segments.length >= 2
      ? spinSettings.segments
      : [
          { id: 's1', label: '0 Coins', coins: 0, weight: 35 },
          { id: 's2', label: '1 Coin', coins: 1, weight: 30 },
          { id: 's3', label: '2 Coins', coins: 2, weight: 20 },
          { id: 's4', label: '5 Coins', coins: 5, weight: 10 },
          { id: 's5', label: '10 Coins', coins: 10, weight: 5 },
        ];

  const elapsed = now - Number(lastSpinTime || 0);
  const remainingMs = Math.max(0, ONE_DAY_MS - elapsed);
  const isReady = spinSettings.enabled && remainingMs === 0;

  const sliceAngle = 360 / segments.length;

  const handleSpin = async () => {
    if (!spinSettings.enabled || spinning || remainingMs > 0) return;

    const chosenIndex = pickWeightedSegmentIndex(segments);
    const chosen = segments[chosenIndex];
    const wonCoins = Math.max(0, Math.floor(Number(chosen.coins || 0)));

    setSpinning(true);
    setResultBanner(null);

    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', userId);
        const uSnap = await tx.get(userRef);
        if (!uSnap.exists()) throw new Error('User profile not found.');

        const uData = uSnap.data();
        const serverLastSpin = Number(uData.lastSpinTime || 0);
        const currentNow = Date.now();
        if (currentNow - serverLastSpin < ONE_DAY_MS) {
          throw new Error('Daily spin cooldown is still active. Come back later!');
        }

        const curBal = Number(uData.walletBalance || 0);
        tx.update(userRef, {
          lastSpinTime: currentNow,
          walletBalance: curBal + wonCoins,
        });

        if (wonCoins > 0) {
          tx.set(doc(collection(db, 'transactions')), {
            uid: userId,
            type: 'Daily Spin',
            amount: wonCoins,
            isCredit: true,
            status: 'Completed',
            description: `Daily Spin Wheel Win (${chosen.label})`,
            createdAt: serverTimestamp(),
          });
        }
      });

      // Compute exact target rotation so chosen segment lands under the top pointer (0 deg)
      const centerAngle = chosenIndex * sliceAngle + sliceAngle / 2;
      const desiredOffset = (360 - centerAngle) % 360;
      const currentMod = ((rotation % 360) + 360) % 360;
      const delta = (desiredOffset - currentMod + 360) % 360;
      const nextRotation = rotation + 360 * 6 + delta;

      setRotation(nextRotation);

      setTimeout(() => {
        setSpinning(false);
        setResultBanner({ label: chosen.label, coins: wonCoins });
        if (wonCoins > 0) {
          onToast(`Congrats! You won +${wonCoins} Coins on the Daily Spin!`, 'success');
        } else {
          onToast('Better luck next time! Spin again in 24 hours.', 'info');
        }
      }, 3900);
    } catch (err) {
      setSpinning(false);
      onToast(err instanceof Error ? err.message : 'Spin failed. Please try again.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[75] modal-backdrop flex items-center justify-center p-4">
      <div className="w-full max-w-md card-surface rounded-2xl p-5 sm:p-6 border border-[#00FF88]/40 space-y-5 glow-green relative">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#00FF88]">
              24-Hour Reward Wheel
            </span>
            <h3 className="font-gaming text-2xl font-bold uppercase text-white mt-0.5 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Daily Lucky Spin
            </h3>
          </div>
          <button
            type="button"
            disabled={spinning}
            onClick={onClose}
            aria-label="Close spin wheel modal"
            className="min-w-[36px] min-h-[36px] rounded-lg bg-[#0B0E14] text-slate-400 hover:text-white flex items-center justify-center disabled:opacity-40"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!spinSettings.enabled ? (
          <div className="p-6 rounded-2xl bg-[#0B0E14] border border-white/10 text-center space-y-2">
            <Disc className="w-10 h-10 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">
              Daily Spin Wheel is currently disabled by Admin.
            </p>
            <p className="text-xs text-slate-500">Check back soon for new lucky spin rewards!</p>
          </div>
        ) : (
          <>
            {/* Wheel Graphic */}
            <div className="relative mx-auto w-[264px] h-[264px] sm:w-[290px] sm:h-[290px] flex items-center justify-center">
              {/* Top Pointer */}
              <div
                aria-hidden="true"
                className="absolute -top-2 left-1/2 -translate-x-1/2 z-20 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-[#00FF88] drop-shadow-[0_0_8px_rgba(0,255,136,0.9)]"
              />

              <div
                className="w-full h-full rounded-full p-1.5 bg-gradient-to-br from-[#00FF88] via-[#FF5500] to-amber-400 shadow-2xl"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  transition: spinning
                    ? 'transform 3.8s cubic-bezier(0.15, 0.72, 0.1, 1)'
                    : 'none',
                }}
              >
                <svg viewBox="0 0 200 200" className="w-full h-full rounded-full bg-[#0B0E14]">
                  {segments.map((seg, idx) => {
                    const startAngle = idx * sliceAngle;
                    const endAngle = startAngle + sliceAngle;
                    const midAngle = startAngle + sliceAngle / 2;
                    const fill = WHEEL_COLORS[idx % WHEEL_COLORS.length];
                    const isLightSlice = fill === '#00FF88' || fill === '#00CC6E' || fill === '#F59E0B';
                    const textColor = isLightSlice ? '#0B0E14' : '#F8FAFC';

                    return (
                      <g key={seg.id}>
                        <path
                          d={describeWedge(100, 100, 98, startAngle, endAngle)}
                          fill={fill}
                          stroke="#0B0E14"
                          strokeWidth="1.5"
                        />
                        <text
                          x="100"
                          y="34"
                          fill={textColor}
                          fontSize="10.5"
                          fontWeight="700"
                          fontFamily="Rajdhani, sans-serif"
                          textAnchor="middle"
                          transform={`rotate(${midAngle} 100 100)`}
                        >
                          {seg.label}
                        </text>
                      </g>
                    );
                  })}
                  <circle cx="100" cy="100" r="18" fill="#0B0E14" stroke="#00FF88" strokeWidth="3" />
                </svg>
              </div>

              {/* Center Hub Icon */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Trophy className="w-5 h-5 text-[#00FF88]" />
              </div>
            </div>

            {resultBanner && (
              <div
                className={`p-3 rounded-xl border text-center ${
                  resultBanner.coins > 0
                    ? 'bg-[#00FF88]/15 border-[#00FF88]/45 text-[#00FF88]'
                    : 'bg-[#0B0E14] border-white/10 text-slate-300'
                }`}
              >
                <p className="font-gaming text-lg font-bold uppercase">
                  {resultBanner.coins > 0
                    ? `You Won +${resultBanner.coins} Coins!`
                    : `Landed on ${resultBanner.label}`}
                </p>
              </div>
            )}

            {isReady || spinning ? (
              <button
                type="button"
                disabled={spinning}
                onClick={handleSpin}
                className="w-full min-h-[48px] py-3 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00CC6E] text-[#0B0E14] font-gaming font-bold text-lg uppercase tracking-wider hover:brightness-110 transition glow-green disabled:opacity-60"
              >
                {spinning ? 'Spinning Wheel...' : 'Spin Now'}
              </button>
            ) : (
              <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-white/10 flex items-center justify-center gap-2 text-xs text-amber-400 font-semibold tabular-nums">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Next Spin Available in {formatCountdown(remainingMs)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
