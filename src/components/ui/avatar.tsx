import { avatarColour, cn, initialsOf } from "@/lib/utils";

const SIZES = {
  sm: "size-7 text-[12px]",
  md: "size-9 text-[12.5px]",
  lg: "size-11 text-[15px]",
} as const;

/**
 * Initials on a colour derived from the name, so the same person is the same
 * colour everywhere without storing an avatar for creators we have only
 * imported from a CSV.
 *
 * When a photo exists it is layered over the initials rather than replacing
 * them. A broken or slow image then falls back to initials on its own, with no
 * state and no client bundle — which matters because avatars appear on every
 * row of every table in the product.
 */
export function Avatar({
  name,
  src,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      title={name}
      style={{ background: avatarColour(name) }}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white",
        SIZES[size],
        className,
      )}
    >
      <span aria-hidden>{initialsOf(name)}</span>
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      )}
    </span>
  );
}
