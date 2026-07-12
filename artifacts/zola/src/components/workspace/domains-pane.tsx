// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { DomainsSection } from "@/components/workspace/deploy-pane";
import { useDeployments } from "@/hooks/use-deployments";

/**
 * Replit-style Domains tool: link a custom domain to the project's live
 * deployment. Reuses the same DNS-verification flow as the Deploy pane.
 */
export function DomainsPane({ projectId }: { projectId: string }) {
  const { data: deployments } = useDeployments(projectId);
  const hasDeployment = (deployments?.length ?? 0) > 0;

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Domains
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {hasDeployment ? (
          <DomainsSection projectId={projectId} />
        ) : (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Deploy your app first (Publishing tool) — then you can point your
            own domain at it here.
          </p>
        )}
      </div>
    </div>
  );
}
