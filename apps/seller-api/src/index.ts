// Vercel serves the default export of src/index.ts; keep other entry-like names (app.ts, server.ts) out of src.
// The Hono preset accepts this file only when it value-imports "hono".
import { Hono } from "hono";
import { appFromEnv } from "./config.js";

void Hono;

export default appFromEnv();
