import { after } from "next/server";
import { deliverWatchMail } from "@/lib/watch-mail";

export function scheduleWatchMail() {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.CARDSTOCK_NOTIFICATION_EMAILS !== "true"
  )
    return;
  after(async () => {
    try {
      await deliverWatchMail();
    } catch (error) {
      console.error("Watch email delivery failed", error);
    }
  });
}
