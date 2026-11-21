import type { Timestamp } from 'firebase/firestore';

export type AppTab =
  | 'matches'
  | 'wallet'
  | 'my-matches'
  | 'leaderboard'
  | 'gifts'
  | 'support'
  | 'admin';
export type MatchTypeFilter = 'All' | 'Solo' | 'Duo' | 'Squad';
export type AdminSubTab =
  | 'deposits'
  | 'withdrawals'
  | 'users'
  | 'matches'
  | 'complaints'
  | 'global'
  | 'banners'
  | 'spin'
  | 'referrals'
  | 'settings';

export type BannerTargetPage = 'Home' | 'Wallet' | 'Gifts' | 'Profile' | 'All Pages';

export type FirestoreTime = Timestamp | string | Date | { seconds: number } | null | undefined;

export interface UserProfile {
  id: string;
  email: string;
  ign?: string;
  mobileNumber?: string;
  ffUid?: string;
  ffUidLocked?: boolean;
  isBlocked?: boolean;
  walletBalance: number;
  referralCode?: string;
  referredByUid?: string;
  referredByCode?: string;
  referralStatus?: 'none' | 'pending' | 'credited';
  hasApprovedDeposit?: boolean;
  lastSpinTime?: number;
  redeemedPromoCodes?: string[];
  createdAt?: FirestoreTime;
}

export interface MatchParticipant {
  uid: string;
  email: string;
  ign: string;
  joinedAt: string;
  teamNumber?: number;
  slotLetter?: string;
  slotLabel?: string;
}

export interface MatchResultEntry {
  rank: number;
  uid: string;
  ign: string;
  email?: string;
  kills: number;
  isBooyah: boolean;
  coinsWon: number;
}

export interface TournamentMatch {
  id: string;
  title: string;
  map: string;
  type: 'Solo' | 'Duo' | 'Squad' | string;
  dateTime: string;
  entryFee: number;
  perKill: number;
  booyahPrize: number;
  maxSlots: number;
  joinedCount: number;
  participants: MatchParticipant[];
  gunSkinAllowed?: boolean;
  charSkillAllowed?: boolean;
  watchLiveUrl?: string;
  roomPublished?: boolean;
  roomId?: string;
  roomPass?: string;
  status?: 'Upcoming' | 'Completed' | 'Cancelled' | string;
  resultsPublished?: boolean;
  results?: MatchResultEntry[];
  resultsPublishedAt?: FirestoreTime;
  cancelledAt?: FirestoreTime;
  createdAt?: FirestoreTime;
}

export interface ComplaintTicket {
  id: string;
  uid: string;
  email: string;
  ign?: string;
  matchId: string;
  matchTitle?: string;
  message: string;
  screenshotUrl?: string;
  status: 'Open' | 'Resolved' | string;
  adminNote?: string;
  createdAt?: FirestoreTime;
  resolvedAt?: FirestoreTime;
}

export interface WalletTransaction {
  id: string;
  uid: string;
  type: string;
  amount: number;
  isCredit: boolean;
  status: string;
  description: string;
  createdAt?: FirestoreTime;
}

export interface DepositRequest {
  id: string;
  uid: string;
  email: string;
  amount: number;
  utr: string;
  senderInfo?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  createdAt?: FirestoreTime;
}

export interface WithdrawalRequest {
  id: string;
  uid: string;
  email: string;
  amount: number;
  upiId: string;
  status: 'Pending' | 'Paid' | 'Rejected' | string;
  createdAt?: FirestoreTime;
}

export interface AppSettings {
  appName: string;
  whatsappChannel: string;
  whatsappSupport: string;
  socialLink: string;
  noticeBanner: string;
  rules: string;
}

export interface GlobalSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  forceUpdateEnabled: boolean;
  forceUpdateUrl: string;
  forceUpdateMessage: string;
  upiId: string;
  upiQrUrl: string;
  whatsappSupport: string;
  telegramLink: string;
  instagramLink: string;
  minWithdrawal: number;
  antiCheatRules: string;
  updatedAt?: FirestoreTime;
}

export interface WhatsappPopupSettings {
  enabled: boolean;
  message: string;
  channelUrl: string;
  updatedAt?: FirestoreTime;
}

export interface BannerItem {
  id: string;
  imageUrl: string;
  targetUrl: string;
  targetPage: BannerTargetPage;
  createdAt?: FirestoreTime;
}

export interface SpinSegment {
  id: string;
  label: string;
  coins: number;
  weight: number;
}

export interface SpinWheelSettings {
  enabled: boolean;
  segments: SpinSegment[];
  updatedAt?: FirestoreTime;
}

export interface ReferralBonusSettings {
  referrerCoins: number;
  refereeCoins: number;
  firstDepositBonusType: 'percentage' | 'flat';
  firstDepositBonusValue: number;
  updatedAt?: FirestoreTime;
}

export interface PromoCodeItem {
  id: string;
  code: string;
  coins: number;
  maxUses: number;
  usedCount: number;
  createdAt?: FirestoreTime;
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
