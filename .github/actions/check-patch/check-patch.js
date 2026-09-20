// Corre en GitHub Actions (Node 24+, usa módulos nativos, sin dependencias).
// Busca anuncios nuevos de Honor of Kings (sin filtrar por título), guarda
// su HTML crudo en data/anuncios-raw.json (fuente de verdad sin traducir),
// y a partir de ESE archivo crudo genera/actualiza data/anuncios.json con
// la traducción y el balance de héroes. Nunca traduce leyendo de
// anuncios.json directamente.

const fs = require('fs');
const path = require('path');
const http2 = require('http2');
const zlib = require('zlib');
const { main: processPatches } = require('./process-patches');
const { main: repairGeneratedData } = require('./repair-generated-data');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const API_HOST = 'hok-sg-community.playerinfinite.com';
const API_ORIGIN = `https://${API_HOST}`;
const API_BASE_PATH = '/api/gpts.information_feeds_svr.InformationFeedsSvr';
const LIST_PATH = `${API_BASE_PATH}/GetContentByLabel`;
const DETAIL_PATH = `${API_BASE_PATH}/GetContentInfoById`;
const RAW_DATA_PATH = path.join(REPO_ROOT, 'data', 'anuncios-raw.json');
const DATA_PATH = path.join(REPO_ROOT, 'data', 'anuncios.json');
const PAGE_SIZE = 10;

const REQUEST_HEADERS = {
  accept: '*/*',
  'accept-encoding': 'gzip, deflate, br',
  'content-type': 'application/json;charset=utf-8',
  origin: 'https://www.honorofkings.com',
  referer: 'https://www.honorofkings.com/',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36',
  'x-areaid': 'es-la',
  'x-gameid': '9',
  'x-language': 'es-US',
  'x-source': 'pc_web',
};


// ---------- Categorización de anuncios ----------
// No filtramos NADA por título (antes se descartaba todo lo que no dijera
// "Announcement", perdiendo cosas como "Anti-Cheat Measures"). En cambio,
// cada anuncio se etiqueta con una categoría para poder filtrar/mostrar
// distinto en el sitio, sin perder ningún anuncio del historial.
function categorizeAnnouncement(title) {
  const t = (title || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (t.includes('test server') || t.includes('servidor de prueba')) return 'test_server';
  if (t.includes('version update announcement') || t.includes('anuncio de actualizacion de version')) return 'version_update';
  if (t.includes('anti-cheat') || t.includes('antitrampa')) return 'anti_cheat';
  if (t.includes('special crackdown') || t.includes('operativo especial')) return 'crackdown';
  if (t.includes('new patch announcement') || t.includes('notas del parche')) return 'new_patch';
  if (t.includes('server update announcement') || t.includes('anuncio de actualizacion del servidor')) return 'server_update';
  return 'other';
}


// ---------- Utilidades ----------

function loadRaw() {
  if (!fs.existsSync(RAW_DATA_PATH)) {
    return { items: [] };
  }
  const raw = fs.readFileSync(RAW_DATA_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    console.warn('anuncios-raw.json inválido, empezando desde cero.');
    return { items: [] };
  }
}

function saveRaw(data) {
  data.items.sort((a, b) => Number(b.pub_timestamp) - Number(a.pub_timestamp));
  fs.mkdirSync(path.dirname(RAW_DATA_PATH), { recursive: true });
  fs.writeFileSync(RAW_DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function loadExistingPatches() {
  if (!fs.existsSync(DATA_PATH)) {
    return { patches: [] };
  }
  const raw = fs.readFileSync(DATA_PATH, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    console.warn('anuncios.json inválido, empezando desde cero.');
    return { patches: [] };
  }
}

function savePatches(data) {
  data.patches.sort((a, b) => Number(b.pub_timestamp) - Number(a.pub_timestamp));
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function buildTemporaryRawItems(patches) {
  return patches
    .filter((patch) => patch && patch.id && patch.rawContentHtml)
    .map((patch) => ({
      id: patch.id,
      title: patch.title,
      category: patch.category,
      pub_timestamp: patch.pub_timestamp,
      fetched_at: patch.fetched_at,
      rawContentHtml: patch.rawContentHtml,
    }));
}

function removeTemporaryRaw() {
  try {
    if (fs.existsSync(RAW_DATA_PATH)) fs.unlinkSync(RAW_DATA_PATH);
  } catch (error) {
    console.warn(`No se pudo eliminar el raw temporal: ${error.message}`);
  }
}

function decodeResponse(buffer, encoding) {
  const value = (encoding || '').toLowerCase();
  if (value.includes('br')) return zlib.brotliDecompressSync(buffer);
  if (value.includes('gzip')) return zlib.gunzipSync(buffer);
  if (value.includes('deflate')) return zlib.inflateSync(buffer);
  return buffer;
}

function apiPost(pathname, body) {
  return new Promise((resolve, reject) => {
    const client = http2.connect(API_ORIGIN);
    let settled = false;
    const closeClient = () => { try { client.close(); } catch {} };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      closeClient();
      reject(error);
    };

    client.on('error', fail);
    const bodyBuffer = Buffer.from(JSON.stringify(body), 'utf8');
    const request = client.request({
      ':authority': API_HOST,
      ':method': 'POST',
      ':path': pathname,
      ':scheme': 'https',
      ...REQUEST_HEADERS,
      'content-length': String(bodyBuffer.length),
    });
    const chunks = [];
    let responseHeaders = {};

    request.setEncoding('binary');
    request.on('response', (headers) => { responseHeaders = headers; });
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk, 'binary')));
    request.on('end', () => {
      try {
        const status = Number(responseHeaders[':status'] || 0);
        if (status < 200 || status >= 300) throw new Error(`HTTP ${status} en ${pathname}`);
        const text = decodeResponse(Buffer.concat(chunks), responseHeaders['content-encoding']).toString('utf8');
        const json = JSON.parse(text);
        if (json?.code !== undefined && Number(json.code) !== 0) {
          throw new Error(`API code=${json.code} msg=${json.msg || 'sin mensaje'}`);
        }
        if (settled) return;
        settled = true;
        closeClient();
        resolve(json);
      } catch (error) {
        fail(error);
      }
    });
    request.on('error', fail);
    request.end(bodyBuffer);
  });
}

// ---------- Traducción (inglés -> español) ----------
// Usamos el endpoint público no oficial de Google Translate.
// No requiere API key. Adecuado para este volumen bajo (1-2 patches cada varios días).

async function translateText(text, targetLang = 'es') {
  if (!text || !text.trim()) return text;
  if (isProtectedTitle(text)) return text; // nombre propio de modo/evento: no se traduce

  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const translated = data[0].map((chunk) => chunk[0]).join('');
    return applyFixups(translated);
  } catch (err) {
    console.warn(`No se pudo traducir un texto, se deja en inglés. Motivo: ${err.message}`);
    return text; // fallback: dejamos el original si falla la traducción
  }
}

// Trocea por longitud de caracteres (no solo por línea) para evitar el
// HTTP 400 que tira el endpoint de traducción con queries muy largas
// (ej: secciones de "Events" gigantes en algunos anuncios).
const MAX_TRANSLATE_CHARS = 3500;

// Nombres propios de modos de juego / eventos que la comunidad de HOK usa
// en inglés incluso hablando en español (ej: "Super Flow Brawl", no
// "Pelea de súper flujo"). Cuando un título de sección coincide EXACTO con
// uno de estos, no lo mandamos a traducir. Si HOK saca un modo nuevo que
// también deba quedar sin traducir, agregarlo acá.
const PROTECTED_TITLES = ['Super Flow Brawl', 'Bounty Match', 'Snowy Brawl', 'Snowy Sprint', 'Winter Draw'];

function isProtectedTitle(text) {
  const normalized = (text || '').trim().toLowerCase();
  return PROTECTED_TITLES.some((t) => t.toLowerCase() === normalized);
}

// Red de seguridad: Google Translate traduce algunos términos de HOK de
// forma inconsistente o incorrecta. Estos fixups se aplican SIEMPRE sobre
// cualquier texto ya traducido, sea un título, un cambio de héroe o el
// cuerpo de una sección, por si el término aparece suelto en medio de una
// oración y no como título de sección (donde ya lo protegemos arriba).
// El orden importa: las combinaciones más específicas (con artículo y
// concordancia de género/adjetivo) van ANTES que el reemplazo genérico de
// la palabra suelta, para no dejar frases mal concordadas
// (ej: "la piel épica" -> "el aspecto épico", no "la aspecto épica").
const POST_TRANSLATE_FIXUPS = [
  // "Cooldown" a veces sale como "Enfriarse:" y a veces sin los dos puntos
  // ("Enfriarse" a secas). Reemplazamos la palabra sola para cubrir ambos.
  [/Enfriarse/g, 'Enfriamiento'],

  // "Shield:" (el stat) sale a veces como "Blindaje:" y a veces como
  // "Escudo:". Unificamos siempre a "Escudo:", que es el término más usado
  // en la comunidad de HOK en español.
  [/\bBlindaje\b/g, 'Escudo'],

  // "Skin" (el aspecto cosmético de un héroe) Google Translate lo traduce
  // como "piel" (de la dermis), lo cual queda raro/gramaticalmente confuso.
  // Preferimos "aspecto" en todos los casos. "piel" es femenino y "aspecto"
  // es masculino, así que primero arreglamos las combinaciones con artículo
  // o adjetivo que necesitan concordancia, y recién después la palabra suelta.
  [/\buna piel épica\b/gi, 'un aspecto épico'],
  [/\bpiel épica\b/gi, 'aspecto épico'],
  [/\buna piel rara\b/gi, 'un aspecto raro'],
  [/\bpiel rara\b/gi, 'aspecto raro'],
  [/\bde la piel\b/gi, 'del aspecto'],
  [/\bde las pieles\b/gi, 'de los aspectos'],
  [/\bla piel\b/gi, 'el aspecto'],
  [/\blas pieles\b/gi, 'los aspectos'],
  [/\buna piel\b/gi, 'un aspecto'],
  [/\bunas pieles\b/gi, 'unos aspectos'],
  [/\bpieles\b/gi, 'aspectos'], // fallback genérico plural (sin artículo)
  [/\bpiel\b/gi, 'aspecto'], // fallback genérico singular (sin artículo)

  [/Pelea de súper flujo/gi, 'Super Flow Brawl'],
  [/Partido de recompensa/gi, 'Bounty Match'],

  // "Ultimate" (la habilidad definitiva) sale traducida de forma
  // inconsistente por Google Translate: a veces la deja en inglés tal cual,
  // otras veces la convierte en "Definitiva". Se normaliza siempre a
  // "Definitiva", que es la forma más usada en la comunidad de HOK en
  // español y la que ya reconoce el parser de headers de habilidad.
  [/\bUltimate\b/g, 'Definitiva'],
];

function applyFixups(text) {
  if (!text) return text;
  let result = text;
  for (const [pattern, replacement] of POST_TRANSLATE_FIXUPS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}


async function translateLongText(text, targetLang = 'es') {
  if (!text || !text.trim()) return text;
  const lines = text.split('\n');
  const translatedLines = [];

  let buffer = [];
  let bufferLen = 0;

  async function flushBuffer() {
    if (buffer.length === 0) return;
    const chunkText = buffer.join('\n');
    const translated = await translateText(chunkText, targetLang);
    translatedLines.push(...translated.split('\n'));
    buffer = [];
    bufferLen = 0;
  }

  for (const line of lines) {
    if (!line.trim()) {
      await flushBuffer();
      translatedLines.push('');
      continue;
    }
    if (line.length > MAX_TRANSLATE_CHARS) {
      await flushBuffer();
      translatedLines.push(await translateText(line.slice(0, MAX_TRANSLATE_CHARS), targetLang));
      continue;
    }
    if (bufferLen + line.length + 1 > MAX_TRANSLATE_CHARS) {
      await flushBuffer();
    }
    buffer.push(line);
    bufferLen += line.length + 1;
  }
  await flushBuffer();

  return translatedLines.join('\n');
}

// ---------- Búsqueda de patches ----------

async function fetchPatchList(offset = 0) {
  const body = {
    language: ['es-US'],
    gameid: '9',
    offset,
    get_num: PAGE_SIZE,
    ext_info_type_list: [0, 1, 2],
    secondary_label_id: '965',
    content_class: 0,
    primary_label_id: '727',
    third_label_id: 0,
  };
  const json = await apiPost(LIST_PATH, body);
  return json?.data?.info_content ?? [];
}

async function fetchPatchContent(fatherContentId) {
  const json = await apiPost(DETAIL_PATH, { father_content_id: fatherContentId });
  return json?.data ?? json; // la forma exacta puede variar, se ajusta si hace falta
}

// ---------- Parseo del HTML del parche ----------
//
// HOK cambió el formato de sus anuncios varias veces a lo largo del tiempo:
// a veces el balance de héroes va en un <h2>, otras en <h1>/<h3>, otras en un
// <strong> suelto sin ningún tag de heading, e incluso a veces el texto
// "Hero Balance Adjustments" aparece dos veces en el mismo anuncio (una en
// un resumen/índice al principio, y otra en el heading real más abajo).
// Todo lo de acá abajo está pensado para sobrevivir a esos cambios de formato.

function stripHtmlTags(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    // Algunos anuncios usan <p>/<div>/<li> en vez de <br> para separar líneas
    // (ej: patches exportados con otro editor). Tratamos su cierre como salto de línea.
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&gt;/gi, '>')
    .replace(/&lt;/gi, '<')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeHeadingText(text) {
  return stripHtmlTags(text)
    .replace(/^\s*\d+[.)]\s*/, '') // "1. " o "1) " al principio
    .replace(/:\s*$/, '') // ":" al final
    .trim()
    .toLowerCase();
}

function isHeroBalanceHeading(text) {
  const normalized = normalizeHeadingText(text);
  // Cubre el caso de HOK usando simplemente "Heroes" como título de sección
  // (sin la palabra "balance"/"adjustments"), ej: "1.Heroes".
  if (normalized === 'heroes' || normalized === 'hero' || normalized === 'héroes' || normalized === 'héroe') return true;
  const hasHero = /hero|h[eé]roe/.test(normalized);
  // Cubrimos las variantes reales que aparecieron en el historial:
  // "Hero Balance Adjustments", "Hero Balancing Adjustments",
  // "Hero & Equipment Balancing", "Snow Carnival Hero Enhancements", etc.
  const hasBalanceWord = /(balanc|adjust|enhanc|ajust|mejor|potenc|debilit|equilibr)/.test(normalized);
  return hasHero && hasBalanceWord;
}

// Nombres de sección "hermanas" conocidos: sirven para saber dónde termina
// la sección de balance de héroes (o cualquier otra sección), sin importar
// si vienen envueltos en h1-h4 o en un <strong> suelto dentro de un <p>.
// No incluye subtítulos que aparecen DENTRO del desglose de un héroe
// (ej. "Mechanics Upgrade", "Stat Buffs"), solo títulos de nivel superior.
const BOUNDARY_KEYWORDS = [
  'battlefield', 'battlefield adjustments', 'gorge adjustment', 'gorge improvements',
  'events?', 'more amazing events?', 'more exciting events?', 'event sneak peek',
  'modes?', 'game modes?', 'mode preview', 'theme modes?', 'casual modes?',
  'new game mode', 'season game mode adjustments', 'super flow brawl( balance adjustments?)?',
  'bounty match', 'snowy brawl', 'snowy sprint', 'winter draw',
  'system( improvements?| optimization)?', 'fixes( and)? improvements?',
  'bug fixes( and optimizations?)?', 'equipment( adjustments?)?',
  'season( updates?)?', 'season tier transfer list', 'new heroe?s?:?',
  'introducing a new hero', 'honor pass', 'honor medals', 'weekly behavior report',
  'skin optimization', 'event center optimization', 'shop gifts adjustments',
  'limited-time token adjustments', 'return system', 'miscellaneous',
  'campo de batalla', 'ajustes del campo de batalla', 'ajustes de la garganta',
  'eventos?', 'más eventos?', 'modos?', 'modos de juego?', 'nuevo modo de juego',
  'ajustes del modo de juego', 'sistema', 'correcciones y mejoras',
  'correcciones de errores', 'equipamiento', 'ajustes del equipamiento',
  'temporada', 'actualizaciones de temporada', 'nuevo héroe', 'nuevo heroe',
  'pase de honor', 'medallas de honor', 'miscelánea', 'miscelaneo',
];
const BOUNDARY_REGEX = new RegExp(`^(${BOUNDARY_KEYWORDS.join('|')})$`, 'i');

function isBoundaryHeading(text) {
  const normalized = normalizeHeadingText(text);
  return isHeroBalanceHeading(text) || BOUNDARY_REGEX.test(normalized);
}

// Recolecta candidatos a heading en todo el documento, sea cual sea el
// formato que use ese anuncio en particular:
//  1. Tags reales <h1>-<h4>.
//  2. Bloques <strong>...</strong> cuyo texto matchee un nombre de sección
//     conocido (así se descartan nombres de héroes en negrita, que no son
//     secciones).
//  3. Fallback: párrafos de texto plano (sin <strong>) que matcheen un
//     nombre de sección conocido, para los anuncios más viejos que ni
//     siquiera usan negrita para sus títulos.
function collectHeadingCandidates(html) {
  const candidates = [];

  const tagRegex = /<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi;
  let m;
  while ((m = tagRegex.exec(html)) !== null) {
    candidates.push({ pos: m.index, end: tagRegex.lastIndex, text: m[1] });
  }

  const strongRegex = /<strong[^>]*>([\s\S]*?)<\/strong>/gi;
  while ((m = strongRegex.exec(html)) !== null) {
    const cleanText = stripHtmlTags(m[1]);
    if (cleanText.length > 0 && cleanText.length < 60 && isBoundaryHeading(cleanText)) {
      candidates.push({ pos: m.index, end: strongRegex.lastIndex, text: m[1] });
    }
  }

  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  while ((m = pRegex.exec(html)) !== null) {
    const cleanText = stripHtmlTags(m[1]);
    if (
      cleanText.length > 0 &&
      cleanText.length < 60 &&
      !/<strong/i.test(m[1]) &&
      BOUNDARY_REGEX.test(normalizeHeadingText(cleanText))
    ) {
      candidates.push({ pos: m.index, end: pRegex.lastIndex, text: m[1] });
    }
  }

  candidates.sort((a, b) => a.pos - b.pos);
  return candidates;
}

function extractHeroBalanceSectionHtml(fullHtml) {
  if (!fullHtml) return null;

  const candidates = collectHeadingCandidates(fullHtml);
  const heroCandidates = candidates.filter((c) => isHeroBalanceHeading(c.text));

  if (heroCandidates.length === 0) return null;

  // Si hay varios candidatos (ej: uno en un índice/resumen al principio del
  // anuncio, y otro en el contenido real más abajo), elegimos el que tenga
  // MÁS contenido hasta el próximo heading: el índice/resumen siempre es
  // mucho más corto que la sección real con el detalle de cada héroe.
  let best = null;
  let bestLength = -1;
  for (const cand of heroCandidates) {
    const idx = candidates.findIndex((c) => c.pos === cand.pos);
    const nextBoundary = idx + 1 < candidates.length ? candidates[idx + 1].pos : fullHtml.length;
    const length = nextBoundary - cand.end;
    if (length > bestLength) {
      bestLength = length;
      best = { start: cand.end, end: nextBoundary };
    }
  }

  return fullHtml.slice(best.start, best.end);
}

// Extrae TODAS las secciones de nivel superior de un anuncio, en orden.
// Se usa para traducir y mostrar el resto del contenido (eventos, bug fixes, etc.)
// en los updates que no tienen (o además de) sección de balance de héroes.
function extractAllSections(fullHtml) {
  if (!fullHtml) return [];

  const candidates = collectHeadingCandidates(fullHtml);
  if (candidates.length === 0) return [];

  return candidates.map((h, i) => {
    const bodyEnd = i + 1 < candidates.length ? candidates[i + 1].pos : fullHtml.length;
    const bodyHtml = fullHtml.slice(h.end, bodyEnd);
    return { title: stripHtmlTags(h.text), bodyText: stripHtmlTags(bodyHtml) };
  });
}

// Vocabulario de palabras que SIEMPRE encabezan una etiqueta de stat/mecánica
// (nunca un nombre de héroe), extraído empíricamente de los 71 patches
// históricos reales. Los nombres de héroe reales confirmados en este mismo
// formato (Wuyan, Musashi, Luban No.7, Xiang Yu, Consort Yu, etc.) tienen
// como máximo 2 palabras y NUNCA empiezan con ninguna de estas.
const STAT_LABEL_FIRST_WORDS = new Set([
  'skill', 'passive', 'ultimate', 'new', 'added', 'removed', 'enhanced', 'extra',
  'recovery', 'damage', 'effect', 'effects', 'cooldown', 'movement', 'attack',
  'physical', 'magical', 'health', 'shield', 'mechanic', 'mechanics', 'combat',
  'playability', 'equipment', 'round', 'rules', 'stock', 'stocking', 'slow',
  'true', 'wall', 'number', 'on', 'increased', 'changed', 'gained', 'aiming',
  'charging', 'bolt', 'burn', 'contact', 'crowd', 'dash', 'duration', 'echo',
  'energy', 'fire', 'first', 'forward', 'fourth', 'life-death', 'mana', 'mark',
  'max', 'phase', 'price', 'range', 'recipe', 'slash', 'soul', 'splinter',
  'stat', 'sweep', 'tide', 'base', 'basic', 'critical', 'beam', 'buff', 'buffs',
  'dual', 'heavy', 'revenge', 'adjustments', 'adjustment', 'cast', 'area',
  'additional', 'jump', 'wave', 'note',
  'habilidad', 'pasiva', 'definitiva', 'nuevo', 'añadido', 'mejorado',
  'recuperación', 'daño', 'efecto', 'efectos', 'enfriamiento', 'movimiento',
  'ataque', 'físico', 'fisico', 'mágico', 'magico', 'salud', 'escudo',
  'mecánica', 'mecanica', 'mecánicas', 'mecanicas', 'combate', 'jugabilidad',
  'equipo', 'ronda', 'reglas', 'lentitud', 'verdadero', 'aumentado',
  'cambiado', 'obtenido', 'duración', 'duracion', 'energía', 'energia',
  'maná', 'mana', 'marca', 'alcance', 'atributos', 'estadísticas', 'estadisticas',
  'ajustes', 'ajuste', 'lanzamiento', 'área', 'area', 'adicional', 'salto',
  'onda', 'nota',
]);

// Distingue un nombre de héroe real de un subtítulo interno (habilidad,
// categoría de cambio, oración descriptiva) dentro de un mismo bloque de
// balance. Necesario porque HOK, en los anuncios más viejos (formato
// <h1>/<h3>), envuelve en <strong> TANTO el nombre del héroe COMO cada
// subtítulo de habilidad/categoría dentro de su desglose — sin esto, cada
// subtítulo se contaba como un "héroe" separado y falso.
function isLikelySubheading(text) {
  const t = text.trim();
  if (t.length === 0) return true;

  // Etiquetas con contenido DESPUÉS del colon ("Skill 1: Fireblast", "New
  // Effect: something") son siempre subtítulos, nunca nombres de héroe.
  if (/:\s*\S/.test(t)) return true;

  // Números, paréntesis o guion medio son característicos de subtítulos de
  // habilidad ("Skill 1", "Ultimate (Starburn)", "Skill 2 - Frenzy") y no
  // aparecen en nombres de héroe reales (la única excepción conocida,
  // "Luban No.7", se maneja aparte más abajo).
  const withoutTrailingColon = t.replace(/:$/, '');
  if (/^luban no\.?\s*7$/i.test(withoutTrailingColon)) return false;
  if (/[()\u2014-]/.test(withoutTrailingColon) || /\d/.test(withoutTrailingColon)) return true;

  // Termina en punto -> es una oración descriptiva, no un nombre.
  if (/\.$/.test(t)) return true;

  // Nombres de héroe reales en este formato tienen como máximo 2 palabras.
  const words = withoutTrailingColon.split(/\s+/).filter(Boolean);
  if (words.length > 2) return true;

  // La primera palabra es vocabulario de stat/mecánica conocido -> subtítulo.
  if (STAT_LABEL_FIRST_WORDS.has(words[0].toLowerCase())) return true;

  return false;
}

// Detecta líneas que son puramente un separador visual decorativo (ej:
// "|||||", "-----", "=====", "*****", pegado a veces desde Word como divisor
// entre el nombre de un héroe y el desglose de sus stats). No son nombres de
// héroe ni subtítulos reales, así que se descartan antes de clasificar nada:
// sin esto, cada aparición corta el parseo y genera un "héroe" falso con ese
// texto como nombre (visto en vivo: 43 apariciones de "|||||" en un mismo
// anuncio generando 43 héroes fantasma).
const RE_DECORATIVE_SEPARATOR = /^(.)\1+$/;
function isDecorativeSeparator(text) {
  const t = text.trim();
  if (t.length < 2) return false;
  if (/[a-z0-9]/i.test(t)) return false; // si tiene letras o números, no es un separador puro
  return RE_DECORATIVE_SEPARATOR.test(t);
}

function parseHeroChanges(sectionHtml) {
  if (!sectionHtml) return [];

  const strongRegex = /<strong[^>]*>([\s\S]*?)<\/strong>/gi;
  const rawMatches = [];
  let m;
  while ((m = strongRegex.exec(sectionHtml)) !== null) {
    const text = stripHtmlTags(m[1]).trim();
    if (isDecorativeSeparator(text)) continue; // descartar separadores decorativos, no son héroe ni subtítulo
    rawMatches.push({ text, start: m.index, end: strongRegex.lastIndex });
  }

  // Paso previo: algunos anuncios parten una misma etiqueta/nombre en dos
  // tags <strong> consecutivos DENTRO DE LA MISMA LÍNEA sin nada entre medio
  // (ej: "Passive:" seguido inmediatamente de "Accuracy", que en realidad es
  // "Passive: Accuracy"). Los unimos en un solo bloque antes de clasificar.
  // Ojo: solo si NO hay un quiebre de párrafo/línea entre medio — si lo hay,
  // son bloques de líneas distintas (ej: nombre de héroe seguido del
  // encabezado del héroe siguiente) y no deben unirse.
  const matches = [];
  for (const match of rawMatches) {
    const prev = matches[matches.length - 1];
    if (prev) {
      const gapHtml = sectionHtml.slice(prev.end, match.start);
      const hasLineBreak = /<\/?(p|div|li|br)\b/i.test(gapHtml);
      const gapText = stripHtmlTags(gapHtml);
      if (!hasLineBreak && gapText.trim().length === 0) {
        prev.text = `${prev.text} ${match.text}`.trim();
        prev.end = match.end;
        continue;
      }
    }
    matches.push({ ...match });
  }

  const heroes = [];
  let current = null;

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].start : sectionHtml.length;
    const restHtml = sectionHtml.slice(match.end, nextStart);
    const restText = stripHtmlTags(restHtml);

    const looksLikeSubheading = isLikelySubheading(match.text);

    if (!current && looksLikeSubheading) {
      // Banner de sección antes de cualquier héroe real (ej: "Mechanics
      // Upgrade", "Changes to Skill Mechanics"). No es un héroe: se descarta
      // (es solo un título de categoría, no datos de balance).
      continue;
    }

    const shouldMerge = current && looksLikeSubheading;

    if (!shouldMerge) {
      if (current) heroes.push(current);
      current = { name: match.text, changesText: restText };
    } else {
      current.changesText = `${current.changesText}\n\n${match.text}\n${restText}`.trim();
    }
  }
  if (current) heroes.push(current);

  return heroes.filter((h) => h && h.name.length > 0 && h.name.length < 60);
}

// ---------- Lógica principal ----------

async function findRecentPatches(count = 5) {
  const list = await fetchPatchList(0);
  return list.slice(0, count);
}

// Traduce/procesa UN item ya guardado en el archivo crudo. Misma lógica que
// process-patches.js (duplicada a propósito, como el resto del archivo).
async function processRawItem(rawItem) {
  const rawHtml = rawItem.rawContentHtml || '';

  const balanceSectionHtml = extractHeroBalanceSectionHtml(rawHtml);
  const heroChanges = parseHeroChanges(balanceSectionHtml);

  const otherSections = extractAllSections(rawHtml).filter(
    (s) => !isHeroBalanceHeading(s.title) && s.bodyText.trim().length > 0
  );

  // Fallback: anuncios sin NINGÚN heading reconocible (ni <h1-4>, ni <strong>
  // que matchee un boundary conocido) — es decir, puro texto plano tipo
  // "Dear Players, ..." (ej: avisos de crackdown anti-cheating). Sin esto,
  // otherSections queda vacío, nunca se traduce nada, y el sitio termina
  // mostrando el HTML crudo en inglés como último recurso. Se arma una
  // sección sintética con todo el cuerpo para que sí pase por el traductor.
  if (otherSections.length === 0 && heroChanges.length === 0) {
    const fullText = stripHtmlTags(rawHtml);
    if (fullText.trim().length > 0) {
      otherSections.push({ title: '', bodyText: fullText });
    }
  }

  console.log('  La fuente ya está en español; se conserva el texto original...');

  const titleEs = rawItem.title;

  for (const hero of heroChanges) {
    hero.changesText_es = hero.changesText;
  }

  for (const section of otherSections) {
    section.title_es = section.title;
    section.bodyText_es = section.bodyText;
  }

  return {
    id: rawItem.id,
    title: rawItem.title,
    title_es: titleEs,
    category: rawItem.category || categorizeAnnouncement(rawItem.title),
    pub_timestamp: rawItem.pub_timestamp,
    fetched_at: rawItem.fetched_at || Math.floor(Date.now() / 1000),
    rawContentHtml: rawHtml,
    heroChanges,
    sections: otherSections,
  };
}

async function main() {
  const existingData = loadExistingPatches();
  const existingPatches = Array.isArray(existingData.patches) ? existingData.patches : [];
  const knownPatchIds = new Set(existingPatches.map((patch) => patch.id || patch.content_id));

  const recent = await findRecentPatches(5);
  if (!recent.length) {
    console.log('No se encontraron anuncios en la API.');
    repairGeneratedData();
    return;
  }

  const newOnes = recent.filter((item) => !knownPatchIds.has(item.father_content_id));

  if (newOnes.length === 0) {
    console.log(`Sin novedades. Último anuncio ya guardado: ${recent[0].title}`);
    repairGeneratedData();
    return;
  }

  // Del más viejo al más nuevo, para mantener un orden lógico al ir
  // agregándolos al historial (por si hay más de uno pendiente).
  const newOnesChronological = [...newOnes].reverse();
  const newRawItems = [];

  for (const item of newOnesChronological) {
    console.log(`Anuncio nuevo detectado: ${item.title}`);
    const fullContentData = await fetchPatchContent(item.father_content_id);
    const rawHtml = fullContentData?.content ?? '';

    const rawItem = {
      id: item.father_content_id,
      title: item.title,
      category: categorizeAnnouncement(item.title),
      pub_timestamp: item.pub_timestamp,
      fetched_at: Math.floor(Date.now() / 1000),
      rawContentHtml: rawHtml,
    };

    newRawItems.push(rawItem);
  }

  const temporaryRaw = {
    items: [...buildTemporaryRawItems(existingPatches), ...newRawItems],
  };

  try {
    saveRaw(temporaryRaw);
    console.log(`Procesando ${newRawItems.length} anuncio(s) nuevo(s) con raw temporal.`);
    await processPatches();
    repairGeneratedData();
  } finally {
    removeTemporaryRaw();
  }
}

async function runWithRetries() {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      console.log(`Intento ${attempt}/${maxAttempts}`);
      await main();
      return;
    } catch (error) {
      console.error(`Falló el intento ${attempt}: ${error.message}`);
      if (attempt === maxAttempts) throw error;
      console.log('Reintentando sincronización y reparación...');
    }
  }
}

runWithRetries().catch((err) => {
  console.error('Error al chequear patches:', err);
  process.exit(1);
});