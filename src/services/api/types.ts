import { AxiosResponse } from 'axios';

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  error?: string;
}

/**
 * Statistics overview data
 */
export interface StatsOverview {
  totalDownloads: number;
  illustrations: number;
  novels: number;
  recentDownloads: number;
}

export type WorkflowStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
export type WorkflowTaskStatus =
  | 'running'
  | 'asset_review_required'
  | 'cover_review_required'
  | 'review_required'
  | 'approved'
  | 'rejected'
  | 'published'
  | 'failed';
export type WorkflowPrefilterMode = 'manual' | 'ai_rules' | 'keep_all';
export type WorkflowAction =
  | 'continue_assets_manual'
  | 'continue_assets_keep_all'
  | 'continue_assets_ai_rules'
  | 'approve_cover'
  | 'approve_video'
  | 'reject';

export interface WorkflowStage {
  id: 'plan' | 'download' | 'filter' | 'image' | 'render' | 'review' | 'publish';
  label: string;
  status: WorkflowStageStatus;
  message: string;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface WorkflowPlan {
  title: string;
  description: string;
  pixivTarget: {
    type: 'illustration' | 'novel';
    tag?: string;
    limit?: number;
    searchTarget?: string;
    sort?: string;
    minBookmarks?: number;
    startDate?: string;
    endDate?: string;
    tagWhitelist?: string[];
    tagBlacklist?: string[];
  };
  video: {
    style: string;
    motion: WorkflowVideoMotion;
    width: number;
    height: number;
    fps: number;
    secondsPerImage: number;
    crossfade: number;
    zoom: number;
    maxImages: number;
    shuffleSeed: number;
    totalDuration?: number;
    bgmPath?: string;
    disclaimer?: WorkflowVideoDisclaimer;
  };
  publish: {
    platform: 'bilibili';
    dryRun: true;
    category: string;
    tags: string[];
    original: boolean;
    aigc: boolean;
  };
}

export type WorkflowVideoMotion =
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

export interface WorkflowVideoDisclaimer {
  enabled: boolean;
  duration: number;
  title: string;
  lines: string[];
}

export interface WorkflowVideoOverrides {
  aspectRatio?: '16:9' | '9:16' | '1:1';
  totalDuration?: number;
  maxImages?: number;
  secondsPerImage?: number;
  fps?: number;
  crossfade?: number;
  zoom?: number;
  motion?: WorkflowVideoMotion;
  bgmPath?: string;
  style?: 'beat' | 'soft' | 'square';
  disclaimer?: WorkflowVideoDisclaimer;
}

export interface WorkflowPublishOverrides {
  title?: string;
  description?: string;
  tags?: string[];
  dynamic?: string;
  category?: string;
  original?: boolean;
  aigc?: boolean;
  syncArticle?: boolean;
  articleTitle?: string;
  articleBody?: string;
}

export interface WorkflowPublishCaptionResult extends WorkflowPublishOverrides {
  title: string;
  description: string;
  tags: string[];
  dynamic: string;
  provider?: string;
}

export interface BilibiliPublishSource {
  pixivId?: string;
  title?: string;
  authorName?: string;
  authorId?: string;
  url?: string;
}

export interface BilibiliPublishPreview {
  platform: 'bilibili';
  mode: 'dry_run' | 'open_platform';
  taskId: string;
  videoPath?: string;
  coverPath?: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  copyright: 1 | 2;
  noReprint: boolean;
  source: string;
  dynamic: string;
  aigc: boolean;
  syncArticle: boolean;
  article?: {
    title: string;
    body: string;
  };
  sources: BilibiliPublishSource[];
}

export interface BilibiliOpenPlatformPublishResult {
  status: 'not_configured' | 'queued' | 'submitted' | 'failed';
  platform: 'bilibili';
  message: string;
  requestId?: string;
  bvid?: string;
  aid?: string;
  articleId?: string;
  raw?: unknown;
}

export interface WorkflowPixivOverrides {
  tag?: string;
  limit?: number;
  searchTarget?: 'partial_match_for_tags' | 'exact_match_for_tags' | 'title_and_caption';
  sort?: 'date_desc' | 'date_asc' | 'popular_desc';
  mode?: 'search' | 'ranking';
  rankingMode?: string;
  rankingDate?: string;
  filterTag?: string;
  minBookmarks?: number;
  startDate?: string;
  endDate?: string;
  tagWhitelist?: string[];
  tagBlacklist?: string[];
}

export interface WorkflowImageAsset {
  path: string;
  name: string;
  width: number;
  height: number;
  size: number;
  pixivId?: string;
  title?: string;
  caption?: string;
  author?: {
    id: string;
    name: string;
    account?: string;
    profileImageUrls?: Record<string, string>;
  };
  tags?: Array<{ name: string; translated_name?: string }>;
  fileHash?: string;
  status: 'accepted' | 'rejected';
  reason?: string;
}

export interface WorkflowProgressEvent {
  id: string;
  timestamp: string;
  stage: WorkflowStage['id'];
  type: 'stage' | 'asset' | 'cover' | 'video' | 'publish';
  message: string;
  current?: number;
  total?: number;
  assetName?: string;
  artifactPath?: string;
}

export interface WorkflowLatestArtifact {
  type: 'asset' | 'cover' | 'video' | 'publish';
  name?: string;
  path?: string;
  assetIndex?: number;
  message?: string;
}

export interface WorkflowTask {
  id: string;
  command: string;
  status: WorkflowTaskStatus;
  createdAt: string;
  updatedAt: string;
  stages: WorkflowStage[];
  plan?: WorkflowPlan;
  pixivConfig?: ConfigData;
  assets: WorkflowImageAsset[];
  currentStage?: WorkflowStage['id'];
  latestArtifact?: WorkflowLatestArtifact;
  requiresUserConfirmation?: boolean;
  availableActions?: WorkflowAction[];
  progressEvents?: WorkflowProgressEvent[];
  coverPath?: string;
  videoPath?: string;
  review?: {
    status: 'pending' | 'approved' | 'rejected';
    note?: string;
    reviewedAt?: string;
  };
  publish?: {
    status: 'pending' | 'dry_run_completed';
    platform: 'bilibili';
    message?: string;
    packagePath?: string;
    descriptionPath?: string;
    articlePath?: string;
    articleMarkdownPath?: string;
    title?: string;
    description?: string;
    dynamic?: string;
    tags?: string[];
    category?: string;
    sourceCount?: number;
    syncArticle?: boolean;
    publishedAt?: string;
  };
  logs: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
  }>;
}

export interface CommandPreset {
  id: string;
  name: string;
  command: string;
  category: string;
  payload?: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AiIntegrationSettings {
  provider: 'local-rules' | 'openai' | 'anthropic' | 'ollama';
  model: string;
  baseUrl: string;
  apiKey: string;
  planningMode: 'rules-first' | 'ai-first';
}

export interface AiModelInfo {
  id: string;
  name: string;
  source?: string;
}

export interface AiConnectionTestResult {
  ok: boolean;
  latencyMs?: number;
  message?: string;
}

export interface AiBalanceResult {
  supported: boolean;
  endpoint?: string;
  message?: string;
  raw?: unknown;
  errors?: string[];
}

/**
 * Download task status
 */
export interface DownloadTask {
  taskId: string;
  status: 'running' | 'completed' | 'failed' | 'stopped';
  startTime: string;
  endTime?: string;
  error?: string;
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
}

/**
 * Download status response
 */
export interface DownloadStatus {
  hasActiveTask: boolean;
  activeTask?: DownloadTask;
  allTasks: DownloadTask[];
}

/**
 * Incomplete task data
 */
export interface IncompleteTask {
  id: number;
  tag: string;
  type: 'illustration' | 'novel';
  status: 'failed' | 'partial';
  message: string | null;
  executedAt: string;
}

/**
 * Download history item
 */
export interface DownloadHistoryItem {
  id: number;
  pixivId: string;
  type: 'illustration' | 'novel';
  title: string;
  tag: string;
  author?: string;
  filePath: string;
  downloadedAt: string;
}

/**
 * Download history response
 */
export interface DownloadHistoryResponse {
  items: DownloadHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

/**
 * File item data
 */
export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: string;
  downloadedAt?: string | null;
  extension?: string;
  source?: 'classic' | 'workflow';
  category?: string;
  displayPath?: string;
}

/**
 * Files list response
 */
export interface FilesResponse {
  files: FileItem[];
  directories: FileItem[];
  currentPath: string;
  source?: 'classic' | 'workflow';
  category?: string;
  basePath?: string;
}

/**
 * Log entry data
 */
export interface LogEntry {
  line: string;
  level?: string;
  timestamp?: string;
}

/**
 * Logs response
 */
export interface LogsResponse {
  logs: string[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Config data structure
 */
export interface ConfigData {
  logLevel?: string;
  initialDelay?: number;
  pixiv?: {
    clientId?: string;
    refreshToken?: string;
    userAgent?: string;
  };
  network?: {
    timeoutMs?: number;
    retries?: number;
    retryDelay?: number;
    proxy?: {
      enabled?: boolean;
      host?: string;
      port?: number;
      protocol?: string;
      username?: string;
      password?: string;
    };
  };
  storage?: {
    databasePath?: string;
    downloadDirectory?: string;
    illustrationDirectory?: string;
    novelDirectory?: string;
    illustrationOrganization?: string;
    novelOrganization?: string;
  };
  scheduler?: {
    enabled?: boolean;
    cron?: string;
    timezone?: string;
    maxExecutions?: number;
    minInterval?: number;
    timeout?: number;
  };
  download?: {
    concurrency?: number;
    maxRetries?: number;
    retryDelay?: number;
    timeout?: number;
  };
  targets?: Array<{
    type: 'illustration' | 'novel';
    tag?: string;
    limit?: number;
    searchTarget?: string;
    sort?: string;
    mode?: string;
    rankingMode?: string;
    rankingDate?: string;
    filterTag?: string;
    minBookmarks?: number;
    startDate?: string;
    endDate?: string;
    seriesId?: number;
    novelId?: number;
    [key: string]: unknown;
  }>;
  _meta?: {
    configPath?: string;
    configPathRelative?: string;
  };
  _validation?: Record<string, unknown>;
}

/**
 * Config history entry
 */
export interface ConfigHistoryEntry {
  id: number;
  name: string;
  description: string | null;
  config: ConfigData;
  created_at: string;
  updated_at: string;
  is_active: number;
}

/**
 * Config file info
 */
export interface ConfigFileInfo {
  filename: string;
  path: string;
  pathRelative: string;
  modifiedTime: string;
  size: number;
  isActive: boolean;
}

/**
 * Config file content
 */
export interface ConfigFileContent {
  filename: string;
  path: string;
  pathRelative: string;
  content: string;
}

/**
 * Config diagnose result
 */
export interface ConfigDiagnoseResult {
  stats: {
    totalFields: number;
    totalSections: number;
    totalTargets: number;
    maxDepth: number;
    fieldTypes: Record<string, number>;
  };
  errors: string[];
  warnings: string[];
  fields: Array<{
    path: string;
    name: string;
    type: string;
    required: boolean;
    description?: string;
    defaultValue?: unknown;
    enumValues?: unknown[];
    depth: number;
    isLeaf: boolean;
  }>;
  sections: Record<string, unknown[]>;
}

/**
 * Config repair result
 */
export interface ConfigRepairResult {
  fixed: boolean;
  errors: string[];
  warnings: string[];
  backupPath?: string;
}

/**
 * Auth status response
 */
export interface AuthStatus {
  isAuthenticated: boolean;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    [key: string]: unknown;
  };
}

/**
 * Auth login response
 */
export interface AuthLoginResponse {
  refreshToken: string;
  accessToken?: string;
  expiresIn?: number;
  user?: {
    id?: string;
    name?: string;
    email?: string;
    [key: string]: unknown;
  };
}

export type SystemCheckStatus = 'ok' | 'warning' | 'error';

export interface SystemCheckItem {
  id: string;
  label: string;
  status: SystemCheckStatus;
  message: string;
  detail?: string;
  suggestion?: string;
}

export interface SystemCheckResult {
  status: SystemCheckStatus;
  checkedAt: string;
  summary: {
    ok: number;
    warning: number;
    error: number;
  };
  items: SystemCheckItem[];
}

/**
 * Task logs response
 */
export interface TaskLogsResponse {
  logs: Array<{
    timestamp: string;
    level: string;
    message: string;
  }>;
}

/**
 * Normalize files result
 */
export interface NormalizeFilesResult {
  result: {
    totalFiles: number;
    processedFiles: number;
    movedFiles: number;
    renamedFiles: number;
    updatedDatabase: number;
    skippedFiles: number;
    errors: Array<{ file: string; error: string }>;
  };
}

/**
 * Type helper for API response
 */
export type ApiResponseType<T> = Promise<AxiosResponse<ApiResponse<T>>>;
