import { useEffect, useState } from 'react';
import { PreviewModal } from '../../../components/modals/PreviewModal';
import { useFilePreview } from '../../../hooks/useFiles';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';

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
}

export interface FilePreviewProps {
  visible: boolean;
  file: FileItem | null;
  fileType: 'illustration' | 'novel' | 'workflow';
  fileSource?: 'classic' | 'workflow';
  onClose: () => void;
}

/**
 * File preview component using PreviewModal
 */
export function FilePreview({ visible, file, fileType, fileSource = 'classic', onClose }: FilePreviewProps) {
  const { t } = useTranslation();
  const [textContent, setTextContent] = useState<string>('');

  const ext = file?.extension?.toLowerCase() || '';
  const isImage = imageExtensions.includes(ext);
  const isText = textExtensions.includes(ext);
  const isVideo = videoExtensions.includes(ext);

  const { previewUrl, isLoading: isLoadingPreview } = useFilePreview(
    isImage || isVideo ? file?.path : undefined,
    fileType,
    fileSource
  );

  // Load text content for text files
  useEffect(() => {
    if (visible && file && isText) {
      const loadTextContent = async () => {
        try {
          const previewUrl = `/api/files/preview?path=${encodeURIComponent(file.path)}&type=${fileType}&source=${fileSource}`;
          const response = await fetch(previewUrl);
          if (response.ok) {
            const text = await response.text();
            setTextContent(text);
          } else {
            message.error(t('files.loadContentFailed'));
            onClose();
          }
        } catch (error) {
          message.error(t('files.loadContentFailed'));
          onClose();
        }
      };
      loadTextContent();
    } else if (!visible) {
      setTextContent('');
    }
  }, [visible, file, isText, fileType, fileSource, t, onClose]);

  if (!file) return null;

  // Determine preview type
  let previewType: 'image' | 'text' | 'custom' = 'custom';
  if (isImage) {
    previewType = 'image';
  } else if (isText) {
    previewType = 'text';
  }

  if (isVideo) {
    return (
      <PreviewModal
        open={visible}
        title={file.name}
        type="custom"
        content={
          <video
            src={previewUrl || undefined}
            controls
            style={{ width: '100%', maxHeight: '70vh', background: '#111827', borderRadius: 8 }}
          />
        }
        loading={isLoadingPreview}
        onCancel={onClose}
        width={960}
        showFooter={false}
      />
    );
  }

  return (
    <PreviewModal
      open={visible}
      title={file.name}
      type={previewType}
      imageUrl={isImage ? previewUrl || undefined : undefined}
      content={isText ? textContent : undefined}
      loading={isLoadingPreview || (isText && !textContent && visible)}
      onCancel={onClose}
      width={800}
      showFooter={false}
    />
  );
}
