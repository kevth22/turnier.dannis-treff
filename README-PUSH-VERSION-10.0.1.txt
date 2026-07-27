Dart11en Push Version 10.0.1 – Vordergrund-Push-Fix

Behoben:
- Turnier-Pushs werden nun auch sichtbar angezeigt, wenn die Dart11en-App gerade geöffnet ist.
- Hintergrund-Pushs funktionieren weiterhin über sw.js.
- Doppelte Vordergrund-Anzeigen werden anhand des Push-Tags unterdrückt.
- Service-Worker-Cache wurde auf dart11en-v1-6-4-foreground-push erhöht.

Cloudflare:
- cloudflare-worker-turnier-push.js bleibt Version 10.0 Basis.
- Worker-Datei weiterhin vollständig deployen, falls sie noch nicht aktiv ist.

Test:
1. Dateien bei GitHub ersetzen.
2. Dart11en-App auf dem iPhone vollständig schließen.
3. App neu öffnen und ein neues Turnier auslosen.
4. Red Dart muss auch bei geöffneter App genau eine sichtbare Benachrichtigung erhalten.
