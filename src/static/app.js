const state = {
  data: null,
  activeCard: null,
  activeStartedAt: null,
  lastCritique: null
};

const views = document.querySelectorAll('.view');
const navButtons = document.querySelectorAll('.nav button');
const statusBox = document.querySelector('#status');

navButtons.forEach((button) => {
  button.addEventListener('click', () => showView(button.dataset.view));
});

document.querySelector('#refreshButton').addEventListener('click', loadState);
document.querySelector('#syncButton').addEventListener('click', syncNotion);
document.querySelector('#settingsForm').addEventListener('submit', saveSettings);

loadSettings();
loadState();

function showView(name) {
  navButtons.forEach((button) => button.classList.toggle('active', button.dataset.view === name));
  views.forEach((view) => view.classList.toggle('active', view.id === name));
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: { 'content-type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Request failed.');
  return payload;
}

async function loadSettings() {
  try {
    const settings = await api('/api/settings');
    const form = document.querySelector('#settingsForm');
    const notion = settings.notion || {};
    const ai = settings.ai || {};
    form.token.value = notion.token || '';
    form.databaseId.value = notion.databaseId || '';
    form.titleProperty.value = notion.titleProperty || 'Name';
    form.topicProperty.value = notion.topicProperty || 'Topic';
    form.topics.value = Array.isArray(notion.topics) ? notion.topics.join(',') : '';
    form.provider.value = ai.provider || 'offline';
    form.apiKey.value = ai.apiKey || '';
    form.baseUrl.value = ai.baseUrl || '';
    form.model.value = ai.model || '';
  } catch (error) {
    showStatus(error.message, true);
  }
}

async function saveSettings(event) {
  event.preventDefault();
  const form = event.currentTarget;
  await api('/api/settings', {
    method: 'POST',
    body: {
      notion: {
        token: form.token.value.trim(),
        databaseId: form.databaseId.value.trim(),
        titleProperty: form.titleProperty.value.trim() || 'Name',
        topicProperty: form.topicProperty.value.trim() || 'Topic',
        topics: form.topics.value.split(',').map((topic) => topic.trim()).filter(Boolean)
      },
      ai: {
        provider: form.provider.value,
        apiKey: form.apiKey.value.trim(),
        baseUrl: form.baseUrl.value.trim(),
        model: form.model.value.trim()
      }
    }
  });
  showStatus('Settings saved.');
}

async function loadState() {
  try {
    state.data = await api('/api/state');
    renderMetrics();
    renderPractice();
    renderDrafts();
    renderNotes();
    renderHistory();
  } catch (error) {
    showStatus(error.message, true);
  }
}

function renderMetrics() {
  document.querySelector('#dueCount').textContent = state.data.stats.dueCount;
  document.querySelector('#draftCount').textContent = state.data.stats.draftCount;
  document.querySelector('#reviewCount').textContent = state.data.stats.reviewCount;
}

function renderPractice() {
  const container = document.querySelector('#practiceCard');
  const card = state.activeCard || state.data.dueCards[0];
  state.activeCard = card || null;
  if (!card) {
    container.innerHTML = '<p class="muted">No cards are due. Approve drafts or come back when scheduled cards are ready.</p>';
    return;
  }
  if (!state.activeStartedAt) state.activeStartedAt = Date.now();

  container.innerHTML = `
    <h3>${escapeHtml(card.question)}</h3>
    <div class="tags">${card.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
    <div class="answer-panel">
      <textarea id="answerInput" placeholder="Answer as if an interviewer asked you this question."></textarea>
      <div class="actions">
        <button id="critiqueButton" class="secondary">AI Critique</button>
        <button id="showAnswerButton" class="secondary">Show Answer</button>
      </div>
      <div id="answerKey" hidden>
        <h3>Expected Answer</h3>
        <p>${escapeHtml(card.expectedAnswer)}</p>
        <h3>Rubric</h3>
        <ul class="rubric">${card.rubric.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
      </div>
      <div id="critiquePanel" class="feedback" hidden></div>
      <div class="actions">
        <button data-rating="again" class="danger">Again</button>
        <button data-rating="hard" class="secondary">Hard</button>
        <button data-rating="good">Good</button>
        <button data-rating="easy">Easy</button>
      </div>
    </div>
  `;

  document.querySelector('#showAnswerButton').addEventListener('click', () => {
    document.querySelector('#answerKey').hidden = false;
  });
  document.querySelector('#critiqueButton').addEventListener('click', requestCritique);
  document.querySelectorAll('[data-rating]').forEach((button) => {
    button.addEventListener('click', () => submitReview(button.dataset.rating));
  });
}

async function requestCritique() {
  const answer = document.querySelector('#answerInput').value.trim();
  if (!answer) {
    showStatus('Write an answer before requesting critique.', true);
    return;
  }
  const result = await api(`/api/cards/${state.activeCard.id}/critique`, {
    method: 'POST',
    body: { answer }
  });
  state.lastCritique = result.critique;
  const panel = document.querySelector('#critiquePanel');
  panel.hidden = false;
  panel.innerHTML = `
    <h3>AI Critique</h3>
    <p>${escapeHtml(result.critique.summary)}</p>
    <p class="muted">Suggested rating: ${escapeHtml(result.critique.suggestedRating)}</p>
    ${result.critique.missingKeyPoints.length ? `<ul class="rubric">${result.critique.missingKeyPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>` : ''}
  `;
}

async function submitReview(rating) {
  const answer = document.querySelector('#answerInput').value.trim();
  if (!answer) {
    showStatus('Write an answer before grading the card.', true);
    return;
  }
  await api(`/api/cards/${state.activeCard.id}/review`, {
    method: 'POST',
    body: {
      answer,
      aiFeedback: state.lastCritique,
      rating,
      elapsedSeconds: Math.round((Date.now() - state.activeStartedAt) / 1000)
    }
  });
  state.activeCard = null;
  state.activeStartedAt = null;
  state.lastCritique = null;
  showStatus('Review saved.');
  await loadState();
}

function renderDrafts() {
  const container = document.querySelector('#draftList');
  if (state.data.drafts.length === 0) {
    container.innerHTML = '<p class="muted">No pending drafts.</p>';
    return;
  }
  container.innerHTML = state.data.drafts.map((draft) => `
    <article class="item">
      <h3>${escapeHtml(draft.question)}</h3>
      <p>${escapeHtml(draft.expectedAnswer)}</p>
      <ul class="rubric">${draft.rubric.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul>
      <div class="tags">${draft.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="actions">
        <button data-approve="${draft.id}">Approve</button>
        <button class="secondary" data-reject="${draft.id}">Reject</button>
      </div>
    </article>
  `).join('');
  container.querySelectorAll('[data-approve]').forEach((button) => {
    button.addEventListener('click', () => approveDraft(button.dataset.approve));
  });
  container.querySelectorAll('[data-reject]').forEach((button) => {
    button.addEventListener('click', () => rejectDraft(button.dataset.reject));
  });
}

async function renderNotes() {
  const container = document.querySelector('#noteList');
  if (state.data.notes.length === 0) {
    container.innerHTML = '<p class="muted">No notes synced yet.</p>';
    return;
  }
  container.innerHTML = state.data.notes.map((note) => `
    <article class="item">
      <h3>${escapeHtml(note.title)}</h3>
      <p class="muted">${escapeHtml(note.content.slice(0, 220))}${note.content.length > 220 ? '...' : ''}</p>
      <div class="tags">${note.tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="actions">
        <button data-generate="${note.id}">Generate Drafts</button>
        ${note.sourceUrl ? `<a href="${escapeAttribute(note.sourceUrl)}" target="_blank" rel="noreferrer">Open Notion</a>` : ''}
      </div>
    </article>
  `).join('');
  container.querySelectorAll('[data-generate]').forEach((button) => {
    button.addEventListener('click', () => generateDrafts(button.dataset.generate));
  });
}

function renderHistory() {
  const container = document.querySelector('#historyList');
  if (state.data.reviews.length === 0) {
    container.innerHTML = '<p class="muted">No reviews yet.</p>';
    return;
  }
  container.innerHTML = state.data.reviews.map((review) => `
    <article class="item">
      <h3>${escapeHtml(review.rating.toUpperCase())}</h3>
      <p>${escapeHtml(review.userAnswer)}</p>
      ${review.aiFeedback ? `<p class="muted">AI: ${escapeHtml(review.aiFeedback.summary)}</p>` : ''}
      <p class="muted">${new Date(review.reviewedAt).toLocaleString()}</p>
    </article>
  `).join('');
}

async function syncNotion() {
  showStatus('Syncing Notion...');
  try {
    const result = await api('/api/notion/sync', { method: 'POST', body: {} });
    showStatus(`Synced ${result.imported} notes.`);
    await loadState();
  } catch (error) {
    showStatus(error.message, true);
  }
}

async function generateDrafts(noteId) {
  showStatus('Generating drafts...');
  try {
    const result = await api(`/api/notes/${noteId}/generate`, { method: 'POST', body: {} });
    showStatus(`Generated ${result.drafts.length} drafts.`);
    await loadState();
    showView('drafts');
  } catch (error) {
    showStatus(error.message, true);
  }
}

async function approveDraft(id) {
  await api(`/api/drafts/${id}/approve`, { method: 'POST', body: {} });
  showStatus('Draft approved.');
  await loadState();
}

async function rejectDraft(id) {
  await api(`/api/drafts/${id}/reject`, { method: 'POST', body: {} });
  showStatus('Draft rejected.');
  await loadState();
}

function showStatus(message, isError = false) {
  statusBox.hidden = false;
  statusBox.textContent = message;
  statusBox.classList.toggle('error', isError);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
