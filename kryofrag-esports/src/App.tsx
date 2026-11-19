/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  Crosshair,
  HelpCircle,
  Loader2,
  Settings,
  Trophy,
  Wallet,
} from 'lucide-react';
import {
  ADMIN_EMAIL,
  auth,
  db,
  handleFirestoreError,
  OperationType,
  testConnection,
} from './lib/firebase';
import { getMillis } from './lib/formatters';
import type {
  AppSettings,
  AppTab,
  DepositRequest,
  MatchTypeFilter,
  ToastItem,
  TournamentMatch,
  UserProfile,
  WalletTransaction,
  WithdrawalRequest,
} from './types/esports';
import { AuthScreen } from './components/AuthScreen';
import { MatchesTab } from './components/MatchesTab';
import { WalletTab } from './components/WalletTab';
import { MyMatchesTab } from './components/MyMatchesTab';
import { SupportTab } from './components/SupportTab';
import { AdminTab } from './components/AdminTab';
import { ConfirmModal, JoinIgnModal, LowBalanceModal } from './components/Modals';

const DEFAULT_SETTINGS: AppSettings = {
  appName: 'KryoFrag Esports',
  whatsappChannel: 'https://whatsapp.com',
  whatsappSupport: 'https://wa.me/',
  socialLink: 'https://youtube.com',
  noticeBanner:
    'Welcome to KryoFrag Esports! Join daily Free Fire Solo, Duo & Squad tournaments and win instant rewards!',
  rules:
    '1. No hacking, teaming, or emulator usage allowed.\n2. Enter your exact Free Fire In-Game Name (IGN) when joining.\n3. Room ID & Password will be shared 10 minutes before match start.\n4. Minimum level 30+ required in Free Fire to avoid kick.',
};

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [userIgn, setUserIgn] = useState<string>('');
  const [userMobileNumber, setUserMobileNumber] = useState<string>('');

  const [activeTab, setActiveTab] = useState<AppTab>('matches');
  const [matchFilter, setMatchFilter] = useState<MatchTypeFilter>('All');

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  // Admin-only collections
  const [adminDeposits, setAdminDeposits] = useState<DepositRequest[]>([]);
  const [adminWithdrawals, setAdminWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);

  // Modals & Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [lowBalanceCoins, setLowBalanceCoins] = useState<number | null>(null);
  const [pendingJoinMatch, setPendingJoinMatch] = useState<TournamentMatch | null>(null);
  const [joinIgn, setJoinIgn] = useState('');
  const [joiningMatch, setJoiningMatch] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  const isAdmin = Boolean(
    currentUser?.email && currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'success') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    },
    []
  );

  // Sync document title with appName
  useEffect(() => {
    document.title = `${settings.appName || 'KryoFrag Esports'} - Free Fire Tournaments`;
  }, [settings.appName]);

  // Initial Firestore connectivity verification
  useEffect(() => {
    testConnection();
  }, []);

  // Auth listener & user profile bootstrap
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setCurrentUser(null);
        setWalletBalance(0);
        setUserIgn('');
        setUserMobileNumber('');
        setMatches([]);
        setTransactions([]);
        setAdminDeposits([]);
        setAdminWithdrawals([]);
        setAdminUsers([]);
        setAuthReady(true);
        return;
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);
        if (!snap.exists()) {
          await setDoc(
            userRef,
            {
              email: user.email,
              walletBalance: 0,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        }
      } catch (err) {
        console.error('User profile check error:', err);
      }

      setCurrentUser(user);
      setAuthReady(true);
    });

    return () => unsubAuth();
  }, []);

  // Real-time settings listener (public/shared)
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'general'),
      (snap) => {
        if (snap.exists()) {
          setSettings((prev) => ({ ...prev, ...(snap.data() as Partial<AppSettings>) }));
        }
      },
      (err) => {
        console.error('Settings listener error:', err);
      }
    );
    return () => unsub();
  }, []);

  // Real-time user data, matches, and transactions listeners (when authenticated)
  useEffect(() => {
    if (!currentUser) return;

    const unsubUser = onSnapshot(
      doc(db, 'users', currentUser.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setWalletBalance(Number(data.walletBalance || 0));
          setUserIgn(typeof data.ign === 'string' ? data.ign : '');
          setUserMobileNumber(
            typeof data.mobileNumber === 'string' ? data.mobileNumber : ''
          );
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
      }
    );

    const unsubMatches = onSnapshot(
      collection(db, 'matches'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as TournamentMatch)
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setMatches(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'matches');
      }
    );

    const txQuery = query(
      collection(db, 'transactions'),
      where('uid', '==', currentUser.uid)
    );
    const unsubTx = onSnapshot(
      txQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as WalletTransaction)
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setTransactions(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'transactions');
      }
    );

    return () => {
      unsubUser();
      unsubMatches();
      unsubTx();
    };
  }, [currentUser]);

  // Admin-only listeners
  useEffect(() => {
    if (!currentUser || !isAdmin) {
      if (activeTab === 'admin') setActiveTab('matches');
      return;
    }

    const unsubDeposits = onSnapshot(
      collection(db, 'deposits'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as DepositRequest)
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setAdminDeposits(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'deposits')
    );

    const unsubWithdrawals = onSnapshot(
      collection(db, 'withdrawals'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as WithdrawalRequest)
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setAdminWithdrawals(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'withdrawals')
    );

    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as UserProfile)
          .sort((a, b) => (a.email || '').localeCompare(b.email || ''));
        setAdminUsers(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    return () => {
      unsubDeposits();
      unsubWithdrawals();
      unsubUsers();
    };
  }, [currentUser, isAdmin, activeTab]);

  const handleSwitchTab = (tab: AppTab) => {
    if (tab === 'admin' && !isAdmin) return;
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Strict Join Flow
  const handleJoinMatchClick = (match: TournamentMatch) => {
    const entryFee = Number(match.entryFee || 0);
    if (walletBalance < entryFee) {
      setLowBalanceCoins(entryFee);
      return;
    }
    if (Number(match.joinedCount || 0) >= Number(match.maxSlots || 48)) {
      showToast('Sorry, all slots are full!', 'error');
      return;
    }
    setJoinIgn(userIgn || '');
    setPendingJoinMatch(match);
  };

  const handleConfirmJoinMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingJoinMatch || !currentUser) return;

    const ign = joinIgn.trim();
    if (!ign) {
      showToast('Please enter your Free Fire In-Game Name (IGN).', 'error');
      return;
    }

    setJoiningMatch(true);
    const matchToJoin = pendingJoinMatch;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const matchRef = doc(db, 'matches', matchToJoin.id);
      const txRef = doc(collection(db, 'transactions'));

      await runTransaction(db, async (tx) => {
        const uSnap = await tx.get(userRef);
        const mSnap = await tx.get(matchRef);

        if (!uSnap.exists() || !mSnap.exists()) {
          throw new Error('Match or user data not found.');
        }

        const userBal = Number(uSnap.data().walletBalance || 0);
        const mData = mSnap.data();
        const entryFee = Number(mData.entryFee || 0);
        const joinedCount = Number(mData.joinedCount || 0);
        const maxSlots = Number(mData.maxSlots || 48);
        const participants = Array.isArray(mData.participants) ? mData.participants : [];

        if (participants.some((p: { uid: string }) => p.uid === currentUser.uid)) {
          throw new Error('You have already joined this match!');
        }
        if (joinedCount >= maxSlots) {
          throw new Error('Match slots are now full!');
        }
        if (userBal < entryFee) {
          throw new Error(`Insufficient Balance! You need at least ${entryFee} coins to join.`);
        }

        const participantObj = {
          uid: currentUser.uid,
          email: currentUser.email || '',
          ign,
          joinedAt: new Date().toISOString(),
        };

        tx.update(userRef, { walletBalance: userBal - entryFee });
        tx.update(matchRef, {
          joinedCount: joinedCount + 1,
          participants: [...participants, participantObj],
        });
        tx.set(txRef, {
          uid: currentUser.uid,
          type: 'Match Entry',
          amount: entryFee,
          isCredit: false,
          status: 'Completed',
          description: `Joined: ${mData.title} (IGN: ${ign})`,
          createdAt: serverTimestamp(),
        });
      });

      setPendingJoinMatch(null);
      setJoinIgn('');
      showToast("Successfully joined! Check 'My Matches' for Room details.", 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to join match.', 'error');
    } finally {
      setJoiningMatch(false);
    }
  };

  const handleConfirmDeleteMatch = async () => {
    if (!deleteTarget || !isAdmin) return;
    const targetId = deleteTarget.id;
    setDeleteTarget(null);
    try {
      await deleteDoc(doc(db, 'matches', targetId)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `matches/${targetId}`)
      );
      showToast('Match deleted.', 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete match.', 'error');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    showToast('Logged out successfully.', 'info');
  };

  const navItems: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: 'matches', label: 'Matches', icon: <Crosshair className="w-5 h-5" /> },
    { id: 'wallet', label: 'Wallet', icon: <Wallet className="w-5 h-5" /> },
    { id: 'my-matches', label: 'My Matches', icon: <Trophy className="w-5 h-5" /> },
    { id: 'support', label: 'Support', icon: <HelpCircle className="w-5 h-5" /> },
    ...(isAdmin
      ? [{ id: 'admin' as AppTab, label: 'Admin', icon: <Settings className="w-5 h-5" /> }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100">
      {/* TOAST CONTAINER */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-md flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => {
          const cls =
            t.type === 'success'
              ? 'bg-[#151A23] border-[#00FF88] text-[#00FF88]'
              : t.type === 'error'
                ? 'bg-[#151A23] border-red-500 text-red-400'
                : 'bg-[#151A23] border-[#FF5500] text-[#FF5500]';
          return (
            <div
              key={t.id}
              className={`pointer-events-auto px-4 py-3 rounded-xl border text-xs font-semibold shadow-2xl ${cls}`}
            >
              {t.message}
            </div>
          );
        })}
      </div>

      {/* LOADING SCREEN */}
      {!authReady ? (
        <div className="fixed inset-0 z-[90] bg-[#0B0E14] flex flex-col items-center justify-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#151A23] border border-[#00FF88]/40 flex items-center justify-center glow-green">
            <Loader2 className="w-7 h-7 text-[#00FF88] animate-spin" />
          </div>
          <p className="font-gaming text-lg tracking-widest uppercase text-[#00FF88]">
            Initializing Arena...
          </p>
        </div>
      ) : !currentUser ? (
        <AuthScreen appName={settings.appName || 'KryoFrag Esports'} onToast={showToast} />
      ) : (
        <div className="min-h-screen flex flex-col">
          {/* STICKY TOP BAR (3-zone contract on desktop, compact bar on mobile) */}
          <header className="sticky top-0 z-40 bg-[#0B0E14]/95 backdrop-blur-md border-b border-white/10">
            <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-6">
              <button
                type="button"
                onClick={() => handleSwitchTab('matches')}
                className="font-gaming text-xl font-bold uppercase tracking-wide text-white whitespace-nowrap shrink-0 hover:text-[#00FF88] transition"
              >
                {settings.appName || 'KryoFrag Esports'}
              </button>

              {/* Desktop Navigation Links */}
              <nav className="hidden md:flex items-center gap-6">
                {navItems.map((item) => {
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSwitchTab(item.id)}
                      className={`text-sm font-medium whitespace-nowrap shrink-0 py-1 border-b-2 transition ${
                        active
                          ? 'text-[#00FF88] border-[#00FF88]'
                          : 'text-slate-400 border-transparent hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </nav>

              {/* Primary Action: Live Coin Balance */}
              <button
                type="button"
                onClick={() => handleSwitchTab('wallet')}
                className="min-h-[38px] flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#151A23] border border-[#00FF88]/40 hover:border-[#00FF88] transition shrink-0 glow-green-sm whitespace-nowrap"
              >
                <span className="text-xs font-bold text-[#00FF88]">₹</span>
                <span className="font-gaming text-base font-bold text-white tabular-nums">
                  {walletBalance}
                </span>
                <span className="text-[11px] text-slate-400 font-semibold uppercase">Coins</span>
              </button>
            </div>
          </header>

          {/* MAIN CONTENT */}
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 pt-4 pb-24 md:pb-12 space-y-5">
            {/* Scrolling Notice Banner */}
            <div className="rounded-xl bg-gradient-to-r from-[#FF5500]/15 via-[#151A23] to-[#00FF88]/15 border border-white/10 px-3 py-2 flex items-center gap-2.5">
              <span className="px-2 py-0.5 rounded bg-[#FF5500] text-[10px] font-bold uppercase tracking-wider text-white shrink-0">
                Notice
              </span>
              <div className="marquee-wrapper flex-1 text-xs text-slate-200 font-medium">
                <span className="marquee-track">{settings.noticeBanner}</span>
              </div>
            </div>

            {activeTab === 'matches' && (
              <MatchesTab
                matches={matches}
                currentUserId={currentUser.uid}
                filter={matchFilter}
                onFilterChange={setMatchFilter}
                onJoinClick={handleJoinMatchClick}
              />
            )}

            {activeTab === 'wallet' && (
              <WalletTab
                userId={currentUser.uid}
                userEmail={currentUser.email || ''}
                walletBalance={walletBalance}
                transactions={transactions}
                onToast={showToast}
              />
            )}

            {activeTab === 'my-matches' && (
              <MyMatchesTab
                matches={matches}
                currentUserId={currentUser.uid}
                onToast={showToast}
              />
            )}

            {activeTab === 'support' && (
              <SupportTab
                userId={currentUser.uid}
                userEmail={currentUser.email || ''}
                userIgn={userIgn}
                userMobileNumber={userMobileNumber}
                settings={settings}
                onLogout={handleLogout}
                onToast={showToast}
              />
            )}

            {activeTab === 'admin' && isAdmin && (
              <AdminTab
                deposits={adminDeposits}
                withdrawals={adminWithdrawals}
                users={adminUsers}
                matches={matches}
                settings={settings}
                onRequestDeleteMatch={(id, title) => setDeleteTarget({ id, title })}
                onToast={showToast}
              />
            )}
          </main>

          {/* MOBILE FIXED BOTTOM NAVIGATION */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F131B]/95 backdrop-blur-lg border-t border-white/10 px-2 py-1">
            <div
              className={`grid gap-1 ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}
            >
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSwitchTab(item.id)}
                    className={`min-h-[48px] flex flex-col items-center justify-center py-1 rounded-xl transition ${
                      active ? 'text-[#00FF88]' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span className="text-[10px] font-semibold mt-0.5 whitespace-nowrap">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* MODALS */}
          <LowBalanceModal
            open={lowBalanceCoins !== null}
            requiredCoins={lowBalanceCoins || 0}
            onClose={() => setLowBalanceCoins(null)}
            onGoToWallet={() => {
              setLowBalanceCoins(null);
              handleSwitchTab('wallet');
            }}
          />

          <JoinIgnModal
            match={pendingJoinMatch}
            ign={joinIgn}
            submitting={joiningMatch}
            onIgnChange={setJoinIgn}
            onCancel={() => {
              setPendingJoinMatch(null);
              setJoinIgn('');
            }}
            onSubmit={handleConfirmJoinMatch}
          />

          <ConfirmModal
            open={deleteTarget !== null}
            title="Delete Match"
            message={`Permanently delete "${deleteTarget?.title || ''}"? This cannot be undone.`}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={handleConfirmDeleteMatch}
          />
        </div>
      )}
    </div>
  );
}
