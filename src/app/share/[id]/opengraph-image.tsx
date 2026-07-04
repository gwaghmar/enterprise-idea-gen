import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "PilotPlan implementation plan";

async function loadShared(id: string) {
  try {
    const res = await fetch(`https://blob.vercel-storage.com/solutions/${id}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadShared(id);
  const s = data?.solution;
  const title: string = s?.title ?? "AI-researched implementation plan";
  const cost: string = s?.tco?.firstYearTotal ?? s?.estimatedCost ?? "";
  const tools: number = Array.isArray(s?.tools) ? s.tools.length : 0;
  const time: string = s?.timeToImplement ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", background: "#070b1b", color: "white",
          padding: "64px 72px", fontFamily: "sans-serif",
          borderTop: "14px solid #2563eb",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 26, color: "#93a4c8", letterSpacing: 3, marginBottom: 28 }}>
            PILOTPLAN · IMPLEMENTATION PLAN
          </div>
          <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.15, maxWidth: 1000 }}>
            {title.length > 90 ? `${title.slice(0, 90)}…` : title}
          </div>
        </div>
        <div style={{ display: "flex", gap: 56, alignItems: "flex-end" }}>
          {cost ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, color: "#93a4c8" }}>FIRST-YEAR COST</div>
              <div style={{ fontSize: 40, fontWeight: 700, color: "#60a5fa" }}>{cost.slice(0, 28)}</div>
            </div>
          ) : null}
          {tools > 0 ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, color: "#93a4c8" }}>TOOLS</div>
              <div style={{ fontSize: 40, fontWeight: 700 }}>{tools}</div>
            </div>
          ) : null}
          {time ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 22, color: "#93a4c8" }}>TIMELINE</div>
              <div style={{ fontSize: 40, fontWeight: 700 }}>{time.slice(0, 26)}</div>
            </div>
          ) : null}
          <div style={{ marginLeft: "auto", fontSize: 26, color: "#93a4c8" }}>pilotplan.vercel.app</div>
        </div>
      </div>
    ),
    size
  );
}
