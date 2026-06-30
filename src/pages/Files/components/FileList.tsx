import { useMemo } from 'react';
import { Table, Button, Space, Tag, Popconfirm } from 'antd';
import {
  FolderOutlined,
  PictureOutlined,
  FileTextOutlined,
  FileOutlined,
  EyeOutlined,
  DeleteOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../utils/dateUtils';

const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const textExtensions = ['.txt', '.md', '.text', '.json'];
const videoExtensions = ['.mp4', '.mov', '.webm', '.mkv'];

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
  recursiveFileCount?: number;
  recursiveImageCount?: number;
  recursiveSize?: number;
}

export interface FileListProps {
  files: FileItem[];
  directories: FileItem[];
  loading?: boolean;
  sortBy: 'name' | 'time' | 'size' | 'type' | 'downloadedAt';
  sortOrder: 'asc' | 'desc';
  onSort: (column: 'name' | 'time' | 'size' | 'type' | 'downloadedAt') => void;
  onPreview: (file: FileItem) => void;
  onDelete: (file: FileItem) => void;
  onNavigate: (path: string) => void;
  fileType: 'illustration' | 'novel' | 'workflow';
  fileSource?: 'classic' | 'workflow';
}

/**
 * File list table component
 */
export function FileList({
  files,
  directories,
  loading = false,
  sortBy,
  sortOrder,
  onSort,
  onPreview,
  onDelete,
  onNavigate,
}: FileListProps) {
  const { t } = useTranslation();

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getSortIcon = (column: 'name' | 'time' | 'size' | 'type' | 'downloadedAt') => {
    if (sortBy !== column) return null;
    return sortOrder === 'asc' ? <SortAscendingOutlined /> : <SortDescendingOutlined />;
  };

  const canDelete = (record: FileItem) =>
    !(record.type === 'file' && record.extension?.toLowerCase() === '.db');

  // Combine directories and files, directories first
  const allItems = useMemo(() => {
    return [...directories, ...files];
  }, [directories, files]);

  const columns = [
    {
      title: (
        <span
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => onSort('name')}
        >
          {t('files.name')} {getSortIcon('name')}
        </span>
      ),
      dataIndex: 'name',
      key: 'name',
      width: 300,
      ellipsis: {
        showTitle: true,
      },
      render: (name: string, record: FileItem) => (
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0 }}>
          <span style={{ flexShrink: 0, marginRight: 8 }}>
            {record.type === 'directory' ? (
              <FolderOutlined style={{ color: '#1890ff', fontSize: 16 }} />
            ) : imageExtensions.includes(record.extension?.toLowerCase() || '') ? (
              <PictureOutlined style={{ color: '#52c41a', fontSize: 16 }} />
            ) : (
              <FileTextOutlined style={{ fontSize: 16 }} />
            )}
          </span>
          <Button
            type="link"
            onClick={() => {
              if (record.type === 'directory') {
                onNavigate(record.path);
              } else {
                onPreview(record);
              }
            }}
            style={{
              padding: 0,
              height: 'auto',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              textAlign: 'left',
            }}
            title={name}
          >
            {name}
          </Button>
        </div>
      ),
    },
    {
      title: (
        <span
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => onSort('type')}
        >
          {t('files.type')} {getSortIcon('type')}
        </span>
      ),
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string, record: FileItem) => {
        if (type === 'directory') {
          return <Tag color="blue" icon={<FolderOutlined />}>{t('files.typeDirectory')}</Tag>;
        }
        const ext = record.extension?.toLowerCase() || '';
        if (imageExtensions.includes(ext)) {
          return <Tag color="green" icon={<PictureOutlined />}>{t('files.typeImage')}</Tag>;
        }
        if (videoExtensions.includes(ext)) {
          return <Tag color="purple" icon={<FileOutlined />}>视频</Tag>;
        }
        if (textExtensions.includes(ext)) {
          return <Tag color="orange" icon={<FileTextOutlined />}>{ext === '.json' ? '配置' : t('files.typeText')}</Tag>;
        }
        return <Tag icon={<FileOutlined />}>{t('files.typeFile')}</Tag>;
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category: string | undefined, record: FileItem) => {
        if (record.type === 'directory') return record.source === 'workflow' ? <Tag color="gold">任务</Tag> : '-';
        const labels: Record<string, string> = {
          asset: '下载图片',
          cover: '封面',
          video: '视频',
          config: '配置',
          illustration: '插画',
          novel: '小说',
        };
        return <Tag>{labels[category || ''] || category || '-'}</Tag>;
      },
    },
    {
      title: (
        <span
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => onSort('size')}
        >
          {t('files.size')} {getSortIcon('size')}
        </span>
      ),
      dataIndex: 'size',
      key: 'size',
      width: 120,
      render: (size: number) => formatFileSize(size),
    },
    {
      title: (
        <span
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => onSort('time')}
        >
          {t('files.modified')} {getSortIcon('time')}
        </span>
      ),
      dataIndex: 'modified',
      key: 'modified',
      width: 180,
      render: (time: string) => formatDate(time),
    },
    {
      title: (
        <span
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => onSort('downloadedAt')}
        >
          {t('files.downloadedAt')} {getSortIcon('downloadedAt')}
        </span>
      ),
      dataIndex: 'downloadedAt',
      key: 'downloadedAt',
      width: 180,
      render: (time: string | null | undefined, record: FileItem) => {
        if (record.type === 'directory') return '-';
        if (!time) return <span style={{ color: '#999' }}>{t('files.unknown')}</span>;
        return formatDate(time);
      },
    },
    {
      title: '保存路径',
      dataIndex: 'displayPath',
      key: 'displayPath',
      width: 260,
      ellipsis: { showTitle: true },
      render: (path: string | undefined, record: FileItem) => path || record.path,
    },
    {
      title: t('files.actions'),
      key: 'action',
      width: 150,
      fixed: 'right' as const,
      render: (_: unknown, record: FileItem) => (
        <Space>
          {record.type === 'file' &&
            (imageExtensions.includes(record.extension?.toLowerCase() || '') ||
              textExtensions.includes(record.extension?.toLowerCase() || '') ||
              videoExtensions.includes(record.extension?.toLowerCase() || '')) && (
              <Button
                type="link"
                icon={<EyeOutlined />}
                onClick={() => onPreview(record)}
                size="small"
              >
                {t('files.preview')}
              </Button>
            )}
          {canDelete(record) && (
            <Popconfirm
              title={record.type === 'directory' ? '确认删除该目录及其关联记录？' : t('files.confirmDelete')}
              onConfirm={() => onDelete(record)}
              okText={t('common.ok')}
              cancelText={t('common.cancel')}
            >
              <Button type="link" danger icon={<DeleteOutlined />} size="small">
                {t('files.delete')}
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ overflowX: 'auto' }}>
      <Table
        columns={columns}
        dataSource={allItems}
        rowKey="path"
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{
          pageSize: 50,
          showSizeChanger: true,
          showTotal: (total, range) =>
            t('files.displaying', { start: range[0], end: range[1], total }),
          pageSizeOptions: ['20', '50', '100', '200'],
        }}
      />
    </div>
  );
}
