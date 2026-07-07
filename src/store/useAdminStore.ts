import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  INITIAL_ADMIN_STATE,
  type AdminState,
  type CommissionSettings,
  type DemoAccount,
  type NotificationSettings,
  type ReferralLevel,
  type WithdrawalRequest,
} from "@/data/mockAdminData";

interface AdminStore extends AdminState {
  setInfluencerMode: (v: boolean) => void;
  updateCommissionSettings: (partial: Partial<CommissionSettings>) => void;
  resetCommissionSettings: () => void;
  addWithdrawal: (w: Omit<WithdrawalRequest, "id" | "createdAt" | "status">) => void;
  addDemoAccounts: (list: DemoAccount[]) => void;
  filterReferralsByLevel: (level: ReferralLevel, query: string) => ReturnType<() => AdminState["referrals"]>;
  updateNotifications: (partial: Partial<NotificationSettings>) => void;
  toggleNotificationEvent: (key: keyof NotificationSettings["enabledEvents"]) => void;
  removeWebhook: () => void;
  refreshMetrics: () => void;
}

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const useAdminStore = create<AdminStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_ADMIN_STATE,

      setInfluencerMode: (v) => set({ influencerMode: v }),

      updateCommissionSettings: (partial) =>
        set({
          commissionSettings: { ...get().commissionSettings, ...partial },
        }),

      resetCommissionSettings: () =>
        set({
          commissionSettings: {
            ...get().commissionSettings,
            n1Percent: null,
            n2Percent: null,
            n3Percent: null,
          },
        }),

      addWithdrawal: ({ amount, pixKey }) =>
        set((s) => ({
          withdrawals: [
            {
              id: genId(),
              amount,
              pixKey,
              status: "Pendente",
              createdAt: new Date().toISOString(),
            },
            ...s.withdrawals,
          ],
          metrics: {
            ...s.metrics,
            pendingWithdrawals: s.metrics.pendingWithdrawals + 1,
          },
        })),

      addDemoAccounts: (list) =>
        set((s) => ({ demoAccounts: [...list, ...s.demoAccounts] })),

      filterReferralsByLevel: (level, query) => {
        const q = query.trim().toLowerCase();
        return get().referrals.filter((r) => {
          if (r.level !== level) return false;
          if (!q) return true;
          return (
            r.name.toLowerCase().includes(q) ||
            r.email.toLowerCase().includes(q) ||
            r.phone.toLowerCase().includes(q)
          );
        });
      },

      updateNotifications: (partial) =>
        set((s) => ({ notifications: { ...s.notifications, ...partial } })),

      toggleNotificationEvent: (key) =>
        set((s) => ({
          notifications: {
            ...s.notifications,
            enabledEvents: {
              ...s.notifications.enabledEvents,
              [key]: !s.notifications.enabledEvents[key],
            },
          },
        })),

      removeWebhook: () =>
        set((s) => ({ notifications: { ...s.notifications, webhookUrl: "" } })),

      refreshMetrics: () => {
        // Placeholder: recompute derived values from local state.
        const s = get();
        set({
          metrics: {
            ...s.metrics,
            totalReferrals: Math.max(1, s.referrals.length),
          },
        });
      },
    }),
    {
      name: "gerente-helix:admin:v1",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage),
      ),
      partialize: (state) => ({
        metrics: state.metrics,
        availableBalance: state.availableBalance,
        referrals: state.referrals,
        influencerMode: state.influencerMode,
        commissionSettings: state.commissionSettings,
        withdrawals: state.withdrawals,
        demoAccounts: state.demoAccounts,
        notifications: state.notifications,
      }),
      // Avoid SSR/CSR hydration mismatch: only read from localStorage on the client.
      skipHydration: typeof window === "undefined",

    },
  ),
);
