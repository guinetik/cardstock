import { ChevronDown } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const name = member.display_name ?? member.email;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1 text-sm hover:underline"
        aria-label="Account menu"
      >
        {name}
        {member.role === "owner" && (
          <span className="rounded-full border px-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            owner
          </span>
        )}
        <ChevronDown className="size-3.5 opacity-60" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block text-sm font-medium">{name}</span>
            <span className="block text-xs text-muted-foreground">
              {member.email}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/" />}>Projects</DropdownMenuItem>
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
