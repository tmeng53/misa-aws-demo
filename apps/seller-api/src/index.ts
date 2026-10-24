// Vercel serves the default export of src/index.ts; keep other entry-like names (app.ts, server.ts) out of src.
// Entry point for Vercel, which serves a default-exported Hono app.
import { appFromEnv } from "./config.js";

export default appFromEnv();
