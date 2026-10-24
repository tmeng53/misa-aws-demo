import { createHash } from "node:crypto";
import { list, put } from "@vercel/blob";
import { isFaultMode, type FaultMode } from "./fault.js";

// Where the failure mode and the per-key call counts live. Locally they are
// variables; on Vercel, where each request may hit a different instance, they
// are small files in Blob storage.
export type FaultStore = {
  mode(): Promise<FaultMode>;
  setMode(mode: FaultMode): Promise<void>;
  // Records one paid call for a key and returns its 1-based number.
  countCall(keyId: string): Promise<number>;
};

export function memoryFaultStore(initial: FaultMode = "rhythm"): FaultStore {
  let current = initial;
  const calls = new Map<string, number>();
  return {
    mode: async () => current,
    setMode: async (next) => {
      current = next;
    },
    countCall: async (keyId) => {
      const n = (calls.get(keyId) ?? 0) + 1;
      calls.set(keyId, n);
      return n;
    },
  };
}

const stamp = () => `${String(Date.now()).padStart(15, "0")}-${Math.random().toString(36).slice(2, 8)}`;

// Each change and each call writes a new file, and reads list them: Blob URLs
// are cached by the CDN, listing is not. Concurrent calls for one key can share
// a number, which is fine for a demo.
export function blobFaultStore(token: string): FaultStore {
  const modePrefix = "fault-mode/";
  let cached: { mode: FaultMode; at: number } | undefined;
  return {
    async mode() {
      if (cached && Date.now() - cached.at < 1_000) return cached.mode;
      const { blobs } = await list({ prefix: modePrefix, token });
      const newest = blobs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];
      const name = newest?.pathname.slice(modePrefix.length).split("_")[1]?.replace(/\.txt$/, "");
      const mode = isFaultMode(name) ? name : "rhythm";
      cached = { mode, at: Date.now() };
      return mode;
    },
    async setMode(mode) {
      await put(`${modePrefix}${stamp()}_${mode}.txt`, mode, { access: "public", addRandomSuffix: false, token });
      cached = { mode, at: Date.now() };
    },
    async countCall(keyId) {
      const prefix = `calls/${createHash("sha256").update(keyId).digest("hex").slice(0, 16)}/`;
      const { blobs } = await list({ prefix, token, limit: 1000 });
      await put(`${prefix}${stamp()}.txt`, "1", { access: "public", addRandomSuffix: false, token });
      return blobs.length + 1;
    },
  };
}
