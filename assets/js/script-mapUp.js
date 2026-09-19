/* ===== State ===== */
let patches = [];
let heroLanes = {};
let currentPatchDate = '';

/* ===== Utilities ===== */
function normalizeName(raw){
  return (raw || '').trim().replace(/:\s*$/, '').trim();
}

function formatDate(ts){
  const d = new Date(Number(ts) * 1000);
  return d.toLocaleDateString('es-AR', { year:'numeric', month:'short', day:'numeric' });
}

function displayDate(patch){
  return patch.dateLabel || formatDate(patch.pub_timestamp);
}

function resolveHeroLaneForPatch(name){
  const raw = normalizeName(name || '');
  const direct = heroLanes[raw];
  if (direct) return direct;

  const flowbornOverrides = {
    'La Voz del Flujo (Tanque)': 'clash',
    'La Voz del Flujo (Carry)': 'farm',
    'La Voz del Flujo (Tirador)': 'farm',
    'La Voz del Flujo (Mago)': 'mid',
    'La Voz del Flujo (Soporte)': 'roam',
    'La Voz del Flujo (Asesino)': 'jungle',
    'La Voz del Flujo (Mage)': 'mid'
  };

  if (/^La Voz del Flujo/i.test(raw)) {
    const exact = flowbornOverrides[raw] || flowbornOverrides[raw.replace(/\s*\(.*?\)\s*$/, '')];
    if (exact) {
      return exact;
    }
  }

  return null;
}

/* ===== Data Loading ===== */
async function loadData(){
  const board = document.getElementById('board');
  try{
    const [patchesRes, lanesRes] = await Promise.all([
      fetch('../data/updates.json'),
      fetch('../data/hero-lanes.json'),
      loadHeroCatalog('../data/heroes.json'),
    ]);
    if(!patchesRes.ok || !lanesRes.ok) throw new Error('fetch-failed');
    const patchesJson = await patchesRes.json();
    heroLanes = await lanesRes.json();
    patches = (patchesJson.patches || [])
      .sort((a,b) => Number(b.pub_timestamp) - Number(a.pub_timestamp));
    buildSelect();
    buildZones();
    openFromHash() || (patches.length && renderPatch(patches[0].id));
    window.addEventListener('hashchange', openFromHash);
  }catch(err){
    console.error(err);
    board.insertAdjacentHTML('beforeend',
      `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        background:rgba(6,12,10,.9);color:#e9ede4;font:14px Inter,sans-serif;text-align:center;padding:24px;">
        No pude cargar ../data/updates.json o ../data/hero-lanes.json.<br>
        Serví esta carpeta con un servidor local (por ej. <code>npx serve</code>) en vez de abrir el archivo directo.
      </div>`);
  }
}

function patchYear(p){
  if(p.dateLabel){
    const parts = p.dateLabel.split('/');
    const year = Number(parts[2]);
    if(Number.isFinite(year)) return year;
  }
  return new Date(Number(p.pub_timestamp) * 1000).getUTCFullYear();
}

/* ===== Patch Selector ===== */
function buildSelect(){
  const sel = document.getElementById('patch-select');
  const groups = [];
  let currentGroup = null;

  patches.forEach(p => {
    const year = patchYear(p);
    if(!currentGroup || currentGroup.year !== year){
      currentGroup = { year, items: [] };
      groups.push(currentGroup);
    }
    currentGroup.items.push(p);
  });

  sel.innerHTML = groups.map(group => `
    <optgroup label="${group.year}">
      ${group.items.map(p =>
        `<option value="${p.id}">${displayDate(p)} — ${(p.cleanTitle || p.title_es || p.title)}</option>`
      ).join('')}
    </optgroup>
  `).join('');

  sel.addEventListener('change', () => renderPatch(sel.value));
}

function openFromHash(){
  const match = location.hash.match(/^#patch-(.+)$/);
  if(!match) return false;
  const id = match[1];
  if(!patches.some(p => p.id === id)) return false;
  const sel = document.getElementById('patch-select');
  if(sel) sel.value = id;
  renderPatch(id);
  return true;
}

/* ===== Patch Rendering ===== */
function renderPatch(id){
  const patch = patches.find(p => p.id === id);
  if(!patch) return;

  currentPatchDate = displayDate(patch);

  document.getElementById('patch-meta').innerHTML = `
    <span class="date">${displayDate(patch)}</span>
    <span class="badge-cat">${patch.category.replace('_',' ')}</span>
  `;

  document.querySelectorAll('.zone').forEach(z => {
    z.classList.remove('active');
    z.classList.add('zone-empty');
    z.querySelector('[data-stack]').innerHTML = '';
  });
  closeMoreOverlay();

  const unmatched = [];
  let anyMatched = false;
  const byZone = {};

  patch.heroChanges.forEach(hc => {
    const canonicalName = normalizeName(hc.name || hc.displayName || '');
    const displayName = normalizeName(hc.displayName || hc.name || '');
    const lane = resolveHeroLaneForPatch(canonicalName) || resolveHeroLaneForPatch(displayName) || heroLanes[canonicalName] || heroLanes[displayName];
    const zoneKeys = lane && LANE_TO_ZONES[lane];
    if(!zoneKeys){
      unmatched.push(displayName || canonicalName);
      return;
    }
    anyMatched = true;
    zoneKeys.forEach(zoneKey => {
      const changesText = (hc.changesText_es && hc.changesText_es.trim()) ? hc.changesText_es : hc.changesText;
      (byZone[zoneKey] = byZone[zoneKey] || []).push({ name: canonicalName, displayName, lane, changesText });
    });
  });

  Object.entries(byZone).forEach(([zoneKey, heroes]) => {
    const zone = document.querySelector(`.zone[data-zone="${zoneKey}"]`);
    zone.classList.add('active');
    zone.classList.remove('zone-empty');
    const stack = zone.querySelector('[data-stack]');
    const max = ZONE_MAX_VISIBLE[zoneKey];

    const visible = max ? heroes.slice(0, max) : heroes;
    const hidden = max ? heroes.slice(max) : [];

    visible.forEach(h => stack.appendChild(makeHeroChip(h.displayName || h.name, h.lane, h.changesText)));

    if(hidden.length){
      stack.appendChild(makeMoreButton(zoneKey, heroes, hidden.length));
    }
  });

  document.getElementById('empty-hint').style.display = anyMatched ? 'none' : 'block';

  const extraPanel = document.getElementById('extra-panel');
  const extraList = document.getElementById('extra-list');
  const uniqueExtra = [...new Set(unmatched)].filter(Boolean);
  if(uniqueExtra.length){
    extraList.innerHTML = uniqueExtra.map(n => `<span>${n}</span>`).join('');
    extraPanel.classList.add('show');
  }else{
    extraPanel.classList.remove('show');
  }
}

function makeHeroChip(name, lane, changesText){
  const chip = document.createElement('button');
  chip.className = 'chip';
  chip.title = name;
  chip.setAttribute('aria-label', name);

  const label = document.createElement('span');
  label.className = 'chip-name';
  label.textContent = name;

  const activateChip = () => {
    const stack = chip.closest('.chip-stack');
    if(!stack) return;
    stack.querySelectorAll('.chip.is-active').forEach(node => {
      if(node !== chip) node.classList.remove('is-active');
    });
    chip.classList.add('is-active');
  };

  chip.appendChild(makeAvatarEl(name, 'chip-avatar'));
  chip.appendChild(label);
  chip.addEventListener('mouseenter', activateChip);
  chip.addEventListener('focus', activateChip);
  chip.addEventListener('mouseleave', () => chip.classList.remove('is-active'));
  chip.addEventListener('blur', () => chip.classList.remove('is-active'));
  chip.addEventListener('click', () => {
    activateChip();
    openModal(name, lane, changesText, chip);
  });
  return chip;
}

/* ===== Change Text Formatting ===== */
const RE_SKILL_HEAD = /^(Skill\s*\d*|Habilidad\s*\d*|Passive|Pasiva|Ultimate|Definitivo|Definitiva)\s*[:\-]/i;
const RE_BEFORE = /^(Before|Antes):\s*(.*)$/i;
const RE_NOW = /^(Now|Ahora):\s*(.*)$/i;
const RE_ARROW_CHANGE = /^(.+?):\s*(.*?)\s*→\s*(.+)$/;
const RE_WRAP_CHARS = /^[【『"\[]+|[】』"\]]+$/g;

function statusTone(label){
  if(/aumentad[oa].*enfriamiento.*reducid[oa].*daño/i.test(label)) return 'bad';
  if(/buffed|strengthened|upgraded|potenciad|potenciado|mejorad|mejora|aumentad/i.test(label)) return 'good';
  if(/nerfed|weakened|reduced|debilita|reducid|nerfe/i.test(label)) return 'bad';
  if(/calidad de vida|quality of life/i.test(label)) return 'qol';
  return 'neutral';
}

function statusLabel(label){
  if(/aumentad[oa].*enfriamiento.*reducid[oa].*daño/i.test(label)) return 'Atributos debilitados';
  return label;
}

function renderChangesBody(container, text){
  container.innerHTML = '';
  const rawLines = (text || '').split('\n');
  let gap = false;
  let any = false;
  let i = 0;
  let headlineDone = false;

  const withGap = (el) => { if(gap) el.classList.add('change-gap'); gap = false; any = true; return el; };

  while(i < rawLines.length){
    const line = rawLines[i].trim();
    if(line === ''){ gap = true; i++; continue; }

    if(!headlineDone){
      headlineDone = true;
      const clean = line.replace(RE_WRAP_CHARS, '').trim();
      const badge = document.createElement('span');
      badge.className = `status-badge tone-${statusTone(clean)}`;
      const label = statusLabel(clean);
      badge.textContent = label;
      container.appendChild(withGap(badge));
      if(label !== clean){
        const summary = document.createElement('div');
        summary.className = 'change-plain';
        summary.textContent = clean;
        container.appendChild(withGap(summary));
      }
      i++;
      continue;
    }

    const nextLine = rawLines[i+1] !== undefined ? rawLines[i+1].trim() : '';
    const beforeMatch = line.match(RE_BEFORE);
    const nowMatchNext = nextLine.match(RE_NOW);

    if(beforeMatch && nowMatchNext){
      container.appendChild(withGap(makeDiffPair(beforeMatch[2], nowMatchNext[2])));
      i += 2;
      continue;
    }

    const nowAlone = line.match(RE_NOW);
    if(beforeMatch || nowAlone){
      container.appendChild(withGap(makeDiffPair(
        beforeMatch ? beforeMatch[2] : null,
        nowAlone ? nowAlone[2] : null
      )));
      i++;
      continue;
    }

    const arrowChange = line.match(RE_ARROW_CHANGE);
    if(arrowChange){
      const heading = document.createElement('div');
      heading.className = 'skill-heading';
      heading.textContent = `${arrowChange[1].trim()}:`;
      container.appendChild(withGap(heading));

      makeSeparateDiffRows(
        arrowChange[2].trim(),
        arrowChange[3].trim()
      ).forEach((row) => {
        container.appendChild(withGap(row));
      });
      i++;
      continue;
    }

    if(RE_SKILL_HEAD.test(line)){
      const h = document.createElement('div');
      h.className = 'skill-heading';
      h.textContent = line;
      container.appendChild(withGap(h));
    } else if(/:$/.test(line)){
      const lbl = document.createElement('div');
      lbl.className = 'stat-label';
      lbl.textContent = line;
      container.appendChild(withGap(lbl));
    } else {
      const p = document.createElement('div');
      p.className = 'change-plain';
      p.textContent = line;
      container.appendChild(withGap(p));
    }
    i++;
  }

  if(!any){
    const p = document.createElement('div');
    p.className = 'change-plain';
    p.textContent = '(sin detalle)';
    container.appendChild(p);
  }
}

function capitalizeFirst(text){
  if(text === null || text === undefined) return text;
  const str = String(text);
  const match = str.match(/^(\s*)([a-zA-ZÀ-ÖØ-öø-ÿ])/);
  if(!match) return str;
  const idx = match[1].length;
  return str.slice(0, idx) + str[idx].toUpperCase() + str.slice(idx + 1);
}

function makeDiffPair(beforeText, nowText){
  const wrap = document.createElement('div');
  wrap.className = 'diff-pair';

  if(beforeText !== null && beforeText !== undefined){
    const row = document.createElement('div');
    row.className = 'diff-row diff-before';
    const tag = document.createElement('span');
    tag.className = 'diff-tag';
    tag.textContent = 'Antes';
    const val = document.createElement('span');
    val.className = 'diff-val';
    val.textContent = capitalizeFirst(beforeText);
    row.appendChild(tag);
    row.appendChild(val);
    wrap.appendChild(row);
  }

  if(nowText !== null && nowText !== undefined){
    const row = document.createElement('div');
    row.className = 'diff-row diff-now';
    const tag = document.createElement('span');
    tag.className = 'diff-tag';
    tag.textContent = 'Ahora';
    const val = document.createElement('span');
    val.className = 'diff-val';
    val.textContent = capitalizeFirst(nowText);
    row.appendChild(tag);
    row.appendChild(val);
    wrap.appendChild(row);
  }

  return wrap;
}

function makeSeparateDiffRows(beforeText, nowText){
  const rows = [];

  if(beforeText !== null && beforeText !== undefined){
    const row = document.createElement('div');
    row.className = 'diff-row diff-block diff-before';
    row.innerHTML = `<span class="diff-tag">Antes</span><span class="diff-val"></span>`;
    row.querySelector('.diff-val').textContent = capitalizeFirst(beforeText);
    rows.push(row);
  }

  if(nowText !== null && nowText !== undefined){
    const row = document.createElement('div');
    row.className = 'diff-row diff-block diff-now';
    row.innerHTML = `<span class="diff-tag">Ahora</span><span class="diff-val"></span>`;
    row.querySelector('.diff-val').textContent = capitalizeFirst(nowText);
    rows.push(row);
  }

  return rows;
}

/* ===== More Overlay ===== */
function openMoreOverlay(zoneKey, allHeroesInZone, originEl){
  const overlay = document.getElementById('more-overlay');
  const card = document.getElementById('more-card');

  document.getElementById('more-title').textContent = ZONE_LABEL[zoneKey];
  document.getElementById('more-count').textContent = `${allHeroesInZone.length} héroes`;

  const grid = document.getElementById('more-grid');
  grid.innerHTML = '';
  allHeroesInZone.forEach(h => {
    const row = makeHeroChip(h.displayName || h.name, h.lane, h.changesText);
    row.classList.add('chip-row');
    row.style.setProperty('--zc', `var(--c-${h.lane})`);
    row.addEventListener('click', closeMoreOverlay);
    grid.appendChild(row);
  });

  const rect = originEl.getBoundingClientRect();
  const originX = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
  const originY = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
  card.style.transformOrigin = `${originX}% ${originY}%`;

  overlay.classList.add('show');
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));
}

function closeMoreOverlay(){
  const overlay = document.getElementById('more-overlay');
  overlay.classList.remove('open');
  overlay.classList.remove('show');
}

function makeMoreButton(zoneKey, allHeroesInZone, hiddenCount){
  const btn = document.createElement('button');
  btn.className = 'chip chip-more';
  btn.style.setProperty('--zc', `var(--c-${allHeroesInZone[0].lane})`);
  btn.textContent = `Ver más… (${hiddenCount})`;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openMoreOverlay(zoneKey, allHeroesInZone, btn);
  });
  return btn;
}

document.getElementById('more-overlay').addEventListener('click', (e) => {
  if(e.target.id === 'more-overlay') closeMoreOverlay();
});

/* ===== Detail Modal ===== */
function openModal(name, lane, text, originEl){
  const overlay = document.getElementById('overlay');
  const modal = document.getElementById('modal');

  const avatarSlot = document.getElementById('modal-avatar-slot');
  avatarSlot.innerHTML = '';
  avatarSlot.appendChild(makeAvatarEl(name, 'modal-avatar'));

  document.getElementById('modal-title').textContent = name;
  document.getElementById('modal-lane').textContent = LANE_LABEL[lane];
  document.getElementById('modal-date').textContent = currentPatchDate;
  renderChangesBody(document.getElementById('modal-text'), text);

  const rect = originEl.getBoundingClientRect();
  const originX = ((rect.left + rect.width / 2) / window.innerWidth) * 100;
  const originY = ((rect.top + rect.height / 2) / window.innerHeight) * 100;
  modal.style.transformOrigin = `${originX}% ${originY}%`;

  overlay.classList.add('show');
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('open')));
}

function closeDetailModal(){
  const overlay = document.getElementById('overlay');
  overlay.classList.remove('open');
  overlay.classList.remove('show');
}

document.getElementById('modal-close').addEventListener('click', closeDetailModal);
document.getElementById('overlay').addEventListener('click', (e) => {
  if(e.target.id === 'overlay') closeDetailModal();
});
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape'){
    closeDetailModal();
    closeMoreOverlay();
  }
});

loadData();
