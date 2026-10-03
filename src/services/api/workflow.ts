import { AxiosResponse } from 'axios';
import { apiClient } from './client';
import {
  AiBalanceResult,
  AiConfigPatchResult,
  AiConnectionTestResult,
  AiIntegrationSettings,
  AiModelInfo,
  ApiResponse,
  BilibiliOpenPlatformPublishResult,
  BilibiliPublishSettings,
  BilibiliPublishSettingsTestResult,
  BilibiliPublishPreview,
  CommandPreset,
  PublishJob,
  WorkflowTask,
  WorkflowSchedule,
  WorkflowSchedulePayload,
  WorkflowBgmCandidate,
  WorkflowPixivOverrides,
  WorkflowPublishCaptionResult,
  WorkflowPublishOverrides,
  WorkflowPrefilterMode,
  WorkflowVideoOverrides,
  WorkflowRenderOptions,
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

  resumeFailedTask: (taskId: string): Promise<AxiosResponse<ApiResponse<WorkflowTask>>> =>
    apiClient.post(`/workflow/tasks/${taskId}/resume`),

  rerenderVideo: (
    taskId: string,
    note?: string,
    options?: WorkflowRenderOptions
  ): Promise<AxiosResponse<ApiResponse<WorkflowTask>>> =>
    apiClient.post(`/workflow/tasks/${taskId}/rerender-video`, { note, options }),

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

  listBgmCandidates: (): Promise<AxiosResponse<ApiResponse<WorkflowBgmCandidate[]>>> =>
    apiClient.get('/workflow/bgm/candidates'),

  savePreset: (
    preset: Omit<CommandPreset, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<CommandPreset, 'id'>>
  ): Promise<AxiosResponse<ApiResponse<CommandPreset>>> =>
    apiClient.post('/workflow/presets', preset),

  deletePreset: (id: string): Promise<AxiosResponse<ApiResponse<{ deleted: boolean }>>> =>
    apiClient.delete(`/workflow/presets/${id}`),

  resetPresets: (): Promise<AxiosResponse<ApiResponse<CommandPreset[]>>> =>
    apiClient.post('/workflow/presets/reset'),

  listSchedules: (): Promise<AxiosResponse<ApiResponse<WorkflowSchedule[]>>> =>
    apiClient.get('/workflow/schedules'),

  saveSchedule: (schedule: {
    id?: string;
    name: string;
    enabled?: boolean;
    cron: string;
    timezone?: string;
    command: string;
    payload?: WorkflowSchedulePayload;
  }): Promise<AxiosResponse<ApiResponse<WorkflowSchedule>>> =>
    schedule.id
      ? apiClient.put(`/workflow/schedules/${schedule.id}`, schedule)
      : apiClient.post('/workflow/schedules', schedule),

  setScheduleEnabled: (
    id: string,
    enabled: boolean
  ): Promise<AxiosResponse<ApiResponse<WorkflowSchedule>>> =>
    apiClient.post(`/workflow/schedules/${id}/enabled`, { enabled }),

  runScheduleNow: (id: string): Promise<AxiosResponse<ApiResponse<WorkflowTask>>> =>
    apiClient.post(`/workflow/schedules/${id}/run`),

  deleteSchedule: (id: string): Promise<AxiosResponse<ApiResponse<{ deleted: boolean }>>> =>
    apiClient.delete(`/workflow/schedules/${id}`),

  listPublishJobs: (): Promise<AxiosResponse<ApiResponse<PublishJob[]>>> =>
    apiClient.get('/workflow/publish-jobs'),

  getPublishJob: (id: string): Promise<AxiosResponse<ApiResponse<PublishJob>>> =>
    apiClient.get(`/workflow/publish-jobs/${id}`),

  cancelPublishJob: (id: string): Promise<AxiosResponse<ApiResponse<PublishJob>>> =>
    apiClient.post(`/workflow/publish-jobs/${id}/cancel`),

  submitPublishJob: (id: string): Promise<AxiosResponse<ApiResponse<PublishJob>>> =>
    apiClient.post(`/workflow/publish-jobs/${id}/submit`),

  getBilibiliPublishSettings: (): Promise<AxiosResponse<ApiResponse<BilibiliPublishSettings>>> =>
    apiClient.get('/workflow/publish-settings/bilibili'),

  saveBilibiliPublishSettings: (
    settings: Partial<Omit<BilibiliPublishSettings, 'configured' | 'updatedAt'>>
  ): Promise<AxiosResponse<ApiResponse<BilibiliPublishSettings>>> =>
    apiClient.put('/workflow/publish-settings/bilibili', settings),

  testBilibiliPublishSettings: (): Promise<AxiosResponse<ApiResponse<BilibiliPublishSettingsTestResult>>> =>
    apiClient.post('/workflow/publish-settings/bilibili/test'),

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

  generateAiConfigPatch: (
    command: string
  ): Promise<AxiosResponse<ApiResponse<AiConfigPatchResult>>> =>
    apiClient.post('/workflow/ai-config-patch', { command }),

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
