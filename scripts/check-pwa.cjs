#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const dist = path.join(__dirname, '..', 'dist');
const required = ['manifest.webmanifest', 'sw.js', 'registerSW.js', 'index.html'];
const missing = required.filter((f) => !fs.existsSync(path.join(dist, f)));
if (missing.length) {
  console.error('check-pwa: missing', missing.join(', '));
  process.exit(1);
}
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!html.includes('manifest.webmanifest') || !html.includes('registerSW')) {
  console.error('check-pwa: index.html missing wiring');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.webmanifest'), 'utf8'));
if (!manifest.name || !manifest.start_url) {
  console.error('check-pwa: manifest incomplete');
  process.exit(1);
}
console.log('check-pwa: OK', { name: manifest.name, start_url: manifest.start_url });
