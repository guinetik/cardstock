import Image from "next/image";
import { gravatarUrl } from "@/lib/gravatar";

/** A square Gravatar cut on the stock, never a round clip. */
export function Portrait({
  email,
  size = 36,
  className,
  bust,
}: {
  email: string;
  size?: number;
  className?: string;
  /** Cache-buster after Quick Editor saves a new avatar. */
  bust?: number;
}) {
  const px = Math.max(size, 16);
  return (
    <Image
      className={className ?? "portrait"}
      src={gravatarUrl(email, px * 2, bust)}
      alt=""
      width={px}
      height={px}
      referrerPolicy="no-referrer"
      unoptimized
    />
  );
}
