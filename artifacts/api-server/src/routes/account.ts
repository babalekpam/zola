// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "../lib/supabase";

const router = Router();

router.delete("/account", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.VITE_SUPABASE_URL;
  if (!serviceKey || !url) {
    res.status(500).json({
      error: "Account deletion is not configured. Set SUPABASE_SERVICE_ROLE_KEY.",
    });
    return;
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const { error } = await admin.auth.admin.deleteUser(userData.user.id);
  if (error) {
    res.status(500).json({ error: error.message });
    return;
  }

  await supabase.auth.signOut();
  res.json({ ok: true });
});

export default router;
