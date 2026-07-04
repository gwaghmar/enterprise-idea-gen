import type { Metadata } from "next";

async function loadShared(id: string) {
  try {
    const res = await fetch(`https://blob.vercel-storage.com/solutions/${id}.json`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const data = await loadShared(id);
  const title = data?.solution?.title ?? "Shared solution — ERPHigh";
  const description =
    data?.solution?.summary?.slice(0, 180) ??
    "An AI-researched implementation plan: tools, costs, and rollout steps.";
  return {
    title: `${title} — ERPHigh`,
    description,
    openGraph: { title, description, siteName: "ERPHigh" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
