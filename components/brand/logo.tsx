// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { useId } from "react";
import { cn } from "@/lib/utils";

/** The LoopAfrica spiral mark. Scales with h/w classes on className. */
export function LoopMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={id}
          x1="8"
          y1="8"
          x2="56"
          y2="56"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FF8A3C" />
          <stop offset="1" stopColor="#F26207" />
        </linearGradient>
      </defs>
      <path
        d="M32 8 A24 24 0 1 0 56 32 A12 12 0 0 0 44 20"
        stroke={`url(#${id})`}
        strokeWidth="9"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Mark + wordmark. "loop" inherits text color; "africa" is brand orange. */
export function LoopLogo({
  className,
  markClassName = "h-6 w-6",
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-bold", className)}>
      <LoopMark className={markClassName} />
      <span className="tracking-tight">
        loop<span className="text-primary">africa</span>
      </span>
    </span>
  );
}
