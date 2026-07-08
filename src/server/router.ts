import { TRPCError } from "@trpc/server";
import {
  CreateSessionInputSchema,
  RenameSessionInputSchema,
  SessionIdInputSchema
} from "../shared/schema.js";
import { protectedProcedure, publicProcedure, router } from "./trpc.js";

export const appRouter = router({
  health: publicProcedure.query(({ ctx }) => ({
    ok: true,
    agentDriver: ctx.deps.env.AGENT_DRIVER,
    dataDir: ctx.deps.env.dataDir,
    hasSupabase: Boolean(ctx.deps.env.SUPABASE_URL && ctx.deps.env.SUPABASE_ANON_KEY)
  })),
  sessions: router({
    list: protectedProcedure.query(({ ctx }) => {
      return ctx.deps.sessionStore.listSessions(ctx.user.id);
    }),
    create: protectedProcedure.input(CreateSessionInputSchema).mutation(({ ctx, input }) => {
      return ctx.deps.sessionStore.createSession({
        userId: ctx.user.id,
        title: input.title,
        motionDoc: input.motionDoc
      });
    }),
    get: protectedProcedure.input(SessionIdInputSchema).query(async ({ ctx, input }) => {
      const session = await ctx.deps.sessionStore.getSession(ctx.user.id, input.sessionId);
      if (!session) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Session not found"
        });
      }
      return session;
    }),
    rename: protectedProcedure.input(RenameSessionInputSchema).mutation(({ ctx, input }) => {
      return ctx.deps.sessionStore.renameSession(ctx.user.id, input.sessionId, input.title);
    }),
    delete: protectedProcedure.input(SessionIdInputSchema).mutation(({ ctx, input }) => {
      return ctx.deps.sessionStore.deleteSession(ctx.user.id, input.sessionId);
    })
  })
});

export type AppRouter = typeof appRouter;
