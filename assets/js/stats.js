// js/stats.js
// Estadísticas de héroes + buscador + resumen del último patch, para index.html.
// Requiere que js/common.js esté cargado antes.

const RANKING_PATCH_WINDOW = 10; // "más tocados" = últimos N patches con heroChanges
const HERO_SEARCH_ALIASES = {
  loong: "ao'yin",
  long: "ao'yin",
  saker: 'sakeer',
  'wang zhaojun': 'princess frost',
  'wazhao jun': 'princess frost',
  wazhao: 'princess frost'
};

const UPDATE_CATEGORY_COLORS = {
  server_update: '#4ade80',
  version_update: '#60a5fa',
  test_server: '#c084fc',
  anti_cheat: '#facc15',
  crackdown: '#fb7185',
  new_patch: '#f97316',
  other: '#94a3b8'
};

function updateCategory(patch) {
  return patch.category && UPDATE_CATEGORY_COLORS[patch.category]
    ? patch.category
    : 'other';
}

function renderUpdatesCalendar(patches) {
  const calendar = document.getElementById('updates-calendar');
  if (!calendar) return;

  const updatesByDay = new Map();
  patches.forEach((patch) => {
    const date = new Date(Number(patch.pub_timestamp) * 1000);
    const key = date.toISOString().slice(0, 10);
    if (!updatesByDay.has(key)) updatesByDay.set(key, []);
    updatesByDay.get(key).push(patch);
  });

  if (!updatesByDay.size) {
    calendar.innerHTML = '<p class="empty-row">Todavía no hay actualizaciones registradas.</p>';
    return;
  }

  const years = [...new Set([...updatesByDay.keys()].map((key) => Number(key.slice(0, 4))))].sort();
  const yearGraphs = years.map((year) => {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year, 11, 31));
    const firstSunday = new Date(start);
    firstSunday.setUTCDate(firstSunday.getUTCDate() - firstSunday.getUTCDay());
    const lastSaturday = new Date(end);
    lastSaturday.setUTCDate(lastSaturday.getUTCDate() + (6 - lastSaturday.getUTCDay()));
    const totalDays = Math.round((lastSaturday - firstSunday) / 86400000) + 1;
    const weekCount = Math.ceil(totalDays / 7);
    const monthLabels = [];
    for (let week = 0; week < weekCount; week += 1) {
      const date = new Date(firstSunday);
      date.setUTCDate(date.getUTCDate() + week * 7);
      const previousWeek = new Date(date);
      previousWeek.setUTCDate(previousWeek.getUTCDate() - 7);
      if (
        date.getUTCFullYear() === year
        && date.getUTCMonth() !== previousWeek.getUTCMonth()
      ) {
        monthLabels.push(`<span style="grid-column:${week + 1}">${date.toLocaleDateString('es-AR', { month: 'short', timeZone: 'UTC' })}</span>`);
      }
    }

    const weeks = Array.from({ length: weekCount }, (_, week) => {
      const cells = Array.from({ length: 7 }, (_, day) => {
        const date = new Date(firstSunday);
        date.setUTCDate(date.getUTCDate() + week * 7 + day);
        const key = date.toISOString().slice(0, 10);
        const entries = updatesByDay.get(key) || [];
        const categories = [...new Set(entries.map(updateCategory))];
        const angle = categories.length ? 360 / categories.length : 0;
        const background = !categories.length
          ? 'var(--calendar-empty)'
          : categories.length === 1
            ? UPDATE_CATEGORY_COLORS[categories[0]]
            : `conic-gradient(${categories.map((category, index) => {
              const startAngle = Math.round(index * angle);
              const endAngle = Math.round((index + 1) * angle);
              return `${UPDATE_CATEGORY_COLORS[category]} ${startAngle}deg ${endAngle}deg`;
            }).join(', ')})`;
        const isOutsideYear = date.getUTCFullYear() !== year;
        return `
          <button class="update-day${isOutsideYear ? ' is-outside-year' : ''}" type="button"
            data-day="${key}" style="--day-color:${background}"
            aria-label="${key}: ${entries.length ? `${entries.length} actualización${entries.length === 1 ? '' : 'es'}` : 'sin actualizaciones'}"
            ${entries.length ? '' : 'disabled'}>
            <span aria-hidden="true"></span>
          </button>
        `;
      }).join('');
      return `<div class="update-week">${cells}</div>`;
    }).join('');

    return `
      <section class="calendar-year">
        <h3>${year}</h3>
        <div class="calendar-month-labels">${monthLabels.join('')}</div>
        <div class="calendar-weekday-labels"><span>Dom</span><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span></div>
        <div class="updates-calendar-graph">${weeks}</div>
      </section>
    `;
  }).join('');

  const legendCategories = [...new Set([...updatesByDay.values()].flatMap((entries) => entries.map(updateCategory)))];
  const legend = legendCategories.map((category) => `
    <span class="calendar-legend-item">
      <span class="calendar-legend-dot" style="--legend-color:${UPDATE_CATEGORY_COLORS[category]}" aria-hidden="true"></span>
      ${categoryLabel(category)}
    </span>
  `).join('');

  calendar.innerHTML = `
    <div class="updates-calendar-years">${yearGraphs}</div>
    <div class="calendar-legend">${legend}</div>
    <div class="calendar-selection" id="calendar-selection" hidden></div>
  `;

  calendar.querySelectorAll('.update-day:not(:disabled)').forEach((button) => {
    button.addEventListener('click', () => {
      const entries = updatesByDay.get(button.dataset.day) || [];
      const selection = document.getElementById('calendar-selection');
      if (!selection) return;

      if (entries.length === 1) {
        window.location.href = `htmls/actualizacion.html#patch-${entries[0].id}`;
        return;
      }

      selection.hidden = false;
      selection.innerHTML = `
        <label for="calendar-entry-select">Actualizaciones del ${button.dataset.day}</label>
        <select id="calendar-entry-select">
          <option value="">Elegí una actualización...</option>
          ${entries.map((entry) => `
            <option value="${entry.id}">${entry.title_es || entry.title}</option>
          `).join('')}
        </select>
      `;
      selection.querySelector('select').addEventListener('change', (event) => {
        if (event.target.value) window.location.href = `htmls/actualizacion.html#patch-${event.target.value}`;
      });
      selection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}

function normalizeHeroSearchName(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function heroSearchVariants(name) {
  const normalized = normalizeHeroSearchName(name);
  const compact = normalized.replace(/[^a-z0-9]/g, '');
  const variants = new Set([normalized, compact]);

  Object.entries(HERO_SEARCH_ALIASES).forEach(([alias, target]) => {
    if (normalizeHeroSearchName(target) === normalized) variants.add(alias);
  });

  for (let index = 0; index < compact.length; index += 1) {
    variants.add(compact.slice(0, index) + compact.slice(index + 1));
    if (index < compact.length - 1 && compact[index] !== compact[index + 1]) {
      variants.add(
        compact.slice(0, index)
        + compact[index + 1]
        + compact[index]
        + compact.slice(index + 2)
      );
    }
  }

  return [...variants];
}

function buildHeroIndex(patches) {
  // name -> [{ patch, category }]
  const index = {};
  patches.forEach((patch) => {
    (patch.heroChanges || []).forEach((hero) => {
      const category = classifyHero(hero.changesText);
      const nameKey = hero.displayName || hero.name;
      if (!index[nameKey]) index[nameKey] = [];
      index[nameKey].push({ patch, category, hero });
    });
  });
  return index;
}

function renderQuickStats(patches, announcements) {
  const total = announcements.length;
  const patchCount = announcements.filter((announcement) => (
    announcement.heroChanges && announcement.heroChanges.length > 0
  )).length;
  const otherCount = total - patchCount;

  const heroIndex = buildHeroIndex(patches);
  const heroesTouched = Object.keys(heroIndex).length;

  const el = document.getElementById('quick-stats');
  if (!el) return;
  el.innerHTML = `
    <div class="stat-box"><span class="stat-num">${total}</span><span class="stat-label">Anuncios trackeados</span></div>
    <div class="stat-box"><span class="stat-num">${patchCount}</span><span class="stat-label">Parches de balance</span></div>
    <div class="stat-box"><span class="stat-num">${otherCount}</span><span class="stat-label">Otros anuncios</span></div>
    <div class="stat-box"><span class="stat-num">${heroesTouched}</span><span class="stat-label">Héroes con historial</span></div>
  `;
}

function renderTopHeroes(patches) {
  const patchesWithHeroes = patches.filter((p) => (p.heroChanges || []).length > 0);
  const recentPatches = patchesWithHeroes.slice(0, RANKING_PATCH_WINDOW);
  const heroIndex = buildHeroIndex(recentPatches);

  const ranking = Object.entries(heroIndex)
    .map(([name, appearances]) => ({
      name,
      count: appearances.length,
      buffs: appearances.filter((a) => a.category === 'buff').length,
      nerfs: appearances.filter((a) => a.category === 'nerf').length,
      adjusted: appearances.filter((a) => a.category === 'adjusted').length,
      lastPatch: appearances[0].patch,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const list = document.getElementById('top-heroes-list');
  if (!list) return;
  list.innerHTML = '';

  if (ranking.length === 0) {
    list.innerHTML = '<li class="empty-row">Todavía no hay suficiente historial.</li>';
    return;
  }

  ranking.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'hero-rank-item';
    li.innerHTML = `
      <span class="hero-rank-name">${entry.name}</span>
      <span class="hero-rank-tags">
        ${entry.buffs ? `<span class="mini-badge buff">${entry.buffs} potenciado${entry.buffs === 1 ? '' : 's'}</span>` : ''}
        ${entry.nerfs ? `<span class="mini-badge nerf">${entry.nerfs} reducido${entry.nerfs === 1 ? '' : 's'}</span>` : ''}
        ${entry.adjusted ? `<span class="mini-badge adjusted">${entry.adjusted} ajuste${entry.adjusted === 1 ? '' : 's'}</span>` : ''}
      </span>
      <span class="hero-rank-count">${entry.count}×</span>
    `;
    li.onclick = () => { window.location.href = `htmls/mapa.html#patch-${entry.lastPatch.id}`; };
    list.appendChild(li);
  });
}

function renderLatestSummary(patches) {
  const el = document.getElementById('latest-summary');
  if (!el) return;
  const latest = patches.find((p) => (p.heroChanges || []).length > 0) || patches[0];
  if (!latest) { el.style.display = 'none'; return; }

  const heroes = latest.heroChanges || [];
  const buffs = heroes.filter((h) => classifyHero(h.changesText) === 'buff');
  const nerfs = heroes.filter((h) => classifyHero(h.changesText) === 'nerf');
  const adjusted = heroes.filter((h) => classifyHero(h.changesText) === 'adjusted');

  const heroRows = heroes.map((hero) => {
    const category = classifyHero(hero.changesText);
    return `
      <li class="summary-hero-row">
        <span class="patch-copy">
          <span class="summary-hero-name">${hero.displayName || hero.name}</span>
          <span class="patch-summary">${summarizeHeroChanges(hero.changesText, category)}</span>
        </span>
        <span class="mini-badge ${category}">${badgeLabelSafe(category)}</span>
      </li>
    `;
  }).join('');

  el.innerHTML = `
    <div class="sec-head">
      <h2 class="sec-title">Último parche de balance</h2>
      <div class="sec-line"></div>
    </div>
    <a class="latest-card" href="htmls/mapa.html#patch-${latest.id}">
      <div class="news-date">${formatDate(latest.pub_timestamp)}</div>
      <div class="news-title">${latest.title_es || latest.title}</div>
      ${heroes.length === 0
        ? '<p class="update-note">Update general, sin cambios de héroes.</p>'
        : `<ul class="summary-hero-list">${heroRows}</ul>`
      }
    </a>
  `;
}

function renderHeroSearchResult(heroIndex, heroNames, query) {
  const resultsEl = document.getElementById('hero-search-results');
  const q = query.trim().toLowerCase();
  resultsEl.innerHTML = '';

  if (!q) return;

  let matcher;
  try {
    matcher = new RegExp(query.trim(), 'i');
  } catch {
    resultsEl.innerHTML = '<p class="empty-row">La expresión de búsqueda no es válida.</p>';
    return;
  }

  const searchableNames = [...new Set([...Object.keys(heroIndex), ...heroNames])];
  const exactAliasTarget = HERO_SEARCH_ALIASES[normalizeHeroSearchName(query.trim())];
  const matchingNames = exactAliasTarget
    ? searchableNames.filter((name) => normalizeHeroSearchName(name) === exactAliasTarget)
    : searchableNames.filter((name) => (
      heroSearchVariants(name).some((variant) => matcher.test(variant))
    ));

  if (!matchingNames.length) {
    resultsEl.innerHTML = `<p class="empty-row">Sin resultados para "${query}".</p>`;
    return;
  }

  resultsEl.innerHTML = matchingNames.map((matchName) => {
    const appearances = heroIndex[matchName] || [];
    if (!appearances.length) {
      return `
        <h3 class="hero-search-heading">${matchName}</h3>
        <p class="empty-row">No hay cambios registrados para este héroe.</p>
      `;
    }

    const rows = appearances.map(({ patch, category, hero }) => `
      <li class="patch-item" onclick="window.location.href='htmls/mapa.html#patch-${patch.id}'">
        <span class="patch-main">
          <span class="mini-badge ${category}">${badgeLabelSafe(category)}</span>
          <span class="patch-copy">
            <span class="patch-title">${patch.title_es || patch.title}</span>
            <span class="patch-summary">${summarizeHeroChanges(hero.changesText, category)}</span>
          </span>
        </span>
        <span class="patch-date">${formatDate(patch.pub_timestamp)}</span>
      </li>
    `).join('');

    return `
      <h3 class="hero-search-heading">${matchName} — ${appearances.length} cambio${appearances.length === 1 ? '' : 's'} en el historial</h3>
      <ul class="patch-list">${rows}</ul>
    `;
  }).join('');
}

function badgeLabelSafe(category) {
  if (category === 'buff') return 'Potenciado';
  if (category === 'nerf') return 'Reducido';
  return 'Ajuste';
}

function summarizeHeroChanges(changesText, category) {
  const lines = (changesText || '')
    .replace(/<[^>]*>/g, '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const ability = lines.find((line) => /^(habilidad\s+\d+|definitiva|pasiva)\s*:/i.test(line));
  if (ability) return ability.slice(0, 96);

  const summary = lines.find((line) => {
    const normalized = line.toLowerCase();
    return normalized !== lines[0].toLowerCase()
      && !/^antes:?$/i.test(line)
      && !/^ahora:?$/i.test(line)
      && !/^ajustes? en los efectos:?$/i.test(line);
  });

  return (summary || badgeLabelSafe(category)).slice(0, 96);
}

// classifyHero vivía en calendario.js (ahora eliminado). Se define acá
// también para no depender de ningún otro archivo.
function classifyHero(changesText) {
  const firstLine = (changesText || '').split('\n')[0].trim().toLowerCase();
  const hasNerf = /nerf|debilitad|debilitaci|reducid/.test(firstLine);
  const hasBuff = /buff|potenciad|mejorad|mejora|aumentad|fortalec/.test(firstLine);
  if (hasNerf && !hasBuff) return 'nerf';
  if (hasBuff && !hasNerf) return 'buff';
  return 'adjusted';
}

async function initStats() {
  try {
    const patches = await loadPatches();
    const announcements = await loadAnnouncements();
    const heroesResponse = await fetch(`${DATA_ROOT}heroes.json`, { cache: 'no-store' });
    if (!heroesResponse.ok) throw new Error(`No se pudo cargar ${DATA_ROOT}heroes.json`);
    const heroesData = await heroesResponse.json();
    const heroNames = Object.values(heroesData.heroes || {})
      .map((hero) => hero.displayName)
      .filter(Boolean);

    renderQuickStats(patches, announcements);
    renderUpdatesCalendar(announcements);
    renderTopHeroes(patches);
    renderLatestSummary(patches);

    const heroIndex = buildHeroIndex(patches);
    const input = document.getElementById('hero-search-input');
    if (input) {
      input.addEventListener('input', () => renderHeroSearchResult(heroIndex, heroNames, input.value));
    }
  } catch (err) {
    console.error('Error inicializando estadísticas:', err);
  }
}

const EVENTS_TEASER_COUNT = 5;

async function initEvents() {
  const events = await loadEvents();
  const list = document.getElementById('events-teaser-list');
  if (!list) return;

  const order = { live: 0, upcoming: 1 };
  const ordered = [...events].sort((a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2));

  if (ordered.length === 0) {
    list.innerHTML = '<li class="empty-row">No hay torneos ni eventos activos por el momento.</li>';
    return;
  }

  list.innerHTML = ordered.slice(0, EVENTS_TEASER_COUNT).map((ev) => `
    <a class="events-teaser-item" href="htmls/eventos.html#evento-${ev.id}">
      <span class="events-teaser-main">
        <span class="event-status-badge ${ev.status}">${ev.status === 'live' ? '<span class="live-dot"></span> En vivo' : ev.status === 'finished' ? 'Finalizado' : 'Próximamente'}</span>
        <span class="events-teaser-title">${ev.title}</span>
      </span>
      <span class="events-teaser-cta">Ver más →</span>
    </a>
  `).join('');
}

initStats();
initEvents();
