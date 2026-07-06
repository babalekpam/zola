// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useState } from "react";
import { toast } from "sonner";
import { Gift, Copy, Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useReferral } from "@/hooks/use-referral";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function referralLink(code: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}signup?ref=${code}`;
}

export function ReferEarnDialog({ open, onOpenChange }: Props) {
  const { data, isLoading } = useReferral(open);
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    if (!data?.code) return;
    await navigator.clipboard.writeText(referralLink(data.code));
    setCopied(true);
    toast.success("Referral link copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" /> Refer &amp; Earn
          </DialogTitle>
          <DialogDescription>
            Share your link. When a friend signs up and upgrades to a paid plan,
            you earn $20 in credits.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-lg font-semibold">
                  ${((data?.credit_cents ?? 0) / 100).toFixed(0)}
                </div>
                <div className="text-[11px] text-muted-foreground">Earned</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-lg font-semibold">{data?.total ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Referred</div>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-lg font-semibold">{data?.qualified ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Upgraded</div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Your referral link
              </label>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={data?.code ? referralLink(data.code) : ""}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-xs outline-none"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  onClick={copyLink}
                  disabled={!data?.code}
                  aria-label="Copy referral link"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-primary" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
