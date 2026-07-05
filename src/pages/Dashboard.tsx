import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  DatePicker,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  CodeOutlined,
  EyeOutlined,
  FileImageOutlined,
  ReloadOutlined,
  RobotOutlined,
  SaveOutlined,
  SendOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { CSSProperties, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import {
  useApproveWorkflowTask,
  useContinueWorkflowAssets,
  useContinueWorkflowCover,
  useCreateWorkflowTask,
  useRegenerateWorkflowCover,
  useRejectWorkflowTask,
  useRerenderWorkflowVideo,
  useResumeWorkflowTask,
  useUpdateWorkflowAssetStatus,
  useWorkflowBgmCandidates,
  useWorkflowTask,
  useWorkflowTasks,
} from '../hooks/useWorkflow';
import { CommandPreset, useCommandPresets } from '../hooks/useCommandPresets';
import { useWorkflowSelectionStore } from '../stores';
import {
  WorkflowImageAsset,
  WorkflowPixivOverrides,
  WorkflowPrefilterMode,
  WorkflowStage,
  WorkflowTask,
  WorkflowVideoOverrides,
} from '../services/api/types';
import { buildPublishOverrides, defaultPublishConfig, PublishConfigValues, splitTags } from '../utils/publishConfig';

const { Text, Title, Paragraph } = Typography;

const gold = '#D4AF37';
const dashboardDraftVersion = 1;

type CollectionConfigValues = {
  useLocalAssets: boolean;
  tag: string;
  limit: number;
  minBookmarks: number;
  sort: NonNullable<WorkflowPixivOverrides['sort']>;
  searchTarget: NonNullable<WorkflowPixivOverrides['searchTarget']>;
  dateRange?: [dayjs.Dayjs, dayjs.Dayjs];
  tagWhitelistText: string;
  tagBlacklistText: string;
};

type VideoConfigValues = Required<Pick<
  WorkflowVideoOverrides,
  'aspectRatio' | 'style' | 'motion' | 'maxImages' | 'secondsPerImage' | 'fps' | 'crossfade' | 'zoom'
>> & Pick<WorkflowVideoOverrides, 'totalDuration' | 'bgmPath'>;

type SerializedCollectionConfig = {
  useLocalAssets: boolean;
  tag: string;
  limit: number;
  minBookmarks: number;
  sort: NonNullable<WorkflowPixivOverrides['sort']>;
  searchTarget: NonNullable<WorkflowPixivOverrides['searchTarget']>;
  startDate?: string;
  endDate?: string;
  tagWhitelistText: string;
  tagBlacklistText: string;
};

type DashboardPresetPayload = {
  version: number;
  collection?: SerializedCollectionConfig;
  prefilterMode?: WorkflowPrefilterMode;
  video?: VideoConfigValues;
  publish?: PublishConfigValues;
};

const defaultCommand = '';
const defaultCollectionConfig: CollectionConfigValues = {
  useLocalAssets: false,
  tag: '',
  limit: 10,
  minBookmarks: 500,
  sort: 'popular_desc',
  searchTarget: 'partial_match_for_tags',
  dateRange: [dayjs().subtract(7, 'day'), dayjs()],
  tagWhitelistText: '',
  tagBlacklistText: 'R-18, AI生成',
};

const defaultVideoConfig: VideoConfigValues = {
  aspectRatio: '16:9',
  style: 'beat',
  motion: 'auto',
  maxImages: 12,
  secondsPerImage: 4.5,
  fps: 60,
  crossfade: 0.45,
  zoom: 1.04,
  totalDuration: undefined,
  bgmPath: '',
};

const prefilterModeOptions: Array<{ label: string; value: WorkflowPrefilterMode }> = [
  { label: '人工过滤', value: 'manual' },
  { label: 'AI/规则筛选', value: 'ai_rules' },
  { label: '全部保留', value: 'keep_all' },
];

const stageIcons: Record<WorkflowStage['id'], React.ReactNode> = {
  plan: <RobotOutlined />,
  download: <ApiOutlined />,
  filter: <FileImageOutlined />,
  image: <FileImageOutlined />,
  render: <VideoCameraOutlined />,
  review: <EyeOutlined />,
  publish: <CloudUploadOutlined />,
};

const statusColor: Record<string, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  blocked: 'warning',
};

const imageFallback =
  "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 240 240'%3E%3Crect width='240' height='240' fill='%23f5f5f5'/%3E%3Cpath d='M68 158l34-38 28 29 18-20 24 29H68z' fill='%23d4d4d4'/%3E%3Crect x='62' y='70' width='116' height='100' rx='8' fill='none' stroke='%23bdbdbd' stroke-width='8'/%3E%3Ccircle cx='92' cy='98' r='10' fill='%23c7c7c7'/%3E%3C/svg%3E";

function pickTask(tasks: WorkflowTask[], selectedTaskId?: string): WorkflowTask | undefined {
  if (selectedTaskId) return tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
  return tasks[0];
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatCount(value?: number): string {
  if (value === undefined || value === null) return '-';
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}万`;
  return String(value);
}

function formatDateTime(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function pickCommandNumber(command: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = command.match(pattern);
    if (match) return Number(match[1]);
  }
  return undefined;
}

function inferCollectionConfig(command: string, current: CollectionConfigValues): CollectionConfigValues {
  const next: CollectionConfigValues = { ...current };
  const compactCommand = command.replace(/\s+/g, '');
  const knownTag = compactCommand.includes('鸣潮') || compactCommand.includes('鳴潮')
    ? '鳴潮'
    : compactCommand.includes('原神')
      ? '原神'
      : compactCommand.includes('ブルアカ') || compactCommand.includes('碧蓝档案')
        ? 'ブルアカ'
        : compactCommand.includes('初音')
          ? '初音ミク'
          : undefined;

  if (knownTag) next.tag = knownTag;
  const limit = pickCommandNumber(command, [/(?:抓取|精选|图片数|图数|张数)\s*(\d+)/, /(\d+)\s*(?:张|图)/]);
  if (limit !== undefined) next.limit = Math.min(200, Math.max(1, limit));

  const bookmarks = pickCommandNumber(command, [/收藏(?:数)?\s*(\d+)/, /(\d+)\s*\+\s*(?:收藏|bookmark|收藏数)?/i]);
  if (bookmarks !== undefined) next.minBookmarks = Math.min(1000000, Math.max(0, bookmarks));

  if (compactCommand.includes('最新')) next.sort = 'date_desc';
  if (compactCommand.includes('最早')) next.sort = 'date_asc';
  if (compactCommand.includes('收藏最多') || compactCommand.includes('热门') || compactCommand.includes('高收藏')) next.sort = 'popular_desc';
  if (compactCommand.includes('本周') || compactCommand.includes('最近7天')) next.dateRange = [dayjs().subtract(7, 'day'), dayjs()];
  if (compactCommand.includes('本月') || compactCommand.includes('最近30天')) next.dateRange = [dayjs().subtract(30, 'day'), dayjs()];
  if (compactCommand.includes('竖屏')) next.tagWhitelistText = next.tagWhitelistText;
  return next;
}

function inferVideoConfig(command: string, current: VideoConfigValues): VideoConfigValues {
  const next = { ...current };
  if (command.includes('竖屏') || command.includes('9:16')) next.aspectRatio = '9:16';
  if (command.includes('方形') || command.includes('1:1')) {
    next.aspectRatio = '1:1';
    next.style = 'square';
  }
  if (command.includes('舒缓') || command.includes('柔和') || command.toLowerCase().includes('soft')) {
    next.style = 'soft';
    next.motion = 'drift_zoom';
    next.secondsPerImage = 5;
    next.fps = 60;
    next.crossfade = 0.55;
    next.zoom = 1.015;
  }
  if (command.includes('卡点') || command.includes('电子')) {
    next.style = 'beat';
    next.motion = 'beat_zoom';
  }
  const duration = pickCommandNumber(command, [/(?:时长|总时长)\s*(\d+)\s*(?:秒|s)?/i]);
  if (duration !== undefined) next.totalDuration = Math.min(600, Math.max(1, duration));
  return next;
}

function serializeCollectionValues(values: CollectionConfigValues): SerializedCollectionConfig {
  const serialized: SerializedCollectionConfig = {
    useLocalAssets: values.useLocalAssets,
    tag: values.tag,
    limit: values.limit,
    minBookmarks: values.minBookmarks,
    sort: values.sort,
    searchTarget: values.searchTarget,
    tagWhitelistText: values.tagWhitelistText,
    tagBlacklistText: values.tagBlacklistText,
  };
  const startDate = values.dateRange?.[0]?.format('YYYY-MM-DD');
  const endDate = values.dateRange?.[1]?.format('YYYY-MM-DD');
  if (startDate) serialized.startDate = startDate;
  if (endDate) serialized.endDate = endDate;
  return serialized;
}

function deserializeCollectionValues(values?: SerializedCollectionConfig): CollectionConfigValues {
  if (!values) return defaultCollectionConfig;
  return {
    ...defaultCollectionConfig,
    ...values,
    dateRange: values.startDate && values.endDate ? [dayjs(values.startDate), dayjs(values.endDate)] : defaultCollectionConfig.dateRange,
  };
}

function deriveWorkflowRoot(task?: WorkflowTask): string | undefined {
  const artifactPath = task?.videoPath || task?.coverPath || task?.assets[0]?.path;
  const marker = '/workflow_runs/';
  const markerIndex = artifactPath?.indexOf(marker) ?? -1;
  if (!artifactPath || markerIndex < 0) return undefined;
  const afterMarker = artifactPath.slice(markerIndex + marker.length);
  const taskId = afterMarker.split('/')[0];
  if (!taskId) return undefined;
  return artifactPath.slice(0, markerIndex + marker.length + taskId.length);
}

function deriveRenderProgress(task?: WorkflowTask): number {
  if (!task) return 0;
  const renderStage = task.stages.find((stage) => stage.id === 'render');
  const isRendering = task.status === 'running' && task.currentStage === 'render';
  if (task.videoPath && !isRendering) return 100;

  const lastRenderStartIndex = task.logs.reduce((latest, log, index) => {
    return log.message.includes('MoviePy 合成: 正在调用 MoviePy 渲染视频') || log.message.includes('重新生成视频')
      ? index
      : latest;
  }, -1);
  const currentRenderLogs = lastRenderStartIndex >= 0 ? task.logs.slice(lastRenderStartIndex) : task.logs;
  const stageProgress = isRendering ? Math.min(renderStage?.progress ?? 0, 99) : renderStage?.progress ?? 0;
  const logProgress = currentRenderLogs.reduce((latest, log) => {
    const match = log.message.match(/Render progress:\s*(\d+)%/i) || log.message.match(/(\d+)%/);
    if (!match) return latest;
    return Math.max(latest, Math.min(isRendering ? 99 : 100, Number(match[1]) || 0));
  }, 0);

  return Math.max(stageProgress, logProgress);
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString();
}

function parseAiLog(message: string): { step: string; status: string; detail: string } {
  const parts = message.split('｜');
  if (parts[0] === 'AI' && parts.length >= 4) {
    return {
      step: parts[1] || 'AI',
      status: parts[2] || '记录',
      detail: parts.slice(3).join('｜'),
    };
  }
  if (message.includes('AI Agent')) {
    const failed = message.includes('失败');
    return {
      step: '兼容旧日志',
      status: failed ? '失败' : '记录',
      detail: message,
    };
  }
  return { step: 'AI', status: '记录', detail: message };
}

function isAiRelatedLog(message: string): boolean {
  return message.startsWith('AI｜') || /\bAI\b|AI Agent|人工智能/i.test(message);
}

function aiStatusColor(status: string): string {
  if (status.includes('失败')) return 'error';
  if (status.includes('无结果') || status.includes('跳过')) return 'warning';
  if (status.includes('完成')) return 'success';
  if (status.includes('开始')) return 'processing';
  return 'default';
}

function StableAssetImage({
  primarySrc,
  fallbackSrc,
  alt,
  className,
  style,
}: {
  primarySrc: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [src, setSrc] = useState(primarySrc);

  useEffect(() => {
    setSrc(primarySrc);
  }, [primarySrc]);

  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => {
        setSrc((current) => {
          if (fallbackSrc && current !== fallbackSrc) return fallbackSrc;
          if (current !== imageFallback) return imageFallback;
          return current;
        });
      }}
      style={style}
    />
  );
}

export default function Dashboard() {
  const [collectionForm] = Form.useForm<CollectionConfigValues>();
  const [videoForm] = Form.useForm<VideoConfigValues>();
  const selectedTaskId = useWorkflowSelectionStore((state) => state.selectedTaskId);
  const setSelectedTaskId = useWorkflowSelectionStore((state) => state.setSelectedTaskId);
  const dashboardDraft = useWorkflowSelectionStore((state) => state.dashboardDraft);
  const setDashboardDraft = useWorkflowSelectionStore((state) => state.setDashboardDraft);
  const publishDraft = useWorkflowSelectionStore((state) => state.publishDraft);
  const [command, setCommand] = useState(dashboardDraft?.command ?? defaultCommand);
  const [prefilterMode, setPrefilterMode] = useState<WorkflowPrefilterMode>(dashboardDraft?.prefilterMode ?? 'manual');
  const [recentPresetId, setRecentPresetId] = useState<string | undefined>(dashboardDraft?.recentPresetId);
  const [previewAsset, setPreviewAsset] = useState<WorkflowImageAsset>();
  const [previewAssetIndex, setPreviewAssetIndex] = useState<number>();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [videoReviewOpen, setVideoReviewOpen] = useState(false);
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [draftRevision, setDraftRevision] = useState(0);
  const [coverLayout, setCoverLayout] = useState('grid');
  const [coverAssetNames, setCoverAssetNames] = useState<string[]>([]);
  const { presets, addPresetAsync, isAdding } = useCommandPresets();
  const { tasks, refetch: refetchTasks } = useWorkflowTasks();
  const { candidates: bgmCandidates, refetch: refetchBgmCandidates, isFetching: isFetchingBgmCandidates } = useWorkflowBgmCandidates();
  const fallbackTask = pickTask(tasks, selectedTaskId);
  const { task: activeTask, refetch: refetchTask } = useWorkflowTask(fallbackTask?.id);
  const createTask = useCreateWorkflowTask();
  const approveTask = useApproveWorkflowTask();
  const rejectTask = useRejectWorkflowTask();
  const updateAssetStatus = useUpdateWorkflowAssetStatus();
  const continueAssets = useContinueWorkflowAssets();
  const continueCover = useContinueWorkflowCover();
  const regenerateCover = useRegenerateWorkflowCover();
  const resumeTask = useResumeWorkflowTask();
  const rerenderVideo = useRerenderWorkflowVideo();

  const task = activeTask ?? fallbackTask;
  const acceptedAssets = task?.assets.filter((asset) => asset.status === 'accepted') ?? [];
  const rejectedAssets = task?.assets.filter((asset) => asset.status === 'rejected') ?? [];
  const completedStages = task?.stages.filter((stage) => stage.status === 'completed').length ?? 0;
  const pipelineProgress = task ? Math.round((completedStages / task.stages.length) * 100) : 0;
  const currentStageId = task?.currentStage ?? task?.stages.find((stage) => stage.status === 'running')?.id ?? task?.stages.find((stage) => stage.status === 'blocked')?.id;
  const currentStage = task?.stages.find((stage) => stage.id === currentStageId);
  const renderProgress = deriveRenderProgress(task);
  const latestAssetIndex = task?.latestArtifact?.type === 'asset' ? task.latestArtifact.assetIndex : Math.max((task?.assets.length ?? 1) - 1, 0);
  const latestAsset = typeof latestAssetIndex === 'number' ? task?.assets[latestAssetIndex] : undefined;
  const coverPreviewUrl = task?.coverPath ? `/api/workflow/tasks/${task.id}/cover?ts=${encodeURIComponent(task.updatedAt)}` : '';
  const acceptedAssetNames = useMemo(() => acceptedAssets.map((asset) => asset.name), [acceptedAssets]);
  const workflowRoot = deriveWorkflowRoot(task);

  useEffect(() => {
    collectionForm.setFieldsValue(deserializeCollectionValues(dashboardDraft?.collection));
    videoForm.setFieldsValue({ ...defaultVideoConfig, ...dashboardDraft?.video });
  }, [collectionForm, dashboardDraft?.collection, dashboardDraft?.video, videoForm]);

  const persistDraft = () => {
    const collectionValues = collectionForm.getFieldsValue();
    const videoValues = videoForm.getFieldsValue();
    setDashboardDraft({
      command,
      collection: serializeCollectionValues({ ...defaultCollectionConfig, ...collectionValues }),
      prefilterMode,
      video: { ...defaultVideoConfig, ...videoValues },
      recentPresetId,
    });
  };

  useEffect(() => {
    const timer = window.setTimeout(persistDraft, 250);
    return () => window.clearTimeout(timer);
  }, [command, prefilterMode, recentPresetId, draftRevision]);

  useEffect(() => {
    if (!task || task.status !== 'cover_review_required') return;
    setCoverAssetNames((current) => {
      const valid = current.filter((name) => acceptedAssetNames.includes(name));
      return valid.length > 0 ? valid : acceptedAssetNames.slice(0, 4);
    });
  }, [acceptedAssetNames, task?.id, task?.status, task?.plan?.title, task?.command]);

  const stats = useMemo(() => {
    const published = tasks.filter((item) => item.status === 'published').length;
    const waitingReview = tasks.filter((item) => item.requiresUserConfirmation).length;
    const failed = tasks.filter((item) => item.status === 'failed' || item.status === 'rejected').length;
    return { total: tasks.length, published, waitingReview, failed };
  }, [tasks]);

  const buildPixivOverrides = (values: CollectionConfigValues): WorkflowPixivOverrides => ({
    tag: values.tag,
    limit: values.limit,
    minBookmarks: values.minBookmarks,
    sort: values.sort,
    searchTarget: values.searchTarget,
    startDate: values.dateRange?.[0]?.format('YYYY-MM-DD'),
    endDate: values.dateRange?.[1]?.format('YYYY-MM-DD'),
    tagWhitelist: splitTags(values.tagWhitelistText),
    tagBlacklist: splitTags(values.tagBlacklistText),
  });

  const handleParseCommand = () => {
    if (!command.trim()) {
      message.warning('请输入指令后再解析');
      return;
    }
    const collectionValues = collectionForm.getFieldsValue();
    const videoValues = videoForm.getFieldsValue();
    collectionForm.setFieldsValue(inferCollectionConfig(command, { ...defaultCollectionConfig, ...collectionValues }));
    videoForm.setFieldsValue(inferVideoConfig(command, { ...defaultVideoConfig, ...videoValues }));
    message.success('已解析指令并填充表单，可继续手动调整');
  };

  const handleCreateTask = async () => {
    const values = await collectionForm.validateFields();
    const videoValues = await videoForm.validateFields();
    const activePublishConfig = { ...defaultPublishConfig, ...dashboardDraft?.publish, ...publishDraft };
    const created = await createTask.mutateAsync({
      command: command.trim(),
      dryRunDownload: values.useLocalAssets,
      pixivOverrides: buildPixivOverrides(values),
      videoOverrides: videoValues,
      publishOverrides: buildPublishOverrides(activePublishConfig),
      prefilterMode,
    });
    setSelectedTaskId(created.id);
    message.success(values.useLocalAssets ? '本地素材任务已创建' : 'Pixiv 抓取任务已创建');
  };

  const applyPreset = (presetId?: string) => {
    const preset = presets.find((item) => item.id === presetId);
    if (!preset) return;
    const payload = preset.payload as DashboardPresetPayload | undefined;
    setCommand(preset.command);
    setRecentPresetId(preset.id);
    if (payload?.collection) {
      collectionForm.setFieldsValue(deserializeCollectionValues(payload.collection));
    } else {
      collectionForm.setFieldsValue(inferCollectionConfig(preset.command, collectionForm.getFieldsValue()));
    }
    if (payload?.video) {
      videoForm.setFieldsValue({ ...defaultVideoConfig, ...payload.video });
    } else {
      videoForm.setFieldsValue(inferVideoConfig(preset.command, videoForm.getFieldsValue()));
    }
    if (payload?.prefilterMode) setPrefilterMode(payload.prefilterMode);
    message.success('预设已回填到当前工作台');
  };

  const handleSavePreset = async () => {
    const values = await collectionForm.validateFields();
    const videoValues = await videoForm.validateFields();
    const name = presetName.trim() || values.tag || '未命名工作流';
    const preset: Omit<CommandPreset, 'id' | 'createdAt' | 'updatedAt'> = {
      name,
      command: command.trim(),
      category: '仪表盘工作流',
      payload: {
        version: dashboardDraftVersion,
        collection: serializeCollectionValues(values),
        prefilterMode,
        video: videoValues,
      },
    };
    const saved = await addPresetAsync(preset);
    setRecentPresetId(saved.id);
    setSavePresetOpen(false);
    setPresetName('');
    message.success('当前工作台已保存为预设');
  };

  const handleRefresh = async () => {
    await Promise.all([refetchTasks(), task ? refetchTask() : Promise.resolve()]);
    message.success('工作流状态已刷新');
  };

  const handleApprove = async () => {
    if (!task) return;
    await approveTask.mutateAsync({ taskId: task.id, note: 'Dashboard 审核通过' });
    message.success('审核通过，正在生成 B站发布包');
  };

  const handleReject = async () => {
    if (!task) return;
    await rejectTask.mutateAsync({ taskId: task.id, note: 'Dashboard 驳回重做' });
    message.warning(task.status === 'review_required' ? '已驳回并重新生成视频' : '已驳回，可继续调整后重做');
  };

  const handleRerenderVideo = async () => {
    if (!task) return;
    await rerenderVideo.mutateAsync({ taskId: task.id, note: 'Dashboard 手动重新生成视频' });
    setVideoReviewOpen(false);
    message.success('已开始重新生成视频');
  };

  const handleAssetStatus = async (asset: WorkflowImageAsset, status: 'accepted' | 'rejected') => {
    if (!task) return;
    await updateAssetStatus.mutateAsync({
      taskId: task.id,
      assetName: asset.name,
      status,
      reason: status === 'rejected' ? '人工剔除' : undefined,
    });
    setPreviewAsset((current) =>
      current?.name === asset.name
        ? { ...current, status, reason: status === 'rejected' ? '人工剔除' : undefined }
        : current
    );
  };

  const handleContinueAssets = async (mode: WorkflowPrefilterMode = prefilterMode) => {
    if (!task) return;
    await continueAssets.mutateAsync({ taskId: task.id, mode });
    setReviewOpen(false);
    message.success(mode === 'keep_all' ? '已全部保留并进入封面生成' : mode === 'ai_rules' ? '已按 AI/规则筛选并进入封面生成' : '已按人工选择进入封面生成');
  };

  const handleContinueCover = async () => {
    if (!task) return;
    await continueCover.mutateAsync({ taskId: task.id });
    setCoverOpen(false);
    message.success('封面已确认，开始生成视频');
  };

  const handleRegenerateCover = async () => {
    if (!task) return;
    await regenerateCover.mutateAsync({
      taskId: task.id,
      assetNames: coverAssetNames,
      layout: coverLayout,
    });
    message.success('封面已按当前拼图设置重生成');
  };

  const handleResumeTask = async () => {
    if (!task) return;
    await resumeTask.mutateAsync({ taskId: task.id });
    message.success('已从失败阶段继续执行');
  };

  const getAssetPreviewUrl = (asset: WorkflowImageAsset) =>
    task ? `/api/workflow/tasks/${task.id}/assets/${encodeURIComponent(asset.name)}/preview` : '';

  const getAssetPreviewUrlByIndex = (assetIndex: number) =>
    task ? `/api/workflow/tasks/${task.id}/assets/by-index/${assetIndex}/preview` : '';

  const renderStageBubbleBody = () => {
    if (!task || !currentStage) return <Empty description="暂无运行中的任务" />;
    if (task.status === 'failed') {
      return (
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Text strong>{currentStage.error || currentStage.message || '任务执行失败'}</Text>
          <Text type="secondary">修复环境或配置后，可以从失败阶段继续执行。</Text>
          <Space wrap>
            <Button type="primary" icon={<ReloadOutlined />} loading={resumeTask.isPending} onClick={handleResumeTask}>
              从失败处继续
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新状态
            </Button>
          </Space>
        </Space>
      );
    }
    if (currentStage.id === 'download') {
      const total = task.plan?.pixivTarget.limit ?? collectionForm.getFieldValue('limit');
      return (
        <Row gutter={[14, 14]} align="middle">
          <Col xs={24} md={8}>
            <div className="dashboard-bubble-media">
              {latestAsset ? (
                <StableAssetImage
                  primarySrc={getAssetPreviewUrl(latestAsset)}
                  fallbackSrc={typeof latestAssetIndex === 'number' ? getAssetPreviewUrlByIndex(latestAssetIndex) : undefined}
                  alt={latestAsset.name}
                />
              ) : (
                <FileImageOutlined />
              )}
            </div>
          </Col>
          <Col xs={24} md={16}>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text strong>下载中 {task.assets.length}/{total || '-'}</Text>
              <Progress percent={currentStage.progress} size="small" strokeColor={gold} />
              <Text type="secondary" ellipsis={{ tooltip: latestAsset?.name || currentStage.message }}>
                {latestAsset?.title || latestAsset?.name || currentStage.message}
              </Text>
            </Space>
          </Col>
        </Row>
      );
    }
    if (currentStage.id === 'filter') {
      return (
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          <Space wrap>
            <Tag color="success">{acceptedAssets.length} 通过</Tag>
            <Tag color={rejectedAssets.length > 0 ? 'error' : 'default'}>{rejectedAssets.length} 剔除</Tag>
            <Tag>{task.assets.length} 总素材</Tag>
          </Space>
          <Text type="secondary">{currentStage.message}</Text>
          <Space wrap>
            <Button type="primary" disabled={!task.availableActions?.includes('continue_assets_manual')} loading={continueAssets.isPending} onClick={() => handleContinueAssets('manual')}>
              按当前选择继续
            </Button>
            <Button disabled={!task.availableActions?.includes('continue_assets_keep_all')} loading={continueAssets.isPending} onClick={() => handleContinueAssets('keep_all')}>
              全部保留
            </Button>
            <Button disabled={!task.availableActions?.includes('continue_assets_ai_rules')} loading={continueAssets.isPending} onClick={() => handleContinueAssets('ai_rules')}>
              按规则筛选
            </Button>
            <Button onClick={() => setReviewOpen(true)}>展开审核</Button>
          </Space>
        </Space>
      );
    }
    if (currentStage.id === 'image') {
      return (
        <Row gutter={[14, 14]} align="middle">
          <Col xs={24} md={10}>
            <div className="dashboard-bubble-media dashboard-bubble-media-wide">
              {task.coverPath ? <img src={coverPreviewUrl} alt="生成封面" /> : <FileImageOutlined />}
            </div>
          </Col>
          <Col xs={24} md={14}>
            <Space direction="vertical" size={10}>
              <Text strong>{currentStage.message}</Text>
              <Space wrap>
                <Button type="primary" icon={<CheckCircleOutlined />} disabled={!task.availableActions?.includes('approve_cover')} loading={continueCover.isPending} onClick={handleContinueCover}>
                  确认封面并生成视频
                </Button>
                <Button onClick={() => setCoverOpen(true)}>
                  展开封面工作台
                </Button>
                <Button danger disabled={!task.availableActions?.includes('reject')} loading={rejectTask.isPending} onClick={handleReject}>
                  驳回重做
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      );
    }
    if (currentStage.id === 'render' || currentStage.id === 'review') {
      const isRendering = task.status === 'running' && currentStage.id === 'render';
      return (
        <Row gutter={[14, 14]} align="middle">
          <Col xs={24} md={10}>
            <div className="dashboard-bubble-media dashboard-bubble-media-wide">
              {task.videoPath && !isRendering ? <video src={`/api/workflow/tasks/${task.id}/video`} controls muted /> : <VideoCameraOutlined />}
            </div>
          </Col>
          <Col xs={24} md={14}>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <Text strong>{isRendering ? currentStage.message : task.videoPath ? '视频已生成，等待审核' : currentStage.message}</Text>
              {isRendering && (
                <Progress
                  percent={renderProgress}
                  size="small"
                  status="active"
                  strokeColor={gold}
                  format={(percent) => `视频合成 ${percent ?? 0}%`}
                />
              )}
              {task.videoPath && !isRendering && <Paragraph copyable={{ text: task.videoPath }} ellipsis={{ rows: 1 }}>{task.videoPath}</Paragraph>}
              <Space wrap>
                <Button type="primary" icon={<CheckCircleOutlined />} disabled={!task.availableActions?.includes('approve_video')} loading={approveTask.isPending} onClick={handleApprove} style={{ background: '#22C55E', borderColor: '#22C55E' }}>
                  通过审核
                </Button>
                <Button loading={rerenderVideo.isPending} onClick={handleRerenderVideo}>
                  重新生成视频
                </Button>
                <Button disabled={!task.videoPath} onClick={() => setVideoReviewOpen(true)}>
                  展开视频审核
                </Button>
                <Button danger disabled={!task.availableActions?.includes('reject')} loading={rejectTask.isPending} onClick={handleReject}>
                  驳回重做
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>
      );
    }
    if (currentStage.id === 'publish') {
      return (
        <Alert
          type="success"
          showIcon
          message={task.publish?.message || currentStage.message}
          description={
            task.publish ? (
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                {task.publish.title && <Text strong>{task.publish.title}</Text>}
                {task.publish.tags && <Text type="secondary">标签：{task.publish.tags.join(' / ')}</Text>}
                {typeof task.publish.sourceCount === 'number' && <Text type="secondary">来源作品：{task.publish.sourceCount} 个</Text>}
                {task.publish.packagePath && <Paragraph copyable={{ text: task.publish.packagePath }} ellipsis={{ rows: 1 }}>发布包：{task.publish.packagePath}</Paragraph>}
                {task.publish.descriptionPath && <Paragraph copyable={{ text: task.publish.descriptionPath }} ellipsis={{ rows: 1 }}>简介：{task.publish.descriptionPath}</Paragraph>}
                {task.publish.articleMarkdownPath && <Paragraph copyable={{ text: task.publish.articleMarkdownPath }} ellipsis={{ rows: 1 }}>专栏：{task.publish.articleMarkdownPath}</Paragraph>}
              </Space>
            ) : (
              'B站发布包已生成。'
            )
          }
        />
      );
    }
    return <Text type="secondary">{currentStage.message}</Text>;
  };

  return (
    <div className="paf-page">
      <Space direction="vertical" size={18} style={{ width: '100%' }}>
        <Card bordered style={{ borderRadius: 8, borderColor: '#EBEBEB' }} bodyStyle={{ padding: 20 }}>
          <Row justify="space-between" align="middle" gutter={[16, 16]}>
            <Col>
              <Space size={12}>
                <div className="paf-brand-mark"><RobotOutlined /></div>
                <div>
                  <Title level={3} style={{ margin: 0 }}>Pixiv Auto Flow</Title>
                  <Text type="secondary">以任务为中心的连续工作台</Text>
                </div>
              </Space>
            </Col>
            <Col>
              <Space wrap>
                <Button icon={<ReloadOutlined />} onClick={handleRefresh}>刷新</Button>
                <Badge status={task?.status === 'failed' ? 'error' : task ? 'processing' : 'default'} text={task ? task.status : 'idle'} />
              </Space>
            </Col>
          </Row>
        </Card>

        <Card title="任务启动" extra={<Tag color="gold">当前表单参数为最终配置</Tag>} style={{ borderRadius: 8 }} bodyStyle={{ padding: 20 }}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Row gutter={[16, 16]}>
              <Col xs={24} xl={8}>
                <Space direction="vertical" size={10} style={{ width: '100%' }}>
                  <Text strong>自然语言指令（可选）</Text>
                  <Input.TextArea
                    value={command}
                    onChange={(event) => setCommand(event.target.value)}
                    placeholder="可输入：本周鸣潮 收藏数500+ 卡点视频。也可以留空，只用表单启动。"
                    rows={5}
                  />
                  <div className="paf-action-group">
                    <Button icon={<RobotOutlined />} onClick={handleParseCommand}>解析指令并填充</Button>
                    <Button icon={<SaveOutlined />} onClick={() => setSavePresetOpen(true)}>保存为预设</Button>
                  </div>
                </Space>
              </Col>
              <Col xs={24} xl={16}>
                <Form
                  form={collectionForm}
                  layout="vertical"
                  initialValues={deserializeCollectionValues(dashboardDraft?.collection)}
                  onValuesChange={() => setDraftRevision((value) => value + 1)}
                >
                  <Row gutter={12}>
                    <Col xs={24} md={8}>
                      <Form.Item label="命令预设" style={{ marginBottom: 12 }}>
                        <Select
                          allowClear
                          showSearch
                          value={recentPresetId}
                          placeholder="选择后回填指令和参数"
                          optionFilterProp="label"
                          onChange={applyPreset}
                          options={presets.map((preset) => ({ value: preset.id, label: `${preset.name} · ${preset.category}` }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="目标标签" name="tag" rules={[{ required: true, message: '请输入 Pixiv 标签' }]} style={{ marginBottom: 12 }}>
                        <Input placeholder="例如：鳴潮 / 原神 / 初音ミク" />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Item label="抓取数量" name="limit" rules={[{ required: true }]} style={{ marginBottom: 12 }}>
                        <InputNumber min={1} max={200} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Item label="收藏阈值" name="minBookmarks" style={{ marginBottom: 12 }}>
                        <InputNumber min={0} max={1000000} step={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                      <Form.Item label="排序" name="sort" style={{ marginBottom: 12 }}>
                        <Select options={[{ label: '热门优先', value: 'popular_desc' }, { label: '最新优先', value: 'date_desc' }, { label: '最早优先', value: 'date_asc' }]} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                      <Form.Item label="搜索方式" name="searchTarget" style={{ marginBottom: 12 }}>
                        <Select options={[{ label: '标签部分匹配', value: 'partial_match_for_tags' }, { label: '标签精确匹配', value: 'exact_match_for_tags' }, { label: '标题/简介匹配', value: 'title_and_caption' }]} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                      <Form.Item label="时间范围" name="dateRange" style={{ marginBottom: 12 }}>
                        <DatePicker.RangePicker style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={6}>
                      <Form.Item name="useLocalAssets" valuePropName="checked" label="素材来源" style={{ marginBottom: 12 }}>
                        <Checkbox>只使用本地素材</Checkbox>
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="Tag 白名单" name="tagWhitelistText" style={{ marginBottom: 12 }}>
                        <Input placeholder="多个用逗号分隔" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="Tag 黑名单" name="tagBlacklistText" style={{ marginBottom: 12 }}>
                        <Input placeholder="R-18, AI生成" />
                      </Form.Item>
                    </Col>
                    <Col xs={24} md={8}>
                      <Form.Item label="预过滤模式" style={{ marginBottom: 12 }}>
                        <Select value={prefilterMode} onChange={setPrefilterMode} options={prefilterModeOptions} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Col>
            </Row>

            <Form
              form={videoForm}
              layout="vertical"
              initialValues={{ ...defaultVideoConfig, ...dashboardDraft?.video }}
              onValuesChange={() => setDraftRevision((value) => value + 1)}
            >
              <Row gutter={12}>
                <Col xs={12} md={4}>
                  <Form.Item label="画幅" name="aspectRatio" style={{ marginBottom: 0 }}>
                    <Select options={[{ label: '16:9', value: '16:9' }, { label: '9:16', value: '9:16' }, { label: '1:1', value: '1:1' }]} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="风格" name="style" style={{ marginBottom: 0 }}>
                    <Select options={[{ label: '卡点', value: 'beat' }, { label: '柔和', value: 'soft' }, { label: '方形', value: 'square' }]} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Item label="运动" name="motion" style={{ marginBottom: 0 }}>
                    <Select
                      options={[
                        { label: '自动轮换', value: 'auto' },
                        { label: '无', value: 'none' },
                        { label: '慢推', value: 'slow_zoom' },
                        { label: '卡点缩放', value: 'beat_zoom' },
                        { label: '平移推近', value: 'pan_zoom' },
                        { label: '视差滑动', value: 'slide_parallax' },
                        { label: '快速切换', value: 'beat_cut' },
                        { label: '漂移推近', value: 'drift_zoom' },
                        { label: '电影摇移', value: 'cinematic_sway' },
                        { label: '脉冲弹入', value: 'pulse_pop' },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col xs={12} md={3}>
                  <Form.Item label="最大图片" name="maxImages" style={{ marginBottom: 0 }}>
                    <InputNumber min={1} max={80} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={3}>
                  <Form.Item label="每图秒数" name="secondsPerImage" style={{ marginBottom: 0 }}>
                    <InputNumber min={0.5} max={20} step={0.1} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={3}>
                  <Form.Item label="FPS" name="fps" style={{ marginBottom: 0 }}>
                    <InputNumber min={12} max={60} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
                <Col xs={12} md={3}>
                  <Form.Item label="缩放" name="zoom" style={{ marginBottom: 0 }}>
                    <InputNumber min={1} max={1.5} step={0.01} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12} style={{ marginTop: 12 }}>
                <Col xs={24} md={10}>
                  <Form.Item label="本地 BGM" style={{ marginBottom: 0 }}>
                    <Select
                      allowClear
                      showSearch
                      loading={isFetchingBgmCandidates}
                      placeholder="读取 bgm/、music/、assets/bgm/、assets/music/"
                      optionFilterProp="label"
                      value={videoForm.getFieldValue('bgmPath') || undefined}
                      onChange={(value) => {
                        videoForm.setFieldValue('bgmPath', value || '');
                        setDraftRevision((current) => current + 1);
                      }}
                      options={bgmCandidates.map((candidate) => ({
                        label: `${candidate.name} · ${candidate.directory} · ${formatBytes(candidate.size)}`,
                        value: candidate.path,
                      }))}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} md={10}>
                  <Form.Item label="指定 BGM 路径" name="bgmPath" style={{ marginBottom: 0 }}>
                    <Input placeholder="可粘贴本地音频绝对路径，优先于 AI 自动选曲" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={4}>
                  <Form.Item label=" " style={{ marginBottom: 0 }}>
                    <Button block icon={<ReloadOutlined />} loading={isFetchingBgmCandidates} onClick={() => refetchBgmCandidates()}>
                      刷新 BGM
                    </Button>
                  </Form.Item>
                </Col>
              </Row>
            </Form>

            <div className="paf-action-group">
              <Button type="primary" icon={<SendOutlined />} loading={createTask.isPending} onClick={handleCreateTask} style={{ background: gold, borderColor: gold }}>
                按当前参数启动
              </Button>
              <Text type="secondary">手动修改会覆盖解析结果；启动时不会绕过表单。</Text>
            </div>
          </Space>
        </Card>

        <Card title="工作流管道" extra={task ? <Text type="secondary">任务 {task.id}</Text> : null} style={{ borderRadius: 8 }}>
          {task ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              {workflowRoot && (
                <Alert
                  type="info"
                  showIcon
                  message="当前任务保存路径"
                  description={
                    <Space direction="vertical" size={2}>
                      <Paragraph copyable={{ text: workflowRoot }} style={{ marginBottom: 0 }}>
                        {workflowRoot}
                      </Paragraph>
                      <Text type="secondary">文件浏览页可切换到“工作流产物”查看下载图片、封面、视频和配置。</Text>
                    </Space>
                  }
                />
              )}
              {task.status === 'failed' && (
                <Alert
                  type="error"
                  showIcon
                  message="工作流在当前阶段中断"
                  description="修复依赖、网络或配置后，可直接从失败阶段继续，不会重新执行已完成的管道步骤。"
                  action={
                    <Button
                      type="primary"
                      icon={<ReloadOutlined />}
                      loading={resumeTask.isPending}
                      onClick={handleResumeTask}
                    >
                      从失败处继续
                    </Button>
                  }
                />
              )}
              <div className={`dashboard-stage-bubble dashboard-stage-${currentStageId ?? 'plan'}`}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space wrap>
                    <Tag color="gold">{currentStage?.label ?? '当前阶段'}</Tag>
                    <Tag color={statusColor[currentStage?.status ?? 'pending']}>{currentStage?.status ?? task.status}</Tag>
                    {task.requiresUserConfirmation && <Tag color="warning">需要确认</Tag>}
                  </Space>
                  {renderStageBubbleBody()}
                </Space>
              </div>
              <Row gutter={[12, 12]}>
                {task.stages.map((stage) => (
                  <Col xs={12} md={8} xl={Math.floor(24 / task.stages.length) || 4} key={stage.id}>
                    <div className={`dashboard-stage-tile ${stage.id === currentStageId ? 'dashboard-stage-tile-active' : ''}`}>
                      <Space direction="vertical" size={6} style={{ width: '100%', textAlign: 'center' }}>
                        <div style={{ color: stage.status === 'completed' ? '#22C55E' : stage.status === 'failed' ? '#EF4444' : gold, fontSize: 20 }}>
                          {stageIcons[stage.id]}
                        </div>
                        <Text strong>{stage.label}</Text>
                        <Tag color={statusColor[stage.status]}>{stage.status}</Tag>
                        <Text type="secondary" style={{ fontSize: 12 }}>{stage.message}</Text>
                      </Space>
                    </div>
                  </Col>
                ))}
              </Row>
              <Progress percent={pipelineProgress} strokeColor={gold} />
            </Space>
          ) : (
            <Empty description="暂无工作流任务" />
          )}
        </Card>

        <Card title="AI 工作流详情" extra={task ? <Tag color="gold">{task.status}</Tag> : null} style={{ borderRadius: 8 }}>
          {task ? (
            (() => {
              const aiLogs = task.logs.filter((log) => isAiRelatedLog(log.message));
              const visibleLogs = aiLogs.length > 0 ? aiLogs : task.logs.slice(-20);
              const failedAiLog = aiLogs.find((log) => log.level === 'error');
              return (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {failedAiLog && (
                    <Alert
                      type="error"
                      showIcon
                      message="AI 连接或生成失败，流程已停止"
                      description={parseAiLog(failedAiLog.message).detail}
                    />
                  )}
                  {aiLogs.length === 0 && (
                    <Alert
                      type="warning"
                      showIcon
                      message="当前任务没有 AI 日志"
                      description="这通常表示当前选中的是旧任务、后端还没重启到最新代码，或 AI Provider 仍是本地规则。下面显示最近任务日志用于定位。"
                    />
                  )}
                  <List
                    className="dashboard-ai-log-list"
                    dataSource={visibleLogs.slice().reverse()}
                    locale={{ emptyText: '暂无任务日志' }}
                    renderItem={(log) => {
                      const parsed = parseAiLog(log.message);
                      return (
                        <List.Item style={{ padding: '10px 0' }}>
                          <List.Item.Meta
                            avatar={<Badge status={log.level === 'error' ? 'error' : log.level === 'warn' ? 'warning' : 'processing'} />}
                            title={
                              <Space wrap size={6}>
                                <Tag color={aiStatusColor(parsed.status)}>{parsed.status}</Tag>
                                <Text strong>{parsed.step}</Text>
                                <Text type="secondary">{formatTime(log.timestamp)}</Text>
                              </Space>
                            }
                            description={
                              <Paragraph
                                copyable={parsed.detail.length > 80 ? { text: parsed.detail } : false}
                                style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}
                              >
                                {parsed.detail}
                              </Paragraph>
                            }
                          />
                        </List.Item>
                      );
                    }}
                  />
                </Space>
              );
            })()
          ) : (
            <Empty description="选择或创建任务后查看 AI 工作流详情" />
          )}
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}><Card style={{ borderRadius: 8 }}><Statistic title="任务总数" value={stats.total} prefix={<CodeOutlined />} /></Card></Col>
          <Col xs={24} md={6}><Card style={{ borderRadius: 8 }}><Statistic title="待处理" value={stats.waitingReview} prefix={<EyeOutlined />} valueStyle={{ color: '#FA8C16' }} /></Card></Col>
          <Col xs={24} md={6}><Card style={{ borderRadius: 8 }}><Statistic title="已生成发布包" value={stats.published} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#22C55E' }} /></Card></Col>
          <Col xs={24} md={6}><Card style={{ borderRadius: 8 }}><Statistic title="失败/驳回" value={stats.failed} valueStyle={{ color: '#EF4444' }} /></Card></Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={16}>
            <Card title="任务历史" style={{ borderRadius: 8 }}>
              <Table
                rowKey="id"
                size="small"
                dataSource={tasks}
                pagination={{ pageSize: 5 }}
                tableLayout="fixed"
                onRow={(record) => ({ onClick: () => setSelectedTaskId(record.id), style: { cursor: 'pointer' } })}
                columns={[
                  {
                    title: '任务',
                    dataIndex: 'command',
                    render: (value: string, record) => (
                      <Space direction="vertical" size={0}>
                        <Text strong>{record.plan?.title ?? value}</Text>
                        <Text type="secondary" ellipsis style={{ maxWidth: 520 }}>{value}</Text>
                      </Space>
                    ),
                  },
                  { title: '状态', dataIndex: 'status', width: 110, render: (value: string) => <Tag color={value === 'published' ? 'success' : value === 'failed' ? 'error' : 'processing'}>{value}</Tag> },
                  { title: '阶段', width: 110, render: (_, record) => record.stages.find((stage) => stage.id === record.currentStage)?.label ?? '-' },
                  { title: '素材', width: 80, render: (_, record) => record.assets.filter((asset) => asset.status === 'accepted').length },
                  { title: '更新时间', dataIndex: 'updatedAt', width: 180, render: (value: string) => new Date(value).toLocaleString() },
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card title="实时动态" style={{ borderRadius: 8 }}>
              <div className="dashboard-log-scroll">
                <List
                  size="small"
                  dataSource={(task?.progressEvents ?? []).slice().reverse()}
                  locale={{ emptyText: '暂无动态' }}
                  renderItem={(event) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Badge status={event.type === 'asset' ? 'success' : 'processing'} />}
                        title={<Text style={{ fontSize: 13 }}>{event.message}</Text>}
                        description={new Date(event.timestamp).toLocaleTimeString()}
                      />
                    </List.Item>
                  )}
                />
              </div>
            </Card>
          </Col>
        </Row>
      </Space>

      <Drawer title="图片预过滤" open={reviewOpen} onClose={() => setReviewOpen(false)} width={760}>
        {task ? (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space wrap>
              <Button type="primary" loading={continueAssets.isPending} onClick={() => handleContinueAssets('manual')}>按当前选择继续</Button>
              <Button loading={continueAssets.isPending} onClick={() => handleContinueAssets('keep_all')}>全部保留</Button>
              <Button loading={continueAssets.isPending} onClick={() => handleContinueAssets('ai_rules')}>按规则筛选</Button>
            </Space>
            <Row gutter={[8, 8]}>
              {task.assets.map((asset, assetIndex) => (
                <Col xs={12} md={8} key={asset.name}>
                  <div className="dashboard-asset-card">
                    <button type="button" onClick={() => { setPreviewAsset(asset); setPreviewAssetIndex(assetIndex); }}>
                      <StableAssetImage primarySrc={getAssetPreviewUrl(asset)} fallbackSrc={getAssetPreviewUrlByIndex(assetIndex)} alt={asset.name} />
                    </button>
                    <div>
                      <Text ellipsis={{ tooltip: asset.name }} style={{ display: 'block', fontSize: 12 }}>{asset.name}</Text>
                      <Space size={4} wrap style={{ marginBottom: 6 }}>
                        {asset.bookmarkCount !== undefined && <Tag color="gold">收藏 {formatCount(asset.bookmarkCount)}</Tag>}
                        {asset.popularityRank !== undefined && <Tag color="blue">本批 #{asset.popularityRank}</Tag>}
                        {asset.publishedAt && <Tag>{formatDateTime(asset.publishedAt)}</Tag>}
                      </Space>
                      <Space.Compact block>
                        <Button size="small" disabled={asset.status === 'accepted'} loading={updateAssetStatus.isPending} onClick={() => handleAssetStatus(asset, 'accepted')}>通过</Button>
                        <Button size="small" danger disabled={asset.status === 'rejected'} loading={updateAssetStatus.isPending} onClick={() => handleAssetStatus(asset, 'rejected')}>剔除</Button>
                      </Space.Compact>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Space>
        ) : <Empty description="暂无任务" />}
      </Drawer>

      <Drawer title="封面工作台" open={coverOpen} onClose={() => setCoverOpen(false)} width={980}>
        {task ? (
          <Row gutter={[18, 18]}>
            <Col xs={24} xl={14}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <div
                  className="dashboard-cover-preview"
                  style={{ aspectRatio: `${task.plan?.video.width ?? 16} / ${task.plan?.video.height ?? 9}` }}
                >
                  {task.coverPath ? <img src={coverPreviewUrl} alt="当前封面" /> : <FileImageOutlined />}
                </div>
                <Space wrap>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    disabled={!task.availableActions?.includes('approve_cover')}
                    loading={continueCover.isPending}
                    onClick={handleContinueCover}
                  >
                    确认封面并生成视频
                  </Button>
                  <Button loading={regenerateCover.isPending} onClick={handleRegenerateCover}>
                    按当前拼图重生成
                  </Button>
                  <Button danger disabled={!task.availableActions?.includes('reject')} loading={rejectTask.isPending} onClick={handleReject}>
                    驳回重做
                  </Button>
                </Space>
              </Space>
            </Col>
            <Col xs={24} xl={10}>
              <Space direction="vertical" size={14} style={{ width: '100%' }}>
                <div>
                  <Text strong>拼图布局</Text>
                  <Select
                    value={coverLayout}
                    onChange={setCoverLayout}
                    style={{ width: '100%', marginTop: 8 }}
                    options={[
                      { label: '四宫格', value: 'grid' },
                      { label: '单图全幅', value: 'single' },
                      { label: '左主图 + 右侧栏', value: 'hero_left' },
                      { label: '上主图 + 底部条', value: 'hero_top' },
                      { label: '横向条带', value: 'strip' },
                    ]}
                  />
                </div>
                <div>
                  <Text strong>选择封面素材</Text>
                  <Select
                    mode="multiple"
                    value={coverAssetNames}
                    onChange={setCoverAssetNames}
                    maxTagCount="responsive"
                    style={{ width: '100%', marginTop: 8 }}
                    options={acceptedAssets.map((asset) => ({ label: asset.title || asset.name, value: asset.name }))}
                  />
                </div>
                <div className="dashboard-cover-source-grid">
                  {acceptedAssets.map((asset, assetIndex) => {
                    const selected = coverAssetNames.includes(asset.name);
                    return (
                      <button
                        type="button"
                        key={asset.name}
                        className={selected ? 'dashboard-cover-source-selected' : ''}
                        onClick={() => {
                          setCoverAssetNames((current) =>
                            current.includes(asset.name)
                              ? current.filter((name) => name !== asset.name)
                              : [...current, asset.name]
                          );
                        }}
                      >
                        <StableAssetImage primarySrc={getAssetPreviewUrl(asset)} fallbackSrc={getAssetPreviewUrlByIndex(assetIndex)} alt={asset.name} />
                        <span>{asset.title || asset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </Space>
            </Col>
          </Row>
        ) : <Empty description="暂无封面任务" />}
      </Drawer>

      <Drawer title="视频审核" open={videoReviewOpen} onClose={() => setVideoReviewOpen(false)} width={1040}>
        {task?.videoPath ? (
          <Space direction="vertical" size={14} style={{ width: '100%' }}>
            <div className="dashboard-video-review">
              <video src={`/api/workflow/tasks/${task.id}/video`} controls />
            </div>
            <Paragraph copyable={{ text: task.videoPath }} ellipsis={{ rows: 2 }}>
              {task.videoPath}
            </Paragraph>
            <Space wrap>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                disabled={!task.availableActions?.includes('approve_video')}
                loading={approveTask.isPending}
                onClick={async () => {
                  await handleApprove();
                  setVideoReviewOpen(false);
                }}
                style={{ background: '#22C55E', borderColor: '#22C55E' }}
              >
                通过审核
              </Button>
              <Button loading={rerenderVideo.isPending} onClick={handleRerenderVideo}>
                重新生成视频
              </Button>
              <Button danger disabled={!task.availableActions?.includes('reject')} loading={rejectTask.isPending} onClick={handleReject}>
                驳回并重做
              </Button>
            </Space>
          </Space>
        ) : <Empty description="暂无可审核视频" />}
      </Drawer>

      <Modal open={savePresetOpen} title="保存为预设" onOk={handleSavePreset} confirmLoading={isAdding} onCancel={() => setSavePresetOpen(false)}>
        <Input value={presetName} onChange={(event) => setPresetName(event.target.value)} placeholder="预设名称，留空使用标签名" />
      </Modal>

      <Modal
        open={Boolean(previewAsset)}
        title={previewAsset?.name}
        footer={previewAsset && task ? (
          <Space>
            <Button disabled={previewAsset.status === 'accepted'} loading={updateAssetStatus.isPending} onClick={() => handleAssetStatus(previewAsset, 'accepted')}>标记通过</Button>
            <Button danger disabled={previewAsset.status === 'rejected'} loading={updateAssetStatus.isPending} onClick={() => handleAssetStatus(previewAsset, 'rejected')}>剔除素材</Button>
          </Space>
        ) : null}
        onCancel={() => { setPreviewAsset(undefined); setPreviewAssetIndex(undefined); }}
        width={860}
      >
        {previewAsset && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <StableAssetImage
              primarySrc={getAssetPreviewUrl(previewAsset)}
              fallbackSrc={typeof previewAssetIndex === 'number' ? getAssetPreviewUrlByIndex(previewAssetIndex) : undefined}
              alt={previewAsset.name}
              style={{ width: '100%', maxHeight: '70vh', objectFit: 'contain', background: '#111827', borderRadius: 8 }}
            />
            <Descriptions size="small" bordered column={2}>
              <Descriptions.Item label="尺寸">{previewAsset.width || '-'}x{previewAsset.height || '-'}</Descriptions.Item>
              <Descriptions.Item label="大小">{formatBytes(previewAsset.size)}</Descriptions.Item>
              <Descriptions.Item label="Pixiv ID">{previewAsset.pixivId ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="作者">{previewAsset.author?.name ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="发布日期">{formatDateTime(previewAsset.publishedAt)}</Descriptions.Item>
              <Descriptions.Item label="收藏数">{formatCount(previewAsset.bookmarkCount)}</Descriptions.Item>
              <Descriptions.Item label="浏览数">{formatCount(previewAsset.viewCount)}</Descriptions.Item>
              <Descriptions.Item label="本批热度排名">{previewAsset.popularityRank ? `#${previewAsset.popularityRank}` : '-'}</Descriptions.Item>
              <Descriptions.Item label="排名范围" span={2}>{previewAsset.popularityRankScope ?? '按当前任务素材收藏数排序'}</Descriptions.Item>
              <Descriptions.Item label="状态">{previewAsset.status === 'accepted' ? '通过' : '剔除'}</Descriptions.Item>
              <Descriptions.Item label="原因">{previewAsset.reason ?? '-'}</Descriptions.Item>
            </Descriptions>
          </Space>
        )}
      </Modal>
    </div>
  );
}
