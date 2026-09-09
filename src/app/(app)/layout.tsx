import { ActivityIndicator } from "@/components/activity";
import Link from "@/components/activity-link";
import { BoardPicker } from "@/components/board-picker";
import { NavigationActivity } from "@/components/navigation-activity";
import { UserMenu } from "@/components/user-menu";
import { WatchNotifications } from "@/components/watch-notifications";
import { notificationPrefs } from "@/lib/notify";
import { currentMember } from "@/lib/supabase/server";

/**
 * The app's chrome. Everything behind a session wears the topbar; the landing
 * page at `/` carries its own rail and nav instead, which is why this sits in a
 * route group rather than in the root layout.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const member = await currentMember();
  return (
    <NavigationActivity>
      <header className="paper-topbar flex h-12 shrink-0 items-center justify-between px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Link
            href="/projects"
            className="shrink-0 font-heading text-[15px] font-semibold tracking-tight"
          >
            cardstock
          </Link>
          <BoardPicker />
        </div>
        <UserMenu />
      </header>
      {children}
      <ActivityIndicator />
      {member && (
        <WatchNotifications
          memberId={member.id}
          email={member.email}
          prefs={notificationPrefs(
            (member.prefs as Record<string, unknown> | null)?.notifications,
          )}
        />
      )}
    </NavigationActivity>
  );
}
