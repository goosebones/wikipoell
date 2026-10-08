// Centers content at the site's maximum width with the standard side padding
// (16px on phones, 24px from `sm` up). Every page and the header/footer use it,
// so edges line up across the site.
// Props: children, className (extra classes, e.g. vertical padding).
import { cn } from "@/lib/utils";

export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1400px] px-4 sm:px-6", className)}
    >
      {children}
    </div>
  );
}
