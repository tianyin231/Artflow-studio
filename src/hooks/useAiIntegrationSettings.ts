import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workflowApi } from '../services/api/workflow';
import { AiIntegrationSettings } from '../services/api/types';

const AI_SETTINGS_KEY = ['workflow', 'ai-settings'] as const;

export function useAiIntegrationSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: AI_SETTINGS_KEY,
    queryFn: async () => (await workflowApi.getAiSettings()).data.data,
  });

  const saveMutation = useMutation({
    mutationFn: async (settings: AiIntegrationSettings) =>
      (await workflowApi.saveAiSettings(settings)).data.data,
    onSuccess: (settings) => {
      queryClient.setQueryData(AI_SETTINGS_KEY, settings);
    },
  });

  const modelsMutation = useMutation({
    mutationFn: async (settings: AiIntegrationSettings) =>
      (await workflowApi.fetchAiModels(settings)).data.data,
  });

  const testMutation = useMutation({
    mutationFn: async (settings: AiIntegrationSettings) =>
      (await workflowApi.testAiConnection(settings)).data.data,
  });

  const balanceMutation = useMutation({
    mutationFn: async (settings: AiIntegrationSettings) =>
      (await workflowApi.queryAiBalance(settings)).data.data,
  });

  return {
    settings: query.data,
    isLoading: query.isLoading,
    saveSettingsAsync: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    fetchModelsAsync: modelsMutation.mutateAsync,
    isFetchingModels: modelsMutation.isPending,
    testConnectionAsync: testMutation.mutateAsync,
    isTestingConnection: testMutation.isPending,
    queryBalanceAsync: balanceMutation.mutateAsync,
    isQueryingBalance: balanceMutation.isPending,
  };
}
