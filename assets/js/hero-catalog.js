let HERO_CATALOG = null;
let HERO_TAG_BY_NAME = {};

const REDWEB_FLOWBORN = Object.freeze({
  tankTag: 'la-voz-del-flujo-tanque',
  carryTag: 'la-voz-del-flujo-carry',
  mageTag: 'la-voz-del-flujo-mago',
  upcomingTags: ['la-voz-del-flujo-soporte', 'la-voz-del-flujo-asesino'],
  laneByTag: {
    'la-voz-del-flujo-tanque': ['clash', 'jungle'],
    'la-voz-del-flujo-carry': ['farm'],
    'la-voz-del-flujo-mago': ['mid']
  },
  imageByTag: {
    'la-voz-del-flujo-tanque': 'flowborn-tank',
    'la-voz-del-flujo-carry': 'flowborn-marksman',
    'la-voz-del-flujo-mago': 'flowborn-mage'
  }
});

const HERO_NAME_ALIASES = {
  'cao cao': 'fatih',
  'cao-cao': 'fatih',
  'fatih cao cao': 'fatih',
  'fatih-cao-cao': 'fatih',
  'princess frost': 'princess-frost',
  'princess-frost': 'princess-frost',
  'wang zhaojun': 'princess-frost',
  'wang-zhaojun': 'princess-frost',
  'wazhao jun': 'princess-frost',
  'wazhao-jun': 'princess-frost',
  'wazhao': 'princess-frost',
  'gao changgong': 'gao-changgong',
  'gao-changgong': 'gao-changgong',
  'principe de langling': 'gao-changgong',
  'principe-de-langling': 'gao-changgong',
  'príncipe de lanling': 'gao-changgong',
  'príncipe-de-lanling': 'gao-changgong',
  'prince de langling': 'gao-changgong',
  'prince-de-langling': 'gao-changgong',
  'loong': 'ao-yin',
  'long': 'ao-yin',
  'saker': 'sakeer',
  'xiahou dun': 'dun',
  'xiahou-dun': 'dun',
  'garuda khageswara': 'garuda',
  'garuda-khageswara': 'garuda',
  'khageswara': 'garuda',
  'la voz del flujo': 'la-voz-del-flujo-tanque',
  'la-voz-del-flujo': 'la-voz-del-flujo-tanque',
  'voz del flujo': 'la-voz-del-flujo',
  'la voz del flujo (soporte)': 'la-voz-del-flujo-soporte',
  'la voz del flujo (support)': 'la-voz-del-flujo-soporte',
  'la voz del flujo (asesino)': 'la-voz-del-flujo-asesino',
  'la voz del flujo (assassin)': 'la-voz-del-flujo-asesino',
  'la voz del flujo (tanque)': 'la-voz-del-flujo-tanque',
  'la voz del flujo (tank)': 'la-voz-del-flujo-tanque',
  'la voz del flujo (guerrero)': 'la-voz-del-flujo-tanque',
  'la voz del flujo (warrior)': 'la-voz-del-flujo-tanque',
  'la voz del flujo (adc)': 'la-voz-del-flujo-tirador',
  'la voz del flujo (tirador)': 'la-voz-del-flujo-carry',
  'la voz del flujo (marksman)': 'la-voz-del-flujo-carry',
  'la voz del flujo (carry)': 'la-voz-del-flujo-carry',
  'la voz del flujo (mago)': 'la-voz-del-flujo-mago',
  'la voz del flujo (mage)': 'la-voz-del-flujo-mago'
};

function flowbornSupportsLane(tag, lane) {
  return REDWEB_FLOWBORN.laneByTag[tag]?.includes(lane) || false;
}

function heroDisplayName(nameTag) {
  return HERO_CATALOG?.heroes?.[nameTag]?.displayName || nameTag;
}

function heroLane(nameTag) {
  return HERO_CATALOG?.heroes?.[nameTag]?.lane || null;
}

function heroStats(nameTag) {
  const defaults = HERO_CATALOG?.statDefaults || {};
  const stats = HERO_CATALOG?.heroes?.[nameTag]?.stats || {};
  return { ...defaults, ...stats };
}

function heroTag(name) {
  const normalized = String(name || '').trim().toLowerCase();
  const canonicalAlias = HERO_NAME_ALIASES[normalized];
  if (canonicalAlias) return canonicalAlias;
  return HERO_TAG_BY_NAME[normalized] || normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function loadHeroCatalog(path = '../data/heroes.json') {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`No se pudo cargar ${path}`);

  HERO_CATALOG = await response.json();
  HERO_TAG_BY_NAME = Object.fromEntries(
    Object.entries(HERO_CATALOG.heroes || {}).map(([tag, hero]) => [
      hero.displayName.toLowerCase(),
      tag,
    ])
  );

  Object.entries(HERO_CATALOG.heroes || {}).forEach(([tag, hero]) => {
    const compact = hero.displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const variants = new Set([compact]);

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

    variants.forEach((variant) => {
      if (variant && !HERO_TAG_BY_NAME[variant]) HERO_TAG_BY_NAME[variant] = tag;
    });
  });

  Object.entries(HERO_NAME_ALIASES).forEach(([alias, canonicalTag]) => {
    if (HERO_CATALOG.heroes?.[canonicalTag]) {
      HERO_TAG_BY_NAME[alias] = canonicalTag;
    }
  });

  return HERO_CATALOG;
}
