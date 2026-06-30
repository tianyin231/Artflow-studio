import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workflowApi } from '../services/api/workflow';
import { CommandPreset } from '../services/api/types';

const COMMAND_PRESETS_KEY = ['workflow', 'command-presets'] as const;

export type { CommandPreset };

export function useCommandPresets() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: COMMAND_PRESETS_KEY,
    queryFn: async () => (await workflowApi.listPresets()).data.data,
  });

  const presets = query.data ?? [];
  const categories = useMemo(
    () => Array.from(new Set(presets.map((preset) => preset.category))).filter(Boolean),
    [presets]
  );

  const addMutation = useMutation({
    mutationFn: async (preset: Omit<CommandPreset, 'id' | 'createdAt' | 'updatedAt'>) =>
      (await workflowApi.savePreset(preset)).data.data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMAND_PRESETS_KEY });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => workflowApi.deletePreset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMMAND_PRESETS_KEY });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => (await workflowApi.resetPresets()).data.data,
    onSuccess: (nextPresets) => {
      queryClient.setQueryData(COMMAND_PRESETS_KEY, nextPresets);
    },
  });

  return {
    presets,
    categories,
    isLoading: query.isLoading,
    addPreset: addMutation.mutate,
    addPresetAsync: addMutation.mutateAsync,
    isAdding: addMutation.isPending,
    deletePreset: deleteMutation.mutate,
    deletePresetAsync: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    resetPresets: resetMutation.mutate,
    resetPresetsAsync: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
  };
}
