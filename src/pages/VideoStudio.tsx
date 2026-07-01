import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Empty,
  Input,
  InputNumber,
  List,
  Progress,
  Row,
  Segmented,
  Select,
  Space,
  Statistic,
  Tabs,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CopyOutlined,
  FileImageOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SendOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import {
  useApproveWorkflowTask,
  useContinueWorkflowAssets,
  useContinueWorkflowCover,
  useCreateWorkflowTask,
  useRejectWorkflowTask,
  useUpdateWorkflowAssetStatus,
  useWorkflowTask,
  useWorkflowTasks,
} from '../hooks/useWorkflow';
import { useCommandPresets } from '../hooks/useCommandPresets';
import { useWorkflowSelectionStore } from '../stores';
import { WorkflowImageAsset, WorkflowPrefilterMode, WorkflowTask, WorkflowVideoMotion, WorkflowVideoOverrides } from '../services/api/types';

const { Text, Title, Paragraph } = Typography;

const gold = '#D4AF37';

const aspectRatioOptions = [
  { label: '横屏 16:9', value: '16:9' },
  { label: '竖屏 9:16', value: '9:16' },
  { label: '方形 1:1', value: '1:1' },
];

const motionOptions: Array<{ label: string; value: WorkflowVideoMotion }> = [
  { label: '自动轮换', value: 'auto' },
  { label: '慢推近', value: 'slow_zoom' },
  { label: '卡点推拉', value: 'beat_zoom' },
  { label: '平移推近', value: 'pan_zoom' },
  { label: '视差滑动', value: 'slide_parallax' },
  { label: '快速切换', value: 'beat_cut' },
  { label: '漂移推近', value: 'drift_zoom' },
  { label: '电影摇移', value: 'cinematic_sway' },
  { label: '脉冲弹入', value: 'pulse_pop' },
  { label: '无动效', value: 'none' },
];

const prefilterModeOptions: Array<{ label: string; value: WorkflowPrefilterMode }> = [
  { label: '人工选择', value: 'manual' },
  { label: 'AI/规则筛选', value: 'ai_rules' },
  { label: '全部保留', value: 'keep_all' },
];

const defaultVideoConfig: Required<
  Pick<WorkflowVideoOverrides, 'aspectRatio' | 'totalDuration' | 'maxImages' | 'fps' | 'crossfade' | 'zoom' | 'motion' | 'style' | 'disclaimer'>
> &
  Pick<WorkflowVideoOverrides, 'bgmPath'> = {
  aspectRatio: '16:9',
  totalDuration: 36,
  maxImages: 10,
  fps: 60,
  crossfade: 0.25,
  zoom: 1.06,
  motion: 'auto',
  style: 'beat',
  bgmPath: '',
  disclaimer: {
    enabled: true,
    duration: 3,
    title: '免责声明',
    lines: [
      '本视频为 Pixiv 插画整理与展示，作品版权归原作者所有。',
      '画面右下角标注作者与 Pixiv ID，便于溯源与联系。',
      '如原作者希望调整展示或移除内容，请联系处理。',
    ],
  },
};

function linesToText(lines?: string[]): string {
  return (lines ?? []).join('\n');
}

function textToLines(text: string): string[] {
  return text.split('\n');
}

function pickTask(tasks: WorkflowTask[], selectedTaskId?: string): WorkflowTask | undefined {
  if (selectedTaskId) {
    return tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
  }
  return tasks[0];
}

function inferVideoConfig(command: string): typeof defaultVideoConfig {
  const next = { ...defaultVideoConfig };
  if (command.includes('竖屏') || command.includes('9:16')) next.aspectRatio = '9:16';
  if (command.includes('方形') || command.includes('1:1')) next.aspectRatio = '1:1';
  if (command.includes('舒缓') || command.includes('柔和')) {
    next.style = 'soft';
    next.motion = 'drift_zoom';
    next.totalDuration = 42;
    next.fps = 60;
    next.crossfade = 0.35;
    next.zoom = 1.02;
  }
  if (command.includes('卡点') || command.includes('快节奏')) {
    next.style = 'beat';
    next.motion = 'beat_zoom';
    next.crossfade = 0.18;
    next.zoom = 1.08;
  }

  const durationMatch = command.match(/(?:时长|总时长)\s*(\d+)\s*(?:秒|s)?/i);
  if (durationMatch) next.totalDuration = Number(durationMatch[1]);
  const imageMatch = command.match(/(?:图数|图片数|张数|精选)\s*(\d+)/);
  if (imageMatch) next.maxImages = Number(imageMatch[1]);
  const bgmMatch = command.match(/BGM(?:路径)?[:：]\s*([^\s]+)/i) || command.match(/音乐(?:路径)?[:：]\s*([^\s]+)/);
  if (bgmMatch) next.bgmPath = bgmMatch[1];

  return next;
}

function getPreviewAspectRatio(task?: WorkflowTask): string {
  const width = task?.plan?.video.width;
  const height = task?.plan?.video.height;
  if (width && height) return `${width} / ${height}`;
  return '16 / 9';
}

export default function VideoStudio() {
  const { presets } = useCommandPresets();
  const [command, setCommand] = useState('本周鸣潮主题 收藏数5000+ 做成卡点视频 BGM电子风');
  const [dryRunDownload, setDryRunDownload] = useState(true);
  const [prefilterMode, setPrefilterMode] = useState<WorkflowPrefilterMode>('manual');
  const [useManualConfig, setUseManualConfig] = useState(true);
  const [videoConfig, setVideoConfig] = useState(defaultVideoConfig);
  const selectedTaskId = useWorkflowSelectionStore((state) => state.selectedTaskId);
  const setSelectedTaskId = useWorkflowSelectionStore((state) => state.setSelectedTaskId);
  const { tasks, refetch: refetchTasks } = useWorkflowTasks();
  const fallbackTask = pickTask(tasks, selectedTaskId);
  const { task: activeTask, refetch: refetchTask } = useWorkflowTask(fallbackTask?.id);
  const createTask = useCreateWorkflowTask();
  const approveTask = useApproveWorkflowTask();
  const rejectTask = useRejectWorkflowTask();
  const updateAssetStatus = useUpdateWorkflowAssetStatus();
  const continueAssets = useContinueWorkflowAssets();
  const continueCover = useContinueWorkflowCover();

  const task = activeTask ?? fallbackTask;
  const previewAspectRatio = getPreviewAspectRatio(task);
  const acceptedAssets = task?.assets.filter((asset) => asset.status === 'accepted') ?? [];
  const completedStages = task?.stages.filter((stage) => stage.status === 'completed').length ?? 0;
  const progress = task ? Math.round((completedStages / task.stages.length) * 100) : 0;

  const videoTasks = useMemo(
    () => tasks.filter((item) => item.videoPath || item.stages.some((stage) => stage.id === 'render')),
    [tasks]
  );
  const secondsPerImage = Number(
    ((videoConfig.totalDuration + Math.max(videoConfig.maxImages - 1, 0) * videoConfig.crossfade) / Math.max(videoConfig.maxImages, 1)).toFixed(2)
  );

  const handleCreate = async () => {
    if (!command.trim()) {
      message.warning('请输入视频生成命令');
      return;
    }
    const videoOverrides: WorkflowVideoOverrides | undefined = useManualConfig
      ? {
          ...videoConfig,
          secondsPerImage,
          bgmPath: videoConfig.bgmPath?.trim() || undefined,
          disclaimer: videoConfig.disclaimer
            ? {
                ...videoConfig.disclaimer,
                title: videoConfig.disclaimer.title.trim() || '免责声明',
                lines: videoConfig.disclaimer.lines.map((line) => line.trim()).filter(Boolean),
              }
            : undefined,
        }
      : undefined;
    const created = await createTask.mutateAsync({ command, dryRunDownload, prefilterMode, videoOverrides });
    setSelectedTaskId(created.id);
    message.success('视频生成任务已创建');
  };

  const handlePresetSelect = (presetCommand: string) => {
    setCommand(presetCommand);
    setVideoConfig(inferVideoConfig(presetCommand));
  };

  const handleInferConfig = () => {
    setVideoConfig(inferVideoConfig(command));
    message.success('已根据命令估算视频参数');
  };

  const handleRefresh = async () => {
    await Promise.all([refetchTasks(), task ? refetchTask() : Promise.resolve()]);
    message.success('视频任务已刷新');
  };

  const handleApprove = async () => {
    if (!task) return;
    await approveTask.mutateAsync({ taskId: task.id, note: '视频生成页审核通过' });
    message.success('已通过审核，正在生成 B站发布包');
  };

  const handleReject = async () => {
    if (!task) return;
    await rejectTask.mutateAsync({ taskId: task.id, note: '视频生成页驳回' });
    message.warning('已驳回任务');
  };

  const handleAssetStatus = async (asset: WorkflowImageAsset, status: 'accepted' | 'rejected') => {
    if (!task) return;
    await updateAssetStatus.mutateAsync({
      taskId: task.id,
      assetName: asset.name,
      status,
      reason: status === 'rejected' ? '人工剔除' : undefined,
    });
  };

  const handleContinueAssets = async (mode = prefilterMode) => {
    if (!task) return;
    await continueAssets.mutateAsync({ taskId: task.id, mode });
    message.success(mode === 'keep_all' ? '已全部保留并进入封面生成' : mode === 'ai_rules' ? '已按 AI/规则筛选并进入封面生成' : '已按人工选择进入封面生成');
  };

  const handleContinueCover = async () => {
    if (!task) return;
    await continueCover.mutateAsync({ taskId: task.id });
    message.success('封面已确认，开始视频生成');
  };

  const handleCopyPath = async () => {
    if (!task?.videoPath) return;
    await navigator.clipboard.writeText(task.videoPath);
    message.success('视频路径已复制');
  };

  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Card variant="outlined" styles={{ body: { padding: 16 } }}>
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              视频生成
            </Title>
            <Text type="secondary">复用工作流任务，把 Pixiv 素材筛选、MoviePy 渲染和审核发布放到一个页面。</Text>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card
            title="任务配置"
            styles={{ header: { minHeight: 44 }, body: { padding: 16 } }}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Select
                placeholder="选择常用命令预设"
                style={{ width: '100%' }}
                options={presets.map((preset) => ({
                  label: `${preset.name} · ${preset.category}`,
                  value: preset.command,
                }))}
                onChange={handlePresetSelect}
              />
              <Input.TextArea
                rows={4}
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="输入自然语言命令，例如：本周鸣潮主题 收藏数5000+ 做成卡点视频"
              />
              <Row gutter={[8, 8]}>
                <Col span={24}>
                  <Checkbox checked={dryRunDownload} onChange={(event) => setDryRunDownload(event.target.checked)}>
                    优先使用本地/演示素材
                  </Checkbox>
                </Col>
                <Col span={24}>
                  <Checkbox checked={useManualConfig} onChange={(event) => setUseManualConfig(event.target.checked)}>
                    使用手动参数覆盖 AI/命令解析
                  </Checkbox>
                </Col>
              </Row>
              <div>
                <Text type="secondary">预过滤处理</Text>
                <Segmented
                  block
                  options={prefilterModeOptions}
                  value={prefilterMode}
                  onChange={(value) => setPrefilterMode(value as WorkflowPrefilterMode)}
                />
              </div>
              <Button onClick={handleInferConfig} block>
                从命令估算参数
              </Button>
              <div>
                <Text type="secondary">画面比例</Text>
                <Segmented
                  block
                  options={aspectRatioOptions}
                  value={videoConfig.aspectRatio}
                  onChange={(value) => setVideoConfig((prev) => ({ ...prev, aspectRatio: value as '16:9' | '9:16' | '1:1' }))}
                />
              </div>
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <Text type="secondary">总时长（秒）</Text>
                  <InputNumber
                    min={3}
                    max={600}
                    value={videoConfig.totalDuration}
                    onChange={(value) => setVideoConfig((prev) => ({ ...prev, totalDuration: Number(value) || 36 }))}
                    style={{ width: '100%' }}
                  />
                </Col>
                <Col span={12}>
                  <Text type="secondary">图片数</Text>
                  <InputNumber
                    min={1}
                    max={80}
                    value={videoConfig.maxImages}
                    onChange={(value) => setVideoConfig((prev) => ({ ...prev, maxImages: Number(value) || 10 }))}
                    style={{ width: '100%' }}
                  />
                </Col>
              </Row>
              <Row gutter={[8, 8]}>
                <Col span={12}>
                  <Text type="secondary">帧率</Text>
                  <Select
                    value={videoConfig.fps}
                    style={{ width: '100%' }}
                    options={[24, 30, 60].map((value) => ({ label: `${value} FPS`, value }))}
                    onChange={(fps) => setVideoConfig((prev) => ({ ...prev, fps }))}
                  />
                </Col>
                <Col span={12}>
                  <Text type="secondary">每图</Text>
                  <Input value={`${secondsPerImage.toFixed(2)} 秒`} disabled />
                </Col>
              </Row>
              <Collapse
                size="small"
                ghost
                items={[
                  {
                    key: 'motion',
                    label: `BGM 与动效 · ${motionOptions.find((item) => item.value === videoConfig.motion)?.label ?? '动效'}`,
                    children: (
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <div>
                          <Text type="secondary">动效</Text>
                          <Segmented
                            block
                            options={motionOptions}
                            value={videoConfig.motion}
                            onChange={(value) => setVideoConfig((prev) => ({ ...prev, motion: value as WorkflowVideoMotion }))}
                          />
                        </div>
                        <Row gutter={[8, 8]}>
                          <Col span={12}>
                            <Text type="secondary">转场</Text>
                            <InputNumber
                              min={0}
                              max={2}
                              step={0.05}
                              value={videoConfig.crossfade}
                              onChange={(value) => setVideoConfig((prev) => ({ ...prev, crossfade: Number(value) || 0 }))}
                              style={{ width: '100%' }}
                            />
                          </Col>
                          <Col span={12}>
                            <Text type="secondary">缩放强度</Text>
                            <InputNumber
                              min={1}
                              max={1.5}
                              step={0.01}
                              value={videoConfig.zoom}
                              onChange={(value) => setVideoConfig((prev) => ({ ...prev, zoom: Number(value) || 1 }))}
                              style={{ width: '100%' }}
                            />
                          </Col>
                        </Row>
                        <div>
                          <Text type="secondary">BGM 本地路径</Text>
                          <Input
                            value={videoConfig.bgmPath}
                            onChange={(event) => setVideoConfig((prev) => ({ ...prev, bgmPath: event.target.value }))}
                            placeholder="/Users/nn3/Music/demo.mp3，留空则无音乐"
                          />
                        </div>
                      </Space>
                    ),
                  },
                  {
                    key: 'disclaimer',
                    label: `免责声明 · ${videoConfig.disclaimer.enabled ? `${videoConfig.disclaimer.duration}s` : '关闭'}`,
                    children: (
                      <Space direction="vertical" size={10} style={{ width: '100%' }}>
                        <Checkbox
                          checked={videoConfig.disclaimer.enabled}
                          onChange={(event) =>
                            setVideoConfig((prev) => ({
                              ...prev,
                              disclaimer: { ...prev.disclaimer, enabled: event.target.checked },
                            }))
                          }
                        >
                          在视频第一页显示
                        </Checkbox>
                        <Row gutter={[8, 8]}>
                          <Col span={12}>
                            <Text type="secondary">显示秒数</Text>
                            <InputNumber
                              min={0.5}
                              max={20}
                              step={0.5}
                              value={videoConfig.disclaimer.duration}
                              onChange={(value) =>
                                setVideoConfig((prev) => ({
                                  ...prev,
                                  disclaimer: { ...prev.disclaimer, duration: Number(value) || 3 },
                                }))
                              }
                              style={{ width: '100%' }}
                            />
                          </Col>
                          <Col span={12}>
                            <Text type="secondary">标题</Text>
                            <Input
                              value={videoConfig.disclaimer.title}
                              onChange={(event) =>
                                setVideoConfig((prev) => ({
                                  ...prev,
                                  disclaimer: { ...prev.disclaimer, title: event.target.value },
                                }))
                              }
                            />
                          </Col>
                        </Row>
                        <div>
                          <Text type="secondary">正文，每行一条</Text>
                          <Input.TextArea
                            rows={4}
                            value={linesToText(videoConfig.disclaimer.lines)}
                            onChange={(event) =>
                              setVideoConfig((prev) => ({
                                ...prev,
                                disclaimer: { ...prev.disclaimer, lines: textToLines(event.target.value) },
                              }))
                            }
                          />
                        </div>
                      </Space>
                    ),
                  },
                ]}
              />
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={createTask.isPending}
                onClick={handleCreate}
                block
              >
                创建视频任务
              </Button>
            </Space>
          </Card>
        </Col>

        <Col xs={24} xl={16}>
          <Card
            title="工作流审核"
            extra={task ? <Badge status={task.status === 'failed' ? 'error' : 'processing'} text={task.status} /> : null}
            styles={{ header: { minHeight: 44 }, body: { padding: 16 } }}
          >
            {task ? (
              <Tabs
                items={[
                  {
                    key: 'assets',
                    label: '素材预审核',
                    children: (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        <Alert
                          type={task.status === 'asset_review_required' ? 'warning' : 'info'}
                          showIcon
                          message={
                            task.status === 'asset_review_required'
                              ? '工作流已暂停，请确认保留或剔除的素材后继续。'
                              : '素材列表会在 PixivFlow 抓取和预过滤完成后显示。'
                          }
                        />
                        <Row gutter={[8, 8]}>
                          <Col span={8}>
                            <Statistic title="素材" value={task.assets.length} prefix={<FileImageOutlined />} />
                          </Col>
                          <Col span={8}>
                            <Statistic title="保留" value={acceptedAssets.length} valueStyle={{ color: '#22C55E' }} />
                          </Col>
                          <Col span={8}>
                            <Statistic title="剔除" value={task.assets.length - acceptedAssets.length} valueStyle={{ color: '#EF4444' }} />
                          </Col>
                        </Row>
                        <Space wrap>
                          <Button
                            type="primary"
                            disabled={task.status !== 'asset_review_required'}
                            loading={continueAssets.isPending}
                            onClick={() => handleContinueAssets('manual')}
                          >
                            按当前选择继续
                          </Button>
                          <Button
                            disabled={task.status !== 'asset_review_required'}
                            loading={continueAssets.isPending}
                            onClick={() => handleContinueAssets('ai_rules')}
                          >
                            按 AI/规则筛选
                          </Button>
                          <Button
                            disabled={task.status !== 'asset_review_required'}
                            loading={continueAssets.isPending}
                            onClick={() => handleContinueAssets('keep_all')}
                          >
                            全部保留
                          </Button>
                        </Space>
                        <List
                          grid={{ gutter: 12, xs: 1, sm: 2, md: 2, lg: 3, xl: 3 }}
                          dataSource={task.assets}
                          locale={{ emptyText: '暂无素材' }}
                          renderItem={(asset, index) => (
                            <List.Item>
                              <Card
                                size="small"
                                cover={
                                  <img
                                    src={`/api/workflow/tasks/${task.id}/assets/by-index/${index}/preview`}
                                    alt={asset.title || asset.name}
                                    loading="lazy"
                                    style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover' }}
                                  />
                                }
                                actions={[
                                  <Button
                                    key="accept"
                                    type={asset.status === 'accepted' ? 'primary' : 'text'}
                                    size="small"
                                    disabled={task.status !== 'asset_review_required'}
                                    loading={updateAssetStatus.isPending}
                                    onClick={() => handleAssetStatus(asset, 'accepted')}
                                  >
                                    保留
                                  </Button>,
                                  <Button
                                    key="reject"
                                    danger
                                    type={asset.status === 'rejected' ? 'primary' : 'text'}
                                    size="small"
                                    disabled={task.status !== 'asset_review_required'}
                                    loading={updateAssetStatus.isPending}
                                    onClick={() => handleAssetStatus(asset, 'rejected')}
                                  >
                                    剔除
                                  </Button>,
                                ]}
                              >
                                <Card.Meta
                                  title={<Text ellipsis>{asset.title || asset.name}</Text>}
                                  description={
                                    <Space direction="vertical" size={2}>
                                      <Text type="secondary">{asset.width}x{asset.height} · {(asset.size / 1024 / 1024).toFixed(2)} MB</Text>
                                      <Tag color={asset.status === 'accepted' ? 'success' : 'error'}>
                                        {asset.status === 'accepted' ? '保留' : asset.reason || '剔除'}
                                      </Tag>
                                    </Space>
                                  }
                                />
                              </Card>
                            </List.Item>
                          )}
                        />
                      </Space>
                    ),
                  },
                  {
                    key: 'cover',
                    label: '封面',
                    children: (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {task.coverPath ? (
                          <img
                            src={`/api/workflow/tasks/${task.id}/cover`}
                            alt={`${task.plan?.title ?? task.command} 封面`}
                            style={{
                              width: '100%',
                              maxHeight: 'min(58vh, 620px)',
                              aspectRatio: previewAspectRatio,
                              borderRadius: 8,
                              background: '#111827',
                              objectFit: 'contain',
                            }}
                          />
                        ) : (
                          <Empty description="封面会在素材预审核通过后生成" />
                        )}
                        <Space wrap>
                          <Button
                            type="primary"
                            icon={<CheckCircleOutlined />}
                            disabled={task.status !== 'cover_review_required'}
                            loading={continueCover.isPending}
                            onClick={handleContinueCover}
                          >
                            确认封面并生成视频
                          </Button>
                          <Button danger disabled={task.status !== 'cover_review_required'} loading={rejectTask.isPending} onClick={handleReject}>
                            驳回封面
                          </Button>
                          {task.coverPath && <Paragraph copyable={{ text: task.coverPath }}>{task.coverPath}</Paragraph>}
                        </Space>
                      </Space>
                    ),
                  },
                  {
                    key: 'video',
                    label: '视频审核',
                    children: (
                      <Row gutter={[16, 16]}>
                        <Col xs={24} lg={16}>
                          {task.videoPath ? (
                            <video
                              className="video-studio-preview-media"
                              src={`/api/workflow/tasks/${task.id}/video`}
                              controls
                              style={{
                                width: '100%',
                                maxHeight: 'min(58vh, 620px)',
                                aspectRatio: previewAspectRatio,
                                borderRadius: 8,
                                background: '#111827',
                                objectFit: 'contain',
                              }}
                            />
                          ) : (
                            <div
                              className="video-studio-preview-media"
                              style={{
                                aspectRatio: previewAspectRatio,
                                minHeight: 220,
                                maxHeight: 'min(58vh, 620px)',
                                borderRadius: 8,
                                background: '#171717',
                                color: '#fff',
                                display: 'grid',
                                placeItems: 'center',
                              }}
                            >
                              <Space direction="vertical" align="center">
                                <VideoCameraOutlined style={{ fontSize: 46, color: gold }} />
                                <Text style={{ color: 'rgba(255,255,255,0.76)' }}>等待视频生成</Text>
                              </Space>
                            </div>
                          )}
                        </Col>
                        <Col xs={24} lg={8}>
                          <Space direction="vertical" size={10} style={{ width: '100%' }}>
                            <Progress percent={progress} strokeColor={gold} />
                            <Row gutter={[8, 8]}>
                              <Col span={8}>
                                <Statistic title="素材" value={task.assets.length} />
                              </Col>
                              <Col span={8}>
                                <Statistic title="通过" value={acceptedAssets.length} valueStyle={{ color: '#22C55E' }} />
                              </Col>
                              <Col span={8}>
                                <Statistic title="阶段" value={`${completedStages}/${task.stages.length}`} />
                              </Col>
                            </Row>
                            {task.videoPath && (
                              <Paragraph copyable={{ text: task.videoPath }} ellipsis={{ rows: 2 }}>
                                {task.videoPath}
                              </Paragraph>
                            )}
                            <Space wrap>
                              <Button
                                type="primary"
                                icon={<CheckCircleOutlined />}
                                disabled={task.status !== 'review_required'}
                                loading={approveTask.isPending}
                                onClick={handleApprove}
                                style={{ background: '#22C55E', borderColor: '#22C55E' }}
                              >
                                通过审核
                              </Button>
                              <Button danger disabled={task.status !== 'review_required'} loading={rejectTask.isPending} onClick={handleReject}>
                                驳回
                              </Button>
                              <Button icon={<CopyOutlined />} disabled={!task.videoPath} onClick={handleCopyPath}>
                                复制路径
                              </Button>
                            </Space>
                            {task.publish && (
                              <Alert
                                type="success"
                                showIcon
                                message={task.publish.message}
                                description={
                                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                                    {task.publish.title && <Text strong>{task.publish.title}</Text>}
                                    {task.publish.tags && <Text type="secondary">标签：{task.publish.tags.join(' / ')}</Text>}
                                    {typeof task.publish.sourceCount === 'number' && <Text type="secondary">来源作品：{task.publish.sourceCount} 个</Text>}
                                    {task.publish.packagePath && <Paragraph copyable={{ text: task.publish.packagePath }} ellipsis={{ rows: 1 }}>发布包：{task.publish.packagePath}</Paragraph>}
                                    {task.publish.descriptionPath && <Paragraph copyable={{ text: task.publish.descriptionPath }} ellipsis={{ rows: 1 }}>简介：{task.publish.descriptionPath}</Paragraph>}
                                    {task.publish.articleMarkdownPath && <Paragraph copyable={{ text: task.publish.articleMarkdownPath }} ellipsis={{ rows: 1 }}>专栏：{task.publish.articleMarkdownPath}</Paragraph>}
                                  </Space>
                                }
                              />
                            )}
                          </Space>
                        </Col>
                      </Row>
                    ),
                  },
                ]}
              />
            ) : (
              <Empty description="暂无视频任务" />
            )}
          </Card>

          <Card title="最近视频任务" styles={{ header: { minHeight: 44 }, body: { padding: 0 } }} style={{ marginTop: 16 }}>
            <List
              size="small"
              dataSource={videoTasks.slice(0, 6)}
              locale={{ emptyText: '暂无任务' }}
              renderItem={(item) => (
                <List.Item
                  style={{ padding: '10px 16px' }}
                  actions={[
                    <Button key="open" size="small" icon={<PlayCircleOutlined />} onClick={() => setSelectedTaskId(item.id)}>
                      查看
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    title={<Text strong ellipsis>{item.plan?.title ?? item.command}</Text>}
                    description={
                      <Space wrap size={6}>
                        <Tag color={item.status === 'published' ? 'success' : item.status === 'failed' ? 'error' : 'processing'}>
                          {item.status}
                        </Tag>
                        {item.plan?.video && (
                          <Tag>
                            {item.plan.video.width}x{item.plan.video.height} · {item.plan.video.maxImages}图
                          </Tag>
                        )}
                        {item.videoPath && <Tag color="gold">已生成视频</Tag>}
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
