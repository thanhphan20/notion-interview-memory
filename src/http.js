const fs = require('node:fs/promises');
const path = require('node:path');

async function handleLocalRequest({ method, url, body, staticDir, api }) {
  const parsed = new URL(url, 'http://localhost');

  if (parsed.pathname.startsWith('/api/')) {
    const result = await api.dispatch(method, parsed.pathname + parsed.search, body || {});
    return {
      status: result.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify(result.body)
    };
  }

  return serveStatic(parsed.pathname, staticDir);
}

async function serveStatic(pathname, staticDir) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const target = path.resolve(staticDir, relative);
  const root = path.resolve(staticDir);

  if (!target.startsWith(root)) {
    return textResponse(403, 'Forbidden');
  }

  try {
    const body = await fs.readFile(target, 'utf8');
    return {
      status: 200,
      headers: { 'content-type': mimeType(target) },
      body
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return textResponse(404, 'Not found');
    }
    throw error;
  }
}

function textResponse(status, body) {
  return {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
    body
  };
}

function mimeType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

function createNodeRequestHandler({ api, staticDir }) {
  return async (request, response) => {
    try {
      const body = await readJsonBody(request);
      const result = await handleLocalRequest({
        method: request.method,
        url: request.url,
        body,
        staticDir,
        api
      });
      response.writeHead(result.status, result.headers);
      response.end(result.body);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: error.message }));
    }
  };
}

async function readJsonBody(request) {
  if (!['POST', 'PUT', 'PATCH'].includes(request.method)) return null;
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  return raw ? JSON.parse(raw) : {};
}

module.exports = {
  createNodeRequestHandler,
  handleLocalRequest
};
