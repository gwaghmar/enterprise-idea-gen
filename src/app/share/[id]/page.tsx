"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const id = params?.id as string;
    if (!id) { setStatus("error"); return; }

    fetch(`/api/share?id=${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setStatus("error"); return; }
        sessionStorage.setItem("solution", JSON.stringify(data));
        router.push("/solution");
      })
      .catch(() => setStatus("error"));
  }, [params, router]);

  if (status === "error") {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <p className="text-white/60">This shared solution could not be loaded.</p>
          <a href="/" className="text-white underline text-sm">Generate a new one</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
    </div>
  );
}
