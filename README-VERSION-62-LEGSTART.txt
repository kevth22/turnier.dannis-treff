DART11EN V62 – SICHERER LEGSTART
================================

Neu in V62:

1) Einzel startet NICHT schon bei irgendeiner 501-Anzeige.
   Die Bridge schaltet nur auf BEREIT, wenn exakt 2 stabile Restscore-Anzeigen 501 zeigen.
   Sind versehentlich 3x501 sichtbar, passiert nichts.

2) Doppel schaltet nur auf BEREIT, wenn exakt 4 stabile Restscore-Anzeigen 501 zeigen.

3) 2x/4x501 bedeutet nur BEREIT – Average, Autozoom und Leglogik laufen noch nicht.

4) Das Leg startet erst beim ersten echten Dart:
   - Restscore wird von 501 kleiner, ODER
   - Pfeil-LEDs wechseln stabil von 3 auf 2.

5) Wenn alle drei Pfeil-LEDs gleichzeitig ausgehen (3 -> 0), wird das allein NICHT als erster Dart gewertet.

6) Vor dem Legstart werden alle eingerichteten Restscore-Felder beobachtet. Dadurch kann die Bridge erkennen,
   wenn jemand zuerst versehentlich 3 Spieler einstellt und danach neu auf 2 Spieler geht.

7) TV-Anzeige:
   - Glow = Spieler, der gerade wirft.
   - Pfeil = Spieler, der das Leg begonnen hat.
   - Bei 2x/4x501 vor dem ersten Dart steht kurz: BEREIT · WARTE AUF 1. DART.

Installation:
- Nur Streaming-PC / camera-bridge aktualisieren.
- Vorhandene config.json, camera-presets.json, instance-selection.json, score-settings.json,
  tv-settings.json und game-archive.json NICHT überschreiben.
