Dart11en – Kader/Profile V1

Geändert:
- Alte Team-Aufteilung Rhein Ruhr / Ruhrpott / Herner / Springer entfernt.
- Kader wird dynamisch aus Firestore "mitglieder" geladen.
- Gastkonten werden nicht im Kader angezeigt.
- Angezeigt werden nur: mitglied, captain, admin, kassenwart.
- Klick auf einen Spieler öffnet dessen Profil.
- Fremde Profile: Profilfoto, Spitzname, Name, Rolle und vorhandene Bestleistungen.
- Keine gewonnenen/verlorenen Spiele und keine Legs im Profil.
- Eigenes Profil: Profilfoto ändern, Spitzname ändern, Passwort ändern.
- Spitzname ändert NICHT den Login-Benutzernamen.
- Passwortänderung verlangt das aktuelle Passwort.
- Bestehende statische Spielerfotos werden als Fallback weiterverwendet.
- Neue Profilfotos werden komprimiert im Mitgliedsdokument als profilBild gespeichert.

Bestleistungen:
Die aktuelle ZIP enthält noch keine Vereinsranglisten-/Bestleistungslogik. kader.js erkennt deshalb bereits mehrere übliche Felder in mitglieder, z.B.:
bestleistungen.highscore
bestleistungen.180
bestleistungen.171
bestleistungen.shortleg
Sobald diese Werte in den Mitgliedsdokumenten vorhanden sind, werden sie im Profil angezeigt.

Wichtig:
Das vorhandene Kontosystem arbeitet ohne Firebase Authentication. Die mitgelieferte Beispiel-Regel erlaubt Updates an Mitgliedern grundsätzlich. Die Oberfläche verhindert die Fremdbearbeitung, echter serverseitiger Schutz benötigt später Firebase Auth oder ein eigenes Backend.
