/**
 * Synchronisiert Auth-Ereignisse zwischen Browser-Tabs.
 *
 * Hintergrund: Beim Organisationswechsel widerruft das Backend ALLE
 * Refresh-Tokens des Benutzers. Andere Tabs halten noch den alten
 * Access-Token (alte org_id) im Speicher und würden beim nächsten Refresh
 * abgemeldet. Stattdessen laden sie neu und übernehmen den neuen
 * Refresh-Token aus dem localStorage (zustand persist).
 */

export type AuthSyncEvent =
  | { type: "org-switched"; organizationId: string }
  | { type: "logout" };

const CHANNEL_NAME = "victora-auth";
const STORAGE_KEY = "victora-auth-event";

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL_NAME) : null;

export function broadcastAuthEvent(event: AuthSyncEvent): void {
  if (channel) {
    channel.postMessage(event);
    return;
  }
  // Fallback: storage-Event feuert nur in anderen Tabs.
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...event, ts: Date.now() }));
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function handleEvent(event: AuthSyncEvent): void {
  switch (event.type) {
    case "org-switched":
      // Kompletter Reload: frischer Query-Cache, neue SignalR-Verbindung,
      // neuer Refresh-Token aus localStorage.
      window.location.assign("/tournaments");
      break;
    case "logout":
      window.location.assign("/login");
      break;
  }
}

let initialized = false;

/** Einmalig beim App-Start aufrufen. */
export function initAuthSync(): void {
  if (initialized) return;
  initialized = true;

  if (channel) {
    channel.addEventListener("message", (e: MessageEvent<AuthSyncEvent>) => {
      if (e.data?.type) handleEvent(e.data);
    });
    return;
  }

  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      handleEvent(JSON.parse(e.newValue) as AuthSyncEvent);
    } catch {
      // ignore
    }
  });
}

