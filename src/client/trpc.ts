import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import type { AppRouter } from "../server/router.js";

export function createApiClient(getAccessToken: () => string | null) {
  return createTRPCProxyClient<AppRouter>({
    transformer: superjson,
    links: [
      httpBatchLink({
        url: "/trpc",
        headers() {
          const token = getAccessToken();
          return token
            ? {
                authorization: `Bearer ${token}`
              }
            : {};
        }
      })
    ]
  });
}
