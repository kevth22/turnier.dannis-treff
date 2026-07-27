Dart11en Turnier-Push – Version 10.0 Basis

Enthalten sind ausschließlich die bisher vereinbarten Meldungen:
- Test-Push
- Board-Push für sofort startende Partien
- Gegner-Push für wartende Partien
- Freilos-Push
- Board- oder Gegner-Push nach einem Ergebnis
- Schutz vor doppeltem Versand
- neue pushTurnierId pro Auslosung
- Diagnoseausgabe unter /turnier-sync

Cloudflare:
Die Datei cloudflare-worker-turnier-push.js vollständig in den Worker kopieren und deployen.

Diagnose:
https://dart11en-push.kevteha.workers.dev/turnier-sync

Die Antwort enthält für jeden Spieler den Grund:
- gesendet
- ohne-abo
- bereits-gesendet-oder-in-bearbeitung
- fcm-fehler
