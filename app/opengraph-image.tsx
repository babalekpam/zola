// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Loop — Vibe code with any LLM, by Argilette Lab";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0a",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          fontFamily: "system-ui",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background:
                "linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            Z
          </div>
          <span style={{ fontSize: 28, fontWeight: 600 }}>Loop</span>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              border: "1px solid #333",
              fontSize: 14,
              color: "#a3a3a3",
            }}
          >
            by Argilette Lab
          </span>
        </div>
        <div>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
            Build apps by chatting.
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#737373",
            }}
          >
            Run them in the browser.
          </div>
          <div
            style={{
              marginTop: 32,
              fontSize: 22,
              color: "#a3a3a3",
            }}
          >
            Multi-LLM vibe coding · Claude · GPT · Gemini · NVIDIA · OpenRouter
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
