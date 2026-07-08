import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./router.js";
import { createContextFactory, type ServerDeps } from "./context.js";
import { createAgentStreamHandler, type AgentStreamDeps } from "./routes/agentStream.js";

export function createApp(deps: ServerDeps & Pick<AgentStreamDeps, "mcpManager">) {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: corsOrigin(deps.env.CORS_ORIGIN),
      credentials: false
    })
  );
  app.use(express.json({ limit: "10mb" }));

  app.get("/healthz", (_req, res) => {
    res.json({
      ok: true,
      agentDriver: deps.env.AGENT_DRIVER,
      dataDir: deps.env.dataDir,
      mcpConfigured: deps.mcpManager.configured
    });
  });

  app.use(
    "/trpc",
    trpcExpress.createExpressMiddleware({
      router: appRouter,
      createContext: createContextFactory(deps)
    })
  );

  app.post("/api/agent/stream", createAgentStreamHandler(deps));

  if (deps.env.NODE_ENV === "production") {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const clientDir = path.resolve(__dirname, "../../dist-client");
    app.use(express.static(clientDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(clientDir, "index.html"));
    });
  }

  return app;
}

function corsOrigin(origin?: string) {
  if (!origin || origin === "*") {
    return true;
  }

  const allowed = origin.split(",").map((item) => item.trim());
  return (requestOrigin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!requestOrigin || allowed.includes(requestOrigin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  };
}
