/**
 * Dev harness: run the SlideX Heddle agent end-to-end WITHOUT the HTTP/Supabase
 * stack. Exercises the real engine + SlideX MCP + LLM + mirror capture and can
 * submit multiple turns through one durable Heddle session.
 *
 * Requires: OPENAI_API_KEY (or the key for DEFAULT_MODEL's provider),
 * MOTIONDOC_MCP_COMMAND/ARGS/CWD pointing at the SlideX MotionDoc MCP.
 *
 * Usage:
 *   OPENAI_API_KEY=... npx tsx scripts/trySlidexAgent.ts "Create a 5-slide pitch deck for SlideX."
 *   OPENAI_API_KEY=... npx tsx scripts/trySlidexAgent.ts \
 *     "Create a 3-slide pitch deck." --then "Make slide 2 more visual."
 */
import "dotenv/config";
import { createHeddleDriver } from "../src/server/agent/heddleDriver.js";
import { StdioMcpProcessManager } from "../src/server/mcp/stdioMcp.js";
import { loadEnv } from "../src/server/env.js";
import type { AgentProgressEvent } from "../src/server/agent/types.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY;
  if (!apiKey && !env.DEV_HEDDLE_AUTH_STORE) {
    throw new Error(
      "Set OPENAI_API_KEY (or LLM_API_KEY), or DEV_HEDDLE_AUTH_STORE for Heddle OAuth credentials (e.g. a Codex subscription)."
    );
  }
  if (!env.MOTIONDOC_MCP_COMMAND) {
    throw new Error("Set MOTIONDOC_MCP_COMMAND/ARGS/CWD to the SlideX MotionDoc MCP.");
  }

  const messages = readMessages(process.argv.slice(2));
  const driver = createHeddleDriver(env);

  const emit = (event: AgentProgressEvent): void => {
    switch (event.type) {
      case "token":
        process.stdout.write(event.text);
        break;
      case "tool":
        process.stdout.write(`\n[tool] ${event.name} ${event.status}\n`);
        break;
      case "status":
        process.stdout.write(`\n[status] ${event.message}\n`);
        break;
      case "motionDoc":
        process.stdout.write(`\n[motionDoc updated: ${event.motionDoc.length} chars]\n`);
        break;
    }
  };

  console.log(`Model: ${env.DEFAULT_MODEL}`);
  console.log(`MCP: ${env.MOTIONDOC_MCP_COMMAND} ${env.MOTIONDOC_MCP_ARGS ?? ""}`);
  const mcpManager = new StdioMcpProcessManager(env);
  let motionDoc = "";

  for (const [index, message] of messages.entries()) {
    console.log(`\n=== TURN ${index + 1} ===`);
    console.log(`Message: ${message}\n`);
    const result = await driver.run({
      user: { id: "dev-harness-user" },
      sessionId: "dev-harness-session",
      motionDoc,
      message,
      llmApiKey: apiKey ?? "dev-oauth-placeholder",
      model: env.DEFAULT_MODEL,
      signal: new AbortController().signal,
      emit,
      mcpManager
    });
    motionDoc = result.motionDoc;

    console.log("\nassistantMessage:", result.assistantMessage);
    console.log("motionDoc length:", motionDoc.length);
    console.log("metadata:", JSON.stringify(result.metadata));
  }

  console.log("\n=== MotionDoc ===\n");
  console.log(motionDoc);
}

function readMessages(args: string[]): string[] {
  const raw = args.join(" ").trim();
  if (!raw) {
    return ["Create a 5-slide pitch deck for SlideX."];
  }

  return raw
    .split(/\s+--then\s+/)
    .map((message) => message.trim())
    .filter(Boolean);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
