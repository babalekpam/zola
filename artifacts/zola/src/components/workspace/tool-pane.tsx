// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import {
  AppWindow,
  Database,
  History,
  KeyRound,
  Rocket,
  SquareTerminal,
  Terminal,
} from "lucide-react";
import { WebviewPane } from "@/components/workspace/webview-pane";
import { ConsolePane } from "@/components/workspace/console-pane";
import { ShellPane } from "@/components/workspace/shell-pane";
import { SecretsPane } from "@/components/workspace/secrets-pane";
import { DatabasePane } from "@/components/workspace/database-pane";
import { HistoryPane } from "@/components/workspace/history-pane";
import { DeployPane } from "@/components/workspace/deploy-pane";
import { cn } from "@/lib/utils";

type Tool =
  | "webview"
  | "console"
  | "shell"
  | "secrets"
  | "database"
  | "history"
  | "deploy";

const TABS: { id: Tool; label: string; icon: typeof AppWindow }[] = [
  { id: "webview", label: "Webview", icon: AppWindow },
  { id: "console", label: "Console", icon: Terminal },
  { id: "shell", label: "Shell", icon: SquareTerminal },
  { id: "secrets", label: "Secrets", icon: KeyRound },
  { id: "database", label: "DB", icon: Database },
  { id: "history", label: "History", icon: History },
  { id: "deploy", label: "Deploy", icon: Rocket },
];

interface Props {
  projectId: string;
  dbToken: string | null;
  files: Record<string, string>;
  onRestore: (files: Record<string, string>) => void;
}

/**
 * Replit-style tool pane: Webview / Console / Shell / Secrets / DB / History /
 * Deploy. Panes stay mounted once opened (hidden with CSS) so the webview
 * doesn't reload and the shell session survives tab switches.
 */
export function ToolPane({ projectId, dbToken, files, onRestore }: Props) {
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
      <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border bg-card px-1.5 pt-1 [scrollbar-width:thin]">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => select(id)}
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-t-md border border-b-0 px-2 py-1.5 text-[11px]",
              active === id
                ? "border-border bg-background font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            title={label}
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
        {opened.has("database") && (
          <div className={cn("absolute inset-0", active !== "database" && "hidden")}>
            <DatabasePane projectId={projectId} dbToken={dbToken} />
          </div>
        )}
        {opened.has("history") && (
          <div className={cn("absolute inset-0", active !== "history" && "hidden")}>
            <HistoryPane projectId={projectId} files={files} onRestore={onRestore} />
          </div>
        )}
        {opened.has("deploy") && (
          <div className={cn("absolute inset-0", active !== "deploy" && "hidden")}>
            <DeployPane projectId={projectId} />
          </div>
        )}
      </div>
    </div>
  );
}
