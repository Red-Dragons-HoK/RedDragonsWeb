/* ===== State ===== */
let dateEntries = [];          // índice completo: [{date, title, count, firstPatchId, lastPatchId}]
let patchesByDate = new Map(); // date -> array de patches ya descargados (cache)
let idToDate = new Map();      // patchId -> date, para resolver #patch-<id> sin recargar todo
let patches = [];              // patches de la fecha actualmente mostrada (igual que antes)
let heroLanes = {};
let currentPatchDate = '';

/* ===== Data Loading ===== */
async function loadData(){
  const board = document.getElementById('board');
  try{
    const [indexRes, lanesRes] = await Promise.all([
      fetch('../data/patches-index.json').catch(() => null),
      fetch('../data/hero-lanes.json'),
      loadHeroCatalog('../data/heroes.json'),
    ]);
    if(!lanesRes.ok) throw new Error('fetch-failed');
    heroLanes = await lanesRes.json();

    const indexJson = indexRes && indexRes.ok ? await indexRes.json() : null;
    dateEntries = (indexJson && Array.isArray(indexJson.items) ? indexJson.items : []);

    if (dateEntries.length) {
      // Mapeo id -> fecha a partir del índice (cubre el caso normal de 1 parche por fecha).
      // Si algún día `count` > 1 con IDs intermedios que no son first/last, ese id puntual
      // no se resuelve por hash sin cargar la fecha entera — ver nota más abajo.
      dateEntries.forEach(entry => {
        if (entry.firstPatchId) idToDate.set(entry.firstPatchId, entry.date);
        if (entry.lastPatchId) idToDate.set(entry.lastPatchId, entry.date);
      });

      buildSelect();
      window.addEventListener('hashchange', openFromHash);

      const opened = await openFromHash();
      if (!opened) {
        await selectDate(dateEntries[0].date, { render: true, updateSelect: true });
      }
    } else {
      // Fallback legado: sin índice, se usa el archivo monolítico completo.
      const patchesRes = await fetch('../data/updates.json');
      if(!patchesRes.ok) throw new Error('fetch-failed');
      const patchesJson = await patchesRes.json();
      patches = (patchesJson.patches || [])
        .sort((a,b) => Number(b.pub_timestamp) - Number(a.pub_timestamp));
      buildSelect();
      openFromHash() || (patches.length && renderPatch(patches[0].id));
      window.addEventListener('hashchange', openFromHash);
    }
  }catch(err){
    console.error(err);
    board.insertAdjacentHTML('beforeend',
      `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        background:rgba(6,12,10,.9);color:#e9ede4;font:14px Inter,sans-serif;text-align:center;padding:24px;">
        No pude cargar ../data/patches-index.json o ../data/hero-lanes.json.<br>
        Serví esta carpeta con un servidor local (por ej. <code>npx serve</code>) en vez de abrir el archivo directo.
      </div>`);
  }
}

/* Carga (o reutiliza del cache) los patches de una fecha del índice */
async function loadDatePatches(date){
  if (patchesByDate.has(date)) return patchesByDate.get(date);

  const res = await fetch(`../data/patches-by-date/${date}.json`);
  if (!res.ok) throw new Error(`date-json-failed:${date}`);
  const json = await res.json();
  const list = (json.patches || [])
    .sort((a,b) => Number(b.pub_timestamp) - Number(a.pub_timestamp));

  list.forEach(p => idToDate.set(p.id, date));
  patchesByDate.set(date, list);
  return list;
}

/* Selecciona una fecha del índice: la carga si hace falta y opcionalmente renderiza */
async function selectDate(date, { render = false, patchId = null, updateSelect = false } = {}){
  const list = await loadDatePatches(date);
  patches = list;

  if (updateSelect) {
    const sel = document.getElementById('patch-select');
    if (sel) sel.value = patchId || (list[0] && list[0].id) || '';
  }

  if (render && list.length) {
    renderPatch(patchId || list[0].id);
  }
}

function patchYear(entry){
  return Number(entry.date.slice(0, 4));
}

function formatIndexDate(dateStr){
  // dateStr viene como "YYYY-MM-DD" (UTC, generado por el script de build)
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('es-AR', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

/* ===== Patch Selector ===== */
function buildSelect(){
  const sel = document.getElementById('patch-select');
  const groups = [];
  let currentGroup = null;

  dateEntries.forEach(entry => {
    const year = patchYear(entry);
    if(!currentGroup || currentGroup.year !== year){
      currentGroup = { year, items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(entry);
  });

  sel.innerHTML = groups.map(group => `
    <optgroup label="${group.year}">
      ${group.items.map(entry =>
        `<option value="${entry.date}">${formatIndexDate(entry.date)} — ${entry.title}</option>`
      ).join('')}
    </optgroup>
  `).join('');

  sel.addEventListener('change', () => {
    const date = sel.value;
    selectDate(date, { render: true }).then(() => {
      const p = patches[0];
      if (p) history.replaceState(null, '', `#patch-${p.id}`);
    });
  });
}

async function openFromHash(){
  const match = location.hash.match(/^#patch-(.+)$/);
  if(!match) return false;
  const id = match[1];

  const date = idToDate.get(id);
  if (!date) return false; // id desconocido: no sabemos qué archivo cargar

  await selectDate(date, { render: true, patchId: id, updateSelect: true });
  return true;
}
