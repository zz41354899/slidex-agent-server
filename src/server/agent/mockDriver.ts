import type { AgentDriver } from "./types.js";

export function createMockDriver(): AgentDriver {
  return {
    async run(args) {
      await wait(160, args.signal);
      await args.emit({ type: "status", message: "Mock agent received request" });
      await wait(180, args.signal);
      await args.emit({
        type: "tool",
        name: "motiondoc.plan",
        status: "started",
        detail: { model: args.model }
      });
      await wait(240, args.signal);

      const motionDoc = buildMotionDoc(args.motionDoc, args.message);
      await args.emit({
        type: "tool",
        name: "motiondoc.plan",
        status: "completed"
      });
      await args.emit({
        type: "motionDoc",
        motionDoc
      });

      const assistantMessage =
        "Mock agent finished. Replace AGENT_DRIVER=mock with AGENT_DRIVER=heddle when Jay's module and the MotionDoc MCP command are wired.";

      for (const word of assistantMessage.split(" ")) {
        await wait(12, args.signal);
        await args.emit({ type: "token", text: `${word} ` });
      }

      return {
        motionDoc,
        assistantMessage
      };
    }
  };
}

function buildMotionDoc(existing: string, message: string): string {
  if (existing.trim()) {
    return `${existing.trimEnd()}\n\n{/* Agent note */}\n\n> ${escapeMdxText(message)}\n`;
  }

  const title = message.split(/\n|。|\.|，|,/)[0]?.trim().slice(0, 64) || "New SlideX Deck";
  return `# ${escapeMdxText(title)}\n\n---\n\n## Direction\n\n${escapeMdxText(
    message
  )}\n\n---\n\n## Next Steps\n\n- Wire Jay's Heddle agent module\n- Configure MotionDoc MCP stdio command\n- Stream real tool events back into this panel\n`;
}

function escapeMdxText(value: string): string {
  return value.replace(/[{}<>]/g, "");
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}
