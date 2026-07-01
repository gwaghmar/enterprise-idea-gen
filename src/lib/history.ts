// Client-side solution history & paid-state tracking (no accounts).
// Records live in localStorage; full payloads are cached locally (last N)
// and mirrored to Blob storage via /api/share when configured.

export interface HistoryRecord {
  sid: string;
  title: string;
  problem: string;
  date: string; // ISO
  shareId?: string;
  paid?: boolean;
}

const INDEX_KEY = "erphigh_history";
const PAYLOAD_PREFIX = "erphigh_sol_";
const MAX_CACHED_PAYLOADS = 10;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

// localStorage access itself can throw (private mode, storage disabled) —
// every touch goes through these guards so callers never crash the page.
function lsGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSet(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* unavailable or quota */ }
}
function lsRemove(key: string) {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function newSid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function listHistory(): HistoryRecord[] {
  return safeParse<HistoryRecord[]>(lsGet(INDEX_KEY), []);
}

function writeIndex(records: HistoryRecord[]) {
  lsSet(INDEX_KEY, JSON.stringify(records));
}

export function saveToHistory(record: HistoryRecord, payload: unknown) {
  const records = listHistory().filter((r) => r.sid !== record.sid);
  records.unshift(record);
  writeIndex(records);

  // Payload write may hit quota — index entry still useful if a shareId exists
  lsSet(PAYLOAD_PREFIX + record.sid, JSON.stringify(payload));

  // Prune payload cache beyond the cap (index keeps all entries)
  records.slice(MAX_CACHED_PAYLOADS).forEach((r) => {
    lsRemove(PAYLOAD_PREFIX + r.sid);
  });
}

export function updateHistory(sid: string, patch: Partial<HistoryRecord>, payload?: unknown) {
  const records = listHistory();
  const i = records.findIndex((r) => r.sid === sid);
  if (i !== -1) {
    records[i] = { ...records[i], ...patch };
    writeIndex(records);
  }
  if (payload !== undefined && lsGet(PAYLOAD_PREFIX + sid) !== null) {
    lsSet(PAYLOAD_PREFIX + sid, JSON.stringify(payload));
  }
}

export function loadPayload(sid: string): Record<string, unknown> | null {
  return safeParse<Record<string, unknown> | null>(lsGet(PAYLOAD_PREFIX + sid), null);
}

export function removeFromHistory(sid: string) {
  writeIndex(listHistory().filter((r) => r.sid !== sid));
  lsRemove(PAYLOAD_PREFIX + sid);
}

export function markPaid(sid: string) {
  updateHistory(sid, { paid: true });
}

export function isPaid(sid: string | undefined | null): boolean {
  if (!sid) return false;
  return listHistory().some((r) => r.sid === sid && r.paid);
}
