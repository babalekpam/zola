// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Zola — Vibe code with any LLM · by Argilette Lab",
  description:
    "AI coding workspace with chat, file editor, live preview, and multi-LLM routing across Claude, GPT, Gemini, NVIDIA NIM, and OpenRouter. Built by Argilette Lab.",
  authors: [{ name: "Argilette Lab" }],
  creator: "Argilette Lab",
  publisher: "Argilette Lab",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster theme="dark" />
      </body>
    </html>
  );
}