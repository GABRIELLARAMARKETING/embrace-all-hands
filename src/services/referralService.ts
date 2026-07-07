import { adminApi } from "./adminApi";
import type { ReferralLevel } from "@/data/mockAdminData";

export const referralService = {
  getLink: () => adminApi.getReferralLink(),
  list: (level: ReferralLevel) => adminApi.getReferrals(level),
  setInfluencer: (enabled: boolean) => adminApi.updateInfluencerMode(enabled),
};
