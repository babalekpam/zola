// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 110,
          fontWeight: 700,
          color: "white",
          fontFamily: "system-ui",
          borderRadius: 32,
        }}
      >
        Z
      </div>
    ),
    { ...size },
  );
}
