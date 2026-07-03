import { WorkflowPublishOverrides } from '../services/api/types';

export type PublishConfigValues = Required<Pick<WorkflowPublishOverrides, 'syncArticle' | 'original' | 'aigc'>> &
  Pick<WorkflowPublishOverrides, 'title' | 'description' | 'tags' | 'dynamic' | 'category' | 'articleTitle' | 'articleBody'> & {
    tagText: string;
  };

export const defaultPublishConfig: PublishConfigValues = {
  title: '',
  description: '',
  dynamic: '',
  category: '动画/MAD·AMV',
  tags: [],
  tagText: 'Pixiv, 插画, fanart',
  original: false,
  aigc: true,
  syncArticle: false,
  articleTitle: '',
  articleBody: '',
};

export function splitTags(value?: string): string[] {
  return (value ?? '')
    .split(/[,，\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function buildPublishOverrides(values: PublishConfigValues): WorkflowPublishOverrides {
  return {
    title: values.title?.trim() || undefined,
    description: values.description?.trim() || undefined,
    dynamic: values.dynamic?.trim() || undefined,
    category: values.category?.trim() || undefined,
    tags: splitTags(values.tagText),
    original: values.original,
    aigc: values.aigc,
    syncArticle: values.syncArticle,
    articleTitle: values.articleTitle?.trim() || undefined,
    articleBody: values.articleBody?.trim() || undefined,
  };
}
