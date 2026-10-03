/**
 * PublishPlatforms page tests (F1).
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PublishPlatforms from '../../pages/PublishPlatforms';
import { api } from '../../services/api';
import { message } from 'antd';

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

  it('shows backend failure details without announcing success', async () => {
    const success = jest.spyOn(message, 'success');
    jest.mocked(api.dryRunPublish).mockResolvedValueOnce({ data: { data: { status: 'failed', message: 'title exceeds 100 chars' } } } as never);
    renderPage();
    fireEvent.click(await screen.findByTestId('btn-dryrun-local-export'));
    expect(await screen.findByTestId('dry-run-result')).toHaveTextContent('title exceeds 100 chars');
    expect(screen.getByTestId('dry-run-result')).toHaveClass('ant-alert-error');
    expect(success).not.toHaveBeenCalled();
    success.mockRestore();
  });

  it('shows load errors instead of substituting a ready catalog', async () => {
    jest.mocked(api.listPublishers).mockRejectedValueOnce(new Error('Publisher service unavailable'));
    renderPage();
    expect(await screen.findByTestId('publishers-error')).toHaveTextContent('Publisher service unavailable');
    expect(screen.queryByTestId('platform-local-export')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '刷新状态' }));
    expect(await screen.findByTestId('platform-local-export')).toBeInTheDocument();
    expect(screen.queryByTestId('publishers-error')).not.toBeInTheDocument();
  });

  it('keeps platform limitations when the API only returns state', async () => {
    jest.mocked(api.listPublishers).mockResolvedValueOnce({ data: { data: [{ id: 'telegram', displayName: 'Telegram', enabled: false, auth: 'botToken', state: 'not_configured' }] } } as never);
    renderPage();
    expect(await screen.findByText(/Bot API sendVideo/)).toBeInTheDocument();
    expect(screen.getByText('not_configured')).toBeInTheDocument();
  });
});
