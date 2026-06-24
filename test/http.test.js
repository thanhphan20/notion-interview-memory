const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { handleLocalRequest } = require('../src/http');

test('handleLocalRequest serves index html for the app shell', async () => {
  const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nim-static-'));
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<main>Interview Memory</main>');

  const response = await handleLocalRequest({
    method: 'GET',
    url: '/',
    body: null,
    staticDir,
    api: { dispatch: async () => ({ status: 404, body: { error: 'nope' } }) }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(response.body, '<main>Interview Memory</main>');
});

test('handleLocalRequest dispatches JSON API requests', async () => {
  const response = await handleLocalRequest({
    method: 'POST',
    url: '/api/example',
    body: { ok: true },
    staticDir: os.tmpdir(),
    api: {
      dispatch: async (method, url, body) => ({
        status: 200,
        body: { method, url, received: body.ok }
      })
    }
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(JSON.parse(response.body), {
    method: 'POST',
    url: '/api/example',
    received: true
  });
});
