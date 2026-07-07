import { adminApi } from "./adminApi";
import type { NotificationSettings } from "@/data/mockAdminData";

export const notificationService = {
  get: () => adminApi.getNotificationSettings(),
  update: (payload: Partial<NotificationSettings>) =>
    adminApi.updateNotificationSettings(payload),
  test: () => adminApi.testNotificationWebhook(),
  remove: () => adminApi.updateNotificationSettings({ webhookUrl: "" }),
};
