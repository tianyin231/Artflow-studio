import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { message } from 'antd';
import VideoStudio from '../../pages/VideoStudio';
import { WorkflowTask } from '../../services/api/types';

const mutateAsync = jest.fn();
let mockTask: WorkflowTask;

jest.mock('../../hooks/useCommandPresets', () => ({ useCommandPresets: () => ({ presets: [] }) }));
jest.mock('../../hooks/useWorkflow', () => ({
  useWorkflowTasks: () => ({ tasks: [mockTask], isLoading: false, refetch: jest.fn() }),
  useWorkflowTask: () => ({ task: mockTask, isLoading: false, refetch: jest.fn() }),
  useCreateWorkflowTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useApproveWorkflowTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRejectWorkflowTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useContinueWorkflowAssets: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useContinueWorkflowCover: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRerenderWorkflowVideo: () => ({ mutateAsync, isPending: false }),
  useResumeWorkflowTask: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateWorkflowAssetStatus: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

jest.mock('../../stores', () => ({
  useWorkflowSelectionStore: (sel: (state: unknown) => unknown) => sel({ selectedTaskId: mockTask.id, setSelectedTaskId: jest.fn() }),
}));

function makeTask(): WorkflowTask {
  return {
    id: 't1', command: 'test', status: 'review_required', createdAt: '', updatedAt: '', logs: [],
    videoPath: '/tmp/v.mp4', assets: [{ name: 'a.png', path: '/tmp/a.png', width: 320, height: 180, size: 100, status: 'accepted' }],
    stages: [{ id: 'render', status: 'completed', label: '渲染', message: '', progress: 100 }],
    availableActions: [],
    plan: {
      title: 'Test', description: '', pixivTarget: { type: 'illustration' },
      video: { style: 'beat', motion: 'auto', width: 320, height: 180, fps: 12, secondsPerImage: 1, crossfade: 0.2, zoom: 1.04, maxImages: 1, shuffleSeed: 1 },
      publish: { platform: 'bilibili', dryRun: true, category: '', tags: [], original: false, aigc: false },
    },
  };
}

async function openVideoTab() {
  fireEvent.click(screen.getByRole('tab', { name: '视频审核' }));
  await screen.findByTestId('btn-rerender-video');
}

async function selectOption(testId: string, label: string) {
  fireEvent.mouseDown(screen.getByTestId(testId).querySelector('.ant-select-selector')!);
  fireEvent.click(await screen.findByText(label));
}

describe('VideoStudio render options', () => {
  let qc: QueryClient;
  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    mockTask = makeTask();
    mutateAsync.mockReset().mockResolvedValue(mockTask);
  });
  afterEach(() => { qc.clear(); jest.restoreAllMocks(); });

  function page() { return <QueryClientProvider client={qc}><VideoStudio /></QueryClientProvider>; }

  it('submits the choices actually selected in the controls', async () => {
    render(page());
    await openVideoTab();
    await selectOption('select-transition', '转场: 闪白');
    await selectOption('select-cover-template', '封面: 拼贴');
    await selectOption('select-subtitles', '字幕文件: ASS');
    fireEvent.click(screen.getByTestId('btn-rerender-video'));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ taskId: 't1', note: expect.any(String), options: { transition: 'flash-white', coverTemplate: 'collage', subtitles: 'ass' } }));
  });

  it('restores saved choices per task and keeps local edits through polling updates', async () => {
    Object.assign(mockTask.plan!.video, { transition: 'push-left', coverTemplate: 'single', subtitles: 'srt' });
    const view = render(page());
    await openVideoTab();
    expect(screen.getByTestId('select-transition')).toHaveTextContent('左推');
    await selectOption('select-transition', '转场: 闪白');
    mockTask = { ...mockTask, updatedAt: 'later', plan: { ...mockTask.plan!, video: { ...mockTask.plan!.video } } };
    view.rerender(page());
    expect(screen.getByTestId('select-transition')).toHaveTextContent('闪白');
    mockTask = { ...makeTask(), id: 't2' };
    view.rerender(page());
    await waitFor(() => expect(screen.getByTestId('select-transition')).toHaveTextContent('交叉淡化'));
    expect(screen.getByTestId('select-subtitles')).toHaveTextContent('无');
  });

  it.each(['running', 'approved'] as const)('blocks a second render while a task is %s even if the old video remains available', async (status) => {
    mockTask.status = status;
    render(page());
    await openVideoTab();
    expect(screen.getByTestId('btn-rerender-video')).toBeDisabled();
    fireEvent.click(screen.getByTestId('btn-rerender-video'));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('can retry a failed render with no video and reports request failures', async () => {
    mockTask.status = 'failed';
    mockTask.videoPath = undefined;
    mutateAsync.mockRejectedValue(new Error('Render failed'));
    const error = jest.spyOn(message, 'error').mockImplementation(() => (() => {}) as ReturnType<typeof message.error>);
    render(page());
    await openVideoTab();
    expect(screen.getByTestId('btn-rerender-video')).toBeEnabled();
    fireEvent.click(screen.getByTestId('btn-rerender-video'));
    await waitFor(() => expect(error).toHaveBeenCalledWith('Render failed'));
  });

  it('offers the subtitle artifact generated by the backend', async () => {
    mockTask.subtitlePath = '/tmp/v.ass';
    mockTask.plan!.video.subtitles = 'ass';
    render(page());
    await openVideoTab();
    expect(screen.getByRole('link', { name: '下载字幕文件（ASS）' })).toHaveAttribute('href', '/api/workflow/tasks/t1/subtitles');
  });
});
