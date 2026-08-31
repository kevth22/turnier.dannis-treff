DART11EN CAMERA BRIDGE – VERSION 63
=================================

NEU: PLAUSIBILITÄT / SELBSTKORREKTUR
- Restscores werden nicht blind übernommen.
- Im laufenden 501 kann der aktive Spieler pro Aufnahme höchstens 180 Punkte verlieren.
- Inaktive Spieler dürfen ihren Rest nicht plötzlich ändern.
- Ein höherer Restscore wird nur akzeptiert, wenn er zur Bust-Rückstellung auf den Aufnahme-Start passt.
- Unplausible Reads bleiben intern als Warnung sichtbar, der bisher sichere Score bleibt bestehen.
- Wurfscore: nur 0–180. Runde: nur 1–99.

NEU: NEU SYNCHRONISIEREN
- In /control pro Board: „Neu synchronisieren“.
- Leert Messhistorien und liest Score/Pfeile/Runde/Restscores ca. 1,4 s neu ein.
- Legs, Matchstand und bereits gespeicherte Statistik bleiben erhalten.
- Während der Synchronisierung bleibt Auto-Zoom auf Gesamtansicht.

NEU: LEG-/MATCH-ABBRUCHSCHUTZ
- Laufendes Leg + erneut stabil exakt 2×501 (Einzel) / 4×501 (Doppel): Leg-Neustart.
- Statistik, die seit Beginn dieses Legs gesammelt wurde, wird auf den Legstart zurückgerollt.
- Längere Credit-/Leerphase während eines laufenden Legs + danach wieder Startscores: kompletter Match-Neustart.
- Abgebrochene Matches werden nicht ins Spielarchiv geschrieben.
- Normale kurze Legwechsel-Animationen lösen keinen Match-Reset aus.

INSTALLATION
Nur Streaming-PC/Bridge ändern. Keine GitHub-Datei ist für V63 nötig.
Beim Kopieren NIE löschen/überschreiben, falls vorhanden:
- config.json
- camera-presets.json
- instance-selection.json
- score-settings.json
- tv-settings.json
- game-archive.json
