/**
 * Admin API layer. Currently backed by the local Zustand store + mock delay.
 * Swap the internals for `fetch` calls when the backend is available — the
 * function signatures should stay stable.
 */
import { useAdminStore } from "@/store/useAdminStore";
import type {
  CommissionSettings,
  DemoAccount,
  NotificationSettings,
  ReferralLevel,
} from "@/data/mockAdminData";

const delay = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms));

export const adminApi = {
  async getMetrics() {
    await delay();
    return useAdminStore.getState().metrics;
  },

  async getReferrals(level: ReferralLevel) {
    await delay();
    return useAdminStore.getState().referrals.filter((r) => r.level === level);
  },

  async createDemoAccounts(payload: DemoAccount[]) {
    await delay();
    useAdminStore.getState().addDemoAccounts(payload);
    return { ok: true, count: payload.length };
  },

  async getReferralLink() {
    await delay(80);
    return useAdminStore.getState().referralLink;
  },

  async updateInfluencerMode(enabled: boolean) {
    await delay(80);
    useAdminStore.getState().setInfluencerMode(enabled);
    return { ok: true };
  },

  async requestWithdrawal(payload: { amount: number; pixKey: string }) {
    await delay();
    useAdminStore.getState().addWithdrawal(payload);
    return { ok: true };
  },

  async getWithdrawals() {
    await delay();
    return useAdminStore.getState().withdrawals;
  },

  async getCommissionSettings() {
    await delay(80);
    return useAdminStore.getState().commissionSettings;
  },

  async updateCommissionSettings(payload: Partial<CommissionSettings>) {
    await delay();
    useAdminStore.getState().updateCommissionSettings(payload);
    return { ok: true };
  },

  async getNotificationSettings() {
    await delay(80);
    return useAdminStore.getState().notifications;
  },

  async updateNotificationSettings(payload: Partial<NotificationSettings>) {
    await delay(150);
    useAdminStore.getState().updateNotifications(payload);
    return { ok: true };
  },

  async testNotificationWebhook() {
    await delay(400);
    const { webhookUrl } = useAdminStore.getState().notifications;
    if (!webhookUrl) return { ok: false, error: "Webhook não configurado" };
    // Real integration would POST to webhookUrl from the server side.
    return { ok: true };
  },
};

export type AdminApi = typeof adminApi;
