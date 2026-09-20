const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_PATH = path.join(REPO_ROOT, 'data', 'anuncios.json');
const UPDATES_PATH = path.join(REPO_ROOT, 'data', 'updates.json');
const OTHER_ANNOUNCEMENTS_PATH = path.join(REPO_ROOT, 'data', 'otros-anuncios.json');
const UPDATE_CATEGORIES = new Set(['server_update', 'version_update', 'new_patch']);

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`No se pudo leer ${filePath}: ${error.message}`);
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function stripHtmlTags(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function repairPatch(patch) {
  const repaired = { ...patch };
  repaired.id = repaired.id || repaired.content_id;
  repaired.content_id = repaired.content_id || repaired.id;
  repaired.heroChanges = Array.isArray(repaired.heroChanges) ? repaired.heroChanges : [];
  repaired.sections = Array.isArray(repaired.sections) ? repaired.sections : [];
  repaired.rawContentHtml = String(repaired.rawContentHtml || repaired.contentHtml || '');
  repaired.contentHtml = String(repaired.contentHtml || repaired.rawContentHtml);
  repaired.contentText = String(repaired.contentText || stripHtmlTags(repaired.contentHtml));
  repaired.title = String(repaired.title || repaired.cleanTitle || 'Anuncio sin título');
  repaired.category = String(repaired.category || 'other');
  repaired.pub_timestamp = String(repaired.pub_timestamp || repaired.fetched_at || 0);
  repaired.fetched_at = Number(repaired.fetched_at || Math.floor(Date.now() / 1000));
  return repaired;
}

function main() {
  const source = readJson(DATA_PATH);
  const patches = Array.isArray(source.patches) ? source.patches : [];
  if (!patches.length) throw new Error('anuncios.json no contiene anuncios procesables.');

  const seen = new Set();
  const repairedPatches = patches
    .map(repairPatch)
    .filter((patch) => {
      if (!patch.id || seen.has(patch.id)) return false;
      seen.add(patch.id);
      return true;
    })
    .sort((a, b) => Number(b.pub_timestamp) - Number(a.pub_timestamp));

  if (!repairedPatches.length) throw new Error('No quedaron anuncios válidos después de reparar anuncios.json.');

  const updates = repairedPatches.filter((patch) => UPDATE_CATEGORIES.has(patch.category));
  const otherAnnouncements = repairedPatches.filter((patch) => !UPDATE_CATEGORIES.has(patch.category));

  writeJson(DATA_PATH, { patches: repairedPatches });
  writeJson(UPDATES_PATH, { patches: updates });
  writeJson(OTHER_ANNOUNCEMENTS_PATH, { announcements: otherAnnouncements });

  console.log(`JSON reparados: ${repairedPatches.length} anuncios, ${updates.length} updates y ${otherAnnouncements.length} otros.`);
}

if (require.main === module) main();

module.exports = { main };
