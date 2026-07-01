import { Menu } from 'antd';
import {
  ApiOutlined,
  DashboardOutlined,
  SettingOutlined,
  DownloadOutlined,
  LinkOutlined,
  HistoryOutlined,
  FileTextOutlined,
  FolderOutlined,
  SaveOutlined,
  SearchOutlined,
  CloudUploadOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Horizontal product navigation. The export name is kept for compatibility.
 */
export default function LayoutSider() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: t('layout.dashboard'),
    },
    {
      key: '/ai',
      icon: <ApiOutlined />,
      label: t('layout.aiIntegration'),
    },
    {
      key: '/collection',
      icon: <SearchOutlined />,
      label: t('layout.collection'),
    },
    {
      key: '/video',
      icon: <VideoCameraOutlined />,
      label: t('layout.videoStudio'),
    },
    {
      key: '/publish',
      icon: <CloudUploadOutlined />,
      label: t('layout.publishSettings'),
    },
    {
      key: '/presets',
      icon: <SaveOutlined />,
      label: t('layout.commandPresets'),
    },
    {
      key: '/config',
      icon: <SettingOutlined />,
      label: t('layout.config'),
    },
    {
      key: '/download',
      icon: <DownloadOutlined />,
      label: t('layout.download'),
    },
    {
      key: '/url-download',
      icon: <LinkOutlined />,
      label: t('layout.urlDownload'),
    },
    {
      key: '/history',
      icon: <HistoryOutlined />,
      label: t('layout.history'),
    },
    {
      key: '/logs',
      icon: <FileTextOutlined />,
      label: t('layout.logs'),
    },
    {
      key: '/files',
      icon: <FolderOutlined />,
      label: t('layout.files'),
    },
  ];

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  return (
    <nav className="paf-tabs" aria-label="Pixiv Auto Flow navigation">
      <Menu
        className="paf-tabs-menu"
        selectedKeys={[location.pathname]}
        mode="horizontal"
        items={menuItems}
        onClick={handleMenuClick}
      />
    </nav>
  );
}
