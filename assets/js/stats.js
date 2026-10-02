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

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function updateCategory(patch) {
  return patch.category && UPDATE_CATEGORY_COLORS[patch.category]
    ? patch.category
    : 'other';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderUpdatesCalendar(patches) {
  const calendar = document.getElementById('updates-calendar');
  if (!calendar) return;

  const updatesByDay = new Map();
  patches.forEach((patch) => {
    const date = new Date(Number(patch.pub_timestamp) * 1000);
    const key = toDateKey(date);
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
        const key = toDateKey(date);
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

  const tooltip = document.createElement('div');
  tooltip.id = 'calendar-day-tooltip';
  tooltip.className = 'calendar-day-tooltip';
  tooltip.hidden = true;
  calendar.appendChild(tooltip);

  calendar.innerHTML = `
    <div class="updates-calendar-years">${yearGraphs}</div>
    <div class="calendar-legend">${legend}</div>
    <div class="calendar-selection" id="calendar-selection" hidden></div>
  `;
  calendar.appendChild(tooltip);

  calendar.querySelectorAll('.update-day:not(:disabled)').forEach((button) => {
    const entries = updatesByDay.get(button.dataset.day) || [];

    const showTooltip = () => {
      if (!entries.length) return;
      tooltip.innerHTML = entries.map((entry) => `
        <div class="calendar-day-tooltip-item">${escapeHtml(entry.title_es || entry.title || 'Actualización')}</div>
      `).join('');

      const calendarRect = calendar.getBoundingClientRect();
      const buttonRect = button.getBoundingClientRect();
      const left = buttonRect.left - calendarRect.left + (buttonRect.width / 2);
      const top = buttonRect.top - calendarRect.top + buttonRect.height + 12;

      tooltip.style.left = `${Math.max(12, Math.min(left, calendarRect.width - 190))}px`;
      tooltip.style.top = `${Math.max(12, top)}px`;
      tooltip.hidden = false;
    };

    const hideTooltip = () => {
      tooltip.hidden = true;
    };

    button.addEventListener('mouseenter', showTooltip);
    button.addEventListener('mouseleave', hideTooltip);
    button.addEventListener('focus', showTooltip);
    button.addEventListener('blur', hideTooltip);

    button.addEventListener('click', () => {
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
    const summary = summarizeHeroChanges(hero.changesText, category);
    return `
      <li class="summary-hero-row">
        <span class="patch-copy">
          <span class="summary-hero-name">${hero.displayName || hero.name}</span>
          <span class="patch-summary">${summary}</span>
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
    const homeData = await loadHomeData().catch(() => null);
    const patches = homeData && homeData.patches ? homeData.patches : await loadPatches();
    const announcements = homeData && homeData.announcements ? homeData.announcements : await loadAnnouncements();
    const heroIndex = buildHeroIndex(patches);
    const heroNames = Object.keys(heroIndex);

    renderQuickStats(patches, announcements);
    renderUpdatesCalendar(announcements);
    renderTopHeroes(patches);
    renderLatestSummary(patches);

    const input = document.getElementById('hero-search-input');
    if (input) {
      input.addEventListener('input', () => renderHeroSearchResult(heroIndex, heroNames, input.value));
    }
  } catch (err) {
    console.error('Error inicializando estadísticas:', err);
  }
}

function eventDateLabel(dateValue) {
  if (!dateValue) return '';
  const date = new Date(`${dateValue}T00:00:00Z`);
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function homeEventStatusLabel(event) {
  if (event.status === 'live') return '<span class="live-dot"></span> En vivo';
  if (event.status === 'postponed') return 'Aplazado';
  if (event.status === 'finished') return 'Finalizado';
  if (event.status === 'cancelled' || event.status === 'canceled') return 'Cancelado';
  return 'Próximamente';
}

function eventReferenceDate(event) {
  if (event.status === 'postponed') {
    return event.schedule?.originalStart || event.originalStart || event.start || '';
  }
  return event.start || '';
}

function eventSeasonYear(event) {
  const referenceDate = eventReferenceDate(event);
  if (!referenceDate) return String(event.year || 'Sin fecha');
  const year = new Date(`${referenceDate}T00:00:00Z`).getUTCFullYear();
  return Number.isNaN(year) ? String(event.year || 'Sin fecha') : String(year);
}

function eventDateRangeLabel(start, end) {
  if (!start) return 'Fecha por confirmar';
  const firstDate = eventDateLabel(start);
  return end && end !== start ? `${firstDate} – ${eventDateLabel(end)}` : firstDate;
}

function eventTimelineDateLabel(event) {
  const originalStart = eventReferenceDate(event);
  const originalEnd = event.status === 'postponed'
    ? event.schedule?.originalEnd || event.originalEnd || event.end
    : event.end;
  const range = eventDateRangeLabel(originalStart, originalEnd);
  return event.status === 'postponed' ? `Fecha original: ${range}` : range;
}

function eventRescheduleLabel(event) {
  const schedule = event.schedule || {};
  if (schedule.newStart) {
    return `Nueva fecha: ${eventDateRangeLabel(schedule.newStart, schedule.newEnd)}`;
  }
  if (event.rescheduledStart) {
    return `Nueva fecha: ${eventDateRangeLabel(event.rescheduledStart, event.rescheduledEnd)}`;
  }
  const windowLabel = schedule.rescheduledWindowLabel;
  return windowLabel ? `Nueva fecha: ${windowLabel}` : 'Nueva fecha por confirmar';
}

function timelineStatusLabel(status) {
  if (status === 'live') return '<span class="live-dot"></span> En curso';
  if (status === 'postponed') return 'Aplazado';
  if (status === 'cancelled' || status === 'canceled') return 'Cancelado';
  if (status === 'finished') return 'Finalizado';
  return 'Próximo';
}

function eventSeasonLabel(year) {
  const numericYear = Number(year);
  if (!Number.isFinite(numericYear)) return 'Otros eventos';
  const currentYear = new Date().getFullYear();
  if (numericYear === currentYear) return 'Temporada actual';
  return numericYear > currentYear ? 'Próxima temporada' : 'Temporada anterior';
}

function renderEventsByYear(events, container) {
  if (events.length === 0) {
    container.innerHTML = '<p class="empty-row">Todavía no hay torneos ni eventos cargados.</p>';
    return;
  }

  const eventsByYear = new Map();
  events.forEach((event) => {
    const year = eventSeasonYear(event);
    if (!eventsByYear.has(year)) eventsByYear.set(year, []);
    eventsByYear.get(year).push(event);
  });

  const years = [...eventsByYear.keys()].sort((a, b) => {
    const yearA = Number(a);
    const yearB = Number(b);
    if (!Number.isFinite(yearA)) return Number.isFinite(yearB) ? 1 : a.localeCompare(b, 'es');
    if (!Number.isFinite(yearB)) return -1;
    return yearB - yearA;
  });
  const newestYear = years.find((year) => Number.isFinite(Number(year)));
  container.innerHTML = years.map((year, yearIndex) => {
    const expanded = year === newestYear || (!newestYear && yearIndex === 0);
    const panelId = `events-season-${year.replace(/[^a-z0-9-]/gi, '-')}`;
    const yearEvents = eventsByYear.get(year).sort((a, b) => (
      eventReferenceDate(a).localeCompare(eventReferenceDate(b))
      || String(a.title).localeCompare(String(b.title), 'es')
    ));
    const eventItems = yearEvents.map((event) => {
      const status = ['live', 'upcoming', 'postponed', 'finished', 'cancelled', 'canceled'].includes(event.status)
        ? event.status
        : 'upcoming';
      const game = event.game || event.gameTitle || 'Honor of Kings';
      const newDate = status === 'postponed'
        ? `<p class="event-timeline-reschedule">${escapeHtml(eventRescheduleLabel(event))}</p>`
        : '';

      return `
        <li class="event-timeline-item status-${status}">
          <article class="event-timeline-card">
            <div class="event-timeline-meta">
              <time class="event-timeline-date" datetime="${escapeHtml(eventReferenceDate(event))}">${escapeHtml(eventTimelineDateLabel(event))}</time>
              <span class="event-status-badge ${status}">${timelineStatusLabel(status)}</span>
            </div>
            <h3 class="event-timeline-title"><a href="htmls/eventos.html#evento-${encodeURIComponent(event.id)}">${escapeHtml(event.title)}</a></h3>
            <div class="event-timeline-footer">
              <span class="event-timeline-game">${escapeHtml(game)}</span>
              <a class="event-timeline-link" href="htmls/eventos.html#evento-${encodeURIComponent(event.id)}">Ver detalles <span aria-hidden="true">→</span></a>
            </div>
            ${newDate}
          </article>
        </li>
      `;
    }).join('');

    return `
      <section class="event-season${expanded ? ' is-expanded' : ''}">
        <h3 class="event-season-heading">
          <button class="event-season-toggle" type="button" aria-expanded="${expanded}" aria-controls="${panelId}">
            <span class="event-season-title"><span class="event-season-year">${escapeHtml(year)}</span><span class="event-season-label">${eventSeasonLabel(year)}</span></span>
            <span class="event-season-count">${yearEvents.length} evento${yearEvents.length === 1 ? '' : 's'}</span>
            <span class="event-season-chevron" aria-hidden="true"></span>
          </button>
        </h3>
        <div class="event-season-panel" id="${panelId}" aria-hidden="${!expanded}">
          <div class="event-season-panel-inner" ${expanded ? '' : 'inert'}>
            <ol class="event-timeline">${eventItems}</ol>
          </div>
        </div>
      </section>
    `;
  }).join('');

  container.querySelectorAll('.event-season-toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') !== 'true';
      const season = toggle.closest('.event-season');
      const panel = document.getElementById(toggle.getAttribute('aria-controls'));
      const panelInner = panel.querySelector('.event-season-panel-inner');
      toggle.setAttribute('aria-expanded', String(expanded));
      panel.setAttribute('aria-hidden', String(!expanded));
      season.classList.toggle('is-expanded', expanded);
      if (expanded) panelInner.removeAttribute('inert');
      else panelInner.setAttribute('inert', '');
    });
  });
}

function renderFeaturedEvent(events) {
  const featured = document.getElementById('featured-event');
  if (!featured) return;

  const statusOrder = { live: 0, upcoming: 1, postponed: 2 };
  const nextEvent = events
    .filter((event) => ['live', 'upcoming', 'postponed'].includes(event.status))
    .sort((a, b) => (
      (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3)
      || Date.parse(a.start) - Date.parse(b.start)
    ))[0];

  if (!nextEvent) {
    featured.innerHTML = '<p class="empty-row">Todavía no hay próximos eventos anunciados.</p>';
    return;
  }

  const startDate = Date.parse(`${nextEvent.start}T00:00:00Z`);
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const daysUntil = Math.max(0, Math.ceil((startDate - todayUtc) / 86400000));
  const countdown = nextEvent.status === 'live'
    ? 'En vivo ahora'
    : nextEvent.status === 'postponed'
      ? `Nueva ventana: ${nextEvent.schedule?.rescheduledWindowLabel || nextEvent.schedule?.rescheduledWindow || 'por confirmar'}`
      : daysUntil === 0 ? 'Comienza hoy' : `Comienza en ${daysUntil} días`;
  const dateRange = nextEvent.end && nextEvent.end !== nextEvent.start
    ? `${eventDateLabel(nextEvent.start)} – ${eventDateLabel(nextEvent.end)}`
    : eventDateLabel(nextEvent.start);
  const dateLabel = nextEvent.status === 'postponed' ? `Fechas originales: ${dateRange}` : dateRange;

  featured.innerHTML = `
    <a class="featured-event-card" href="htmls/eventos.html#evento-${nextEvent.id}">
      <img class="featured-event-art" src="${nextEvent.images?.[0] || ''}" alt="Arte de Esports Nations Cup 2026" loading="lazy">
      <span class="featured-event-copy">
        <span class="event-status-badge ${nextEvent.status}">${homeEventStatusLabel(nextEvent)}</span>
        <strong>${nextEvent.title}</strong>
        ${nextEvent.shortDesc ? `<span class="featured-event-description">${escapeHtml(nextEvent.shortDesc)}</span>` : ''}
        <span class="featured-event-date">${dateLabel}</span>
        <span class="featured-event-countdown">${countdown}</span>
      </span>
    </a>
  `;
  featured.querySelector('.featured-event-art').addEventListener('error', (event) => {
    event.currentTarget.hidden = true;
  }, { once: true });
}

async function initEvents() {
  const events = await loadEvents();
  const container = document.getElementById('events-year-groups');
  if (!container) return;

  const ordered = [...events].sort((a, b) => eventReferenceDate(a).localeCompare(eventReferenceDate(b)));
  renderFeaturedEvent(ordered);
  renderEventsByYear(ordered, container);
}

initStats();
initEvents();
