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

export function GarmentSourceDisplay({ source, sourceUser }) {
  if (!source) return null;

  const hasDisplay = source.displayName || source.url;
  if (!hasDisplay) return null;

  const isUserSource = source.type === "user";
  const showUserLink = isUserSource && sourceUser?.username;

  return (
    <div className="mt-4 flex items-center gap-3">
      <span>Source</span>
      {showUserLink ? (
        <Link
          href={`/user/${encodeURIComponent(sourceUser.username)}`}
          className="flex items-center gap-3"
        >
          {sourceUser.imageUrl && (
            <div className="relative size-12 shrink-0 overflow-hidden rounded-full bg-muted">
              <Image
                src={sourceUser.imageUrl}
                alt={`${sourceUser.username}'s avatar`}
                width={48}
                height={48}
                unoptimized
              />
            </div>
          )}
          <span className="font-medium text-lg">{sourceUser.username}</span>
        </Link>
      ) : isUserSource && source.displayName ? (
        <span className="font-medium text-lg">{source.displayName}</span>
      ) : source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-lg text-primary hover:underline"
        >
          {source.displayName || source.url}
        </a>
      ) : (
        <span className="font-medium text-lg">{source.displayName}</span>
      )}
    </div>
  );
}
