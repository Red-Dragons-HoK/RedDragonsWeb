/* ===== Data loading ===== */
const DATA_ROOT = window.location.pathname.includes('/htmls/') ? '../data/' : 'data/';
let patchesPromise;
let announcementsPromise;

async function loadPatches() {
  if (!patchesPromise) {
    patchesPromise = fetch(`${DATA_ROOT}updates.json`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`No se pudo cargar updates.json (${res.status})`);
        return res.json();
      })
      .then((data) => data.patches.sort((a, b) => Number(b.pub_timestamp) - Number(a.pub_timestamp)));
  }

  return patchesPromise;
}

async function loadAnnouncements() {
  if (!announcementsPromise) {
    announcementsPromise = fetch(`${DATA_ROOT}anuncios.json`, { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error(`No se pudo cargar anuncios.json (${res.status})`);
        return res.json();
      })
      .then((data) => (data.announcements || data.patches || []).sort(
        (a, b) => Number(b.pub_timestamp) - Number(a.pub_timestamp)
      ));
  }

  return announcementsPromise;
}

async function loadEvents() {
  try {
    const res = await fetch(`${DATA_ROOT}events.json`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch {
    return [];
  }
}

/* ===== Formatting ===== */
function formatDate(unixTimestamp) {
  const date = new Date(Number(unixTimestamp) * 1000);
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function patchType(patch) {
  return (patch.heroChanges && patch.heroChanges.length > 0) ? 'patch' : 'update';
}

function patchTypeLabel(type) {
  return type === 'patch' ? 'Parche' : 'Update';
}

const CATEGORY_LABELS = {
  server_update: 'Update de Servidor',
  version_update: 'Update de Versión',
  test_server: 'Servidor de Pruebas',
  anti_cheat: 'Anti-Cheat',
  crackdown: 'Medidas Especiales',
  new_patch: 'Nuevo Parche',
  other: 'Otro',
};

function categoryLabel(category) {
  return CATEGORY_LABELS[category] || CATEGORY_LABELS.other;
}
