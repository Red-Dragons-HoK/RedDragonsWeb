const STAT_META = {
  earlyPush: 'Empuje early',
  midPush: 'Empuje mid',
  latePush: 'Empuje late',
  damageContinuous: 'Daño continuo',
  damageBurst: 'Daño explosivo',
  mobility: 'Movilidad',
  engage: 'Capacidad de entrada',
  disengage: 'Capacidad de salida',
  survivability: 'Aguante',
  range: 'Alcance',
  cc: 'Control de masas',
  healing: 'Curación',
  objectiveControl: 'Control de objetivos',
  waveClear: 'Limpieza',
  roaming: 'Rotación'
};

const LANE_LABELS = {
  all: 'Todas',
  jungle: 'Jungla',
  mid: 'Mid',
  farm: 'Farm / ADC',
  clash: 'Top',
  roam: 'Soporte'
};

const SLOT_LANE_ORDER = ['clash', 'jungle', 'mid', 'roam', 'farm'];
const SLOT_LABELS = {
  clash: 'Top',
  jungle: 'Jungla',
  mid: 'Mid',
  roam: 'Soporte',
  farm: 'Farm / ADC'
};

const state = {
  laneFilter: 'all',
  query: '',
  selectedTags: Array(5).fill(null),
  description: '',
  notes: '',
  activeSlotIndex: null,
  laneMenuTag: null,
  userEdited: false,
  heroListExpanded: false
};

const STORAGE_KEY = 'redweb-composition-draft';
const FORBIDDEN_WORDS = [
  'nazi', 'nazista', 'nazismo', 'judio', 'judío', 'judia', 'judía', 'comunista', 'comunismo', 'facista', 'fascista', 'fascismo',
  'supremacista', 'supremacia', 'racista', 'racismo', 'xenofobo', 'xenofobia', 'separatista', 'terrorista', 'terrorismo', 'masoquista',
  'puto', 'puta', 'puta', 'maricon', 'maricón', 'marica', 'culop', 'culo', 'gilipollas', 'gilipolla', 'imbecil', 'idiota', 'tonto',
  'basura', 'bastardo', 'bastarda', 'zorra', 'cabron', 'cabrón', 'pedazo', 'mierda', 'cagada', 'cago', 'retard', 'retrasado',
  'mongolo', 'mongol', 'pendejo', 'pendeja', 'estupido', 'estúpido', 'inutil', 'inútil', 'sucia', 'sucio', 'sudaca', 'afeminado',
  'maldito', 'maldita', 'cornudo', 'cornuda', 'vagina', 'porno', 'pornografia', 'sex', 'sexo', 'gore', 'violencia', 'ofensa', 'insulto',
  'hack', 'hacker', 'trampa', 'fraude', 'spammer', 'spam', 'bot', 'fake', 'idiot', 'dumb', 'moron', 'moro', 'bruto', 'safada',
  'caca', 'culo', 'paja', 'fornicar', 'prostituta', 'prostituto', 'travesti', 'transvesti', 'odio', 'hatred', 'genocidio', 'esclavo',
  'nazi', 'camisa', 'cruzada', 'kike', 'kiker', 'negro', 'negra', 'mongolo', 'gypsy', 'zigan', 'furbo', 'boludo', 'capullo'
];

const LEET_REPLACEMENTS = {
  a: ['a', '4', '@'], e: ['e', '3'], i: ['i', '1', '!'], o: ['o', '0'], u: ['u', 'v'],
  s: ['s', '5', '$'], t: ['t', '7'], b: ['b', '8'], g: ['g', '9'], z: ['z', '2'],
  c: ['c', '(', ')'], l: ['l', '1', 'I'], y: ['y', '7'], n: ['n', 'm'],
  m: ['m', 'n'], h: ['h', '4'], x: ['x', 'k'], k: ['k', 'x'], v: ['v', 'u']
};

const FORBIDDEN_WORD_VARIANTS = buildForbiddenWordVariants(FORBIDDEN_WORDS);

function buildForbiddenWordVariants(words) {
  const variants = new Set();

  const normalizeWord = (value) => String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();

  const cartesian = (options) => {
    if (!options.length) return [''];
    const result = [''];
    for (const option of options) {
      const next = [];
      for (const prefix of result) {
        for (const value of option) {
          next.push(prefix + value);
        }
      }
      result.splice(0, result.length, ...next);
    }
    return result;
  };

  words.forEach((word) => {
    const clean = normalizeWord(word);
    if (!clean || clean.length < 3) return;

    const pathed = [];
    for (const char of clean) {
      const options = LEET_REPLACEMENTS[char] ? [...new Set(LEET_REPLACEMENTS[char])] : [char];
      pathed.push(options);
    }

    const generated = cartesian(pathed);
    generated.forEach((variant) => {
      const base = variant.replace(/[^a-z]/g, '');
      if (base.length >= 3) {
        variants.add(base);
      }
      variants.add(normalizeWord(variant));
      variants.add(normalizeWord(`${variant} `));
      variants.add(normalizeWord(`${variant}${variant}`));
      variants.add(normalizeWord(`${variant.slice(0, 1)}${variant.slice(1)}`));
    });

    const withSeparators = new Set([
      clean,
      clean.replace(/\s+/g, ''),
      clean.replace(/([a-z])/gi, '$1 '),
      clean.split('').join(' '),
      clean.split('').join('-'),
      clean.split('').join('_'),
      clean.split('').join('.'),
      clean.split('').join('@')
    ]);

    withSeparators.forEach((entry) => {
      const normalized = normalizeWord(entry);
      if (normalized.length >= 3) {
        variants.add(normalized);
      }
    });
  });

  return [...variants].filter(Boolean);
}

const REFERENCE_COMPOSITIONS = [
  {
    id: 'presion-temprana',
    title: 'Presión temprana',
    description: 'Composición de rotación agresiva para empujar rápido, forzar peleas y mantener presión sobre los objetivos.',
    notes: 'Funciona mejor con un apoyo que pueda entrar con facilidad y un carry con gran daño explosivo.',
    heroes: ['sun-ce', 'li-bai', 'angela', 'sun-bin', 'arli']
  },
  {
    id: 'control-objetivos',
    title: 'Control de objetivos',
    description: 'Equipo centrado en controlar espacios, defender y asegurar las peleas de equipo con mucho control de masas.',
    notes: 'Muy útil si el grupo tiene buena coordinación para entrar y cerrar la pelea desde la distancia.',
    heroes: ['lian-po', 'nakoruru', 'princess-frost', 'sun-bin', 'marco-polo']
  },
  {
    id: 'asesinato',
    title: 'Asesinato móvil',
    description: 'Puesta en escena de presión con mucha movilidad, salto y daño instantáneo para eliminar objetivos clave.',
    notes: 'Se compensa mejor cuando el equipo tiene una salida clara y buen timing para la iniciación.',
    heroes: ['yang-jian', 'nakoruru', 'shangguan', 'yaria', 'marco-polo']
  }
];

function getCatalogPath() {
  return window.location.pathname.includes('/htmls/') ? '../data/heroes.json' : 'data/heroes.json';
}

function laneProfile(lane) {
  const profiles = {
    jungle: {
      mobility: 72,
      waveClear: 68,
      engage: 62,
      roaming: 74,
      objectiveControl: 58,
      survivability: 60,
      cc: 54
    },
    mid: {
      damageBurst: 72,
      mobility: 65,
      range: 61,
      cc: 63,
      engage: 66,
      objectiveControl: 52,
      damageContinuous: 58
    },
    farm: {
      range: 68,
      damageContinuous: 70,
      waveClear: 57,
      objectiveControl: 53,
      disengage: 58,
      damageBurst: 55
    },
    clash: {
      survivability: 72,
      engage: 69,
      objectiveControl: 67,
      cc: 58,
      damageBurst: 60,
      earlyPush: 60
    },
    roam: {
      mobility: 68,
      objectiveControl: 63,
      healing: 58,
      range: 57,
      cc: 61,
      roaming: 70,
      disengage: 62
    }
  };

  return profiles[lane] || {
    mobility: 55,
    survivability: 55,
    objectiveControl: 55,
    waveClear: 55
  };
}

function laneSlotIndex(lane) {
  return SLOT_LANE_ORDER.indexOf(lane);
}

function normalizeSelectedTags(tags = []) {
  const next = Array(5).fill(null);

  tags.slice(0, 5).forEach((tag, index) => {
    if (!tag || !HERO_CATALOG?.heroes?.[tag]) return;
    next[index] = tag;
  });

  return next;
}

function isReferenceDraft(draft) {
  return REFERENCE_COMPOSITIONS.some((preset) => {
    const sameHeroes = preset.heroes.length === draft.selectedTags.length
      && preset.heroes.every((tag, index) => tag === draft.selectedTags[index]);
    return sameHeroes && draft.description === preset.description && draft.notes === preset.notes;
  });
}

function isLegacyReferenceDraft(draft) {
  if (draft.userEdited !== undefined) return false;

  return REFERENCE_COMPOSITIONS.some((preset) => {
    const matchesCopy = draft.description === preset.description && draft.notes === preset.notes;
    const containsOnlyPresetHeroes = draft.selectedTags.every((tag) => !tag || preset.heroes.includes(tag));
    return matchesCopy && containsOnlyPresetHeroes;
  });
}

function assignHeroToLane(tag, lane) {
  if (!tag || !HERO_CATALOG?.heroes?.[tag]) return;

  state.userEdited = true;

  const next = [...state.selectedTags];
  const targetIndex = laneSlotIndex(lane);

  if (targetIndex < 0) return;

  const existingIndex = next.indexOf(tag);
  if (existingIndex >= 0) next[existingIndex] = null;

  const current = next[targetIndex];
  if (current && current !== tag) {
    const currentLaneIndex = laneSlotIndex(HERO_CATALOG.heroes[current]?.lane || 'farm');
    if (currentLaneIndex !== targetIndex) {
      next[currentLaneIndex] = current;
    }
  }

  next[targetIndex] = tag;
  state.selectedTags = next;
  saveDraft();
  renderHeroList();
  renderSelectedHeroes();
  renderStats();
}

function assignHeroToSlot(tag, slotIndex) {
  if (!tag || slotIndex === undefined || slotIndex === null) return;

  state.userEdited = true;

  const next = [...state.selectedTags];
  const existingIndex = next.indexOf(tag);
  if (existingIndex >= 0) next[existingIndex] = null;

  if (slotIndex >= 0 && slotIndex < next.length) {
    next[slotIndex] = tag;
  }

  state.selectedTags = next;
  state.activeSlotIndex = slotIndex;
  saveDraft();
  renderHeroList();
  renderSelectedHeroes();
  renderStats();
}

function swapSlots(sourceIndex, targetIndex) {
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= state.selectedTags.length || targetIndex >= state.selectedTags.length) return;
  if (sourceIndex === targetIndex) return;

  state.userEdited = true;
  const next = [...state.selectedTags];
  [next[sourceIndex], next[targetIndex]] = [next[targetIndex], next[sourceIndex]];
  state.selectedTags = next;
  state.activeSlotIndex = targetIndex;
  saveDraft();
  renderHeroList();
  renderSelectedHeroes();
  renderStats();
}

function getHeroStatMultiplier(hero, lane) {
  const multiplier = hero?.laneMultipliers?.[lane];
  if (Number.isFinite(Number(multiplier))) return Number(multiplier);

  return 1;
}

function statAverage(selectedHeroes) {
  const statKeys = Object.keys(STAT_META);
  const totals = Object.fromEntries(statKeys.map((key) => [key, 0]));

  const validHeroes = selectedHeroes.filter(Boolean);

  if (!validHeroes.length) {
    return Object.fromEntries(statKeys.map((key) => [key, 0]));
  }

  selectedHeroes.forEach((tag, slotIndex) => {
    if (!tag) return;
    const hero = HERO_CATALOG.heroes[tag];
    const slotLane = SLOT_LANE_ORDER[slotIndex] || hero?.lane || 'farm';
    const profile = laneProfile(hero?.lane || slotLane);
    const seed = [...(hero?.displayName || tag)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const variance = ((seed % 13) - 6) * 1.8;

    statKeys.forEach((key) => {
      const base = Number(hero?.baseStrength?.[key]);
      const baseValue = Number.isFinite(base) ? base : (profile[key] || 52) + variance;
      const multiplier = getHeroStatMultiplier(hero, slotLane);
      totals[key] += Math.max(0, Math.min(100, baseValue * multiplier));
    });
  });

  const count = validHeroes.length;
  return Object.fromEntries(statKeys.map((key) => [key, Math.round(totals[key] / count)]));
}

function buildRadarPoints(stats) {
  const keys = Object.keys(STAT_META);
  const centerX = 110;
  const centerY = 110;
  const radius = 82;
  const points = [];

  keys.forEach((key, index) => {
    const angle = (-Math.PI / 2) + (index / keys.length) * Math.PI * 2;
    const value = Math.max(0, Math.min(100, stats[key] || 0));
    const distance = (value / 100) * radius;
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  });

  return points.join(' ');
}

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

function heroAvatarMarkup(tag, className = 'hero-avatar') {
  const hero = HERO_CATALOG?.heroes?.[tag];
  const name = hero?.displayName || tag;
  const safe = heroImageSlug(tag, name) || tag;
  const image = `../assets/images/heroes/${safe}.jpg`;

  return `
    <img
      class="${className}"
      src="${image}"
      alt="${name}"
      loading="lazy"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
    >
    <span class="${className}-fallback" style="display:none;">${(name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '?')}</span>
  `;
}

function hideLaneContextMenu() {
  const menu = document.getElementById('hero-lane-menu');
  if (!menu) return;
  menu.hidden = true;
  state.laneMenuTag = null;
}

function renderLaneContextMenu(tag, x, y) {
  let menu = document.getElementById('hero-lane-menu');
  if (!menu) {
    menu = document.createElement('div');
    menu.id = 'hero-lane-menu';
    menu.className = 'hero-lane-menu';
    menu.hidden = true;
    document.body.appendChild(menu);
  }

  const availableSlots = SLOT_LANE_ORDER.map((lane, index) => ({ lane, label: SLOT_LABELS[lane] || LANE_LABELS[lane] || lane, index }))
    .filter(({ index }) => !state.selectedTags[index] || state.selectedTags[index] === tag);

  if (!availableSlots.length) {
    hideLaneContextMenu();
    return;
  }

  menu.innerHTML = availableSlots.map(({ label, index }) => `
    <button type="button" class="hero-lane-menu__item" data-slot-index="${index}">
      Agregar a ${label}
    </button>
  `).join('');

  menu.querySelectorAll('.hero-lane-menu__item').forEach((button) => {
    button.addEventListener('click', () => {
      const slotIndex = Number(button.dataset.slotIndex);
      assignHeroToSlot(tag, slotIndex);
      hideLaneContextMenu();
    });
  });

  menu.hidden = false;
  const menuWidth = menu.offsetWidth;
  const menuHeight = menu.offsetHeight;
  const margin = 12;
  const left = Math.min(Math.max(margin, x), window.innerWidth - menuWidth - margin);
  const top = Math.min(Math.max(margin, y), window.innerHeight - menuHeight - margin);
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
  state.laneMenuTag = tag;
}

function getFilteredHeroes() {
  return Object.entries(HERO_CATALOG.heroes)
    .filter(([tag]) => tag !== 'la-voz-del-flujo'
      && tag !== 'la-voz-del-flujo-tirador'
      && !REDWEB_FLOWBORN.upcomingTags.includes(tag))
    .filter(([tag, hero]) => {
      const laneTarget = state.laneFilter === 'all'
        || hero.lane === state.laneFilter
        || flowbornSupportsLane(tag, state.laneFilter);
      const query = state.query.trim().toLowerCase();
      const searchableNames = tag === REDWEB_FLOWBORN.carryTag
        ? `${hero.displayName} tirador marksman`
        : hero.displayName;
      const nameMatches = !query || searchableNames.toLowerCase().includes(query) || tag.toLowerCase().includes(query);
      return laneTarget && nameMatches;
    })
    .sort((a, b) => a[1].displayName.localeCompare(b[1].displayName));
}

function bindHeroButtons(container, allowContextMenu = false) {
  container.querySelectorAll('.hero-option').forEach((button) => {
    button.draggable = !allowContextMenu;
    if (allowContextMenu) {
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', button.dataset.tag || '');
        event.dataTransfer.effectAllowed = 'copyMove';
        button.classList.add('dragging');
      });
      button.addEventListener('dragend', () => button.classList.remove('dragging'));
      button.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        renderLaneContextMenu(button.dataset.tag, event.clientX, event.clientY);
      });
    }
    button.addEventListener('click', () => toggleHero(button.dataset.tag));
  });
}

function renderHeroCards(container, heroes, iconsOnly = false) {
  container.innerHTML = heroes.map(([tag, hero]) => {
    const selected = state.selectedTags.includes(tag);
    const laneLabel = LANE_LABELS[hero.lane] || hero.lane;

    return `
      <button type="button" class="hero-option ${iconsOnly ? 'hero-option--icon' : ''} ${selected ? 'selected' : ''}" data-tag="${tag}" aria-pressed="${selected}" title="${hero.displayName}">
        <span class="hero-option__avatar">${heroAvatarMarkup(tag, 'hero-option__img')}</span>
        <span class="hero-option__meta">
          <span class="hero-option__name">${hero.displayName}</span>
          <span class="hero-option__lane">${laneLabel}</span>
        </span>
      </button>
    `;
  }).join('');
}

function renderHeroBrowser(heroes) {
  const browserList = document.getElementById('hero-browser-list');
  if (!browserList) return;
  renderHeroCards(browserList, heroes, true);
  bindHeroButtons(browserList);
}

function renderHeroList() {
  const list = document.getElementById('hero-list');
  if (!list) return;

  const heroes = getFilteredHeroes();

  if (!heroes.length) {
    list.innerHTML = '<p class="empty-state">No se encontraron héroes con ese filtro.</p>';
    const toggle = document.getElementById('show-all-heroes');
    if (toggle) toggle.hidden = true;
    return;
  }

  const compactViewport = window.matchMedia('(max-width: 768px)').matches;
  const visibleHeroes = compactViewport && !state.heroListExpanded ? heroes.slice(0, 10) : heroes;
  renderHeroCards(list, visibleHeroes);
  bindHeroButtons(list, true);

  const toggle = document.getElementById('show-all-heroes');
  if (toggle) {
    toggle.hidden = !compactViewport || heroes.length <= visibleHeroes.length;
    toggle.textContent = state.heroListExpanded ? 'Ocultar lista' : `Ver todos (${heroes.length})`;
  }

  renderHeroBrowser(heroes);
}

function renderMapPins() {
  if (window.RedWebMapCo?.renderMapPins) {
    window.RedWebMapCo.renderMapPins({
      selectedTags: state.selectedTags,
      heroCatalog: HERO_CATALOG,
      toggleHero,
      assignHeroToSlot,
      swapSlots
    });
  }
}

function tuneSlotContrast(slot, image) {
  if (!image.naturalWidth || !image.naturalHeight) return;

  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;

  try {
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;
    let luminanceTotal = 0;
    let brightPixels = 0;

    for (let index = 0; index < pixels.length; index += 4) {
      redTotal += pixels[index];
      greenTotal += pixels[index + 1];
      blueTotal += pixels[index + 2];
      const luminance = (pixels[index] * 0.2126) + (pixels[index + 1] * 0.7152) + (pixels[index + 2] * 0.0722);
      luminanceTotal += luminance;
      if (luminance > 180) brightPixels += 1;
    }

    const pixelCount = pixels.length / 4;
    const averageLuminance = luminanceTotal / pixelCount / 255;
    const brightRatio = brightPixels / pixelCount;
    const contrastNeed = Math.max(0, Math.min(1, (averageLuminance * .72) + (brightRatio * .45)));
    const overlayAlpha = (.68 + (contrastNeed * .25)).toFixed(2);
    const shadowAlpha = (.78 + (contrastNeed * .2)).toFixed(2);
    const shadowRgb = [redTotal, greenTotal, blueTotal]
      .map((total) => Math.round((total / pixelCount) * .28))
      .join(', ');

    slot.style.setProperty('--slot-overlay-alpha', overlayAlpha);
    slot.style.setProperty('--slot-shadow-alpha', shadowAlpha);
    slot.style.setProperty('--slot-shadow-rgb', shadowRgb);
  } catch (error) {
    slot.style.setProperty('--slot-overlay-alpha', '.82');
    slot.style.setProperty('--slot-shadow-alpha', '.94');
    slot.style.setProperty('--slot-shadow-rgb', '12, 10, 11');
  }
}

function renderSelectedHeroes() {
  const container = document.getElementById('selected-heroes');
  if (!container) return;

  const slots = SLOT_LANE_ORDER.map((lane, index) => {
    const tag = state.selectedTags[index];
    const laneLabel = SLOT_LABELS[lane] || LANE_LABELS[lane] || lane;

    if (!tag) {
      return `
        <div class="selected-slot empty" data-slot-index="${index}" data-lane="${lane}">
          <span>${laneLabel}</span>
          <small>Slot ${index + 1}</small>
        </div>
      `;
    }

    const hero = HERO_CATALOG.heroes[tag];

    return `
      <div class="selected-slot filled" data-tag="${tag}" data-slot-index="${index}" data-lane="${lane}">
        <div class="selected-slot__header">
          <button type="button" class="selected-slot__avatar" data-remove="${tag}" aria-label="Quitar ${hero.displayName}">
            ${heroAvatarMarkup(tag, 'selected-slot__img')}
          </button>
          <div class="selected-slot__meta">
            <span>${hero.displayName}</span>
            <small>${laneLabel}</small>
          </div>
          <button type="button" class="remove-hero" data-remove="${tag}" aria-label="Quitar ${hero.displayName}">×</button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = slots;

  container.querySelectorAll('.selected-slot.filled').forEach((slot) => {
    const image = slot.querySelector('.selected-slot__img');
    if (!image) return;

    image.loading = 'eager';
    const tuneContrast = () => tuneSlotContrast(slot, image);
    image.addEventListener('load', tuneContrast, { once: true });
    if (image.complete) tuneContrast();
  });

  container.querySelectorAll('.selected-slot').forEach((slot) => {
    const slotIndex = Number(slot.dataset.slotIndex);
    slot.classList.toggle('active', state.activeSlotIndex === slotIndex);
    slot.draggable = slot.classList.contains('filled');

    slot.addEventListener('dragstart', (event) => {
      event.dataTransfer?.setData('application/x-redweb-slot-index', String(slotIndex));
      event.dataTransfer.effectAllowed = 'move';
      slot.classList.add('dragging');
    });
    slot.addEventListener('dragend', () => slot.classList.remove('dragging'));

    slot.addEventListener('click', () => {
      state.activeSlotIndex = slotIndex;
      renderSelectedHeroes();
    });

    slot.addEventListener('dragover', (event) => {
      event.preventDefault();
      slot.classList.add('drag-over');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
    slot.addEventListener('drop', (event) => {
      event.preventDefault();
      slot.classList.remove('drag-over');
      const sourceIndexValue = event.dataTransfer?.getData('application/x-redweb-slot-index');
      if (sourceIndexValue !== '') {
        swapSlots(Number(sourceIndexValue), slotIndex);
        return;
      }
      const tag = event.dataTransfer?.getData('text/plain');
      if (!tag) return;
      const targetSlotIndex = Number(slot.dataset.slotIndex);
      assignHeroToSlot(tag, targetSlotIndex);
    });
  });

  container.querySelectorAll('.remove-hero, .selected-slot__avatar').forEach((button) => {
    button.addEventListener('click', () => toggleHero(button.dataset.remove));
  });

  renderMapPins();
  updateSaveButtonState();
}

function renderStats() {
  const summary = document.getElementById('strength-list');
  if (!summary) return;

  const stats = statAverage(state.selectedTags.map((tag) => tag));
  const entries = Object.entries(STAT_META).map(([key, label]) => {
    const value = stats[key];
    return `
      <div class="stat-row">
        <div class="stat-row__label">
          <span>${label}</span>
          <strong>${value}</strong>
        </div>
        <div class="stat-bar">
          <span style="width:${value}%"></span>
        </div>
      </div>
    `;
  });

  summary.innerHTML = entries.join('');

  const radar = document.getElementById('radar-chart');
  if (radar) {
    radar.innerHTML = `
      <polygon class="radar-shape" points="${buildRadarPoints(stats)}"></polygon>
      ${Object.keys(STAT_META).map((key, index) => {
        const angle = (-Math.PI / 2) + (index / Object.keys(STAT_META).length) * Math.PI * 2;
        const x = 110 + Math.cos(angle) * 82;
        const y = 110 + Math.sin(angle) * 82;
        return `<line x1="110" y1="110" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" />`;
      }).join('')}
      ${Object.keys(STAT_META).map((key, index) => {
        const angle = (-Math.PI / 2) + (index / Object.keys(STAT_META).length) * Math.PI * 2;
        const value = Math.max(0, Math.min(100, stats[key] || 0));
        const distance = (value / 100) * 82;
        const x = 110 + Math.cos(angle) * distance;
        const y = 110 + Math.sin(angle) * distance;
        return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.5" />`;
      }).join('')}
    `;
  }
}

function renderReferenceCards() {
  const list = document.getElementById('reference-list');
  if (!list) return;

  list.innerHTML = REFERENCE_COMPOSITIONS.map((preset) => {
    const heroNames = preset.heroes.map((tag) => HERO_CATALOG?.heroes?.[tag]?.displayName || tag).join(' · ');
    return `
      <article class="reference-card">
        <h4>${preset.title}</h4>
        <p>${preset.description}</p>
        <div class="reference-card__heroes">${heroNames}</div>
        <button type="button" class="cta-btn secondary" data-reference-id="${preset.id}">Usar referencia</button>
      </article>
    `;
  }).join('');

  list.querySelectorAll('[data-reference-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const preset = REFERENCE_COMPOSITIONS.find((entry) => entry.id === button.dataset.referenceId);
      if (preset) applyReferencePreset(preset);
    });
  });
}

function requestConfirmation(message, { notice = false } = {}) {
  const dialog = document.getElementById('composition-confirm');
  const messageNode = document.getElementById('composition-confirm-message');
  const acceptButton = dialog?.querySelector('[data-confirm-accept]');
  const cancelButtons = dialog?.querySelectorAll('[data-confirm-cancel]') || [];
  if (!dialog || !messageNode) return Promise.resolve(false);

  messageNode.textContent = message;
  if (acceptButton) acceptButton.textContent = notice ? 'Entendido' : 'Continuar';
  cancelButtons.forEach((button) => { button.hidden = notice; });
  dialog.hidden = false;

  return new Promise((resolve) => {
    const finish = (confirmed) => {
      dialog.hidden = true;
      dialog.querySelectorAll('[data-confirm-accept], [data-confirm-cancel]').forEach((button) => {
        button.replaceWith(button.cloneNode(true));
      });
      dialog.querySelectorAll('[data-confirm-cancel]').forEach((button) => { button.hidden = false; });
      const nextAcceptButton = dialog.querySelector('[data-confirm-accept]');
      if (nextAcceptButton) nextAcceptButton.textContent = 'Continuar';
      resolve(confirmed);
    };

    dialog.querySelector('[data-confirm-accept]')?.addEventListener('click', () => finish(true), { once: true });
    dialog.querySelectorAll('[data-confirm-cancel]').forEach((button) => {
      button.addEventListener('click', () => finish(false), { once: true });
    });
  });
}

function showCompositionNotice(message) {
  return requestConfirmation(message, { notice: true });
}

async function applyReferencePreset(preset) {
  const hasUserContent = state.userEdited;

  if (hasUserContent) {
    const confirmed = await requestConfirmation('Esta acción reemplazará los héroes, la descripción y las notas actuales. No podrás deshacer este cambio.');
    if (!confirmed) return;
  }

  state.selectedTags = preset.heroes.slice(0, 5);
  state.description = preset.description;
  state.notes = preset.notes;
  state.userEdited = false;

  const builder = document.getElementById('composition-builder');
  if (builder) builder.hidden = false;

  const title = document.getElementById('composition-title');
  const message = document.getElementById('composition-message');
  if (title) title.textContent = preset.title;
  if (message) message.textContent = 'Referencia visual cargada. Puedes ajustar la selección o guardar tu propia versión.';

  hydrateForm();
  renderHeroList();
  renderSelectedHeroes();
  renderStats();
  saveDraft();
}

function normalizeForbiddenWordText(value) {
  const leetMap = {
    '@': 'a', '4': 'a', '3': 'e', '0': 'o', '1': 'i', '5': 's', '7': 't', '8': 'b', '9': 'g',
    '$': 's', '!': 'i', '(': 'c', ')': 'o', '|': 'l', '2': 'z', '+': 't', '6': 'g', '¿': '', '?': '',
    '¡': '', '*': '', '_': '', '-': '', '.': '', ',': '', ':': '', ';': '', '/': '', '\\': '', ' ': ''
  };

  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split('')
    .map((char) => leetMap[char] ?? char)
    .join('')
    .replace(/[^a-z]/g, '')
    .trim();
}

function detectForbiddenWords(value) {
  const normalized = normalizeForbiddenWordText(value);
  const matches = new Set();

  FORBIDDEN_WORD_VARIANTS.forEach((variant) => {
    if (normalized.includes(variant)) {
      matches.add(variant);
    }
  });

  FILTER_WORDS.forEach((word) => {
    if (normalized.includes(word)) {
      matches.add(word);
    }
  });

  return [...matches].filter(Boolean);
}

function getTextareaValidationState(textarea) {
  const value = textarea?.value || '';
  const matches = detectForbiddenWords(value);
  return {
    hasForbiddenWords: matches.length > 0,
    matches
  };
}

function setTextareaFeedback(textarea, message, isError = false) {
  if (!textarea) return;

  const feedback = textarea.parentElement?.querySelector('.field-feedback');
  if (!feedback) return;

  feedback.textContent = message;
  feedback.classList.toggle('is-error', isError);
  feedback.classList.toggle('is-ok', !isError && Boolean(message));
  textarea.classList.toggle('is-invalid', isError);
}

function clearTextareaFeedback(textarea) {
  if (!textarea) return;
  const feedback = textarea.parentElement?.querySelector('.field-feedback');
  if (feedback) {
    feedback.textContent = '';
    feedback.classList.remove('is-error', 'is-ok');
  }
  textarea.classList.remove('is-invalid');
}

function attachForbiddenWordsValidation(textarea, label) {
  if (!textarea) return;

  const parent = textarea.parentElement;
  if (!parent) return;

  const existing = parent.querySelector('.field-feedback');
  if (!existing) {
    const feedback = document.createElement('div');
    feedback.className = 'field-feedback';
    feedback.setAttribute('aria-live', 'polite');
    parent.appendChild(feedback);
  }

  const refreshValidation = () => {
    if (!textarea.value.trim()) {
      clearTextareaFeedback(textarea);
      return;
    }

    const { hasForbiddenWords, matches } = getTextareaValidationState(textarea);
    if (hasForbiddenWords) {
      const wordsText = matches.join(', ');
      setTextareaFeedback(textarea, `Atención: ${label} contiene palabras prohibidas (${wordsText}).`, true);
      return;
    }

    clearTextareaFeedback(textarea);
  };

  textarea.oninput = () => {
    refreshValidation();
    updateSaveButtonState();
  };
  textarea.onblur = refreshValidation;
  refreshValidation();
}

function saveDraft() {
  const descriptionValue = document.getElementById('composition-description')?.value || '';
  const notesValue = document.getElementById('composition-notes')?.value || '';
  const descriptionCheck = getTextareaValidationState(document.getElementById('composition-description'));
  const notesCheck = getTextareaValidationState(document.getElementById('composition-notes'));

  if (descriptionCheck.hasForbiddenWords || notesCheck.hasForbiddenWords) {
    return;
  }

  const draft = {
    selectedTags: state.selectedTags,
    description: descriptionValue,
    notes: notesValue,
    userEdited: state.userEdited,
    status: 'approved'
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  updateSaveButtonState();
}

function isCompositionComplete() {
  const description = document.getElementById('composition-description')?.value.trim();
  const notes = document.getElementById('composition-notes')?.value.trim();
  const selectedHeroes = state.selectedTags.filter(Boolean);
  const descriptionCheck = getTextareaValidationState(document.getElementById('composition-description'));
  const notesCheck = getTextareaValidationState(document.getElementById('composition-notes'));

  return selectedHeroes.length === 5
    && new Set(selectedHeroes).size === 5
    && Boolean(description)
    && Boolean(notes)
    && !descriptionCheck.hasForbiddenWords
    && !notesCheck.hasForbiddenWords;
}

function updateSaveButtonState() {
  const saveButton = document.getElementById('save-composition');
  if (!saveButton) return;

  const description = document.getElementById('composition-description');
  const notes = document.getElementById('composition-notes');
  const descriptionCheck = getTextareaValidationState(description);
  const notesCheck = getTextareaValidationState(notes);
  const isComplete = isCompositionComplete();
  const blockedByForbiddenWords = descriptionCheck.hasForbiddenWords || notesCheck.hasForbiddenWords;

  saveButton.disabled = !isComplete || blockedByForbiddenWords;
  saveButton.setAttribute('aria-disabled', String(!isComplete || blockedByForbiddenWords));

  if (blockedByForbiddenWords) {
    saveButton.title = 'Hay palabras prohibidas. Corrigelas antes de guardar.';
  } else {
    saveButton.title = 'Guardar borrador';
  }
}

function loadDraft() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const draft = JSON.parse(raw);
    state.selectedTags = normalizeSelectedTags(Array.isArray(draft.selectedTags) ? draft.selectedTags.slice(0, 5) : []);
    state.description = draft.description || '';
    state.notes = draft.notes || '';
    const loadedDraft = {
      selectedTags: state.selectedTags,
      description: state.description,
      notes: state.notes,
      userEdited: draft.userEdited
    };
    state.userEdited = isReferenceDraft(loadedDraft) || isLegacyReferenceDraft(loadedDraft)
      ? false
      : (draft.userEdited ?? Boolean(state.selectedTags.some(Boolean) || state.description || state.notes));
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function hydrateForm() {
  const descriptionInput = document.getElementById('composition-description');
  const notesInput = document.getElementById('composition-notes');

  if (descriptionInput) descriptionInput.value = state.description;
  if (notesInput) notesInput.value = state.notes;

  attachForbiddenWordsValidation(descriptionInput, 'la descripción');
  attachForbiddenWordsValidation(notesInput, 'la nota');
}

function toggleHero(tag) {
  if (!tag || !HERO_CATALOG?.heroes?.[tag]) return;

  state.userEdited = true;

  if (state.selectedTags.includes(tag)) {
    state.selectedTags = state.selectedTags.map((value) => value === tag ? null : value);
  } else if (state.selectedTags.filter(Boolean).length >= 5) {
    showCompositionNotice('Solo puedes añadir 5 héroes a una composición.');
    return;
  } else {
    const heroLane = HERO_CATALOG.heroes[tag].lane || 'farm';
    const preferredIndex = SLOT_LANE_ORDER.indexOf(heroLane);
    const activeSlotIsFree = state.activeSlotIndex !== null && state.activeSlotIndex >= 0 && !state.selectedTags[state.activeSlotIndex];

    let targetIndex = -1;

    if (activeSlotIsFree) {
      targetIndex = state.activeSlotIndex;
    } else if (preferredIndex >= 0 && !state.selectedTags[preferredIndex]) {
      targetIndex = preferredIndex;
    } else {
      targetIndex = state.selectedTags.findIndex((value) => value === null);
    }

    if (targetIndex >= 0) {
      state.selectedTags[targetIndex] = tag;
      state.activeSlotIndex = targetIndex;
    }
  }

  hideLaneContextMenu();
  saveDraft();
  renderHeroList();
  renderSelectedHeroes();
  renderStats();
}

function bindControls() {
  const laneFilter = document.getElementById('lane-filter');
  const searchInput = document.getElementById('hero-search');
  const saveButton = document.getElementById('save-composition');
  const resetButton = document.getElementById('reset-composition');
  const descriptionInput = document.getElementById('composition-description');
  const notesInput = document.getElementById('composition-notes');
  const showAllHeroes = document.getElementById('show-all-heroes');
  const heroBrowser = document.getElementById('hero-browser');

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.hero-lane-menu__item') && !event.target.closest('.hero-option')) {
      hideLaneContextMenu();
    }
  });

  laneFilter?.addEventListener('change', (event) => {
    state.laneFilter = event.target.value;
    state.heroListExpanded = false;
    renderHeroList();
  });

  searchInput?.addEventListener('input', (event) => {
    state.query = event.target.value;
    state.heroListExpanded = false;
    renderHeroList();
  });

  showAllHeroes?.addEventListener('click', () => {
    if (state.heroListExpanded) {
      state.heroListExpanded = false;
      renderHeroList();
      return;
    }
    heroBrowser.hidden = false;
    document.body.classList.add('hero-browser-open');
    renderHeroBrowser(getFilteredHeroes());
  });

  heroBrowser?.querySelectorAll('[data-hero-browser-close]').forEach((element) => {
    element.addEventListener('click', () => {
      heroBrowser.hidden = true;
      document.body.classList.remove('hero-browser-open');
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && heroBrowser && !heroBrowser.hidden) {
      heroBrowser.hidden = true;
      document.body.classList.remove('hero-browser-open');
    }
  });

  descriptionInput?.addEventListener('input', (event) => {
    state.userEdited = true;
    state.description = event.target.value;
    if (getTextareaValidationState(descriptionInput).hasForbiddenWords) {
      clearTextareaFeedback(descriptionInput);
    }
    saveDraft();
    updateSaveButtonState();
  });

  notesInput?.addEventListener('input', (event) => {
    state.userEdited = true;
    state.notes = event.target.value;
    if (getTextareaValidationState(notesInput).hasForbiddenWords) {
      clearTextareaFeedback(notesInput);
    }
    saveDraft();
    updateSaveButtonState();
  });

  saveButton?.addEventListener('click', () => {
    const descriptionCheck = getTextareaValidationState(descriptionInput);
    const notesCheck = getTextareaValidationState(notesInput);

    if (descriptionCheck.hasForbiddenWords || notesCheck.hasForbiddenWords) {
      if (descriptionCheck.hasForbiddenWords) {
        setTextareaFeedback(descriptionInput, `Atención: la descripción contiene palabras prohibidas (${descriptionCheck.matches.join(', ')}).`, true);
      }
      if (notesCheck.hasForbiddenWords) {
        setTextareaFeedback(notesInput, `Atención: la nota contiene palabras prohibidas (${notesCheck.matches.join(', ')}).`, true);
      }
      updateSaveButtonState();
      return;
    }

    if (!isCompositionComplete()) return;
    saveDraft();
    showCompositionNotice('Borrador guardado en este navegador.');
  });

  resetButton?.addEventListener('click', async () => {
    const hasContent = state.selectedTags.some(Boolean)
      || Boolean(descriptionInput?.value.trim())
      || Boolean(notesInput?.value.trim());

    if (hasContent) {
      const confirmed = await requestConfirmation('Esta acción eliminará todos los héroes, la descripción y las notas actuales. No podrás deshacer este cambio.');
      if (!confirmed) return;
    }

    state.selectedTags = Array(5).fill(null);
    state.description = '';
    state.notes = '';
    state.activeSlotIndex = null;
    state.userEdited = false;
    if (descriptionInput) descriptionInput.value = '';
    if (notesInput) notesInput.value = '';
    localStorage.removeItem(STORAGE_KEY);
    renderHeroList();
    renderSelectedHeroes();
    renderStats();
  });
}

async function initCompositionBuilder() {
  try {
    await loadHeroCatalog(getCatalogPath());
    renderReferenceCards();
    loadDraft();

    if (!state.selectedTags.some(Boolean)) {
      applyReferencePreset(REFERENCE_COMPOSITIONS[0]);
    } else {
      hydrateForm();
      renderHeroList();
      renderSelectedHeroes();
      renderStats();
    }

    bindControls();
    renderMapPins();
  } catch (error) {
    const list = document.getElementById('hero-list');
    if (list) {
      list.innerHTML = '<p class="empty-state">No se pudo cargar el catálogo de héroes.</p>';
    }
    console.error(error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const builder = document.getElementById('composition-builder');
  const trigger = document.getElementById('create-composition');

  if (builder && trigger) {
    builder.hidden = false;
    trigger.addEventListener('click', () => {
      builder.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.getElementById('composition-title').textContent = 'Constructor de composiciones';
      document.getElementById('composition-message').textContent = 'Selecciona cartas, ajusta la idea y guarda el borrador local.';
      builder.hidden = false;
    });
  }

  initCompositionBuilder();
});
