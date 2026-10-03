const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { startStudioServer } = require('../electron/studio-server.cjs');

test('packaged server serves SPA routes and assets and proxies Core requests without caching API data', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'artflow-desktop-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'assets'));
  await fs.writeFile(path.join(root, 'index.html'), '<html><div id="root"></div></html>');
  await fs.writeFile(path.join(root, 'assets', 'app.js'), 'console.log("studio")');
  const received = [];
  const core = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    received.push({ method: req.method, url: req.url, body });
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ errorCode: 'AUTH_REQUIRED' }));
  });
  await new Promise((resolve) => core.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => core.close(resolve)));
  const { server, url } = await startStudioServer(root, `http://127.0.0.1:${core.address().port}`);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const index = await fetch(`${url}/accounts`);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /text\/html/);
  assert.match(await index.text(), /id="root"/);
  const asset = await fetch(`${url}/assets/app.js`);
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal(await asset.text(), 'console.log("studio")');
  assert.equal((await fetch(`${url}/assets/missing.js`)).status, 404);
  assert.equal((await fetch(`${url}/api/auth/accounts`, { headers: { Origin: 'https://example.invalid' } })).status, 403);
  const rebound = await new Promise((resolve, reject) => {
    http.get(`${url}/api/auth/accounts`, { headers: { Host: 'example.invalid' } }, (response) => {
      response.resume();
      resolve(response.statusCode);
    }).on('error', reject);
  });
  assert.equal(rebound, 403);
  assert.equal((await fetch(`${url}/%2e%2e%2fsecret.txt`)).status, 403);
  const response = await fetch(`${url}/api/auth/login/complete`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginId: 'mock-id', callback: 'mock-code' }),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { errorCode: 'AUTH_REQUIRED' });
  assert.deepEqual(received, [{
    method: 'POST', url: '/api/auth/login/complete',
    body: '{"loginId":"mock-id","callback":"mock-code"}',
  }]);
  await new Promise((resolve) => core.close(resolve));
  const unavailable = await fetch(`${url}/api/auth/accounts`);
  assert.equal(unavailable.status, 503);
  assert.match(unavailable.headers.get('content-type'), /json/);
});
