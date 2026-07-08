import fs from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import {
  ChatMessageSchema,
  SessionSchema,
  type ChatMessage,
  type Session,
  type SessionSummary
} from "../../shared/schema.js";

export class SessionStore {
  constructor(private readonly rootDir: string) {}

  async ensureReady(): Promise<void> {
    await fs.mkdir(this.sessionsRoot, { recursive: true });
  }

  async listSessions(userId: string): Promise<SessionSummary[]> {
    await this.ensureReady();
    const dir = this.userDir(userId);
    await fs.mkdir(dir, { recursive: true });
    const names = await fs.readdir(dir);
    const sessions = await Promise.all(
      names
        .filter((name) => name.endsWith(".json"))
        .map(async (name) => this.readSessionFile(path.join(dir, name)).catch(() => null))
    );

    return sessions
      .filter((session): session is Session => Boolean(session))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((session) => ({
        id: session.id,
        userId: session.userId,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messageCount: session.messages.length,
        hasMotionDoc: session.latestMotionDoc.trim().length > 0
      }));
  }

  async createSession(input: {
    userId: string;
    title?: string;
    motionDoc?: string;
  }): Promise<Session> {
    const now = new Date().toISOString();
    const session: Session = {
      id: nanoid(),
      userId: input.userId,
      title: input.title ?? "Untitled deck",
      createdAt: now,
      updatedAt: now,
      latestMotionDoc: input.motionDoc ?? "",
      messages: []
    };

    await this.writeSession(session);
    return session;
  }

  async getSession(userId: string, sessionId: string): Promise<Session | null> {
    const file = this.sessionPath(userId, sessionId);
    try {
      const session = await this.readSessionFile(file);
      return session.userId === userId ? session : null;
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  async requireSession(userId: string, sessionId: string): Promise<Session> {
    const session = await this.getSession(userId, sessionId);
    if (!session) {
      throw new Error("Session not found");
    }
    return session;
  }

  async writeSession(session: Session): Promise<Session> {
    const parsed = SessionSchema.parse({
      ...session,
      updatedAt: new Date().toISOString(),
      messages: session.messages.map((message) => ChatMessageSchema.parse(message))
    });

    const dir = this.userDir(parsed.userId);
    await fs.mkdir(dir, { recursive: true });
    const file = this.sessionPath(parsed.userId, parsed.id);
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(parsed, null, 2), "utf8");
    await fs.rename(tmp, file);
    return parsed;
  }

  async appendMessage(userId: string, sessionId: string, message: ChatMessage): Promise<Session> {
    const session = await this.requireSession(userId, sessionId);
    session.messages.push(message);
    return this.writeSession(session);
  }

  async renameSession(userId: string, sessionId: string, title: string): Promise<Session> {
    const session = await this.requireSession(userId, sessionId);
    session.title = title;
    return this.writeSession(session);
  }

  async deleteSession(userId: string, sessionId: string): Promise<{ ok: true }> {
    const file = this.sessionPath(userId, sessionId);
    try {
      await fs.unlink(file);
    } catch (error) {
      if (!isNotFound(error)) {
        throw error;
      }
    }
    return { ok: true };
  }

  private async readSessionFile(file: string): Promise<Session> {
    const text = await fs.readFile(file, "utf8");
    return SessionSchema.parse(JSON.parse(text));
  }

  private get sessionsRoot(): string {
    return path.join(this.rootDir, "sessions");
  }

  private userDir(userId: string): string {
    return path.join(this.sessionsRoot, safePathSegment(userId));
  }

  private sessionPath(userId: string, sessionId: string): string {
    return path.join(this.userDir(userId), `${safePathSegment(sessionId)}.json`);
  }
}

export function makeMessage(input: Omit<ChatMessage, "id" | "createdAt">): ChatMessage {
  return {
    id: nanoid(),
    createdAt: new Date().toISOString(),
    ...input
  };
}

function safePathSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 160);
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}
