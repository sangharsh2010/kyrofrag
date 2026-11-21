import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Copy,
  CopyPlus,
  Crown,
  Disc,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  Gift,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Ticket,
  Trash2,
  Trophy,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { ADMIN_EMAIL, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { copyToClipboard, formatMatchDate, formatTimestamp } from '../lib/formatters';
import type {
  AdminSubTab,
  AppSettings,
  BannerItem,
  BannerTargetPage,
  ComplaintTicket,
  DepositRequest,
  GlobalSettings,
  MatchResultEntry,
  PromoCodeItem,
  ReferralBonusSettings,
  SpinSegment,
  SpinWheelSettings,
  TournamentMatch,
  UserProfile,
  WhatsappPopupSettings,
  WithdrawalRequest,
} from '../types/esports';

interface AdminTabProps {
  deposits: DepositRequest[];
  withdrawals: WithdrawalRequest[];
  users: UserProfile[];
  matches: TournamentMatch[];
  complaints: ComplaintTicket[];
  settings: AppSettings;
  globalSettings: GlobalSettings;
  whatsappPopup: WhatsappPopupSettings;
  banners: BannerItem[];
  spinSettings: SpinWheelSettings;
  referralBonus: ReferralBonusSettings;
  promoCodes: PromoCodeItem[];
  onRequestDeleteMatch: (matchId: string, title: string) => void;
  onViewResult: (match: TournamentMatch) => void;
  onToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ADMIN_SUBTABS: { id: AdminSubTab; label: string }[] = [
  { id: 'deposits', label: 'Deposits (UTR)' },
  { id: 'withdrawals', label: 'Withdrawals' },
  { id: 'users', label: 'Users & Special Coins' },
  { id: 'matches', label: 'Manage Matches' },
  { id: 'complaints', label: 'Complaints Inbox' },
  { id: 'global', label: 'Global Controls' },
  { id: 'banners', label: 'Banner Manager' },
  { id: 'spin', label: 'Spin Wheel Settings' },
  { id: 'referrals', label: 'Referrals & Promos' },
  { id: 'settings', label: 'App Settings' },
];

const BANNER_PAGES: BannerTargetPage[] = ['Home', 'Wallet', 'Gifts', 'Profile', 'All Pages'];

export const AdminTab: React.FC<AdminTabProps> = ({
  deposits,
  withdrawals,
  users,
  matches,
  complaints,
  settings,
  globalSettings,
  whatsappPopup,
  banners,
  spinSettings,
  referralBonus,
  promoCodes,
  onRequestDeleteMatch,
  onViewResult,
  onToast,
}) => {
  const [subTab, setSubTab] = useState<AdminSubTab>('deposits');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState<string>('');
  const [userCoinInputs, setUserCoinInputs] = useState<Record<string, string>>({});
  const [userFfUidInputs, setUserFfUidInputs] = useState<Record<string, string>>({});

  // Create Match State
  const [cmTitle, setCmTitle] = useState('');
  const [cmMap, setCmMap] = useState('Bermuda');
  const [cmType, setCmType] = useState<'Solo' | 'Duo' | 'Squad'>('Solo');
  const [cmDateTime, setCmDateTime] = useState('');
  const [cmEntry, setCmEntry] = useState('');
  const [cmPerKill, setCmPerKill] = useState('');
  const [cmBooyah, setCmBooyah] = useState('');
  const [cmSlots, setCmSlots] = useState('48');
  const [cmGunSkin, setCmGunSkin] = useState(true);
  const [cmCharSkill, setCmCharSkill] = useState(true);
  const [cmWatchLiveUrl, setCmWatchLiveUrl] = useState('');
  const [creatingMatch, setCreatingMatch] = useState(false);

  // Cancel & Refund Confirm Modal
  const [cancelConfirmMatch, setCancelConfirmMatch] = useState<TournamentMatch | null>(null);

  // Complaints Inbox Admin Notes
  const [complaintNotes, setComplaintNotes] = useState<Record<string, string>>({});

  // Room ID/Pass inline edits keyed by matchId
  const [roomEdits, setRoomEdits] = useState<Record<string, { roomId: string; roomPass: string }>>(
    {}
  );

  // Players Modal State
  const [playersModalMatchId, setPlayersModalMatchId] = useState<string | null>(null);
  const [winCoinInputs, setWinCoinInputs] = useState<Record<string, string>>({});

  // Publish Results & Auto-Payout Modal State
  const [publishModalMatchId, setPublishModalMatchId] = useState<string | null>(null);
  const [resultDrafts, setResultDrafts] = useState<
    Record<string, { kills: number; isBooyah: boolean }>
  >({});
  const [publishingResults, setPublishingResults] = useState(false);

  // Global Controls & WhatsApp Popup Form State
  const [globalForm, setGlobalForm] = useState<GlobalSettings>(globalSettings);
  const [savingGlobal, setSavingGlobal] = useState(false);

  const [waPopupForm, setWaPopupForm] = useState<WhatsappPopupSettings>(whatsappPopup);
  const [savingWaPopup, setSavingWaPopup] = useState(false);

  // Banner Manager Form State
  const [bannerImageUrl, setBannerImageUrl] = useState('');
  const [bannerTargetUrl, setBannerTargetUrl] = useState('');
  const [bannerTargetPage, setBannerTargetPage] = useState<BannerTargetPage>('Home');
  const [savingBanner, setSavingBanner] = useState(false);

  // Spin Wheel Settings State
  const [spinForm, setSpinForm] = useState<SpinWheelSettings>(spinSettings);
  const [savingSpin, setSavingSpin] = useState(false);

  // Referral & First Deposit Bonus State
  const [refBonusForm, setRefBonusForm] = useState<ReferralBonusSettings>(referralBonus);
  const [savingRefBonus, setSavingRefBonus] = useState(false);

  // Promo Code Generator State
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [promoCoinsInput, setPromoCoinsInput] = useState('10');
  const [promoMaxUsesInput, setPromoMaxUsesInput] = useState('50');
  const [savingPromo, setSavingPromo] = useState(false);

  // Settings Form State
  const [settingsForm, setSettingsForm] = useState<AppSettings>(settings);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setSettingsForm(settings);
  }, [settings]);

  useEffect(() => {
    setGlobalForm(globalSettings);
  }, [globalSettings]);

  useEffect(() => {
    setWaPopupForm(whatsappPopup);
  }, [whatsappPopup]);

  useEffect(() => {
    setSpinForm(spinSettings);
  }, [spinSettings]);

  useEffect(() => {
    setRefBonusForm(referralBonus);
  }, [referralBonus]);

  const activePlayersModalMatch = playersModalMatchId
    ? matches.find((m) => m.id === playersModalMatchId) || null
    : null;

  const activePublishModalMatch = publishModalMatchId
    ? matches.find((m) => m.id === publishModalMatchId) || null
    : null;

  const handleCopy = async (val: string, label: string) => {
    const ok = await copyToClipboard(val);
    if (ok) onToast(label, 'success');
  };

  // ==================== 1. DEPOSITS ====================
  const handleApproveDeposit = async (dep: DepositRequest) => {
    setBusyId(dep.id);
    try {
      let summaryNote = 'Deposit approved & coins credited!';
      await runTransaction(db, async (tx) => {
        const depRef = doc(db, 'deposits', dep.id);
        const userRef = doc(db, 'users', dep.uid);
        const refBonusRef = doc(db, 'settings', 'referralBonus');

        const [depSnap, userSnap, refBonusSnap] = await Promise.all([
          tx.get(depRef),
          tx.get(userRef),
          tx.get(refBonusRef),
        ]);

        if (!depSnap.exists()) throw new Error('Deposit not found.');
        const depData = depSnap.data();
        if (depData.status !== 'Pending') throw new Error('Already processed.');
        if (!userSnap.exists()) throw new Error('User document not found.');

        const uData = userSnap.data();
        const referrerUid =
          typeof uData.referredByUid === 'string' ? uData.referredByUid.trim() : '';
        const hasPendingRef =
          uData.referralStatus === 'pending' &&
          Boolean(referrerUid) &&
          referrerUid !== dep.uid;

        const referrerRef = hasPendingRef ? doc(db, 'users', referrerUid) : null;
        const referrerSnap = referrerRef ? await tx.get(referrerRef) : null;

        const depAmount = Number(depData.amount || 0);
        const refBonusData = refBonusSnap.exists() ? refBonusSnap.data() : {};
        const referrerCoins = Math.max(0, Math.floor(Number(refBonusData.referrerCoins ?? 3)));
        const refereeCoins = Math.max(0, Math.floor(Number(refBonusData.refereeCoins ?? 3)));
        const bonusType =
          refBonusData.firstDepositBonusType === 'flat' ? 'flat' : 'percentage';
        const bonusVal = Math.max(0, Number(refBonusData.firstDepositBonusValue || 0));

        const isFirstDeposit = !Boolean(uData.hasApprovedDeposit);
        const firstDepositBonus =
          isFirstDeposit && bonusVal > 0
            ? bonusType === 'percentage'
              ? Math.floor((depAmount * bonusVal) / 100)
              : Math.floor(bonusVal)
            : 0;

        const canUnlockReferral = Boolean(hasPendingRef && referrerSnap && referrerSnap.exists());
        const refereeReward = canUnlockReferral ? refereeCoins : 0;
        const referrerReward = canUnlockReferral ? referrerCoins : 0;

        const newBal =
          Number(uData.walletBalance || 0) + depAmount + firstDepositBonus + refereeReward;

        tx.update(userRef, {
          walletBalance: newBal,
          hasApprovedDeposit: true,
          ...(canUnlockReferral ? { referralStatus: 'credited' } : {}),
        });
        tx.update(depRef, { status: 'Approved' });
        tx.set(doc(db, 'transactions', dep.id), { status: 'Approved' }, { merge: true });

        if (firstDepositBonus > 0) {
          tx.set(doc(collection(db, 'transactions')), {
            uid: dep.uid,
            type: 'First Deposit Bonus',
            amount: firstDepositBonus,
            isCredit: true,
            status: 'Completed',
            description: `First Deposit Bonus (${
              bonusType === 'percentage' ? `+${bonusVal}%` : `+${bonusVal} Coins`
            })`,
            createdAt: serverTimestamp(),
          });
        }

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
              description: `Referral Reward unlocked (${
                uData.ign || uData.email || 'Friend'
              } first deposit)`,
              createdAt: serverTimestamp(),
            });
          }
          if (refereeReward > 0) {
            tx.set(doc(collection(db, 'transactions')), {
              uid: dep.uid,
              type: 'Referral Bonus',
              amount: refereeReward,
              isCredit: true,
              status: 'Completed',
              description: 'Welcome Referral Bonus unlocked on first deposit!',
              createdAt: serverTimestamp(),
            });
          }
        }

        const extras: string[] = [];
        if (firstDepositBonus > 0) extras.push(`+${firstDepositBonus} First Deposit Bonus`);
        if (canUnlockReferral) extras.push(`Referral unlocked (${referrerReward}+${refereeReward})`);
        if (extras.length > 0) {
          summaryNote = `Deposit approved! (${extras.join(' · ')})`;
        }
      });
      onToast(summaryNote, 'success');
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

  const handleToggleBlockUser = async (u: UserProfile) => {
    const nextBlocked = !Boolean(u.isBlocked);
    setBusyId(`block-${u.id}`);
    try {
      await updateDoc(doc(db, 'users', u.id), {
        isBlocked: nextBlocked,
      }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${u.id}`)
      );
      onToast(
        nextBlocked ? `Suspended ${u.ign || u.email}` : `Unblocked ${u.ign || u.email}`,
        nextBlocked ? 'info' : 'success'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to update user status.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleAdminSaveFfUid = async (u: UserProfile) => {
    const raw = (userFfUidInputs[u.id] ?? u.ffUid ?? '').replace(/\D/g, '').trim();
    if (raw && !/^\d{10}$/.test(raw)) {
      onToast('Free Fire UID must be exactly 10 digits (or leave empty to clear).', 'error');
      return;
    }
    setBusyId(`ffuid-${u.id}`);
    try {
      await updateDoc(doc(db, 'users', u.id), {
        ffUid: raw,
        ffUidLocked: Boolean(raw),
      }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${u.id}`)
      );
      onToast(
        raw ? `Updated & locked FF UID (${raw}) for ${u.ign || u.email}` : 'Cleared FF UID.',
        'success'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to update FF UID.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleAdminToggleFfUidLock = async (u: UserProfile) => {
    const nextLocked = !Boolean(u.ffUidLocked);
    setBusyId(`fflock-${u.id}`);
    try {
      await updateDoc(doc(db, 'users', u.id), {
        ffUidLocked: nextLocked,
      }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `users/${u.id}`)
      );
      onToast(
        nextLocked
          ? `Locked FF UID for ${u.ign || u.email}`
          : `Unlocked FF UID — user can now re-verify.`,
        'info'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to toggle FF UID lock.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // ==================== 4. MATCHES ====================
  const handleCreateMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingMatch(true);
    const title = cmTitle.trim();
    const entryFee = Number(cmEntry || 0);
    const perKill = Number(cmPerKill || 0);

    try {
      await addDoc(collection(db, 'matches'), {
        title,
        map: cmMap.trim() || 'Bermuda',
        type: cmType,
        dateTime: cmDateTime,
        entryFee,
        perKill,
        booyahPrize: Number(cmBooyah || 0),
        maxSlots: Number(cmSlots || 48),
        joinedCount: 0,
        participants: [],
        gunSkinAllowed: cmGunSkin,
        charSkillAllowed: cmCharSkill,
        watchLiveUrl: cmWatchLiveUrl.trim(),
        roomPublished: false,
        roomId: '',
        roomPass: '',
        status: 'Upcoming',
        resultsPublished: false,
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
      setCmGunSkin(true);
      setCmCharSkill(true);
      setCmWatchLiveUrl('');

      onToast('Match published live!', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to create match.', 'error');
    } finally {
      setCreatingMatch(false);
    }
  };

  const handleCloneMatch = (m: TournamentMatch) => {
    setCmTitle(`${m.title} (Copy)`);
    setCmMap(m.map || 'Bermuda');
    setCmType(
      m.type === 'Duo' || m.type === 'Squad' ? m.type : 'Solo'
    );
    setCmDateTime(m.dateTime || '');
    setCmEntry(String(Number(m.entryFee || 0)));
    setCmPerKill(String(Number(m.perKill || 0)));
    setCmBooyah(String(Number(m.booyahPrize || 0)));
    setCmSlots(String(Number(m.maxSlots || 48)));
    setCmGunSkin(m.gunSkinAllowed !== false);
    setCmCharSkill(m.charSkillAllowed !== false);
    setCmWatchLiveUrl(m.watchLiveUrl || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onToast('Match settings cloned into Create New Match form!', 'info');
  };

  const handleToggleRoomPublished = async (m: TournamentMatch) => {
    const nextPublished = !Boolean(m.roomPublished);
    setBusyId(`roompub-${m.id}`);
    try {
      await updateDoc(doc(db, 'matches', m.id), {
        roomPublished: nextPublished,
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `matches/${m.id}`));
      onToast(
        nextPublished
          ? 'Room Details are now LIVE for joined players!'
          : 'Room Details hidden from players.',
        nextPublished ? 'success' : 'info'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to toggle room visibility.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleCancelAndRefundMatch = async () => {
    if (!cancelConfirmMatch) return;
    const target = cancelConfirmMatch;
    setCancelConfirmMatch(null);
    setBusyId(`cancel-${target.id}`);

    try {
      let refundedCount = 0;
      let totalRefundedCoins = 0;

      await runTransaction(db, async (tx) => {
        const matchRef = doc(db, 'matches', target.id);
        const mSnap = await tx.get(matchRef);
        if (!mSnap.exists()) throw new Error('Match not found.');

        const mData = mSnap.data();
        if (mData.status === 'Completed' || mData.resultsPublished) {
          throw new Error('Cannot cancel a match whose results are already published.');
        }
        if (mData.status === 'Cancelled') {
          throw new Error('This match is already cancelled.');
        }

        const entryFee = Math.max(0, Number(mData.entryFee || 0));
        const participants = Array.isArray(mData.participants) ? mData.participants : [];

        // Deduplicate by uid defensively and count entries per uid
        const countByUid = new Map<string, number>();
        participants.forEach((p: { uid?: string }) => {
          if (p.uid) countByUid.set(p.uid, (countByUid.get(p.uid) || 0) + 1);
        });
        const uniqueUids = Array.from(countByUid.keys());

        // Firestore transaction requirement: ALL reads before ANY writes
        const userRefs = uniqueUids.map((uid) => doc(db, 'users', uid));
        const userSnaps = await Promise.all(userRefs.map((ref) => tx.get(ref)));

        tx.update(matchRef, {
          status: 'Cancelled',
          roomPublished: false,
          cancelledAt: serverTimestamp(),
        });

        if (entryFee > 0) {
          uniqueUids.forEach((uid, idx) => {
            const uSnap = userSnaps[idx];
            if (!uSnap.exists()) return;
            const entries = countByUid.get(uid) || 1;
            const refundAmt = entryFee * entries;
            const curBal = Number(uSnap.data().walletBalance || 0);

            tx.update(userRefs[idx], {
              walletBalance: curBal + refundAmt,
            });
            tx.set(doc(collection(db, 'transactions')), {
              uid,
              type: 'Match Refund',
              amount: refundAmt,
              isCredit: true,
              status: 'Refunded',
              description: `Match Cancelled - Instant Refund: ${mData.title}`,
              createdAt: serverTimestamp(),
            });
            refundedCount += 1;
            totalRefundedCoins += refundAmt;
          });
        }
      });

      onToast(
        refundedCount > 0
          ? `Match cancelled! Refunded ${totalRefundedCoins} Coins to ${refundedCount} player(s).`
          : 'Match marked Cancelled.',
        'info'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Cancel & refund failed.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // ==================== COMPLAINTS INBOX ====================
  const handleUpdateComplaintStatus = async (
    ticket: ComplaintTicket,
    nextStatus: 'Resolved' | 'Open'
  ) => {
    setBusyId(`complaint-${ticket.id}`);
    try {
      const note = (complaintNotes[ticket.id] ?? ticket.adminNote ?? '').trim();
      await updateDoc(doc(db, 'complaints', ticket.id), {
        status: nextStatus,
        adminNote: note,
        ...(nextStatus === 'Resolved' ? { resolvedAt: serverTimestamp() } : {}),
      }).catch((err) =>
        handleFirestoreError(err, OperationType.UPDATE, `complaints/${ticket.id}`)
      );
      onToast(
        nextStatus === 'Resolved' ? 'Dispute ticket marked Resolved!' : 'Ticket reopened.',
        nextStatus === 'Resolved' ? 'success' : 'info'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to update ticket.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteComplaint = async (ticketId: string) => {
    setBusyId(`complaint-del-${ticketId}`);
    try {
      await deleteDoc(doc(db, 'complaints', ticketId)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `complaints/${ticketId}`)
      );
      onToast('Ticket deleted.', 'info');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to delete ticket.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // ==================== 5. GLOBAL CONTROLS & WHATSAPP POPUP ====================
  const handleSaveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingGlobal(true);
    try {
      const cleanMinWithdrawal = Math.max(1, Math.floor(Number(globalForm.minWithdrawal || 20)));
      await setDoc(
        doc(db, 'settings', 'global'),
        {
          maintenanceMode: Boolean(globalForm.maintenanceMode),
          maintenanceMessage:
            globalForm.maintenanceMessage.trim() ||
            'Server is currently under maintenance. Please check back soon!',
          forceUpdateEnabled: Boolean(globalForm.forceUpdateEnabled),
          forceUpdateUrl: globalForm.forceUpdateUrl.trim(),
          forceUpdateMessage:
            globalForm.forceUpdateMessage.trim() ||
            'A new version of KryoFrag Esports is available. Please update your APK to continue.',
          upiId: globalForm.upiId.trim(),
          upiQrUrl: globalForm.upiQrUrl.trim(),
          whatsappSupport: globalForm.whatsappSupport.trim(),
          telegramLink: globalForm.telegramLink.trim(),
          instagramLink: globalForm.instagramLink.trim(),
          minWithdrawal: cleanMinWithdrawal,
          antiCheatRules: globalForm.antiCheatRules.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((err) => handleFirestoreError(err, OperationType.WRITE, 'settings/global'));

      onToast('Global controls updated live!', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to save global controls.', 'error');
    } finally {
      setSavingGlobal(false);
    }
  };

  const handleSaveWhatsappPopup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWaPopup(true);
    try {
      await setDoc(
        doc(db, 'settings', 'whatsappPopup'),
        {
          enabled: Boolean(waPopupForm.enabled),
          message:
            waPopupForm.message.trim() || 'Join this channel for offers and free matches',
          channelUrl: waPopupForm.channelUrl.trim(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, 'settings/whatsappPopup')
      );
      onToast('WhatsApp Channel Popup settings saved!', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to save popup settings.', 'error');
    } finally {
      setSavingWaPopup(false);
    }
  };

  // ==================== 6. BANNER MANAGER ====================
  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    const imgUrl = bannerImageUrl.trim();
    const targetUrl = bannerTargetUrl.trim();
    if (!imgUrl || !targetUrl) {
      onToast('Please enter both Banner Image URL and Target Redirect URL.', 'error');
      return;
    }

    setSavingBanner(true);
    try {
      await addDoc(collection(db, 'banners'), {
        imageUrl: imgUrl,
        targetUrl,
        targetPage: bannerTargetPage,
        createdAt: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.CREATE, 'banners'));

      setBannerImageUrl('');
      setBannerTargetUrl('');
      setBannerTargetPage('Home');
      onToast('Banner published live!', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to add banner.', 'error');
    } finally {
      setSavingBanner(false);
    }
  };

  const handleDeleteBanner = async (bannerId: string) => {
    setBusyId(`banner-${bannerId}`);
    try {
      await deleteDoc(doc(db, 'banners', bannerId)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `banners/${bannerId}`)
      );
      onToast('Banner deleted.', 'info');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to delete banner.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  // ==================== 7. SPIN WHEEL SETTINGS ====================
  const handleAddSpinSegment = () => {
    const nextSeg: SpinSegment = {
      id: `seg-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label: '5 Coins',
      coins: 5,
      weight: 10,
    };
    setSpinForm((prev) => ({
      ...prev,
      segments: [...prev.segments, nextSeg],
    }));
  };

  const handleRemoveSpinSegment = (segId: string) => {
    if (spinForm.segments.length <= 2) {
      onToast('Spin wheel requires at least 2 segments.', 'error');
      return;
    }
    setSpinForm((prev) => ({
      ...prev,
      segments: prev.segments.filter((s) => s.id !== segId),
    }));
  };

  const handleSaveSpinSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (spinForm.segments.length < 2) {
      onToast('Add at least 2 segments to the Spin Wheel.', 'error');
      return;
    }
    const sanitizedSegments = spinForm.segments.map((s, idx) => ({
      id: s.id || `seg-${idx + 1}`,
      label: s.label.trim() || `${Math.max(0, Math.floor(Number(s.coins || 0)))} Coins`,
      coins: Math.max(0, Math.floor(Number(s.coins || 0))),
      weight: Math.max(0, Number(s.weight || 0)),
    }));
    const totalWeight = sanitizedSegments.reduce((sum, s) => sum + s.weight, 0);
    if (totalWeight <= 0) {
      onToast('Total probability weight must be greater than 0.', 'error');
      return;
    }

    setSavingSpin(true);
    try {
      await setDoc(
        doc(db, 'settings', 'spinWheel'),
        {
          enabled: Boolean(spinForm.enabled),
          segments: sanitizedSegments,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((err) => handleFirestoreError(err, OperationType.WRITE, 'settings/spinWheel'));
      onToast('Spin Wheel settings saved & live!', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to save spin settings.', 'error');
    } finally {
      setSavingSpin(false);
    }
  };

  // ==================== 8. REFERRALS & PROMO CODES ====================
  const handleSaveReferralBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingRefBonus(true);
    try {
      await setDoc(
        doc(db, 'settings', 'referralBonus'),
        {
          referrerCoins: Math.max(0, Math.floor(Number(refBonusForm.referrerCoins || 0))),
          refereeCoins: Math.max(0, Math.floor(Number(refBonusForm.refereeCoins || 0))),
          firstDepositBonusType:
            refBonusForm.firstDepositBonusType === 'flat' ? 'flat' : 'percentage',
          firstDepositBonusValue: Math.max(
            0,
            Math.floor(Number(refBonusForm.firstDepositBonusValue || 0))
          ),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, 'settings/referralBonus')
      );
      onToast('Referral & First Deposit Bonus settings saved!', 'success');
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Failed to save referral settings.',
        'error'
      );
    } finally {
      setSavingRefBonus(false);
    }
  };

  const handleCreatePromoCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = promoCodeInput.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    const coins = Math.floor(Number(promoCoinsInput || 0));
    const maxUses = Math.floor(Number(promoMaxUsesInput || 0));

    if (!cleanCode || cleanCode.length < 3) {
      onToast('Promo code must be at least 3 alphanumeric characters.', 'error');
      return;
    }
    if (coins <= 0) {
      onToast('Coin reward must be greater than 0.', 'error');
      return;
    }
    if (maxUses <= 0) {
      onToast('Max usage limit must be at least 1.', 'error');
      return;
    }
    if (promoCodes.some((p) => p.code.toUpperCase() === cleanCode)) {
      onToast(`Promo code "${cleanCode}" already exists!`, 'error');
      return;
    }

    setSavingPromo(true);
    try {
      await setDoc(doc(db, 'promoCodes', cleanCode), {
        code: cleanCode,
        coins,
        maxUses,
        usedCount: 0,
        createdAt: serverTimestamp(),
      }).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `promoCodes/${cleanCode}`)
      );

      setPromoCodeInput('');
      setPromoCoinsInput('10');
      setPromoMaxUsesInput('50');
      onToast(`Promo code "${cleanCode}" (+${coins} Coins) created!`, 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to create promo code.', 'error');
    } finally {
      setSavingPromo(false);
    }
  };

  const handleDeletePromoCode = async (codeId: string) => {
    setBusyId(`promo-${codeId}`);
    try {
      await deleteDoc(doc(db, 'promoCodes', codeId)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `promoCodes/${codeId}`)
      );
      onToast(`Promo code "${codeId}" deleted.`, 'info');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to delete promo code.', 'error');
    } finally {
      setBusyId(null);
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

  const openPublishResultsModal = (m: TournamentMatch) => {
    if (m.status === 'Completed' || m.resultsPublished) {
      onViewResult(m);
      return;
    }
    const participants = Array.isArray(m.participants) ? m.participants : [];
    const initialDrafts: Record<string, { kills: number; isBooyah: boolean }> = {};
    participants.forEach((p) => {
      initialDrafts[p.uid] = { kills: 0, isBooyah: false };
    });
    setResultDrafts(initialDrafts);
    setPublishModalMatchId(m.id);
  };

  const handlePublishResultsAndPayout = async () => {
    if (!activePublishModalMatch || publishingResults) return;
    const match = activePublishModalMatch;
    if (match.status === 'Completed' || match.resultsPublished) {
      onToast('Results have already been published for this match!', 'error');
      setPublishModalMatchId(null);
      return;
    }

    const participants = Array.isArray(match.participants) ? match.participants : [];
    if (participants.length === 0) {
      onToast('No participants joined this match yet.', 'error');
      return;
    }

    const perKill = Math.max(0, Number(match.perKill || 0));
    const booyahPrize = Math.max(0, Number(match.booyahPrize || 0));

    const unsorted = participants.map((p) => {
      const draft = resultDrafts[p.uid] ?? { kills: 0, isBooyah: false };
      const kills = Math.max(0, Math.floor(Number(draft.kills) || 0));
      const isBooyah = Boolean(draft.isBooyah);
      const coinsWon = kills * perKill + (isBooyah ? booyahPrize : 0);
      return {
        uid: p.uid,
        ign: p.ign,
        email: p.email || '',
        kills,
        isBooyah,
        coinsWon,
      };
    });

    const sortedResults: MatchResultEntry[] = [...unsorted]
      .sort((a, b) => {
        if (b.coinsWon !== a.coinsWon) return b.coinsWon - a.coinsWon;
        if (a.isBooyah !== b.isBooyah) return a.isBooyah ? -1 : 1;
        if (b.kills !== a.kills) return b.kills - a.kills;
        return a.ign.localeCompare(b.ign);
      })
      .map((entry, idx) => ({
        rank: idx + 1,
        ...entry,
      }));

    // Deduplicate winning UIDs defensively so each user doc is read/updated once
    const payoutByUid = new Map<string, { uid: string; ign: string; kills: number; isBooyah: boolean; coinsWon: number }>();
    sortedResults.forEach((r) => {
      if (r.coinsWon > 0) {
        const existing = payoutByUid.get(r.uid);
        if (existing) {
          existing.coinsWon += r.coinsWon;
          existing.kills += r.kills;
          existing.isBooyah = existing.isBooyah || r.isBooyah;
        } else {
          payoutByUid.set(r.uid, {
            uid: r.uid,
            ign: r.ign,
            kills: r.kills,
            isBooyah: r.isBooyah,
            coinsWon: r.coinsWon,
          });
        }
      }
    });
    const winners = Array.from(payoutByUid.values());

    setPublishingResults(true);
    try {
      await runTransaction(db, async (tx) => {
        const matchRef = doc(db, 'matches', match.id);
        const mSnap = await tx.get(matchRef);
        if (!mSnap.exists()) {
          throw new Error('Match document not found.');
        }
        const mData = mSnap.data();
        if (mData.resultsPublished === true || mData.status === 'Completed') {
          throw new Error('Results have already been published for this match!');
        }

        // Firestore transaction requirement: ALL reads before ANY writes
        const winnerRefs = winners.map((w) => doc(db, 'users', w.uid));
        const winnerSnaps = await Promise.all(winnerRefs.map((ref) => tx.get(ref)));

        // Write match scoreboard & Completed status
        tx.update(matchRef, {
          status: 'Completed',
          resultsPublished: true,
          results: sortedResults,
          resultsPublishedAt: serverTimestamp(),
        });

        // Auto-credit every winning player & create transaction history
        winners.forEach((w, idx) => {
          const uSnap = winnerSnaps[idx];
          if (!uSnap.exists()) return;
          const curBal = Number(uSnap.data().walletBalance || 0);
          tx.update(winnerRefs[idx], {
            walletBalance: curBal + w.coinsWon,
          });
          tx.set(doc(collection(db, 'transactions')), {
            uid: w.uid,
            type: 'Match Winning',
            amount: w.coinsWon,
            isCredit: true,
            status: 'Paid',
            description: `Match Winning - ${match.title}`,
            createdAt: serverTimestamp(),
          });
        });
      });

      const totalPaid = winners.reduce((sum, w) => sum + w.coinsWon, 0);
      setPublishModalMatchId(null);
      setResultDrafts({});
      onToast(
        winners.length > 0
          ? `Results published! Auto-credited ${totalPaid} Coins to ${winners.length} player(s).`
          : 'Match marked Completed & results published!',
        'success'
      );
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : 'Failed to publish results & credit coins.',
        'error'
      );
    } finally {
      setPublishingResults(false);
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
  const openComplaintsCount = complaints.filter((c) => c.status !== 'Resolved').length;
  const filteredUsers = userSearch.trim()
    ? users.filter((u) => {
        const term = userSearch.trim().toLowerCase();
        return (
          (u.email || '').toLowerCase().includes(term) ||
          (u.ign || '').toLowerCase().includes(term) ||
          (u.mobileNumber || '').toLowerCase().includes(term) ||
          (u.ffUid || '').toLowerCase().includes(term)
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
          const label =
            t.id === 'complaints' && openComplaintsCount > 0
              ? `${t.label} (${openComplaintsCount})`
              : t.label;
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
              {label}
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

                    <div className="space-y-1.5 px-3 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10">
                      {d.senderInfo && (
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="text-slate-400 truncate">
                            Sender:{' '}
                            <span className="text-white font-semibold">{d.senderInfo}</span>
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-400 truncate">
                          UTR:{' '}
                          <code className="text-white font-mono-code font-bold">
                            {d.utr || 'Not Provided'}
                          </code>
                        </span>
                        {d.utr && d.utr !== 'Not Provided' && (
                          <button
                            type="button"
                            onClick={() => handleCopy(d.utr, 'UTR copied!')}
                            className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#151A23] text-[11px] font-semibold text-[#00FF88] border border-[#00FF88]/30 inline-flex items-center gap-1 shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                            Copy UTR
                          </button>
                        )}
                      </div>
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
              placeholder="Search user by email, IGN, mobile, or FF UID..."
              className="w-full min-h-[44px] pl-10 pr-4 py-2.5 rounded-xl bg-[#151A23] border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00FF88]"
            />
          </div>

          {filteredUsers.length === 0 ? (
            <div className="card-surface rounded-2xl p-6 text-center text-xs text-slate-400">
              No users match your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredUsers.map((u) => {
                const isSelfAdmin =
                  (u.email || '').toLowerCase() === ADMIN_EMAIL.toLowerCase();
                const isBlocked = Boolean(u.isBlocked);
                const ffUidVal = userFfUidInputs[u.id] ?? u.ffUid ?? '';
                const isFfLocked = Boolean(u.ffUidLocked);

                return (
                  <div
                    key={u.id}
                    className={`card-surface rounded-2xl p-4 space-y-3 ${
                      isBlocked ? 'border border-red-500/40' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-white truncate">{u.email}</p>
                          {isBlocked && (
                            <span className="text-[10px] font-bold uppercase text-red-400 shrink-0">
                              · Suspended
                            </span>
                          )}
                        </div>
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

                    {/* Admin Free Fire UID Edit / Unlock Controls */}
                    <div className="p-2.5 rounded-xl bg-[#0B0E14] border border-white/10 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold text-slate-400">
                          Free Fire UID
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isFfLocked
                              ? 'bg-[#00FF88]/15 text-[#00FF88]'
                              : 'bg-amber-400/15 text-amber-300'
                          }`}
                        >
                          {isFfLocked ? (
                            <>
                              <Lock className="w-2.5 h-2.5" />
                              Locked
                            </>
                          ) : (
                            <>
                              <Unlock className="w-2.5 h-2.5" />
                              Unlocked
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={10}
                          placeholder="10-digit FF UID"
                          value={ffUidVal}
                          onChange={(e) =>
                            setUserFfUidInputs((prev) => ({
                              ...prev,
                              [u.id]: e.target.value.replace(/\D/g, '').slice(0, 10),
                            }))
                          }
                          className="flex-1 min-h-[36px] px-2.5 py-1 rounded-lg bg-[#151A23] border border-white/10 text-xs font-mono-code font-bold text-white tabular-nums focus:outline-none focus:border-[#00FF88]"
                        />
                        <button
                          type="button"
                          disabled={busyId === `ffuid-${u.id}`}
                          onClick={() => handleAdminSaveFfUid(u)}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-[10px] font-bold uppercase hover:bg-[#00FF88] hover:text-[#0B0E14] transition shrink-0 disabled:opacity-50"
                        >
                          Save UID
                        </button>
                        <button
                          type="button"
                          disabled={busyId === `fflock-${u.id}`}
                          onClick={() => handleAdminToggleFfUidLock(u)}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-[#151A23] border border-white/15 text-slate-200 text-[10px] font-bold uppercase hover:border-amber-400 hover:text-amber-300 transition shrink-0 disabled:opacity-50"
                        >
                          {isFfLocked ? 'Unlock' : 'Lock'}
                        </button>
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
                        className="w-20 min-h-[40px] px-2.5 py-1.5 rounded-xl bg-[#0B0E14] border border-white/10 text-xs text-white tabular-nums focus:outline-none focus:border-[#00FF88]"
                      />
                      <button
                        type="button"
                        disabled={busyId === `user-${u.id}`}
                        onClick={() => handleUserBalanceAdjust(u.id, 'add')}
                        className="flex-1 min-h-[40px] py-2 px-2.5 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-[11px] font-bold uppercase hover:bg-[#00FF88] hover:text-[#0B0E14] transition whitespace-nowrap disabled:opacity-50"
                      >
                        + Coins
                      </button>
                      <button
                        type="button"
                        disabled={busyId === `user-${u.id}`}
                        onClick={() => handleUserBalanceAdjust(u.id, 'deduct')}
                        className="min-h-[40px] py-2 px-2.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold uppercase hover:bg-amber-500/25 transition whitespace-nowrap disabled:opacity-50"
                      >
                        - Deduct
                      </button>
                      {!isSelfAdmin && (
                        <button
                          type="button"
                          disabled={busyId === `block-${u.id}`}
                          onClick={() => handleToggleBlockUser(u)}
                          className={`min-h-[40px] py-2 px-2.5 rounded-xl border text-[11px] font-bold uppercase transition inline-flex items-center gap-1 whitespace-nowrap shrink-0 disabled:opacity-50 ${
                            isBlocked
                              ? 'bg-[#00FF88]/15 border-[#00FF88]/40 text-[#00FF88] hover:bg-[#00FF88] hover:text-[#0B0E14]'
                              : 'bg-red-500/15 border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white'
                          }`}
                        >
                          {isBlocked ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Unblock
                            </>
                          ) : (
                            <>
                              <Ban className="w-3.5 h-3.5" />
                              Block
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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

              <div>
                <label className="block text-xs text-slate-400 mb-1">Gun Skin Rule</label>
                <select
                  value={cmGunSkin ? 'ON' : 'OFF'}
                  onChange={(e) => setCmGunSkin(e.target.value === 'ON')}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                >
                  <option value="ON">Gun Skin ON</option>
                  <option value="OFF">Gun Skin OFF</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Character Skill Rule</label>
                <select
                  value={cmCharSkill ? 'ON' : 'OFF'}
                  onChange={(e) => setCmCharSkill(e.target.value === 'ON')}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                >
                  <option value="ON">Character Skill ON</option>
                  <option value="OFF">Character Skill OFF</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">
                  Watch Live YouTube URL (Optional)
                </label>
                <input
                  type="url"
                  value={cmWatchLiveUrl}
                  onChange={(e) => setCmWatchLiveUrl(e.target.value)}
                  placeholder="https://youtube.com/live/..."
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
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
                const isCompleted = m.status === 'Completed' || Boolean(m.resultsPublished);
                const isCancelled = m.status === 'Cancelled';
                const isRoomLive = Boolean(m.roomPublished);
                const gunOn = m.gunSkinAllowed !== false;
                const skillOn = m.charSkillAllowed !== false;

                return (
                  <div
                    key={m.id}
                    className={`card-surface rounded-2xl p-4 space-y-3 ${
                      isCancelled
                        ? 'border border-red-500/35 opacity-80'
                        : isCompleted
                          ? 'border border-[#00FF88]/30'
                          : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400">
                          <span className="font-semibold text-[#FF5500]">{m.type}</span>
                          <span aria-hidden="true">·</span>
                          <span>{m.map}</span>
                          <span aria-hidden="true">·</span>
                          <span>{formatMatchDate(m.dateTime)}</span>
                          <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-slate-300">
                            Gun: {gunOn ? 'ON' : 'OFF'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-slate-300">
                            Skill: {skillOn ? 'ON' : 'OFF'}
                          </span>
                          {isCompleted && (
                            <span className="px-2 py-0.5 rounded bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-[10px] font-bold uppercase tracking-wider">
                              Results Published
                            </span>
                          )}
                          {isCancelled && (
                            <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-bold uppercase tracking-wider">
                              Cancelled · Refunded
                            </span>
                          )}
                        </div>
                        <h4 className="font-gaming text-lg font-bold uppercase text-white mt-0.5">
                          {m.title}
                        </h4>
                        <p className="text-xs text-slate-400 tabular-nums">
                          {Number(m.joinedCount || 0)}/{Number(m.maxSlots || 48)} Joined · Entry:{' '}
                          {Number(m.entryFee || 0)} · Per Kill: {Number(m.perKill || 0)} ·
                          Booyah: {Number(m.booyahPrize || 0)} Coins
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCloneMatch(m)}
                          title="Duplicate/Clone match settings"
                          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-sky-500/15 border border-sky-400/35 text-sky-300 text-xs font-bold uppercase hover:bg-sky-500/25 inline-flex items-center gap-1"
                        >
                          <CopyPlus className="w-3.5 h-3.5" />
                          Clone
                        </button>
                        <button
                          type="button"
                          onClick={() => onRequestDeleteMatch(m.id, m.title)}
                          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold uppercase hover:bg-red-500/25 inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busyId === `room-${m.id}`}
                        onClick={() => handleSaveRoom(m)}
                        className="min-h-[40px] py-2 px-3 rounded-xl bg-[#00FF88] text-[#0B0E14] text-xs font-bold uppercase hover:brightness-110 disabled:opacity-50"
                      >
                        Save Room ID/Pass
                      </button>

                      <button
                        type="button"
                        disabled={busyId === `roompub-${m.id}` || isCancelled}
                        onClick={() => handleToggleRoomPublished(m)}
                        className={`min-h-[40px] py-2 px-3 rounded-xl border text-xs font-bold uppercase transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                          isRoomLive
                            ? 'bg-[#00FF88]/15 border-[#00FF88]/50 text-[#00FF88]'
                            : 'bg-[#0B0E14] border-white/15 text-slate-300 hover:border-[#00FF88]'
                        }`}
                      >
                        {isRoomLive ? (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            Publish Room Details: ON
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            Publish Room Details: OFF
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPlayersModalMatchId(m.id)}
                        className="min-h-[40px] py-2 px-3 rounded-xl bg-[#1C222E] border border-white/15 text-white text-xs font-bold uppercase hover:border-[#00FF88] inline-flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" />
                        Players ({Number(m.joinedCount || 0)})
                      </button>

                      {isCompleted ? (
                        <button
                          type="button"
                          onClick={() => onViewResult(m)}
                          className="min-h-[40px] py-2 px-3 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-xs font-bold uppercase hover:bg-[#00FF88] hover:text-[#0B0E14] transition inline-flex items-center justify-center gap-1.5"
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          View Result
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isCancelled}
                          onClick={() => openPublishResultsModal(m)}
                          className="min-h-[40px] py-2 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-[#FF5500] text-[#0B0E14] text-xs font-bold uppercase hover:brightness-110 transition inline-flex items-center justify-center gap-1.5 disabled:opacity-40"
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          Publish Results
                        </button>
                      )}

                      {!isCompleted && !isCancelled && (
                        <button
                          type="button"
                          disabled={busyId === `cancel-${m.id}`}
                          onClick={() => setCancelConfirmMatch(m)}
                          className="min-h-[40px] py-2 px-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold uppercase hover:bg-red-500 hover:text-white transition inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Cancel &amp; Refund All
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* COMPLAINTS INBOX */}
      {subTab === 'complaints' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#FF5500]/15 border border-[#FF5500]/40 flex items-center justify-center text-[#FF5500]">
                <Flag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-gaming text-xl font-bold uppercase text-white">
                  Complaints &amp; Dispute Inbox
                </h3>
                <p className="text-xs text-slate-400">
                  Review player-reported match issues, screenshots, and mark tickets resolved.
                </p>
              </div>
            </div>
            <span className="text-xs font-bold uppercase text-amber-400 tabular-nums">
              {openComplaintsCount} Open
            </span>
          </div>

          {complaints.length === 0 ? (
            <div className="card-surface rounded-2xl p-8 text-center text-xs text-slate-400">
              No player complaints or dispute tickets submitted yet!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {complaints.map((c) => {
                const isResolved = c.status === 'Resolved';
                const noteVal = complaintNotes[c.id] ?? c.adminNote ?? '';

                return (
                  <div
                    key={c.id}
                    className={`card-surface rounded-2xl p-4 space-y-3 border ${
                      isResolved ? 'border-[#00FF88]/25 opacity-85' : 'border-amber-400/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[#00FF88]">
                            {c.ign || 'Player'}
                          </span>
                          <span className="text-[11px] text-slate-400 truncate">
                            ({c.email})
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-white mt-0.5 truncate">
                          Match: {c.matchTitle || c.matchId || 'General'}
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {formatTimestamp(c.createdAt)}
                        </p>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                          isResolved
                            ? 'bg-[#00FF88]/15 text-[#00FF88]'
                            : 'bg-amber-400/15 text-amber-300'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-[#0B0E14] border border-white/10 space-y-2">
                      <p className="text-xs text-slate-200 whitespace-pre-line">{c.message}</p>
                      {c.screenshotUrl && (
                        <a
                          href={c.screenshotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-400 hover:underline"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Open Screenshot Proof
                        </a>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Admin Resolution Reply (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="Add reply or action taken..."
                        value={noteVal}
                        onChange={(e) =>
                          setComplaintNotes((prev) => ({ ...prev, [c.id]: e.target.value }))
                        }
                        className="w-full min-h-[38px] px-3 py-1.5 rounded-lg bg-[#0B0E14] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {isResolved ? (
                        <button
                          type="button"
                          disabled={busyId === `complaint-${c.id}`}
                          onClick={() => handleUpdateComplaintStatus(c, 'Open')}
                          className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase hover:bg-amber-500/25 disabled:opacity-50"
                        >
                          Reopen Ticket
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busyId === `complaint-${c.id}`}
                          onClick={() => handleUpdateComplaintStatus(c, 'Resolved')}
                          className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl bg-[#00FF88] text-[#0B0E14] text-xs font-bold uppercase hover:brightness-110 disabled:opacity-50"
                        >
                          Mark Resolved
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={busyId === `complaint-del-${c.id}`}
                        onClick={() => handleDeleteComplaint(c.id)}
                        className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold uppercase hover:bg-red-500/25 inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. GLOBAL CONTROLS & WHATSAPP POPUP */}
      {subTab === 'global' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleSaveGlobalSettings}
            className="lg:col-span-7 card-surface rounded-2xl p-5 space-y-5 border border-[#00FF88]/25"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/40 flex items-center justify-center text-[#00FF88] shrink-0">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-gaming text-xl font-bold uppercase text-white">
                  Global Controls
                </h3>
                <p className="text-xs text-slate-400">
                  Live toggles, Force APK update, Dynamic UPI/Links, &amp; Anti-Cheat Rules.
                </p>
              </div>
            </div>

            {/* App Maintenance Mode */}
            <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#FF5500]" />
                  <div>
                    <p className="text-sm font-bold text-white">App Maintenance Mode</p>
                    <p className="text-[11px] text-slate-400">
                      Blocks normal users with full-screen Maintenance overlay (Admin bypasses).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={globalForm.maintenanceMode}
                  onClick={() =>
                    setGlobalForm((g) => ({ ...g, maintenanceMode: !g.maintenanceMode }))
                  }
                  className={`min-h-[34px] px-3.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 ${
                    globalForm.maintenanceMode
                      ? 'bg-[#FF5500] text-white'
                      : 'bg-[#151A23] border border-white/15 text-slate-400'
                  }`}
                >
                  {globalForm.maintenanceMode ? 'ON' : 'OFF'}
                </button>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Maintenance Screen Message
                </label>
                <textarea
                  rows={2}
                  value={globalForm.maintenanceMessage}
                  onChange={(e) =>
                    setGlobalForm((g) => ({ ...g, maintenanceMessage: e.target.value }))
                  }
                  placeholder="We are upgrading our tournament servers. Please check back shortly!"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#151A23] border border-white/10 text-xs text-white focus:outline-none focus:border-[#FF5500]"
                />
              </div>
            </div>

            {/* Force APK Update Popup */}
            <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-[#00FF88]" />
                  <div>
                    <p className="text-sm font-bold text-white">Force APK Update Popup</p>
                    <p className="text-[11px] text-slate-400">
                      Shows a non-dismissible Update App Now modal on user home screen.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={globalForm.forceUpdateEnabled}
                  onClick={() =>
                    setGlobalForm((g) => ({ ...g, forceUpdateEnabled: !g.forceUpdateEnabled }))
                  }
                  className={`min-h-[34px] px-3.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 ${
                    globalForm.forceUpdateEnabled
                      ? 'bg-[#00FF88] text-[#0B0E14]'
                      : 'bg-[#151A23] border border-white/15 text-slate-400'
                  }`}
                >
                  {globalForm.forceUpdateEnabled ? 'ON' : 'OFF'}
                </button>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  APK Download URL (e.g. Netlify / Drive link)
                </label>
                <input
                  type="url"
                  value={globalForm.forceUpdateUrl}
                  onChange={(e) =>
                    setGlobalForm((g) => ({ ...g, forceUpdateUrl: e.target.value }))
                  }
                  placeholder="https://your-app.netlify.app/KryoFrag.apk"
                  className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#151A23] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Update Message</label>
                <textarea
                  rows={2}
                  value={globalForm.forceUpdateMessage}
                  onChange={(e) =>
                    setGlobalForm((g) => ({ ...g, forceUpdateMessage: e.target.value }))
                  }
                  placeholder="A new mandatory update is available with bug fixes and new rooms!"
                  className="w-full px-3.5 py-2 rounded-xl bg-[#151A23] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                />
              </div>
            </div>

            {/* Dynamic UPI & Support Links */}
            <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/10 space-y-3">
              <p className="text-sm font-bold text-white">
                Dynamic UPI, Withdrawal Limit &amp; Support Links
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Payment UPI ID</label>
                  <input
                    type="text"
                    required
                    value={globalForm.upiId}
                    onChange={(e) => setGlobalForm((g) => ({ ...g, upiId: e.target.value }))}
                    placeholder="merchant@okhdfcbank"
                    className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#151A23] border border-white/10 text-xs text-white font-mono-code focus:outline-none focus:border-[#00FF88]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Min Withdrawal (Coins)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={globalForm.minWithdrawal}
                    onChange={(e) =>
                      setGlobalForm((g) => ({
                        ...g,
                        minWithdrawal: Math.max(1, Number(e.target.value) || 1),
                      }))
                    }
                    className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#151A23] border border-white/10 text-xs text-white tabular-nums focus:outline-none focus:border-[#00FF88]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">
                    UPI QR Image URL (Optional — leave blank to auto-generate QR)
                  </label>
                  <input
                    type="url"
                    value={globalForm.upiQrUrl}
                    onChange={(e) => setGlobalForm((g) => ({ ...g, upiQrUrl: e.target.value }))}
                    placeholder="https://example.com/my-upi-qr.png"
                    className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#151A23] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">
                    WhatsApp Support Link or Number
                  </label>
                  <input
                    type="text"
                    value={globalForm.whatsappSupport}
                    onChange={(e) =>
                      setGlobalForm((g) => ({ ...g, whatsappSupport: e.target.value }))
                    }
                    placeholder="https://wa.me/919876543210 or 919876543210"
                    className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#151A23] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Telegram Link</label>
                  <input
                    type="url"
                    value={globalForm.telegramLink}
                    onChange={(e) =>
                      setGlobalForm((g) => ({ ...g, telegramLink: e.target.value }))
                    }
                    placeholder="https://t.me/yourchannel"
                    className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#151A23] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Instagram Link</label>
                  <input
                    type="url"
                    value={globalForm.instagramLink}
                    onChange={(e) =>
                      setGlobalForm((g) => ({ ...g, instagramLink: e.target.value }))
                    }
                    placeholder="https://instagram.com/yourhandle"
                    className="w-full min-h-[40px] px-3.5 py-2 rounded-xl bg-[#151A23] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                  />
                </div>
              </div>
            </div>

            {/* Anti-Cheat Rules Popup */}
            <div className="p-4 rounded-xl bg-[#0B0E14] border border-white/10 space-y-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#00FF88]" />
                <p className="text-sm font-bold text-white">Anti-Cheat Rules Popup Text</p>
              </div>
              <p className="text-[11px] text-slate-400">
                Shown in a confirmation modal before a player joins any tournament match.
              </p>
              <textarea
                rows={4}
                required
                value={globalForm.antiCheatRules}
                onChange={(e) =>
                  setGlobalForm((g) => ({ ...g, antiCheatRules: e.target.value }))
                }
                placeholder="No Emulator/Hacks allowed. Winning screenshot required."
                className="w-full px-3.5 py-2 rounded-xl bg-[#151A23] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <button
              type="submit"
              disabled={savingGlobal}
              className="w-full min-h-[48px] py-3 rounded-xl bg-[#00FF88] text-[#0B0E14] font-gaming font-bold text-base uppercase tracking-wider hover:brightness-110 transition glow-green-sm disabled:opacity-60"
            >
              {savingGlobal ? 'Saving Global Controls...' : 'Save Global Controls'}
            </button>
          </form>

          {/* WhatsApp Channel Popup Control */}
          <form
            onSubmit={handleSaveWhatsappPopup}
            className="lg:col-span-5 card-surface rounded-2xl p-5 space-y-4 border border-[#00FF88]/25"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/40 flex items-center justify-center text-[#00FF88] shrink-0">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-gaming text-xl font-bold uppercase text-white">
                    WhatsApp Channel Popup
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Shown once per session on the user front page.
                  </p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={waPopupForm.enabled}
                onClick={() => setWaPopupForm((w) => ({ ...w, enabled: !w.enabled }))}
                className={`min-h-[34px] px-3.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition shrink-0 ${
                  waPopupForm.enabled
                    ? 'bg-[#00FF88] text-[#0B0E14]'
                    : 'bg-[#0B0E14] border border-white/15 text-slate-400'
                }`}
              >
                {waPopupForm.enabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-medium mb-1.5">
                Popup Message
              </label>
              <textarea
                rows={3}
                required
                value={waPopupForm.message}
                onChange={(e) => setWaPopupForm((w) => ({ ...w, message: e.target.value }))}
                placeholder="Join this channel for offers and free matches"
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-medium mb-1.5">
                WhatsApp Channel URL
              </label>
              <input
                type="url"
                value={waPopupForm.channelUrl}
                onChange={(e) => setWaPopupForm((w) => ({ ...w, channelUrl: e.target.value }))}
                placeholder="https://whatsapp.com/channel/..."
                className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <button
              type="submit"
              disabled={savingWaPopup}
              className="w-full min-h-[46px] py-2.5 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] font-gaming font-bold text-base uppercase tracking-wider hover:bg-[#00FF88] hover:text-[#0B0E14] transition disabled:opacity-60"
            >
              {savingWaPopup ? 'Saving Popup...' : 'Save WhatsApp Popup'}
            </button>
          </form>
        </div>
      )}

      {/* 6. BANNER MANAGER */}
      {subTab === 'banners' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <form
            onSubmit={handleAddBanner}
            className="lg:col-span-5 card-surface rounded-2xl p-5 space-y-4 border border-[#00FF88]/25"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/40 flex items-center justify-center text-[#00FF88] shrink-0">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-gaming text-xl font-bold uppercase text-white">
                  + Add Clickable Banner
                </h3>
                <p className="text-xs text-slate-400">
                  Promote events, offers, or YouTube/WhatsApp links on specific tabs.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-medium mb-1.5">
                Banner Image URL
              </label>
              <input
                type="url"
                required
                value={bannerImageUrl}
                onChange={(e) => setBannerImageUrl(e.target.value)}
                placeholder="https://example.com/tournament-banner.jpg"
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-medium mb-1.5">
                Target Redirect URL
              </label>
              <input
                type="url"
                required
                value={bannerTargetUrl}
                onChange={(e) => setBannerTargetUrl(e.target.value)}
                placeholder="https://youtube.com/... or https://whatsapp.com/..."
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-300 font-medium mb-1.5">
                Target Page
              </label>
              <select
                value={bannerTargetPage}
                onChange={(e) => setBannerTargetPage(e.target.value as BannerTargetPage)}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#0B0E14] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
              >
                {BANNER_PAGES.map((page) => (
                  <option key={page} value={page}>
                    {page}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={savingBanner}
              className="w-full min-h-[46px] py-2.5 rounded-xl bg-[#00FF88] text-[#0B0E14] font-gaming font-bold text-base uppercase tracking-wider hover:brightness-110 transition glow-green-sm disabled:opacity-60"
            >
              {savingBanner ? 'Publishing Banner...' : 'Publish Banner'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            <h3 className="font-gaming text-lg font-bold uppercase text-white">
              Active Banners ({banners.length})
            </h3>
            {banners.length === 0 ? (
              <div className="card-surface rounded-2xl p-6 text-center text-xs text-slate-400">
                No banners added yet.
              </div>
            ) : (
              <div className="space-y-3">
                {banners.map((b) => (
                  <div
                    key={b.id}
                    className="card-surface rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4"
                  >
                    <div className="w-full sm:w-40 aspect-[16/7] rounded-xl overflow-hidden bg-[#0B0E14] border border-white/10 shrink-0">
                      <img
                        src={b.imageUrl}
                        alt={`Banner for ${b.targetPage}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <span className="inline-block px-2 py-0.5 rounded bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-[10px] font-bold uppercase tracking-wider">
                        Page: {b.targetPage}
                      </span>
                      <a
                        href={b.targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-xs text-slate-300 hover:text-[#00FF88] truncate inline-flex items-center gap-1 max-w-full"
                      >
                        <span className="truncate">{b.targetUrl}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </div>
                    <button
                      type="button"
                      disabled={busyId === `banner-${b.id}`}
                      onClick={() => handleDeleteBanner(b.id)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold uppercase hover:bg-red-500/25 inline-flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7. SPIN WHEEL SETTINGS */}
      {subTab === 'spin' && (
        <form
          onSubmit={handleSaveSpinSettings}
          className="max-w-3xl card-surface rounded-2xl p-5 space-y-5"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/40 flex items-center justify-center text-[#00FF88]">
                <Disc className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-gaming text-xl font-bold uppercase text-white">
                  Spin Wheel Settings
                </h3>
                <p className="text-xs text-slate-400">
                  Control daily 24h spin availability, coin slices, and exact win probability
                  weights.
                </p>
              </div>
            </div>

            <label className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={spinForm.enabled}
                onChange={(e) => setSpinForm((s) => ({ ...s, enabled: e.target.checked }))}
                className="w-4 h-4 accent-[#00FF88]"
              />
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  spinForm.enabled ? 'text-[#00FF88]' : 'text-slate-400'
                }`}
              >
                {spinForm.enabled ? 'Wheel ON' : 'Wheel OFF'}
              </span>
            </label>
          </div>

          {(() => {
            const totalWeight = spinForm.segments.reduce(
              (sum, seg) => sum + Math.max(0, Number(seg.weight || 0)),
              0
            );

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Wheel Segments ({spinForm.segments.length}) · Total Weight: {totalWeight}
                  </span>
                  <button
                    type="button"
                    onClick={handleAddSpinSegment}
                    className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88] text-xs font-bold uppercase inline-flex items-center gap-1 hover:bg-[#00FF88]/25 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Segment
                  </button>
                </div>

                <div className="space-y-2.5">
                  {spinForm.segments.map((seg, idx) => {
                    const w = Math.max(0, Number(seg.weight || 0));
                    const pct = totalWeight > 0 ? ((w / totalWeight) * 100).toFixed(1) : '0.0';

                    return (
                      <div
                        key={seg.id}
                        className="p-3 rounded-xl bg-[#0B0E14] border border-white/10 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                      >
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Slice #{idx + 1} Label
                          </label>
                          <input
                            type="text"
                            required
                            value={seg.label}
                            onChange={(e) =>
                              setSpinForm((prev) => ({
                                ...prev,
                                segments: prev.segments.map((item) =>
                                  item.id === seg.id ? { ...item, label: e.target.value } : item
                                ),
                              }))
                            }
                            placeholder="e.g. 5 Coins"
                            className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-[#151A23] border border-white/10 text-xs text-white focus:outline-none focus:border-[#00FF88]"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Reward Coins
                          </label>
                          <input
                            type="number"
                            min={0}
                            required
                            value={seg.coins}
                            onChange={(e) => {
                              const val = Math.max(0, Math.floor(Number(e.target.value) || 0));
                              setSpinForm((prev) => ({
                                ...prev,
                                segments: prev.segments.map((item) =>
                                  item.id === seg.id ? { ...item, coins: val } : item
                                ),
                              }));
                            }}
                            className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-[#151A23] border border-white/10 text-xs text-[#00FF88] font-bold tabular-nums focus:outline-none focus:border-[#00FF88]"
                          />
                        </div>

                        <div className="sm:col-span-3">
                          <label className="block text-[11px] text-slate-400 mb-1">
                            Weight ({pct}% chance)
                          </label>
                          <input
                            type="number"
                            min={0}
                            required
                            value={seg.weight}
                            onChange={(e) => {
                              const val = Math.max(0, Number(e.target.value) || 0);
                              setSpinForm((prev) => ({
                                ...prev,
                                segments: prev.segments.map((item) =>
                                  item.id === seg.id ? { ...item, weight: val } : item
                                ),
                              }));
                            }}
                            className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-[#151A23] border border-white/10 text-xs text-amber-400 font-bold tabular-nums focus:outline-none focus:border-[#00FF88]"
                          />
                        </div>

                        <div className="sm:col-span-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveSpinSegment(seg.id)}
                            className="w-full min-h-[40px] px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold uppercase hover:bg-red-500/25 inline-flex items-center justify-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          <button
            type="submit"
            disabled={savingSpin}
            className="w-full min-h-[46px] py-2.5 rounded-xl bg-[#00FF88] text-[#0B0E14] font-gaming font-bold text-base uppercase tracking-wider hover:brightness-110 transition disabled:opacity-60"
          >
            {savingSpin ? 'Saving...' : 'Save Spin Wheel Settings'}
          </button>
        </form>
      )}

      {/* 8. REFERRALS & PROMO CODES */}
      {subTab === 'referrals' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* REFERRAL & FIRST DEPOSIT BONUS SETTINGS */}
          <form
            onSubmit={handleSaveReferralBonus}
            className="lg:col-span-6 card-surface rounded-2xl p-5 space-y-4 border border-[#FF5500]/30"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#FF5500]/15 border border-[#FF5500]/40 flex items-center justify-center text-[#FF5500]">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-gaming text-xl font-bold uppercase text-white">
                  Referral &amp; Bonus Settings
                </h3>
                <p className="text-xs text-slate-400">
                  Rewards unlock automatically after the referred friend plays a match or completes
                  their first approved deposit.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Referrer Coins (Inviter)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={refBonusForm.referrerCoins}
                  onChange={(e) =>
                    setRefBonusForm((s) => ({
                      ...s,
                      referrerCoins: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    }))
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm font-bold text-[#00FF88] tabular-nums focus:outline-none focus:border-[#00FF88]"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Referee Coins (Friend)
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={refBonusForm.refereeCoins}
                  onChange={(e) =>
                    setRefBonusForm((s) => ({
                      ...s,
                      refereeCoins: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                    }))
                  }
                  className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm font-bold text-amber-400 tabular-nums focus:outline-none focus:border-[#00FF88]"
                />
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#0B0E14] border border-white/10 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00FF88]" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  First Deposit Bonus
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Bonus Type</label>
                  <select
                    value={refBonusForm.firstDepositBonusType}
                    onChange={(e) =>
                      setRefBonusForm((s) => ({
                        ...s,
                        firstDepositBonusType:
                          e.target.value === 'flat' ? 'flat' : 'percentage',
                      }))
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#151A23] border border-white/10 text-sm text-white focus:outline-none focus:border-[#00FF88]"
                  >
                    <option value="percentage">Percentage (+% extra)</option>
                    <option value="flat">Flat Extra Coins (+Coins)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {refBonusForm.firstDepositBonusType === 'percentage'
                      ? 'Bonus Percentage (%)'
                      : 'Flat Bonus Coins'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={refBonusForm.firstDepositBonusValue}
                    onChange={(e) =>
                      setRefBonusForm((s) => ({
                        ...s,
                        firstDepositBonusValue: Math.max(
                          0,
                          Math.floor(Number(e.target.value) || 0)
                        ),
                      }))
                    }
                    className="w-full min-h-[42px] px-3.5 py-2 rounded-xl bg-[#151A23] border border-white/10 text-sm font-bold text-[#00FF88] tabular-nums focus:outline-none focus:border-[#00FF88]"
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-400">
                Set value to 0 to disable First Deposit Bonus. Applied once per user when their
                first deposit is approved.
              </p>
            </div>

            <button
              type="submit"
              disabled={savingRefBonus}
              className="w-full min-h-[46px] py-2.5 rounded-xl bg-[#00FF88] text-[#0B0E14] font-gaming font-bold text-base uppercase tracking-wider hover:brightness-110 transition disabled:opacity-60"
            >
              {savingRefBonus ? 'Saving...' : 'Save Referral & Bonus Settings'}
            </button>
          </form>

          {/* PROMO CODE GENERATOR */}
          <div className="lg:col-span-6 space-y-4">
            <form
              onSubmit={handleCreatePromoCode}
              className="card-surface rounded-2xl p-5 space-y-3.5 border border-[#00FF88]/25"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#00FF88]/15 border border-[#00FF88]/40 flex items-center justify-center text-[#00FF88]">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-gaming text-xl font-bold uppercase text-white">
                    Promo Code Generator
                  </h3>
                  <p className="text-xs text-slate-400">
                    Create giveaway codes with fixed coin value and max redemption count.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Code Name</label>
                  <input
                    type="text"
                    required
                    maxLength={24}
                    value={promoCodeInput}
                    onChange={(e) => setPromoCodeInput(e.target.value.toUpperCase())}
                    placeholder="FREE10"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm font-mono-code font-bold uppercase tracking-wider text-white focus:outline-none focus:border-[#00FF88]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Coins Reward</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={promoCoinsInput}
                    onChange={(e) => setPromoCoinsInput(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm font-bold text-[#00FF88] tabular-nums focus:outline-none focus:border-[#00FF88]"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Max Uses Limit</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={promoMaxUsesInput}
                    onChange={(e) => setPromoMaxUsesInput(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-sm font-bold text-amber-400 tabular-nums focus:outline-none focus:border-[#00FF88]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingPromo}
                className="w-full min-h-[46px] py-2.5 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00CC6E] text-[#0B0E14] font-gaming font-bold text-base uppercase tracking-wider hover:brightness-110 transition disabled:opacity-60"
              >
                {savingPromo ? 'Generating...' : '+ Generate Promo Code'}
              </button>
            </form>

            <div className="card-surface rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-gaming text-lg font-bold uppercase text-white">
                  Active Promo Codes ({promoCodes.length})
                </h4>
              </div>

              {promoCodes.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center">
                  No promo codes generated yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {promoCodes.map((p) => {
                    const exhausted = p.maxUses > 0 && p.usedCount >= p.maxUses;
                    return (
                      <div
                        key={p.id}
                        className="p-3 rounded-xl bg-[#0B0E14] border border-white/10 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <code className="font-mono-code text-sm font-bold tracking-widest text-[#00FF88]">
                              {p.code}
                            </code>
                            <span className="px-2 py-0.5 rounded bg-[#00FF88]/15 text-[#00FF88] text-[10px] font-bold">
                              +{p.coins} Coins
                            </span>
                            {exhausted && (
                              <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 text-[10px] font-bold uppercase">
                                Limit Reached
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 tabular-nums">
                            Used: <strong className="text-white">{p.usedCount}</strong> /{' '}
                            {p.maxUses}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={busyId === `promo-${p.id}`}
                          onClick={() => handleDeletePromoCode(p.id)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold uppercase hover:bg-red-500/25 inline-flex items-center gap-1 shrink-0 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Delete
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 9. APP SETTINGS */}
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
                    key={`${p.uid}-${idx}`}
                    className="p-3 rounded-xl bg-[#0B0E14] border border-white/10 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#00FF88] truncate">
                          #{idx + 1} IGN: {p.ign}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">{p.email}</p>
                      </div>
                      {p.slotLabel && (
                        <span className="px-2 py-0.5 rounded bg-[#151A23] border border-[#00FF88]/30 text-[#00FF88] text-[10px] font-bold shrink-0">
                          {p.slotLabel}
                        </span>
                      )}
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

      {/* ADMIN PUBLISH RESULTS & 1-CLICK AUTO-PAYOUT MODAL */}
      {activePublishModalMatch && (
        <div className="fixed inset-0 z-[75] modal-backdrop flex items-center justify-center p-4">
          <div className="w-full max-w-2xl card-surface rounded-2xl p-5 sm:p-6 border border-amber-400/40 space-y-4 max-h-[90vh] flex flex-col glow-orange">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[11px] font-bold uppercase tracking-widest text-amber-400">
                  Publish Results &amp; 1-Click Auto-Payout
                </span>
                <h3 className="font-gaming text-2xl font-bold uppercase text-white mt-0.5 truncate">
                  {activePublishModalMatch.title}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                  Per Kill:{' '}
                  <span className="text-[#00FF88] font-bold">
                    {Number(activePublishModalMatch.perKill || 0)} Coins
                  </span>{' '}
                  · Booyah Bonus:{' '}
                  <span className="text-amber-400 font-bold">
                    {Number(activePublishModalMatch.booyahPrize || 0)} Coins
                  </span>
                </p>
              </div>
              <button
                type="button"
                disabled={publishingResults}
                onClick={() => setPublishModalMatchId(null)}
                aria-label="Close publish results modal"
                className="min-w-[36px] min-h-[36px] rounded-lg bg-[#0B0E14] text-slate-400 hover:text-white flex items-center justify-center shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {(() => {
              const participants = Array.isArray(activePublishModalMatch.participants)
                ? activePublishModalMatch.participants
                : [];
              const perKill = Math.max(0, Number(activePublishModalMatch.perKill || 0));
              const booyahPrize = Math.max(0, Number(activePublishModalMatch.booyahPrize || 0));
              const totalPayout = participants.reduce((sum, p) => {
                const draft = resultDrafts[p.uid] ?? { kills: 0, isBooyah: false };
                const kills = Math.max(0, Math.floor(Number(draft.kills) || 0));
                return sum + kills * perKill + (draft.isBooyah ? booyahPrize : 0);
              }, 0);
              const booyahCount = participants.filter((p) => resultDrafts[p.uid]?.isBooyah).length;

              return (
                <>
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-[#0B0E14] border border-white/10 text-center">
                    <div>
                      <span className="text-[11px] text-slate-400 block">Players</span>
                      <span className="font-gaming text-lg font-bold text-white tabular-nums">
                        {participants.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Booyah Selected</span>
                      <span className="font-gaming text-lg font-bold text-amber-400 tabular-nums">
                        {booyahCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-400 block">Total Payout</span>
                      <span className="font-gaming text-lg font-bold text-[#00FF88] tabular-nums">
                        {totalPayout} Coins
                      </span>
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
                    {participants.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-400 bg-[#0B0E14] rounded-xl border border-white/5">
                        No participants have joined this match yet.
                      </div>
                    ) : (
                      participants.map((p, idx) => {
                        const draft = resultDrafts[p.uid] ?? { kills: 0, isBooyah: false };
                        const kills = Math.max(0, Math.floor(Number(draft.kills) || 0));
                        const totalCoins = kills * perKill + (draft.isBooyah ? booyahPrize : 0);

                        return (
                          <div
                            key={p.uid}
                            className={`p-3.5 rounded-xl border transition space-y-3 ${
                              draft.isBooyah
                                ? 'bg-amber-400/10 border-amber-400/45'
                                : 'bg-[#0B0E14] border-white/10'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-bold text-white truncate">
                                  #{idx + 1} {p.ign}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate">{p.email}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-gaming text-lg font-bold text-[#00FF88] tabular-nums">
                                  +{totalCoins} Coins
                                </span>
                                <span className="block text-[10px] text-slate-400 uppercase">
                                  Calculated Win
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 items-center">
                              <div>
                                <label
                                  htmlFor={`kills-${p.uid}`}
                                  className="block text-[11px] text-slate-400 mb-1"
                                >
                                  Kills
                                </label>
                                <input
                                  id={`kills-${p.uid}`}
                                  type="number"
                                  min={0}
                                  max={99}
                                  value={draft.kills}
                                  onChange={(e) => {
                                    const nextVal = Math.max(
                                      0,
                                      Math.floor(Number(e.target.value) || 0)
                                    );
                                    setResultDrafts((prev) => ({
                                      ...prev,
                                      [p.uid]: {
                                        kills: nextVal,
                                        isBooyah: Boolean(prev[p.uid]?.isBooyah),
                                      },
                                    }));
                                  }}
                                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg bg-[#151A23] border border-white/15 text-sm font-bold text-white tabular-nums focus:outline-none focus:border-[#00FF88]"
                                />
                              </div>

                              <label
                                htmlFor={`booyah-${p.uid}`}
                                className={`min-h-[40px] mt-5 px-3 py-2 rounded-lg border flex items-center justify-center gap-2 cursor-pointer select-none transition ${
                                  draft.isBooyah
                                    ? 'bg-amber-400/20 border-amber-400 text-amber-300'
                                    : 'bg-[#151A23] border-white/15 text-slate-300 hover:border-amber-400/50'
                                }`}
                              >
                                <input
                                  id={`booyah-${p.uid}`}
                                  type="checkbox"
                                  checked={draft.isBooyah}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setResultDrafts((prev) => ({
                                      ...prev,
                                      [p.uid]: {
                                        kills: prev[p.uid]?.kills ?? 0,
                                        isBooyah: checked,
                                      },
                                    }));
                                  }}
                                  className="w-4 h-4 accent-amber-400 rounded"
                                />
                                <Crown className="w-3.5 h-3.5 shrink-0" />
                                <span className="text-xs font-bold uppercase tracking-wider">
                                  Booyah Winner
                                </span>
                              </label>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      disabled={publishingResults}
                      onClick={() => setPublishModalMatchId(null)}
                      className="min-h-[46px] py-2.5 px-4 rounded-xl bg-[#0B0E14] border border-white/10 text-xs font-bold uppercase text-slate-300 hover:text-white disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={publishingResults || participants.length === 0}
                      onClick={handlePublishResultsAndPayout}
                      className="sm:col-span-2 min-h-[46px] py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#00FF88] to-[#00CC6E] text-[#0B0E14] font-gaming font-bold text-base uppercase tracking-wider hover:brightness-110 transition glow-green-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <Trophy className="w-4 h-4" />
                      {publishingResults
                        ? 'Publishing & Crediting...'
                        : 'Save Results & Auto-Credit All Coins'}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* CANCEL & INSTANT REFUND ALL CONFIRM MODAL */}
      {cancelConfirmMatch && (
        <div className="fixed inset-0 z-[80] modal-backdrop flex items-center justify-center p-4">
          <div className="w-full max-w-sm card-surface rounded-2xl p-5 border border-red-500/45 space-y-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-red-400">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="font-gaming text-xl font-bold uppercase text-white">
              Cancel &amp; Refund All?
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              This will cancel <strong>{cancelConfirmMatch.title}</strong> and automatically refund{' '}
              <strong className="text-[#00FF88]">
                {Number(cancelConfirmMatch.entryFee || 0)} Coins
              </strong>{' '}
              to all {Number(cancelConfirmMatch.joinedCount || 0)} joined player(s).
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setCancelConfirmMatch(null)}
                className="min-h-[42px] py-2 rounded-xl bg-[#0B0E14] border border-white/10 text-xs font-bold uppercase text-slate-300 hover:text-white"
              >
                Keep Match
              </button>
              <button
                type="button"
                onClick={handleCancelAndRefundMatch}
                className="min-h-[42px] py-2 rounded-xl bg-red-500 text-white text-xs font-bold uppercase hover:bg-red-600"
              >
                Refund &amp; Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
