// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase";

export interface PresenceUser {
  id: string;
  email: string;
  self: boolean;
}

/**
 * Live collaborator presence for a project workspace via Supabase Realtime
 * presence channels — who has this project open right now.
 */
export function usePresence(projectId: string): PresenceUser[] {
  const { user } = useAuth();
  const [users, setUsers] = useState<PresenceUser[]>([]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`presence:project:${projectId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<{ email: string }>();
        const next: PresenceUser[] = Object.entries(state).map(
          ([key, metas]) => ({
            id: key,
            email: metas[0]?.email ?? "unknown",
            self: key === user.id,
          }),
        );
        // Self first, then alphabetical, so the avatar row is stable.
        next.sort((a, b) =>
          a.self !== b.self
            ? a.self ? -1 : 1
            : a.email.localeCompare(b.email),
        );
        setUsers(next);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ email: user.email ?? "unknown" });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [projectId, user]);

  return users;
}
