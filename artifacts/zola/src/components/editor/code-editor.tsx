// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { lazy, Suspense } from "react";
import type { Monaco, OnMount } from "@monaco-editor/react";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.Editor })),
);

function getLanguage(path: string): string {
  const ext = path.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript",
    css: "css", html: "html", json: "json", md: "markdown",
    py: "python", sh: "shell", toml: "toml", yaml: "yaml", yml: "yaml",
  };
  return map[ext] ?? "plaintext";
}

// The editor previews files without the project's real tsconfig or
// node_modules, so Monaco's built-in TypeScript checker reports phantom errors
// (missing modules, JSX flags, etc.). Turn all of that off so the editor just
// shows clean, syntax-highlighted code like Replit's editor.
function disableDiagnostics(monaco: Monaco) {
  for (const defaults of [
    monaco.languages.typescript.typescriptDefaults,
    monaco.languages.typescript.javascriptDefaults,
  ]) {
    defaults.setDiagnosticsOptions({
      noSemanticValidation: true,
      noSyntaxValidation: true,
      noSuggestionDiagnostics: true,
    });
  }
}

interface Props {
  path: string;
  value: string;
  onChange: (value: string) => void;
}

export function CodeEditor({ path, value, onChange }: Props) {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading editor…
      </div>
    }>
      <MonacoEditor
        key={path}
        height="100%"
        language={getLanguage(path)}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        theme="vs-dark"
        beforeMount={disableDiagnostics}
        onMount={((editorInstance) => {
          // Stop the browser from spellchecking the rendered code text.
          const dom = editorInstance.getDomNode();
          if (dom) {
            dom.setAttribute("spellcheck", "false");
            dom
              .querySelectorAll("textarea, [contenteditable]")
              .forEach((el: Element) => el.setAttribute("spellcheck", "false"));
          }
        }) satisfies OnMount}
        options={{
          fontSize: 13,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          tabSize: 2,
          insertSpaces: true,
          wordWrap: "on",
          lineNumbers: "on",
          renderWhitespace: "selection",
          smoothScrolling: true,
          cursorSmoothCaretAnimation: "on",
          padding: { top: 8, bottom: 8 },
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
          // Hide the red error markers on the right-hand overview ruler and
          // suppress any lingering validation decorations.
          renderValidationDecorations: "off",
          overviewRulerLanes: 0,
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
        }}
      />
    </Suspense>
  );
}
