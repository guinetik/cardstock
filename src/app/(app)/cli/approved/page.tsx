import Link from "next/link";

export default function CliApprovedPage() {
  return (
    <main className="mx-auto flex min-h-full max-w-lg items-center p-6">
      <section className="paper-card w-full space-y-4 p-6">
        <h1>CLI approved</h1>
        <p className="folder-blurb">
          Return to your terminal. Cardstock CLI will finish signing in
          automatically.
        </p>
        <Link href="/projects" className="paper-link">
          Back to Cardstock
        </Link>
      </section>
    </main>
  );
}
