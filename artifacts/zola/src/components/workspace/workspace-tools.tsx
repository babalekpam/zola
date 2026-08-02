// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { TOOL_META, type Tool } from "@/components/workspace/tool-pane";
import { cn } from "@/lib/utils";

const GROUPS: { heading: string; tools: Tool[] }[] = [
  {
    heading: "Loop Cloud",
    tools: ["deploy", "domains", "database", "monitoring"],
  },
  {
    heading: "Agent",
    tools: ["integrations", "mcp", "skills"],
  },
  {
    heading: "Setup",
    tools: ["git", "secrets", "security", "history"],
  },
];

interface Props {
  active: Tool;
  onSelect: (tool: Tool) => void;
}

/**
 * Replit-style tools sidebar: grouped list of the project's cloud tools,
 * rendered under the file tree. Selecting an item opens that tool in the
 * tool pane.
 */
export function WorkspaceTools({ active, onSelect }: Props) {
  return (
    <div className="shrink-0 overflow-y-auto border-t border-border px-2 pb-3 pt-2 [scrollbar-width:thin]">
      {GROUPS.map(({ heading, tools }) => (
        <div key={heading} className="mb-2 last:mb-0">
          <div className="px-1.5 pb-1 pt-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {heading}
          </div>
          <ul>
            {tools.map((tool) => {
              const { label, icon: Icon } = TOOL_META[tool];
              return (
                <li key={tool}>
                  <button
                    type="button"
                    onClick={() => onSelect(tool)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs",
                      active === tool
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
