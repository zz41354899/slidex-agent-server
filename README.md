# SlideX Agent Server

Small Node.js 20+ service for the SlideX conversational agent prototype.

It includes:

- Express server with tRPC for regular APIs.
- Express SSE route at `POST /api/agent/stream`.
- Zod validation for API inputs and persisted sessions.
- Supabase Auth token verification.
- Local JSON session storage for Railway persistent volumes.
- Heddle adapter that creates a per-request conversation engine with the user's own LLM key.
- MotionDoc MCP stdio subprocess manager.
- React chat panel served by the same Express app in production.

## Local Setup

```bash
npm install
cp .env.example .env
npm run dev
```

Set these values in `.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Open the Vite dev app at `http://localhost:5173`. The backend runs on `http://localhost:3000`.

## Agent Modes

`AGENT_DRIVER=mock` is the default for local development. It exercises Supabase, tRPC, local sessions, SSE, and MotionDoc updates without calling an LLM.

The Heddle SDK is installed as `@roackb2/heddle`. Set `AGENT_DRIVER=heddle` when Jay's module and the MotionDoc MCP command are ready:

```bash
AGENT_DRIVER=heddle
HEDDLE_WORKSPACE_ROOT=/app
JAY_AGENT_MODULE_PATH=./dist/server/agent/jayAgent.example.js
MOTIONDOC_MCP_COMMAND=node
MOTIONDOC_MCP_ARGS='["/app/path/to/motiondoc-mcp.js"]'
```

The real Jay module should export either:

```ts
export async function runSlideXAgent(args) {
  // args.engine is createConversationEngine({ apiKey, preferApiKey: true, model })
  // args.mcp is the MotionDoc MCP stdio child process descriptor
}
```

The server never stores the user's LLM API key. It is accepted only in the stream request body and passed into `createConversationEngine({ apiKey, preferApiKey: true, model })` for that request.

Heddle's `stateRoot` is created per user/session under `DATA_DIR/heddle`, so its local state also lands on the Railway volume.

## Railway

Railway deploys from `railway.json` and `Dockerfile`.

Runtime variables:

```bash
NODE_ENV=production
AGENT_DRIVER=heddle
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
DEFAULT_MODEL=gpt-4.1
HEDDLE_WORKSPACE_ROOT=/app
JAY_AGENT_MODULE_PATH=./dist/server/agent/jayAgent.example.js
MOTIONDOC_MCP_COMMAND=...
MOTIONDOC_MCP_ARGS=...
```

Attach a Railway volume and mount it at `/data`, or set `DATA_DIR` to the mounted path. If Railway injects `RAILWAY_VOLUME_MOUNT_PATH`, the server will use that when `DATA_DIR` is not set.

`GET /healthz` is used as the deployment healthcheck.

## API Shape

tRPC procedures:

- `health`
- `sessions.list`
- `sessions.create`
- `sessions.get`
- `sessions.rename`
- `sessions.delete`

SSE:

```http
POST /api/agent/stream
Authorization: Bearer <supabase-access-token>
Content-Type: application/json
Accept: text/event-stream
```

Body:

```json
{
  "sessionId": "optional-session-id",
  "message": "Create a deck from this outline",
  "motionDoc": "# Current deck",
  "llmApiKey": "user-owned-key",
  "model": "gpt-4.1"
}
```

Events are emitted as normal SSE frames with `event:` and JSON `data:` fields: `session`, `status`, `tool`, `token`, `motionDoc`, `complete`, and `error`.
