import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('PWA artifacts', () => {
  const dist = join(__dirname, '../../../dist');
  it('manifest + sw + registerSW exist', () => {
    expect(existsSync(join(dist, 'manifest.webmanifest'))).toBe(true);
    expect(existsSync(join(dist, 'sw.js'))).toBe(true);
    expect(existsSync(join(dist, 'registerSW.js'))).toBe(true);
  });

  it('index.html wires manifest and SW', () => {
    const html = readFileSync(join(dist, 'index.html'), 'utf8');
    expect(html).toContain('manifest.webmanifest');
    expect(html).toContain('registerSW');
  });

  it('manifest is installable-shaped', () => {
    const m = JSON.parse(readFileSync(join(dist, 'manifest.webmanifest'), 'utf8'));
    expect(m.name).toBeTruthy();
    expect(m.start_url).toBe('/');
    expect(m.display).toBe('standalone');
    expect(Array.isArray(m.icons)).toBe(true);
  });
});
