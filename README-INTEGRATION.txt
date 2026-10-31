EbeApp → Cloudflare Worker → Typebot
Optimale Typebot-Zuordnung (Variante A, Schema 2)

ZIEL
----
Die EbeApp sendet weiterhin den vollständigen Datensatz. Der Worker bewahrt die strukturierten Daten und erstellt zusätzlich kurze, lesbare Textfelder. In Typebot müssen deshalb nicht mehr alle einzelnen Spielplan- und Tabellenfelder zugeordnet werden.

WAS GEÄNDERT WIRD
-----------------
Nur der Cloudflare-Worker wird ersetzt. Die vorhandene EbeApp (index.html), der Service Worker und das Manifest müssen für diese Änderung NICHT geändert werden.

Der Worker liefert weiterhin:
- players, released, game, schedule, table

Zusätzlich liefert er:
- spielerText          Spielerliste als Text
- freigabeText         Freigabestatus in Klartext
- aktuellesSpielText   aktuell ausgewähltes Spiel
- spielplanText        kompletter Spielplan
- ergebnisseText       gespeicherte Spielergebnisse
- torschuetzenText     Torschützen und Vorlagen
- aufgabenText         Aufgaben, Zuständigkeiten und Status
- tabellenText         Ligatabelle
- teamText             alle Themen in einem Gesamttext

SCHRITT 1 – CLOUDFLARE
----------------------
1. Cloudflare öffnen und den Worker „ebeco-lineup-api“ auswählen.
2. Im Editor den bisherigen Worker-Code vollständig markieren und ersetzen.
3. Den Inhalt der bereitgestellten Datei worker.js einfügen.
4. Prüfen, dass das KV-Binding LINEUP_KV weiterhin mit dem Namespace EBECO_LINEUP verbunden ist.
5. Deploy / Bereitstellen drücken.

Wichtig: ALLOWED_ORIGIN ist auf https://ronva83.github.io eingestellt. Wenn die App über eine andere Domain läuft, muss dieser Wert angepasst werden. Das KV-Binding darf nicht entfernt werden.

SCHRITT 2 – DATEN EINMALIG NEU SENDEN
-------------------------------------
1. EbeApp öffnen.
2. Mehr → Co-Trainer öffnen.
3. Einmal „Team A an Co-Trainer senden“ drücken.
4. Warten, bis die App die erfolgreiche Übertragung bestätigt.

Nicht mehrfach drücken. Das Senden aktualisiert den kompletten gespeicherten Datensatz.

SCHRITT 3 – TYPEBOT VEREINFACHEN
-------------------------------
Der bestehende GET-Request bleibt unverändert:
https://ebeco-lineup-api.varga30-10-99c.workers.dev/lineup

In Typebot beim HTTP-Request unter „Response variable mapping“ die folgenden Einträge anlegen. Die Auswahl im Dropdown heißt jeweils data.<Feldname> (Typebot zeigt den HTTP-Antwortkörper unter data an).

Empfohlene Zuordnung:

1. data.spielerText        → Variable: spielerText
2. data.freigabeText       → Variable: freigabeText
3. data.aktuellesSpielText → Variable: aktuellesSpielText
4. data.spielplanText      → Variable: spielplanText
5. data.ergebnisseText     → Variable: ergebnisseText
6. data.torschuetzenText   → Variable: torschuetzenText
7. data.aufgabenText       → Variable: aufgabenText
8. data.tabellenText       → Variable: tabellenText
9. data.teamText           → Variable: teamText

Du kannst die bisherige Zuordnung data.players → Players entfernen und stattdessen data.spielerText → spielerText verwenden. Wenn der bestehende Flow bereits die Variable Players verwendet, kannst du alternativ data.spielerText in diese vorhandene Variable speichern und die Flow-Nachrichten unverändert lassen.

Für gezielte Antworten soll der Bot die passende Variable verwenden:
- Frage nach Spielern/Aufstellung → spielerText
- Frage, ob die Aufstellung freigegeben ist → freigabeText (Spieler nur zeigen, wenn freigegeben)
- Frage nach dem aktuell geplanten Spiel → aktuellesSpielText
- Frage nach Terminen/Gegnern → spielplanText
- Frage nach Resultaten → ergebnisseText
- Frage nach Torschützen/Vorlagen → torschuetzenText
- Frage nach Eltern-/Teamaufgaben → aufgabenText
- Frage nach Tabellenplatz/Punkten → tabellenText
- Allgemeine Teamfrage → teamText

Die ursprünglichen strukturierten Daten bleiben in der API erhalten. Du musst sie in Typebot nicht alle einzeln zuordnen, wenn der Bot die Textfelder nutzt.

SCHRITT 4 – TEST
----------------
Die API im Browser öffnen:
https://ebeco-lineup-api.varga30-10-99c.workers.dev/lineup

Nach erfolgreichem Senden sollten im JSON unter anderem „spielerText“, „spielplanText“, „torschuetzenText“ und „teamText“ sichtbar sein. Wenn die Felder fehlen, wurde der neue Worker noch nicht veröffentlicht oder die EbeApp-Daten wurden nach dem Deploy noch nicht erneut gesendet.

SICHERHEIT / HINWEISE
--------------------
- Variante A ist Basisschutz, keine echte Authentifizierung. GET /lineup ist öffentlich lesbar.
- Der Worker begrenzt POST-Sendungen best-effort auf 20 pro IP und Stunde. Cloudflare KV ist eventual consistent; das ist kein harter Schutz.
- Keine privaten Zugangsdaten oder API-Geheimnisse in die öffentliche EbeApp einbauen.
- Für Kinderdaten möglichst die Einstellung „Nur Vornamen an den Co-Trainer senden“ aktiviert lassen.
- Der Worker zeigt die Spielerliste auch bei nicht freigegebener Aufstellung an. Typebot muss deshalb vor der Ausgabe von Spielern den Freigabestatus prüfen.
