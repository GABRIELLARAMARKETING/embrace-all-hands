export type ReferralLevel = 1 | 2 | 3;

export interface AdminMetrics {
  pendingDeposits: number;
  pendingWithdrawals: number;
  totalReferrals: number;
  received24h: number;
  withdrawn24h: number;
  totalReceived: number;
}

export interface ReferralUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  totalDeposited: number;
  hasDeposit: boolean;
  level: ReferralLevel;
  parentId: string | null;
}

export interface CommissionSettings {
  budgetPercent: number;
  n1Percent: number | null;
  n2Percent: number | null;
  n3Percent: number | null;
  defaultN1: number;
  defaultN2: number;
  defaultN3: number;
}

export interface WithdrawalRequest {
  id: string;
  amount: number;
  pixKey: string;
  status: "Pendente" | "Aprovado" | "Recusado";
  createdAt: string;
}

export interface DemoAccount {
  id: string;
  name: string;
  phone: string;
  password: string;
  initialBalance: number;
  createdAt: string;
}

export type NotificationEventKey = "signup" | "deposit" | "sale";

export interface NotificationSettings {
  webhookUrl: string;
  enabledEvents: Record<NotificationEventKey, boolean>;
}

export interface AdminState {
  metrics: AdminMetrics;
  referralLink: string;
  influencerMode: boolean;
  commissionSettings: CommissionSettings;
  withdrawals: WithdrawalRequest[];
  referrals: ReferralUser[];
  demoAccounts: DemoAccount[];
  availableBalance: number;
  notifications: NotificationSettings;
}

export const INITIAL_ADMIN_STATE: AdminState = {
  metrics: {
    pendingDeposits: 0,
    pendingWithdrawals: 0,
    totalReferrals: 1,
    received24h: 0,
    withdrawn24h: 0,
    totalReceived: 0,
  },
  referralLink: "https://multihelixbr.online/?ref=YCWM29",
  influencerMode: false,
  commissionSettings: {
    budgetPercent: 70,
    defaultN1: 50,
    defaultN2: 5,
    defaultN3: 1,
    n1Percent: null,
    n2Percent: null,
    n3Percent: null,
  },
  withdrawals: [],
  referrals: [],
  demoAccounts: [],
  availableBalance: 0,
  notifications: {
    webhookUrl: "",
    enabledEvents: { signup: true, deposit: true, sale: true },
  },
};
