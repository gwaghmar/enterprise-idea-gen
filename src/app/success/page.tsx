"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, ArrowRight } from "lucide-react";
import { markPaid } from "@/lib/history";

function SuccessContent() {
  const params = useSearchParams();
  const [state, setState] = useState<"verifying" | "unlocked" | "unverified">("verifying");

  useEffect(() => {
    const sessionId = params.get("session_id");

    async function verify() {
      try {
        if (!sessionId) throw new Error("no session");
        const res = await fetch(`/api/checkout?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (res.ok && data.paid) {
          // Only trust the sid from Stripe metadata — a URL param would let
          // the client pick which solution to unlock
          const sid = data.sid;
          if (sid) {
            markPaid(sid);
            // Unlock the in-session copy too so /solution reflects it immediately
            try {
              const raw = sessionStorage.getItem("solution");
              if (raw) {
                const payload = JSON.parse(raw);
                if (payload.sid === sid) {
                  sessionStorage.setItem("solution", JSON.stringify({ ...payload, paid: true }));
                }
              }
            } catch { /* ignore */ }
          }
          setState("unlocked");
          return;
        }
        throw new Error("not paid");
      } catch {
        setState("unverified");
      }
    }
    verify();
  }, [params]);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        {state === "verifying" ? (
          <>
            <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-6" />
            <p className="text-white/50">Confirming your payment…</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center mx-auto mb-6">
              <BadgeCheck className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-3xl font-bold mb-3">
              {state === "unlocked" ? "Solution unlocked" : "Payment received"}
            </h1>
            <p className="text-white/50 mb-8">
              {state === "unlocked"
                ? "The full report — rollout playbook, cost breakdown, vendor kit, and PDF export — is now yours."
                : "Check your email for a receipt from Stripe. If the report doesn't show as unlocked, reload it from My Solutions."}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/solution"
                className="inline-flex items-center justify-center gap-2 bg-white text-black font-semibold rounded-xl px-8 py-3 hover:bg-white/90 transition-all">
                View your solution <ArrowRight className="w-4 h-4" />
              </a>
              <a href="/history"
                className="inline-block border border-white/20 text-white/60 font-medium rounded-xl px-8 py-3 hover:border-white/40 hover:text-white/80 transition-all">
                My solutions
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <SuccessContent />
    </Suspense>
  );
}
