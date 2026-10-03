import React from 'react';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AiIntegration from '../../pages/AiIntegration';

const saveSettingsAsync = jest.fn();
const fetchModelsAsync = jest.fn();
const testConnectionAsync = jest.fn();
const settings = {
  provider: 'openai',
  model: 'original-model',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: 'original-provider-key',
  planningMode: 'ai-first',
};

jest.mock('../../hooks/useAiIntegrationSettings', () => ({
  useAiIntegrationSettings: () => ({
    settings,
    isLoading: false,
    saveSettingsAsync,
    isSaving: false,
    fetchModelsAsync,
    isFetchingModels: false,
    testConnectionAsync,
    isTestingConnection: false,
    queryBalanceAsync: jest.fn().mockResolvedValue({}),
    isQueryingBalance: false,
    generateConfigPatchAsync: jest.fn().mockResolvedValue({}),
    isGeneratingConfigPatch: false,
  }),
}));

describe('AiIntegration providers & usage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    saveSettingsAsync.mockResolvedValue({});
    fetchModelsAsync.mockResolvedValue([{ id: 'provider-specific-model' }]);
    testConnectionAsync.mockResolvedValue({ ok: true, latencyMs: 12, message: 'Original provider connected' });
  });

  const renderPage = () => render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AiIntegration />
    </QueryClientProvider>
  );

  it('labels unavailable usage and prompt controls accurately', async () => {
    renderPage();
    expect(await screen.findByTestId('provider-presets-card')).toBeInTheDocument();
    expect(screen.getByTestId('token-usage-card')).toHaveTextContent('当前工作流接口未提供 Token 用量与费用统计');
    expect(screen.getByTestId('prompt-version-card')).toHaveTextContent('当前工作流接口不支持选择 Prompt 版本');
    expect(screen.queryByTestId('btn-simulate-usage')).not.toBeInTheDocument();
    expect(screen.queryByTestId('select-prompt-version')).not.toBeInTheDocument();
  });

  it.each([
    ['openai', 'openai', 'https://api.openai.com/v1', 'gpt-4o-mini'],
    ['deepseek', 'openai', 'https://api.deepseek.com/v1', 'deepseek-chat'],
    ['dashscope', 'openai', 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'qwen-plus'],
    ['mimo', 'openai', 'https://api.xiaomimimo.com/v1', 'mimo-v2.6-pro'],
    ['mock', 'openai', 'http://127.0.0.1:3302/v1', 'mock'],
    ['ollama', 'ollama', 'http://127.0.0.1:11434', 'llama3'],
  ])('saves %s using the backend protocol and resets the previous provider key', async (id, provider, baseUrl, model) => {
    renderPage();
    fireEvent.click(await screen.findByTestId(`preset-${id}`));
    await waitFor(() => expect(screen.getByLabelText('Base URL')).toHaveValue(baseUrl));
    expect(screen.getByLabelText('API Key')).toHaveValue('');
    expect(screen.getByLabelText('模型')).toHaveValue(model);
    fireEvent.click(screen.getByText('保存配置'));
    await waitFor(() => expect(saveSettingsAsync).toHaveBeenCalledWith({ provider, baseUrl, model, apiKey: '', planningMode: 'ai-first' }));
  });

  it('does not show the previous provider models or connection result after a preset switch', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /获取模型/ }));
    await waitFor(() => expect(screen.getByLabelText('模型')).toHaveValue('provider-specific-model'));
    fireEvent.click(screen.getByRole('button', { name: /测速/ }));
    const connection = within(screen.getByTestId('ai-connection-card'));
    expect(await connection.findByText('Original provider connected')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('preset-deepseek'));
    await waitFor(() => expect(screen.getByLabelText('模型')).toHaveValue('deepseek-chat'));
    expect(connection.queryByText('Original provider connected')).not.toBeInTheDocument();
    expect(screen.getByText('点击“测速”后显示连接状态和延迟。')).toBeInTheDocument();
  });

  it('ignores a model request that completes after switching providers', async () => {
    let finishFetch: (models: Array<{ id: string }>) => void = () => undefined;
    fetchModelsAsync.mockImplementationOnce(() => new Promise((resolve) => { finishFetch = resolve; }));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /获取模型/ }));
    await waitFor(() => expect(fetchModelsAsync).toHaveBeenCalled());
    fireEvent.click(screen.getByTestId('preset-deepseek'));
    await act(async () => { finishFetch([{ id: 'stale-provider-model' }]); });
    expect(screen.getByLabelText('模型')).toHaveValue('deepseek-chat');
  });
});
