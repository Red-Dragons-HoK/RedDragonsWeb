const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const ANNOUNCEMENTS_PATH = path.join(DATA_DIR, 'anuncios.json');
const UPDATES_PATH = path.join(DATA_DIR, 'updates.json');
const HOME_DATA_PATH = path.join(DATA_DIR, 'home-data.json');
const CALENDAR_PATH = path.join(DATA_DIR, 'calendar.json');
const SEARCH_INDEX_PATH = path.join(DATA_DIR, 'hero-search-index.json');

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function normalizeHero(hero = {}) {
  const displayName = hero.displayName || hero.name || '';
  const name = hero.name || displayName;
  const changesText = hero.changesText || hero.changesText_es || '';

  return {
    displayName,
    name,
    changesText,
    lane: hero.lane || null,
  };
}

function summarizePatch(patch = {}) {
  return {
    id: patch.id,
    title: patch.title || '',
    title_es: patch.title_es || patch.title || '',
    pub_timestamp: patch.pub_timestamp,
    category: patch.category || 'other',
    heroChanges: (patch.heroChanges || []).map(normalizeHero),
  };
}

function classifyHero(changesText) {
  const firstLine = (changesText || '').split('\n')[0].trim().toLowerCase();
  const hasNerf = /nerf|debilitad|debilitaci|reducid/.test(firstLine);
  const hasBuff = /buff|potenciad|mejorad|mejora|aumentad|fortalec/.test(firstLine);
  if (hasNerf && !hasBuff) return 'nerf';
  if (hasBuff && !hasNerf) return 'buff';
  return 'adjusted';
}

function buildHeroSearchIndex(patches) {
  const index = {};

  patches.forEach((patch) => {
    (patch.heroChanges || []).forEach((hero) => {
      const displayName = hero.displayName || hero.name || '';
      if (!displayName) return;

      const entry = {
        patch: {
          id: patch.id,
          title: patch.title || '',
          title_es: patch.title_es || patch.title || '',
          pub_timestamp: patch.pub_timestamp,
        },
        category: classifyHero(hero.changesText),
        hero: {
          displayName,
          name: hero.name || displayName,
          changesText: hero.changesText || '',
        },
      };

      if (!index[displayName]) index[displayName] = [];
      index[displayName].push(entry);
    });
  });

  return index;
}

function main() {
  const announcementsData = readJson(ANNOUNCEMENTS_PATH, { patches: [] });
  const updatesData = readJson(UPDATES_PATH, { patches: [] });

  const announcements = (announcementsData.patches || announcementsData.announcements || [])
    .map(summarizePatch)
    .sort((a, b) => Number(b.pub_timestamp) - Number(a.pub_timestamp));

  const updates = (updatesData.patches || [])
    .map(summarizePatch)
    .sort((a, b) => Number(b.pub_timestamp) - Number(a.pub_timestamp));

  const heroSearchIndex = buildHeroSearchIndex(updates);

  const homeData = {
    patches: updates,
    announcements,
    heroSearchIndex,
  };

  writeJson(HOME_DATA_PATH, homeData);
  writeJson(CALENDAR_PATH, { patches: updates });
  writeJson(SEARCH_INDEX_PATH, heroSearchIndex);

  console.log(`Generated derived data for ${updates.length} patches and ${announcements.length} announcements.`);
}

main();
