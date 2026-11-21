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
  Award,
  Crosshair,
  Disc,
  Gift,
  Headphones,
  HelpCircle,
  Loader2,
  LogOut,
  Settings,
  ShieldAlert,
  Trophy,
  Wallet,
  Wrench,
} from 'lucide-react';
import {
  ADMIN_EMAIL,
  ADMIN_UPI_ID,
  auth,
  db,
  handleFirestoreError,
  OperationType,
  testConnection,
} from './lib/firebase';
import { formatSupportHref, generateReferralCode, getMillis } from './lib/formatters';
import type {
  AppSettings,
  AppTab,
  BannerItem,
  ComplaintTicket,
  DepositRequest,
  GlobalSettings,
  MatchTypeFilter,
  PromoCodeItem,
  ReferralBonusSettings,
  SpinWheelSettings,
  ToastItem,
  TournamentMatch,
  UserProfile,
  WalletTransaction,
  WhatsappPopupSettings,
  WithdrawalRequest,
} from './types/esports';
import { AuthScreen } from './components/AuthScreen';
import { MatchesTab } from './components/MatchesTab';
import { WalletTab } from './components/WalletTab';
import { MyMatchesTab } from './components/MyMatchesTab';
import { LeaderboardTab } from './components/LeaderboardTab';
import { GiftsTab } from './components/GiftsTab';
import { SupportTab } from './components/SupportTab';
import { AdminTab } from './components/AdminTab';
import { BannerStrip } from './components/BannerStrip';
import { SpinWheelModal } from './components/SpinWheelModal';
import {
  AntiCheatRulesModal,
  ConfirmModal,
  ForceUpdateModal,
  JoinIgnModal,
  LowBalanceModal,
  MatchLeaderboardModal,
  WhatsappChannelPopupModal,
} from './components/Modals';

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

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  maintenanceMode: false,
  maintenanceMessage:
    'Server is currently under maintenance for upgrades. Please check back shortly!',
  forceUpdateEnabled: false,
  forceUpdateUrl: '',
  forceUpdateMessage:
    'A mandatory new version of KryoFrag Esports is available. Update now to continue playing.',
  upiId: ADMIN_UPI_ID,
  upiQrUrl: '',
  whatsappSupport: '',
  telegramLink: '',
  instagramLink: '',
  minWithdrawal: 20,
  antiCheatRules:
    '1. No Emulator, Hacks, Configs, or Teaming allowed.\n2. Winning / Kill screenshot is mandatory for payout disputes.\n3. Enter your exact Free Fire In-Game Name (IGN) before joining.',
};

const DEFAULT_WHATSAPP_POPUP: WhatsappPopupSettings = {
  enabled: false,
  message: 'Join this channel for offers and free matches',
  channelUrl: '',
};

const DEFAULT_SPIN_SETTINGS: SpinWheelSettings = {
  enabled: true,
  segments: [
    { id: 's1', label: '0 Coins', coins: 0, weight: 35 },
    { id: 's2', label: '1 Coin', coins: 1, weight: 30 },
    { id: 's3', label: '2 Coins', coins: 2, weight: 20 },
    { id: 's4', label: '5 Coins', coins: 5, weight: 10 },
    { id: 's5', label: '10 Coins', coins: 10, weight: 5 },
  ],
};

const DEFAULT_REFERRAL_BONUS: ReferralBonusSettings = {
  referrerCoins: 3,
  refereeCoins: 3,
  firstDepositBonusType: 'percentage',
  firstDepositBonusValue: 10,
};

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [userIgn, setUserIgn] = useState<string>('');
  const [userMobileNumber, setUserMobileNumber] = useState<string>('');
  const [userFfUid, setUserFfUid] = useState<string>('');
  const [userFfUidLocked, setUserFfUidLocked] = useState<boolean>(false);
  const [userBlocked, setUserBlocked] = useState<boolean>(false);
  const [userReferralCode, setUserReferralCode] = useState<string>('');
  const [userReferredByCode, setUserReferredByCode] = useState<string>('');
  const [userReferralStatus, setUserReferralStatus] = useState<'none' | 'pending' | 'credited'>(
    'none'
  );
  const [userLastSpinTime, setUserLastSpinTime] = useState<number>(0);
  const [userRedeemedPromos, setUserRedeemedPromos] = useState<string[]>([]);

  const [activeTab, setActiveTab] = useState<AppTab>('matches');
  const [matchFilter, setMatchFilter] = useState<MatchTypeFilter>('All');

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS);
  const [whatsappPopup, setWhatsappPopup] = useState<WhatsappPopupSettings>(DEFAULT_WHATSAPP_POPUP);
  const [spinSettings, setSpinSettings] = useState<SpinWheelSettings>(DEFAULT_SPIN_SETTINGS);
  const [referralBonus, setReferralBonus] = useState<ReferralBonusSettings>(DEFAULT_REFERRAL_BONUS);
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [userComplaints, setUserComplaints] = useState<ComplaintTicket[]>([]);

  // Admin-only collections
  const [adminDeposits, setAdminDeposits] = useState<DepositRequest[]>([]);
  const [adminWithdrawals, setAdminWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [adminComplaints, setAdminComplaints] = useState<ComplaintTicket[]>([]);

  // Modals & Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [spinModalOpen, setSpinModalOpen] = useState(false);
  const [lowBalanceCoins, setLowBalanceCoins] = useState<number | null>(null);
  const [antiCheatMatch, setAntiCheatMatch] = useState<TournamentMatch | null>(null);
  const [pendingJoinMatch, setPendingJoinMatch] = useState<TournamentMatch | null>(null);
  const [joinIgn, setJoinIgn] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<number | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [joiningMatch, setJoiningMatch] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [leaderboardMatch, setLeaderboardMatch] = useState<TournamentMatch | null>(null);
  const [waPopupDismissed, setWaPopupDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('kf_wa_popup_dismissed') === '1';
    } catch {
      return false;
    }
  });

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
        setUserFfUid('');
        setUserFfUidLocked(false);
        setUserBlocked(false);
        setUserReferralCode('');
        setUserReferredByCode('');
        setUserReferralStatus('none');
        setUserLastSpinTime(0);
        setUserRedeemedPromos([]);
        setSpinModalOpen(false);
        setBanners([]);
        setMatches([]);
        setTransactions([]);
        setUserComplaints([]);
        setAdminDeposits([]);
        setAdminWithdrawals([]);
        setAdminUsers([]);
        setPromoCodes([]);
        setAdminComplaints([]);
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
              referralCode: generateReferralCode(user.uid),
              referralStatus: 'none',
              hasApprovedDeposit: false,
              redeemedPromoCodes: [],
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
        } else if (!snap.data()?.referralCode) {
          await setDoc(
            userRef,
            { referralCode: generateReferralCode(user.uid) },
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

  // Real-time settings listeners (general, global controls, WhatsApp popup)
  useEffect(() => {
    const unsubGeneral = onSnapshot(
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

    const unsubGlobal = onSnapshot(
      doc(db, 'settings', 'global'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<GlobalSettings>;
          setGlobalSettings({
            ...DEFAULT_GLOBAL_SETTINGS,
            ...data,
            upiId: (data.upiId || '').trim() || ADMIN_UPI_ID,
            minWithdrawal: Math.max(1, Number(data.minWithdrawal || 20)),
            antiCheatRules:
              (data.antiCheatRules || '').trim() || DEFAULT_GLOBAL_SETTINGS.antiCheatRules,
          });
        }
      },
      (err) => {
        console.error('Global settings listener error:', err);
      }
    );

    const unsubWaPopup = onSnapshot(
      doc(db, 'settings', 'whatsappPopup'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<WhatsappPopupSettings>;
          setWhatsappPopup({
            ...DEFAULT_WHATSAPP_POPUP,
            ...data,
            message: (data.message || '').trim() || DEFAULT_WHATSAPP_POPUP.message,
          });
        }
      },
      (err) => {
        console.error('WhatsApp popup listener error:', err);
      }
    );

    const unsubSpin = onSnapshot(
      doc(db, 'settings', 'spinWheel'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<SpinWheelSettings>;
          setSpinSettings({
            enabled: data.enabled !== undefined ? Boolean(data.enabled) : true,
            segments:
              Array.isArray(data.segments) && data.segments.length >= 2
                ? data.segments
                : DEFAULT_SPIN_SETTINGS.segments,
          });
        }
      },
      (err) => {
        console.error('Spin wheel listener error:', err);
      }
    );

    const unsubRefBonus = onSnapshot(
      doc(db, 'settings', 'referralBonus'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<ReferralBonusSettings>;
          setReferralBonus({
            referrerCoins: Math.max(0, Math.floor(Number(data.referrerCoins ?? 3))),
            refereeCoins: Math.max(0, Math.floor(Number(data.refereeCoins ?? 3))),
            firstDepositBonusType:
              data.firstDepositBonusType === 'flat' ? 'flat' : 'percentage',
            firstDepositBonusValue: Math.max(
              0,
              Math.floor(Number(data.firstDepositBonusValue ?? 10))
            ),
          });
        }
      },
      (err) => {
        console.error('Referral bonus listener error:', err);
      }
    );

    return () => {
      unsubGeneral();
      unsubGlobal();
      unsubWaPopup();
      unsubSpin();
      unsubRefBonus();
    };
  }, []);

  // Real-time user data, banners, matches, and transactions listeners (when authenticated)
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
          setUserFfUid(typeof data.ffUid === 'string' ? data.ffUid : '');
          setUserFfUidLocked(Boolean(data.ffUidLocked));
          setUserBlocked(Boolean(data.isBlocked));
          setUserReferralCode(
            typeof data.referralCode === 'string' && data.referralCode
              ? data.referralCode
              : generateReferralCode(currentUser.uid)
          );
          setUserReferredByCode(
            typeof data.referredByCode === 'string' ? data.referredByCode : ''
          );
          setUserReferralStatus(
            data.referralStatus === 'pending' || data.referralStatus === 'credited'
              ? data.referralStatus
              : 'none'
          );
          setUserLastSpinTime(Number(data.lastSpinTime || 0));
          setUserRedeemedPromos(
            Array.isArray(data.redeemedPromoCodes)
              ? (data.redeemedPromoCodes as string[])
              : []
          );
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${currentUser.uid}`);
      }
    );

    const unsubBanners = onSnapshot(
      collection(db, 'banners'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as BannerItem)
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setBanners(list);
      },
      (err) => {
        console.error('Banners listener error:', err);
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

    const complaintsQuery = query(
      collection(db, 'complaints'),
      where('uid', '==', currentUser.uid)
    );
    const unsubUserComplaints = onSnapshot(
      complaintsQuery,
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as ComplaintTicket)
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setUserComplaints(list);
      },
      (err) => {
        console.error('Complaints listener error:', err);
      }
    );

    return () => {
      unsubUser();
      unsubBanners();
      unsubMatches();
      unsubTx();
      unsubUserComplaints();
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

    const unsubPromos = onSnapshot(
      collection(db, 'promoCodes'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as PromoCodeItem)
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setPromoCodes(list);
      },
      (err) => console.error('Promo codes listener error:', err)
    );

    const unsubComplaints = onSnapshot(
      collection(db, 'complaints'),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }) as ComplaintTicket)
          .sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
        setAdminComplaints(list);
      },
      (err) => console.error('Admin complaints listener error:', err)
    );

    return () => {
      unsubDeposits();
      unsubWithdrawals();
      unsubUsers();
      unsubPromos();
      unsubComplaints();
    };
  }, [currentUser, isAdmin, activeTab]);

  const handleSwitchTab = (tab: AppTab) => {
    if (tab === 'admin' && !isAdmin) return;
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Strict Join Flow (Anti-Cheat Rules confirmation -> Join IGN + Slot modal)
  const handleJoinMatchClick = (match: TournamentMatch) => {
    if (match.status === 'Cancelled' || match.status === 'Completed') {
      showToast('This match is no longer open for registration.', 'error');
      return;
    }
    const entryFee = Number(match.entryFee || 0);
    if (walletBalance < entryFee) {
      setLowBalanceCoins(entryFee);
      return;
    }
    if (Number(match.joinedCount || 0) >= Number(match.maxSlots || 48)) {
      showToast('Sorry, all slots are full!', 'error');
      return;
    }
    setAntiCheatMatch(match);
  };

  const handleAgreeAntiCheat = () => {
    if (!antiCheatMatch) return;
    const matchToJoin = antiCheatMatch;
    setAntiCheatMatch(null);
    setJoinIgn(userIgn || '');

    const mode = (matchToJoin.type || 'Solo').toLowerCase();
    const isTeamMode = mode === 'duo' || mode === 'squad';
    if (isTeamMode) {
      const teamSize = mode === 'duo' ? 2 : 4;
      const letters = mode === 'duo' ? ['A', 'B'] : ['A', 'B', 'C', 'D'];
      const maxSlots = Math.max(teamSize, Number(matchToJoin.maxSlots || 48));
      const totalTeams = Math.max(1, Math.ceil(maxSlots / teamSize));
      const participants = Array.isArray(matchToJoin.participants) ? matchToJoin.participants : [];

      let foundTeam = 1;
      let foundSlot = 'A';
      let assigned = false;
      for (let t = 1; t <= totalTeams && !assigned; t++) {
        for (const l of letters) {
          const taken = participants.some(
            (p) => Number(p.teamNumber) === t && (p.slotLetter || '').toUpperCase() === l
          );
          if (!taken) {
            foundTeam = t;
            foundSlot = l;
            assigned = true;
            break;
          }
        }
      }
      setSelectedTeam(foundTeam);
      setSelectedSlot(foundSlot);
    } else {
      setSelectedTeam(null);
      setSelectedSlot('');
    }

    setPendingJoinMatch(matchToJoin);
  };

  const dismissWhatsappPopup = () => {
    setWaPopupDismissed(true);
    try {
      sessionStorage.setItem('kf_wa_popup_dismissed', '1');
    } catch {
      // ignore storage errors
    }
  };

  const handleConfirmJoinMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingJoinMatch || !currentUser) return;

    const ign = joinIgn.trim();
    if (!ign) {
      showToast('Please enter your Free Fire In-Game Name (IGN).', 'error');
      return;
    }

    const mode = (pendingJoinMatch.type || 'Solo').toLowerCase();
    const isTeamMode = mode === 'duo' || mode === 'squad';
    if (isTeamMode && (!selectedTeam || !selectedSlot)) {
      showToast('Please select an available Team & Slot.', 'error');
      return;
    }

    setJoiningMatch(true);
    const matchToJoin = pendingJoinMatch;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const matchRef = doc(db, 'matches', matchToJoin.id);
      const refBonusRef = doc(db, 'settings', 'referralBonus');
      const txRef = doc(collection(db, 'transactions'));
      let unlockedRefMsg = '';

      await runTransaction(db, async (tx) => {
        const [uSnap, mSnap, refBonusSnap] = await Promise.all([
          tx.get(userRef),
          tx.get(matchRef),
          tx.get(refBonusRef),
        ]);

        if (!uSnap.exists() || !mSnap.exists()) {
          throw new Error('Match or user data not found.');
        }

        const uData = uSnap.data();
        const userBal = Number(uData.walletBalance || 0);
        const mData = mSnap.data();

        if (mData.status === 'Cancelled' || mData.status === 'Completed') {
          throw new Error('This match is no longer accepting joins.');
        }

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

        const txMode = String(mData.type || 'Solo').toLowerCase();
        const txTeamMode = txMode === 'duo' || txMode === 'squad';
        let slotMeta: { teamNumber?: number; slotLetter?: string; slotLabel?: string } = {};

        if (txTeamMode) {
          const teamSize = txMode === 'duo' ? 2 : 4;
          const slotLetters = txMode === 'duo' ? ['A', 'B'] : ['A', 'B', 'C', 'D'];
          const totalTeams = Math.max(1, Math.ceil(Math.max(teamSize, maxSlots) / teamSize));
          const chosenTeam = Number(selectedTeam || 0);
          const chosenLetter = (selectedSlot || '').toUpperCase();

          if (chosenTeam < 1 || chosenTeam > totalTeams || !slotLetters.includes(chosenLetter)) {
            throw new Error('Please choose a valid Team and Slot.');
          }
          const slotTaken = participants.some(
            (p: { teamNumber?: number; slotLetter?: string }) =>
              Number(p.teamNumber) === chosenTeam &&
              String(p.slotLetter || '').toUpperCase() === chosenLetter
          );
          if (slotTaken) {
            throw new Error(
              `Team ${chosenTeam} - Slot ${chosenLetter} was just taken! Please pick another slot.`
            );
          }
          slotMeta = {
            teamNumber: chosenTeam,
            slotLetter: chosenLetter,
            slotLabel: `Team ${chosenTeam} - Slot ${chosenLetter}`,
          };
        }

        const referrerUid =
          typeof uData.referredByUid === 'string' ? uData.referredByUid.trim() : '';
        const hasPendingRef =
          uData.referralStatus === 'pending' &&
          Boolean(referrerUid) &&
          referrerUid !== currentUser.uid;
        const referrerRef = hasPendingRef ? doc(db, 'users', referrerUid) : null;
        const referrerSnap = referrerRef ? await tx.get(referrerRef) : null;

        const refBonusData = refBonusSnap.exists() ? refBonusSnap.data() : {};
        const referrerCoins = Math.max(0, Math.floor(Number(refBonusData.referrerCoins ?? 3)));
        const refereeCoins = Math.max(0, Math.floor(Number(refBonusData.refereeCoins ?? 3)));
        const canUnlockReferral = Boolean(hasPendingRef && referrerSnap && referrerSnap.exists());
        const refereeReward = canUnlockReferral ? refereeCoins : 0;
        const referrerReward = canUnlockReferral ? referrerCoins : 0;

        const participantObj = {
          uid: currentUser.uid,
          email: currentUser.email || '',
          ign,
          joinedAt: new Date().toISOString(),
          ...slotMeta,
        };

        tx.update(userRef, {
          walletBalance: userBal - entryFee + refereeReward,
          ...(canUnlockReferral ? { referralStatus: 'credited' } : {}),
        });
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
          description: `Joined: ${mData.title} (IGN: ${ign}${slotMeta.slotLabel ? ` · ${slotMeta.slotLabel}` : ''})`,
          createdAt: serverTimestamp(),
        });

        if (canUnlockReferral && referrerRef && referrerSnap) {
          if (referrerReward > 0) {
            const refBal = Number(referrerSnap.data()?.walletBalance || 0);
            tx.update(referrerRef, { walletBalance: refBal + referrerReward });
            tx.set(doc(collection(db, 'transactions')), {
              uid: referrerUid,
              type: 'Referral Reward',
              amount: referrerReward,
              isCredit: true,
              status: 'Completed',
              description: `Referral Reward unlocked (${ign} joined first match)`,
              createdAt: serverTimestamp(),
            });
          }
          if (refereeReward > 0) {
            tx.set(doc(collection(db, 'transactions')), {
              uid: currentUser.uid,
              type: 'Referral Bonus',
              amount: refereeReward,
              isCredit: true,
              status: 'Completed',
              description: 'Welcome Referral Bonus unlocked on first match!',
              createdAt: serverTimestamp(),
            });
            unlockedRefMsg = ` +${refereeReward} Referral Bonus unlocked!`;
          }
        }
      });

      setPendingJoinMatch(null);
      setJoinIgn('');
      setSelectedTeam(null);
      setSelectedSlot('');
      showToast(
        `Successfully joined! Check 'My Matches' for Room details.${unlockedRefMsg}`,
        'success'
      );
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

  const navItems: { id: AppTab; label: string; mobileLabel: string; icon: React.ReactNode }[] = [
    { id: 'matches', label: 'Matches', mobileLabel: 'Matches', icon: <Crosshair className="w-5 h-5" /> },
    { id: 'wallet', label: 'Wallet', mobileLabel: 'Wallet', icon: <Wallet className="w-5 h-5" /> },
    { id: 'my-matches', label: 'My Matches', mobileLabel: 'Joined', icon: <Trophy className="w-5 h-5" /> },
    { id: 'leaderboard', label: 'Leaderboard', mobileLabel: 'Ranks', icon: <Award className="w-5 h-5" /> },
    { id: 'gifts', label: 'Gifts', mobileLabel: 'Gifts', icon: <Gift className="w-5 h-5" /> },
    { id: 'support', label: 'Support', mobileLabel: 'Profile', icon: <HelpCircle className="w-5 h-5" /> },
    ...(isAdmin
      ? [
          {
            id: 'admin' as AppTab,
            label: 'Admin',
            mobileLabel: 'Admin',
            icon: <Settings className="w-5 h-5" />,
          },
        ]
      : []),
  ];

  const isSpinReady =
    spinSettings.enabled && Date.now() - Number(userLastSpinTime || 0) >= 24 * 60 * 60 * 1000;

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
      ) : userBlocked ? (
        <section className="fixed inset-0 z-[85] bg-[#0B0E14] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl p-6 sm:p-8 bg-gradient-to-b from-red-950/50 to-[#151A23] border border-red-500/60 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/20 border border-red-500/50 flex items-center justify-center text-red-400">
              <ShieldAlert className="w-9 h-9" />
            </div>
            <div className="space-y-2">
              <h1 className="font-gaming text-3xl font-bold uppercase tracking-wider text-red-400">
                Account Suspended
              </h1>
              <p className="text-sm text-red-200 leading-relaxed">
                Your account has been suspended by the Admin for violating tournament rules. Contact
                Support.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <a
                href={formatSupportHref(
                  globalSettings.whatsappSupport || settings.whatsappSupport
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[46px] py-2.5 px-4 rounded-xl bg-[#00FF88] text-[#0B0E14] font-gaming font-bold text-base uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 transition"
              >
                <Headphones className="w-4 h-4" />
                WhatsApp Support
              </a>
              <button
                type="button"
                onClick={handleLogout}
                className="min-h-[46px] py-2.5 px-4 rounded-xl bg-red-500 text-white font-gaming font-bold text-base uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-red-600 transition"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </section>
      ) : globalSettings.maintenanceMode && !isAdmin ? (
        <section className="fixed inset-0 z-[85] bg-[#0B0E14] flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl p-6 sm:p-8 bg-gradient-to-b from-[#FF5500]/15 to-[#151A23] border border-[#FF5500]/50 shadow-2xl text-center space-y-5 glow-orange">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FF5500]/20 border border-[#FF5500]/50 flex items-center justify-center text-[#FF5500]">
              <Wrench className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#FF5500]">
                Scheduled Maintenance
              </span>
              <h1 className="font-gaming text-3xl font-bold uppercase tracking-wider text-white">
                Server Under Maintenance
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {globalSettings.maintenanceMessage}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <a
                href={formatSupportHref(
                  globalSettings.whatsappSupport || settings.whatsappSupport
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[46px] py-2.5 px-4 rounded-xl bg-[#00FF88] text-[#0B0E14] font-gaming font-bold text-base uppercase tracking-wider flex items-center justify-center gap-2 hover:brightness-110 transition"
              >
                <Headphones className="w-4 h-4" />
                WhatsApp Support
              </a>
              <button
                type="button"
                onClick={handleLogout}
                className="min-h-[46px] py-2.5 px-4 rounded-xl bg-[#1C222E] border border-white/15 text-slate-200 font-gaming font-bold text-base uppercase tracking-wider flex items-center justify-center gap-2 hover:border-red-400 hover:text-red-400 transition"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </section>
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

              {/* Primary Actions: Daily Spin & Live Coin Balance */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSpinModalOpen(true)}
                  aria-label="Open Daily Spin Wheel"
                  className="relative min-h-[38px] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-[#FF5500]/20 to-[#00FF88]/20 border border-[#00FF88]/50 hover:border-[#00FF88] text-white transition glow-green-sm whitespace-nowrap"
                >
                  <Disc
                    className={`w-4 h-4 text-[#00FF88] ${isSpinReady ? 'animate-spin' : ''}`}
                    style={{ animationDuration: '6s' }}
                  />
                  <span className="font-gaming text-sm font-bold uppercase tracking-wider">
                    Spin
                  </span>
                  {isSpinReady && (
                    <span
                      aria-hidden="true"
                      className="w-2 h-2 rounded-full bg-[#00FF88] shadow-[0_0_8px_#00FF88]"
                    />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchTab('wallet')}
                  className="min-h-[38px] flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#151A23] border border-[#00FF88]/40 hover:border-[#00FF88] transition shrink-0 glow-green-sm whitespace-nowrap"
                >
                  <span className="text-xs font-bold text-[#00FF88]">₹</span>
                  <span className="font-gaming text-base font-bold text-white tabular-nums">
                    {walletBalance}
                  </span>
                  <span className="text-[11px] text-slate-400 font-semibold uppercase hidden sm:inline">
                    Coins
                  </span>
                </button>
              </div>
            </div>
          </header>

          {/* MAIN CONTENT */}
          <main className="flex-1 w-full max-w-6xl mx-auto px-4 pt-4 pb-24 md:pb-12 space-y-5">
            {isAdmin && globalSettings.maintenanceMode && (
              <div className="rounded-xl bg-[#FF5500]/15 border border-[#FF5500]/50 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
                <span className="text-xs font-semibold text-[#FF5500]">
                  Maintenance Mode is ON — Normal users currently see the Server Under Maintenance
                  screen.
                </span>
                <button
                  type="button"
                  onClick={() => handleSwitchTab('admin')}
                  className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-[#FF5500] text-white"
                >
                  Admin Controls
                </button>
              </div>
            )}

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
              <div className="space-y-5">
                <BannerStrip banners={banners} page="Home" />
                <MatchesTab
                  matches={matches}
                  currentUserId={currentUser.uid}
                  filter={matchFilter}
                  onFilterChange={setMatchFilter}
                  onJoinClick={handleJoinMatchClick}
                  onViewResult={setLeaderboardMatch}
                  onToast={showToast}
                />
              </div>
            )}

            {activeTab === 'wallet' && (
              <div className="space-y-5">
                <BannerStrip banners={banners} page="Wallet" />
                <WalletTab
                  userId={currentUser.uid}
                  userEmail={currentUser.email || ''}
                  userMobileNumber={userMobileNumber}
                  walletBalance={walletBalance}
                  transactions={transactions}
                  upiId={globalSettings.upiId}
                  upiQrUrl={globalSettings.upiQrUrl}
                  minWithdrawal={globalSettings.minWithdrawal}
                  onToast={showToast}
                />
              </div>
            )}

            {activeTab === 'my-matches' && (
              <div className="space-y-5">
                <MyMatchesTab
                  matches={matches}
                  currentUserId={currentUser.uid}
                  onToast={showToast}
                  onViewResult={setLeaderboardMatch}
                />
              </div>
            )}

            {activeTab === 'leaderboard' && (
              <div className="space-y-5">
                <LeaderboardTab
                  matches={matches}
                  currentUserId={currentUser.uid}
                  onViewResult={setLeaderboardMatch}
                />
              </div>
            )}

            {activeTab === 'gifts' && (
              <div className="space-y-5">
                <BannerStrip banners={banners} page="Gifts" />
                <GiftsTab
                  userId={currentUser.uid}
                  referralCode={userReferralCode}
                  referralStatus={userReferralStatus}
                  referredByCode={userReferredByCode}
                  redeemedPromoCodes={userRedeemedPromos}
                  referralBonus={referralBonus}
                  onToast={showToast}
                />
              </div>
            )}

            {activeTab === 'support' && (
              <div className="space-y-5">
                <BannerStrip banners={banners} page="Profile" />
                <SupportTab
                  userId={currentUser.uid}
                  userEmail={currentUser.email || ''}
                  userIgn={userIgn}
                  userMobileNumber={userMobileNumber}
                  userFfUid={userFfUid}
                  userFfUidLocked={userFfUidLocked}
                  matchesPlayedCount={
                    matches.filter(
                      (m) =>
                        Array.isArray(m.participants) &&
                        m.participants.some((p) => p.uid === currentUser.uid)
                    ).length
                  }
                  matches={matches}
                  complaints={userComplaints}
                  settings={settings}
                  whatsappChannelOverride={whatsappPopup.channelUrl}
                  whatsappSupportOverride={globalSettings.whatsappSupport}
                  telegramLink={globalSettings.telegramLink}
                  instagramLink={globalSettings.instagramLink}
                  onLogout={handleLogout}
                  onToast={showToast}
                />
              </div>
            )}

            {activeTab === 'admin' && isAdmin && (
              <AdminTab
                deposits={adminDeposits}
                withdrawals={adminWithdrawals}
                users={adminUsers}
                matches={matches}
                settings={settings}
                globalSettings={globalSettings}
                whatsappPopup={whatsappPopup}
                banners={banners}
                spinSettings={spinSettings}
                referralBonus={referralBonus}
                promoCodes={promoCodes}
                complaints={adminComplaints}
                onRequestDeleteMatch={(id, title) => setDeleteTarget({ id, title })}
                onViewResult={setLeaderboardMatch}
                onToast={showToast}
              />
            )}
          </main>

          {/* MOBILE FIXED BOTTOM NAVIGATION */}
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0F131B]/95 backdrop-blur-lg border-t border-white/10 px-1 py-1">
            <div
              className={`grid gap-0.5 ${isAdmin ? 'grid-cols-7' : 'grid-cols-6'}`}
            >
              {navItems.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSwitchTab(item.id)}
                    className={`min-h-[48px] flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition ${
                      active ? 'text-[#00FF88]' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span className="text-[9px] font-semibold mt-0.5 whitespace-nowrap truncate max-w-full">
                      {item.mobileLabel}
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
            selectedTeam={selectedTeam}
            selectedSlot={selectedSlot}
            submitting={joiningMatch}
            onIgnChange={setJoinIgn}
            onSlotChange={(team, slot) => {
              setSelectedTeam(team);
              setSelectedSlot(slot);
            }}
            onCancel={() => {
              setPendingJoinMatch(null);
              setJoinIgn('');
              setSelectedTeam(null);
              setSelectedSlot('');
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

          <MatchLeaderboardModal
            match={leaderboardMatch}
            currentUserId={currentUser.uid}
            onClose={() => setLeaderboardMatch(null)}
          />

          <AntiCheatRulesModal
            match={antiCheatMatch}
            rulesText={globalSettings.antiCheatRules}
            onCancel={() => setAntiCheatMatch(null)}
            onAgree={handleAgreeAntiCheat}
          />

          <ForceUpdateModal
            open={Boolean(globalSettings.forceUpdateEnabled && !isAdmin)}
            message={globalSettings.forceUpdateMessage}
            downloadUrl={globalSettings.forceUpdateUrl}
          />

          <WhatsappChannelPopupModal
            open={Boolean(
              whatsappPopup.enabled &&
                !waPopupDismissed &&
                !(globalSettings.forceUpdateEnabled && !isAdmin) &&
                activeTab === 'matches'
            )}
            message={whatsappPopup.message}
            channelUrl={whatsappPopup.channelUrl || settings.whatsappChannel}
            onClose={dismissWhatsappPopup}
            onJoinClick={dismissWhatsappPopup}
          />

          <SpinWheelModal
            open={spinModalOpen}
            userId={currentUser.uid}
            lastSpinTime={userLastSpinTime}
            spinSettings={spinSettings}
            onClose={() => setSpinModalOpen(false)}
            onToast={showToast}
          />
        </div>
      )}
    </div>
  );
}
