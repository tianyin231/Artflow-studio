import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PublishConfigValues } from '../utils/publishConfig';

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
      motion:
        | 'auto'
        | 'none'
        | 'slow_zoom'
        | 'beat_zoom'
        | 'pan_zoom'
        | 'slide_parallax'
        | 'beat_cut'
        | 'drift_zoom'
        | 'cinematic_sway'
        | 'pulse_pop';
      maxImages: number;
      secondsPerImage: number;
      fps: number;
      crossfade: number;
      zoom: number;
      totalDuration?: number;
      bgmPath?: string;
      disclaimer?: {
        enabled: boolean;
        duration: number;
        title: string;
        lines: string[];
      };
    };
    publish?: PublishConfigValues;
    recentPresetId?: string;
  };
  publishDraft?: PublishConfigValues;
}

export interface WorkflowSelectionActions {
  setSelectedTaskId: (taskId?: string) => void;
  setDashboardDraft: (draft: WorkflowSelectionState['dashboardDraft']) => void;
  setPublishDraft: (draft: PublishConfigValues) => void;
}

export type WorkflowSelectionStore = WorkflowSelectionState & WorkflowSelectionActions;

export const useWorkflowSelectionStore = create<WorkflowSelectionStore>()(
  persist(
    (set) => ({
      selectedTaskId: undefined,
      dashboardDraft: undefined,
      publishDraft: undefined,
      setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
      setDashboardDraft: (dashboardDraft) => set({ dashboardDraft }),
      setPublishDraft: (publishDraft) => set({ publishDraft }),
    }),
    {
      name: 'workflow-selection-storage',
      partialize: (state) => ({
        selectedTaskId: state.selectedTaskId,
        dashboardDraft: state.dashboardDraft,
        publishDraft: state.publishDraft,
      }),
    }
  )
);
