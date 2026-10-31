// Cloudflare Worker for EbeApp Team-A lineup.
// Variant A: no client-side secret. Origin allowlist + basic per-IP rate limit.
// Important: Origin checks are not authentication; non-browser clients can spoof Origin.
const ALLOWED_ORIGIN = "https://ronva83.github.io";
const RATE_LIMIT_PER_HOUR = 20;
const MAX_PLAYERS = 50;

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ALLOWED_ORIGIN ? ALLOWED_ORIGIN : "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}
function json(data, status = 200, origin = "") {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
      if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403, headers: corsHeaders(origin) });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (url.pathname === "/" && request.method === "GET") {
      return json({ service: "EbeApp Lineup API", status: "ok", endpoints: ["/lineup"] }, 200, origin);
    }
    if (url.pathname !== "/lineup") return json({ error: "Not found" }, 404, origin);
    if (request.method === "GET") {
      const saved = await env.LINEUP_KV.get("current-lineup");
      return json(saved ? JSON.parse(saved) : { players: [], released: false, game: null, schedule: [], table: { stand: "", teams: [] } }, 200, origin);
    }
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
    if (origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed" }, 403, origin);

    // Best-effort rate limit. KV is eventually consistent, so this is not a hard security boundary.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const hour = new Date().toISOString().slice(0, 13);
    const rateKey = `rate:${hour}:${ip}`;
    const used = Number(await env.LINEUP_KV.get(rateKey) || 0);
    if (used >= RATE_LIMIT_PER_HOUR) return json({ error: "Rate limit exceeded" }, 429, origin);
    await env.LINEUP_KV.put(rateKey, String(used + 1), { expirationTtl: 3600 });

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Invalid JSON" }, 400, origin); }
    if (!Array.isArray(body.players)) return json({ error: "players must be an array" }, 400, origin);
    const players = [...new Set(body.players
      .filter(name => typeof name === "string")
      .map(name => name.trim().slice(0, 80))
      .filter(Boolean))].slice(0, MAX_PLAYERS);
    const text = (v, n) => typeof v === "string" ? v.trim().slice(0, n) : "";
    const g = body.game && typeof body.game === "object" ? body.game : null;
    const game = g ? { datum: text(g.datum, 10), zeit: text(g.zeit, 5), heimAuswaerts: text(g.heimAuswaerts, 12), gegner: text(g.gegner, 60), ort: text(g.ort, 200) } : null;
    // Gesamter Spielplan inkl. Ergebnisse der gespielten Spiele
    const zahl = v => Number.isFinite(Number(v)) ? Math.max(0, Math.min(99, Math.trunc(Number(v)))) : 0;
    const schedule = Array.isArray(body.schedule) ? body.schedule.slice(0, 60).map(x => {
      if (!x || typeof x !== "object") return null;
      const e = x.ergebnis && typeof x.ergebnis === "object" ? { wir: zahl(x.ergebnis.wir), gegner: zahl(x.ergebnis.gegner) } : null;
      const tore = Array.isArray(x.tore) ? x.tore.slice(0, 30).map(t => t && typeof t === "object"
        ? { spieler: text(t.spieler, 60), minute: Number.isFinite(Number(t.minute)) && t.minute !== null ? zahl(t.minute) : null, vorlage: text(t.vorlage, 60) } : null).filter(Boolean) : [];
      // Aufgaben enthalten nur Aufgabe und Zuständigkeit; Erledigt-Status/Datum gibt es nicht mehr.
      const aufgaben = Array.isArray(x.aufgaben) ? x.aufgaben.slice(0, 20).map(a => a && typeof a === "object"
        ? { aufgabe: text(a.aufgabe, 60), wer: text(a.wer, 300), personen: Array.isArray(a.personen) ? a.personen.slice(0, 10).map(n => text(n, 80)).filter(Boolean) : [] } : null).filter(Boolean) : [];
      return { datum: text(x.datum, 10), zeit: text(x.zeit, 5), heimAuswaerts: text(x.heimAuswaerts, 12), gegner: text(x.gegner, 60), ort: text(x.ort, 200), gespielt: x.gespielt === true && !!e, ergebnis: e, tore, aufgaben };
    }).filter(Boolean) : [];
    // Ligatabelle
    const tb = body.table && typeof body.table === "object" ? body.table : null;
    const table = {
      stand: tb ? text(tb.stand, 20) : "",
      teams: tb && Array.isArray(tb.teams) ? tb.teams.slice(0, 20).map(z => z && typeof z === "object" ? {
        platz: zahl(z.platz), mannschaft: text(z.mannschaft, 60), spiele: zahl(z.spiele), siege: zahl(z.siege), unentschieden: zahl(z.unentschieden),
        niederlagen: zahl(z.niederlagen), toreFuer: zahl(z.toreFuer), toreGegen: zahl(z.toreGegen),
        differenz: Number.isFinite(Number(z.differenz)) ? Math.max(-999, Math.min(999, Math.trunc(Number(z.differenz)))) : 0,
        punkte: zahl(z.punkte), eigene: z.eigene === true
      } : null).filter(Boolean) : []
    };
    // Gut lesbare Themen-Texte zusätzlich zu den strukturierten Originaldaten.
    // Typebot kann diese einzelnen Textfelder leicht als Variablen übernehmen,
    // während players/game/schedule/table für gezielte Abfragen erhalten bleiben.
    const datumZeit = x => [x.datum, x.zeit].filter(Boolean).join(" um ");
    const spielZeile = x => {
      const richtung = x.heimAuswaerts ? ` (${x.heimAuswaerts})` : "";
      const ort = x.ort ? `, Ort: ${x.ort}` : "";
      const ergebnis = x.ergebnis ? `, Ergebnis: ${x.ergebnis.wir}:${x.ergebnis.gegner}` : "";
      return `- ${datumZeit(x)}${richtung} gegen ${x.gegner || "unbekannten Gegner"}${ort}${ergebnis}`;
    };
    const spielerText = players.length ? players.join(", ") : "Keine Spieler eingetragen.";
    const aktuellesSpielText = game
      ? `${datumZeit(game)}; ${game.heimAuswaerts || "Spielort offen"} gegen ${game.gegner || "unbekannten Gegner"}${game.ort ? `; Ort: ${game.ort}` : ""}`
      : "Kein aktuelles Spiel ausgewählt.";
    const spielplanText = schedule.length
      ? schedule.map(spielZeile).join("\n")
      : "Kein Spielplan vorhanden.";
    const ergebnisse = schedule.filter(x => x.gespielt && x.ergebnis);
    const ergebnisseText = ergebnisse.length ? ergebnisse.map(x => {
      const toreText = (x.tore || []).length
        ? `; Torschützen: ${x.tore.map(t => `${t.spieler}${t.minute !== null ? ` (${t.minute}.)` : ""}${t.vorlage ? ` nach Vorlage von ${t.vorlage}` : ""}`).join(", `)}`
        : "; keine Torschützen erfasst";
      return `- ${datumZeit(x)} gegen ${x.gegner}: ${x.ergebnis.wir}:${x.ergebnis.gegner}${toreText}`;
    }).join("\n") : "Noch keine gespeicherten Spielergebnisse vorhanden.";
    const aufgaben = schedule.flatMap(x => (x.aufgaben || []).map(a => ({ spiel: x, aufgabe: a })));
    const aufgabenText = aufgaben.length ? aufgaben.map(({ spiel, aufgabe }) =>
      `- ${aufgabe.aufgabe}: ${aufgabe.wer || (aufgabe.personen || []).join(", ") || "niemand zugeteilt"} (nächstes Spiel: ${datumZeit(spiel)} gegen ${spiel.gegner || "unbekannt"})`
    ).join("\n") : "Keine Aufgaben für das nächste Spiel eingetragen.";
    const tabellenText = table.teams.length
      ? `Tabellenstand: ${table.stand || "unbekannt"}\n` + table.teams.map(t =>
          `- Platz ${t.platz}: ${t.mannschaft}; ${t.spiele} Spiele, ${t.punkte} Punkte, Tore ${t.toreFuer}:${t.toreGegen}`
        ).join("\n")
      : "Keine Ligatabelle vorhanden.";
    const teamText = [
      `Spieler: ${spielerText}`,
      `Freigabe: ${body.released === true ? "Ja" : "Nein"}`,
      `Aktuelles Spiel: ${aktuellesSpielText}`,
      `Spielplan:\n${spielplanText}`,
      `Ergebnisse:\n${ergebnisseText}`,
      `Aufgaben:\n${aufgabenText}`,
      `Tabelle:\n${tabellenText}`
    ].join("\n\n");

    // released = true, wenn der Trainer die Aufstellung für die Eltern freigegeben hat.
    // Die Originaldaten bleiben strukturiert; die *Text-Felder* sind Zusatzfelder für Typebot.
    const lineup = {
      players, released: body.released === true, game, schedule, table,
      spielerText, aktuellesSpielText, spielplanText, ergebnisseText, aufgabenText, tabellenText, teamText,
      updatedAt: new Date().toISOString()
    };
    await env.LINEUP_KV.put("current-lineup", JSON.stringify(lineup));
    return json({ ok: true, count: players.length, games: schedule.length, released: lineup.released, updatedAt: lineup.updatedAt }, 200, origin);
  }
};
