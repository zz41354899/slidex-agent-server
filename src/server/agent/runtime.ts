import type { Env } from "../env.js";
import type { AgentDriver } from "./types.js";
import { createHeddleDriver } from "./heddleDriver.js";
import { createMockDriver } from "./mockDriver.js";

export function createAgentDriver(env: Env): AgentDriver {
  if (env.AGENT_DRIVER === "heddle") {
    return createHeddleDriver(env);
  }

  return createMockDriver();
}
