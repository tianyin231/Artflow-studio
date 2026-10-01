/**
 * Electron security config (F2-M4).
 */
export interface ElectronSecurityConfig {
  contextIsolation: boolean;
  sandbox: boolean;
  nodeIntegration: boolean;
  preloadAllowlist: string[];
}

export const DEFAULT_SECURITY: ElectronSecurityConfig = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  preloadAllowlist: ['auth.startLogin', 'auth.completeLogin', 'auth.importToken', 'app.getVersion'],
};

export function validateSecurity(cfg: ElectronSecurityConfig): string[] {
  const errs: string[] = [];
  if (!cfg.contextIsolation) errs.push('contextIsolation must be true');
  if (!cfg.sandbox) errs.push('sandbox must be true');
  if (cfg.nodeIntegration) errs.push('nodeIntegration must be false');
  if (!cfg.preloadAllowlist || cfg.preloadAllowlist.length === 0) errs.push('preload allowlist required');
  return errs;
}
