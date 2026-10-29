// Cloudflare Worker for EbeApp Team-A lineup.
// Variant A: no client-side secret. Origin allowlist + basic per-IP rate limit.
// Important: Origin checks are not authentication; non-browser clients can spoof Origin.
const ALLOWED_ORIGIN = "https://ronva83.github.io";
const RATE_LIMIT_PER_HOUR = 60;      // die App sendet nur noch bei geänderter Spielerliste
const MAX_PLAYERS = 50;
const MAX_BODY_BYTES = 8 * 1024;     // eine Spielerliste ist winzig; alles Größere wird abgelehnt

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
      // Optionaler Lese-Schlüssel: Ist in Cloudflare die Variable READ_KEY gesetzt, darf nur lesen, wer ihn kennt
      // (z. B. Typebot mit ?key=… in der Abfrage). Ohne READ_KEY bleibt die Liste öffentlich lesbar.
      if (env.READ_KEY) {
        const key = url.searchParams.get("key") || request.headers.get("X-Read-Key") || "";
        if (key !== env.READ_KEY) return json({ error: "Unauthorized" }, 401, origin);
      }
      const saved = await env.LINEUP_KV.get("current-lineup");
      return json(saved ? JSON.parse(saved) : { players: [] }, 200, origin);
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

    if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413, origin);
    let body;
    try {
      const text = await request.text();
      if (text.length > MAX_BODY_BYTES) return json({ error: "Payload too large" }, 413, origin);
      body = JSON.parse(text);
    } catch { return json({ error: "Invalid JSON" }, 400, origin); }
    if (!Array.isArray(body.players)) return json({ error: "players must be an array" }, 400, origin);
    const players = [...new Set(body.players
      .filter(name => typeof name === "string")
      .map(name => name.trim().slice(0, 80))
      .filter(Boolean))].slice(0, MAX_PLAYERS);
    const lineup = { players, updatedAt: new Date().toISOString() };
    await env.LINEUP_KV.put("current-lineup", JSON.stringify(lineup));
    return json({ ok: true, count: players.length, updatedAt: lineup.updatedAt }, 200, origin);
  }
};
