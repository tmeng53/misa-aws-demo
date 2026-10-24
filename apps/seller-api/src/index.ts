// Vercel serves the default export of src/index.ts, and only treats a file as
// the entry when it imports hono. Keep other entry-like names (app.ts,
// server.ts) out of src.
import { Hono } from "hono";
import { appFromEnv } from "./config.js";

const app = new Hono();
app.route("/", appFromEnv());

export default app;
