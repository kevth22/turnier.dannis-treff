FIX 29.09.2026

- Spieler manuell hinzufügen im Turnier-Center repariert.
- JavaScript verwendet jetzt die tatsächlich vorhandenen Felder "Bezahlt" und "Anwesend".
- Manuell hinzugefügte Spieler werden weiterhin in derselben Firestore-Sammlung "warteschlange" gespeichert.
- Dadurch erscheinen sie automatisch auch auf turniere.html:
  - bezahlt = true -> Bezahlte Teilnehmer
  - bezahlt = false -> Warteschlange
- Die öffentliche Warteschlange bleibt für normale Besucher sichtbar; Admin-Funktionen bleiben separat.
- Cache-Version von turnier-live-v3.js auf v=534 erhöht.
