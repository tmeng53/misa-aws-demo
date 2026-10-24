// The demo's "bad day" switch. `none` is the real service; each other mode is a
// common way a data seller fails a buyer, so the checker in front of the API
// has something real to catch.
export const FAULT_MODES = ["none", "empty", "malformed", "error", "slow"] as const;
export type FaultMode = (typeof FAULT_MODES)[number];

export function isFaultMode(value: unknown): value is FaultMode {
  return typeof value === "string" && (FAULT_MODES as readonly string[]).includes(value);
}

export const FAULT_DESCRIPTIONS: Record<FaultMode, string> = {
  none: "Healthy: real answers.",
  empty: "Answers 200 with no results.",
  malformed: "Answers 200 with a body that is not JSON.",
  error: "Answers 500.",
  slow: "Waits 20 seconds before answering.",
};
