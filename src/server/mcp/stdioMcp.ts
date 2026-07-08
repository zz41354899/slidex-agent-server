import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { Env } from "../env.js";

export type MotionDocMcpProcess = {
  child: ChildProcessWithoutNullStreams;
  command: string;
  args: string[];
};

export class StdioMcpProcessManager {
  private process?: MotionDocMcpProcess;

  constructor(private readonly env: Env) {}

  get configured(): boolean {
    return Boolean(this.env.MOTIONDOC_MCP_COMMAND);
  }

  getOrStart(): MotionDocMcpProcess | null {
    if (!this.env.MOTIONDOC_MCP_COMMAND) {
      return null;
    }

    if (this.process && !this.process.child.killed) {
      return this.process;
    }

    const command = this.env.MOTIONDOC_MCP_COMMAND;
    const args = parseArgs(this.env.MOTIONDOC_MCP_ARGS);
    const child = spawn(command, args, {
      cwd: this.env.MOTIONDOC_MCP_CWD || process.cwd(),
      env: process.env,
      stdio: "pipe"
    });

    child.stderr.on("data", (chunk: Buffer) => {
      console.warn(`[motiondoc-mcp] ${chunk.toString("utf8").trim()}`);
    });
    child.on("exit", (code, signal) => {
      console.warn(`[motiondoc-mcp] exited code=${code ?? "null"} signal=${signal ?? "null"}`);
      if (this.process?.child === child) {
        this.process = undefined;
      }
    });

    this.process = { child, command, args };
    return this.process;
  }

  async stop(): Promise<void> {
    const current = this.process;
    this.process = undefined;
    if (!current || current.child.killed) {
      return;
    }

    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        current.child.kill("SIGKILL");
        resolve();
      }, 2_000);
      current.child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      current.child.kill("SIGTERM");
    });
  }
}

function parseArgs(raw?: string): string[] {
  if (!raw?.trim()) {
    return [];
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== "string")) {
      throw new Error("MOTIONDOC_MCP_ARGS JSON must be an array of strings");
    }
    return parsed;
  }

  return trimmed.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((part) => part.replace(/^"|"$/g, "")) ?? [];
}
