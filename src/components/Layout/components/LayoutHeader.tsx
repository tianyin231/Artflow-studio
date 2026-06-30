import { Layout, Space, Button, Select, Tag, Typography } from 'antd';
import {
  ApiOutlined,
  LoginOutlined,
  LogoutOutlined,
  ReloadOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useWorkflowTasks } from '../../../hooks/useWorkflow';
import { useWorkflowSelectionStore } from '../../../stores';
import { WorkflowTask } from '../../../services/api/types';

const { Header } = Layout;
const { Text } = Typography;

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
  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? tasks[0];
  const selectedValue = selectedTask?.id;

  const handleLanguageChange = (value: string) => {
    i18n.changeLanguage(value);
  };

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
        <Tag
          className="paf-status-tag"
          icon={<ApiOutlined />}
          color={isAuthenticated ? 'success' : 'warning'}
        >
          {isAuthenticated ? 'Pixiv 已连接' : '等待登录'}
        </Tag>
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
    </Header>
  );
}
