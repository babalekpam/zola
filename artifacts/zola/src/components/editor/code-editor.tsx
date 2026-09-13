// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { lazy, Suspense, useEffect, useRef } from "react";
import type { Monaco, OnMount } from "@monaco-editor/react";
import { fetchCompletion, fetchInlineEdit } from "@/hooks/use-ai-complete";

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((m) => ({ default: m.Editor })),
);

type EditorInstance = Parameters<OnMount>[0];
type TextModel = NonNullable<ReturnType<EditorInstance["getModel"]>>;
type CursorPosition = NonNullable<ReturnType<EditorInstance["getPosition"]>>;

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

// How much surrounding code the completion model sees per keystroke pause.
const PREFIX_CHARS = 8_000;
const SUFFIX_CHARS = 2_000;
const COMPLETION_DEBOUNCE_MS = 350;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function makeButton(label: string, primary: boolean): HTMLButtonElement {
  const b = document.createElement("button");
  b.textContent = label;
  b.style.cssText = primary
    ? "background:#2f81f7;border:1px solid #2f81f7;color:#fff;border-radius:5px;padding:3px 10px;font-size:12px;cursor:pointer"
    : "background:transparent;border:1px solid #6e7681;color:#c9d1d9;border-radius:5px;padding:3px 10px;font-size:12px;cursor:pointer";
  return b;
}

interface Props {
  path: string;
  value: string;
  onChange: (value: string) => void;
  projectId?: string;
}

interface InlineEditSession {
  revert: () => void;
  widget: { dispose(): void } | null;
}

export function CodeEditor({ path, value, onChange, projectId }: Props) {
  const latestRef = useRef({ path, projectId });
  latestRef.current = { path, projectId };
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const disposablesRef = useRef<{ dispose(): void }[]>([]);
  // Latest request wins: each new keystroke aborts/supersedes the previous
  // completion so ghost text never arrives stale.
  const completionRef = useRef<{ seq: number; abort: AbortController | null }>({
    seq: 0,
    abort: null,
  });
  const inlineSessionRef = useRef<InlineEditSession | null>(null);

  useEffect(
    () => () => {
      completionRef.current.abort?.abort();
      inlineSessionRef.current?.widget?.dispose();
      disposablesRef.current.forEach((d) => d.dispose());
    },
    [],
  );

  const closeInlineSession = (accept: boolean) => {
    const session = inlineSessionRef.current;
    if (!session) return;
    inlineSessionRef.current = null;
    session.widget?.dispose();
    if (!accept) session.revert();
  };

  const showReviewWidget = (
    editor: EditorInstance,
    monaco: Monaco,
    anchorLine: number,
    session: InlineEditSession,
  ) => {
    const dom = document.createElement("div");
    dom.style.cssText =
      "display:flex;gap:8px;align-items:center;background:#1f2428;border:1px solid #3a4046;border-radius:6px;padding:6px 10px;z-index:60;font-family:system-ui;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,.4)";

    const acceptBtn = makeButton("✓ Accept", true);
    acceptBtn.onclick = () => closeInlineSession(true);
    const rejectBtn = makeButton("✕ Reject", false);
    rejectBtn.onclick = () => closeInlineSession(false);
    const hint = document.createElement("span");
    hint.textContent = "Esc rejects";
    hint.style.cssText = "color:#8b949e;font-size:11px";
    dom.append(acceptBtn, rejectBtn, hint);
    dom.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeInlineSession(false);
      }
    });

    const widget = {
      getId: () => "zola.inline-edit.review",
      getDomNode: () => dom,
      getPosition: () => ({
        position: { lineNumber: anchorLine, column: 1 },
        preference: [monaco.editor.ContentWidgetPositionPreference.BELOW],
      }),
    };
    editor.addContentWidget(widget);
    session.widget = { dispose: () => editor.removeContentWidget(widget) };
    acceptBtn.focus();
  };

  // Ctrl/Cmd+K: describe an edit for the current selection; the AI's
  // replacement is applied through the normal change pipeline (so file sync,
  // checkpoints and collab see it), then reviewed with Accept/Reject.
  const openInlineEdit = (editor: EditorInstance, monaco: Monaco) => {
    closeInlineSession(false);

    const model = editor.getModel();
    const selection = editor.getSelection();
    if (!model || !selection || selection.isEmpty()) return;
    const selectedText = model.getValueInRange(selection);
    if (!selectedText.trim()) return;

    const startLine = selection.startLineNumber;
    const startOffset = model.getOffsetAt(selection.getStartPosition());
    const endOffset = model.getOffsetAt(selection.getEndPosition());
    const beforeEdit = model.getValue();

    const dom = document.createElement("div");
    dom.style.cssText =
      "display:flex;gap:8px;align-items:center;background:#1f2428;border:1px solid #3a4046;border-radius:6px;padding:6px 10px;z-index:60;box-shadow:0 4px 12px rgba(0,0,0,.4)";
    const input = document.createElement("input");
    input.placeholder = "Describe the edit… (Enter to apply, Esc to cancel)";
    input.style.cssText =
      "width:260px;background:#0d1117;border:1px solid #3a4046;border-radius:5px;color:#c9d1d9;font-size:12px;padding:4px 8px;outline:none";
    const status = document.createElement("span");
    status.style.cssText = "color:#8b949e;font-size:11px;white-space:nowrap";
    dom.append(input, status);

    let open = true;
    const widget = {
      getId: () => "zola.inline-edit.input",
      getDomNode: () => dom,
      getPosition: () => ({
        position: { lineNumber: startLine, column: 1 },
        preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE],
      }),
    };
    const closeInput = () => {
      if (!open) return;
      open = false;
      editor.removeContentWidget(widget);
    };
    editor.addContentWidget(widget);

    input.onkeydown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeInput();
        editor.focus();
        return;
      }
      if (e.key !== "Enter") return;
      const instruction = input.value.trim();
      if (!instruction) return;
      input.disabled = true;
      status.textContent = "Thinking…";
      try {
        const replacement = await fetchInlineEdit({
          code: selectedText,
          instruction,
          language: getLanguage(latestRef.current.path),
          projectId: latestRef.current.projectId,
        });
        if (!open) return; // Esc pressed while the request was in flight
        closeInput();
        if (!replacement.trim()) {
          editor.focus();
          return;
        }
        onChangeRef.current(
          beforeEdit.slice(0, startOffset) + replacement + beforeEdit.slice(endOffset),
        );
        const session: InlineEditSession = {
          revert: () => onChangeRef.current(beforeEdit),
          widget: null,
        };
        inlineSessionRef.current = session;
        showReviewWidget(editor, monaco, startLine, session);
        editor.focus();
      } catch {
        closeInput();
        editor.focus();
      }
    };

    setTimeout(() => input.focus(), 0);
  };
  const openInlineEditRef = useRef(openInlineEdit);
  openInlineEditRef.current = openInlineEdit;

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
        onMount={((editorInstance, monacoInstance) => {
          // Stop the browser from spellchecking the rendered code text.
          const dom = editorInstance.getDomNode();
          if (dom) {
            dom.setAttribute("spellcheck", "false");
            dom
              .querySelectorAll("textarea, [contenteditable]")
              .forEach((el: Element) => el.setAttribute("spellcheck", "false"));
          }

          // 1) Ghost-text completions (Cursor's Tab-to-accept). Debounced,
          // cancelled on the next keystroke, and silent on every failure —
          // inline suggest must never interrupt typing.
          const providerDisposable =
            monacoInstance.languages.registerInlineCompletionsProvider("*", {
              provideInlineCompletions: async (
                model: TextModel,
                position: CursorPosition,
              ) => {
                try {
                  const line = model.getLineContent(position.lineNumber);
                  const nextChar = line.slice(position.column - 1, position.column);
                  if (nextChar && /[\w$]/.test(nextChar)) return { items: [] };

                  const full = model.getValue();
                  const offset = model.getOffsetAt(position);
                  const prefix = full.slice(Math.max(0, offset - PREFIX_CHARS), offset);
                  const suffix = full.slice(offset, offset + SUFFIX_CHARS);
                  if (!prefix.trim() && !suffix.trim()) return { items: [] };

                  const state = completionRef.current;
                  state.abort?.abort();
                  const ac = new AbortController();
                  const seq = ++state.seq;
                  state.abort = ac;
                  await delay(COMPLETION_DEBOUNCE_MS);
                  if (state.seq !== seq) return { items: [] };

                  const completion = await fetchCompletion(
                    {
                      prefix,
                      suffix,
                      language: getLanguage(latestRef.current.path),
                      projectId: latestRef.current.projectId,
                    },
                    ac.signal,
                  );
                  if (!completion || state.seq !== seq) return { items: [] };

                  const lines = completion.split("\n");
                  const range = new monacoInstance.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber + lines.length - 1,
                    lines.length === 1
                      ? position.column + lines[0].length
                      : lines[lines.length - 1].length + 1,
                  );
                  return { items: [{ insertText: completion, range }] };
                } catch {
                  return { items: [] };
                }
              },
            });
          disposablesRef.current.push(providerDisposable);

          // 2) Ctrl/Cmd+K inline edit (Cursor's cmd-K).
          const actionDisposable = editorInstance.addAction({
            id: "zola.inline-edit",
            label: "Edit with AI",
            keybindings: [
              monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyK,
            ],
            precondition: "editorHasSelection",
            contextMenuGroupId: "1_modification",
            contextMenuOrder: 0,
            run: () => openInlineEditRef.current(editorInstance, monacoInstance),
          });
          disposablesRef.current.push(actionDisposable);

          // Esc rejects a pending AI edit even when the editor has focus.
          const keyDisposable = editorInstance.onKeyDown((e) => {
            if (
              e.keyCode === monacoInstance.KeyCode.Escape &&
              inlineSessionRef.current
            ) {
              closeInlineSession(false);
            }
          });
          disposablesRef.current.push(keyDisposable);
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
          // Cursor-style AI surface: ghost text renders as you pause typing
          // and Tab accepts it; Tab also completes the word suggestion.
          inlineSuggest: { enabled: true },
          tabCompletion: "on",
        }}
      />
    </Suspense>
  );
}
