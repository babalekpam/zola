// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, GitFork, Globe, Heart, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useActiveOrg } from "@/hooks/use-active-org";
import { useExplore, useForkProject, useLikeProject } from "@/hooks/use-explore";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Community gallery of public projects — Replit's Explore, with Remix. */
export default function ExplorePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const { data: projects, isLoading } = useExplore(search);
  const { activeOrgId } = useActiveOrg();
  const fork = useForkProject();
  const like = useLikeProject();
  const [forkingId, setForkingId] = useState<string | null>(null);

  function remix(id: string) {
    if (!user) {
      setLocation("/login");
      return;
    }
    setForkingId(id);
    fork.mutate({ projectId: id, orgId: activeOrgId }, {
      onSuccess: (project) => setLocation(`/projects/${project.id}`),
      onError: (err) => {
        toast.error(err.message);
        setForkingId(null);
      },
    });
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link
              href={user ? "/projects" : "/"}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> {user ? "Projects" : "Home"}
            </Link>
            <span className="text-sm font-semibold">Explore</span>
          </div>
          {!user && (
            <Link
              href="/login"
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Log in
            </Link>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold">Community projects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Apps built and published by the community. Remix one to make it yours.
        </p>

        <form
          className="mt-5 flex max-w-md items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(q.trim());
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search projects…"
              className="pl-8"
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>

        {isLoading ? (
          <div className="mt-12 flex justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : !projects?.length ? (
          <div className="mt-16 flex flex-col items-center gap-3 text-center">
            <Globe className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {search
                ? "No public projects match that search."
                : "Nothing published yet. Make one of your projects public in its settings to see it here."}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex flex-col rounded-xl border border-border bg-card p-4"
              >
                <div className="flex items-start gap-2">
                  <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold">{p.name}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Updated {timeAgo(p.updated_at)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!user) {
                        setLocation("/login");
                        return;
                      }
                      like.mutate({ projectId: p.id, liked: p.liked });
                    }}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                      p.liked
                        ? "border-rose-500/50 bg-rose-500/10 text-rose-500"
                        : "border-border text-muted-foreground hover:text-foreground",
                    )}
                    title={p.liked ? "Unlike" : "Like"}
                  >
                    <Heart className={cn("h-3 w-3", p.liked && "fill-current")} />
                    {p.likes}
                  </button>
                </div>
                <p className="mt-2 line-clamp-2 min-h-[2rem] flex-1 text-xs text-muted-foreground">
                  {p.description ?? "No description."}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 w-full"
                  disabled={forkingId === p.id}
                  onClick={() => remix(p.id)}
                >
                  <GitFork className="mr-1.5 h-3.5 w-3.5" />
                  {forkingId === p.id ? "Remixing…" : "Remix"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
