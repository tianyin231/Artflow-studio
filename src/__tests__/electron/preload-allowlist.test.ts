import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_SECURITY, validateSecurity } from '../../../electron/security';

describe('electron preload allowlist', () => {
  it('preload only exposes allowlisted channels', () => {
    const preload = readFileSync(join(__dirname, '../../../electron/preload.cjs'), 'utf8');
    for (const ch of DEFAULT_SECURITY.preloadAllowlist) {
      expect(preload).toContain(ch);
    }
    expect(validateSecurity(DEFAULT_SECURITY)).toEqual([]);
  });
});
