/** The few HTTP helpers both Lagoon servers share (back office and live workflow). */
const fs = require('fs');
const path = require('path');

const MAX_JSON = 16 * 1024;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function send(res, status, body, headers = {}) {
  const json = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    'content-type': json ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(json ? JSON.stringify(body) : body);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      // Past the limit, the rest is read and dropped: cutting the socket would lose the 413.
      if (size > MAX_JSON) reject(Object.assign(new Error('Too large'), { status: 413 }));
      else chunks.push(chunk);
    });
    req.on('end', () => {
      if (size > MAX_JSON) return;
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        reject(Object.assign(new Error('Invalid request'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/** A file of `folder`, or 404; `page` answers every path without a dot (one-page app). */
function servePublic(res, folder, urlPath, page = 'index.html') {
  const name = urlPath === '/' || !path.extname(urlPath) ? page : urlPath.slice(1);
  const file = path.join(folder, path.normalize(name));
  if (!file.startsWith(folder) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return send(res, 404, 'Not found');
  }

  return send(res, 200, fs.readFileSync(file), {
    'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
  });
}

/** `--name value` from the command line, else `fallback`. */
function option(argv, name, fallback = null) {
  const at = argv.indexOf(`--${name}`);

  return at >= 0 && argv[at + 1] ? argv[at + 1] : fallback;
}

/** The arguments that are not options (nor an option's value). */
function positional(argv) {
  return argv.filter((arg, i) => !arg.startsWith('--') && !argv[i - 1]?.startsWith('--'));
}

const expandHome = file => path.resolve(String(file).replace(/^~(?=\/)/, process.env.HOME));

/**
 * The key the Lagoon servers use: a dedicated Lagoon service account's when the .env has one
 * (FOREST_LAGOON_GATEWAY_KEY), otherwise the partner portal's (FOREST_GATEWAY_KEY). Only the name
 * leaves this function, never the value.
 */
function keyNameIn(env) {
  return env.FOREST_LAGOON_GATEWAY_KEY ? 'FOREST_LAGOON_GATEWAY_KEY' : 'FOREST_GATEWAY_KEY';
}

module.exports = { expandHome, keyNameIn, option, positional, readJson, send, servePublic };
