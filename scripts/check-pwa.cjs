#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function checkPwa(dist) {
  const required = ['manifest.webmanifest', 'sw.js', 'registerSW.js', 'index.html'];
  const missing = required.filter((file) => !fs.existsSync(path.join(dist, file)));
  if (missing.length) throw new Error(`missing ${missing.join(', ')}`);
  const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  if (!html.includes('manifest.webmanifest') || !html.includes('registerSW')) {
    throw new Error('index.html missing manifest/service worker wiring');
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'manifest.webmanifest'), 'utf8'));
  if (!manifest.name || !manifest.short_name || manifest.start_url !== '/' ||
    manifest.scope !== '/' || manifest.display !== 'standalone') {
    throw new Error('manifest incomplete');
  }
  for (const size of [192, 512]) {
    const icon = manifest.icons?.find((item) => item.type === 'image/png' &&
      item.sizes === `${size}x${size}` && (!item.purpose || item.purpose.split(' ').includes('any')));
    if (!icon) throw new Error(`manifest requires a ${size}px PNG install icon`);
    const iconPath = path.resolve(dist, icon.src.replace(/^\//, ''));
    if (!iconPath.startsWith(`${path.resolve(dist)}${path.sep}`)) throw new Error('invalid icon path');
    const data = fs.readFileSync(iconPath);
    if (data.length < 24 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      data.readUInt32BE(16) !== size || data.readUInt32BE(20) !== size) {
      throw new Error(`invalid ${size}px PNG icon`);
    }
  }
  const sw = fs.readFileSync(path.join(dist, 'sw.js'), 'utf8');
  for (const icon of manifest.icons) {
    if (!sw.includes(icon.src.replace(/^\//, ''))) throw new Error('install icons missing from precache');
  }
  return manifest;
}

if (require.main === module) {
  try {
    const manifest = checkPwa(path.join(__dirname, '..', 'dist'));
    console.log('check-pwa: OK', { name: manifest.name, start_url: manifest.start_url });
  } catch (error) {
    console.error('check-pwa:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { checkPwa };
