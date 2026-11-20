import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { Copy, ExternalLink, QrCode, Wallet } from 'lucide-react';
import {
  ADMIN_EMAIL,
  ADMIN_UPI_ID,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { copyToClipboard, formatTimestamp } from '../lib/formatters';
import { sendOneSignalNotification } from '../lib/onesignal';
import type { WalletTransaction } from '../types/esports';

interface WalletTabProps {
  userId: string;
  userEmail: string;
  userIgn?: string;
  userMobileNumber?: string;
  walletBalance: number;
  transactions: WalletTransaction[];
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const PRESET_AMOUNTS = [10, 20, 50, 100];

const STATUS_BADGE_MAP: Record<string, string> = {
  Pending: 'text-amber-400',
  Approved: 'text-[#00FF88]',
  Paid: 'text-[#00FF88]',
  Completed: 'text-sky-400',
  'Admin Bonus': 'text-purple-300',
  Refunded: 'text-sky-300',
  Rejected: 'text-red-400',
};

export const WalletTab: React.FC<WalletTabProps> = ({
  userId,
  userEmail,
  userIgn,
  userMobileNumber,
  walletBalance,
  transactions,
  onToast,
}) => {
  const [subTab, setSubTab] = useState<'add' | 'withdraw'>('add');
  const [depositAmount, setDepositAmount] = useState<string>('50');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [senderInput, setSenderInput] = useState<string>(userMobileNumber || '');
  const [utrInput, setUtrInput] = useState<string>('');
  const [depositError, setDepositError] = useState<string>('');
  const [submittingDeposit, setSubmittingDeposit] = useState<boolean>(false);

  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawUpi, setWithdrawUpi] = useState<string>('');
  const [withdrawError, setWithdrawError] = useState<string>('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState<boolean>(false);
  const prefilledSenderRef = useRef<boolean>(Boolean(userMobileNumber));

  useEffect(() => {
    if (userMobileNumber && !prefilledSenderRef.current) {
      setSenderInput(userMobileNumber);
      prefilledSenderRef.current = true;
    }
  }, [userMobileNumber]);

  const numericDeposit = Math.floor(Number(depositAmount) || 0);
  const qrAmount = numericDeposit >= 10 ? numericDeposit : 10;
  const upiUri = `upi://pay?pa=${ADMIN_UPI_ID}&pn=Tournament&am=${qrAmount}&cu=INR`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(upiUri, {
      width: 220,
      margin: 2,
      color: {
        dark: '#0B0E14',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [upiUri]);

  const handleCopyUpi = async () => {
    const ok = await copyToClipboard(ADMIN_UPI_ID);
    if (ok) onToast('Admin UPI ID copied!', 'success');
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError('');

    const amount = Math.floor(Number(depositAmount));
    const senderInfo = senderInput.trim();
    const rawUtr = utrInput.trim();

    if (!amount || amount < 10) {
      setDepositError('Minimum deposit amount is 10 Coins.');
      return;
    }
    if (!senderInfo) {
      setDepositError('Please enter your Sender UPI Name or Mobile Number.');
      return;
    }
    if (rawUtr && !/^\d{12}$/.test(rawUtr)) {
      setDepositError('If entering a UTR number, it must be a valid 12-digit number.');
      return;
    }

    const finalUtr = rawUtr || 'Not Provided';

    setSubmittingDeposit(true);
    try {
      if (rawUtr) {
        const dupQuery = query(collection(db, 'deposits'), where('utr', '==', rawUtr));
        const dupSnap = await getDocs(dupQuery).catch((err) =>
          handleFirestoreError(err, OperationType.LIST, 'deposits')
        );

        if (!dupSnap.empty) {
          const msg = 'This UTR number has already been submitted!';
          setDepositError(msg);
          onToast(msg, 'error');
          return;
        }
      }

      const depositRef = doc(collection(db, 'deposits'));
      const txRef = doc(db, 'transactions', depositRef.id);

      await setDoc(depositRef, {
        uid: userId,
        email: userEmail,
        amount,
        utr: finalUtr,
        senderInfo,
        status: 'Pending',
        createdAt: serverTimestamp(),
      }).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `deposits/${depositRef.id}`)
      );

      await setDoc(txRef, {
        uid: userId,
        type: 'Deposit',
        amount,
        isCredit: true,
        status: 'Pending',
        description:
          finalUtr === 'Not Provided'
            ? `UPI Deposit (${senderInfo})`
            : `UPI Deposit (UTR: ${finalUtr} · ${senderInfo})`,
        createdAt: serverTimestamp(),
      }).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `transactions/${txRef.id}`)
      );

      const playerLabel = userIgn?.trim()
        ? `${userIgn.trim()} (${userEmail})`
        : userEmail;

      void sendOneSignalNotification({
        targetEmail: ADMIN_EMAIL,
        title: '💰 New Deposit Request!',
        message: `${playerLabel} submitted ₹${amount} deposit request. Tap to verify & approve!`,
      }).catch(() => {});

      setUtrInput('');
      onToast('Payment submitted! Coins will be added after verification.', 'success');
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : 'Failed to submit deposit.');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');

    const amount = Math.floor(Number(withdrawAmount));
    const upiId = withdrawUpi.trim();

    if (!amount || amount < 20) {
      setWithdrawError('Minimum withdrawal amount is 20 Coins.');
      return;
    }
    if (!upiId || !upiId.includes('@')) {
      setWithdrawError('Please enter a valid UPI ID (e.g., name@okaxis).');
      return;
    }
    if (walletBalance < amount) {
      setWithdrawError(`Insufficient wallet balance! Available: ${walletBalance} Coins.`);
      return;
    }

    setSubmittingWithdraw(true);
    try {
      const withdrawRef = doc(collection(db, 'withdrawals'));
      const txRef = doc(db, 'transactions', withdrawRef.id);
      const userRef = doc(db, 'users', userId);

      await runTransaction(db, async (tx) => {
        const uSnap = await tx.get(userRef);
        if (!uSnap.exists()) throw new Error('User profile not found.');
        const liveBal = Number(uSnap.data().walletBalance || 0);
        if (liveBal < amount) {
          throw new Error(`Insufficient balance! Available: ${liveBal} Coins.`);
        }

        tx.update(userRef, { walletBalance: liveBal - amount });
        tx.set(withdrawRef, {
          uid: userId,
          email: userEmail,
          amount,
          upiId,
          status: 'Pending',
          createdAt: serverTimestamp(),
        });
        tx.set(txRef, {
          uid: userId,
          type: 'Withdrawal',
          amount,
          isCredit: false,
          status: 'Pending',
          description: `Withdraw to ${upiId}`,
          createdAt: serverTimestamp(),
        });
      });

      setWithdrawAmount('');
      setWithdrawUpi('');
      onToast('Withdrawal request submitted!', 'success');
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : 'Withdrawal failed.');
    } finally {
      setSubmittingWithdraw(false);
    }
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-7 space-y-5">
        {/* Prominent Balance Card */}
        <div className="rounded-2xl p-5 bg-gradient-to-br from-[#151A23] via-[#17202D] to-[#0E1621] border border-[#00FF88]/30 glow-green relative overflow-hidden">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-400 font-semibold">
                Available Balance
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-gaming text-4xl font-bold text-[#00FF88] tabular-nums">
                  {walletBalance}
                </span>
                <span className="font-gaming text-lg font-semibold text-slate-300 uppercase">
                  Coins
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">1 INR = 1 Coin · Safe &amp; Verified</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-[#00FF88]/15 border border-[#00FF88]/40 flex items-center justify-center shrink-0">
              <Wallet className="w-7 h-7 text-[#00FF88]" />
            </div>
          </div>
        </div>

        {/* Sub-tab Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#151A23] border border-white/10">
          <button
            type="button"
            onClick={() => setSubTab('add')}
            className={`min-h-[44px] rounded-lg text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${
              subTab === 'add'
                ? 'bg-[#00FF88] text-[#0B0E14]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            + Add Coins
          </button>
          <button
            type="button"
            onClick={() => setSubTab('withdraw')}
            className={`min-h-[44px] rounded-lg text-xs font-bold uppercase tracking-wider transition whitespace-nowrap ${
              subTab === 'withdraw'
                ? 'bg-[#FF5500] text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Withdraw Winnings
          </button>
        </div>

        {subTab === 'add' ? (
          <div className="card-surface rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-gaming text-xl font-bold uppercase text-white">
                Add Coins via UPI
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select amount (Min ₹10), scan QR or pay via UPI app, then submit your payment request.
              </p>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {PRESET_AMOUNTS.map((amt) => {
                const active = numericDeposit === amt;
                return (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setDepositAmount(String(amt))}
                    className={`min-h-[44px] rounded-xl bg-[#0B0E14] border font-gaming text-base font-bold transition tabular-nums ${
                      active
                        ? 'border-[#00FF88] text-[#00FF88]'
                        : 'border-white/10 text-slate-200 hover:border-[#00FF88]/50'
                    }`}
                  >
                    ₹{amt}
                  </button>
                );
              })}
            </div>

            <div>
              <label
                htmlFor="deposit-amount-input"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Custom Amount (Min 10 Coins)
              </label>
              <input
                id="deposit-amount-input"
                type="number"
                min={10}
                step={1}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                placeholder="Enter amount (min 10)"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white font-semibold tabular-nums focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <div className="bg-[#0B0E14] border border-white/10 rounded-2xl p-4 flex flex-col items-center text-center gap-3">
              <div className="bg-white p-2.5 rounded-xl shadow-lg w-[200px] h-[200px] flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`UPI QR code for ₹${qrAmount}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <QrCode className="w-10 h-10" />
                    <span className="text-xs">Generating QR...</span>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-300 w-full">
                Paying <span className="font-bold text-[#00FF88] tabular-nums">₹{qrAmount}</span> to
                UPI ID:
                <div className="mt-1.5 flex items-center justify-center gap-2 flex-wrap">
                  <code className="px-2.5 py-1.5 rounded-lg bg-[#151A23] border border-white/10 text-[#00FF88] text-xs font-mono-code">
                    {ADMIN_UPI_ID}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyUpi}
                    className="min-h-[36px] px-3 py-1 rounded-lg bg-[#151A23] border border-[#00FF88]/40 text-xs font-semibold text-[#00FF88] hover:bg-[#00FF88] hover:text-[#0B0E14] transition inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy UPI ID
                  </button>
                </div>
              </div>

              <a
                href={upiUri}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[46px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#FF5500] to-[#FF7722] text-white font-gaming font-bold text-base uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 transition glow-orange"
              >
                <ExternalLink className="w-4 h-4" />
                Pay via UPI App
              </a>
            </div>

            <form onSubmit={handleDepositSubmit} className="space-y-3 pt-1">
              <div>
                <label
                  htmlFor="deposit-sender-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Sender UPI Name or Mobile Number
                </label>
                <input
                  id="deposit-sender-input"
                  type="text"
                  required
                  maxLength={60}
                  value={senderInput}
                  onChange={(e) => setSenderInput(e.target.value)}
                  placeholder="Enter your UPI name or mobile number"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88]"
                />
              </div>

              <div>
                <label
                  htmlFor="deposit-utr-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  12-Digit UTR Number (Optional)
                </label>
                <input
                  id="deposit-utr-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={12}
                  value={utrInput}
                  onChange={(e) => setUtrInput(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  placeholder="Enter 12-digit UTR if available (optional)"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white font-mono-code tracking-wider focus:outline-none focus:border-[#00FF88]"
                />
              </div>

              {depositError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
                  {depositError}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingDeposit}
                className="w-full min-h-[48px] py-3 rounded-xl bg-[#00FF88] text-[#0B0E14] font-gaming font-bold text-lg uppercase tracking-wider hover:brightness-110 transition glow-green disabled:opacity-60"
              >
                {submittingDeposit ? 'Submitting...' : 'Submit Payment'}
              </button>

              <p className="text-[11px] text-slate-400 leading-relaxed text-center pt-1">
                Paid via UPI? Enter UTR if available, or just click Submit Payment after paying.
                Send screenshot on WhatsApp Support for faster approval.
              </p>
            </form>
          </div>
        ) : (
          <div className="card-surface rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-gaming text-xl font-bold uppercase text-white">
                Withdraw Winnings
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Minimum withdrawal: 20 Coins. Payouts are processed directly to your UPI ID.
              </p>
            </div>

            <form onSubmit={handleWithdrawSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="withdraw-amount-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Withdrawal Amount (Min 20 Coins)
                </label>
                <input
                  id="withdraw-amount-input"
                  type="number"
                  min={20}
                  step={1}
                  required
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="e.g., 50"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white font-semibold tabular-nums focus:outline-none focus:border-[#FF5500]"
                />
              </div>
              <div>
                <label
                  htmlFor="withdraw-upi-input"
                  className="block text-xs font-medium text-slate-300 mb-1.5"
                >
                  Your UPI ID
                </label>
                <input
                  id="withdraw-upi-input"
                  type="text"
                  required
                  value={withdrawUpi}
                  onChange={(e) => setWithdrawUpi(e.target.value)}
                  placeholder="yourname@okaxis / @ybl / @paytm"
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#FF5500]"
                />
              </div>

              {withdrawError && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-3.5 py-2.5">
                  {withdrawError}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingWithdraw}
                className="w-full min-h-[48px] py-3 rounded-xl bg-gradient-to-r from-[#FF5500] to-[#FF7722] text-white font-gaming font-bold text-lg uppercase tracking-wider hover:brightness-110 transition glow-orange disabled:opacity-60"
              >
                {submittingWithdraw ? 'Processing...' : 'Request Withdrawal'}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="lg:col-span-5 card-surface rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-gaming text-lg font-bold uppercase text-white">
            Transaction History
          </h3>
          <span className="text-xs text-slate-400 tabular-nums">
            {transactions.length} {transactions.length === 1 ? 'Entry' : 'Entries'}
          </span>
        </div>

        <div className="divide-y divide-white/5 max-h-[480px] overflow-y-auto pr-1">
          {transactions.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-8">No transactions yet.</p>
          ) : (
            transactions.map((tx) => {
              const statusColor = STATUS_BADGE_MAP[tx.status] || 'text-slate-300';
              const sign = tx.isCredit ? '+' : '-';
              const amtColor = tx.isCredit ? 'text-[#00FF88]' : 'text-[#FF5500]';
              return (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold text-white">{tx.type}</span>
                      <span aria-hidden="true" className="text-slate-600">
                        ·
                      </span>
                      <span className={`font-semibold ${statusColor}`}>{tx.status}</span>
                    </div>
                    <p className="text-xs text-slate-400 truncate mt-0.5">{tx.description}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {formatTimestamp(tx.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`font-gaming text-lg font-bold tabular-nums ${amtColor}`}>
                      {sign}
                      {Number(tx.amount || 0)}
                    </span>
                    <p className="text-[11px] text-slate-500 uppercase">Coins</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
