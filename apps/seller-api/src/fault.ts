// How Fernbrook answers. By default it has a realistic flaw: every 3rd paid call
// for an API key fails, alternating between an empty answer and a server error,
// so a short demo always meets one bad answer without anyone touching a switch.
// The other modes are a hidden override for rehearsals.
export const FAULT_MODES = ["rhythm", "none", "always_empty", "always_error"] as const;
export type FaultMode = (typeof FAULT_MODES)[number];

export function isFaultMode(value: unknown): value is FaultMode {
  return typeof value === "string" && (FAULT_MODES as readonly string[]).includes(value);
}

export type Outcome = "ok" | "empty" | "error";

// `call` is the 1-based number of this paid call for the key.
export function outcome(mode: FaultMode, call: number): Outcome {
  switch (mode) {
    case "none":
      return "ok";
    case "always_empty":
      return "empty";
    case "always_error":
      return "error";
    case "rhythm":
      if (call % 3 !== 0) return "ok";
      return (call / 3) % 2 === 1 ? "empty" : "error";
  }
}
