import { ImageResponse } from "next/og";
import { BrandIcon } from "@/components/BrandIcon";

// Browser-tab favicon — takes precedence over the default favicon.ico
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<BrandIcon size={64} />, size);
}
