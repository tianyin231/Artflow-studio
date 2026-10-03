import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkPwa } from '../../../scripts/check-pwa.cjs';

// Build-artifact integration runs via npm run test:pwa; the unit suite also runs on a clean checkout.

describe('PWA artifacts', () => {
  let dist: string;
  beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), 'artflow-pwa-'));
  });
  afterEach(() => rmSync(dist, { recursive: true, force: true }));

  function writeArtifacts() {
    writeFileSync(join(dist, 'index.html'), '<link href="manifest.webmanifest"><script src="registerSW.js"></script>');
    writeFileSync(join(dist, 'registerSW.js'), 'navigator.serviceWorker.register("sw.js")');
    writeFileSync(join(dist, 'sw.js'), 'icons/artflow-192.png icons/artflow-512.png');
    writeFileSync(join(dist, 'manifest.webmanifest'), JSON.stringify({
      name: 'Artflow', short_name: 'Artflow', start_url: '/', scope: '/', display: 'standalone',
      icons: [192, 512].map((size) => ({
        src: `/icons/artflow-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any',
      })),
    }));
    mkdirSync(join(dist, 'icons'));
    for (const size of [192, 512]) {
      const png = Buffer.alloc(24);
      Buffer.from('89504e470d0a1a0a', 'hex').copy(png);
      png.writeUInt32BE(size, 16);
      png.writeUInt32BE(size, 20);
      writeFileSync(join(dist, `icons/artflow-${size}.png`), png);
    }
  }

  it('fails before a production build exists', () => {
    expect(() => checkPwa(dist)).toThrow(/missing/);
  });

  it('requires actual PNG install icons and verifies their dimensions', () => {
    writeArtifacts();
    rmSync(join(dist, 'icons/artflow-192.png'));
    expect(() => checkPwa(dist)).toThrow();
    writeFileSync(join(dist, 'icons/artflow-192.png'), '<svg/>');
    expect(() => checkPwa(dist)).toThrow(/invalid 192px/);
  });

  it('requires install icons to be available offline', () => {
    writeArtifacts();
    writeFileSync(join(dist, 'sw.js'), 'icons/artflow-192.png');
    expect(() => checkPwa(dist)).toThrow(/precache/);
  });

  it('accepts complete artifacts', () => {
    writeArtifacts();
    expect(checkPwa(dist).name).toBe('Artflow');
  });
});
