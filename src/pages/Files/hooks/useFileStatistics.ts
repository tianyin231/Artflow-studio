import { useMemo } from 'react';
import { FileItem } from '../Files';

const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];

/**
 * Hook for calculating file statistics
 */
export function useFileStatistics(files: FileItem[], directories: FileItem[]) {
  const stats = useMemo(() => {
    const all = [...directories, ...files];
    const directoriesCount = all.filter((item) => item.type === 'directory').length;
    const filesCount = all.reduce((sum, item) => {
      if (item.type === 'directory') return sum + (item.recursiveFileCount || 0);
      return sum + 1;
    }, 0);
    const totalSize = all.reduce((sum, item) => {
      if (item.type === 'directory') return sum + (item.recursiveSize || 0);
      return sum + (item.size || 0);
    }, 0);
    const images = all.reduce((sum, item) => {
      if (item.type === 'directory') return sum + (item.recursiveImageCount || 0);
      return imageExtensions.includes(item.extension?.toLowerCase() || '') ? sum + 1 : sum;
    }, 0);

    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return {
      directories: directoriesCount,
      files: filesCount,
      totalSize: formatFileSize(totalSize),
      images,
    };
  }, [directories, files]);

  return stats;
}
