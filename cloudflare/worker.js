const COOKIE_NAME = 'rd_anon_id';
const MAX_DESCRIPTION_LENGTH = 1000;
const MAX_NOTES_LENGTH = 1000;
const MAX_HEROES = 5;

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = env.ALLOWED_ORIGIN || origin || '*';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin'
  };
}

function jsonResponse(data, status, request, env, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(request, env),
      ...extraHeaders
    }
  });
}

function readCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

function createAnonymousId() {
  return crypto.randomUUID();
}

async function hashOwner(ownerId) {
  const bytes = new TextEncoder().encode(ownerId);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function ownerCookie(ownerId) {
  return `${COOKIE_NAME}=${encodeURIComponent(ownerId)}; Max-Age=31536000; Path=/; Secure; HttpOnly; SameSite=Lax`;
}

function normalizeComposition(input) {
  const heroes = Array.isArray(input?.heroes)
    ? input.heroes.map((hero) => String(hero || '').trim()).filter(Boolean).slice(0, MAX_HEROES)
    : [];
  const description = String(input?.description || '').trim();
  const notes = String(input?.notes || '').trim();

  if (heroes.length !== MAX_HEROES || new Set(heroes).size !== MAX_HEROES) {
    throw new Error('La composición debe tener cinco héroes diferentes.');
  }
  if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error('La descripción no es válida.');
  }
  if (!notes || notes.length > MAX_NOTES_LENGTH) {
    throw new Error('La nota no es válida.');
  }

  return { heroes, description, notes };
}

async function listPublicCompositions(request, env, ownerHash) {
  const result = await env.DB.prepare(
    `SELECT id, payload, status, created_at, updated_at
     FROM compositions
     WHERE status = 'approved'
     ORDER BY created_at DESC
     LIMIT 100`
  ).all();
  const mine = new Set(
    (await env.DB.prepare(
      `SELECT id FROM compositions WHERE owner_hash = ? ORDER BY updated_at DESC`
    ).bind(ownerHash).all()).results.map((row) => row.id)
  );

  return result.results.map((row) => ({
    id: row.id,
    ...JSON.parse(row.payload),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    mine: mine.has(row.id)
  }));
}

async function handleRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  const url = new URL(request.url);
  if (url.pathname === '/health' && request.method === 'GET') {
    return jsonResponse({ ok: true }, 200, request, env);
  }

  let ownerId = readCookie(request, COOKIE_NAME);
  let shouldSetCookie = false;
  if (!ownerId) {
    ownerId = createAnonymousId();
    shouldSetCookie = true;
  }
  const ownerHash = await hashOwner(ownerId);
  const responseHeaders = shouldSetCookie ? { 'Set-Cookie': ownerCookie(ownerId) } : {};

  if (url.pathname === '/compositions' && request.method === 'GET') {
    const compositions = await listPublicCompositions(request, env, ownerHash);
    return jsonResponse({ compositions }, 200, request, env, responseHeaders);
  }

  if (url.pathname === '/compositions' && request.method === 'POST') {
    let payload;
    try {
      payload = normalizeComposition(await request.json());
    } catch (error) {
      return jsonResponse({ error: error.message }, 400, request, env, responseHeaders);
    }

    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO compositions (id, owner_hash, payload, status, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`
    ).bind(id, ownerHash, JSON.stringify(payload), now, now).run();

    return jsonResponse({ id, status: 'pending', mine: true }, 201, request, env, responseHeaders);
  }

  return jsonResponse({ error: 'Ruta no encontrada.' }, 404, request, env, responseHeaders);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      return jsonResponse({ error: 'Error interno.' }, 500, request, env);
    }
  }
};
