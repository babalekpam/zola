// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://zola.argilette.com");
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, priority: 1.0 },
    { url: `${base}/about`, lastModified: now, priority: 0.8 },
    { url: `${base}/contact`, lastModified: now, priority: 0.5 },
    { url: `${base}/pricing`, lastModified: now, priority: 0.9 },
    { url: `${base}/login`, lastModified: now, priority: 0.4 },
    { url: `${base}/signup`, lastModified: now, priority: 0.7 },
    { url: `${base}/terms`, lastModified: now, priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, priority: 0.3 },
  ];
}
