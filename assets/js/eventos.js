// js/eventos.js
// Lógica de eventos.html. Requiere que js/common.js esté cargado antes.
// Dos modos en la misma página:
//  - Lista: tarjetas compactas para explorar (sin carrusel completo).
//  - Detalle: página dedicada de un solo torneo/evento (#evento-<id>), con
//    su propio carrusel, título grande, etc. Se cambia sin recargar, solo
//    escuchando hashchange.

const CAROUSEL_INTERVAL_MS = 3000;
const CAROUSEL_HOLD_MS = 15000; // pausa larga tras navegar manualmente con las flechas

let ALL_EVENTS = [];
let EVENTS_BY_ID = {};

function resolveEventAsset(path) {
  if (!path || /^(https?:|data:|\/)/i.test(path)) return path;
  if (window.location.pathname.includes('/htmls/') && path.startsWith('assets/')) {
    return `../${path}`;
  }
  return path;
}

function statusLabel(status) {
  if (status === 'live') return '<span class="live-dot"></span> En vivo';
  if (status === 'finished') return 'Finalizado';
  return 'Próximamente';
}

function typeLabel(type) {
  return type === 'evento' ? 'Evento' : 'Torneo';
}

function formatRange(start, end) {
  const opts = { day: '2-digit', month: 'short', year: 'numeric' };
  const s = new Date(start + 'T00:00:00').toLocaleDateString('es-AR', opts);
  const e = new Date(end + 'T00:00:00').toLocaleDateString('es-AR', opts);
  return `${s} — ${e}`;
}

function buildDetailsRows(ev) {
  return (ev.details || []).map((d) => `
    <div class="event-detail-row"><span class="event-detail-label">${d.label}</span><span class="event-detail-value">${d.value}</span></div>
  `).join('');
}

function buildLinks(ev) {
  return (ev.links || []).map((l) => `
    <a class="event-link" href="${l.url}" target="_blank" rel="noopener">${l.label} →</a>
  `).join('');
}

function buildCarousel(ev, images) {
  if (images.length === 0) return '';
  const slides = images.map((src, i) => `
    <img src="${resolveEventAsset(src)}" class="event-slide ${i === 0 ? 'active' : ''}" alt="${ev.title}" loading="lazy">
  `).join('');
  const dots = images.length > 1 ? `
    <div class="event-dots">${images.map((_, i) => `<span class="event-dot ${i === 0 ? 'active' : ''}"></span>`).join('')}</div>
  ` : '';
  const arrows = images.length > 1 ? `
    <button type="button" class="event-arrow prev" aria-label="Imagen anterior">‹</button>
    <button type="button" class="event-arrow next" aria-label="Imagen siguiente">›</button>
  ` : '';
  return `<div class="event-carousel">${slides}${arrows}${dots}</div>`;
}

// ---------- Modo lista (tarjetas compactas para explorar) ----------

function renderList(events) {
  const grid = document.getElementById('events-grid');
  const detail = document.getElementById('event-detail');
  detail.style.display = 'none';
  detail.innerHTML = '';
  grid.style.display = '';

  if (events.length === 0) {
    grid.innerHTML = '<div class="empty-state">No hay torneos ni eventos cargados por el momento.</div>';
    return;
  }

  grid.innerHTML = events.map((ev) => {
    const cover = ev.logo || (ev.images && ev.images[0]) || null;
    return `
      <a class="event-preview-card" href="#evento-${ev.id}">
        ${cover ? `<div class="event-preview-cover"><img src="${resolveEventAsset(cover)}" alt="${ev.title}" loading="lazy"></div>` : ''}
        <div class="event-preview-body">
          <div class="event-badges">
            <span class="event-badge status-${ev.status}">${statusLabel(ev.status)}</span>
            <span class="event-badge type-${ev.type || 'torneo'}">${typeLabel(ev.type)}</span>
          </div>
          <div class="event-title">${ev.title}</div>
          ${ev.start && ev.end ? `<div class="event-dates">${formatRange(ev.start, ev.end)}</div>` : ''}
          ${ev.tagline ? `<p class="event-tagline">${ev.tagline}</p>` : ''}
          <span class="event-preview-cta">Ver página completa →</span>
        </div>
      </a>
    `;
  }).join('');
}

// ---------- Modo detalle (página dedicada de un solo evento) ----------

function renderDetail(ev) {
  const grid = document.getElementById('events-grid');
  const detail = document.getElementById('event-detail');
  grid.style.display = 'none';

  const images = ev.images && ev.images.length > 0 ? ev.images : [];

  detail.innerHTML = `
    <a class="back-link" href="eventos.html">← Volver a Torneos y Eventos</a>
    <div class="detail-badges">
      <span class="event-badge status-${ev.status}">${statusLabel(ev.status)}</span>
      <span class="event-badge type-${ev.type || 'torneo'}">${typeLabel(ev.type)}</span>
    </div>
    <h1 class="detail-title">${ev.title}</h1>
    ${ev.start && ev.end ? `<div class="detail-dates">${formatRange(ev.start, ev.end)}</div>` : ''}
    ${buildCarousel(ev, images)}
    ${ev.tagline ? `<p class="detail-tagline">${ev.tagline}</p>` : ''}
    ${buildDetailsRows(ev) ? `<div class="ember-divider"><span>◆</span></div><div class="event-details detail-details">${buildDetailsRows(ev)}</div>` : ''}
    ${buildLinks(ev) ? `<div class="event-links detail-links">${buildLinks(ev)}</div>` : ''}
  `;
  detail.style.display = '';
  window.scrollTo({ top: 0, behavior: 'auto' });
  startCarousels(detail);
}

function startCarousels(scope) {
  scope.querySelectorAll('.event-carousel').forEach((carousel) => {
    const slides = carousel.querySelectorAll('.event-slide');
    const dots = carousel.querySelectorAll('.event-dot');
    if (slides.length <= 1) return;

    let current = 0;
    let timer = null;

    function goTo(index) {
      slides[current].classList.remove('active');
      if (dots[current]) dots[current].classList.remove('active');
      current = (index + slides.length) % slides.length;
      slides[current].classList.add('active');
      if (dots[current]) dots[current].classList.add('active');
    }

    function schedule(delay) {
      clearTimeout(timer);
      timer = setTimeout(() => {
        goTo(current + 1);
        schedule(CAROUSEL_INTERVAL_MS);
      }, delay);
    }

    function manualNav(index) {
      goTo(index);
      schedule(CAROUSEL_HOLD_MS);
    }

    const prevBtn = carousel.querySelector('.event-arrow.prev');
    const nextBtn = carousel.querySelector('.event-arrow.next');
    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); manualNav(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); manualNav(current + 1); });

    schedule(CAROUSEL_INTERVAL_MS);
  });
}

function route() {
  const match = location.hash.match(/^#evento-(.+)$/);
  if (match && EVENTS_BY_ID[match[1]]) {
    renderDetail(EVENTS_BY_ID[match[1]]);
  } else {
    renderList(ALL_EVENTS);
  }
}

window.addEventListener('hashchange', route);

async function init() {
  const statusEl = document.getElementById('status');
  try {
    const events = await loadEvents();
    const order = { live: 0, upcoming: 1 };
    events.sort((a, b) => (order[a.status] ?? 2) - (order[b.status] ?? 2));

    ALL_EVENTS = events;
    EVENTS_BY_ID = {};
    events.forEach((ev) => { EVENTS_BY_ID[ev.id] = ev; });

    if (statusEl) statusEl.style.display = 'none';
    route();
  } catch (err) {
    if (statusEl) {
      statusEl.style.display = '';
      statusEl.textContent = 'Error al cargar events.json: ' + err.message;
    }
    console.error(err);
  }
}

init();