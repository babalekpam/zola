// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { resolveTxt } from "node:dns/promises";
import { createSupabaseServerClient } from "../lib/supabase";

const router = Router();

// Apex or subdomain, lowercase, no scheme/port/path.
const DOMAIN_RE =
  /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

router.get("/projects/:id/domains", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data, error } = await supabase
    .from("custom_domains")
    .select("id, domain, token, verified, created_at")
    .eq("project_id", req.params.id)
    .order("created_at");
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ domains: data ?? [] });
});

router.post("/projects/:id/domains", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const domain = ((req.body as { domain?: string }).domain ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  if (!DOMAIN_RE.test(domain)) {
    res.status(400).json({ error: "Enter a valid domain like app.example.com" });
    return;
  }

  const { data, error } = await supabase
    .from("custom_domains")
    .insert({ project_id: req.params.id, domain })
    .select("id, domain, token, verified, created_at")
    .single();
  if (error) {
    const msg = error.message.includes("duplicate")
      ? "That domain is already linked to a project"
      : error.message;
    res.status(400).json({ error: msg });
    return;
  }
  res.json({ domain: data });
});

// Check the DNS TXT challenge: _zola-challenge.<domain> must contain the token.
router.post("/projects/:id/domains/:domainId/verify", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { data: record, error } = await supabase
    .from("custom_domains")
    .select("id, domain, token, verified")
    .eq("id", req.params.domainId)
    .eq("project_id", req.params.id)
    .single();
  if (error || !record) { res.status(404).json({ error: "Domain not found" }); return; }
  if (record.verified) { res.json({ domain: record }); return; }

  let found = false;
  try {
    const txt = await resolveTxt(`_zola-challenge.${record.domain}`);
    found = txt.some((chunks) => chunks.join("").trim() === record.token);
  } catch {
    // NXDOMAIN / timeout — treated as not found.
  }
  if (!found) {
    res.status(400).json({
      error: `TXT record not found yet. Add a TXT record at _zola-challenge.${record.domain} with the value shown, then try again (DNS can take a few minutes).`,
    });
    return;
  }

  const { data: updated, error: updErr } = await supabase
    .from("custom_domains")
    .update({ verified: true })
    .eq("id", record.id)
    .select("id, domain, token, verified, created_at")
    .single();
  if (updErr) { res.status(500).json({ error: updErr.message }); return; }
  res.json({ domain: updated });
});

router.delete("/projects/:id/domains/:domainId", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { error } = await supabase
    .from("custom_domains")
    .delete()
    .eq("id", req.params.domainId)
    .eq("project_id", req.params.id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.json({ ok: true });
});

export default router;
