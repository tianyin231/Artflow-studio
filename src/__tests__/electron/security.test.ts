import { DEFAULT_SECURITY, validateSecurity } from '../../../electron/security';

describe('electron security', () => {
  it('default config is secure', () => {
    expect(validateSecurity(DEFAULT_SECURITY)).toEqual([]);
    expect(DEFAULT_SECURITY.contextIsolation).toBe(true);
    expect(DEFAULT_SECURITY.sandbox).toBe(true);
    expect(DEFAULT_SECURITY.nodeIntegration).toBe(false);
  });
  it('rejects insecure configs', () => {
    expect(validateSecurity({ ...DEFAULT_SECURITY, nodeIntegration: true }).length).toBeGreaterThan(0);
    expect(validateSecurity({ ...DEFAULT_SECURITY, sandbox: false }).length).toBeGreaterThan(0);
    expect(validateSecurity({ ...DEFAULT_SECURITY, contextIsolation: false }).length).toBeGreaterThan(0);
  });
});
