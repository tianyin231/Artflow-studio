import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workflowApi } from '../services/api/workflow';
import { WorkflowPixivOverrides, WorkflowPrefilterMode, WorkflowPublishOverrides, WorkflowTask, WorkflowVideoOverrides } from '../services/api/types';

const WORKFLOW_TASKS_KEY = ['workflow', 'tasks'] as const;
const workflowTaskKey = (taskId?: string) => ['workflow', 'task', taskId] as const;

export function useWorkflowTasks() {
  const query = useQuery({
    queryKey: WORKFLOW_TASKS_KEY,
    queryFn: async () => (await workflowApi.listTasks()).data.data,
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
