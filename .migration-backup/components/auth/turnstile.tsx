// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
"use client";

import Script from "next/script";
import { useEffect, useId, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "error-callback"?: () => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

interface Props {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

export function Turnstile({ onVerify, onExpire }: Props) {
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.turnstile || !containerRef.current) return;
      try {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: "dark",
          callback: onVerify,
          "expired-callback": onExpire,
          "error-callback": onExpire,
        });
      } catch {
        // already rendered — ignore
      }
    };

    if (window.turnstile) {
      render();
    } else {
      const t = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(t);
          render();
        }
      }, 100);
      return () => {
        cancelled = true;
        window.clearInterval(t);
      };
    }
  }, [siteKey, onVerify, onExpire]);

  if (!siteKey) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div ref={containerRef} id={`turnstile-${id}`} />
    </>
  );
}
