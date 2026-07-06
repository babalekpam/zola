// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { LoopLogo } from "@/components/brand/logo";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AccountForms } from "@/components/account/account-forms";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect("/login");

  const { count: projectCount } = await supabase
    .from("projects")
    .select("*", { count: "exact", head: true });

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <Link
          href="/projects"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
        <Link href="/" className="flex items-center gap-2 text-base font-semibold">
          <LoopLogo markClassName="h-5 w-5" />
        </Link>
      </header>

      <h1 className="text-2xl font-semibold">Account</h1>
      <p className="text-sm text-muted-foreground">
        Signed in as <strong>{userData.user.email}</strong>
        {projectCount !== null ? ` · ${projectCount} projects` : ""}
      </p>

      <AccountForms userId={userData.user.id} email={userData.user.email ?? ""} />
    </main>
  );
}
