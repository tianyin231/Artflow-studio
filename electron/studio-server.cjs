const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs/promises');
const path = require('node:path');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};

async function startStudioServer(dist, coreUrl) {
  const root = path.resolve(dist);
  await fs.access(path.join(root, 'index.html'));
  const core = new URL(coreUrl);
  const transport = core.protocol === 'https:' ? https : http;
  const isBackend = (url) => /^\/(api|socket\.io)(\/|\?|$)/.test(url || '');
  const isTrustedRequest = (req) => {
    const host = `127.0.0.1:${server.address().port}`;
    return req.headers.host === host && (!req.headers.origin || req.headers.origin === `http://${host}`);
  };

  const server = http.createServer(async (req, res) => {
    if (!isTrustedRequest(req)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (isBackend(req.url)) {
      const upstream = transport.request(new URL(req.url, core), {
        method: req.method, headers: { ...req.headers, host: core.host },
      }, (response) => {
        res.writeHead(response.statusCode || 502, response.headers);
        response.pipe(res);
        response.on('error', () => res.destroy());
      });
      upstream.setTimeout(30_000, () => upstream.destroy());
      upstream.on('error', () => {
        if (res.headersSent) return res.destroy();
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Artflow-core is unavailable' }));
      });
      req.on('aborted', () => upstream.destroy());
      req.pipe(upstream);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405);
      res.end();
      return;
    }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      let file = path.resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const ext = path.extname(file);
      // Only page routes use the SPA fallback. Missing assets must be a 404.
      if (!ext) file = path.join(root, 'index.html');
      const data = await fs.readFile(file);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      res.writeHead(error instanceof URIError ? 400 : 404);
      res.end();
    }
  });

  server.on('upgrade', (req, socket, head) => {
    if (!isTrustedRequest(req) || !isBackend(req.url)) return socket.destroy();
    const upstream = transport.request(new URL(req.url, core), {
      headers: { ...req.headers, host: core.host },
    });
    upstream.on('upgrade', (response, upstreamSocket, upstreamHead) => {
      const headers = Object.entries(response.headers).map(([key, value]) => `${key}: ${value}`);
      socket.write(`HTTP/1.1 101 Switching Protocols\r\n${headers.join('\r\n')}\r\n\r\n`);
      if (upstreamHead.length) socket.write(upstreamHead);
      if (head.length) upstreamSocket.write(head);
      upstreamSocket.on('error', () => socket.destroy());
      socket.on('error', () => upstreamSocket.destroy());
      socket.on('close', () => upstreamSocket.destroy());
      upstreamSocket.on('close', () => socket.destroy());
      socket.pipe(upstreamSocket).pipe(socket);
    });
    upstream.on('response', () => socket.destroy());
    upstream.on('error', () => socket.destroy());
    upstream.end();
  });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

module.exports = { startStudioServer };
