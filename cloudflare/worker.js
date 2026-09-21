const COOKIE_NAME = 'rd_anon_id';
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_NOTES_LENGTH = 400;
const MAX_HERO_NAME_LENGTH = 80;
const MAX_HEROES = 5;
const MAX_REPORT_MATCHES = 20;
const DEFAULT_REPORTS_PATH = 'data/moderation-reports.json';
const GITHUB_API_BASE = 'https://api.github.com';
const RATE_LIMITS = {
  compositions: { maxRequests: 10, windowSeconds: 3600 },
  moderationReports: { maxRequests: 20, windowSeconds: 3600 }
};
const FORBIDDEN_WORDS = [
  'nazi', 'nazista', 'nazismo', 'judio', 'judia', 'comunista', 'comunismo', 'facista', 'fascista', 'fascismo',
  'racista', 'racismo', 'xenofobo', 'xenofobia', 'terrorista', 'terrorismo', 'puto', 'puta', 'maricon', 'marica',
  'culo', 'gilipollas', 'gilipolla', 'imbecil', 'idiota', 'tonto', 'basura', 'bastardo', 'zorra', 'cabron', 'pedazo',
  'mierda', 'cagada', 'retard', 'retrasado', 'mongolo', 'pendejo', 'pendeja', 'estupido', 'estupida', 'inutil',
  'sucia', 'sucio', 'maldito', 'maldita', 'cornudo', 'vagina', 'porno', 'pornografia', 'sexo', 'gore', 'violencia',
  'insulto', 'hack', 'hacker', 'trampa', 'fraude', 'spammer', 'spam', 'fake', 'idiot', 'dumb', 'moron', 'bruto',
  'caca', 'paja', 'fornicar', 'prostituta', 'travesti', 'odio', 'hatred', 'genocidio', 'esclavo', 'chingar',
  'chingada', 'chingado', 'chingon', 'pinche', 'verga', 'vergazo', 'pelotudo', 'pelotuda', 'culiao', 'culiado',
  'cojudo', 'cojones', 'culero', 'carajo', 'joder', 'hostia', 'cono', 'mamon', 'malparido', 'hijueputa', 'hijoputa',
  'gonorrea', 'pirobo', 'careverga', 'carepicha', 'conchetumare', 'conchetumadre', 'chucha', 'mariconazo',
  'huevon', 'weon', 'aweonao', 'pajero', 'boludo', 'boluda', 'tarado', 'tarada', 'salame', 'nabo', 'forro',
  'gil', 'choto', 'cretino', 'cretina', 'tarupido', 'payaso', 'payasa', 'pringado', 'subnormal', 'baboso',
  'sapo', 'zangano', 'patan', 'capullo', 'capulla', 'pendejos', 'pendejas'
];

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = env.ALLOWED_ORIGIN || origin || '*';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'DELETE, GET, POST, OPTIONS',
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

function normalizeFilterText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/4/g, 'a')
    .replace(/3/g, 'e')
    .replace(/[1!|]/g, 'i')
    .replace(/0/g, 'o')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/8/g, 'b')
    .replace(/9/g, 'g')
    .replace(/[^a-z]/g, '');
}

function containsForbiddenWords(values) {
  const text = values.join(' ');
  const normalizedText = normalizeFilterText(text);
  return FORBIDDEN_WORDS.some((word) => {
    const normalizedWord = normalizeFilterText(word);
    return new RegExp(`(^|[^a-z])${normalizedWord}([^a-z]|$)`).test(
      text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    ) || normalizedText.includes(normalizedWord);
  });
}

function hasValidSecretToken(request, env, secretName) {
  const providedToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  const expectedToken = env[secretName] || '';
  if (!providedToken || !expectedToken || providedToken.length !== expectedToken.length) return false;

  let difference = 0;
  for (let index = 0; index < expectedToken.length; index += 1) {
    difference |= providedToken.charCodeAt(index) ^ expectedToken.charCodeAt(index);
  }
  return difference === 0;
}

function requireAdmin(request, env) {
  return hasValidSecretToken(request, env, 'MODERATION_ADMIN_TOKEN');
}

async function listModerationQueue(request, env) {
  if (!requireAdmin(request, env)) return jsonResponse({ error: 'No autorizado.' }, 401, request, env);

  const compositions = (await env.DB.prepare(
    `SELECT id, payload, status, moderation_note, moderated_at, created_at, updated_at
     FROM compositions
     ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END, created_at DESC
     LIMIT 200`
  ).all()).results.map((row) => ({
    id: row.id,
    ...JSON.parse(row.payload),
    status: row.status,
    moderationNote: row.moderation_note,
    moderatedAt: row.moderated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));
  const reports = (await env.DB.prepare(
    `SELECT id, payload, created_at FROM moderation_reports ORDER BY created_at DESC LIMIT 200`
  ).all()).results.map((row) => ({
    id: row.id,
    ...JSON.parse(row.payload),
    createdAt: row.created_at
  }));

  return jsonResponse({ compositions, reports }, 200, request, env);
}

async function moderateComposition(request, env, compositionId, action) {
  if (!requireAdmin(request, env)) return jsonResponse({ error: 'No autorizado.' }, 401, request, env);
  if (!['approve', 'reject'].includes(action)) return jsonResponse({ error: 'Acción no válida.' }, 400, request, env);

  let input;
  try {
    input = await request.json();
  } catch {
    return jsonResponse({ error: 'El cuerpo de la solicitud no es válido.' }, 400, request, env);
  }
  const note = typeof input?.note === 'string' ? input.note.trim() : '';
  if (action === 'reject' && !note) return jsonResponse({ error: 'El rechazo requiere un motivo.' }, 400, request, env);

  const now = Math.floor(Date.now() / 1000);
  const status = action === 'approve' ? 'approved' : 'rejected';
  const result = await env.DB.prepare(
    `UPDATE compositions SET status = ?, moderation_note = ?, moderated_at = ?, updated_at = ?
     WHERE id = ?`
  ).bind(status, note || null, now, now, compositionId).run();
  if (result.meta?.changes !== 1) return jsonResponse({ error: 'Composición no encontrada.' }, 404, request, env);

  await env.DB.prepare(
    `INSERT INTO moderation_actions (id, composition_id, action, note, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), compositionId, action, note || null, now).run();

  return jsonResponse({ id: compositionId, status }, 200, request, env);
}

async function deleteModeratedComposition(request, env, compositionId) {
  if (!requireAdmin(request, env)) return jsonResponse({ error: 'No autorizado.' }, 401, request, env);
  const result = await env.DB.prepare('DELETE FROM compositions WHERE id = ?').bind(compositionId).run();
  if (result.meta?.changes !== 1) return jsonResponse({ error: 'Composición no encontrada.' }, 404, request, env);
  await env.DB.prepare(
    `INSERT INTO moderation_actions (id, composition_id, action, note, created_at)
    VALUES (?, ?, 'delete', NULL, ?)`
  ).bind(crypto.randomUUID(), compositionId, Math.floor(Date.now() / 1000)).run();
  return jsonResponse({ id: compositionId, deleted: true }, 200, request, env);
}

function normalizeComposition(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('El formato de la composición no es válido.');
  }
  if (!Array.isArray(input.heroes) || input.heroes.length !== MAX_HEROES
    || input.heroes.some((hero) => typeof hero !== 'string')) {
    throw new Error('La composición debe tener cinco héroes válidos.');
  }

  const heroes = input.heroes.map((hero) => hero.trim());
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';

  if (heroes.some((hero) => !hero || hero.length > MAX_HERO_NAME_LENGTH)
    || new Set(heroes).size !== MAX_HEROES) {
    throw new Error('La composición debe tener cinco héroes diferentes.');
  }
  if (!description || description.length > MAX_DESCRIPTION_LENGTH) {
    throw new Error('La descripción no es válida.');
  }
  if (!notes || notes.length > MAX_NOTES_LENGTH) {
    throw new Error('La nota no es válida.');
  }
  if (containsForbiddenWords([description, notes])) {
    throw new Error('La composición contiene palabras prohibidas y no fue enviada.');
  }

  return { heroes, description, notes };
}

function normalizeModerationReport(input) {
  const field = input?.field === 'description' || input?.field === 'notes'
    ? input.field
    : '';
  const value = String(input?.value || '').trim();
  const matches = Array.isArray(input?.matches)
    ? input.matches.map((match) => String(match || '').trim()).filter(Boolean).slice(0, MAX_REPORT_MATCHES)
    : [];
  const heroes = Array.isArray(input?.heroes)
    ? input.heroes.map((hero) => String(hero || '').trim()).filter(Boolean).slice(0, MAX_HEROES)
    : [];

  if (!field || !value || value.length > MAX_NOTES_LENGTH || !matches.length) {
    throw new Error('El reporte de moderación no es válido.');
  }

  return { field, value, matches, heroes };
}

async function consumeRateLimit(env, ownerHash, action, now = Math.floor(Date.now() / 1000)) {
  const limit = RATE_LIMITS[action];
  if (!limit) throw new Error(`Límite desconocido: ${action}`);

  const windowStart = Math.floor(now / limit.windowSeconds) * limit.windowSeconds;
  const result = await env.DB.prepare(
    `INSERT INTO rate_limits (owner_hash, action, window_start, request_count, updated_at)
     VALUES (?, ?, ?, 1, ?)
     ON CONFLICT(owner_hash, action) DO UPDATE SET
       window_start = excluded.window_start,
       request_count = CASE
         WHEN rate_limits.window_start = excluded.window_start
           THEN rate_limits.request_count + 1
         ELSE 1
       END,
       updated_at = excluded.updated_at
     WHERE rate_limits.window_start != excluded.window_start
        OR rate_limits.request_count < ?`
  ).bind(ownerHash, action, windowStart, now, limit.maxRequests).run();

  if (result.meta?.changes === 0) {
    const retryAfter = windowStart + limit.windowSeconds - now;
    return { allowed: false, retryAfter };
  }

  return { allowed: true, retryAfter: 0 };
}

function githubConfig(env) {
  return {
    token: env.GITHUB_TOKEN || '',
    owner: env.GITHUB_OWNER || 'Red-Dragons-HoK',
    repository: env.GITHUB_REPOSITORY || 'RedDragonsWeb',
    path: env.GITHUB_REPORTS_PATH || DEFAULT_REPORTS_PATH,
    branch: env.GITHUB_BRANCH || 'main'
  };
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function decodeBase64(value) {
  const binary = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function githubRequest(config, endpoint, options = {}) {
  return fetch(`${GITHUB_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'RedDragonsWeb-moderation-export',
      ...(options.headers || {})
    }
  });
}

async function exportModerationReports(request, env) {
  if (!hasValidSecretToken(request, env, 'REPORT_EXPORT_TOKEN')) {
    return jsonResponse({ error: 'No autorizado.' }, 401, request, env);
  }

  const config = githubConfig(env);
  if (!config.token) {
    return jsonResponse({ error: 'La exportación no está configurada.' }, 503, request, env);
  }

  const rows = (await env.DB.prepare(
    `SELECT id, payload, created_at FROM moderation_reports ORDER BY created_at ASC`
  ).all()).results;
  if (!rows.length) return jsonResponse({ exported: 0, message: 'No hay reportes pendientes.' }, 200, request, env);

  const reportEntries = rows.map((row) => ({
    id: row.id,
    ...JSON.parse(row.payload),
    createdAt: row.created_at
  }));
  const encodedPath = config.path.split('/').map(encodeURIComponent).join('/');
  const endpoint = `/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repository)}/contents/${encodedPath}`;
  const currentResponse = await githubRequest(config, `${endpoint}?ref=${encodeURIComponent(config.branch)}`);
  let existingReports = [];
  let fileSha;

  if (currentResponse.ok) {
    const currentFile = await currentResponse.json();
    fileSha = currentFile.sha;
    try {
      existingReports = JSON.parse(decodeBase64(currentFile.content));
      if (!Array.isArray(existingReports)) throw new Error('El archivo existente no contiene una lista JSON.');
    } catch (error) {
      return jsonResponse({ error: `El JSON de reportes existente no es válido: ${error.message}` }, 502, request, env);
    }
  } else if (currentResponse.status !== 404) {
    return jsonResponse({ error: 'No se pudo leer el JSON de reportes en GitHub.' }, 502, request, env);
  }

  const content = `${JSON.stringify([...existingReports, ...reportEntries], null, 2)}\n`;
  const commitResponse = await githubRequest(config, endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: `Exported ${reportEntries.length} moderation report${reportEntries.length === 1 ? '' : 's'}`,
      content: encodeBase64(content),
      branch: config.branch,
      ...(fileSha ? { sha: fileSha } : {})
    })
  });

  if (!commitResponse.ok) {
    return jsonResponse({ error: 'GitHub no confirmó la actualización del JSON.' }, 502, request, env);
  }

  const placeholders = rows.map(() => '?').join(', ');
  await env.DB.prepare(
    `DELETE FROM moderation_reports WHERE id IN (${placeholders})`
  ).bind(...rows.map((row) => row.id)).run();

  const commit = await commitResponse.json();
  return jsonResponse({
    exported: reportEntries.length,
    deleted: reportEntries.length,
    commitSha: commit.commit?.sha || null,
    path: config.path
  }, 200, request, env);
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
  if (url.pathname === '/moderation-reports/export' && request.method === 'POST') {
    return exportModerationReports(request, env);
  }
  const moderationQueueMatch = url.pathname.match(/^\/admin\/compositions$/);
  if (moderationQueueMatch && request.method === 'GET') return listModerationQueue(request, env);
  const moderationActionMatch = url.pathname.match(/^\/admin\/compositions\/([^/]+)\/(approve|reject)$/);
  if (moderationActionMatch && request.method === 'POST') {
    return moderateComposition(request, env, moderationActionMatch[1], moderationActionMatch[2]);
  }
  const moderationDeleteMatch = url.pathname.match(/^\/admin\/compositions\/([^/]+)$/);
  if (moderationDeleteMatch && request.method === 'DELETE') {
    return deleteModeratedComposition(request, env, moderationDeleteMatch[1]);
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

    const rateLimit = await consumeRateLimit(env, ownerHash, 'compositions');
    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: 'Se alcanzó el límite de composiciones. Intentá nuevamente más tarde.' },
        429,
        request,
        env,
        { ...responseHeaders, 'Retry-After': String(rateLimit.retryAfter) }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO compositions (id, owner_hash, payload, status, created_at, updated_at)
       VALUES (?, ?, ?, 'pending', ?, ?)`
    ).bind(id, ownerHash, JSON.stringify(payload), now, now).run();

    return jsonResponse({ id, status: 'pending', mine: true }, 201, request, env, responseHeaders);
  }

  if (url.pathname === '/moderation-reports' && request.method === 'POST') {
    let payload;
    try {
      payload = normalizeModerationReport(await request.json());
    } catch (error) {
      return jsonResponse({ error: error.message }, 400, request, env, responseHeaders);
    }

    const rateLimit = await consumeRateLimit(env, ownerHash, 'moderationReports');
    if (!rateLimit.allowed) {
      return jsonResponse(
        { error: 'Se alcanzó el límite de reportes. Intentá nuevamente más tarde.' },
        429,
        request,
        env,
        { ...responseHeaders, 'Retry-After': String(rateLimit.retryAfter) }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO moderation_reports (id, owner_hash, payload, created_at)
       VALUES (?, ?, ?, ?)`
    ).bind(id, ownerHash, JSON.stringify(payload), now).run();

    return jsonResponse({ id, reported: true }, 201, request, env, responseHeaders);
  }

  return jsonResponse({ error: 'Ruta no encontrada.' }, 404, request, env, responseHeaders);
}

export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      console.error('Unhandled Worker error', error);
      return jsonResponse({ error: 'Error interno.' }, 500, request, env);
    }
  }
};
