/**
 * Types for railz-backend's admin API. This file is the client-side copy of
 * the contract; nothing here is inferred from responses, so if the backend
 * adds a field it must be added here too before the UI can read it.
 */

export type AdminRole = 'OWNER' | 'AGENT';

export interface Admin {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export interface LoginResult {
  admin: Admin;
  accessToken: string;
}

export interface TicketCounts {
  open: number;
  awaitingUser: number;
  resolved: number;
  closed: number;
}

export interface Stats {
  users: number;
  usersLinkedToBridge: number;
  twoFactorEnabled: number;
  newUsersLast7Days: number;
  tickets: TicketCounts;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  country: string;
  dutchmanCustomerId: string | null;
  twoFactorEnabled: boolean;
  kycCacheSyncedAt: string | null;
  createdAt: string;
}

export type KycLevel = 1 | 2 | 3;
export type KycStatus = 'PENDING' | 'REVIEW' | 'APPROVED' | 'REJECTED';

export interface KycRecord {
  id: string;
  customerId: string;
  level: KycLevel;
  status: KycStatus;
  idType: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface KycReverification {
  items: string[];
  message: string | null;
}

export interface UserDetailRecord extends UserSummary {
  kycRecords: KycRecord[] | null;
  kycReverification: KycReverification | null;
}

export interface WalletBalance {
  currency: string;
  balance: number;
}

export interface WalletAddress {
  network: string;
  address: string;
}

export interface VirtualAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  currency: string;
  status: string;
}

export interface BridgeSnapshot {
  customer: Record<string, unknown>;
  kyc: {
    records: KycRecord[];
    reverification: unknown | null;
  };
  wallet: {
    balances: WalletBalance[];
    addresses: WalletAddress[];
    virtualAccount: VirtualAccount | null;
  };
}

export interface UserDetail {
  user: UserDetailRecord;
  bridge: BridgeSnapshot | null;
  bridgeError: string | null;
}

export interface WithdrawalBankAccount {
  bankName: string;
  accountName: string;
  accountNumberLast4: string;
}

export interface Withdrawal {
  id: string;
  reference: string;
  amount: string;
  currency: string;
  status: string;
  failureReason: string | null;
  bankAccount: WithdrawalBankAccount | null;
  createdAt: string;
}

export interface TwoFactorResetResult {
  twoFactorEnabled: false;
}

export interface KycRefreshResult {
  records: KycRecord[];
  reverification: unknown | null;
}

export type TicketStatus = 'OPEN' | 'AWAITING_USER' | 'RESOLVED' | 'CLOSED';
export type TicketCategory = 'TRANSACTION' | 'VERIFICATION' | 'ACCOUNT' | 'OTHER';
export type MessageAuthorType = 'USER' | 'ADMIN';

export interface TicketCustomer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface TicketLastMessage {
  authorType: MessageAuthorType;
  body: string;
  createdAt: string;
}

export interface Ticket {
  id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  transactionReference: string | null;
  lastMessageAt: string;
  userLastReadAt: string | null;
  createdAt: string;
  customer: TicketCustomer;
  lastMessage: TicketLastMessage | null;
}

export interface TicketMessage {
  id: string;
  authorType: MessageAuthorType;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface TicketDetail {
  ticket: Ticket;
  customer: TicketCustomer;
  messages: TicketMessage[];
}

export const TICKET_STATUSES: readonly TicketStatus[] = [
  'OPEN',
  'AWAITING_USER',
  'RESOLVED',
  'CLOSED',
] as const;

export type FeatureStatus = 'LIVE' | 'COMING_SOON' | 'OFF';

export interface Feature {
  key: string;
  /** What the switch controls, in the backend's own words. */
  label: string;
  status: FeatureStatus;
  /**
   * Whether a request may proceed. Only LIVE does -- COMING_SOON is not a
   * soft version of on, so this is not `status !== 'OFF'`.
   */
  enabled: boolean;
  /** Shown to users while the capability is unavailable. */
  message: string | null;
  updatedBy: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

export const FEATURE_STATUSES: readonly FeatureStatus[] = [
  'LIVE',
  'COMING_SOON',
  'OFF',
] as const;

/** What each state means to an operator choosing between them. */
export const FEATURE_STATUS_HINTS: Record<FeatureStatus, string> = {
  LIVE: 'Working normally.',
  COMING_SOON: 'Visible but not usable yet.',
  OFF: 'Switched off — an outage or a pause.',
};

/** A staff account, as /admin/admins returns it. Never carries a hash. */
export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export const ADMIN_ROLES: readonly AdminRole[] = ['OWNER', 'AGENT'] as const;

/** What each role may do, so the choice is not made on the word alone. */
export const ADMIN_ROLE_HINTS: Record<AdminRole, string> = {
  OWNER: 'Everything an agent can do, plus managing these accounts.',
  AGENT: 'Support and operations: customers, tickets, switches.',
};

/** Matches the backend DTO; checked here so a too-short password is caught
 * before it is sent anywhere. */
export const MIN_ADMIN_PASSWORD_LENGTH = 12;

