Dart11en Push Phase 1 – Version 9.0.2

Behoben:
- doppelte iPhone-Benachrichtigungen (FCM sendet jetzt nur noch Data-Payload)
- doppelte Firestore-Tokens werden vor dem Versand entfernt
- /turnier-sync funktioniert als POST und zum manuellen Test auch als GET
- Synchronisierung schreibt das Ergebnis in die Browser-Konsole
- Service-Worker-Cache wurde erhöht

Cloudflare:
Die Datei cloudflare-worker-turnier-push.js vollständig in den Worker kopieren und deployen.

Website:
Alle Dateien aus diesem Ordner in GitHub ersetzen.

Test:
https://dart11en-push.kevteha.workers.dev/test-push?nickname=Red%20Dart
Manueller Turnier-Sync:
https://dart11en-push.kevteha.workers.dev/turnier-sync
