// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { createSupabaseServerClient } from "../lib/supabase";

const router = Router();

function newCode(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

// Returns the current user's referral code, credit balance, and the list of
// people they have referred. Creates a profile row on first read as a fallback
// (the auth trigger normally does this at signup).
router.get("/referral", async (req, res) => {
  const supabase = createSupabaseServerClient(req, res);
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const userId = userData.user.id;

  let { data: profile } = await supabase
    .from("profiles")
    .select("referral_code, credit_cents")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    const { data: created } = await supabase
      .from("profiles")
      .insert({ id: userId, referral_code: newCode() })
      .select("referral_code, credit_cents")
      .single();
    profile = created ?? null;
  }

  const { data: referrals } = await supabase
    .from("referrals")
    .select("status, reward_cents, created_at, qualified_at")
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false });

  const list = referrals ?? [];
  res.json({
    code: profile?.referral_code ?? null,
    credit_cents: profile?.credit_cents ?? 0,
    total: list.length,
    qualified: list.filter((r) => r.status === "qualified").length,
    referrals: list,
  });
});

export default router;
