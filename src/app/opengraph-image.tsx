import { ImageResponse } from "next/og";

// The thumbnail shown when pilotplan.vercel.app is pasted into LinkedIn,
// X, Slack, WhatsApp, iMessage…
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "PilotPlan — AI Solution Architect";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", background: "#070b1b", color: "white",
          padding: "72px 80px", fontFamily: "sans-serif",
          borderTop: "14px solid #2563eb",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 44 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, background: "#2563eb",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 30, fontWeight: 800,
            }}>P</div>
            <div style={{ fontSize: 30, fontWeight: 700, letterSpacing: 1 }}>PilotPlan</div>
            <div style={{ fontSize: 22, color: "#93a4c8", marginLeft: 8 }}>AI Solution Architect</div>
          </div>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.12, maxWidth: 1020 }}>
            &ldquo;Figure out a solution and have a plan by Friday.&rdquo;
          </div>
          <div style={{ fontSize: 30, color: "#93a4c8", marginTop: 28, maxWidth: 980 }}>
            Paste that problem. Get the full implementation plan — sourced, costed, boss-ready — in 2 minutes.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: 14, fontSize: 22, color: "#c7d2e8" }}>
            <div style={{ background: "rgba(37,99,235,0.18)", border: "1px solid rgba(96,165,250,0.5)", borderRadius: 999, padding: "8px 22px" }}>Rejected options included</div>
            <div style={{ background: "rgba(37,99,235,0.18)", border: "1px solid rgba(96,165,250,0.5)", borderRadius: 999, padding: "8px 22px" }}>Every cost sourced</div>
            <div style={{ background: "rgba(37,99,235,0.18)", border: "1px solid rgba(96,165,250,0.5)", borderRadius: 999, padding: "8px 22px" }}>Free beta</div>
          </div>
          <div style={{ fontSize: 24, color: "#93a4c8" }}>pilotplan.vercel.app</div>
        </div>
      </div>
    ),
    size
  );
}
