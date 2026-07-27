const TURNIER_PUSH_WORKER_URL = "https://dart11en-push.kevteha.workers.dev/turnier-sync";
let syncTimer = null;

/**
 * Informiert den Cloudflare Worker, dass sich der öffentliche Turnierstand
 * geändert hat. Der Browser sendet keine Spielernamen und keinen geheimen
 * Schlüssel. Der Worker liest und prüft den Stand selbst direkt in Firestore.
 */
export function turnierPushSynchronisieren() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(async () => {
    try {
      const response = await fetch(TURNIER_PUSH_WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "turnier-sync", zeit: Date.now() }),
        keepalive: true,
        cache: "no-store"
      });

      const result = await response.json().catch(() => null);
      window.__dart11enLetzterPushSync = result;
      console.info("Turnier-Push-Synchronisierung:", result);
      if (!response.ok || result?.ok === false) {
        console.warn("Turnier-Push-Synchronisierung fehlgeschlagen:", response.status, result);
      }
    } catch (error) {
      // Der Turnierablauf darf niemals durch einen Push-Fehler gestört werden.
      console.warn("Turnier-Push-Worker nicht erreichbar:", error);
    }
  }, 700);
}
