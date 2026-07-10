// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { AppWindow, KeyRound, SquareTerminal, Terminal } from "lucide-react";
import { WebviewPane } from "@/components/workspace/webview-pane";
import { ConsolePane } from "@/components/workspace/console-pane";
import { ShellPane } from "@/components/workspace/shell-pane";
import { SecretsPane } from "@/components/workspace/secrets-pane";
import { cn } from "@/lib/utils";

type Tool = "webview" | "console" | "shell" | "secrets";

const TABS: { id: Tool; label: string; icon: typeof AppWindow }[] = [
  { id: "webview", label: "Webview", icon: AppWindow },
  { id: "console", label: "Console", icon: Terminal },
  { id: "shell", label: "Shell", icon: SquareTerminal },
  { id: "secrets", label: "Secrets", icon: KeyRound },
];

/**
 * Replit-style tool pane: Webview / Console / Shell / Secrets tabs. Panes stay
 * mounted once opened (hidden with CSS) so the webview doesn't reload and the
 * shell session survives tab switches.
 */
export function ToolPane({ projectId }: { projectId: string }) {
  const [active, setActive] = useState<Tool>("webview");
  const [opened, setOpened] = useState<Set<Tool>>(new Set<Tool>(["webview"]));

  function select(tool: Tool) {
    setActive(tool);
    setOpened((prev) => {
      if (prev.has(tool)) return prev;
      const next = new Set(prev);
      next.add(tool);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-0.5 border-b border-border bg-card px-1.5 pt-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md border border-b-0 px-2.5 py-1.5 text-xs",
              active === id
                ? "border-border bg-background font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="relative min-h-0 flex-1">
        <div className={cn("absolute inset-0", active !== "webview" && "hidden")}>
          <WebviewPane />
        </div>
        {opened.has("console") && (
          <div className={cn("absolute inset-0", active !== "console" && "hidden")}>
            <ConsolePane />
          </div>
        )}
        {opened.has("shell") && (
          <div className={cn("absolute inset-0", active !== "shell" && "hidden")}>
            <ShellPane />
          </div>
        )}
        {opened.has("secrets") && (
          <div className={cn("absolute inset-0", active !== "secrets" && "hidden")}>
            <SecretsPane projectId={projectId} />
          </div>
        )}
      </div>
    </div>
  );
}
