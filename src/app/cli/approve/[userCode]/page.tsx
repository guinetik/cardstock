import Link from "next/link";
import { approveCliLogin } from "./actions";

export default async function CliApprovalPage(props: {
  params: Promise<{ userCode: string }>;
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const { userCode } = await props.params;
  const { error } = await props.searchParams;
  return (
    <main className="mx-auto flex min-h-full max-w-lg items-center p-6">
      <section className="paper-card w-full space-y-5 p-6">
        <div>
          <p className="eyebrow">Cardstock CLI</p>
          <h1>Approve sign-in</h1>
          <p className="folder-blurb mt-2">
            Approve this browser request to sign the CLI in as your Cardstock
            account.
          </p>
        </div>
        {error === "expired" ? (
          <p role="alert">
            This request expired or was already used. Run `cardstock login`
            again.
          </p>
        ) : (
          <form action={approveCliLogin.bind(null, userCode)}>
            <button type="submit">Approve Cardstock CLI</button>
          </form>
        )}
        <Link href="/" className="paper-link">
          Cancel
        </Link>
      </section>
    </main>
  );
}
