import Link from "next/link";
import { redirect } from "next/navigation";
import { ImportProjectDialog } from "@/components/import-project-dialog";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

export default async function Home() {
  const member = await currentMember();
  if (!member) redirect("/login?error=member");
  const db = await supabaseServer();
  const { data: projects } = await db
    .from("projects")
    .select("id, slug, name, description, boards(slug, name)")
    .order("name");
  return (
    <main className="mx-auto w-full max-w-4xl p-6">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
        {member.role === "owner" && <ImportProjectDialog />}
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {(projects ?? []).map((p) => (
          <li key={p.id} className="glass-card p-5">
            <Link
              href={`/p/${p.slug}`}
              className="text-lg font-semibold hover:underline"
            >
              {p.name}
            </Link>
            {p.description && (
              <p className="mt-1 text-sm text-muted-foreground">
                {p.description}
              </p>
            )}
            <ul className="mt-3 space-y-1">
              {(p.boards ?? []).map((b) => (
                <li key={b.slug}>
                  <Link
                    href={`/p/${p.slug}/b/${b.slug}`}
                    className="text-sm text-primary hover:underline"
                  >
                    {b.name} →
                  </Link>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      {!projects?.length && (
        <p className="text-sm text-muted-foreground">
          You are not a member of any project yet.
        </p>
      )}
    </main>
  );
}
