import { useEffect, useState } from 'react';

import { signedUrls } from './api';

/** Signed URLs for a set of storage paths (dog photos or vet records), refreshed when they change. */
export function useSigned(bucket: 'dog-photos' | 'vaccine-docs' | 'partner-docs', paths: (string | null | undefined)[]) {
  const key = paths.filter(Boolean).sort().join('|');
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!key) return;
    let live = true;
    signedUrls(bucket, key.split('|')).then((u) => live && setUrls(u)).catch(() => {});
    return () => { live = false; };
  }, [bucket, key]);
  return urls;
}
