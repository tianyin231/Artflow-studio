import { Layout, Space, Button, Select, Tag, Typography, Modal, Alert, Progress, Steps, Collapse, Timeline, message } from 'antd';
import {
  CheckCircleOutlined,
  DatabaseOutlined,
  FileDoneOutlined,
  LoginOutlined,
  LogoutOutlined,
  QuestionCircleOutlined,
  ReloadOutlined,
  RobotOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useWorkflowTasks } from '../../../hooks/useWorkflow';
import { useWorkflowSelectionStore } from '../../../stores';
import { SystemCheckItem, SystemCheckResult, WorkflowTask } from '../../../services/api/types';
import { systemApi } from '../../../services/api/system';

const { Header } = Layout;
const { Text } = Typography;

const systemCheckStages = [
  { key: 'config', title: '基础配置', itemIds: ['config', 'pixiv-auth'] },
  { key: 'storage', title: '存储路径', itemIds: ['download-dir', 'illustration-dir', 'novel-dir', 'database-dir'] },
  { key: 'production', title: '生产能力', itemIds: ['video-renderer', 'ai-caption'] },
  { key: 'publish', title: '发布能力', itemIds: ['bilibili-open-platform'] },
];

const systemCheckSteps = [
  { key: 'config', title: '读取配置文件', description: '检查配置文件是否存在、可读取并通过基础校验' },
  { key: 'pixiv-auth', title: '验证 Pixiv 登录', description: '检查 refresh token 是否已经配置' },
  { key: 'download-dir', title: '检查下载目录', description: '确认下载目录存在且当前用户可写' },
  { key: 'illustration-dir', title: '检查插画目录', description: '确认插画输出目录可用' },
  { key: 'novel-dir', title: '检查小说目录', description: '确认小说输出目录可用' },
  { key: 'database-dir', title: '检查数据库目录', description: '确认数据库所在目录可写' },
  { key: 'video-renderer', title: '检查视频渲染脚本', description: '确认 MoviePy 渲染入口存在' },
  { key: 'ai-caption', title: '检查 AI 文案配置', description: '确认发布文案生成能力是否就绪' },
  { key: 'bilibili-open-platform', title: '检查 B站发布接口', description: '确认开放平台发布接口预留状态' },
];

function getStatusColor(status: WorkflowTask['status']): string {
  if (status === 'published') return 'success';
  if (status === 'failed' || status === 'rejected') return 'error';
  if (status.includes('review')) return 'processing';
  return 'blue';
}

function formatTaskTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TaskSwitchLabel({ task, compact = false }: { task: WorkflowTask; compact?: boolean }) {
  return (
    <div className={compact ? 'paf-task-option paf-task-option-compact' : 'paf-task-option'}>
      <div className="paf-task-option-main">
        <Text strong ellipsis className="paf-task-option-title">
          {task.plan?.title ?? task.command}
        </Text>
        {!compact && (
          <Text type="secondary" ellipsis className="paf-task-option-command">
            {task.command}
          </Text>
        )}
      </div>
      <div className="paf-task-option-meta">
        <Tag color={getStatusColor(task.status)}>{task.status}</Tag>
        <Text>{task.assets.length} 素材</Text>
        <Text>{task.videoPath ? '视频已生成' : '无视频'}</Text>
        <Text type="secondary">{formatTaskTime(task.updatedAt)}</Text>
      </div>
    </div>
  );
}

function getCheckColor(status: SystemCheckItem['status']): 'success' | 'warning' | 'error' {
  if (status === 'ok') return 'success';
  return status;
}

function getStageIcon(key: string) {
  if (key === 'storage') return <DatabaseOutlined />;
  if (key === 'production') return <FileDoneOutlined />;
  if (key === 'publish') return <ToolOutlined />;
  return <CheckCircleOutlined />;
}

function getStageStatus(items: SystemCheckItem[]): SystemCheckItem['status'] {
  if (items.some((item) => item.status === 'error')) return 'error';
  if (items.some((item) => item.status === 'warning')) return 'warning';
  return 'ok';
}

interface LayoutHeaderProps {
  isAuthenticated: boolean;
  isLoggingOut: boolean;
  isRefreshingToken: boolean;
  onLogin: () => void;
  onLogout: () => void;
  onRefreshToken: () => void;
}

/**
 * Layout header component
 */
export default function LayoutHeader({
  isAuthenticated,
  isLoggingOut,
  isRefreshingToken,
  onLogin,
  onLogout,
  onRefreshToken,
}: LayoutHeaderProps) {
  const { t, i18n } = useTranslation();
  const { tasks } = useWorkflowTasks();
  const selectedTaskId = useWorkflowSelectionStore((state) => state.selectedTaskId);
  const setSelectedTaskId = useWorkflowSelectionStore((state) => state.setSelectedTaskId);
  const [systemCheckOpen, setSystemCheckOpen] = useState(false);
  const [systemCheck, setSystemCheck] = useState<SystemCheckResult>();
  const [checkingSystem, setCheckingSystem] = useState(false);
  const [checkProgress, setCheckProgress] = useState(0);
  const [checkStageIndex, setCheckStageIndex] = useState(0);
  const [checkStepIndex, setCheckStepIndex] = useState(0);
  const [checkLogs, setCheckLogs] = useState<string[]>([]);
  const [checkSlow, setCheckSlow] = useState(false);
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
  const selectedValue = selectedTask?.id;

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  const handleOpenSystemCheck = () => {
    setSystemCheckOpen(true);
  };

  const handleSystemCheck = async () => {
    setCheckingSystem(true);
    setSystemCheck(undefined);
    setCheckProgress(3);
    setCheckStageIndex(0);
    setCheckStepIndex(0);
    setCheckSlow(false);
    setCheckLogs([`开始诊断：${new Date().toLocaleTimeString('zh-CN')}`]);
    const slowTimer = window.setTimeout(() => {
      setCheckSlow(true);
      setCheckLogs((logs) => [...logs, '接口响应时间较长，仍在等待后端检查结果。']);
    }, 6000);
    const progressTimer = window.setInterval(() => {
      setCheckStepIndex((value) => {
        const next = Math.min(value + 1, systemCheckSteps.length - 1);
        setCheckProgress(Math.min(12 + Math.round((next / systemCheckSteps.length) * 76), 88));
        setCheckLogs((logs) => [...logs.slice(-5), `正在检查：${systemCheckSteps[next]?.title ?? '系统配置'}`]);
        return next;
      });
      setCheckStageIndex((value) => Math.min(value + 1, systemCheckStages.length - 1));
    }, 650);
    try {
      const result = (await systemApi.check()).data.data;
      setSystemCheck(result);
      setCheckProgress(100);
      setCheckStageIndex(systemCheckStages.length - 1);
      setCheckStepIndex(systemCheckSteps.length - 1);
      setCheckLogs((logs) => [...logs.slice(-5), `诊断完成：${result.summary.ok} 正常 / ${result.summary.warning} 警告 / ${result.summary.error} 错误`]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setCheckProgress(100);
      setCheckLogs((logs) => [...logs.slice(-5), `诊断失败：${errorMessage}`]);
      message.error('系统检查失败，请查看后端服务或网络连接');
    } finally {
      window.clearTimeout(slowTimer);
      window.clearInterval(progressTimer);
      setCheckingSystem(false);
    }
  };

  const stagePanels = systemCheckStages.map((stage) => {
    const items = systemCheck?.items.filter((item) => stage.itemIds.includes(item.id)) ?? [];
    const stageStatus = items.length > 0 ? getStageStatus(items) : 'ok';
    return {
      key: stage.key,
      label: (
        <Space>
          {getStageIcon(stage.key)}
          <Text strong>{stage.title}</Text>
          {systemCheck && <Tag color={getCheckColor(stageStatus)}>{items.length} 项</Tag>}
        </Space>
      ),
      children: (
        <Space direction="vertical" size={10} style={{ width: '100%' }}>
          {items.map((item) => (
            <Alert
              key={item.id}
              type={getCheckColor(item.status)}
              showIcon
              message={
                <Space>
                  <Text strong>{item.label}</Text>
                  <Tag color={getCheckColor(item.status)}>{item.status}</Tag>
                </Space>
              }
              description={
                <Space direction="vertical" size={2}>
                  <Text>{item.message}</Text>
                  {item.detail && <Text type="secondary">{item.detail}</Text>}
                  {item.suggestion && <Text type="warning"><QuestionCircleOutlined /> {item.suggestion}</Text>}
                </Space>
              }
            />
          ))}
        </Space>
      ),
    };
  });

  return (
    <Header className="paf-header">
      <div className="paf-brand">
        <div className="paf-brand-mark" aria-hidden="true">
          <RobotOutlined />
        </div>
        <div>
          <h1>Pixiv Auto Flow</h1>
          <p>自动化内容工作流</p>
        </div>
      </div>
      <Space className="paf-header-actions" size={10} wrap>
        <div className="paf-task-switcher" aria-label="当前工作流任务">
          <Text className="paf-task-switcher-label">当前任务</Text>
          <Select
            className="paf-task-select"
            size="middle"
            value={selectedValue}
            placeholder="选择任务"
            onChange={setSelectedTaskId}
            style={{ width: 520 }}
            popupMatchSelectWidth={680}
            options={tasks.slice(0, 20).map((task) => ({
              value: task.id,
              label: <TaskSwitchLabel task={task} compact={selectedValue === task.id} />,
            }))}
            notFoundContent="暂无任务"
          />
        </div>
        <Button
          className="paf-ghost-button"
          icon={<ToolOutlined />}
          onClick={handleOpenSystemCheck}
          loading={checkingSystem}
        >
          系统检查
        </Button>
        {isAuthenticated ? (
          <>
            <Button
              className="paf-ghost-button"
              icon={<ReloadOutlined />}
              onClick={onRefreshToken}
              loading={isRefreshingToken}
            >
              {t('layout.refreshToken')}
            </Button>
            <Button
              className="paf-ghost-button"
              icon={<LogoutOutlined />}
              onClick={onLogout}
              loading={isLoggingOut}
            >
              {t('layout.logout')}
            </Button>
          </>
        ) : (
          <Button type="primary" icon={<LoginOutlined />} onClick={onLogin}>
            {t('layout.login')}
          </Button>
        )}
        <Select
          className="paf-language-select"
          value={i18n.language}
          onChange={handleLanguageChange}
          style={{ width: 120 }}
          options={[
            { label: t('layout.languageZh'), value: 'zh-CN' },
            { label: t('layout.languageEn'), value: 'en-US' },
          ]}
        />
      </Space>
      <Modal
        title="系统功能配置检查"
        open={systemCheckOpen}
        onCancel={() => setSystemCheckOpen(false)}
        footer={[
          <Button key="close" onClick={() => setSystemCheckOpen(false)}>
            关闭
          </Button>,
          <Button key="rerun" type="primary" icon={<ReloadOutlined />} loading={checkingSystem} onClick={handleSystemCheck}>
            {systemCheck ? '重新检查' : '开始检查'}
          </Button>,
        ]}
        width={760}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            type={systemCheck ? getCheckColor(systemCheck.status) : 'info'}
            showIcon
            message={
              systemCheck
                ? `完成：${systemCheck.summary.ok} 正常 / ${systemCheck.summary.warning} 警告 / ${systemCheck.summary.error} 错误`
                : checkingSystem
                  ? '正在检查系统功能配置'
                  : '系统检查待启动'
            }
            description={systemCheck ? `检查时间：${new Date(systemCheck.checkedAt).toLocaleString('zh-CN')}` : '点击开始检查后，会逐项验证部署和功能配置。'}
          />
          <Progress
            percent={checkProgress}
            status={systemCheck?.status === 'error' ? 'exception' : checkingSystem ? 'active' : systemCheck ? 'success' : 'normal'}
            strokeColor={systemCheck?.status === 'warning' ? '#D97706' : undefined}
          />
          <Steps
            size="small"
            current={checkStageIndex}
            status={systemCheck?.status === 'error' ? 'error' : checkingSystem ? 'process' : 'finish'}
            items={systemCheckStages.map((stage, index) => ({
              title: stage.title,
              description: checkingSystem && index === checkStageIndex ? '检查中' : index < checkStageIndex || systemCheck ? '已检查' : '等待',
            }))}
          />
          {checkingSystem && (
            <>
              <Alert
                type={checkSlow ? 'warning' : 'info'}
                showIcon
                message={`正在检查：${systemCheckSteps[checkStepIndex]?.title ?? '系统配置'}`}
                description={checkSlow ? '后端响应较慢，可能是配置文件、目录权限或数据库访问耗时，请稍候。' : systemCheckSteps[checkStepIndex]?.description}
              />
              <Steps
                size="small"
                direction="vertical"
                current={checkStepIndex}
                items={systemCheckSteps.map((step, index) => ({
                  title: step.title,
                  description: index === checkStepIndex ? step.description : undefined,
                  status: index < checkStepIndex ? 'finish' : index === checkStepIndex ? 'process' : 'wait',
                }))}
              />
              <Timeline
                items={checkLogs.map((log, index) => ({
                  color: index === checkLogs.length - 1 ? 'blue' : 'green',
                  children: log,
                }))}
              />
            </>
          )}
          {systemCheck && (
            <Collapse
              defaultActiveKey={systemCheckStages.map((stage) => stage.key)}
              items={stagePanels}
            />
          )}
          {!checkingSystem && !systemCheck && (
            <Alert
              type="info"
              showIcon
              message="点击开始检查开始诊断"
              description="系统会按模块检查部署和功能配置，并给出修复建议。"
            />
          )}
          <Space wrap>
            <Text type="secondary">正常 {systemCheck?.summary.ok ?? 0}</Text>
            <Text type="warning">警告 {systemCheck?.summary.warning ?? 0}</Text>
            <Text type="danger">错误 {systemCheck?.summary.error ?? 0}</Text>
          </Space>
        </Space>
      </Modal>
    </Header>
  );
}
