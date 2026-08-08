import React, { useEffect, useState } from "react";

export type ChatAuthenticatedImageProps = {
  src: string;
  alt: string;
  className?: string;
};

export function ChatAuthenticatedImage({ src, alt, className }: ChatAuthenticatedImageProps): React.ReactElement {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const res = await fetch(src, { credentials: "include" });
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch {
        // leave broken
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (!blobUrl) {
    return <div className={className} aria-label={alt} />;
  }

  return <img src={blobUrl} alt={alt} className={className} />;
}
