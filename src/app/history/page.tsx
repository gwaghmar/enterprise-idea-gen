"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Lock, BadgeCheck, ChevronRight } from "lucide-react";
import { listHistory, loadPayload, removeFromHistory, type HistoryRecord } from "@/lib/history";

export default function HistoryPage() {
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [openingSid, setOpeningSid] = useState<string | null>(null);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => { setRecords(listHistory()); }, []);

  async function open(rec: HistoryRecord) {
    setOpeningSid(rec.sid);
    setError("");
    let payload = loadPayload(rec.sid);
    if (!payload && rec.shareId) {
      try {
        const res = await fetch(`/api/share?id=${rec.shareId}`);
        if (res.ok) payload = await res.json();
      } catch { /* fall through */ }
    }
    if (!payload) {
      setError("This solution's data is no longer available on this device.");
      setOpeningSid(null);
      return;
    }
    sessionStorage.setItem("solution", JSON.stringify({ ...payload, sid: rec.sid }));
    router.push("/solution");
  }

  function remove(sid: string) {
    removeFromHistory(sid);
    setRecords(listHistory());
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <a href="/" className="text-white/40 text-sm hover:text-white/70 transition-colors flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> New solution
          </a>
        </div>

        <h1 className="text-3xl font-bold mb-2">My solutions</h1>
        <p className="text-white/40 text-sm mb-8">Saved on this device{records.some((r) => r.shareId) ? " and mirrored to the cloud" : ""}.</p>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        {records.length === 0 ? (
          <div className="border border-white/10 rounded-2xl p-10 text-center">
            <p className="text-white/40 mb-4">No solutions yet.</p>
            <a href="/" className="inline-block bg-white text-black font-semibold rounded-xl px-6 py-3 text-sm hover:bg-white/90 transition-all">Generate your first solution</a>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map((rec) => (
              <div key={rec.sid} className="group flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-white/25 transition-all">
                <button onClick={() => open(rec)} disabled={openingSid === rec.sid} className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-white truncate">{rec.title}</p>
                    {rec.paid ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 shrink-0"><BadgeCheck className="w-3.5 h-3.5" /> Unlocked</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-white/30 shrink-0"><Lock className="w-3 h-3" /> Preview</span>
                    )}
                  </div>
                  <p className="text-white/45 text-sm truncate">{rec.problem}</p>
                  <p className="text-white/25 text-xs mt-1">{new Date(rec.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}</p>
                </button>
                <button onClick={() => remove(rec.sid)} title="Remove from history"
                  className="text-white/20 hover:text-red-400 transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button onClick={() => open(rec)} disabled={openingSid === rec.sid} className="text-white/25 group-hover:text-white/60 transition-colors shrink-0">
                  {openingSid === rec.sid
                    ? <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin block" />
                    : <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
