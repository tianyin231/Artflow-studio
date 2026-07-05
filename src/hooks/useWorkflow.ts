import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workflowApi } from '../services/api/workflow';
import {
  WorkflowPixivOverrides,
  WorkflowPrefilterMode,
  WorkflowPublishOverrides,
  PublishJob,
  BilibiliPublishSettings,
  WorkflowSchedule,
  WorkflowSchedulePayload,
  WorkflowTask,
  WorkflowVideoOverrides,
} from '../services/api/types';
import { backendStartingRetryDelay, retryBackendStarting } from '../utils/queryRetry';

const WORKFLOW_TASKS_KEY = ['workflow', 'tasks'] as const;
const WORKFLOW_BGM_CANDIDATES_KEY = ['workflow', 'bgm-candidates'] as const;
const WORKFLOW_SCHEDULES_KEY = ['workflow', 'schedules'] as const;
const PUBLISH_JOBS_KEY = ['workflow', 'publish-jobs'] as const;
const BILIBILI_PUBLISH_SETTINGS_KEY = ['workflow', 'publish-settings', 'bilibili'] as const;
const workflowTaskKey = (taskId?: string) => ['workflow', 'task', taskId] as const;

export function useWorkflowTasks() {
  const query = useQuery({
    queryKey: WORKFLOW_TASKS_KEY,
    queryFn: async () => (await workflowApi.listTasks()).data.data,
    retry: retryBackendStarting,
    retryDelay: backendStartingRetryDelay,
    refetchInterval: (queryData) => {
      const tasks = queryData.state.data ?? [];
      return tasks.some((task) => task.status === 'running') ? 3000 : false;
    },
  });

  return {
    tasks: query.data ?? [],
    ...query,
  };
}

export function useWorkflowTask(taskId?: string) {
  const query = useQuery({
    queryKey: workflowTaskKey(taskId),
    queryFn: async () => (await workflowApi.getTask(taskId!)).data.data,
    enabled: Boolean(taskId),
    retry: retryBackendStarting,
    retryDelay: backendStartingRetryDelay,
    refetchInterval: (queryData) => {
      const task = queryData.state.data as WorkflowTask | undefined;
      return task && ['asset_review_required', 'cover_review_required', 'review_required', 'published', 'failed', 'rejected'].includes(task.status)
        ? false
        : 2000;
    },
  });

  return {
    task: query.data,
    ...query,
  };
}

export function useWorkflowBgmCandidates() {
  const query = useQuery({
    queryKey: WORKFLOW_BGM_CANDIDATES_KEY,
    queryFn: async () => (await workflowApi.listBgmCandidates()).data.data,
    retry: retryBackendStarting,
    retryDelay: backendStartingRetryDelay,
  });

  return {
    candidates: query.data ?? [],
    ...query,
  };
}

export function useCreateWorkflowTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      command,
      dryRunDownload = false,
      prefilterMode,
      videoOverrides,
      pixivOverrides,
      publishOverrides,
    }: {
      command: string;
      dryRunDownload?: boolean;
      prefilterMode?: WorkflowPrefilterMode;
      videoOverrides?: WorkflowVideoOverrides;
      pixivOverrides?: WorkflowPixivOverrides;
      publishOverrides?: WorkflowPublishOverrides;
    }) => (await workflowApi.createTask(command, dryRunDownload, videoOverrides, pixivOverrides, prefilterMode, publishOverrides)).data.data,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_TASKS_KEY });
      queryClient.setQueryData(workflowTaskKey(task.id), task);
    },
  });
}

export function useApproveWorkflowTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, note }: { taskId: string; note?: string }) =>
      (await workflowApi.approveTask(taskId, note)).data.data,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_TASKS_KEY });
      queryClient.setQueryData(workflowTaskKey(task.id), task);
    },
  });
}

export function useRejectWorkflowTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, note }: { taskId: string; note?: string }) =>
      (await workflowApi.rejectTask(taskId, note)).data.data,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_TASKS_KEY });
      queryClient.setQueryData(workflowTaskKey(task.id), task);
    },
  });
}

export function useContinueWorkflowAssets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, mode }: { taskId: string; mode: WorkflowPrefilterMode }) =>
      (await workflowApi.continueAfterAssetReview(taskId, mode)).data.data,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_TASKS_KEY });
      queryClient.setQueryData(workflowTaskKey(task.id), task);
    },
  });
}

export function useContinueWorkflowCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) =>
      (await workflowApi.continueAfterCoverReview(taskId)).data.data,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_TASKS_KEY });
      queryClient.setQueryData(workflowTaskKey(task.id), task);
    },
  });
}

export function useResumeWorkflowTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId }: { taskId: string }) =>
      (await workflowApi.resumeFailedTask(taskId)).data.data,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_TASKS_KEY });
      queryClient.setQueryData(workflowTaskKey(task.id), task);
    },
  });
}

export function useRerenderWorkflowVideo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, note }: { taskId: string; note?: string }) =>
      (await workflowApi.rerenderVideo(taskId, note)).data.data,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_TASKS_KEY });
      queryClient.setQueryData(workflowTaskKey(task.id), task);
    },
  });
}

export function useRegenerateWorkflowCover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      assetNames,
      layout,
      title,
    }: {
      taskId: string;
      assetNames?: string[];
      layout?: string;
      title?: string;
    }) => (await workflowApi.regenerateCover(taskId, { assetNames, layout, title })).data.data,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_TASKS_KEY });
      queryClient.setQueryData(workflowTaskKey(task.id), task);
    },
  });
}

export function useUpdateWorkflowAssetStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      taskId,
      assetName,
      status,
      reason,
    }: {
      taskId: string;
      assetName: string;
      status: 'accepted' | 'rejected';
      reason?: string;
    }) => (await workflowApi.updateAssetStatus(taskId, assetName, status, reason)).data.data,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_TASKS_KEY });
      queryClient.setQueryData(workflowTaskKey(task.id), task);
    },
  });
}

export function useWorkflowSchedules() {
  const query = useQuery({
    queryKey: WORKFLOW_SCHEDULES_KEY,
    queryFn: async () => (await workflowApi.listSchedules()).data.data,
  });

  return {
    schedules: query.data ?? [],
    ...query,
  };
}

export function useSaveWorkflowSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (schedule: {
      id?: string;
      name: string;
      enabled?: boolean;
      cron: string;
      timezone?: string;
      command: string;
      payload?: WorkflowSchedulePayload;
    }) => (await workflowApi.saveSchedule(schedule)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_SCHEDULES_KEY });
    },
  });
}

export function useSetWorkflowScheduleEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) =>
      (await workflowApi.setScheduleEnabled(id, enabled)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_SCHEDULES_KEY });
    },
  });
}

export function useRunWorkflowScheduleNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await workflowApi.runScheduleNow(id)).data.data,
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_SCHEDULES_KEY });
      queryClient.invalidateQueries({ queryKey: WORKFLOW_TASKS_KEY });
      queryClient.setQueryData(workflowTaskKey(task.id), task);
    },
  });
}

export function useDeleteWorkflowSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (schedule: WorkflowSchedule) =>
      (await workflowApi.deleteSchedule(schedule.id)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_SCHEDULES_KEY });
    },
  });
}

export function usePublishJobs() {
  const query = useQuery({
    queryKey: PUBLISH_JOBS_KEY,
    queryFn: async () => (await workflowApi.listPublishJobs()).data.data,
  });

  return {
    jobs: query.data ?? [],
    ...query,
  };
}

export function useSubmitPublishJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (job: PublishJob) => (await workflowApi.submitPublishJob(job.id)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PUBLISH_JOBS_KEY });
    },
  });
}

export function useCancelPublishJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (job: PublishJob) => (await workflowApi.cancelPublishJob(job.id)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PUBLISH_JOBS_KEY });
    },
  });
}

export function useBilibiliPublishSettings() {
  const query = useQuery({
    queryKey: BILIBILI_PUBLISH_SETTINGS_KEY,
    queryFn: async () => (await workflowApi.getBilibiliPublishSettings()).data.data,
  });

  return {
    settings: query.data,
    ...query,
  };
}

export function useSaveBilibiliPublishSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: Partial<Omit<BilibiliPublishSettings, 'configured' | 'updatedAt'>>) =>
      (await workflowApi.saveBilibiliPublishSettings(settings)).data.data,
    onSuccess: (settings) => {
      queryClient.setQueryData(BILIBILI_PUBLISH_SETTINGS_KEY, settings);
    },
  });
}

export function useTestBilibiliPublishSettings() {
  return useMutation({
    mutationFn: async () => (await workflowApi.testBilibiliPublishSettings()).data.data,
  });
}
