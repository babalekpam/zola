// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0e1525",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
          <path
            d="M32 8 A24 24 0 1 0 56 32 A12 12 0 0 0 44 20"
            stroke="#F26207"
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>
    ),
    { ...size },
  );
}
