function escapeUpdateHtml(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[character]);
}

function sanitizeAnnouncementHtml(rawHtml) {
  if (!rawHtml) return '';
  const documentFragment = new DOMParser().parseFromString(rawHtml, 'text/html');
  const allowedTags = new Set([
    'A', 'B', 'BR', 'EM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'IMG', 'LI', 'OL', 'P', 'PRE', 'STRONG', 'TABLE', 'TBODY',
    'TD', 'TH', 'THEAD', 'TR', 'U', 'UL'
  ]);
  const allowedAttributes = new Set(['alt', 'colspan', 'href', 'rel', 'rowspan', 'src', 'target']);

  function cleanNode(node) {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      if (!allowedTags.has(child.tagName)) {
        if (['SCRIPT', 'STYLE', 'HEAD', 'IFRAME', 'OBJECT', 'VIDEO', 'AUDIO'].includes(child.tagName)) {
          child.remove();
          return;
        }
        cleanNode(child);
        child.replaceWith(...child.childNodes);
        return;
      }

      [...child.attributes].forEach((attribute) => {
        if (!allowedAttributes.has(attribute.name.toLowerCase())) child.removeAttribute(attribute.name);
      });
      if (child.tagName === 'A' && !/^https?:\/\//i.test(child.getAttribute('href') || '')) {
        child.removeAttribute('href');
        child.removeAttribute('target');
      }
      if (child.tagName === 'IMG' && !/^https?:\/\//i.test(child.getAttribute('src') || '')) {
        child.remove();
        return;
      }
      cleanNode(child);
    });
  }

  cleanNode(documentFragment.body);
  return documentFragment.body.innerHTML;
}

function renderAnnouncementContent(announcement) {
  const originalHtml = sanitizeAnnouncementHtml(
    announcement.contentHtml || announcement.rawContentHtml
  );
  if (originalHtml) return `<div class="update-rich-content">${originalHtml}</div>`;

  const sections = (announcement.sections || [])
    .filter((section) => section.bodyText || section.title)
    .map((section) => `
      <section class="update-content-section">
        ${section.title ? `<h3>${escapeUpdateHtml(section.title)}</h3>` : ''}
        ${section.bodyText ? renderStructuredText(section.bodyText) : ''}
      </section>
    `)
    .join('');

  if (sections) return sections;
  return announcement.contentText
    ? `<p class="update-content-text">${escapeUpdateHtml(announcement.contentText)}</p>`
    : '<p class="update-empty">Este anuncio no tiene contenido disponible.</p>';
}

function renderStructuredText(text) {
  const lines = String(text || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return '';

  let html = '';
  let listItems = [];
  const flushList = () => {
    if (!listItems.length) return;
    html += `<ol>${listItems.map((item) => `<li>${escapeUpdateHtml(item)}</li>`).join('')}</ol>`;
    listItems = [];
  };

  lines.forEach((line) => {
    const numbered = line.match(/^\d+[.)]\s*(.+)$/);
    if (numbered) {
      listItems.push(numbered[1]);
      return;
    }
    flushList();
    html += `<p>${escapeUpdateHtml(line)}</p>`;
  });
  flushList();
  return html;
}

async function initUpdateDetail() {
  const status = document.getElementById('status');
  const detail = document.getElementById('update-detail');
  const patchId = window.location.hash.replace(/^#patch-/, '');

  if (!patchId) {
    status.textContent = 'No se indicó ninguna actualización.';
    return;
  }

  try {
    const announcements = await loadAnnouncements();
    const patch = announcements.find((entry) => entry.id === patchId);
    if (!patch) {
      status.textContent = 'No se encontró esa actualización.';
      return;
    }

    const heroes = patch.heroChanges || [];
    detail.innerHTML = `
      <span class="mini-badge adjusted">${escapeUpdateHtml(categoryLabel(patch.category))}</span>
      <h1>${escapeUpdateHtml(patch.title_es || patch.title)}</h1>
      <p class="update-meta">${escapeUpdateHtml(formatDate(patch.pub_timestamp))}</p>
      ${heroes.length
        ? `<section class="update-heroes-section">
            <h2>Cambios de héroes</h2>
            <ul class="update-hero-list">${heroes.map((hero) => `
            <li class="update-hero-item">
              <span class="update-hero-name">${escapeUpdateHtml(hero.displayName || hero.name)}</span>
              <span class="update-hero-changes">${escapeUpdateHtml(hero.changesText)}</span>
            </li>
          `).join('')}</ul>
          </section>`
        : ''
      }
      <section class="update-content">
        <h2>Contenido del anuncio</h2>
        ${renderAnnouncementContent(patch)}
      </section>
    `;
    document.title = `${patch.title_es || patch.title} · Red Dragons`;
    status.hidden = true;
    detail.hidden = false;
  } catch (error) {
    status.textContent = `No se pudo cargar la actualización: ${error.message}`;
    console.error(error);
  }
}

initUpdateDetail();
