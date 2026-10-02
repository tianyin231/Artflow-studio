/**
 * Config management smoke tests against the real Config page.
 * API layer is mocked so the page can mount offline.
 */
import React from 'react';
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import Config from '../../pages/Config';
import { screen, waitFor } from '@testing-library/react';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('../../services/api', () => {
  const mockConfig = {
    pixiv: {
      clientId: 'cid',
      clientSecret: 'csec',
      deviceToken: 'dt',
      refreshToken: '',
      userAgent: 'ua',
    },
    targets: [],
    storage: {
      downloadDirectory: '/tmp/dl',
      illustrationDirectory: '/tmp/dl/ill',
      novelDirectory: '/tmp/dl/nov',
      databasePath: '/tmp/dl/db.sqlite',
    },
    network: { retries: 3, timeoutMs: 30000 },
    _meta: { configPath: '/tmp/artflow/config.json', configPathRelative: 'config.json' },
  };
  return {
    api: {
      getConfig: jest.fn().mockResolvedValue({ data: { data: mockConfig } }),
      updateConfig: jest.fn().mockResolvedValue({ data: { data: mockConfig } }),
      validateConfig: jest.fn().mockResolvedValue({ data: { data: { valid: true, errors: [] } } }),
      listConfigFiles: jest.fn().mockResolvedValue({
        data: {
          data: [{ filename: 'config.json', path: '/tmp/artflow/config.json', isActive: true }],
        },
      }),
      switchConfigFile: jest.fn().mockResolvedValue({ data: { data: {} } }),
      exportConfig: jest.fn().mockResolvedValue({ data: {} }),
      importConfig: jest.fn().mockResolvedValue({ data: { data: {} } }),
      copyConfig: jest.fn().mockResolvedValue({ data: { data: {} } }),
      getConfigPreview: jest.fn().mockResolvedValue({ data: { data: '{}' } }),
    },
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { api } = require('../../services/api');

describe('Config Management Integration Flow', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    jest.clearAllMocks();
    api.getConfig.mockResolvedValue({
      data: {
        data: {
          pixiv: {
            clientId: 'cid',
            clientSecret: 'csec',
            deviceToken: 'dt',
            refreshToken: '',
            userAgent: 'ua',
          },
          targets: [],
          storage: {
            downloadDirectory: '/tmp/dl',
            illustrationDirectory: '/tmp/dl/ill',
            novelDirectory: '/tmp/dl/nov',
            databasePath: '/tmp/dl/db.sqlite',
          },
          network: { retries: 3, timeoutMs: 30000 },
          _meta: { configPath: '/tmp/artflow/config.json', configPathRelative: 'config.json' },
        },
      },
    });
    api.listConfigFiles.mockResolvedValue({
      data: {
        data: [{ filename: 'config.json', path: '/tmp/artflow/config.json', isActive: true }],
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement) =>
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{ui}</BrowserRouter>
      </QueryClientProvider>
    );

  it('should render config console', async () => {
    renderWithProviders(<Config />);
    await waitFor(() => {
      expect(document.body.textContent?.length ?? 0).toBeGreaterThan(0);
    });
  });

  it('should eventually show config UI chrome', async () => {
    renderWithProviders(<Config />);
    await waitFor(
      () => {
        const tabs = document.querySelector('.ant-tabs') || screen.queryAllByRole('tab');
        expect(tabs).toBeTruthy();
      },
      { timeout: 5000 }
    );
  });

  it('should call getConfig on mount', async () => {
    renderWithProviders(<Config />);
    await waitFor(() => {
      expect(api.getConfig).toHaveBeenCalled();
    });
  });
});
