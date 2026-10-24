import { list, put } from "@vercel/blob";
import { isFaultMode, type FaultMode } from "./fault.js";

// Where the "bad day" switch lives. Locally it is a variable; on Vercel, where
// each request may hit a different instance, it is a tiny file in Blob storage.
export type FaultStore = {
  get(): Promise<FaultMode>;
  set(mode: FaultMode): Promise<void>;
};

export function memoryFaultStore(initial: FaultMode = "none"): FaultStore {
  let mode = initial;
  return {
    get: async () => mode,
    set: async (next) => {
      mode = next;
    },
  };
}

// Each change writes a new file named by time, and reads take the newest. Blob
// URLs are cached by the CDN, so overwriting one file would serve stale modes;
// listing is not cached.
export function blobFaultStore(token: string): FaultStore {
  const prefix = "fault-mode/";
  let cached: { mode: FaultMode; at: number } | undefined;
  return {
    async get() {
      if (cached && Date.now() - cached.at < 1_000) return cached.mode;
      const { blobs } = await list({ prefix, token });
      const newest = blobs.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0];
      const name = newest?.pathname.slice(prefix.length).split("_")[1]?.replace(/\.txt$/, "");
      const mode = isFaultMode(name) ? name : "none";
      cached = { mode, at: Date.now() };
      return mode;
    },
    async set(mode) {
      await put(`${prefix}${String(Date.now()).padStart(15, "0")}_${mode}.txt`, mode, {
        access: "public",
        addRandomSuffix: false,
        token,
      });
      cached = { mode, at: Date.now() };
    },
  };
}
