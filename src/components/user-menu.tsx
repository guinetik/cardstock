import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { Portrait } from "@/components/portrait";
import { ThemeMenuItem } from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { memberLabel } from "@/lib/keys";
import { currentMember } from "@/lib/supabase/server";

/**
 * The signed-in member, in the topbar. Renders nothing when signed out, so the
 * login screen keeps its bare header.
 *
 * This is the home for account-level actions — sign out lives here rather than
 * in the board header, where it was unreachable from the projects page.
 */
export async function UserMenu() {
  const member = await currentMember();
  if (!member) return null;
  const name = memberLabel(member.display_name);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2 text-sm hover:underline"
        aria-label="Account menu"
      >
        {name}
        <Portrait
          email={member.email}
          size={34}
          className="portrait portrait--topbar"
        />
        <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium">{name}</span>
              {member.role === "owner" && (
                <span className="border border-[var(--border-strong)] px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                  owner
                </span>
              )}
            </span>
            <span className="block text-xs text-muted-foreground">
              {member.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/profile" />}>
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/" />}>Projects</DropdownMenuItem>
        {member.role === "owner" && (
          <DropdownMenuItem render={<Link href="/users" />}>
            Users
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <ThemeMenuItem />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={
            // A POST, so signing out cannot happen by prefetch or by link.
            <form action="/auth/signout" method="post">
              <button type="submit" className="w-full text-left">
                Sign out
              </button>
            </form>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
