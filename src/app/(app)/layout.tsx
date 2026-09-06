import Link from "next/link";
import { UserMenu } from "@/components/user-menu";

/**
 * The app's chrome. Everything behind a session wears the topbar; the landing
 * page at `/` carries its own rail and nav instead, which is why this sits in a
 * route group rather than in the root layout.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="paper-topbar flex h-12 shrink-0 items-center justify-between px-4">
        <Link
          href="/projects"
          className="font-heading text-[15px] font-semibold tracking-tight"
        >
          cardstock
        </Link>
        <UserMenu />
      </header>
      {children}
    </>
  );
}
