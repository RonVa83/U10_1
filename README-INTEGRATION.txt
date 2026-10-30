EbeApp – Co-Trainer / Typebot Integration (aktueller Stand)

Dieses Paket basiert auf der aktuellen index.html und behält deren Funktionen bei.

Dateien: index.html, sw.js, manifest.webmanifest, Icons (icon-192.png, icon-512.png) und worker.js.


1. EINRICHTUNG
--------------
1. Auf GitHub Pages die Dateien aus diesem Ordner in das Repository hochladen/ersetzen.
2. Im Cloudflare Worker „ebeco-lineup-api“ den Code aus worker.js vollständig ersetzen und Deploy drücken.
   (Nach jeder neuen worker.js nötig, sonst speichert der Worker neue Felder nicht.)
3. Das KV-Binding LINEUP_KV muss weiterhin auf EBECO_LINEUP zeigen. Das alte Secret LINEUP_SECRET wird nicht verwendet.
4. Worker-ALLOWED_ORIGIN ist auf https://ronva83.github.io eingestellt (gilt für https://ronva83.github.io/U10_1/).
   Nutzt die App eine andere Domain, muss der Origin angepasst werden.
5. In der EbeApp einmal „📤 Team A an Co-Trainer senden“ drücken (Mehr → Co-Trainer), damit die neuen Daten im Worker liegen.
6. Prüfen: https://ebeco-lineup-api.varga30-10-99c.workers.dev/lineup
7. Typebot: die App öffnet https://typebot.co/ebecotrainer. Der GET-Request in Typebot liest /lineup;
   die Felder aus Abschnitt 3 als Variablen anlegen.


2. WAS DIE APP SENDET (automatisch und per Button)
--------------------------------------------------
Die App sendet bei jedem Senden den kompletten Stand; die bisherige Liste im Worker wird vollständig ersetzt.

Automatisch (nach ca. 1 Sekunde, nur wenn sich etwas geändert hat und Internet da ist):
- Änderungen an der Team-A-Aufstellung bzw. am Einsatzplan
- Aufstellung freigeben / Freigabe zurückziehen
- Spielplan importieren, Spiele anlegen/bearbeiten/löschen
- Ergebnisse speichern, bearbeiten oder löschen (Dashboard, Vergangene Spiele)
- Tabelle importieren oder löschen
Manuell: Mehr → Co-Trainer → „📤 Team A an Co-Trainer senden“ sendet sofort. Dort steht auch der Freigabe-Schalter.
„💬 Co-Trainer öffnen“ öffnet den Typebot in der App.

Gleiche Daten werden nicht noch einmal gesendet (schont das Limit von 20 Sendungen pro Stunde und IP).


3. DATENFORMAT (POST und GET auf /lineup)
-----------------------------------------
{
  "players": ["Max", "Ben", ...],          Team A aus der geöffneten Planung (Vornamen, siehe Einstellungen)
  "released": true | false,                 Aufstellung für die Eltern freigegeben?
  "game": {                                 das Spiel, für das die Planung gerade geöffnet ist (sonst null)
    "datum": "2026-11-14", "zeit": "09:30",
    "heimAuswaerts": "Heim" | "Auswärts",
    "gegner": "SC Baldham-Vaterstetten", "ort": "…"
  },
  "schedule": [                             ganzer Spielplan, nach Datum sortiert (max. 60 Spiele)
    {
      "datum": "2026-09-19", "zeit": "16:30",
      "heimAuswaerts": "Heim" | "Auswärts",
      "gegner": "SV Waldperlach", "ort": "…",
      "gespielt": true | false,
      "ergebnis": { "wir": 3, "gegner": 8 } | null,     immer aus Sicht der eigenen Mannschaft
      "tore": [ { "spieler": "Max", "minute": 12, "vorlage": "Ben" } ]   eigene Torschützen (nur bei gespeicherten Matches)
      "aufgaben": [ { "aufgabe": "Kioskschicht 1", "wer": "Julius Mama, Julius Papa", "personen": ["Julius Mama", "Julius Papa"], "erledigt": true, "datum": "2026-09-21" } ]   Zusatzaufgaben
    }
  ],
  "table": {                                Ligatabelle (aus dem letzten Import)
    "stand": "29.10.2026",
    "teams": [ { "platz": 1, "mannschaft": "…", "spiele": 5, "siege": 4, "unentschieden": 0, "niederlagen": 1,
                 "toreFuer": 30, "toreGegen": 12, "differenz": 18, "punkte": 12, "eigene": true | false } ]
  },
  "updatedAt": "…"                          setzt der Worker
}

Hinweise:
- „released“: Typebot sollte die Spieler nur zeigen, wenn released = true ist. Der Worker liefert die Spieler auch ohne Freigabe aus.
- Eine leere Spielerliste löscht die bisherige Liste.
- Namen: standardmäßig nur Vornamen (bei gleichen Vornamen mit Initial). Einstellung: Mehr → Einstellungen →
  „Nur Vornamen an den Co-Trainer senden“.
- Torschützen und Ergebnisse stammen aus gespeicherten Matches; bei Spielen, die nur aus dem Spielplan-PDF ein Ergebnis haben,
  ist „tore“ leer.


4. PLANUNG JE SPIEL UND FREIGABE
--------------------------------
- Spiel → Spielplanung → „📆 Planung für“: Aufstellung, Verfügbarkeit, Teams und Einsatzplan gehören zu einem Spiel
  (nächstes, übernächstes …) oder zur „freien Planung“.
- „Aufstellung freigegeben“ gilt pro Spiel. Neue Spiele starten mit „nicht freigegeben“.
- Ändert sich die Aufstellung nach der Freigabe, bleibt die Freigabe bestehen (bei Bedarf selbst zurückziehen).
- Die Team-A-Liste für den Bot kommt immer aus der Planung, die gerade geöffnet ist.


5. SPIELPLAN, ZUORDNUNG UND ERGEBNISSE
--------------------------------------
- Spiel → Spielplan → „📥 Importieren“: PDF von bfv.de hochladen oder den kopierten Text einfügen.
  Es werden nur Spiele der eigenen Mannschaft übernommen (Einstellung „Verein in der Tabelle hervorheben“, Standard „Ebersberg“).
  PDF-Link: Einstellungen → „Link Spielplan (PDF)“. Das PDF-Lesen lädt pdf.js aus dem Internet.
- Offene Spiele erscheinen auf dem Dashboard. Match → „📆 Spiel aus Spielplan zuweisen“ übernimmt Heim/Auswärts und Gegner;
  „+ Zum Dashboard“ ordnet das Ergebnis diesem Spiel zu. Danach steht es unter Spiel → Vergangene Spiele (dort bearbeitbar).
- Pro Spiel kann ein Spielort / eine Adresse eingetragen werden (Link in die Karten-App).
- Wird der Verein in den Einstellungen geändert, wird der Spielplan gelöscht; danach muss er neu importiert werden.
  Das Kürzel der eigenen Mannschaft (z. B. EBE) wird aus den ersten drei Buchstaben des Vereins gebildet.


5b. ZUSATZAUFGABEN UND ADRESSEN
-------------------------------
- Jedes Spiel im Spielplan hat Aufgaben (Standard Heim: Trikotwäsche, Obst, Kuchen, Kioskschicht 1/2; Auswärts: Trikotwäsche, Obst,
  Fahrgemeinschaften, Spieler abholen). Die Vorlagen sind unter Mehr → Einstellungen änderbar und gelten für neue Spiele.
- „📋 Aufgaben“ beim Spiel: mehrere Personen (Spieler/Eltern), erledigt-Häkchen und „erledigt am“-Datum; Aufgaben können ergänzt/gelöscht werden.
- „🧺 Aufgaben“ im Spielplan: Übersicht, wer wann was gemacht hat (pro Aufgabe und pro Person).
- Die Aufgaben werden an den Bot gesendet (siehe Datenformat: schedule[].aufgaben). „personen“ ist die Liste der eingetragenen Personen (z. B. „Julius Mama“, „Julius Papa“), „wer“ dieselben Namen mit Komma getrennt.
  Beginnt der Text mit dem vollständigen Namen eines Spielers, wird er auf den Vornamen gekürzt (außer die Einstellung „Nur Vornamen“ ist aus).
- Mehr → Adressen: Adress-Datenbank je Mannschaft (Heimspielstätte). Neue Spiele übernehmen bekannte Adressen automatisch.

6. TRAINING
-----------
- Training → Trainingsbeteiligung: Trainings über „＋ Training eintragen“ erfassen. Anwesenheit und Trainingsteams
  kommen immer aus dem zuletzt gespeicherten Training (neuestes Datum).
- Die Quote pro Spieler steht unter Statistik → Trainingsbeteiligung.


7. SICHERHEIT
-------------
Variante A ist nur Basisschutz: Origin-Prüfung und ein einfaches Limit pro IP (20 POST-Anfragen pro Stunde) erschweren
Browser-Fremdzugriffe, sind aber keine echte Authentifizierung; direkte Clients können den Origin fälschen.
Das GET auf /lineup ist öffentlich lesbar. Kein Geheimnis im öffentlichen Frontend ablegen.
Daten von Kindern sparsam halten: Standard ist „nur Vornamen“.
