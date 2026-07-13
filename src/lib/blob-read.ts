import { head } from "@vercel/blob";

// Read a JSON blob by pathname through the SDK. Blobs live at a store-scoped
// host (https://<store-id>.public.blob.vercel-storage.com/...), so the bare
// https://blob.vercel-storage.com/<path> fetches this replaces could never
// succeed — head() resolves the real URL from the pathname.
// Best-effort by design: any failure (missing blob, no token, timeout)
// returns null so callers degrade instead of hanging or throwing.
export async function readBlobJson<T = unknown>(pathname: string, timeoutMs = 5000): Promise<T | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  try {
    const meta = await Promise.race([
      head(pathname),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("blob head timeout")), timeoutMs)),
    ]);
    const res = await fetch(meta.url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
