Dart11en – Version 40: Turnier-Anmeldung in der App bearbeiten

Neu:
- Admin und Captain sehen oben auf turniere.html den Button „Turnier bearbeiten“.
- Turnierdaten werden in Firestore unter einstellungen/turnierAnmeldung gespeichert.
- Änderbar: Titel, Untertitel, Datum, Anwurf, Anmeldeschluss, Ort, maximale Teilnehmer,
  Startgeld, PayPal-Zahlbetrag/Name, Spielmodus, Turnierform, Best-of, Ausschüttung,
  Platzierungsprozente, Best-Lady/Zusatzpreis und Anmeldung offen/geschlossen.
- turniere.html verwendet diese Daten dynamisch.
- index.html zeigt denselben Turniernamen, Datum und Anwurf automatisch.
- Teilnehmerlimit, Startgeld, PayPal-Link und Countdown verwenden ebenfalls die Einstellungen.
- Bestehende Warteschlange wird beim Ändern der Turnierdaten NICHT automatisch gelöscht.

Hinweis:
Falls das Speichern in Firestore mit „Missing or insufficient permissions“ scheitert, müssen die
Firestore-Regeln Schreibzugriff auf einstellungen/turnierAnmeldung erlauben. Die bestehende App
verwendet weiterhin ihr eigenes rollenbasiertes Kontosystem und kein Firebase Authentication.
