import type { AgentRunResult } from "./types.js";

type JayAgentArgs = {
  engine: unknown;
  mcp: {
    child: {
      stdin: NodeJS.WritableStream;
      stdout: NodeJS.ReadableStream;
    };
    command: string;
    args: string[];
  } | null;
  userId: string;
  sessionId: string;
  motionDoc: string;
  message: string;
  history: unknown[];
  signal: AbortSignal;
  emit: (event:
    | { type: "status"; message: string; detail?: Record<string, unknown> }
    | {
        type: "tool";
        name: string;
        status: "started" | "completed" | "failed";
        detail?: Record<string, unknown>;
      }
    | { type: "token"; text: string }
    | { type: "motionDoc"; motionDoc: string }) => void | Promise<void>;
};

export async function runSlideXAgent(args: JayAgentArgs): Promise<AgentRunResult> {
  await args.emit({
    type: "status",
    message: "Jay agent placeholder loaded",
    detail: {
      userId: args.userId,
      sessionId: args.sessionId,
      historyLength: args.history.length,
      hasEngine: Boolean(args.engine),
      hasMcp: Boolean(args.mcp)
    }
  });

  if (args.mcp) {
    await args.emit({
      type: "tool",
      name: "motiondoc-mcp",
      status: "completed",
      detail: {
        command: args.mcp.command,
        args: args.mcp.args
      }
    });
  }

  const motionDoc = args.motionDoc.trim()
    ? `${args.motionDoc.trimEnd()}\n\n{/* Jay agent placeholder */}\n\n> ${sanitizeMdx(args.message)}\n`
    : `# ${sanitizeMdx(args.message).slice(0, 64) || "SlideX Deck"}\n\n---\n\n## Outline\n\n${sanitizeMdx(
        args.message
      )}\n`;

  await args.emit({ type: "motionDoc", motionDoc });

  return {
    motionDoc,
    assistantMessage:
      "Jay agent placeholder returned a MotionDoc update. Replace this module with the production Heddle agent."
  };
}

function sanitizeMdx(value: string): string {
  return value.replace(/[{}<>]/g, "");
}
