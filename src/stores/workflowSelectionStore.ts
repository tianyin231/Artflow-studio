import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WorkflowSelectionState {
  selectedTaskId?: string;
  dashboardDraft?: {
    command: string;
    collection: {
      useLocalAssets: boolean;
      tag: string;
      limit: number;
      minBookmarks: number;
      sort: 'date_desc' | 'date_asc' | 'popular_desc';
      searchTarget: 'partial_match_for_tags' | 'exact_match_for_tags' | 'title_and_caption';
      startDate?: string;
      endDate?: string;
      tagWhitelistText: string;
      tagBlacklistText: string;
    };
    prefilterMode: 'manual' | 'ai_rules' | 'keep_all';
    video: {
      aspectRatio: '16:9' | '9:16' | '1:1';
      style: 'beat' | 'soft' | 'square';
      motion: 'none' | 'slow_zoom' | 'beat_zoom';
      maxImages: number;
      secondsPerImage: number;
      fps: number;
      crossfade: number;
      zoom: number;
      totalDuration?: number;
      bgmPath?: string;
    };
    recentPresetId?: string;
  };
}

export interface WorkflowSelectionActions {
  setSelectedTaskId: (taskId?: string) => void;
  setDashboardDraft: (draft: WorkflowSelectionState['dashboardDraft']) => void;
}

export type WorkflowSelectionStore = WorkflowSelectionState & WorkflowSelectionActions;

export const useWorkflowSelectionStore = create<WorkflowSelectionStore>()(
  persist(
    (set) => ({
      selectedTaskId: undefined,
      dashboardDraft: undefined,
      setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
      setDashboardDraft: (dashboardDraft) => set({ dashboardDraft }),
    }),
    {
      name: 'workflow-selection-storage',
      partialize: (state) => ({
        selectedTaskId: state.selectedTaskId,
        dashboardDraft: state.dashboardDraft,
      }),
    }
  )
);
