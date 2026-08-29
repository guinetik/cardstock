"use client";

import { GravatarQuickEditorCore } from "@gravatar-com/quick-editor";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Portrait } from "@/components/portrait";

const CDN_SETTLE_MS = 1500;

/**
 * Large portrait plus Gravatar Quick Editor. The popup is Gravatar's; we only
 * open it and refresh the square once they save.
 */
export function PortraitEditor({ email }: { email: string }) {
  const router = useRouter();
  const editor = useRef<GravatarQuickEditorCore | null>(null);
  const [bust, setBust] = useState<number | undefined>();

  useEffect(() => {
    const instance = new GravatarQuickEditorCore({
      email,
      scope: ["avatars"],
      onProfileUpdated: (kind) => {
        if (kind !== "avatar_updated") return;
        window.setTimeout(() => {
          setBust(Date.now());
          router.refresh();
        }, CDN_SETTLE_MS);
      },
    });
    editor.current = instance;
    return () => {
      instance.close();
      editor.current = null;
    };
  }, [email, router]);

  return (
    <div className="flex flex-col items-end gap-2">
      <Portrait
        email={email}
        size={88}
        className="portrait portrait--lg"
        bust={bust}
      />
      <button
        type="button"
        className="paper-link text-sm"
        onClick={() => editor.current?.open()}
      >
        Change portrait
      </button>
    </div>
  );
}
