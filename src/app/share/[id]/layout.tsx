import type { Metadata } from "next";
import { readBlobJson } from "@/lib/blob-read";

async function loadShared(id: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return readBlobJson<any>(`solutions/${id}.json`);
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await loadShared(id);
  const title = data?.solution?.title ?? "Shared solution — PilotPlan";
  const description =
    data?.solution?.summary?.slice(0, 180) ??
    "An AI-researched implementation plan: tools, costs, and rollout steps.";
  return {
    title: `${title} — PilotPlan`,
    description,
    openGraph: { title, description, siteName: "PilotPlan" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
