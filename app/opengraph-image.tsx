// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "LoopAfrica — Turn your idea into an app. Just describe it.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0e1525",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          fontFamily: "system-ui",
          color: "#f5f9fc",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <path
              d="M32 8 A24 24 0 1 0 56 32 A12 12 0 0 0 44 20"
              stroke="#F26207"
              strokeWidth="9"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <span style={{ fontSize: 34, fontWeight: 700, display: "flex" }}>
            loop<span style={{ color: "#F26207" }}>africa</span>
          </span>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 999,
              border: "1px solid #2b3245",
              fontSize: 15,
              color: "#9da2b3",
            }}
          >
            by Argilette Lab
          </span>
        </div>
        <div>
          <div style={{ fontSize: 74, fontWeight: 700, lineHeight: 1.05 }}>
            Turn your idea into an app.
          </div>
          <div
            style={{
              fontSize: 74,
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#9da2b3",
            }}
          >
            Just describe it.
          </div>
          <div style={{ marginTop: 32, fontSize: 22, color: "#9da2b3" }}>
            AI vibe coding · powered by Claude · loopafrica.org
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
