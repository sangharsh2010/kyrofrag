import type { Timestamp } from 'firebase/firestore';

export type AppTab = 'matches' | 'wallet' | 'my-matches' | 'support' | 'admin';
export type MatchTypeFilter = 'All' | 'Solo' | 'Duo' | 'Squad';
export type AdminSubTab =
  | 'deposits'
  | 'withdrawals'
  | 'users'
  | 'matches'
  | 'notifications'
  | 'settings';

export type FirestoreTime = Timestamp | string | Date | { seconds: number } | null | undefined;

export interface UserProfile {
  id: string;
  email: string;
  ign?: string;
  mobileNumber?: string;
  isBlocked?: boolean;
  walletBalance: number;
  createdAt?: FirestoreTime;
}

export interface MatchParticipant {
  uid: string;
  email: string;
  ign: string;
  joinedAt: string;
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
  roomId?: string;
  roomPass?: string;
  status?: 'Upcoming' | 'Completed' | string;
  resultsPublished?: boolean;
  results?: MatchResultEntry[];
  resultsPublishedAt?: FirestoreTime;
  createdAt?: FirestoreTime;
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

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
