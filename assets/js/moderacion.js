const MODERATION_API_URL = 'https://reddragons-community.ed-ragons-eb.workers.dev';
let moderationToken = '';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

function setFeedback(message, isError = false) {
  const feedback = document.getElementById('moderation-feedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.toggle('is-error', isError);
}

async function moderationRequest(path, options = {}) {
  const response = await fetch(`${MODERATION_API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${moderationToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Error HTTP ${response.status}`);
  return result;
}

function compositionCard(composition) {
  const note = composition.moderationNote
    ? `<p class="moderation-note"><strong>Motivo:</strong> ${escapeHtml(composition.moderationNote)}</p>`
    : '';
  return `
    <article class="moderation-card">
      <div class="moderation-card__header">
        <span class="status status-${escapeHtml(composition.status)}">${escapeHtml(composition.status)}</span>
        <small>${new Date(composition.createdAt * 1000).toLocaleString('es-AR')}</small>
      </div>
      <p><strong>Héroes:</strong> ${composition.heroes.map(escapeHtml).join(', ')}</p>
      <h3>Descripción completa</h3>
      <p class="moderation-text">${escapeHtml(composition.description)}</p>
      <h3>Nota completa</h3>
      <p class="moderation-text">${escapeHtml(composition.notes)}</p>
      ${note}
      <div class="moderation-actions">
        <button class="cta-btn secondary" data-action="approve" data-id="${escapeHtml(composition.id)}">Aprobar</button>
        <button class="cta-btn ghost" data-action="reject" data-id="${escapeHtml(composition.id)}">Rechazar</button>
        <button class="cta-btn danger" data-action="delete" data-id="${escapeHtml(composition.id)}">Eliminar</button>
      </div>
    </article>
  `;
}

function reportCard(report) {
  return `
    <article class="moderation-card report-card">
      <div class="moderation-card__header"><strong>${escapeHtml(report.field)}</strong><small>${new Date(report.createdAt * 1000).toLocaleString('es-AR')}</small></div>
      <h3>Texto completo reportado</h3>
      <p class="moderation-text">${escapeHtml(report.value)}</p>
      <h3>Texto detectado como prohibido</h3>
      <p class="moderation-terms">${report.matches.map((match) => `<code>${escapeHtml(match)}</code>`).join(' ')}</p>
      <p><strong>Héroes:</strong> ${report.heroes.map(escapeHtml).join(', ') || 'No informados'}</p>
    </article>
  `;
}

async function loadModerationQueue() {
  setFeedback('Cargando...');
  try {
    const result = await moderationRequest('/admin/compositions');
    document.getElementById('moderation-compositions').innerHTML = result.compositions.length
      ? result.compositions.map(compositionCard).join('')
      : '<p class="moderation-empty">No hay composiciones para revisar.</p>';
    document.getElementById('moderation-reports').innerHTML = result.reports.length
      ? result.reports.map(reportCard).join('')
      : '<p class="moderation-empty">No hay reportes pendientes.</p>';
    setFeedback('');
  } catch (error) {
    setFeedback(error.message, true);
  }
}

async function handleModerationAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === 'delete' && !window.confirm('¿Eliminar definitivamente esta composición?')) return;
  let note = '';
  if (action === 'reject') {
    note = window.prompt('Motivo del rechazo:')?.trim() || '';
    if (!note) return;
  }
  button.disabled = true;
  try {
    const endpoint = action === 'delete'
      ? `/admin/compositions/${encodeURIComponent(id)}`
      : `/admin/compositions/${encodeURIComponent(id)}/${action}`;
    await moderationRequest(endpoint, {
      method: action === 'delete' ? 'DELETE' : 'POST',
      body: action === 'delete' ? undefined : JSON.stringify({ note })
    });
    await loadModerationQueue();
  } catch (error) {
    button.disabled = false;
    setFeedback(error.message, true);
  }
}

document.getElementById('moderation-login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  moderationToken = document.getElementById('moderation-token').value;
  try {
    await moderationRequest('/admin/compositions');
    document.getElementById('moderation-login').hidden = true;
    document.getElementById('moderation-content').hidden = false;
    await loadModerationQueue();
  } catch (error) {
    moderationToken = '';
    document.getElementById('moderation-login-feedback').textContent = error.message;
  }
});
document.getElementById('moderation-refresh')?.addEventListener('click', loadModerationQueue);
document.getElementById('moderation-compositions')?.addEventListener('click', handleModerationAction);
