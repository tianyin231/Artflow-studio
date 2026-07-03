import { AxiosResponse } from 'axios';
import { apiClient } from './client';
import { ApiResponse, SystemCheckResult } from './types';

export const systemApi = {
  check: (): Promise<AxiosResponse<ApiResponse<SystemCheckResult>>> =>
    apiClient.get('/system/check'),
};
