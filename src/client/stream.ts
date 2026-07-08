import type { AgentStreamEvent, AgentStreamInput } from "../shared/schema.js";

export async function streamAgent(
  input: AgentStreamInput,
  accessToken: string,
  onEvent: (event: AgentStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const response = await fetch("/api/agent/stream", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify(input),
    signal
  });

  if (!response.ok || !response.body) {
    const message = await readError(response);
    throw new Error(message || `Request failed with ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    let separatorIndex = buffer.indexOf("\n\n");

    while (separatorIndex >= 0) {
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const parsed = parseSseBlock(block);
      if (parsed) {
        onEvent(parsed);
      }
      separatorIndex = buffer.indexOf("\n\n");
    }
  }
}

function parseSseBlock(block: string): AgentStreamEvent | null {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  if (!data) {
    return null;
  }

  return JSON.parse(data) as AgentStreamEvent;
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  if (!text) {
    return "";
  }

  try {
    return (JSON.parse(text) as { error?: string }).error ?? text;
  } catch {
    return text;
  }
}
