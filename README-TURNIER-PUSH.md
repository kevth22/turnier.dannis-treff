DART11EN – AUTOMATISCHE TURNIER-PUSHS
=====================================

1. In Cloudflare den Worker "dart11en-push" öffnen.
2. Den vollständigen Inhalt aus "cloudflare-worker-turnier-push.js" in den Worker kopieren.
3. Deploy drücken.
4. Die bereits vorhandenen Secrets müssen exakt so heißen:
   - FIREBASE_PROJECT_ID
   - FIREBASE_CLIENT_EMAIL
   - FIREBASE_PRIVATE_KEY
5. Die aktualisierte Website auf GitHub hochladen.
6. Jeder Spieler öffnet einmal "Benachrichtigungen" und aktiviert sie.

Zuordnung:
- Bestehende Mitglieder: Der gespeicherte Nickname wird verwendet.
- Neue Gastkonten: Benutzername und Nickname sind identisch.
- Der Turniername muss exakt dem Nickname im Konto entsprechen
  (Groß-/Kleinschreibung ist egal).

Automatische Nachrichten:
- Wartende Partie: "Dein kommender Gegner ist ..."
- Board zugeteilt: "Du spielst nun gegen ... an Board X. Good Darts!"

Sicherheit:
Der Browser sendet keine Namen, Tokens oder geheimen Schlüssel. Der Worker liest
nur den offiziellen Turnierstand aus Firestore und verhindert doppelte Pushs über
die Sammlung "turnierPushGesendet".
