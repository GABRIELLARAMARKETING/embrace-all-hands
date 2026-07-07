import { adminApi } from "./adminApi";

export const withdrawalService = {
  list: () => adminApi.getWithdrawals(),
  request: (payload: { amount: number; pixKey: string }) =>
    adminApi.requestWithdrawal(payload),
};
