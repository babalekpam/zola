// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useEffect, useState } from "react";
import {
  Activity,
  AppWindow,
  Blocks,
  BookOpen,
  Database,
  GitBranch,
  Globe,
  History,
  KeyRound,
  Plug,
  Rocket,
  ShieldCheck,
  SquareTerminal,
  Terminal,
} from "lucide-react";
import { WebviewPane } from "@/components/workspace/webview-pane";
import { ConsolePane } from "@/components/workspace/console-pane";
import { ShellPane } from "@/components/workspace/shell-pane";
import { SecretsPane } from "@/components/workspace/secrets-pane";
import { SecurityPane } from "@/components/workspace/security-pane";
import { DatabasePane } from "@/components/workspace/database-pane";
import { HistoryPane } from "@/components/workspace/history-pane";
import { DeployPane } from "@/components/workspace/deploy-pane";
import { GitPane } from "@/components/workspace/git-pane";
import { DomainsPane } from "@/components/workspace/domains-pane";
import { MonitoringPane } from "@/components/workspace/monitoring-pane";
import { SkillsPane } from "@/components/workspace/skills-pane";
import { McpPane } from "@/components/workspace/mcp-pane";
import { IntegrationsPane } from "@/components/workspace/integrations-pane";
import { cn } from "@/lib/utils";
import type { Project } from "@/lib/types";

export type Tool =
  | "webview"
  | "console"
  | "shell"
  | "secrets"
  | "security"
  | "database"
  | "history"
  | "deploy"
  | "git"
  | "domains"
  | "monitoring"
  | "skills"
  | "integrations"
  | "mcp";

export const TOOL_META: Record<Tool, { label: string; icon: typeof AppWindow }> = {
  webview: { label: "Webview", icon: AppWindow },
  console: { label: "Console", icon: Terminal },
  shell: { label: "Shell", icon: SquareTerminal },
  secrets: { label: "Secrets", icon: KeyRound },
  security: { label: "Security", icon: ShieldCheck },
  database: { label: "Database", icon: Database },
  history: { label: "History", icon: History },
  deploy: { label: "Publishing", icon: Rocket },
  git: { label: "Git", icon: GitBranch },
  domains: { label: "Domains", icon: Globe },
  monitoring: { label: "Monitoring", icon: Activity },
  skills: { label: "Skills", icon: BookOpen },
  integrations: { label: "Integrations", icon: Blocks },
  mcp: { label: "MCP", icon: Plug },
};

const TABS: Tool[] = [
  "webview",
  "console",
  "shell",
  "secrets",
  "security",
  "database",
  "history",
  "deploy",
  "domains",
  "monitoring",
  "integrations",
  "mcp",
  "skills",
  "git",
];

interface Props {
  project: Project;
  dbToken: string | null;
  files: Record<string, string>;
  onRestore: (files: Record<string, string>) => void;
  onWriteFile: (path: string, content: string) => void;
  onDeleteFile: (path: string) => void;
  onOpenFile: (path: string) => void;
  /** Controlled selection (the workspace tools sidebar drives this). */
  active?: Tool;
  onSelect?: (tool: Tool) => void;
}

/**
 * Replit-style tool pane: Webview / Console / Shell / Secrets / DB / History /
 * Publishing / Domains / Monitoring / Git. Panes stay mounted once opened
 * (hidden with CSS) so the webview doesn't reload and the shell session
 * survives tab switches.
 */
export function ToolPane({
  project,
  dbToken,
  files,
  onRestore,
  onWriteFile,
  onDeleteFile,
  onOpenFile,
  active: controlledActive,
  onSelect,
}: Props) {
  const projectId = project.id;
  const [internalActive, setInternalActive] = useState<Tool>("webview");
  const active = controlledActive ?? internalActive;
  const [opened, setOpened] = useState<Set<Tool>>(new Set<Tool>(["webview"]));

  // Whatever becomes active (from tabs here or the tools sidebar) must be
  // mounted.
  useEffect(() => {
    setOpened((prev) => {
      if (prev.has(active)) return prev;
      const next = new Set(prev);
      next.add(active);
      return next;
    });
  }, [active]);

  function select(tool: Tool) {
    setInternalActive(tool);
    onSelect?.(tool);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-border bg-card px-1.5 pt-1 [scrollbar-width:thin]">
        {TABS.map((id) => {
          const { label, icon: Icon } = TOOL_META[id];
          return (
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
          );
        })}
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
        {opened.has("security") && (
          <div className={cn("absolute inset-0", active !== "security" && "hidden")}>
            <SecurityPane project={project} files={files} onOpenFile={onOpenFile} />
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
        {opened.has("domains") && (
          <div className={cn("absolute inset-0", active !== "domains" && "hidden")}>
            <DomainsPane projectId={projectId} />
          </div>
        )}
        {opened.has("monitoring") && (
          <div className={cn("absolute inset-0", active !== "monitoring" && "hidden")}>
            <MonitoringPane projectId={projectId} />
          </div>
        )}
        {opened.has("skills") && (
          <div className={cn("absolute inset-0", active !== "skills" && "hidden")}>
            <SkillsPane
              files={files}
              onWriteFile={onWriteFile}
              onDeleteFile={onDeleteFile}
              onOpenFile={onOpenFile}
            />
          </div>
        )}
        {opened.has("integrations") && (
          <div className={cn("absolute inset-0", active !== "integrations" && "hidden")}>
            <IntegrationsPane projectId={projectId} />
          </div>
        )}
        {opened.has("mcp") && (
          <div className={cn("absolute inset-0", active !== "mcp" && "hidden")}>
            <McpPane projectId={projectId} />
          </div>
        )}
        {opened.has("git") && (
          <div className={cn("absolute inset-0", active !== "git" && "hidden")}>
            <GitPane project={project} />
          </div>
        )}
      </div>
    </div>
  );
}
