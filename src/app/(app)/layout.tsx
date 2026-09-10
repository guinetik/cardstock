import { ActivityIndicator } from "@/components/activity";
import Link from "@/components/activity-link";
import { BoardPicker } from "@/components/board-picker";
import { BoardViewsNav } from "@/components/board-views-nav";
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
      <header className="paper-topbar flex h-12 shrink-0 items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-4 sm:gap-6">
          {/* The wordmark and the switcher share the first lane's column, so the
              switcher ends where the unsorted lane does. */}
          <div className="lane-column-width flex min-w-0 items-center gap-2 sm:gap-3">
            <Link
              href="/projects"
              className="relative top-0.5 shrink-0 font-heading text-[18px] font-semibold tracking-tight"
            >
              cardstock
            </Link>
            <BoardPicker />
          </div>
          <BoardViewsNav />
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
