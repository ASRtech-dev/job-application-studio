/**
 * Persistent record of the last failed save. The local edits are always kept;
 * this only decides what the editor shows and whether autosave may try again.
 */
export interface SaveFailure {
  kind: "conflict" | "error" | "network";
  status: number | null;
  message: string;
  at: string;
  /** Draft snapshot that failed; a newer edit allows a new automatic attempt. */
  snapshot: string;
}

export function describeSaveFailure(status: number | null, serverMessage: string | undefined, snapshot: string, now = new Date()): SaveFailure {
  if (status === 409) {
    return {
      kind: "conflict",
      status,
      at: now.toISOString(),
      snapshot,
      message: serverMessage || "Another tab saved a newer version. Your edits are still here; reload the latest version before saving again.",
    };
  }
  if (status === 503) {
    return {
      kind: "error",
      status,
      at: now.toISOString(),
      snapshot,
      message: "Another save is in progress on disk. Click 'Retry save' or keep editing; your changes remain safe.",
    };
  }
  if (status === null) {
    return {
      kind: "network",
      status,
      at: now.toISOString(),
      snapshot,
      message: "Could not reach the local server. Your changes are still here.",
    };
  }
  return {
    kind: "error",
    status,
    at: now.toISOString(),
    snapshot,
    message: serverMessage || `The server could not save (HTTP ${status}). Your changes are still here.`,
  };
}

/**
 * Autosave never retries the identical snapshot in a loop, and never retries a
 * conflict automatically (that could hide a newer version). A new edit re-enables it.
 */
export function autoSaveAllowed(failure: SaveFailure | null, currentSnapshot: string): boolean {
  if (!failure) return true;
  if (failure.kind === "conflict") return false;
  return failure.snapshot !== currentSnapshot;
}
