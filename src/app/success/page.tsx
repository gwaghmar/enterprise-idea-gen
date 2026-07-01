"use client";

import { useEffect } from "react";

export default function SuccessPage() {
  useEffect(() => {
    sessionStorage.removeItem("solution");
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 bg-green-500/20 border border-green-500/40 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">
          ✓
        </div>
        <h1 className="text-3xl font-bold mb-3">Payment confirmed</h1>
        <p className="text-white/50 mb-8">
          Your solution is saved. Check your email for a receipt from Stripe.
        </p>
        <a
          href="/"
          className="inline-block bg-white text-black font-semibold rounded-xl px-8 py-3 hover:bg-white/90 transition-all"
        >
          Generate another solution
        </a>
      </div>
    </div>
  );
}
