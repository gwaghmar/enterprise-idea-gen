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

export function newSid(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function listHistory(): HistoryRecord[] {
  return safeParse<HistoryRecord[]>(localStorage.getItem(INDEX_KEY), []);
}

function writeIndex(records: HistoryRecord[]) {
  try { localStorage.setItem(INDEX_KEY, JSON.stringify(records)); } catch { /* quota */ }
}

export function saveToHistory(record: HistoryRecord, payload: unknown) {
  const records = listHistory().filter((r) => r.sid !== record.sid);
  records.unshift(record);
  writeIndex(records);

  try {
    localStorage.setItem(PAYLOAD_PREFIX + record.sid, JSON.stringify(payload));
  } catch { /* quota — index entry still useful if a shareId exists */ }

  // Prune payload cache beyond the cap (index keeps all entries)
  records.slice(MAX_CACHED_PAYLOADS).forEach((r) => {
    localStorage.removeItem(PAYLOAD_PREFIX + r.sid);
  });
}

export function updateHistory(sid: string, patch: Partial<HistoryRecord>, payload?: unknown) {
  const records = listHistory();
  const i = records.findIndex((r) => r.sid === sid);
  if (i !== -1) {
    records[i] = { ...records[i], ...patch };
    writeIndex(records);
  }
  if (payload !== undefined && localStorage.getItem(PAYLOAD_PREFIX + sid) !== null) {
    try { localStorage.setItem(PAYLOAD_PREFIX + sid, JSON.stringify(payload)); } catch { /* quota */ }
  }
}

export function loadPayload(sid: string): Record<string, unknown> | null {
  return safeParse<Record<string, unknown> | null>(localStorage.getItem(PAYLOAD_PREFIX + sid), null);
}

export function removeFromHistory(sid: string) {
  writeIndex(listHistory().filter((r) => r.sid !== sid));
  localStorage.removeItem(PAYLOAD_PREFIX + sid);
}

export function markPaid(sid: string) {
  updateHistory(sid, { paid: true });
}

export function isPaid(sid: string | undefined | null): boolean {
  if (!sid) return false;
  return listHistory().some((r) => r.sid === sid && r.paid);
}
