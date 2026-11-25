/** Cross-tab / same-origin live sync for warehouse stock (POS / purchases / returns). */

export const STOCK_BUMP_KEY = "rms-stock-bump";
const CHANNEL_NAME = "rms-stock-live";

let channel: BroadcastChannel | null | undefined;

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel;
  if (typeof BroadcastChannel === "undefined") {
    channel = null;
    return null;
  }
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
  } catch {
    channel = null;
  }
  return channel;
}

/** Notify inventory pages that stock-affecting data changed. */
export function bumpStockLive() {
  const stamp = String(Date.now());
  try {
    localStorage.setItem(STOCK_BUMP_KEY, stamp);
  } catch {
    /* ignore quota / private mode */
  }
  try {
    getChannel()?.postMessage({ type: "stock-bump", at: stamp });
  } catch {
    /* ignore */
  }
}

/** Subscribe to stock bumps from other tabs/windows on this origin. */
export function subscribeStockLive(onBump: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STOCK_BUMP_KEY) onBump();
  };
  const onMessage = () => onBump();
  const ch = getChannel();

  window.addEventListener("storage", onStorage);
  ch?.addEventListener("message", onMessage);

  return () => {
    window.removeEventListener("storage", onStorage);
    ch?.removeEventListener("message", onMessage);
  };
}
