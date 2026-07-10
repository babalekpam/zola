// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/hooks/use-auth";
import {
  createSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase";

interface SyncPayload {
  sender: string;
  changed: Record<string, string>;
  deleted: string[];
}

/**
 * Multiplayer file sync (Replit-style, last-write-wins). Broadcasts this
 * client's file changes over a Supabase Realtime channel and applies changes
 * from collaborators as they land. Not an operational transform — concurrent
 * edits to the SAME file resolve to whoever wrote last — but edits to
 * different files merge cleanly, which covers the common collaboration case.
 */
export function useFileSync(
  projectId: string,
  files: Record<string, string>,
  onRemote: (changed: Record<string, string>, deleted: string[]) => void,
) {
  const { user } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  // Last state broadcast OR received — the diff base, so applying a remote
  // update never echoes back as a local change.
  const knownRef = useRef<Record<string, string> | null>(null);
  const onRemoteRef = useRef(onRemote);
  onRemoteRef.current = onRemote;

  useEffect(() => {
    if (!user || !isSupabaseConfigured()) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase.channel(`files:project:${projectId}`);

    channel
      .on("broadcast", { event: "files" }, ({ payload }) => {
        const p = payload as SyncPayload;
        if (p.sender === user.id) return;
        const base = { ...(knownRef.current ?? {}) };
        for (const [path, content] of Object.entries(p.changed)) {
          base[path] = content;
        }
        for (const path of p.deleted) delete base[path];
        knownRef.current = base;
        onRemoteRef.current(p.changed, p.deleted);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [projectId, user]);

  // Debounced diff-and-broadcast whenever local files change.
  useEffect(() => {
    if (!user) return;
    if (knownRef.current === null) {
      // First render: seed the diff base, nothing to broadcast yet.
      knownRef.current = files;
      return;
    }
    const t = setTimeout(() => {
      const known = knownRef.current ?? {};
      if (known === files) return;
      const changed: Record<string, string> = {};
      for (const [path, content] of Object.entries(files)) {
        if (known[path] !== content) changed[path] = content;
      }
      const deleted = Object.keys(known).filter(
        (path) => files[path] === undefined,
      );
      if (Object.keys(changed).length === 0 && deleted.length === 0) return;
      knownRef.current = files;
      void channelRef.current?.send({
        type: "broadcast",
        event: "files",
        payload: { sender: user.id, changed, deleted } satisfies SyncPayload,
      });
    }, 800);
    return () => clearTimeout(t);
  }, [files, user]);
}
