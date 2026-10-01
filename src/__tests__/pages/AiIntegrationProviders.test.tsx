import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AiIntegration from '../../pages/AiIntegration';

jest.mock('../../hooks/useAiIntegrationSettings', () => ({
  useAiIntegrationSettings: () => ({
    settings: {
      provider: 'local-rules',
      model: 'local-rule-planner',
      baseUrl: '',
      apiKey: '',
      planningMode: 'rules-first',
    },
    isLoading: false,
    saveSettingsAsync: jest.fn().mockResolvedValue({}),
    isSaving: false,
    fetchModelsAsync: jest.fn().mockResolvedValue([]),
    isFetchingModels: false,
    testConnectionAsync: jest.fn().mockResolvedValue({ ok: true, latencyMs: 12 }),
    isTestingConnection: false,
    queryBalanceAsync: jest.fn().mockResolvedValue({}),
    isQueryingBalance: false,
    generateConfigPatchAsync: jest.fn().mockResolvedValue({}),
    isGeneratingConfigPatch: false,
  }),
}));

jest.mock('../../hooks/useWorkflow', () => ({
  useWorkflowBgmCandidates: () => ({ data: [], isLoading: false, refetch: jest.fn(), isFetching: false }),
}));

describe('AiIntegration providers & usage', () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  it('shows provider presets and prompt version', async () => {
    render(
      <QueryClientProvider client={qc}>
        <AiIntegration />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByTestId('provider-presets-card')).toBeInTheDocument());
    expect(screen.getByTestId('preset-openai')).toBeInTheDocument();
    expect(screen.getByTestId('preset-mock')).toBeInTheDocument();
    expect(screen.getByTestId('prompt-version-card')).toBeInTheDocument();
    expect(screen.getByTestId('select-prompt-version')).toBeInTheDocument();
  });

  it('shows token usage card and simulates usage', async () => {
    render(
      <QueryClientProvider client={qc}>
        <AiIntegration />
      </QueryClientProvider>
    );
    await waitFor(() => expect(screen.getByTestId('token-usage-card')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('btn-simulate-usage'));
    await waitFor(() => {
      expect(screen.getByTestId('token-usage-card').textContent).toMatch(/cost/);
    });
  });
});
