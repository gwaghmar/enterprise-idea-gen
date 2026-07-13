// The PilotPlan brand mark as a vector: white "P" on a green tile — Γ-shaped
// stem and arm, D bowl, and a faceted house-shaped base carrying a four-point
// spark. Rendered by icon.tsx (favicon) and apple-icon.tsx (home screen), so
// both stay pixel-identical at every size.
export const BRAND_GREEN = "#1E9C4A";

export function BrandIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <rect x="34" y="34" width="956" height="956" rx="226" fill={BRAND_GREEN} />
      {/* stem + top arm (Γ) */}
      <path d="M310 412 q0 -102 102 -102 h240 v142 h-190 v462 h-152 z" fill="#fff" />
      {/* D bowl — flat left edge, round right */}
      <path d="M694 310 h16 a290 290 0 0 1 0 580 h-16 z" fill="#fff" />
      {/* faceted base: house shape outlined in the tile green so it reads as a
          separate facet where it overlaps the bowl */}
      <path
        d="M664 556 L806 646 L806 872 L522 872 L522 646 Z"
        fill="#fff"
        stroke={BRAND_GREEN}
        strokeWidth="34"
        strokeLinejoin="round"
      />
      {/* four-point spark */}
      <path
        d="M664 646 C678 706 690 718 750 732 C690 746 678 758 664 818 C650 758 638 746 578 732 C638 718 650 706 664 646 Z"
        fill={BRAND_GREEN}
      />
    </svg>
  );
}
