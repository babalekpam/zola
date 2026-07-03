// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://loopafrica.org");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/projects/", "/account/", "/billing/"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
