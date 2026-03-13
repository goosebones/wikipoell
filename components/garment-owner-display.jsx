import Image from "next/image";
import Link from "next/link";

export function GarmentUploaderDisplay({ user }) {
  if (!user?.username) return null;

  return (
    <div className="mt-4 flex items-center gap-3">
      <span>Uploaded by</span>
      <Link
        href={`/user/${encodeURIComponent(user.username)}`}
        className="flex items-center gap-3"
      >
        {user.imageUrl && (
          <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-muted">
            <Image
              src={user.imageUrl}
              alt={`${user.username}'s avatar`}
              width={48}
              height={48}
              unoptimized
            />
          </div>
        )}
        <span className="font-medium text-lg">{user.username}</span>
      </Link>
    </div>
  );
}

export function GarmentSourceDisplay({ source }) {
  if (!source) return null;

  // { type: "me" } or { type: "external", label, url? }
  if (source.type === "me") {
    return (
      <div className="mt-4 flex items-center gap-3">
        <span>Source</span>
        <span className="font-medium text-lg">This user's own garment</span>
      </div>
    );
  }

  if (source.type === "external") {
    const label =
      typeof source.label === "string" && source.label.trim().length > 0
        ? source.label.trim()
        : undefined;
    const url =
      typeof source.url === "string" && source.url.trim().length > 0
        ? source.url.trim()
        : undefined;

    if (!label && !url) return null;

    return (
      <div className="mt-4 flex items-center gap-3">
        <span>Source</span>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-lg text-primary hover:underline"
          >
            {label || url}
          </a>
        ) : (
          <span className="font-medium text-lg">{label}</span>
        )}
      </div>
    );
  }

  return null;
}
