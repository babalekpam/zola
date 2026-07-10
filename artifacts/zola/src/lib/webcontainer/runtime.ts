// Copyright (c) 2026 Argilette Lab. SPDX-License-Identifier: MIT
import { WebContainer, configureAPIKey, type WebContainerProcess } from "@webcontainer/api";

// StackBlitz WebContainer boots for free on localhost, but custom production
// domains require a registered origin + API key. If one is configured we apply
// it before boot; otherwise boot will fail on non-localhost origins.
const WC_API_KEY = import.meta.env.VITE_WEBCONTAINER_API_KEY as
  | string
  | undefined;
let wcKeyConfigured = false;

function isLocalHost() {
  if (typeof window === "undefined") return false;
  return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
}

export type RuntimeStatus =
  | "idle"
  | "booting"
  | "installing"
  | "starting"
  | "running"
  | "stopped"
  | "error";

export interface RuntimeState {
  status: RuntimeStatus;
  url: string | null;
  error: string | null;
}

type Listener = () => void;
type ConsoleListener = (chunk: string) => void;

/**
 * Singleton owner of the WebContainer instance and its lifecycle. The
 * workspace boots exactly one container per page; Run/Stop, the Console, the
 * Shell, and the Webview all talk to this object instead of holding their own
 * container references, so switching tabs never restarts anything.
 */
class WebContainerRuntime {
  private container: WebContainer | null = null;
  private booting: Promise<WebContainer> | null = null;
  private devProcess: WebContainerProcess | null = null;
  private env: Record<string, string> = {};
  private files: Record<string, string> = {};
  private listeners = new Set<Listener>();
  private consoleListeners = new Set<ConsoleListener>();
  private consoleBuffer: string[] = [];
  private runGeneration = 0;

  state: RuntimeState = { status: "idle", url: null, error: null };

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Console subscribers get the scrollback replayed so late mounts miss nothing. */
  subscribeConsole(fn: ConsoleListener): () => void {
    for (const chunk of this.consoleBuffer) fn(chunk);
    this.consoleListeners.add(fn);
    return () => this.consoleListeners.delete(fn);
  }

  clearConsole() {
    this.consoleBuffer = [];
  }

  private emit(partial: Partial<RuntimeState>) {
    this.state = { ...this.state, ...partial };
    for (const fn of this.listeners) fn();
  }

  private writeConsole(chunk: string) {
    this.consoleBuffer.push(chunk);
    if (this.consoleBuffer.length > 2000) {
      this.consoleBuffer = this.consoleBuffer.slice(-1500);
    }
    for (const fn of this.consoleListeners) fn(chunk);
  }

  setEnv(env: Record<string, string>) {
    this.env = { ...env };
  }

  getEnv(): Record<string, string> {
    return { ...this.env };
  }

  async setFiles(files: Record<string, string>) {
    this.files = files;
    if (this.container) {
      await this.container.mount(toMountStructure(files)).catch(() => {});
    }
  }

  private async ensureContainer(): Promise<WebContainer> {
    if (this.container) return this.container;
    if (this.booting) return this.booting;

    this.booting = (async () => {
      if (!self.crossOriginIsolated) {
        throw new Error(
          "This browser context is not cross-origin isolated, so the in-browser Node runtime can't start. Open the app in a top-level browser tab (or use a supported browser) and try again.",
        );
      }
      if (WC_API_KEY && !wcKeyConfigured) {
        configureAPIKey(WC_API_KEY);
        wcKeyConfigured = true;
      }
      if (!WC_API_KEY && !isLocalHost()) {
        throw new Error(
          "The in-browser Node runtime (StackBlitz WebContainer) only runs for free on localhost. On this published domain it needs a WebContainer API key with this origin registered at https://webcontainer.io — add it as VITE_WEBCONTAINER_API_KEY and republish. (It still works in the Replit dev preview.)",
        );
      }
      const container = await WebContainer.boot();
      container.on("server-ready", (_port, serverUrl) => {
        this.writeConsole(`\r\nServer ready at ${serverUrl}\r\n`);
        this.emit({ status: "running", url: serverUrl });
      });
      this.container = container;
      return container;
    })();

    try {
      return await this.booting;
    } finally {
      this.booting = null;
    }
  }

  /** Boot + mount + npm install + npm run dev — the Run button. */
  async run() {
    if (
      this.state.status === "booting" ||
      this.state.status === "installing" ||
      this.state.status === "starting"
    ) {
      return;
    }
    const generation = ++this.runGeneration;
    try {
      this.emit({ status: "booting", error: null, url: null });
      this.writeConsole("Booting WebContainer…\r\n");
      const container = await this.ensureContainer();
      if (generation !== this.runGeneration) return;

      this.emit({ status: "installing" });
      this.writeConsole("Mounting project files…\r\n");
      await container.mount(toMountStructure(this.files));

      this.writeConsole("$ npm install\r\n");
      const install = await container.spawn("npm", ["install"], {
        env: this.env,
      });
      install.output.pipeTo(
        new WritableStream({ write: (data) => this.writeConsole(data) }),
      );
      const code = await install.exit;
      if (generation !== this.runGeneration) {
        return;
      }
      if (code !== 0) throw new Error(`npm install failed (exit ${code})`);

      this.emit({ status: "starting" });
      this.writeConsole("$ npm run dev\r\n");
      const dev = await container.spawn("npm", ["run", "dev"], {
        env: this.env,
      });
      dev.output.pipeTo(
        new WritableStream({ write: (data) => this.writeConsole(data) }),
      );
      this.devProcess = dev;
      void dev.exit.then((exitCode) => {
        if (this.devProcess !== dev) return; // superseded by a restart
        this.devProcess = null;
        this.writeConsole(`\r\nDev server exited (code ${exitCode}).\r\n`);
        this.emit({ status: "stopped", url: null });
      });
    } catch (err) {
      if (generation !== this.runGeneration) return;
      const msg = err instanceof Error ? err.message : String(err);
      this.writeConsole(`\r\nError: ${msg}\r\n`);
      this.emit({ status: "error", error: msg, url: null });
    }
  }

  /** Stops the dev server; also aborts an in-flight install/boot sequence. */
  stop() {
    this.runGeneration++;
    if (this.devProcess) {
      const proc = this.devProcess;
      this.devProcess = null;
      proc.kill();
    }
    if (this.state.status !== "idle" && this.state.status !== "error") {
      this.writeConsole("\r\nStopped by user.\r\n");
      this.emit({ status: "stopped", url: null });
    }
  }

  async restart() {
    this.stop();
    await this.run();
  }

  /**
   * Interactive login shell for the Shell tab. Caller owns resize + IO wiring;
   * project secrets ride along as process env, matching Replit's shell.
   */
  async spawnShell(cols: number, rows: number): Promise<WebContainerProcess> {
    const container = await this.ensureContainer();
    // Make sure the FS exists even if the user opens the shell before running.
    await container.mount(toMountStructure(this.files)).catch(() => {});
    return container.spawn("jsh", [], {
      terminal: { cols, rows },
      env: this.env,
    });
  }
}

type FileSystemTree = Record<
  string,
  { file: { contents: string } } | { directory: FileSystemTree }
>;

function toMountStructure(files: Record<string, string>): FileSystemTree {
  const root: FileSystemTree = {};
  for (const [path, content] of Object.entries(files)) {
    const segs = path.split("/");
    let cur = root;
    segs.forEach((seg, i) => {
      if (i === segs.length - 1) {
        cur[seg] = { file: { contents: content } };
      } else {
        if (!cur[seg]) cur[seg] = { directory: {} };
        cur = (cur[seg] as { directory: FileSystemTree }).directory;
      }
    });
  }
  return root;
}

export const runtime = new WebContainerRuntime();
