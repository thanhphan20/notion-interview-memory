const { createAiProvider } = require('./ai');
const { syncNotionDatabase } = require('./notion');

function createApi(options = {}) {
  const db = options.db;
  if (!db) throw new Error('createApi requires a database instance.');

  const injectedAiProvider = options.aiProvider;
  const notionSync = options.notionSync || ((config) => syncNotionDatabase(config));

  async function dispatch(method, rawUrl, body = {}) {
    try {
      const url = new URL(rawUrl, 'http://localhost');
      const pathname = url.pathname;

      if (method === 'GET' && pathname === '/api/state') {
        const now = url.searchParams.get('now') ? new Date(url.searchParams.get('now')) : new Date();
        return ok({
          stats: db.stats(now),
          notes: db.listNotes(),
          drafts: db.listDrafts('draft'),
          cards: db.listCards(),
          dueCards: db.listDueCards(now),
          reviews: db.listReviews()
        });
      }

      if (method === 'GET' && pathname === '/api/settings') {
        return ok({
          notion: db.getSetting('notion') || {},
          ai: db.getSetting('ai') || { provider: 'offline' }
        });
      }

      if (method === 'POST' && pathname === '/api/settings') {
        db.setSetting('notion', body.notion || {});
        db.setSetting('ai', body.ai || { provider: 'offline' });
        return ok({ saved: true });
      }

      if (method === 'POST' && pathname === '/api/notion/sync') {
        const config = {
          ...(db.getSetting('notion') || {}),
          ...(body || {})
        };
        const result = await notionSync(config);
        const notes = result.notes.map((note) => db.upsertNote(note));
        return ok({ imported: notes.length, notes });
      }

      const generateMatch = pathname.match(/^\/api\/notes\/(\d+)\/generate$/);
      if (method === 'POST' && generateMatch) {
        const note = db.getNote(Number(generateMatch[1]));
        if (!note) return notFound('Note not found.');
        const generated = await getAiProvider().generateCards(note);
        const drafts = db.createDrafts(note.id, generated);
        return ok({ drafts });
      }

      const approveMatch = pathname.match(/^\/api\/drafts\/(\d+)\/approve$/);
      if (method === 'POST' && approveMatch) {
        const now = body.now ? new Date(body.now) : new Date();
        const card = db.approveDraft(Number(approveMatch[1]), now);
        return ok({ card });
      }

      const rejectMatch = pathname.match(/^\/api\/drafts\/(\d+)\/reject$/);
      if (method === 'POST' && rejectMatch) {
        const draft = db.rejectDraft(Number(rejectMatch[1]));
        return ok({ draft });
      }

      const critiqueMatch = pathname.match(/^\/api\/cards\/(\d+)\/critique$/);
      if (method === 'POST' && critiqueMatch) {
        const card = db.getCard(Number(critiqueMatch[1]));
        if (!card) return notFound('Card not found.');
        const critique = await getAiProvider().critiqueAnswer({
          card,
          answer: body.answer || ''
        });
        return ok({ critique });
      }

      const reviewMatch = pathname.match(/^\/api\/cards\/(\d+)\/review$/);
      if (method === 'POST' && reviewMatch) {
        const review = db.recordReview({
          cardId: Number(reviewMatch[1]),
          userAnswer: body.answer || '',
          aiFeedback: body.aiFeedback || null,
          rating: body.rating,
          elapsedSeconds: Number(body.elapsedSeconds || 0),
          reviewedAt: body.reviewedAt ? new Date(body.reviewedAt) : new Date()
        });
        return ok({ review, schedule: db.getSchedule(Number(reviewMatch[1])) });
      }

      return notFound('Route not found.');
    } catch (error) {
      return {
        status: 400,
        body: { error: error.message }
      };
    }
  }

  function getAiProvider() {
    return injectedAiProvider || createAiProvider(db.getSetting('ai') || {});
  }

  return { dispatch };
}

function ok(body) {
  return { status: 200, body };
}

function notFound(message) {
  return { status: 404, body: { error: message } };
}

module.exports = {
  createApi
};
