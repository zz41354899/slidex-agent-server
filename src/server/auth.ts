import type { Request } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "./env.js";

export type AuthUser = {
  id: string;
  email?: string;
};

export class AuthService {
  private readonly supabase?: SupabaseClient;
  private readonly bypassUser?: AuthUser;

  constructor(private readonly env: Env) {
    if (env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
      this.supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    }

    // Dev-only auth bypass. Hard-guarded to non-production so it can never be
    // enabled on a deployed server even if the flag leaks into that env.
    if (env.NODE_ENV !== "production" && isTruthy(env.DEV_AUTH_BYPASS)) {
      this.bypassUser = {
        id: env.DEV_USER_ID || "dev-user",
        email: env.DEV_USER_EMAIL || "dev@example.com"
      };
      console.warn(
        `[auth] DEV_AUTH_BYPASS is ON — all requests authenticate as "${this.bypassUser.id}". Never use this in production.`
      );
    }
  }

  async getUserFromRequest(req: Request): Promise<AuthUser | null> {
    if (this.bypassUser) {
      return this.bypassUser;
    }
    const token = getBearerToken(req);
    if (!token) {
      return null;
    }
    return this.verifyToken(token);
  }

  async requireUserFromRequest(req: Request): Promise<AuthUser> {
    const user = await this.getUserFromRequest(req);
    if (!user) {
      throw new AuthError("Authentication required");
    }
    return user;
  }

  private async verifyToken(jwt: string): Promise<AuthUser> {
    if (!this.supabase) {
      throw new AuthError("Supabase is not configured");
    }

    const { data, error } = await this.supabase.auth.getUser(jwt);
    if (error || !data.user) {
      throw new AuthError(error?.message ?? "Invalid Supabase session");
    }

    return {
      id: data.user.id,
      email: data.user.email ?? undefined
    };
  }
}

export class AuthError extends Error {
  readonly statusCode = 401;
}

function isTruthy(value?: string): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}
