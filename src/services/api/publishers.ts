import { AxiosResponse } from 'axios';
import { apiClient } from './client';
import { ApiResponse } from './types';

export interface PublisherInfo {
  id: string;
  displayName: string;
  enabled: boolean;
  experimental?: boolean;
  manualOnly?: boolean;
  auth: string;
  notes?: string;
  state?: string;
  account?: string;
}

export interface PublisherDryRunResult {
  status: 'published' | 'submitted' | 'exported' | 'dry_run' | 'failed' | 'auth_required';
  message?: string;
  exportDir?: string;
}

export const publisherApi = {
  list: (): Promise<AxiosResponse<ApiResponse<PublisherInfo[]>>> => apiClient.get('/publishers'),
  dryRun: (id: string): Promise<AxiosResponse<ApiResponse<PublisherDryRunResult>>> =>
    apiClient.post(`/publishers/${encodeURIComponent(id)}/dry-run`, {}),
};
