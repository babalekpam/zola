"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NewProjectButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      router.push(`/projects/${json.project.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setLoading(false);
    }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" /> New project
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md space-y-4 rounded-xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Create a new project</h2>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Pomodoro timer"
              className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void create()} disabled={loading}>
                {loading ? "Creating…" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
