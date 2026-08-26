Dart11en – Version 41 / Kader 3K-Spielstatistik

Neu:
- Spielerprofil zeigt zusätzlich:
  - Spiele gewonnen
  - Spiele verloren
  - Legs gewonnen
  - Legs verloren
- Statistikquellen: 3K Event 1255 (Ruhrpott) + 8683 (Herne)
- Werte aus beiden Events werden pro Spieler addiert.
- Zuordnung erfolgt zuerst über Vorname + Nachname des Dart11en-Mitglieds.
- Spitzname/Benutzername dienen nur als Fallback; optional threeKAliases für Sonderfälle.
- /3k-sync synchronisiert Bestleistungen und Spielstatistik gemeinsam.
- Neuer Diagnose-Endpunkt: /3k-stats-debug?event=1255
- Herne darf noch leer sein; das blockiert den Ruhrpott-Sync nicht.

Wichtig:
Da die interne 3K-API für statistics/player/results nicht dokumentiert ist, enthält der Worker mehrere lesende Kandidaten-Endpunkte. Event 1255 hat echte Daten und soll nach Deployment zuerst über /3k-stats-debug?event=1255 getestet werden. Falls records weiterhin 0 sind, bitte die Debug-Ausgabe weitergeben; dann kann der Parser exakt an die reale 3K-Struktur angepasst werden.
