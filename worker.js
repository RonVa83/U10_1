// Cloudflare Worker – EbeApp / Team A / Typebot
// Variante A: Origin-Allowlist + einfaches Rate-Limit. Kein echter Login-Schutz.
// KV-Binding erforderlich: LINEUP_KV -> Namespace EBECO_LINEUP

const ALLOWED_ORIGIN = "https://ronva83.github.io";
const RATE_LIMIT_PER_HOUR = 20;
const MAX_PLAYERS = 50;
const MAX_GAMES = 60;

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
    headers: {
      ...corsHeaders(origin),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

const text = (value, max = 500) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

const number = (value, min = 0, max = 999) => {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : 0;
};

const dateTime = (item) =>
  [item.datum, item.zeit].filter(Boolean).join(" um ") || "Termin unbekannt";

function normalizePlayers(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .filter((name) => typeof name === "string")
    .map((name) => text(name, 80))
    .filter(Boolean))].slice(0, MAX_PLAYERS);
}

function normalizeGame(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    datum: text(value.datum, 10),
    zeit: text(value.zeit, 5),
    heimAuswaerts: text(value.heimAuswaerts, 12),
    gegner: text(value.gegner, 100),
    ort: text(value.ort, 250),
  };
}

function normalizeSchedule(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_GAMES).filter((item) => item && typeof item === "object" && !Array.isArray(item)).map((item) => {
    const rawResult = item.ergebnis && typeof item.ergebnis === "object" && !Array.isArray(item.ergebnis)
      ? item.ergebnis : null;
    const ergebnis = rawResult
      ? { wir: number(rawResult.wir, 0, 99), gegner: number(rawResult.gegner, 0, 99) }
      : null;

    const tore = Array.isArray(item.tore) ? item.tore.slice(0, 30).filter((goal) => goal && typeof goal === "object").map((goal) => ({
      spieler: text(goal.spieler, 80),
      minute: goal.minute === null || goal.minute === undefined || goal.minute === "" ? null : number(goal.minute, 0, 150),
      vorlage: text(goal.vorlage, 80),
    })) : [];

    const aufgaben = Array.isArray(item.aufgaben) ? item.aufgaben.slice(0, 20).filter((task) => task && typeof task === "object").map((task) => ({
      aufgabe: text(task.aufgabe, 100),
      wer: text(task.wer, 300),
      personen: Array.isArray(task.personen) ? task.personen.slice(0, 10).map((name) => text(name, 80)).filter(Boolean) : [],
      erledigt: task.erledigt === true,
      datum: text(task.datum, 10),
    })) : [];

    return {
      datum: text(item.datum, 10),
      zeit: text(item.zeit, 5),
      heimAuswaerts: text(item.heimAuswaerts, 12),
      gegner: text(item.gegner, 100),
      ort: text(item.ort, 250),
      gespielt: item.gespielt === true && !!ergebnis,
      ergebnis,
      tore,
      aufgaben,
    };
  });
}

function normalizeTable(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const teams = Array.isArray(source.teams) ? source.teams.slice(0, 20).filter((team) => team && typeof team === "object").map((team) => ({
    platz: number(team.platz, 0, 99),
    mannschaft: text(team.mannschaft, 100),
    spiele: number(team.spiele, 0, 99),
    siege: number(team.siege, 0, 99),
    unentschieden: number(team.unentschieden, 0, 99),
    niederlagen: number(team.niederlagen, 0, 99),
    toreFuer: number(team.toreFuer, 0, 999),
    toreGegen: number(team.toreGegen, 0, 999),
    differenz: number(team.differenz, -999, 999),
    punkte: number(team.punkte, 0, 999),
    eigene: team.eigene === true,
  })) : [];
  return { stand: text(source.stand, 30), teams };
}

function makeReadableFields(data) {
  const { players, released, game, schedule, table } = data;
  const spielerText = players.length ? players.join(", ") : "Keine Spieler eingetragen.";
  const freigabeText = released ? "Die Aufstellung ist freigegeben." : "Die Aufstellung ist noch nicht freigegeben.";

  const aktuellesSpielText = game
    ? `${dateTime(game)}; ${game.heimAuswaerts || "Heim/Auswärts offen"} gegen ${game.gegner || "Gegner unbekannt"}${game.ort ? `; Ort: ${game.ort}` : ""}`
    : "Für die aktuelle Planung ist kein bestimmtes Spiel ausgewählt.";

  const spielplanText = schedule.length
    ? schedule.map((gameItem) => {
        const venue = gameItem.heimAuswaerts ? ` (${gameItem.heimAuswaerts})` : "";
        const place = gameItem.ort ? `; Ort: ${gameItem.ort}` : "";
        const result = gameItem.ergebnis ? `; Ergebnis aus Ebersberger Sicht: ${gameItem.ergebnis.wir}:${gameItem.ergebnis.gegner}` : "";
        const status = gameItem.gespielt ? "; gespielt" : "; noch offen";
        return `- ${dateTime(gameItem)}${venue} gegen ${gameItem.gegner || "Gegner unbekannt"}${place}${result}${status}`;
      }).join("\n")
    : "Kein Spielplan vorhanden.";

  const playedGames = schedule.filter((item) => item.gespielt && item.ergebnis);
  const ergebnisseText = playedGames.length
    ? playedGames.map((item) => `- ${dateTime(item)} gegen ${item.gegner || "Gegner unbekannt"}: ${item.ergebnis.wir}:${item.ergebnis.gegner} (aus Ebersberger Sicht)`).join("\n")
    : "Noch keine gespeicherten Spielergebnisse vorhanden.";

  const goalLines = playedGames.flatMap((item) => (item.tore || []).map((goal) =>
    `- ${dateTime(item)} gegen ${item.gegner || "Gegner unbekannt"}: ${goal.spieler || "Unbekannter Spieler"}${goal.minute !== null ? ` (${goal.minute}. Minute)` : ""}${goal.vorlage ? `; Vorlage: ${goal.vorlage}` : ""}`
  ));
  const torschuetzenText = goalLines.length ? goalLines.join("\n") : "Keine Torschützen gespeichert.";

  const taskLines = schedule.flatMap((gameItem) => (gameItem.aufgaben || []).map((task) => {
    const assigned = task.wer || (task.personen || []).join(", ") || "Niemand eingetragen";
    return `- ${task.aufgabe || "Aufgabe"}: ${assigned}; ${task.erledigt ? "erledigt" : "offen"}; Spiel: ${dateTime(gameItem)} gegen ${gameItem.gegner || "Gegner unbekannt"}${task.datum ? `; erledigt am: ${task.datum}` : ""}`;
  }));
  const aufgabenText = taskLines.length ? taskLines.join("\n") : "Keine Zusatzaufgaben eingetragen.";

  const tabellenText = table.teams.length
    ? `Tabellenstand: ${table.stand || "Datum unbekannt"}\n` + table.teams.map((team) =>
        `- Platz ${team.platz}: ${team.mannschaft}; ${team.spiele} Spiele; ${team.punkte} Punkte; Tore ${team.toreFuer}:${team.toreGegen}${team.eigene ? " (eigene Mannschaft)" : ""}`
      ).join("\n")
    : "Keine Ligatabelle vorhanden.";

  const teamText = [
    "SPIELER\n" + spielerText,
    "FREIGABE\n" + freigabeText,
    "AKTUELLES SPIEL\n" + aktuellesSpielText,
    "SPIELPLAN\n" + spielplanText,
    "ERGEBNISSE\n" + ergebnisseText,
    "TORSCHÜTZEN\n" + torschuetzenText,
    "AUFGABEN\n" + aufgabenText,
    "TABELLE\n" + tabellenText,
  ].join("\n\n");

  return { spielerText, freigabeText, aktuellesSpielText, spielplanText, ergebnisseText, torschuetzenText, aufgabenText, tabellenText, teamText };
}

const EMPTY_DATA = {
  schemaVersion: 2,
  players: [], released: false, game: null, schedule: [],
  table: { stand: "", teams: [] },
  spielerText: "Keine Spieler eingetragen.",
  freigabeText: "Die Aufstellung ist noch nicht freigegeben.",
  aktuellesSpielText: "Für die aktuelle Planung ist kein bestimmtes Spiel ausgewählt.",
  spielplanText: "Kein Spielplan vorhanden.",
  ergebnisseText: "Noch keine gespeicherten Spielergebnisse vorhanden.",
  torschuetzenText: "Keine Torschützen gespeichert.",
  aufgabenText: "Keine Zusatzaufgaben eingetragen.",
  tabellenText: "Keine Ligatabelle vorhanden.",
  teamText: "Noch keine Teamdaten übertragen.",
  updatedAt: null,
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      if (origin !== ALLOWED_ORIGIN) return new Response(null, { status: 403, headers: corsHeaders(origin) });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (url.pathname === "/" && request.method === "GET") {
      return json({ service: "EbeApp Team API", status: "ok", schemaVersion: 2, endpoint: "/lineup" }, 200, origin);
    }

    if (url.pathname !== "/lineup") return json({ error: "Not found" }, 404, origin);

    if (request.method === "GET") {
      if (!env.LINEUP_KV) return json({ error: "KV binding LINEUP_KV fehlt" }, 500, origin);
      const saved = await env.LINEUP_KV.get("current-lineup");
      if (!saved) return json(EMPTY_DATA, 200, origin);
      try {
        const parsed = JSON.parse(saved);
        return json({ ...EMPTY_DATA, ...parsed }, 200, origin);
      } catch (_) {
        return json({ error: "Gespeicherte Teamdaten sind beschädigt. Bitte einmal erneut aus der EbeApp senden." }, 500, origin);
      }
    }

    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
    if (origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed" }, 403, origin);
    if (!env.LINEUP_KV) return json({ error: "KV binding LINEUP_KV fehlt" }, 500, origin);

    // Best-effort rate limit: Cloudflare KV ist eventual consistent, daher kein harter Sicherheitsschutz.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const hour = new Date().toISOString().slice(0, 13);
    const rateKey = `rate:${hour}:${ip}`;
    const used = Number(await env.LINEUP_KV.get(rateKey) || 0);
    if (used >= RATE_LIMIT_PER_HOUR) return json({ error: "Rate limit exceeded" }, 429, origin);

    let body;
    try { body = await request.json(); }
    catch (_) { return json({ error: "Invalid JSON" }, 400, origin); }
    if (!body || typeof body !== "object" || Array.isArray(body) || !Array.isArray(body.players)) {
      return json({ error: "players muss als Array übertragen werden" }, 400, origin);
    }

    const players = normalizePlayers(body.players);
    const released = body.released === true;
    const game = normalizeGame(body.game);
    const schedule = normalizeSchedule(body.schedule);
    const table = normalizeTable(body.table);
    const updatedAt = new Date().toISOString();
    const base = { schemaVersion: 2, players, released, game, schedule, table, updatedAt };
    const readable = makeReadableFields(base);
    const lineup = { ...base, ...readable };

    await env.LINEUP_KV.put(rateKey, String(used + 1), { expirationTtl: 3600 });
    await env.LINEUP_KV.put("current-lineup", JSON.stringify(lineup));

    return json({
      ok: true,
      schemaVersion: 2,
      count: players.length,
      games: schedule.length,
      tableTeams: table.teams.length,
      released,
      updatedAt,
    }, 200, origin);
  },
};
