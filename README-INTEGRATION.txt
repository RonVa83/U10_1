EbeApp – Team-A / Co-Trainer Integration (aktuelle index.html)

Dieses Paket basiert auf der zuletzt hochgeladenen index.html und behält deren aktuelle Funktionen bei.

Dateien: index.html, sw.js, manifest.webmanifest, Icons und worker.js.

Einrichtung:
1. Auf GitHub Pages die Dateien aus diesem Ordner in das Repository hochladen/ersetzen.
2. Im Cloudflare Worker „ebeco-lineup-api“ den Code aus worker.js vollständig ersetzen und Deploy drücken.
3. Das KV-Binding LINEUP_KV muss weiterhin auf EBECO_LINEUP zeigen. Das alte Secret LINEUP_SECRET wird von Variante A nicht verwendet und bleibt aus dem Frontend heraus.
4. Worker-ALLOWED_ORIGIN ist auf https://ronva83.github.io eingestellt. Das gilt für https://ronva83.github.io/U10_1/; wenn deine App eine andere Domain nutzt, muss der Origin angepasst werden.
5. In der EbeApp wird die aktuelle Team-A-Liste nach dem Erstellen des Einsatzplans und bei Änderungen an Team A automatisch synchronisiert. Der Button „Team A an Co-Trainer senden“ sendet ebenfalls sofort; eine leere Liste löscht die bisherige Liste.
6. Prüfen: https://ebeco-lineup-api.varga30-10-99c.workers.dev/lineup

Sicherheit: Variante A ist nur Basisschutz. Origin-Prüfung und Rate-Limit erschweren Browser-Fremdzugriffe, sind aber keine echte Authentifizierung; direkte Clients können Origin fälschen. Kein Geheimnis im öffentlichen Frontend.

Typebot: die App öffnet https://typebot.co/ebecotrainer. Der vorhandene GET-Request in Typebot liest /lineup.
