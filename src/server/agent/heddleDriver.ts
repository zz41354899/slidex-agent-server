import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Env } from "../env.js";
import type { AgentDriver, AgentRunArgs, AgentRunResult } from "./types.js";

type JayAgentRunner = (args: {
  engine: unknown;
  mcp: ReturnType<AgentRunArgs["mcpManager"]["getOrStart"]>;
  userId: string;
  sessionId: string;
  motionDoc: string;
  message: string;
  history: AgentRunArgs["history"];
  signal: AbortSignal;
  emit: AgentRunArgs["emit"];
}) => Promise<AgentRunResult>;

export function createHeddleDriver(env: Env): AgentDriver {
  return {
    async run(args) {
      const { createConversationEngine } = await import("@roackb2/heddle").catch((error) => {
        throw new Error(
          `@roackb2/heddle is not installed or is not accessible. Install it, or use AGENT_DRIVER=mock for local UI work. ${String(
            error
          )}`
        );
      });

      await args.emit({
        type: "status",
        message: "Creating user-scoped Heddle conversation engine"
      });

      const stateRoot = path.join(
        env.dataDir,
        "heddle",
        safePathSegment(args.user.id),
        safePathSegment(args.sessionId)
      );
      await fs.mkdir(stateRoot, { recursive: true });

      const engine = await createConversationEngine({
        workspaceRoot: env.HEDDLE_WORKSPACE_ROOT || process.cwd(),
        stateRoot,
        apiKey: args.llmApiKey,
        preferApiKey: true,
        model: args.model
      });

      const runner = await loadJayAgentRunner(env);
      const mcp = args.mcpManager.getOrStart();

      if (!mcp) {
        await args.emit({
          type: "status",
          message: "MotionDoc MCP subprocess is not configured"
        });
      } else {
        await args.emit({
          type: "tool",
          name: "motiondoc-mcp",
          status: "started",
          detail: {
            command: mcp.command,
            args: mcp.args
          }
        });
      }

      return runner({
        engine,
        mcp,
        userId: args.user.id,
        sessionId: args.sessionId,
        motionDoc: args.motionDoc,
        message: args.message,
        history: args.history,
        signal: args.signal,
        emit: args.emit
      });
    }
  };
}

async function loadJayAgentRunner(env: Env): Promise<JayAgentRunner> {
  if (!env.JAY_AGENT_MODULE_PATH) {
    throw new Error(
      "JAY_AGENT_MODULE_PATH is not configured. Point it at Jay's compiled agent module, or set AGENT_DRIVER=mock."
    );
  }

  const modulePath = path.isAbsolute(env.JAY_AGENT_MODULE_PATH)
    ? env.JAY_AGENT_MODULE_PATH
    : path.resolve(process.cwd(), env.JAY_AGENT_MODULE_PATH);
  const mod = (await import(pathToFileURL(modulePath).href)) as {
    runSlideXAgent?: JayAgentRunner;
    default?: JayAgentRunner;
  };

  const runner = mod.runSlideXAgent ?? mod.default;
  if (typeof runner !== "function") {
    throw new Error("Jay agent module must export runSlideXAgent(args) or default(args).");
  }

  return runner;
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 160);
}
