// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createSupabaseServerClient, createSupabaseAdminClient } from "../lib/supabase";

// Monitoring tool: per-project traffic for deployed sites. Access control is
// done through the user's JWT (can they read the project?); the counters
// themselves are read via the service role since writes are service-only.

const router = Router();

router.get("/projects/:id/analytics", async (req, res) => {
  const { id } = req.params;
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (projErr || !project) { res.status(404).json({ error: "Project not found" }); return; }

  const admin = createSupabaseAdminClient();
  if (!admin) { res.status(503).json({ error: "Analytics not configured" }); return; }

  const since = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const { data: rows, error } = await admin
    .from("site_hits")
    .select("day, count")
    .eq("project_id", id)
    .gte("day", since)
    .order("day", { ascending: true });
  if (error) { res.status(500).json({ error: error.message }); return; }

  const byDay = new Map((rows ?? []).map((r) => [r.day as string, Number(r.count)]));
  const daily: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    daily.push({ day, count: byDay.get(day) ?? 0 });
  }
  const total30 = daily.reduce((s, d) => s + d.count, 0);
  const total7 = daily.slice(-7).reduce((s, d) => s + d.count, 0);
  const today = daily[daily.length - 1]?.count ?? 0;

  res.json({ today, total7, total30, daily });
});

export default router;
