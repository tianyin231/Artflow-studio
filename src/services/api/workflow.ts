import { AxiosResponse } from 'axios';
import { apiClient } from './client';
import {
  AiBalanceResult,
  AiConnectionTestResult,
  AiIntegrationSettings,
  AiModelInfo,
  ApiResponse,
  BilibiliOpenPlatformPublishResult,
  BilibiliPublishPreview,
  CommandPreset,
  WorkflowTask,
  WorkflowPixivOverrides,
  WorkflowPublishCaptionResult,
  WorkflowPublishOverrides,
  WorkflowPrefilterMode,
  WorkflowVideoOverrides,
} from './types';

export const workflowApi = {
  listTasks: (): Promise<AxiosResponse<ApiResponse<WorkflowTask[]>>> =>
    apiClient.get('/workflow/tasks'),

  getTask: (taskId: string): Promise<AxiosResponse<ApiResponse<WorkflowTask>>> =>
    apiClient.get(`/workflow/tasks/${taskId}`),

  createTask: (
    command: string,
    dryRunDownload = false,
    videoOverrides?: WorkflowVideoOverrides,
    pixivOverrides?: WorkflowPixivOverrides,
    prefilterMode?: WorkflowPrefilterMode,
    publishOverrides?: WorkflowPublishOverrides
  ): Promise<AxiosResponse<ApiResponse<WorkflowTask>>> =>
    apiClient.post('/workflow/tasks', { command, dryRunDownload, videoOverrides, pixivOverrides, prefilterMode, publishOverrides }),

  approveTask: (taskId: string, note?: string): Promise<AxiosResponse<ApiResponse<WorkflowTask>>> =>
    apiClient.post(`/workflow/tasks/${taskId}/approve`, { note }),

  rejectTask: (taskId: string, note?: string): Promise<AxiosResponse<ApiResponse<WorkflowTask>>> =>
    apiClient.post(`/workflow/tasks/${taskId}/reject`, { note }),

  continueAfterAssetReview: (
    taskId: string,
    mode: WorkflowPrefilterMode
  ): Promise<AxiosResponse<ApiResponse<WorkflowTask>>> =>
    apiClient.post(`/workflow/tasks/${taskId}/continue-assets`, { mode }),

  continueAfterCoverReview: (taskId: string): Promise<AxiosResponse<ApiResponse<WorkflowTask>>> =>
    apiClient.post(`/workflow/tasks/${taskId}/continue-cover`),

  regenerateCover: (
    taskId: string,
    options: { assetNames?: string[]; layout?: string; title?: string }
  ): Promise<AxiosResponse<ApiResponse<WorkflowTask>>> =>
    apiClient.post(`/workflow/tasks/${taskId}/regenerate-cover`, options),

  updateAssetStatus: (
    taskId: string,
    assetName: string,
    status: 'accepted' | 'rejected',
    reason?: string
  ): Promise<AxiosResponse<ApiResponse<WorkflowTask>>> =>
    apiClient.patch(`/workflow/tasks/${taskId}/assets/${encodeURIComponent(assetName)}`, { status, reason }),

  listPresets: (): Promise<AxiosResponse<ApiResponse<CommandPreset[]>>> =>
    apiClient.get('/workflow/presets'),

  savePreset: (
    preset: Omit<CommandPreset, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<CommandPreset, 'id'>>
  ): Promise<AxiosResponse<ApiResponse<CommandPreset>>> =>
    apiClient.post('/workflow/presets', preset),

  deletePreset: (id: string): Promise<AxiosResponse<ApiResponse<{ deleted: boolean }>>> =>
    apiClient.delete(`/workflow/presets/${id}`),

  resetPresets: (): Promise<AxiosResponse<ApiResponse<CommandPreset[]>>> =>
    apiClient.post('/workflow/presets/reset'),

  getAiSettings: (): Promise<AxiosResponse<ApiResponse<AiIntegrationSettings>>> =>
    apiClient.get('/workflow/ai-settings'),

  saveAiSettings: (
    settings: AiIntegrationSettings
  ): Promise<AxiosResponse<ApiResponse<AiIntegrationSettings>>> =>
    apiClient.put('/workflow/ai-settings', settings),

  fetchAiModels: (
    settings: AiIntegrationSettings
  ): Promise<AxiosResponse<ApiResponse<AiModelInfo[]>>> =>
    apiClient.post('/workflow/ai-settings/models', settings),

  testAiConnection: (
    settings: AiIntegrationSettings
  ): Promise<AxiosResponse<ApiResponse<AiConnectionTestResult>>> =>
    apiClient.post('/workflow/ai-settings/test', settings),

  queryAiBalance: (
    settings: AiIntegrationSettings
  ): Promise<AxiosResponse<ApiResponse<AiBalanceResult>>> =>
    apiClient.post('/workflow/ai-settings/balance', settings),

  generatePublishCaption: (payload: {
    command?: string;
    tag?: string;
    sources?: Array<{ title?: string; authorName?: string; pixivId?: string; url?: string }>;
    syncArticle?: boolean;
  }): Promise<AxiosResponse<ApiResponse<WorkflowPublishCaptionResult>>> =>
    apiClient.post('/workflow/publish-caption', payload),

  previewBilibiliPublish: (taskId: string): Promise<AxiosResponse<ApiResponse<BilibiliPublishPreview>>> =>
    apiClient.get(`/workflow/tasks/${taskId}/publish/preview`),

  publishBilibiliOpenPlatform: (
    taskId: string,
    credentials?: { clientId?: string; clientSecret?: string; accessToken?: string; refreshToken?: string }
  ): Promise<AxiosResponse<ApiResponse<{
    video: BilibiliOpenPlatformPublishResult;
    article?: BilibiliOpenPlatformPublishResult;
    preview: BilibiliPublishPreview;
  }>>> =>
    apiClient.post(`/workflow/tasks/${taskId}/publish/bilibili-open-platform`, { credentials }),
};
