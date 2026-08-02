// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useMemo } from "react";
import { Link } from "wouter";
import { Blocks, Check, ExternalLink, KeyRound, Wrench } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_LABELS,
  useAttachIntegration,
  useConnectedIntegrations,
  useDetachIntegration,
  useIntegrationCatalog,
  useProjectIntegrations,
  type IntegrationCategory,
  type IntegrationDescriptor,
} from "@/hooks/use-integrations";

interface Props {
  projectId: string;
}

/**
 * Integrations tab: which of the user's connected services this project can
 * use. Attaching is the only place credentials cross from the account into a
 * project, so the consequences are spelled out on the row rather than hidden
 * behind a toast.
 */
export function IntegrationsPane({ projectId }: Props) {
  const { data: catalog, isLoading } = useIntegrationCatalog();
  const { data: connected } = useConnectedIntegrations();
  const { data: attached } = useProjectIntegrations(projectId);
  const attach = useAttachIntegration(projectId);
  const detach = useDetachIntegration(projectId);

  const connectedIds = useMemo(
    () => new Set((connected ?? []).map((c) => c.provider)),
    [connected],
  );
  const attachedById = useMemo(() => {
    const map = new Map(
      (attached ?? []).map((a) => [a.provider, a] as const),
    );
    return map;
  }, [attached]);

  const byCategory = useMemo(() => {
    const groups = new Map<IntegrationCategory, IntegrationDescriptor[]>();
    // Only services the user has actually connected are actionable here; the
    // rest would just be a second copy of the Integrations page.
    for (const item of (catalog ?? []).filter((i) => connectedIds.has(i.id))) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return [...groups.entries()];
  }, [catalog, connectedIds]);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-2xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Blocks className="h-4 w-4" /> Integrations
          </h2>
          <Link
            href="/integrations"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Manage connections <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Attaching a service writes its credentials into this project's Secrets and — where
          the service has one — registers its MCP server so Loop can call its tools.
        </p>

        {isLoading ? (
          <div className="h-20 animate-pulse rounded-lg border border-border bg-card" />
        ) : byCategory.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
            You haven't connected any services yet.{" "}
            <Link href="/integrations" className="underline hover:text-foreground">
              Connect one
            </Link>{" "}
            and it'll show up here, ready to attach.
          </div>
        ) : (
          byCategory.map(([category, items]) => (
            <section key={category} className="mb-5">
              <h3 className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {CATEGORY_LABELS[category]}
              </h3>
              <ul className="space-y-2">
                {items.map((descriptor) => {
                  const link = attachedById.get(descriptor.id);
                  return (
                    <li
                      key={descriptor.id}
                      className={cn(
                        "rounded-lg border bg-card p-3",
                        link ? "border-primary/40" : "border-border",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-medium">
                              {descriptor.name}
                            </span>
                            {link && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-primary">
                                <Check className="h-3 w-3" /> attached
                              </span>
                            )}
                            {descriptor.hasMcp && (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                <Wrench className="h-2.5 w-2.5" /> MCP
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                            {descriptor.tagline}
                          </p>
                          {link && link.secret_keys.length > 0 && (
                            <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <KeyRound className="h-2.5 w-2.5" />
                              {link.secret_keys.join(", ")}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={link ? "ghost" : "default"}
                          className="h-7 shrink-0 text-xs"
                          disabled={attach.isPending || detach.isPending}
                          onClick={() => {
                            if (link) {
                              detach.mutate(descriptor.id, {
                                onSuccess: () =>
                                  toast.success(
                                    `${descriptor.name} detached — its secrets stay in this project`,
                                  ),
                                onError: (err) => toast.error(err.message),
                              });
                            } else {
                              attach.mutate(descriptor.id, {
                                onSuccess: (data) =>
                                  toast.success(
                                    data.mcpServerId
                                      ? `${descriptor.name} attached — MCP server registered`
                                      : `${descriptor.name} attached`,
                                  ),
                                onError: (err) => toast.error(err.message),
                              });
                            }
                          }}
                        >
                          {link ? "Detach" : "Attach"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
