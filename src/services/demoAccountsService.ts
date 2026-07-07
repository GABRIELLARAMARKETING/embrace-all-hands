import type { DemoAccount } from "@/data/mockAdminData";
import { adminApi } from "./adminApi";
import { sanitizeText } from "@/utils/sanitize";

export interface CreateDemoInput {
  namePattern: string;
  passwordPattern?: string;
  quantity: number;
  initialBalance: number;
}

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const demoAccountsService = {
  async create(input: CreateDemoInput): Promise<DemoAccount[]> {
    const name = sanitizeText(input.namePattern, 30);
    const pwdBase = sanitizeText(input.passwordPattern || name, 30);
    const list: DemoAccount[] = Array.from({ length: input.quantity }, (_, i) => {
      const n = i + 1;
      return {
        id: genId(),
        name: `${name} ${n}`,
        phone: `+55 (11) 9${String(90000000 + n).slice(0, 8)}`,
        password: `${pwdBase}@${n}`,
        initialBalance: input.initialBalance,
        createdAt: new Date().toISOString(),
      };
    });
    await adminApi.createDemoAccounts(list);
    return list;
  },
};
