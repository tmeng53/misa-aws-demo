// Entry point for running on any Node host: `pnpm start`.
import { serve } from "@hono/node-server";
import { appFromEnv } from "./config.js";

const port = Number(process.env.PORT ?? 4010);
serve({ fetch: appFromEnv().fetch, port }, (info) => {
  console.log(`Fernbrook Fundamentals API on http://localhost:${info.port}`);
});
