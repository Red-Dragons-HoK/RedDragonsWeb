const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const RAW_DATA_PATH = path.join(REPO_ROOT, 'data', 'anuncios-raw.json');
const DATA_PATH = path.join(REPO_ROOT, 'data', 'anuncios.json');
const UPDATES_PATH = path.join(REPO_ROOT, 'data', 'updates.json');
const OTHER_ANNOUNCEMENTS_PATH = path.join(
  REPO_ROOT,
  'data',
  'otros-anuncios.json'
);
const HERO_LANES_PATH = path.join(REPO_ROOT, 'data', 'hero-lanes.json');

// ============================================================
// UTILIDADES
// ============================================================

function safeReadJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    const raw = fs.readFileSync(filePath, 'utf8');

    if (!raw.trim()) {
      return fallback;
    }

    return JSON.parse(raw);
  } catch (err) {
    console.warn(
      `No se pudo leer ${filePath}: ${err.message}`
    );
    return fallback;
  }
}

function safeWriteJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true,
  });

  fs.writeFileSync(
    filePath,
    JSON.stringify(data, null, 2),
    'utf8'
  );
}

const heroLanes = safeReadJson(HERO_LANES_PATH, {});

const HERO_ROLE_SUFFIX_REGEX = /\s*\((?:soporte|asesino|tanque|guerrero|adc|tirador|carry|mago|mage|support|assassin|tank|warrior|marksman|mid|jungla|top|farm|roam|clash)\)\s*$/i;

// La Voz del Flujo tiene una identidad unica del juego, pero cada variante de
// rol debe conservar su propio id para que el mapa y las imágenes puedan
// distinguirlas. El nombre visible sigue siendo el que muestra el anuncio,
// pero la clave interna es unica y no se fusiona con otras variantes.
const HERO_CANONICAL_ALIASES = {
  'la voz del flujo': 'La Voz del Flujo',
  'la-voz-del-flujo': 'La Voz del Flujo',
  'voz del flujo': 'La Voz del Flujo',
  'la voz del flujo (soporte)': 'La Voz del Flujo (Soporte)',
  'la voz del flujo (support)': 'La Voz del Flujo (Soporte)',
  'la voz del flujo (asesino)': 'La Voz del Flujo (Asesino)',
  'la voz del flujo (assassin)': 'La Voz del Flujo (Asesino)',
  'la voz del flujo (tanque)': 'La Voz del Flujo (Tanque)',
  'la voz del flujo (tank)': 'La Voz del Flujo (Tanque)',
  'la voz del flujo (guerrero)': 'La Voz del Flujo (Tanque)',
  'la voz del flujo (warrior)': 'La Voz del Flujo (Tanque)',
  'la voz del flujo (adc)': 'La Voz del Flujo (Tirador)',
  'la voz del flujo (tirador)': 'La Voz del Flujo (Tirador)',
  'la voz del flujo (marksman)': 'La Voz del Flujo (Tirador)',
  'la voz del flujo (carry)': 'La Voz del Flujo (Carry)',
  'la voz del flujo (mago)': 'La Voz del Flujo (Mago)',
  'la voz del flujo (mage)': 'La Voz del Flujo (Mago)',
};

function canonicalizeHeroName(name) {
  const rawText = cleanHeroName(name || '');
  if (!rawText) return '';

  const normalizedRaw = rawText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const withoutRoleSuffix = rawText.replace(HERO_ROLE_SUFFIX_REGEX, '').trim();
  const normalizedBase = withoutRoleSuffix
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const mapped = HERO_CANONICAL_ALIASES[normalizedRaw] || HERO_CANONICAL_ALIASES[normalizedBase];
  if (mapped) {
    return mapped;
  }

  if (Object.prototype.hasOwnProperty.call(heroLanes, rawText)) {
    return rawText;
  }

  if (Object.prototype.hasOwnProperty.call(heroLanes, withoutRoleSuffix)) {
    return withoutRoleSuffix;
  }

  return withoutRoleSuffix;
}

function roleDisplayName(roleText) {
  const normalized = (roleText || '').trim();
  if (!normalized) return '';

  const roleMap = {
    soporte: 'Soporte',
    support: 'Soporte',
    asesino: 'Asesino',
    assassin: 'Asesino',
    tanque: 'Tanque',
    tank: 'Tanque',
    guerrero: 'Tanque',
    warrior: 'Tanque',
    tirador: 'Tirador',
    marksman: 'Tirador',
    adc: 'Tirador',
    carry: 'Carry',
    mago: 'Mago',
    mage: 'Mago',
  };

  return roleMap[normalized.toLowerCase()] || normalized;
}

function heroDisplayNameFromRaw(name) {
  const rawText = cleanHeroName(name || '');
  if (!rawText) return '';

  const canonicalName = canonicalizeHeroName(rawText);
  if (!canonicalName) return rawText;

  const roleMatch = rawText.match(/\(([^)]+)\)\s*$/);
  if (roleMatch) {
    const displayRole = roleDisplayName(roleMatch[1]);
    if (displayRole) {
      return rawText.replace(/\(([^)]+)\)\s*$/, `(${displayRole})`);
    }
  }

  return canonicalName;
}

// ============================================================
// FECHAS
// ============================================================

const MONTHS_ES = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

const MONTH_NAMES_PATTERN = Object.keys(MONTHS_ES).join('|');

const SLASH_DATE_REGEX = /(\d{1,2})\s*\/\s*(\d{1,2})/;

const MONTH_NAME_DATE_REGEX = new RegExp(
  `(\\d{1,2})\\s*°?\\s*(?:de\\s+)?(${MONTH_NAMES_PATTERN})`,
  'i'
);

function pad2(n) {
  return String(n).padStart(2, '0');
}

function closestYearForDate(
  day,
  month,
  pubTimestampSeconds
) {
  const pubMs =
    Number(pubTimestampSeconds) * 1000;

  const pubDate =
    new Date(pubMs);

  const pubYear =
    pubDate.getUTCFullYear();

  let bestYear =
    pubYear;

  let bestDiff =
    Infinity;

  for (
    const candidateYear of [
      pubYear - 1,
      pubYear,
      pubYear + 1,
    ]
  ) {
    const candidateMs =
      Date.UTC(
        candidateYear,
        month - 1,
        day
      );

    const diff =
      Math.abs(
        candidateMs - pubMs
      );

    if (diff < bestDiff) {
      bestDiff = diff;
      bestYear = candidateYear;
    }
  }

  return bestYear;
}

function fallbackDateLabel(
  pubTimestampSeconds
) {
  if (!pubTimestampSeconds) {
    return null;
  }

  const fallback =
    new Date(
      (Number(pubTimestampSeconds) + 86400) *
        1000
    );

  return (
    `${pad2(fallback.getUTCDate())}/` +
    `${pad2(fallback.getUTCMonth() + 1)}/` +
    `${fallback.getUTCFullYear()}`
  );
}

function extractTitleDate(
  title,
  pubTimestampSeconds
) {
  const text =
    String(title || '');

  let match =
    text.match(
      SLASH_DATE_REGEX
    );

  let day =
    null;

  let month =
    null;

  if (
    match &&
    Number(match[1]) >= 1 &&
    Number(match[1]) <= 31 &&
    Number(match[2]) >= 1 &&
    Number(match[2]) <= 12
  ) {
    day =
      Number(match[1]);

    month =
      Number(match[2]);
  } else {
    match =
      text.match(
        MONTH_NAME_DATE_REGEX
      );

    if (match) {
      day =
        Number(match[1]);

      month =
        MONTHS_ES[
          match[2].toLowerCase()
        ];
    } else {
      match =
        null;
    }
  }

  if (
    !match ||
    !day ||
    day < 1 ||
    day > 31 ||
    !month
  ) {
    return {
      dateLabel:
        fallbackDateLabel(
          pubTimestampSeconds
        ),

      cleanTitle:
        text.trim(),
    };
  }

  const year =
    closestYearForDate(
      day,
      month,
      pubTimestampSeconds
    );

  const dateLabel =
    `${pad2(day)}/${pad2(month)}/${year}`;

  let cutStart =
    match.index;

  while (
    cutStart > 0 &&
    /[-:\s]/.test(
      text[cutStart - 1]
    )
  ) {
    cutStart--;
  }

  let cutEnd =
    match.index +
    match[0].length;

  while (
    cutEnd < text.length &&
    /[-:\s]/.test(
      text[cutEnd]
    )
  ) {
    cutEnd++;
  }

  const cleanTitle =
    (
      text.slice(0, cutStart) +
      text.slice(cutEnd)
    ).trim() ||
    text.trim();

  return {
    dateLabel,
    cleanTitle,
  };
}

// ============================================================
// CATEGORIZACIÓN
// ============================================================

const UPDATE_CATEGORIES =
  new Set([
    'server_update',
    'version_update',
    'new_patch',
  ]);

function isUpdateCategory(
  category
) {
  return UPDATE_CATEGORIES.has(
    category
  );
}

function isMaintenanceAnnouncement(
  text
) {
  const value =
    String(text || '')
      .toLowerCase();

  return (
    /mantenimiento/.test(value) ||
    /actualizaci[oó]n global del servidor/.test(value) ||
    /actualizaci[oó]n del servidor/.test(value)
  );
}

function categorizeAnnouncement(
  title
) {
  const t =
    String(title || '')
      .toLowerCase();

  if (
    t.includes('test server')
  ) {
    return 'test_server';
  }

  if (
    t.includes(
      'version update announcement'
    )
  ) {
    return 'version_update';
  }

  if (
    t.includes('anti-cheat')
  ) {
    return 'anti_cheat';
  }

  if (
    t.includes(
      'special crackdown'
    )
  ) {
    return 'crackdown';
  }

  if (
    t.includes(
      'new patch announcement'
    )
  ) {
    return 'new_patch';
  }

  if (
    t.includes(
      'server update announcement'
    )
  ) {
    return 'server_update';
  }

  return 'other';
}

// ============================================================
// TÍTULOS PROTEGIDOS
// ============================================================

const PROTECTED_TITLES = [
  'Super Flow Brawl',
  'Bounty Match',
  'Snowy Brawl',
  'Snowy Sprint',
  'Winter Draw',
];

function isProtectedTitle(
  text
) {
  const normalized =
    String(text || '')
      .trim()
      .toLowerCase();

  return PROTECTED_TITLES.some(
    (title) =>
      title.toLowerCase() ===
      normalized
  );
}

// ============================================================
// HTML
// ============================================================

function decodeHtmlEntities(
  text
) {
  return String(text || '')
    .replace(
      /&(#x[\da-f]+|#\d+|[a-z][\w]+);/gi,
      (entity, value) => {
        const lower =
          value.toLowerCase();

        if (lower === 'nbsp') {
          return ' ';
        }

        if (lower === 'amp') {
          return '&';
        }

        if (lower === 'lt') {
          return '<';
        }

        if (lower === 'gt') {
          return '>';
        }

        if (lower === 'quot') {
          return '"';
        }

        if (lower === 'apos') {
          return "'";
        }

        if (
          lower.startsWith('#x')
        ) {
          const codePoint =
            Number.parseInt(
              lower.slice(2),
              16
            );

          return Number.isFinite(
            codePoint
          )
            ? String.fromCodePoint(
                codePoint
              )
            : entity;
        }

        if (
          lower.startsWith('#')
        ) {
          const codePoint =
            Number.parseInt(
              lower.slice(1),
              10
            );

          return Number.isFinite(
            codePoint
          )
            ? String.fromCodePoint(
                codePoint
              )
            : entity;
        }

        return entity;
      }
    );
}

function stripHtmlTags(
  html
) {
  const source =
    decodeHtmlEntities(
      String(html || '')
    );

  const text =
    source
      .replace(
        /<!--[\s\S]*?-->/g,
        ''
      )
      .replace(
        /<\s*(style|script|noscript)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
        ''
      )
      .replace(
        /<\s*img\b[^>]*\balt\s*=\s*(['"])(.*?)\1[^>]*>/gi,
        '\n$2\n'
      )
      .replace(
        /<\s*(br|\/p|\/div|\/li|\/tr|\/table|\/h[1-6])\b[^>]*>/gi,
        '\n'
      )
      .replace(
        /<\s*(p|div|li|tr|table|h[1-6])\b[^>]*>/gi,
        '\n'
      )
      .replace(
        /<[^>]*>/g,
        ''
      )
      .replace(
        /\r\n?/g,
        '\n'
      );

  return text
    .replace(
      /[ \t]+\n/g,
      '\n'
    )
    .replace(
      /\n[ \t]+/g,
      '\n'
    )
    .replace(
      /\n{3,}/g,
      '\n\n'
    )
    .trim();
}

function cleanHtmlContent(
  html
) {
  let source =
    String(html || '')
      .replace(
        /<!--[\s\S]*?-->/g,
        ''
      )
      .replace(
        /<\s*(head|style|script|noscript)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
        ''
      )
      .replace(
        /<\s*\/?\s*(html|head|body)\b[^>]*>/gi,
        ''
      );

  source =
    source.replace(
      /<([a-z][^>]*)>/gi,
      (match, attributes) =>
        `<${attributes
          .replace(
            /\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
            ''
          )
          .replace(
            /\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
            ''
          )}>`
    );

  return source
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith('<')) return part;
      return decodeHtmlEntities(part)
        .replace(/\u00a0/g, ' ')
        .replace(/[\t\r\n ]+/g, ' ');
    })
    .join('')
    .replace(/>\s+</g, '><')
    .trim();
}

function normalizeHeadingText(
  text
) {
  return stripHtmlTags(
    text
  )
    .replace(
      /^\s*\d+[.)]\s*/,
      ''
    )
    .replace(
      /:\s*$/,
      ''
    )
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    );
}

function isHeroBalanceHeading(
  text
) {
  const normalized =
    normalizeHeadingText(
      text
    );

  if (
    normalized === 'heroes' ||
    normalized === 'hero'
  ) {
    return true;
  }

  const hasHero =
    /\b(?:heroes?|heroico|heroica)\b/.test(
      normalized
    );

  const hasBalanceWord =
    /(balanc|ajust|adjust|enhanc|equilib|cambi|mejor|potenci)/.test(
      normalized
    );

  return (
    hasHero &&
    hasBalanceWord
  );
}

function isSectionHeading(
  text
) {
  const clean =
    stripHtmlTags(
      text
    ).trim();

  if (!clean) {
    return false;
  }

  return (
    clean.length <= 180 &&
    !clean.includes('\n') &&
    !/<[^>]+>/.test(clean)
  );
}

// ============================================================
// TABLAS
// ============================================================

function extractTableText(
  tableHtml
) {
  const rows =
    [];

  const rowRegex =
    /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;

  let rowMatch;

  while (
    (rowMatch =
      rowRegex.exec(
        tableHtml
      )) !== null
  ) {
    const cells =
      [];

    const cellRegex =
      /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi;

    let cellMatch;

    while (
      (cellMatch =
        cellRegex.exec(
          rowMatch[1]
        )) !== null
    ) {
      const value =
        stripHtmlTags(
          cellMatch[2]
        ).trim();

      if (value) {
        cells.push(
          value
        );
      }
    }

    if (cells.length) {
      rows.push(
        cells.join(' | ')
      );
    }
  }

  return rows.join('\n');
}

// ============================================================
// PARSEO HTML
// ============================================================

function parseHtmlContent(
  html
) {
  const source =
    String(html || '');

  const result = {
    heroChanges: [],
    sections: [],
  };

  if (!source.trim()) {
    return result;
  }

  const tableRegex =
    /<table\b[^>]*>[\s\S]*?<\/table>/gi;

  let tableMatch;

  while (
    (tableMatch =
      tableRegex.exec(
        source
      )) !== null
  ) {
    const tableText =
      extractTableText(
        tableMatch[0]
      );

    if (tableText) {
      result.sections.push({
        title: '',
        bodyText:
          tableText,
      });
    }
  }

  const blockRegex =
    /<(h[1-6]|p|div|li|tr)\b[^>]*>[\s\S]*?<\/\1>/gi;

  const blocks =
    [];

  let match;

  while (
    (match =
      blockRegex.exec(
        source
      )) !== null
  ) {
    blocks.push({
      tag:
        match[1].toLowerCase(),

      index:
        match.index,

      html:
        match[0],

      text:
        stripHtmlTags(
          match[0]
        ),
    });
  }

  // ----------------------------------------------------------
  // Buscar encabezado de héroes.
  // ----------------------------------------------------------

  const heroHeadingIndexes =
    [];

  for (
    let i = 0;
    i < blocks.length;
    i++
  ) {
    if (
      isHeroBalanceHeading(
        blocks[i].text
      )
    ) {
      heroHeadingIndexes.push(
        i
      );
    }
  }

  // ----------------------------------------------------------
  // Parseo de cambios de héroes.
  // ----------------------------------------------------------

  for (
    const i of heroHeadingIndexes
  ) {
    const candidate =
      parseHeroChangesFromStrong(
        source,
        blocks[i].index
      );

    if (
      candidate.length
    ) {
      result.heroChanges =
        candidate;

      break;
    }
  }

  // ----------------------------------------------------------
  // Secciones generales.
  // ----------------------------------------------------------

  let currentSection =
    null;

  for (
    let i = 0;
    i < blocks.length;
    i++
  ) {
    const block =
      blocks[i];

    const text =
      block.text.trim();

    if (!text) {
      continue;
    }

    const isHeading =
      /^<h[1-6]\b/i.test(
        block.html
      );

    if (
      isHeading &&
      !isHeroBalanceHeading(
        text
      )
    ) {
      if (
        currentSection
      ) {
        result.sections.push(
          currentSection
        );
      }

      currentSection = {
        title: text,
        bodyText: '',
      };

      continue;
    }

    if (
      currentSection
    ) {
      currentSection.bodyText +=
        currentSection.bodyText
          ? `\n${text}`
          : text;
    }
  }

  if (
    currentSection
  ) {
    result.sections.push(
      currentSection
    );
  }

  return result;
}

// ============================================================
// CAMBIOS DE HÉROES
// ============================================================

function cleanHeroName(
  name
) {
  return stripHtmlTags(
    name || ''
  )
    .replace(
      /^\s*\d+[.)]\s*/,
      ''
    )
    .trim();
}

function isHeroDetailHeading(
  text
) {
  const clean =
    cleanHeroName(
      text
    );

  return (
    /^(skill\s*\d*|habilidad\s*\d*|pasiva|pasivo|ultimate|definitiv[ao]|talento|forma)\b/i.test(
      clean
    ) ||
    /:\s*$/.test(
      clean
    )
  );
}

function cleanChangeText(
  text
) {
  const clean =
    stripHtmlTags(
      text || ''
    ).trim();

  // "+ 55" -> "+55": espacio de más que a veces viene en el HTML crudo
  // de Tencent. No toca el número, solo saca el espacio entre el signo
  // y el dígito.
  // "20 s" -> "20s" y "31 %" -> "31%": mismo caso pero con las unidades
  // de segundos y porcentaje.
  return clean
    .replace(/\+ (\d)/g, '+$1')
    .replace(/(\d) s\b/g, '$1s')
    .replace(/(\d) %/g, '$1%')
    .replace(/\bAtributos atenuados\b/gi, 'Atributos debilitados')
    .replace(/\bAtenuaciones de atributos\b/gi, 'Atributos debilitados');
}

const HERO_STATUS_REGEX =
  /^(?:[a-z]\s*[.)]\s*)?(Atributos potenciados|Atributos debilitados|Atributos atenuados|Atributos ajustados|Atributos reforzados|Potenciadores de atributos|Atenuaciones de atributos|Mejoras? en los atributos|Mejoras? en las mecánicas|Cambios en las habilidades|Mecánicas mejoradas)\s*:?\s*(.+)$/i;

function normalizeHeroStatus(
  status
) {
  if (
    /atenuad|atenuaciones/i.test(
      status
    )
  ) {
    return 'Atributos debilitados';
  }

  return status
    .trim();
}

function inferHeroStatus(
  source,
  heroName
) {
  const lines =
    stripHtmlTags(
      source
    )
      .split('\n')
      .map(
        (line) =>
          line.trim()
      )
      .filter(Boolean);

  const normalizedName =
    heroName
      .normalize('NFD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .toLowerCase();

  for (
    const line of lines
  ) {
    const match =
      line.match(
        HERO_STATUS_REGEX
      );

    if (!match) {
      continue;
    }

    const normalizedList =
      match[2]
        .normalize('NFD')
        .replace(
          /[\u0300-\u036f]/g,
          ''
        )
        .toLowerCase();

    if (
      normalizedList.includes(
        normalizedName
      )
    ) {
      return normalizeHeroStatus(
        match[1]
      );
    }
  }

  return '';
}

function inferNumericHeroStatus(
  changesText
) {
  const pairs =
    [...String(changesText || '')
      .matchAll(
        /(\d+(?:\.\d+)?)\s*→\s*(\d+(?:\.\d+)?)/g
      )]
      .map(
        (match) => [
          Number(match[1]),
          Number(match[2]),
        ]
      );

  if (!pairs.length) {
    return '';
  }

  if (
    pairs.every(
      ([before, now]) =>
        now > before
    )
  ) {
    return 'Atributos potenciados';
  }

  if (
    pairs.every(
      ([before, now]) =>
        now < before
    )
  ) {
    return 'Atributos debilitados';
  }

  return '';
}

function addInferredHeroStatuses(
  heroes,
  source
) {
  return heroes.map(
    (hero) => {
      if (
        /^(Atributos|Potenciadores|Atenuaciones|Mejoras|Mecánicas|Cambios)/i.test(
          hero.changesText
        )
      ) {
        return hero;
      }

      const status =
        inferHeroStatus(
          source,
          hero.name
        ) ||
        inferNumericHeroStatus(
          hero.changesText
        );

      if (!status) {
        return hero;
      }

      return {
        ...hero,
        changesText:
          `${status}\n\n${hero.changesText}`,
      };
    }
  );
}

function parseHeroChangesFromStrong(
  source,
  startIndex
) {
  const result =
    [];

  const region =
    source.slice(
      startIndex
    );

  const strongRegex =
    /<strong\b[^>]*>([\s\S]*?)<\/strong>/gi;

  const strongMatches =
    [];

  let match;

  while (
    (match =
      strongRegex.exec(
        region
      )) !== null
  ) {
    strongMatches.push({
      index:
        match.index,

      html:
        match[0],

      text:
        stripHtmlTags(
          match[1]
        ).trim(),
    });
  }

  const heroStrongMatches =
    strongMatches.filter(
      (candidate) => {
        const name =
          cleanHeroName(
            candidate.text
          );

        return (
          name &&
          !isProtectedTitle(
            name
          ) &&
          !isHeroDetailHeading(
            name
          ) &&
          Object.prototype.hasOwnProperty.call(
            heroLanes,
            canonicalizeHeroName(name)
          )
        );
      }
    );

  const headingRegex =
    /<h[1-6]\b[^>]*>[\s\S]*?<\/h[1-6]>/gi;

  const headingIndexes =
    [];

  let headingMatch;

  while (
    (headingMatch =
      headingRegex.exec(
        region
      )) !== null
  ) {
    const headingText =
      stripHtmlTags(
        headingMatch[0]
      ).trim();

    // Solo headings que NO son el nombre de un héroe cuentan como
    // límite; así una sección general (ej. "Correcciones y mejoras")
    // corta el texto del héroe anterior en vez de quedar pegada a él.
    if (
      headingText &&
      !isProtectedTitle(
        headingText
      )
    ) {
      headingIndexes.push(
        headingMatch.index
      );
    }
  }

  for (
    let i = 0;
    i < heroStrongMatches.length;
    i++
  ) {
    const current =
      heroStrongMatches[i];

    const name =
      cleanHeroName(
        current.text
      );

    if (
      !name ||
      isProtectedTitle(
        name
      )
    ) {
      continue;
    }

    const next =
      heroStrongMatches[
        i + 1
      ];

    const chunkStart =
      current.index +
      current.html.length;

    const nextHeadingIndex =
      headingIndexes.find(
        (idx) => idx >= chunkStart
      );

    const candidateEnds =
      [
        region.length,
      ];

    if (next) {
      candidateEnds.push(
        next.index
      );
    }

    if (
      nextHeadingIndex !==
      undefined
    ) {
      candidateEnds.push(
        nextHeadingIndex
      );
    }

    const endIndex =
      Math.min(
        ...candidateEnds
      );

    const chunk =
      region.slice(
        chunkStart,
        endIndex
      );

    const changeText =
      cleanChangeText(
        chunk
      );


    if (
      changeText &&
      changeText.length > 1
    ) {
      result.push({
        name,
        changesText:
          changeText,
      });
    }
  }

  return result;
}

function normalizeHeroChange(
  hero
) {
  if (!hero) {
    return null;
  }

  const rawName =
    cleanHeroName(
      hero.name
    );

  const name =
    canonicalizeHeroName(
      rawName
    );

  const displayName =
    heroDisplayNameFromRaw(
      rawName
    ) || name;

  const changesText =
    cleanChangeText(
      hero.changesText
    );

  if (!name) {
    return null;
  }

  return {
    name,
    displayName,
    changesText,
  };
}

// ============================================================
// SECCIONES
// ============================================================

function normalizeSection(
  section
) {
  if (!section) {
    return null;
  }

  const title =
    stripHtmlTags(
      section.title || ''
    ).trim();

  const bodyText =
    stripHtmlTags(
      section.bodyText || ''
    ).trim();

  if (
    !title &&
    !bodyText
  ) {
    return null;
  }

  return {
    title,
    bodyText,
  };
}

// ============================================================
// PROCESAR UN ANUNCIO
// ============================================================

async function processPatchEntry(
  rawEntry
) {
  const id =
    rawEntry.id;

  console.log(
    `\nProcesando ${id}: ${rawEntry.title || ''}`
  );

  const parsed =
    parseHtmlContent(
      rawEntry.rawContentHtml ||
        rawEntry.contentHtml ||
        rawEntry.html ||
        ''
    );

  const heroChanges =
    addInferredHeroStatuses(
      parsed.heroChanges
      .map(
        normalizeHeroChange
      )
      .filter(Boolean)
      .filter(
        (hero) => {
          const canonicalName =
            canonicalizeHeroName(
              hero.name
            );

          return Object.prototype.hasOwnProperty.call(
            heroLanes,
            canonicalName
          );
        }
      ),
      rawEntry.rawContentHtml ||
        rawEntry.contentHtml ||
        rawEntry.html ||
        ''
    );

  const sections =
    parsed.sections
      .map(
        normalizeSection
      )
      .filter(Boolean);

  const contentText =
    stripHtmlTags(
      rawEntry.rawContentHtml ||
        rawEntry.contentHtml ||
        rawEntry.html ||
        ''
    );

  const contentHtml =
    cleanHtmlContent(
      rawEntry.rawContentHtml ||
        rawEntry.contentHtml ||
        rawEntry.html ||
        ''
    );

  // Fallback: anuncios sin NINGÚN heading reconocible (puro texto plano,
  // ej. avisos cortos de mantenimiento de servidor). Sin esto, sections
  // y heroChanges quedan vacíos y el anuncio no muestra nada en el sitio
  // aunque sí tenga contenido real. Se arma una sola sección sintética
  // con todo el texto.
  if (
    heroChanges.length === 0 &&
    sections.length === 0 &&
    contentText.trim().length > 0
  ) {
    sections.push({
      title: '',
      bodyText: contentText,
    });
  }

  const entry = {
    ...rawEntry,

    category:
      heroChanges.length === 0 &&
      isMaintenanceAnnouncement(
        `${rawEntry.title || ''}\n${contentText || ''}`
      )
        ? 'other'
        : rawEntry.category ||
          categorizeAnnouncement(
            rawEntry.title
          ),

    heroChanges,

    sections,

    contentHtml,

    contentText,
  };

  const {
    dateLabel,
    cleanTitle,
  } =
    extractTitleDate(
      rawEntry.title,
      rawEntry.pub_timestamp
    );

  entry.dateLabel =
    dateLabel;

  entry.cleanTitle =
    cleanTitle;

  return entry;
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log(
    '=============================================='
  );

  console.log(
    'Procesando anuncios de Honor of Kings'
  );

  console.log(
    '=============================================='
  );

  if (
    !fs.existsSync(
      RAW_DATA_PATH
    )
  ) {
    throw new Error(
      `No existe el archivo fuente: ${RAW_DATA_PATH}`
    );
  }

  const rawData =
    safeReadJson(
      RAW_DATA_PATH,
      null
    );

  if (!rawData) {
    throw new Error(
      'No se pudo cargar anuncios-raw.json'
    );
  }

  let rawItems =
    [];

  if (
    Array.isArray(
      rawData.items
    )
  ) {
    rawItems =
      rawData.items;
  } else if (
    Array.isArray(
      rawData.patches
    )
  ) {
    rawItems =
      rawData.patches;
  } else if (
    Array.isArray(
      rawData
    )
  ) {
    rawItems =
      rawData;
  }

  if (
    !rawItems.length
  ) {
    throw new Error(
      'No se encontraron anuncios para procesar.'
    );
  }

  console.log(
    `Anuncios encontrados: ${rawItems.length}`
  );

  // ----------------------------------------------------------
  // Procesamiento incremental.
  // ----------------------------------------------------------

  const processed =
    [];

  for (
    let i = 0;
    i < rawItems.length;
    i++
  ) {
    const rawEntry =
      rawItems[i];

    try {
      const result =
        await processPatchEntry(
          rawEntry
        );

      processed.push(
        result
      );

      const partialOutput =
        {
          patches:
            processed,
        };

      safeWriteJson(
        DATA_PATH,
        partialOutput
      );

      console.log(
        `  Guardado ${i + 1}/${rawItems.length}`
      );
    } catch (err) {
      console.error(
        `  ERROR procesando ${
          rawEntry.id || '(sin id)'
        }: ${err.message}`
      );

      // Si un anuncio falla, igualmente se conserva
      // en el resultado para no perder información.

      const {
        dateLabel,
        cleanTitle,
      } =
        extractTitleDate(
          rawEntry.title,
          rawEntry.pub_timestamp
        );

      processed.push({
        ...rawEntry,

        category:
          rawEntry.category ||
          categorizeAnnouncement(
            rawEntry.title
          ),

        dateLabel,

        cleanTitle,

        heroChanges:
          Array.isArray(
            rawEntry.heroChanges
          )
            ? rawEntry.heroChanges
            : [],

        sections:
          Array.isArray(
            rawEntry.sections
          )
            ? rawEntry.sections
            : [],
      });

      safeWriteJson(
        DATA_PATH,
        {
          patches:
            processed,
        }
      );
    }
  }

  // ----------------------------------------------------------
  // ORDEN FINAL
  // ----------------------------------------------------------

  processed.sort(
    (a, b) => {
      const ta =
        Number(
          a.pub_timestamp ||
            a.fetched_at ||
            0
        );

      const tb =
        Number(
          b.pub_timestamp ||
            b.fetched_at ||
            0
        );

      return tb - ta;
    }
  );

  // ----------------------------------------------------------
  // ANUNCIOS.JSON
  // ----------------------------------------------------------

  const finalOutput = {
    patches:
      processed,
  };

  safeWriteJson(
    DATA_PATH,
    finalOutput
  );

  // ----------------------------------------------------------
  // UPDATES.JSON
  // ----------------------------------------------------------

  const updates =
    processed.filter(
      (entry) =>
        isUpdateCategory(
          entry.category
        )
    );

  // ----------------------------------------------------------
  // OTROS-ANUNCIOS.JSON
  // ----------------------------------------------------------

  const otherAnnouncements =
    processed.filter(
      (entry) =>
        !isUpdateCategory(
          entry.category
        )
    );

  safeWriteJson(
    UPDATES_PATH,
    {
      patches:
        updates,
    }
  );

  safeWriteJson(
    OTHER_ANNOUNCEMENTS_PATH,
    {
      announcements:
        otherAnnouncements,
    }
  );

  // ----------------------------------------------------------
  // RESUMEN
  // ----------------------------------------------------------

  console.log(
    '\n=============================================='
  );

  console.log(
    `Proceso terminado: ${processed.length} anuncios.`
  );

  console.log(
    `Archivo generado: ${DATA_PATH}`
  );

  console.log(
    `Updates: ${updates.length} -> ${UPDATES_PATH}`
  );

  console.log(
    `Otros anuncios: ${otherAnnouncements.length} -> ${OTHER_ANNOUNCEMENTS_PATH}`
  );

  console.log(
    '=============================================='
  );
}

// ============================================================
// EJECUCIÓN
// ============================================================

module.exports = { main };

if (require.main === module) {
  main().catch(
    (err) => {
      console.error(
        '\nERROR FATAL:'
      );

      console.error(
        err
      );

      process.exit(
        1
      );
    }
  );
}