import { randomBytes } from "node:crypto";
import { createApp } from "./create-app.js";
import { blobFaultStore, memoryFaultStore } from "./fault-store.js";

// Builds the app from environment variables (see .env.example).
export function appFromEnv(env: NodeJS.ProcessEnv = process.env) {
  const keySecret = env.PROVIDER_KEY_SECRET || randomBytes(32).toString("hex");
  if (!env.PROVIDER_KEY_SECRET) {
    console.warn("PROVIDER_KEY_SECRET is not set: self-serve keys will stop working when the process restarts.");
  }
  return createApp({
    publicUrl: env.PROVIDER_URL?.replace(/\/$/, "") || undefined,
    keySecret,
    staticKeys: (env.PROVIDER_API_KEYS ?? "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    adminToken: env.PROVIDER_ADMIN_TOKEN || undefined,
    faults: env.BLOB_READ_WRITE_TOKEN ? blobFaultStore(env.BLOB_READ_WRITE_TOKEN) : memoryFaultStore(),
  });
}
