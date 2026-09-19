/* ===== Zones ===== */
const ZONES_DESKTOP = {
  clash:  { lane: 'clash',  x: 28.5, y: 30.8 },
  mid:    { lane: 'mid',    x: 50.5, y: 60.6 },
  farm:   { lane: 'farm',   x: 76.0, y: 98.0 },
  jungle: { lane: 'jungle', x: 38.1, y: 64.2 },
  roam:   { lane: 'roam',   x: 64.0, y: 98.0 },
};

const ZONES_MOBILE = {
  clash:  { lane: 'clash',  x: 11.5, y: 26.8 },
  mid:    { lane: 'mid',    x: 51.5, y: 57.6 },
  farm:   { lane: 'farm',   x: 76.0, y: 98.0 },
  jungle: { lane: 'jungle', x: 23.1, y: 49.2 },
  roam:   { lane: 'roam',   x: 64.0, y: 98.0 },
};

function isMobileMap(){
  return window.matchMedia('(max-width: 720px)').matches;
}

function activeZones(){
  return isMobileMap() ? ZONES_MOBILE : ZONES_DESKTOP;
}

const LANE_TO_ZONES = {
  clash: ['clash'],
  mid: ['mid'],
  farm: ['farm'],
  jungle: ['jungle'],
  roam: ['roam'],
};

const ZONE_LABEL = {
  clash: 'Clash · Top',
  mid: 'Mid',
  farm: 'Farm · Oro',
  jungle: 'Jungla',
  roam: 'Roam · Soporte',
};
const ZONE_ICON = {
  clash: 'top',
  mid: 'mid',
  farm: 'gold',
  jungle: 'jg',
  roam: 'supp',
};
const LANE_LABEL = ZONE_LABEL;

function updateZoneIconTheme(){
  const theme = document.documentElement.getAttribute('data-theme') === 'light'
    ? 'dark'
    : 'light';
  document.querySelectorAll('.zone-icon img').forEach((image) => {
    const lane = image.closest('.zone')?.dataset.lane;
    if (lane && ZONE_ICON[lane]) {
      image.src = `../assets/images/hero-lanes/${ZONE_ICON[lane]}-${theme}.png`;
    }
  });
}

const ZONE_MAX_VISIBLE = {
  clash: 2,
  jungle: 3,
  roam: 3,
  farm: 4,
  mid: 3,
};

/* ===== Hero avatars ===== */
const HERO_IMAGE_ALIAS = {
  'Dun': 'dun',
  'Xiahou Dun': 'dun',
  'Garuda Khageswara': 'garuda',
  'Gao Changgong': 'principe-de-langling',
  'Wang Zhaojun': 'princess-frost',
  'Príncipe de Lanling': 'principe-de-langling',
  'Princess Frost': 'princess-frost',
  'La Voz del Flujo': 'flowborn-tank',
  'La Voz del Flujo (Tanque)': 'flowborn-tank',
  'La Voz del Flujo (Tirador)': 'flowborn-marksman',
  'La Voz del Flujo (Carry)': 'flowborn-marksman',
  'La Voz del Flujo (Mago)': 'flowborn-mage',
  'La Voz del Flujo (Mage)': 'flowborn-mage',
  'La Voz del Flujo (Soporte)': 'flowborn-tank',
  'La Voz del Flujo (Asesino)': 'flowborn-tank',
};

function normalizeHeroImageKey(name) {
  return String(name || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function heroSlug(name){
  const tag = typeof heroTag === 'function' ? heroTag(name) : '';
  if (REDWEB_FLOWBORN.imageByTag[tag]) return REDWEB_FLOWBORN.imageByTag[tag];
  const normalizedKey = normalizeHeroImageKey(name);
  const aliasMap = Object.fromEntries(
    Object.entries(HERO_IMAGE_ALIAS).map(([key, value]) => [normalizeHeroImageKey(key), value])
  );
  if(aliasMap[normalizedKey]) return aliasMap[normalizedKey];
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function heroInitials(name){
  return name.split(/\s+/).filter(Boolean).slice(0,2).map(w => w[0]).join('').toUpperCase();
}

function makeAvatarEl(name, className){
  const avatar = document.createElement('img');
  avatar.className = className;
  avatar.src = `../assets/images/heroes/${heroSlug(name)}.jpg`;
  avatar.alt = '';
  avatar.loading = 'lazy';
  avatar.addEventListener('error', () => {
    const fallback = document.createElement('span');
    fallback.className = `${className} chip-avatar-fallback`;
    fallback.textContent = heroInitials(name);
    avatar.replaceWith(fallback);
  }, { once: true });
  return avatar;
}

function updateMobileChipCollisions(){
  const mobile = window.matchMedia(
    '(max-width: 768px), (max-width: 900px) and (max-height: 500px)'
  ).matches;
  const chips = [...document.querySelectorAll('.chip:not(.chip-more)')];
  chips.forEach(chip => chip.classList.remove('chip-icon-only'));
  if(!mobile || chips.length < 2) return;

  const colliding = new Set();
  for(let i = 0; i < chips.length; i += 1){
    const firstRect = chips[i].getBoundingClientRect();
    for(let j = i + 1; j < chips.length; j += 1){
      const secondRect = chips[j].getBoundingClientRect();
      const intersects = firstRect.left < secondRect.right
        && firstRect.right > secondRect.left
        && firstRect.top < secondRect.bottom
        && firstRect.bottom > secondRect.top;
      if(!intersects) continue;

      const firstName = chips[i].querySelector('.chip-name')?.textContent || '';
      const secondName = chips[j].querySelector('.chip-name')?.textContent || '';
      if(firstName.length > secondName.length) colliding.add(chips[i]);
      if(secondName.length > firstName.length) colliding.add(chips[j]);
    }
  }

  colliding.forEach(chip => chip.classList.add('chip-icon-only'));
}

/* ===== Zone creation ===== */
function buildZones(){
  const board = document.getElementById('board');
  Object.entries(activeZones()).forEach(([zoneKey, z]) => {
    const el = document.createElement('div');
    el.className = 'zone zone-empty';
    el.dataset.zone = zoneKey;
    el.dataset.lane = z.lane;
    el.dataset.x = z.x;
    el.dataset.y = z.y;
    el.style.setProperty('--zc', `var(--c-${z.lane})`);
    el.innerHTML = `
      <div class="zone-inner">
        <div class="chip-stack" data-stack></div>
        <div class="zone-stem"></div>
        <div class="zone-pin" aria-label="${ZONE_LABEL[zoneKey]}" title="${ZONE_LABEL[zoneKey]}">
          <span class="zone-icon" aria-hidden="true">
            <img src="../assets/images/hero-lanes/${ZONE_ICON[zoneKey]}-light.png" alt="">
          </span>
          <span class="zone-label">${ZONE_LABEL[zoneKey]}</span>
        </div>
      </div>
    `;
    board.appendChild(el);
  });
  updateZoneIconTheme();
  if(window.__updateZonePositions) window.__updateZonePositions();
}

function updateZoneCoordinates(){
  const zones = activeZones();
  Object.entries(zones).forEach(([zoneKey, zone]) => {
    const element = document.querySelector(`.zone[data-zone="${zoneKey}"]`);
    if (!element) return;
    element.dataset.x = zone.x;
    element.dataset.y = zone.y;
  });
  window.__updateZonePositions?.();
}

/* ===== Map interaction ===== */
const MIN_SCALE = 1;
const MAX_SCALE_CAP = 6;
const CULL_MARGIN = 220;

function setupMapInteraction(){
  const board = document.getElementById('board');
  const inner = document.getElementById('board-inner');
  const mapImg = inner ? inner.querySelector('img') : null;
  if(!board || !inner) return;

  let scale = 1, tx = 0, ty = 0;
  let raf = null;
  let MAX_SCALE = 4.5;

  function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }

  function applyScaleBounds(nextScale){
    return Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
  }

  function recomputeMaxScale(){
    if(!mapImg || !mapImg.naturalWidth || !mapImg.naturalHeight) return;
    const w = board.clientWidth, h = board.clientHeight;
    if(!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    const nativeRatio = Math.min(
      mapImg.naturalWidth / (w * dpr),
      mapImg.naturalHeight / (h * dpr)
    );
    MAX_SCALE = clamp(nativeRatio, MIN_SCALE, MAX_SCALE_CAP);
    scale = clamp(scale, MIN_SCALE, MAX_SCALE);
  }

  if(mapImg){
    if(mapImg.complete && mapImg.naturalWidth){
      recomputeMaxScale();
    } else {
      mapImg.addEventListener('load', recomputeMaxScale, { once:true });
    }
  }

  const resizeObserver = 'ResizeObserver' in window
    ? new ResizeObserver(() => {
      recomputeMaxScale();
      clampPan();
      scheduleApply();
    })
    : null;
  resizeObserver?.observe(board);

  function clampPan(){
    const w = board.clientWidth, h = board.clientHeight;
    scale = applyScaleBounds(scale);

    if (scale <= 1) {
      const offsetX = (w - w * scale) / 2;
      const offsetY = (h - h * scale) / 2;
      tx = offsetX;
      ty = offsetY;
      return;
    }

    const minTx = w - w * scale, minTy = h - h * scale;
    tx = clamp(tx, minTx, 0);
    ty = clamp(ty, minTy, 0);
  }

  function scheduleApply(){
    scale = applyScaleBounds(scale);
    if(raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      scale = applyScaleBounds(scale);
      inner.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
      updateZones();
    });
  }

  function updateZones(){
    const w = board.clientWidth, h = board.clientHeight;
    document.querySelectorAll('.zone').forEach(zone => {
      const x = parseFloat(zone.dataset.x);
      const y = parseFloat(zone.dataset.y);
      const screenX = tx + (x / 100) * w * scale;
      const screenY = ty + (y / 100) * h * scale;
      zone.style.left = screenX + 'px';
      zone.style.top = screenY + 'px';
      const visible = screenX > -CULL_MARGIN && screenX < w + CULL_MARGIN &&
                       screenY > -CULL_MARGIN && screenY < h + CULL_MARGIN;
      zone.classList.toggle('zone-culled', !visible);
    });
    requestAnimationFrame(updateMobileChipCollisions);
  }
  window.__updateZonePositions = updateZones;

  function zoomAt(clientX, clientY, factor){
    const rect = board.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    const rawNextScale = scale * factor;
    const nextScale = applyScaleBounds(rawNextScale);
    if(nextScale === scale) return;
    const ratio = nextScale / scale;
    tx = offsetX - (offsetX - tx) * ratio;
    ty = offsetY - (offsetY - ty) * ratio;
    scale = nextScale;
    if (scale < MIN_SCALE) {
      scale = MIN_SCALE;
    }
    clampPan();
    scheduleApply();
  }

  function resetView(){
    scale = 1; tx = 0; ty = 0;
    scheduleApply();
  }

  /* ===== Mouse wheel ===== */
  board.addEventListener('wheel', (e) => {
    const browserZoomGesture = e.ctrlKey || e.metaKey;
    if (browserZoomGesture) {
      return;
    }
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.18 : 1/1.18;
    zoomAt(e.clientX, e.clientY, factor);
  }, { passive:false });

  /* ===== Pointer drag / pinch ===== */
  const pointers = new Map();
  let dragLast = null;
  let pinchStartDist = null;
  let pinchStartScale = null;
  let movedEnough = false;
  const DRAG_THRESHOLD = 6;

  function distanceBetween(p1, p2){
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  function midpoint(p1, p2){
    return { x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2 };
  }

  board.addEventListener('pointerdown', (e) => {
    if(e.target.closest('.zoom-controls')) return;
    pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });
    movedEnough = false;
    if(pointers.size === 1){
      dragLast = { x:e.clientX, y:e.clientY };
    } else if(pointers.size === 2){
      dragLast = null;
      const [p1, p2] = [...pointers.values()];
      pinchStartDist = distanceBetween(p1, p2);
      pinchStartScale = scale;
      board.setPointerCapture(e.pointerId);
    }
  });

  board.addEventListener('pointermove', (e) => {
    if(!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x:e.clientX, y:e.clientY });

    if(pointers.size === 2){
      const [p1, p2] = [...pointers.values()];
      const dist = distanceBetween(p1, p2);
      if(pinchStartDist){
        const factor = dist / pinchStartDist;
        const nextScale = applyScaleBounds(pinchStartScale * factor);
        if(nextScale === scale) return;
        const rect = board.getBoundingClientRect();
        const mid = midpoint(p1, p2);
        const offsetX = mid.x - rect.left, offsetY = mid.y - rect.top;
        const ratio = nextScale / scale;
        tx = offsetX - (offsetX - tx) * ratio;
        ty = offsetY - (offsetY - ty) * ratio;
        scale = nextScale;
        clampPan();
        scheduleApply();
      }
      movedEnough = true;
      return;
    }

    if(dragLast && scale > MIN_SCALE + 0.001){
      const dx = e.clientX - dragLast.x;
      const dy = e.clientY - dragLast.y;
      if(Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD || movedEnough){
        if(!movedEnough) board.setPointerCapture(e.pointerId);
        movedEnough = true;
        tx += dx; ty += dy;
        dragLast = { x:e.clientX, y:e.clientY };
        clampPan();
        board.classList.add('is-dragging');
        scheduleApply();
      }
    } else if(dragLast){
      const dx = e.clientX - dragLast.x, dy = e.clientY - dragLast.y;
      if(Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) movedEnough = true;
    }
  });

  function endPointer(e){
    pointers.delete(e.pointerId);
    if(pointers.size < 2){ pinchStartDist = null; pinchStartScale = null; }
    if(pointers.size === 0){
      dragLast = null;
      board.classList.remove('is-dragging');
    }
  }

  board.addEventListener('pointerup', endPointer);
  board.addEventListener('pointercancel', endPointer);
  board.addEventListener('pointerleave', endPointer);

  board.addEventListener('click', (e) => {
    if(movedEnough && !e.target.closest('.zoom-controls')){
      e.stopPropagation();
      e.preventDefault();
    }
    movedEnough = false;
  }, true);

  board.addEventListener('dblclick', (e) => {
    if(e.target.closest('.zoom-controls')) return;
    if(scale < MAX_SCALE - 0.001){
      zoomAt(e.clientX, e.clientY, 2);
    } else {
      resetView();
    }
  });

  /* ===== Buttons ===== */
  document.getElementById('zoom-in').addEventListener('click', () => {
    const rect = board.getBoundingClientRect();
    zoomAt(rect.left + rect.width/2, rect.top + rect.height/2, 1.4);
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    const rect = board.getBoundingClientRect();
    zoomAt(rect.left + rect.width/2, rect.top + rect.height/2, 1/1.4);
  });
  document.getElementById('zoom-reset').addEventListener('click', resetView);

  window.addEventListener('resize', () => {
    recomputeMaxScale();
    clampPan();
    scheduleApply();
  });

  updateZones();
}

setupMapInteraction();

new MutationObserver(updateZoneIconTheme).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
});

const mapMediaQuery = window.matchMedia('(max-width: 720px)');
mapMediaQuery.addEventListener?.('change', updateZoneCoordinates);
mapMediaQuery.addListener?.(updateZoneCoordinates);
