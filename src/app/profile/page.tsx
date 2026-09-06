import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProjectSection } from "@/app/p/[project]/project-section";
import { Binder, type BinderProject } from "@/components/binder";
import { manageableProjectIds } from "@/lib/access-server";
import { memberLabel } from "@/lib/keys";
import { notificationPrefs } from "@/lib/notify";
import { currentMember, supabaseServer } from "@/lib/supabase/server";
import { type CliTokenRow, CliTokens } from "./cli-tokens";
import { NotificationSettings } from "./notification-settings";
import { PortraitEditor } from "./portrait-editor";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  boards:
    | { id: string; slug: string; name: string; cards: { count: number }[] }[]
    | null;
}

export default async function ProfilePage() {
  const member = await currentMember();
  if (!member) redirect("/login?error=member");
  const db = await supabaseServer();
  const [{ data }, canManage, { data: tokens }] = await Promise.all([
    db
      .from("projects")
      .select(
        "id, slug, name, description, boards(id, slug, name, cards(count))",
      )
      .order("name"),
    manageableProjectIds(member),
    db
      .from("cli_tokens")
      .select("id, name, created_at, last_used_at, expires_at")
      .is("revoked_at", null)
      .order("created_at", { ascending: false }),
  ]);
  const projects: BinderProject[] = ((data ?? []) as ProjectRow[]).map((p) => ({
    slug: p.slug,
    name: p.name,
    description: p.description,
    canManage: canManage(p.id),
    boards: [...(p.boards ?? [])]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((b) => ({
        id: b.id,
        slug: b.slug,
        name: b.name,
        cards: b.cards?.[0]?.count ?? 0,
      })),
  }));
  const name = memberLabel(member.display_name);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <Link
        href="/"
        className="eyebrow mb-4 inline-block hover:text-[var(--color-ink)]"
      >
        ← Projects
      </Link>

      <header className="letterhead">
        <div className="min-w-0">
          <h1>{name}</h1>
          <p className="folder-blurb font-mono text-[13px]">{member.email}</p>
        </div>
        <div className="letterhead-aside">
          <PortraitEditor email={member.email} />
        </div>
      </header>

      <ProjectSection id="profile-identity" title="identity">
        <ProfileForm displayName={member.display_name ?? ""} />
      </ProjectSection>

      <ProjectSection id="profile-notifications" title="notifications">
        <NotificationSettings
          initial={notificationPrefs(
            ((member.prefs ?? {}) as Record<string, unknown>).notifications,
          )}
        />
      </ProjectSection>

      <ProjectSection
        id="profile-cli"
        title="cli tokens"
        count={String((tokens ?? []).length)}
      >
        <CliTokens tokens={(tokens ?? []) as CliTokenRow[]} />
      </ProjectSection>

      <ProjectSection
        id="profile-stock"
        title="my cardstock"
        count={String(projects.length)}
        empty={projects.length === 0}
      >
        {projects.length > 0 ? (
          <ul className="folders" aria-label="My cardstock">
            {projects.map((project) => (
              <Binder key={project.slug} project={project} />
            ))}
          </ul>
        ) : (
          <p className="identity-note">
            You have not been added to a project yet. Ask an owner or a project
            admin to add you.
          </p>
        )}
      </ProjectSection>
    </main>
  );
}
