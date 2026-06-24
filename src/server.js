const http = require('node:http');
const path = require('node:path');
const { createApi } = require('./api');
const { createAppDatabase } = require('./database');
const { createNodeRequestHandler } = require('./http');

const port = Number(process.env.PORT || 4173);
const db = createAppDatabase();
const api = createApi({ db });
const staticDir = path.join(__dirname, 'static');

const server = http.createServer(createNodeRequestHandler({ api, staticDir }));

server.listen(port, () => {
  console.log(`Notion Interview Memory running at http://localhost:${port}`);
});

process.on('SIGINT', () => {
  db.close();
  server.close(() => process.exit(0));
});
