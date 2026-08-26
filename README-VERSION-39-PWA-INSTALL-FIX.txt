Dart11en – PWA Installationsbutton Fix

- Installationsbutton startet standardmäßig verborgen.
- In der installierten iOS-PWA wird er über navigator.standalone erkannt und bleibt verborgen.
- display-mode: standalone wird ebenfalls geprüft.
- Im normalen Browser bleibt der Installationshinweis verfügbar.
- Service-Worker-Cache-Version erhöht.
