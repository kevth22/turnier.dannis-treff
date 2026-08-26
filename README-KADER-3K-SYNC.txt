Dart11en – Kader + 3K-Bestleistungen (Version 3)
==================================================

3K-Quellen:
- Event 7019
- Event 8683
- Bereich: performances

Im Profil werden nur diese Bestleistungen angezeigt:
- 180 (Gesamtanzahl aus beiden Ligen)
- Highscore (ALLE Werte + Anzahl)
- Highfinish (ALLE Werte + Anzahl)
- Short Game (ALLE Werte + Anzahl)

171 wird NICHT als eigene Kategorie angezeigt.
Siege, Niederlagen und Legs bleiben weiterhin komplett aus dem Profil heraus.
Gastkonten werden weiterhin nicht im Kader angezeigt.

Zusammenführung:
Gleiche Bestleistung desselben Spielers in beiden Events wird addiert.
Beispiel:
7019: 160 einmal
8683: 160 zweimal
=> Profil: 3x 160

Spieler-Zuordnung:
Der Sync versucht automatisch u. a.:
- 3K-Spitzname in Klammern, z. B. Kevin Roth (Red Dart)
- Dart11en-Spitzname
- Vorname + Nachname
- Benutzername
Nicht zugeordnete Namen werden beim Sync zurückgemeldet und NICHT irgendeinem Spieler geraten zugeordnet.

WICHTIG – Cloudflare Worker
---------------------------
Die Datei cloudflare-worker-turnier-push.js wurde erweitert.
Der bereits verwendete Worker https://dart11en-push.kevteha.workers.dev muss mit dieser neuen Datei aktualisiert/deployt werden.
Danach steht zusätzlich zur bisherigen Push-Funktion bereit:
- POST /3k-sync
- GET /3k-debug?event=7019
- GET /3k-debug?event=8683

Die bisherigen Push-Routen bleiben erhalten.

3K-Endpunkt-Prüfung
-------------------
3K lädt die öffentlichen Eventdaten für events/11 über backend6.3k-darts.com/2k-backend6/api/v1/frontend/.
Da die konkrete Performances-Unterroute von der 3K-Web-App dynamisch geladen wird und öffentlich nicht dokumentiert ist,
prüft der Worker mehrere passende öffentliche Pfade automatisch. Sobald einer die Bestleistungsdaten liefert, wird er verwendet.

Nach dem Deployment zuerst im Browser testen:
https://dart11en-push.kevteha.workers.dev/3k-debug?event=7019

Wenn dort records > 0 bzw. ein endpoint gefunden wird, funktioniert die Verbindung.
Falls alle Versuche 404/0 liefern, die ausgegebene Diagnose an ChatGPT schicken; damit kann der letzte 3K-Pfad gezielt angepasst werden.

Automatisch aktuell halten
--------------------------
Der Worker enthält zusätzlich einen scheduled()-Handler.
In Cloudflare kann ein Cron Trigger eingerichtet werden, z. B. alle 6 Stunden:
0 */6 * * *

Dann werden die 3K-Bestleistungen automatisch aktualisiert, ohne dass jemand die App öffnen muss.
Admin/Captain haben im Spielerprofil zusätzlich den Button „3K synchronisieren“ für eine sofortige Aktualisierung.

Manuelle Eingabe
----------------
Bleibt als Fallback erhalten (nur Admin/Captain).
Listenwerte werden als „Wert = Anzahl“ eingetragen, z. B.:
160 = 2
156 = 1
