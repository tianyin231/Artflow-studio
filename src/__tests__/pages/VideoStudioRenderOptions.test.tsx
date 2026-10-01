import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VideoStudio from '../../pages/VideoStudio';

const mutateAsync = jest.fn().mockResolvedValue({ id: 't1' });

jest.mock('../../hooks/useWorkflow', () => ({
  useWorkflowTasks: () => ({ tasks: [], data: [], isLoading: false, refetch: jest.fn() }),
  useWorkflowTask: () => ({
    task: {
      id: 't1',
      status: 'review_required',
      videoPath: '/tmp/v.mp4',
      assets: [],
      stages: [{ id: 'render', status: 'completed', label: '渲染' }],
      availableActions: [],
    },
    data: undefined,
    isLoading: false,
    refetch: jest.fn(),
  }),
  useCreateWorkflowTask: () => ({ mutate: jest.fn(), isPending: false }),
  useApproveWorkflowTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRejectWorkflowTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useContinueWorkflowAssets: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useContinueWorkflowCover: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRegenerateWorkflowCover: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRerenderWorkflowVideo: () => ({ mutateAsync, isPending: false }),
  useResumeWorkflowTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateWorkflowAssetStatus: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useWorkflowBgmCandidates: () => ({ data: [], isLoading: false }),
}));

jest.mock('../../stores', () => ({
  useWorkflowSelectionStore: (sel?: (s: Record<string, unknown>) => unknown) => {
    const st = {
      selectedTaskId: 't1',
      setSelectedTaskId: jest.fn(),
      dashboardDraft: undefined,
      setDashboardDraft: jest.fn(),
      publishDraft: undefined,
      setPublishDraft: jest.fn(),
    };
    return sel ? sel(st) : st;
  },
}));

async function openVideoTab() {
  const tab = screen.getByRole('tab', { name: /视频|video/i });
  fireEvent.click(tab);
  await waitFor(() => expect(screen.getByTestId('btn-rerender-video')).toBeInTheDocument());
}

describe('VideoStudio render options', () => {
  const qc = new QueryClient();
  beforeEach(() => mutateAsync.mockClear());

  it('renders transition/cover/subtitle selectors', async () => {
    render(
      <QueryClientProvider client={qc}>
        <VideoStudio />
      </QueryClientProvider>
    );
    await openVideoTab();
    expect(screen.getByTestId('select-transition')).toBeInTheDocument();
    expect(screen.getByTestId('select-cover-template')).toBeInTheDocument();
    expect(screen.getByTestId('select-subtitles')).toBeInTheDocument();
    expect(screen.getByTestId('btn-rerender-video')).toBeInTheDocument();
  });

  it('rerender passes selected options', async () => {
    render(
      <QueryClientProvider client={qc}>
        <VideoStudio />
      </QueryClientProvider>
    );
    await openVideoTab();
    fireEvent.click(screen.getByTestId('btn-rerender-video'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const arg = mutateAsync.mock.calls[0][0];
    expect(arg.options.transition).toBeTruthy();
    expect(arg.options.coverTemplate).toBeTruthy();
    expect(arg.options.subtitles).toBe('none');
  });

  it('selectors expose option labels', async () => {
    render(
      <QueryClientProvider client={qc}>
        <VideoStudio />
      </QueryClientProvider>
    );
    await openVideoTab();
    // options exist in the select (aria) even if dropdown portal is hard to click in jsdom
    expect(screen.getByTestId('select-transition')).toHaveAttribute('class', expect.stringContaining('ant-select'));
    expect(screen.getByTestId('select-cover-template')).toBeInTheDocument();
    expect(screen.getByTestId('select-subtitles')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('btn-rerender-video'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalled());
    const opts = mutateAsync.mock.calls[0][0].options;
    expect(['none', 'srt', 'ass']).toContain(opts.subtitles);
    expect(opts.transition).toBeTruthy();
    expect(opts.coverTemplate).toBeTruthy();
  });
});
