import { redirect } from "next/navigation";
import { Binder, type BinderProject } from "@/components/binder";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { ImportProjectDialog } from "@/components/import-project-dialog";
import { manageableProjectIds } from "@/lib/access-server";
import { currentMember, supabaseServer } from "@/lib/supabase/server";

/** The shape `boards(..., cards(count))` comes back in. */
interface ProjectRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  boards:
    | { id: string; slug: string; name: string; cards: { count: number }[] }[]
    | null;
}

export default async function Home() {
  const member = await currentMember();
  if (!member) redirect("/login?error=member");
  const db = await supabaseServer();
  const [{ data }, canManage] = await Promise.all([
    db
      .from("projects")
      .select(
        "id, slug, name, description, boards(id, slug, name, cards(count))",
      )
      .order("name"),
    manageableProjectIds(member),
  ]);
  const projects: (BinderProject & { id: string })[] = (
    (data ?? []) as ProjectRow[]
  ).map((p) => ({
    id: p.id,
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
  const owner = member.role === "owner";
  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="max-w-2xl">
          <h1 className="text-[36px] leading-none">Projects</h1>
          <p className="mt-3 text-[16px] leading-snug text-[var(--color-ink2)]">
            A project is a collection of boards. A board is where cards go to be
            worked; its epic cockpit is where you take stock.
          </p>
        </div>
        {owner && (
          <div className="flex items-center gap-2">
            <ImportProjectDialog />
            <CreateProjectDialog />
          </div>
        )}
      </header>
      {projects.length > 0 ? (
        <ul className="folders">
          {projects.map((p) => (
            <Binder key={p.id} project={p} />
          ))}
        </ul>
      ) : (
        <div className="folder folder--empty max-w-xl">
          <span className="folder-tab">
            <span>{owner ? "No projects yet" : "No projects to show"}</span>
          </span>
          <div className="folder-body">
            <p className="folder-blurb">
              {owner
                ? "Create a project, then add a board to it and start filing cards."
                : "You have not been added to a project yet. Ask an owner or a project admin to add you."}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
