/// <reference types="@testing-library/jest-dom" />
import React from 'react';
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from '../../pages/Dashboard';
import { screen, waitFor } from '@testing-library/react';

// Dashboard is a workflow console (not the old stats page).
jest.mock('../../hooks/useWorkflow', () => ({
  useWorkflowTasks: () => ({ tasks: [], data: [], isLoading: false, refetch: jest.fn() }),
  useWorkflowTask: () => ({ task: undefined, data: undefined, isLoading: false, refetch: jest.fn() }),
  useCreateWorkflowTask: () => ({ mutate: jest.fn(), isPending: false }),
  useApproveWorkflowTask: () => ({ mutate: jest.fn(), isPending: false }),
  useRejectWorkflowTask: () => ({ mutate: jest.fn(), isPending: false }),
  useContinueWorkflowAssets: () => ({ mutate: jest.fn(), isPending: false }),
  useContinueWorkflowCover: () => ({ mutate: jest.fn(), isPending: false }),
  useRegenerateWorkflowCover: () => ({ mutate: jest.fn(), isPending: false }),
  useRerenderWorkflowVideo: () => ({ mutate: jest.fn(), isPending: false }),
  useResumeWorkflowTask: () => ({ mutate: jest.fn(), isPending: false }),
  useUpdateWorkflowAssetStatus: () => ({ mutate: jest.fn(), isPending: false }),
  useWorkflowBgmCandidates: () => ({
    candidates: [],
    data: [],
    isLoading: false,
    refetch: jest.fn(),
    isFetching: false,
  }),
}));

jest.mock('../../hooks/useCommandPresets', () => ({
  useCommandPresets: () => ({
    presets: [],
    data: [],
    isLoading: false,
    addPresetAsync: jest.fn(),
    isAdding: false,
  }),
}));

jest.mock('../../stores', () => ({
  useWorkflowSelectionStore: (selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      selectedTaskId: undefined,
      setSelectedTaskId: jest.fn(),
      dashboardDraft: undefined,
      setDashboardDraft: jest.fn(),
      publishDraft: undefined,
      setPublishDraft: jest.fn(),
    };
    return selector ? selector(state) : state;
  },
}));

describe('Dashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithProviders = (ui: React.ReactElement) =>
    render(
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    );

  it('renders product title', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText('Pixiv Auto Flow')).toBeInTheDocument();
  });

  it('renders natural language command input', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText('自然语言指令（可选）')).toBeInTheDocument();
  });

  it('renders parse command button', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText('解析指令并填充')).toBeInTheDocument();
  });

  it('renders workflow pipeline card', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText('工作流管道')).toBeInTheDocument();
  });

  it('renders AI workflow details card', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText('AI 工作流详情')).toBeInTheDocument();
  });

  it('shows empty state when no workflow tasks', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByText('暂无工作流任务')).toBeInTheDocument();
  });

  it('renders tag field', () => {
    renderWithProviders(<Dashboard />);
    expect(screen.getByPlaceholderText('例如：鳴潮 / 原神 / 初音ミク')).toBeInTheDocument();
  });

  it('does not throw when mounting', async () => {
    renderWithProviders(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('Pixiv Auto Flow')).toBeInTheDocument();
    });
  });
});
