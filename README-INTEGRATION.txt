EbeApp – Team-A / Co-Trainer Integration (aktuelle index.html)

Dieses Paket basiert auf der zuletzt hochgeladenen index.html und behält deren aktuelle Funktionen bei.

Dateien: index.html, sw.js, manifest.webmanifest, Icons und worker.js.

Einrichtung:
1. Auf GitHub Pages die Dateien aus diesem Ordner in das Repository hochladen/ersetzen.
2. Im Cloudflare Worker „ebeco-lineup-api“ den Code aus worker.js vollständig ersetzen und Deploy drücken.
3. Das KV-Binding LINEUP_KV muss weiterhin auf EBECO_LINEUP zeigen. Das alte Secret LINEUP_SECRET wird von Variante A nicht verwendet und bleibt aus dem Frontend heraus.
4. Worker-ALLOWED_ORIGIN ist auf https://ronva83.github.io eingestellt. Das gilt für https://ronva83.github.io/U10_1/; wenn deine App eine andere Domain nutzt, muss der Origin angepasst werden.
5. In der EbeApp wird die aktuelle Team-A-Liste nach dem Erstellen des Einsatzplans und bei Änderungen an Team A automatisch synchronisiert – aber nur, wenn sich die Spielerliste wirklich geändert hat (sonst wäre das Limit von 60 Anfragen pro Stunde schnell verbraucht). Der Button „Team A an Co-Trainer senden“ sendet ebenfalls sofort; eine leere Liste löscht die bisherige Liste.
6. Prüfen: https://ebeco-lineup-api.varga30-10-99c.workers.dev/lineup

Sicherheit: Variante A ist nur Basisschutz. Origin-Prüfung und Rate-Limit erschweren Browser-Fremdzugriffe, sind aber keine echte Authentifizierung; direkte Clients können Origin fälschen. Kein Geheimnis im öffentlichen Frontend.

Typebot: die App öffnet https://typebot.co/ebecotrainer. Der vorhandene GET-Request in Typebot liest /lineup.


Neu in dieser Version
- Namen: Standardmäßig werden nur Vornamen an den Co-Trainer gesendet (bei doppelten Vornamen mit Initial, z. B. „Max M.“). Das lässt sich in ☰ Mehr → Einstellungen ausschalten. Hintergrund: Der Worker-Link steht im öffentlichen Quelltext; ohne Lese-Schlüssel kann jeder die Liste abrufen.
- Lese-Schlüssel (empfohlen): Im Cloudflare-Worker unter Settings → Variables eine Variable READ_KEY mit einem langen, zufälligen Wert anlegen. Danach liefert GET /lineup nur noch Daten, wenn ?key=DEIN_WERT angehängt ist (oder der Header X-Read-Key gesetzt ist). In Typebot im HTTP-Request-Block die Adresse auf https://ebeco-lineup-api.varga30-10-99c.workers.dev/lineup?key=DEIN_WERT ändern. Die EbeApp selbst braucht den Schlüssel nicht, sie schreibt nur. Ohne READ_KEY bleibt alles wie bisher.
- Der Worker lehnt Anfragen über 8 KB ab und erlaubt 60 Schreibzugriffe pro Stunde und Gerät.
- Service Worker (sw.js, Version v3): Fehlt ein Symbol oder das Manifest im Repository, startet der Offline-Modus trotzdem. Beim Öffnen wird immer beim Server nachgefragt, damit neue Versionen sofort erscheinen und nicht erst nach 10 Minuten.
- Neue Version: Beim Start mit Internet prüft die App (höchstens alle 30 Minuten), ob eine neuere index.html online liegt, und zeigt dann „Neue Version … tippen zum Laden“. Die Versionsnummer steht im Mehr-Menü; bei jedem Update die Konstante APP_VERSION in der index.html hochzählen.
- Import: Vor jedem Import wird der bisherige Stand gesichert; unter ☰ Mehr → „Import rückgängig machen“ lässt er sich zurückholen.
