/**
 * PublishPlatforms page tests (F1).
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PublishPlatforms from '../../pages/PublishPlatforms';
import { api } from '../../services/api';

jest.mock('../../services/api', () => ({
  api: {
    listPublishers: jest.fn().mockResolvedValue({
      data: {
        data: [
          {
            id: 'local-export',
            displayName: '本地发布包',
            enabled: true,
            auth: 'none',
            state: 'ok',
            notes: '完全可行',
          },
          {
            id: 'xiaohongshu',
            displayName: '小红书（仅导出）',
            enabled: false,
            manualOnly: true,
            auth: 'none',
            state: 'not_configured',
            notes: '无公开 API',
          },
        ],
      },
    }),
    dryRunPublish: jest.fn().mockResolvedValue({ data: { data: { status: 'dry_run' } } }),
  },
}));

describe('PublishPlatforms', () => {
  let queryClient: QueryClient;
  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    jest.clearAllMocks();
  });

  const renderPage = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <PublishPlatforms />
      </QueryClientProvider>
    );

  it('lists publishers with notes', async () => {
    renderPage();
    expect(await screen.findByTestId('publish-platforms-page')).toBeInTheDocument();
    expect(await screen.findByTestId('platform-local-export')).toBeInTheDocument();
    expect(await screen.findByTestId('platform-xiaohongshu')).toBeInTheDocument();
  });

  it('dryRun button calls API', async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-dryrun-local-export'));
    await waitFor(() => expect(api.dryRunPublish).toHaveBeenCalledWith('local-export'));
  });
});
