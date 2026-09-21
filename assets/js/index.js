// js/index.js
// Lógica específica de index.html. Requiere que js/common.js esté cargado antes.

const TEN_DAYS_SECONDS = 10 * 24 * 60 * 60;
const NEWS_COUNT = 6;

function setupScrollNavigation() {
  const hero = document.querySelector('.hero');
  const scrollNav = document.getElementById('scroll-nav');
  if (!hero || !scrollNav || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver(([entry]) => {
    scrollNav.classList.toggle('is-visible', !entry.isIntersecting);
  }, { threshold: 0 });

  observer.observe(hero);
}

function checkIfRecent(patch) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const age = nowSeconds - Number(patch.pub_timestamp);
  return age <= TEN_DAYS_SECONDS;
}

function renderBanner(patches) {
  if (patches.length === 0) return;
  const latest = patches[0];
  if (!checkIfRecent(latest)) return;

  const banner = document.getElementById('banner');
  banner.href = `htmls/mapa.html#patch-${latest.id}`;
  document.getElementById('banner-sub').textContent = latest.title_es || latest.title;
  banner.classList.add('show');
}

function renderNews(patches) {
  const list = document.getElementById('news-list');
  if (!list) return;

  const fragment = document.createDocumentFragment();

  patches.slice(0, NEWS_COUNT).forEach((patch) => {
    const heroCount = (patch.heroChanges || []).length;
    const meta = heroCount > 0
      ? `${heroCount} héroe${heroCount === 1 ? '' : 's'} con cambios de balance`
      : 'Sin cambios de balance de héroes';

    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'news-card';
    a.href = `htmls/mapa.html#patch-${patch.id}`;
    a.innerHTML = `
      <div class="news-date">${formatDate(patch.pub_timestamp)}</div>
      <div class="news-title">${patch.title_es || patch.title}</div>
      <div class="news-meta">${meta}</div>
    `;
    li.appendChild(a);
    fragment.appendChild(li);
  });

  list.innerHTML = '';
  list.appendChild(fragment);
}

async function init() {
  const statusEl = document.getElementById('status');
  try {
    const patches = await loadPatches();
    if (statusEl) statusEl.style.display = 'none';
    renderBanner(patches);
    renderNews(patches);
  } catch (err) {
    if (statusEl) {
      statusEl.style.display = '';
      statusEl.textContent = 'Error al cargar updates.json: ' + err.message;
    }
    console.error(err);
  }
}

setupScrollNavigation();
init();
