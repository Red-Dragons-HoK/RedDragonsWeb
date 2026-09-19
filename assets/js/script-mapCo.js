const REDWEB_MAP_CO = (() => {
  const DEBUG_LANE_MARKERS = false;

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
    'La Voz del Flujo (Asesino)': 'flowborn-tank'
  };

  const HERO_IMAGE_TAG_ALIAS = {
    'la-voz-del-flujo': 'flowborn-tank',
    'la-voz-del-flujo-tanque': 'flowborn-tank',
    'la-voz-del-flujo-tirador': 'flowborn-marksman',
    'la-voz-del-flujo-carry': 'flowborn-marksman',
    'la-voz-del-flujo-mago': 'flowborn-mage',
    'la-voz-del-flujo-soporte': 'flowborn-tank',
    'la-voz-del-flujo-asesino': 'flowborn-tank'
  };

  function normalizeHeroImageKey(name) {
    return String(name || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function heroImageSlug(tag, name) {
    if (REDWEB_FLOWBORN.imageByTag[tag]) return REDWEB_FLOWBORN.imageByTag[tag];
    if (HERO_IMAGE_TAG_ALIAS[tag]) return HERO_IMAGE_TAG_ALIAS[tag];

    const raw = String(name || tag || '').trim();
    const normalizedKey = normalizeHeroImageKey(raw);
    const aliasMap = Object.fromEntries(
      Object.entries(HERO_IMAGE_ALIAS).map(([key, value]) => [normalizeHeroImageKey(key), value])
    );

    if (aliasMap[normalizedKey]) return aliasMap[normalizedKey];

    return raw
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  const LANE_MAP_POSITIONS = {
    clash:  { x: 22.0, y: 15.3 },
    jungle: { x: 32.1, y: 46.0 },
    mid:    { x: 49.5, y: 48.1 },
    roam:   { x: 64.0, y: 82.5 },
    farm:   { x: 76.0, y: 82.5 }
  };

  const LANE_MARKERS = {
    clash: { x: 22.0, y: 22.8, label: 'Top' },
    jungle: { x: 32.1, y: 53.5, label: 'Jungla' },
    mid: { x: 49.5, y: 55.6, label: 'Mid' },
    roam: { x: 64.0, y: 90.0, label: 'Soporte' },
    farm: { x: 76.0, y: 90.0, label: 'Farm/ADC' }
  };

  const LANE_SLOT_INDEX = {
    clash: 0,
    jungle: 1,
    mid: 2,
    roam: 3,
    farm: 4
  };

  const EMPTY_LANE_DROP_OFFSET = 10;

  function handleLaneDrop(event, lane, assignHeroToSlot, swapSlots) {
    event.preventDefault();
    const targetSlotIndex = LANE_SLOT_INDEX[lane];
    const sourceSlotValue = event.dataTransfer?.getData('application/x-redweb-slot-index');

    if (sourceSlotValue !== '') {
      swapSlots?.(Number(sourceSlotValue), targetSlotIndex);
      return;
    }

    const tag = event.dataTransfer?.getData('text/plain');
    if (tag) assignHeroToSlot?.(tag, targetSlotIndex);
  }

  function renderMapPins({ selectedTags, heroCatalog, toggleHero, assignHeroToSlot, swapSlots }) {
    const overlay = document.getElementById('map-hero-overlay');
    if (!overlay) return;

    overlay.innerHTML = '';

    if (DEBUG_LANE_MARKERS) {
      Object.entries(LANE_MAP_POSITIONS).forEach(([lane, position]) => {
        const debugNode = document.createElement('div');
        debugNode.className = 'map-debug-point';
        debugNode.style.left = `${position.x}%`;
        debugNode.style.top = `${position.y}%`;
        debugNode.title = `${lane.toUpperCase()} ${position.x}%, ${position.y}%`;
        debugNode.dataset.lane = lane;

        const debugLabel = document.createElement('span');
        debugLabel.className = 'map-debug-label';
        debugLabel.textContent = lane.toUpperCase();
        debugNode.appendChild(debugLabel);
        overlay.appendChild(debugNode);
      });
    }

    Object.entries(LANE_MARKERS).forEach(([lane, marker]) => {
      const markerNode = document.createElement('div');
      markerNode.className = 'map-lane-marker';
      markerNode.style.left = `${marker.x}%`;
      markerNode.style.top = `${marker.y}%`;
      markerNode.textContent = marker.label;
      markerNode.dataset.lane = lane;
      markerNode.addEventListener('dragover', (event) => {
        event.preventDefault();
        markerNode.classList.add('drag-over');
      });
      markerNode.addEventListener('dragleave', () => markerNode.classList.remove('drag-over'));
      markerNode.addEventListener('drop', (event) => {
        markerNode.classList.remove('drag-over');
        handleLaneDrop(event, lane, assignHeroToSlot, swapSlots);
      });
      overlay.appendChild(markerNode);

      if (!selectedTags[LANE_SLOT_INDEX[lane]]) {
        const approximateTarget = document.createElement('div');
        approximateTarget.className = 'map-lane-drop-approx';
        approximateTarget.style.left = `${marker.x}%`;
        approximateTarget.style.top = `${marker.y - EMPTY_LANE_DROP_OFFSET}%`;
        approximateTarget.dataset.lane = lane;
        approximateTarget.setAttribute('aria-label', `Zona aproximada para ${marker.label}`);
        approximateTarget.addEventListener('dragover', (event) => {
          event.preventDefault();
          approximateTarget.classList.add('drag-over');
        });
        approximateTarget.addEventListener('dragleave', () => approximateTarget.classList.remove('drag-over'));
        approximateTarget.addEventListener('drop', (event) => {
          approximateTarget.classList.remove('drag-over');
          handleLaneDrop(event, lane, assignHeroToSlot, swapSlots);
        });
        overlay.appendChild(approximateTarget);
      }
    });

    selectedTags.forEach((tag, slotIndex) => {
      if (!tag) return;

      const hero = heroCatalog?.heroes?.[tag];
      if (!hero) return;

      const lane = SLOT_LANE_ORDER[slotIndex] || 'mid';
      const anchor = LANE_MAP_POSITIONS[lane] || LANE_MAP_POSITIONS.mid;
      const x = anchor.x;
      const y = anchor.y;

      if (/La Voz del Flujo/i.test(hero.displayName || '')) {
        const flowbornLane = hero.lane || lane;
        const validLanes = ['clash', 'jungle', 'mid', 'roam', 'farm'];
        if (!validLanes.includes(flowbornLane)) {
          console.warn('Flowborn lane inválida:', hero.displayName, flowbornLane);
        }
      }

      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = `map-pin map-pin--${lane}`;
      pin.title = hero.displayName;
      pin.style.left = `${x}%`;
      pin.style.top = `${y}%`;
      pin.setAttribute('aria-label', `Quitar ${hero.displayName}`);
      pin.addEventListener('click', () => toggleHero?.(tag));
      pin.draggable = true;
      pin.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', tag);
        event.dataTransfer?.setData('application/x-redweb-slot-index', String(slotIndex));
        event.dataTransfer.effectAllowed = 'copyMove';
      });
      pin.addEventListener('dragover', (event) => {
        event.preventDefault();
        pin.classList.add('drag-over');
      });
      pin.addEventListener('dragleave', () => pin.classList.remove('drag-over'));
      pin.addEventListener('drop', (event) => {
        event.preventDefault();
        pin.classList.remove('drag-over');
        const sourceSlotValue = event.dataTransfer?.getData('application/x-redweb-slot-index');
        if (sourceSlotValue !== '') {
          swapSlots?.(Number(sourceSlotValue), slotIndex);
          return;
        }
        const draggedTag = event.dataTransfer?.getData('text/plain');
        if (draggedTag) assignHeroToSlot?.(draggedTag, slotIndex);
      });

      const avatar = document.createElement('img');
      avatar.className = 'map-pin__img';
      avatar.alt = hero.displayName;
      avatar.src = `../assets/images/heroes/${heroImageSlug(tag, hero.displayName)}.jpg`;
      avatar.loading = 'lazy';
      avatar.addEventListener('error', () => {
        const fallback = document.createElement('span');
        fallback.className = 'map-pin__fallback';
        fallback.textContent = (hero.displayName || tag).split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
        avatar.replaceWith(fallback);
      }, { once: true });

      pin.appendChild(avatar);
      overlay.appendChild(pin);
    });
  }

  return {
    renderMapPins
  };
})();

window.RedWebMapCo = REDWEB_MAP_CO;
