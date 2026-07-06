// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth/mammoth.browser";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface Attachment {
  path: string;
  content: string;
}

export type ReadResult =
  | { ok: true; attachment: Attachment }
  | { ok: false; name: string; error: string };

// Keep extracted text at or under the API's per-file store limit so nothing is
// silently dropped server-side (the API skips attachments longer than 200_000).
const MAX_CHARS = 200_000;
// Guard against enormous uploads freezing the tab while we parse them.
const MAX_BYTES = 25 * 1024 * 1024;

const TEXT_EXTENSIONS = new Set([
  "txt", "md", "markdown", "json", "csv", "tsv", "js", "jsx", "ts", "tsx",
  "html", "htm", "css", "scss", "sass", "less", "py", "rb", "go", "rs",
  "java", "kt", "php", "c", "h", "cpp", "cc", "hpp", "cs", "swift", "yml",
  "yaml", "toml", "ini", "xml", "svg", "env", "sql", "sh", "bash", "zsh",
  "log", "text", "vue", "svelte", "graphql", "gql", "dockerfile", "gitignore",
]);

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function cap(text: string): string {
  return text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
}

async function readAsText(file: File): Promise<string> {
  return await file.text();
}

async function readPdf(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const line = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    parts.push(line);
    if (parts.join("\n").length > MAX_CHARS) break;
  }
  return parts.join("\n").trim();
}

async function readDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value.trim();
}

export async function readAttachment(file: File): Promise<ReadResult> {
  const name = file.name;
  if (file.size > MAX_BYTES) {
    return { ok: false, name, error: "file is too large (max 25MB)" };
  }

  const extension = ext(name);
  const type = file.type;

  try {
    let content: string;
    if (extension === "pdf" || type === "application/pdf") {
      content = await readPdf(file);
      if (!content) {
        return {
          ok: false,
          name,
          error: "no text found (scanned or image-only PDF)",
        };
      }
    } else if (
      extension === "docx" ||
      type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      content = await readDocx(file);
      if (!content) return { ok: false, name, error: "no text found in document" };
    } else if (extension === "doc") {
      return {
        ok: false,
        name,
        error: "legacy .doc isn't supported — save as .docx or PDF",
      };
    } else if (TEXT_EXTENSIONS.has(extension) || type.startsWith("text/")) {
      content = await readAsText(file);
    } else {
      return {
        ok: false,
        name,
        error: "unsupported file type",
      };
    }

    return { ok: true, attachment: { path: name, content: cap(content) } };
  } catch {
    return { ok: false, name, error: "could not read file" };
  }
}
