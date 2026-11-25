/** Cross-tab / same-origin live sync for POS → cashier / kitchen. */

export const ORDERS_BUMP_KEY = "rms-orders-bump";
const CHANNEL_NAME = "rms-orders-live";

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

/** Notify cashier/KDS (and other tabs) that orders changed. */
export function bumpOrdersLive() {
  const stamp = String(Date.now());
  try {
    localStorage.setItem(ORDERS_BUMP_KEY, stamp);
  } catch {
    /* ignore quota / private mode */
  }
  try {
    getChannel()?.postMessage({ type: "orders-bump", at: stamp });
  } catch {
    /* ignore */
  }
}

/** Subscribe to order bumps from other tabs/windows on this origin. */
export function subscribeOrdersLive(onBump: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === ORDERS_BUMP_KEY) onBump();
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
