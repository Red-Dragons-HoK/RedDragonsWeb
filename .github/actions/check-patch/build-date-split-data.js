const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const MASTER_PATH = path.join(DATA_DIR, 'updates.json');
const INDEX_PATH = path.join(DATA_DIR, 'patches-index.json');
const DATE_DIR = path.join(DATA_DIR, 'patches-by-date');

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

function toDateKey(timestamp) {
  const date = new Date(Number(timestamp) * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function main() {
  const source = readJson(MASTER_PATH, { patches: [] });
  const patches = (source.patches || []).slice().sort((a, b) => Number(b.pub_timestamp) - Number(a.pub_timestamp));

  const byDate = new Map();
  patches.forEach((patch) => {
    const dateKey = toDateKey(patch.pub_timestamp);
    if (!byDate.has(dateKey)) {
      byDate.set(dateKey, []);
    }
    byDate.get(dateKey).push({
      id: patch.id,
      title: patch.title || '',
      title_es: patch.title_es || patch.title || '',
      category: patch.category || 'other',
      pub_timestamp: patch.pub_timestamp,
      heroChanges: patch.heroChanges || [],
    });
  });

  const dateEntries = Array.from(byDate.entries())
    .map(([date, items]) => ({
      date,
      title: items[0]?.title_es || items[0]?.title || date,
      count: items.length,
      firstPatchId: items[0]?.id || null,
      lastPatchId: items[items.length - 1]?.id || null,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  writeJson(INDEX_PATH, { items: dateEntries });

  fs.mkdirSync(DATE_DIR, { recursive: true });
  byDate.forEach((items, date) => {
    writeJson(path.join(DATE_DIR, `${date}.json`), {
      date,
      patches: items,
    });
  });

  console.log(`Generated ${dateEntries.length} date files and index for ${patches.length} patches.`);
}

main();
