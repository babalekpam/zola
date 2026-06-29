import "./globals.css";
import type { Metadata } from "next";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Zola — Vibe code with any LLM",
  description:
    "AI coding workspace with chat, file editor, live preview, and multi-LLM routing across Claude, GPT, Gemini, and OpenRouter.",
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
