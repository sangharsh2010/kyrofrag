import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { Copy, Search, Trash2, Users, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { copyToClipboard, formatMatchDate, formatTimestamp } from '../lib/formatters';
import type {
  AdminSubTab,
  AppSettings,
  DepositRequest,
  TournamentMatch,
  UserProfile,
  WithdrawalRequest,
} from '../types/esports';

interface AdminTabProps {
  deposits: DepositRequest[];
  withdrawals: WithdrawalRequest[];
  users: UserProfile[];
  matches: TournamentMatch[];
  settings: AppSettings;
  onRequestDeleteMatch: (matchId: string, title: string) => void;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ADMIN_SUBTABS: { id: AdminSubTab; label: string }[] = [
  { id: 'deposits', label: 'Deposits (UTR)' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'users', label: 'Users & Special Coins' },
  { id: 'matches', label: 'Manage Matches' },
  { id: 'settings', label: 'App Settings' },
];

export const AdminTab: React.FC<AdminTabProps> = ({
  deposits,
  withdrawals,
  users,
  matches,
  settings,
  onRequestDeleteMatch,
  onToast,
}) => {
  const [subTab, setSubTab] = useState<AdminSubTab>('deposits');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState<string>('');
  const [userCoinInputs, setUserCoinInputs] = useState<Record<string, string>>({});

  // Create Match State
  const [cmTitle, setCmTitle] = useState('');
  const [cmMap, setCmMap] = useState('Bermuda');
  const [cmType, setCmType] = useState<'Solo' | 'Duo' | 'Squad'>('Solo');
  const [cmDateTime, setCmDateTime] = useState('');
  const [cmEntry, setCmEntry] = useState('');
  const [cmPerKill, setCmPerKill] = useState('');
  const [cmBooyah, setCmBooyah] = useState('');
  const [cmSlots, setCmSlots] = useState('48');
  const [creatingMatch, setCreatingMatch] = useState(false);

  // Room ID/Pass inline edits keyed by matchId
  const [roomEdits, setRoomEdits] = useState<Record<string, { roomId: string; roomPass: string }>>(
    {}
  );

  // Players Modal State
  const [playersModalMatchId, setPlayersModalMatchId] = useState<string | null>(null);
  const [winCoinInputs, setWinCoinInputs] = useState<Record<string, string>>({});

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<AppSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  const activePlayersModalMatch = playersModalMatchId
    ? matches.find((m) => m.id === playersModalMatchId) || null
    : null;

  const handleCopy = async (val: string, label: string) => {
    const ok = await copyToClipboard(val);
    if (ok) onToast(label, 'success');
  };

  // ==================== 1. DEPOSITS ====================
  const handleApproveDeposit = async (dep: DepositRequest) => {
    setBusyId(dep.id);
    try {
      await runTransaction(db, async (tx) => {
        const depRef = doc(db, 'deposits', dep.id);
        const depSnap = await tx.get(depRef);
        if (!depSnap.exists()) throw new Error('Deposit not found.');
        const depData = depSnap.data();
        if (depData.status !== 'Pending') throw new Error('Already processed.');

        const userRef = doc(db, 'users', dep.uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('User document not found.');

        const newBal = Number(userSnap.data().walletBalance || 0) + Number(depData.amount || 0);
        tx.update(userRef, { walletBalance: newBal });
        tx.update(depRef, { status: 'Approved' });
        tx.set(doc(db, 'transactions', dep.id), { status: 'Approved' }, { merge: true });
      });
      onToast('Deposit approved & coins credited!', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Approval failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectDeposit = async (dep: DepositRequest) => {
    setBusyId(dep.id);
    try {
      await updateDoc(doc(db, 'deposits', dep.id), { status: 'Rejected' }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `deposits/${dep.id}`)
      );
      await setDoc(
        doc(db, 'transactions', dep.id),
        { status: 'Rejected' },
        { merge: true }
      ).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `transactions/${dep.id}`)
      );
      onToast('Deposit marked Rejected.', 'info');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Action failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // ==================== 2. WITHDRAWALS ====================
  const handleMarkWithdrawalPaid = async (w: WithdrawalRequest) => {
    setBusyId(w.id);
    try {
      await updateDoc(doc(db, 'withdrawals', w.id), { status: 'Paid' }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `withdrawals/${w.id}`)
      );
      await setDoc(
        doc(db, 'transactions', w.id),
        { status: 'Paid' },
        { merge: true }
      ).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `transactions/${w.id}`)
      );
      onToast('Withdrawal marked as Paid!', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Action failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleRefundWithdrawal = async (w: WithdrawalRequest) => {
    setBusyId(w.id);
    try {
      await runTransaction(db, async (tx) => {
        const wRef = doc(db, 'withdrawals', w.id);
        const wSnap = await tx.get(wRef);
        if (!wSnap.exists()) throw new Error('Withdrawal not found.');
        const wData = wSnap.data();
        if (wData.status !== 'Pending') throw new Error('Already processed.');

        const userRef = doc(db, 'users', w.uid);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found.');

        const newBal = Number(userSnap.data().walletBalance || 0) + Number(wData.amount || 0);
        tx.update(userRef, { walletBalance: newBal });
        tx.update(wRef, { status: 'Rejected' });
        tx.set(doc(db, 'transactions', w.id), { status: 'Rejected' }, { merge: true });
        tx.set(doc(collection(db, 'transactions')), {
          uid: w.uid,
          type: 'Withdrawal Refund',
          amount: Number(wData.amount || 0),
          isCredit: true,
          status: 'Refunded',
          description: `Refunded withdrawal (${wData.upiId})`,
          createdAt: serverTimestamp(),
        });
      });
      onToast('Withdrawal rejected & coins refunded!', 'info');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Refund failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // ==================== 3. USERS & SPECIAL COINS ====================
  const handleUserBalanceAdjust = async (uid: string, mode: 'add' | 'deduct') => {
    const amount = Math.floor(Number(userCoinInputs[uid] || 0));
    if (!amount || amount <= 0) {
      onToast('Enter a valid coin amount greater than 0.', 'error');
      return;
    }

    setBusyId(`user-${uid}`);
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', uid);
        const uSnap = await tx.get(userRef);
        if (!uSnap.exists()) throw new Error('User not found.');
        const curBal = Number(uSnap.data().walletBalance || 0);

        if (mode === 'add') {
          tx.update(userRef, { walletBalance: curBal + amount });
          tx.set(doc(collection(db, 'transactions')), {
            uid,
            type: 'Admin Bonus',
            amount,
            isCredit: true,
            status: 'Admin Bonus',
            description: 'Special Bonus Coins credited by Admin',
            createdAt: serverTimestamp(),
          });
        } else {
          const nextBal = Math.max(0, curBal - amount);
          tx.update(userRef, { walletBalance: nextBal });
          tx.set(doc(collection(db, 'transactions')), {
            uid,
            type: 'Admin Adjustment',
            amount,
            isCredit: false,
            status: 'Completed',
            description: 'Balance deducted by Admin',
            createdAt: serverTimestamp(),
          });
        }
      });

      setUserCoinInputs((prev) => ({ ...prev, [uid]: '' }));
      onToast(
        mode === 'add' ? `+${amount} Special Coins credited!` : `-${amount} Coins deducted!`,
        'success'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Balance adjustment failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // ==================== 4. MATCHES ====================
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingMatch(true);
    try {
      await addDoc(collection(db, 'matches'), {
        title: cmTitle.trim(),
        map: cmMap.trim() || 'Bermuda',
        type: cmType,
        dateTime: cmDateTime,
        entryFee: Number(cmEntry || 0),
        perKill: Number(cmPerKill || 0),
        booyahPrize: Number(cmBooyah || 0),
        maxSlots: Number(cmSlots || 48),
        joinedCount: 0,
        participants: [],
        roomId: '',
        roomPass: '',
        createdAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.CREATE, 'matches'));

      setCmTitle('');
      setCmMap('Bermuda');
      setCmType('Solo');
      setCmDateTime('');
      setCmEntry('');
      setCmPerKill('');
      setCmBooyah('');
      setCmSlots('48');
      onToast('Match published live!', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to create match.', 'error');
    } finally {
      setCreatingMatch(false);
    }
  };

  const getRoomValues = (m: TournamentMatch) =>
    roomEdits[m.id] ?? { roomId: m.roomId || '', roomPass: m.roomPass || '' };

  const handleSaveRoom = async (m: TournamentMatch) => {
    const vals = getRoomValues(m);
    setBusyId(`room-${m.id}`);
    try {
      await updateDoc(doc(db, 'matches', m.id), {
        roomId: vals.roomId.trim(),
        roomPass: vals.roomPass.trim(),
      }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `matches/${m.id}`)
      );
      onToast('Room ID & Password updated live!', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to update room details.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreditWinnings = async (uid: string, ign: string, matchTitle: string) => {
    const amount = Math.floor(Number(winCoinInputs[uid] || 0));
    if (!amount || amount <= 0) {
      onToast('Enter valid winning coins to credit.', 'error');
      return;
    }

    setBusyId(`win-${uid}`);
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', uid);
        const uSnap = await tx.get(userRef);
        if (!uSnap.exists()) throw new Error('Player account not found.');
        const curBal = Number(uSnap.data().walletBalance || 0);
        tx.update(userRef, { walletBalance: curBal + amount });
        tx.set(doc(collection(db, 'transactions')), {
          uid,
          type: 'Match Winning',
          amount,
          isCredit: true,
          status: 'Paid',
          description: `Winnings for ${matchTitle} (${ign})`,
          createdAt: serverTimestamp(),
        });
      });

      setWinCoinInputs((prev) => ({ ...prev, [uid]: '' }));
      onToast(`Credited ${amount} Coins to ${ign}!`, 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to credit winnings.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // ==================== 5. SETTINGS ====================
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await setDoc(
        doc(db, 'settings', 'general'),
        {
          appName: settingsForm.appName.trim() || 'KryoFrag Esports',
          whatsappChannel: settingsForm.whatsappChannel.trim(),
          whatsappSupport: settingsForm.whatsappSupport.trim(),
          socialLink: settingsForm.socialLink.trim(),
          noticeBanner: settingsForm.noticeBanner.trim(),
          rules: settingsForm.rules.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, 'settings/general')
      );
      onToast('App settings saved & applied live!', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to save settings.', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const pendingDeposits = deposits.filter((d) => d.status === 'Pending');
  const recentDeposits = deposits.filter((d) => d.status !== 'Pending').slice(0, 10);
  const pendingWithdrawals = withdrawals.filter((w) => w.status === 'Pending');
  const recentWithdrawals = withdrawals.filter((w) => w.status !== 'Pending').slice(0, 10);
  const filteredUsers = userSearch.trim()
    ? users.filter((u) => {
        const term = userSearch.trim().toLowerCase();
        return (
          (u.email || '').toLowerCase().includes(term) ||
          (u.ign || '').toLowerCase().includes(term) ||
          (u.mobileNumber || '').toLowerCase().includes(term)
        );
      })
    : users;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-gaming text-2xl font-bold uppercase text-[#00FF88]">
            Admin Control Center
          </h2>
          <p className="text-xs text-slate-400">Authorized Access Only · Super Admin</p>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {ADMIN_SUBTABS.map((t) => {
          const active = subTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider shrink-0 whitespace-nowrap transition ${
                active
                  ? 'bg-[#00FF88] text-[#0B0E14]'
                  : 'bg-[#151A23] text-slate-400 border border-white/10 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 1. DEPOSITS */}
      {subTab === 'deposits' && (
        <div className="space-y-3">
          {pendingDeposits.length === 0 ? (
            <div className="card-surface rounded-2xl p-6 text-center text-xs text-slate-400">
              No pending UTR deposits!
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-400 tabular-nums">
                Pending ({pendingDeposits.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingDeposits.map((d) => (
                  <div
                    key={d.id}
                    className="card-surface rounded-2xl p-4 space-y-3 border border-amber-500/35"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{d.email}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formatTimestamp(d.createdAt)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-gaming text-xl font-bold text-[#00FF88] tabular-nums">
                          ₹{Number(d.amount || 0)}
                        </span>
                        <span className="block text-[11px] font-bold uppercase text-amber-400">
                          {d.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0B0E14] border border-white/10">
                      <span className="text-xs text-slate-400 truncate">
                        UTR:{' '}
                        <code className="text-white font-mono-code font-bold">{d.utr}</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(d.utr, 'UTR copied!')}
                        className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#151A23] text-[11px] font-semibold text-[#00FF88] border border-[#00FF88]/30 inline-flex items-center gap-1 shrink-0"
                      >
                        <Copy className="w-3 h-3" />
                        Copy UTR
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busyId === d.id}
                        onClick={() => handleApproveDeposit(d)}
                        className="min-h-[42px] py-2 rounded-xl bg-[#00FF88] text-[#0B0E14] text-xs font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === d.id}
                        onClick={() => handleRejectDeposit(d)}
                        className="min-h-[42px] py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold uppercase tracking-wider hover:bg-red-500/25 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentDeposits.length > 0 && (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Recent History
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recentDeposits.map((d) => (
                  <div
                    key={d.id}
                    className="card-surface rounded-2xl p-4 space-y-2 border border-white/5 opacity-85"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{d.email}</p>
                        <p className="text-[11px] text-slate-400">
                          UTR: <span className="font-mono-code">{d.utr}</span> ·{' '}
                          {formatTimestamp(d.createdAt)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-gaming text-lg font-bold text-[#00FF88] tabular-nums">
                          ₹{Number(d.amount || 0)}
                        </span>
                        <span
                          className={`block text-[11px] font-bold uppercase ${
                            d.status === 'Approved' ? 'text-[#00FF88]' : 'text-red-400'
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. WITHDRAWALS */}
      {subTab === 'withdrawals' && (
        <div className="space-y-3">
          {pendingWithdrawals.length === 0 ? (
            <div className="card-surface rounded-2xl p-6 text-center text-xs text-slate-400">
              No pending withdrawal requests!
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-[#FF5500] tabular-nums">
                Pending ({pendingWithdrawals.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingWithdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="card-surface rounded-2xl p-4 space-y-3 border border-[#FF5500]/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{w.email}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {formatTimestamp(w.createdAt)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-gaming text-xl font-bold text-[#FF5500] tabular-nums">
                          ₹{Number(w.amount || 0)}
                        </span>
                        <span className="block text-[11px] font-bold uppercase text-amber-400">
                          {w.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0B0E14] border border-white/10">
                      <span className="text-xs text-slate-400 truncate">
                        UPI:{' '}
                        <code className="text-white font-mono-code font-bold">{w.upiId}</code>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(w.upiId, 'User UPI ID copied!')}
                        className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#151A23] text-[11px] font-semibold text-[#00FF88] border border-[#00FF88]/30 inline-flex items-center gap-1 shrink-0"
                      >
                        <Copy className="w-3 h-3" />
                        Copy UPI
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busyId === w.id}
                        onClick={() => handleMarkWithdrawalPaid(w)}
                        className="min-h-[42px] py-2 rounded-xl bg-[#00FF88] text-[#0B0E14] text-xs font-bold uppercase tracking-wider hover:brightness-110 disabled:opacity-50"
                      >
                        Mark Paid
                      </button>
                      <button
                        type="button"
                        disabled={busyId === w.id}
                        onClick={() => handleRefundWithdrawal(w)}
                        className="min-h-[42px] py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold uppercase tracking-wider hover:bg-red-500/25 disabled:opacity-50"
                      >
                        Reject &amp; Refund
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentWithdrawals.length > 0 && (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Recent History
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {recentWithdrawals.map((w) => (
                  <div
                    key={w.id}
                    className="card-surface rounded-2xl p-4 space-y-2 border border-white/5 opacity-85"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{w.email}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {w.upiId} · {formatTimestamp(w.createdAt)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-gaming text-lg font-bold text-[#FF5500] tabular-nums">
                          ₹{Number(w.amount || 0)}
                        </span>
                        <span
                          className={`block text-[11px] font-bold uppercase ${
                            w.status === 'Paid' ? 'text-[#00FF88]' : 'text-red-400'
                          }`}
                        >
                          {w.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. USERS & SPECIAL COINS */}
      {subTab === 'users' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search user by email, IGN, or mobile..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-[#151A23] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88]"
            />
          </div>

          {filteredUsers.length === 0 ? (
            <div className="card-surface rounded-2xl p-6 text-center text-xs text-slate-400">
              No users match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredUsers.map((u) => (
                <div key={u.id} className="card-surface rounded-2xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-semibold text-white truncate">{u.email}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
                        <span>
                          IGN:{' '}
                          <span className="font-semibold text-[#00FF88]">
                            {u.ign || 'Not set'}
                          </span>
                        </span>
                        <span aria-hidden="true" className="text-slate-600">
                          ·
                        </span>
                        <span className="tabular-nums">
                          Mobile:{' '}
                          <span className="font-mono-code text-slate-200">
                            {u.mobileNumber || 'Not set'}
                          </span>
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono-code truncate">
                        UID: {u.id}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-gaming text-xl font-bold text-[#00FF88] tabular-nums">
                        {Number(u.walletBalance || 0)}
                      </span>
                      <span className="block text-[11px] text-slate-400 uppercase">Coins</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      placeholder="Coins"
                      value={userCoinInputs[u.id] || ''}
                      onChange={(e) =>
                        setUserCoinInputs((prev) => ({ ...prev, [u.id]: e.target.value }))
                      }
                      className="w-24 min-h-[40px] px-3 py-1.5 rounded-xl bg-[#0B0E14] border border-white/10 text-xs text-white tabular-nums focus:outline-none focus:border-[#00FF88]"
                    />
                    <button
                      type="button"
                      disabled={busyId === `user-${u.id}`}
                      onClick={() => handleUserBalanceAdjust(u.id, 'add')}
                      className="flex-1 min-h-[40px] py-2 px-2.5 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-[11px] font-bold uppercase hover:bg-[#00FF88] hover:text-[#0B0E14] transition whitespace-nowrap disabled:opacity-50"
                    >
                      + Special Coins
                    </button>
                    <button
                      type="button"
                      disabled={busyId === `user-${u.id}`}
                      onClick={() => handleUserBalanceAdjust(u.id, 'deduct')}
                      className="min-h-[40px] py-2 px-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-[11px] font-bold uppercase hover:bg-red-500/25 transition whitespace-nowrap disabled:opacity-50"
                    >
                      - Deduct
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. MANAGE MATCHES */}
      {subTab === 'matches' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleCreateMatch}
            className="lg:col-span-5 card-surface rounded-2xl p-4 sm:p-5 space-y-3 border border-[#00FF88]/25"
          >
            <h3 className="font-gaming text-lg font-bold uppercase text-[#00FF88]">
              + Create New Match
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Match Title</label>
                <input
                  type="text"
                  required
                  value={cmTitle}
                  onChange={(e) => setCmTitle(e.target.value)}
                  placeholder="e.g., Bermuda Rush #12"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Map</label>
                <input
                  type="text"
                  required
                  value={cmMap}
                  onChange={(e) => setCmMap(e.target.value)}
                  placeholder="Bermuda / Purgatory"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Match Type</label>
                <select
                  value={cmType}
                  onChange={(e) => setCmType(e.target.value as 'Solo' | 'Duo' | 'Squad')}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                >
                  <option value="Solo">Solo</option>
                  <option value="Duo">Duo</option>
                  <option value="Squad">Squad</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Date &amp; Time</label>
                <input
                  type="datetime-local"
                  required
                  value={cmDateTime}
                  onChange={(e) => setCmDateTime(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Entry Fee (Coins)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={cmEntry}
                  onChange={(e) => setCmEntry(e.target.value)}
                  placeholder="10"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white tabular-nums focus:outline-none focus:border-[#00FF88]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Per Kill (Coins)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={cmPerKill}
                  onChange={(e) => setCmPerKill(e.target.value)}
                  placeholder="5"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white tabular-nums focus:outline-none focus:border-[#00FF88]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Booyah Prize (Coins)</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={cmBooyah}
                  onChange={(e) => setCmBooyah(e.target.value)}
                  placeholder="100"
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white tabular-nums focus:outline-none focus:border-[#00FF88]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Max Slots</label>
                <input
                  type="number"
                  min={2}
                  max={100}
                  required
                  value={cmSlots}
                  onChange={(e) => setCmSlots(e.target.value)}
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white tabular-nums focus:outline-none focus:border-[#00FF88]"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={creatingMatch}
              className="w-full min-h-[46px] py-2.5 rounded-xl bg-[#00FF88] text-[#0B0E14] font-gaming font-bold text-base uppercase tracking-wider hover:brightness-110 transition disabled:opacity-60"
            >
              {creatingMatch ? 'Publishing...' : 'Publish Match'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            <h3 className="font-gaming text-lg font-bold uppercase text-white">
              Existing Matches ({matches.length})
            </h3>
            {matches.length === 0 ? (
              <div className="card-surface rounded-2xl p-6 text-center text-xs text-slate-400">
                No matches created yet.
              </div>
            ) : (
              matches.map((m) => {
                const roomVals = getRoomValues(m);
                return (
                  <div key={m.id} className="card-surface rounded-2xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-400">
                          <span className="font-semibold text-[#FF5500]">{m.type}</span> ·{' '}
                          {m.map} · {formatMatchDate(m.dateTime)}
                        </div>
                        <h4 className="font-gaming text-lg font-bold uppercase text-white mt-0.5">
                          {m.title}
                        </h4>
                        <p className="text-xs text-slate-400 tabular-nums">
                          {Number(m.joinedCount || 0)}/{Number(m.maxSlots || 48)} Joined
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onRequestDeleteMatch(m.id, m.title)}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold uppercase hover:bg-red-500/25 inline-flex items-center gap-1 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Room ID"
                        value={roomVals.roomId}
                        onChange={(e) =>
                          setRoomEdits((prev) => ({
                            ...prev,
                            [m.id]: { ...roomVals, roomId: e.target.value },
                          }))
                        }
                        className="min-h-[40px] px-3 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-[#00FF88]"
                      />
                      <input
                        type="text"
                        placeholder="Room Password"
                        value={roomVals.roomPass}
                        onChange={(e) =>
                          setRoomEdits((prev) => ({
                            ...prev,
                            [m.id]: { ...roomVals, roomPass: e.target.value },
                          }))
                        }
                        className="min-h-[40px] px-3 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-[#00FF88]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busyId === `room-${m.id}`}
                        onClick={() => handleSaveRoom(m)}
                        className="min-h-[40px] py-2 rounded-xl bg-[#00FF88] text-[#0B0E14] text-xs font-bold uppercase hover:brightness-110 disabled:opacity-50"
                      >
                        Save Room ID/Pass
                      </button>
                      <button
                        type="button"
                        onClick={() => setPlayersModalMatchId(m.id)}
                        className="min-h-[40px] py-2 rounded-xl bg-[#1C222E] border border-white/15 text-white text-xs font-bold uppercase hover:border-[#00FF88] inline-flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Players ({Number(m.joinedCount || 0)}) &amp; Credit
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 5. APP SETTINGS */}
      {subTab === 'settings' && (
        <form
          onSubmit={handleSaveSettings}
          className="max-w-2xl card-surface rounded-2xl p-5 space-y-3.5"
        >
          <h3 className="font-gaming text-lg font-bold uppercase text-white">
            General App Settings
          </h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1">App Name</label>
            <input
              type="text"
              required
              value={settingsForm.appName}
              onChange={(e) => setSettingsForm((s) => ({ ...s, appName: e.target.value }))}
              placeholder="KryoFrag Esports"
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">WhatsApp Channel Link</label>
            <input
              type="url"
              value={settingsForm.whatsappChannel}
              onChange={(e) =>
                setSettingsForm((s) => ({ ...s, whatsappChannel: e.target.value }))
              }
              placeholder="https://whatsapp.com/channel/..."
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              WhatsApp Customer Support Link or Phone Number
            </label>
            <input
              type="text"
              value={settingsForm.whatsappSupport}
              onChange={(e) =>
                setSettingsForm((s) => ({ ...s, whatsappSupport: e.target.value }))
              }
              placeholder="https://wa.me/919876543210 or 919876543210"
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Telegram / YouTube Link</label>
            <input
              type="url"
              value={settingsForm.socialLink}
              onChange={(e) => setSettingsForm((s) => ({ ...s, socialLink: e.target.value }))}
              placeholder="https://t.me/... or https://youtube.com/..."
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Scrolling Notice Banner Text
            </label>
            <input
              type="text"
              required
              value={settingsForm.noticeBanner}
              onChange={(e) => setSettingsForm((s) => ({ ...s, noticeBanner: e.target.value }))}
              placeholder="Announcement text..."
              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Tournament Rules Text</label>
            <textarea
              rows={5}
              required
              value={settingsForm.rules}
              onChange={(e) => setSettingsForm((s) => ({ ...s, rules: e.target.value }))}
              placeholder="Enter tournament rules..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
            />
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="w-full min-h-[46px] py-2.5 rounded-xl bg-[#00FF88] text-[#0B0E14] font-gaming font-bold text-base uppercase tracking-wider hover:brightness-110 transition disabled:opacity-60"
          >
            {savingSettings ? 'Saving...' : 'Save App Settings'}
          </button>
        </form>
      )}

      {/* ADMIN PLAYERS & CREDIT MODAL */}
      {activePlayersModalMatch && (
        <div className="fixed inset-0 z-[75] modal-backdrop flex items-center justify-center p-4">
          <div className="w-full max-w-md card-surface rounded-2xl p-5 border border-[#00FF88]/30 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#00FF88]">
                  Participants &amp; Payouts
                </span>
                <h3 className="font-gaming text-xl font-bold uppercase text-white">
                  {activePlayersModalMatch.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPlayersModalMatchId(null)}
                aria-label="Close players modal"
                className="min-w-[36px] min-h-[36px] rounded-lg bg-[#0B0E14] text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 overflow-y-auto flex-1 pr-1">
              {!activePlayersModalMatch.participants?.length ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No players have joined this match yet.
                </p>
              ) : (
                activePlayersModalMatch.participants.map((p, idx) => (
                  <div
                    key={p.uid}
                    className="p-3 rounded-xl bg-[#0B0E14] border border-white/10 space-y-2"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#00FF88] truncate">
                        #{idx + 1} IGN: {p.ign}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">{p.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="Win Coins"
                        value={winCoinInputs[p.uid] || ''}
                        onChange={(e) =>
                          setWinCoinInputs((prev) => ({ ...prev, [p.uid]: e.target.value }))
                        }
                        className="flex-1 min-h-[38px] px-3 py-1.5 rounded-lg bg-[#151A23] border border-white/10 text-xs text-white tabular-nums focus:outline-none focus:border-[#00FF88]"
                      />
                      <button
                        type="button"
                        disabled={busyId === `win-${p.uid}`}
                        onClick={() =>
                          handleCreditWinnings(p.uid, p.ign, activePlayersModalMatch.title)
                        }
                        className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#00FF88] text-[#0B0E14] text-[11px] font-bold uppercase hover:brightness-110 shrink-0 disabled:opacity-50"
                      >
                        + Credit Win
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
