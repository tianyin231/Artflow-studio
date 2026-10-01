import { useState } from 'react';
import { Card, List, Button, Tag, Typography, Space, message } from 'antd';
import { PlayCircleOutlined, CopyOutlined, EditOutlined } from '@ant-design/icons';
import TemplateEditor, { toGraph, fromGraph, type TemplateGraph } from './TemplateEditor';

const { Title, Paragraph } = Typography;

export interface TemplateCard {
  id: string;
  name: string;
  description: string;
  tags: string[];
  nodes: number;
}

const DEFAULT_TEMPLATES: TemplateCard[] = [
  { id: 'wuthering-weekly', name: '鸣潮周榜卡点', description: '收藏 5000+ 周榜 → B站/本地', tags: ['bilibili', '卡点'], nodes: 7 },
  { id: 'miku-soft', name: '初音柔和图集', description: '柔和风格 → YouTube 4K', tags: ['youtube'], nodes: 4 },
  { id: 'we-loop', name: 'Wallpaper Engine 循环壁纸', description: '风景 → WE 循环包', tags: ['wallpaper-engine'], nodes: 3 },
  { id: 'yt-shorts', name: 'YouTube Shorts 竖屏', description: '竖版 1080x1920', tags: ['youtube', '竖屏'], nodes: 3 },
  { id: 'local-export-only', name: '本地导出', description: '仅导出发布包', tags: ['local'], nodes: 2 },
  { id: 'xhs-portrait', name: '小红书竖版导出', description: '3:4/9:16 人工上传', tags: ['小红书'], nodes: 3 },
  { id: 'tg-notify', name: 'Telegram 通知', description: '发布后通知', tags: ['telegram'], nodes: 4 },
  { id: 'ai-first', name: 'AI 优先规划', description: '自然语言 → 全流程', tags: ['ai'], nodes: 5 },
];

export default function TemplateLibrary() {
  const [templates] = useState(DEFAULT_TEMPLATES);
  const [editing, setEditing] = useState<TemplateGraph | null>(null);
  const [savedJson, setSavedJson] = useState('');
  return (
    <div data-testid="template-library-page" style={{ padding: 24 }}>
      <Title level={2}>模板库</Title>
      <Paragraph type="secondary">一键运行 / 复制编辑 / 查看节点图</Paragraph>
      <List
        grid={{ gutter: 16, column: 3 }}
        dataSource={templates}
        renderItem={(t) => (
          <List.Item>
            <Card
              data-testid={`template-${t.id}`}
              title={t.name}
              actions={[
                <Button key="run" type="primary" icon={<PlayCircleOutlined />} onClick={() => message.success(`运行 ${t.name}`)}>
                  运行
                </Button>,
                <Button key="copy" icon={<CopyOutlined />} onClick={() => message.success('已复制')}>
                  复制
                </Button>,
                <Button
                  key="edit"
                  icon={<EditOutlined />}
                  data-testid={`btn-edit-${t.id}`}
                  onClick={() =>
                    setEditing(
                      toGraph({
                        id: t.id,
                        name: t.name,
                        nodes: Array.from({ length: t.nodes }, (_, i) => ({
                          id: `n${i}`,
                          kind: i === 0 ? 'source' : i === t.nodes - 1 ? 'publish' : 'render',
                        })),
                        edges: Array.from({ length: t.nodes - 1 }, (_, i) => ({
                          from: `n${i}`,
                          to: `n${i + 1}`,
                        })),
                      })
                    )
                  }
                >
                  编辑
                </Button>,
              ]}
            >
              <Paragraph>{t.description}</Paragraph>
              <Space>
                {t.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
                <Tag color="blue">{t.nodes} 节点</Tag>
              </Space>
            </Card>
          </List.Item>
        )}
      />
      {editing && (
        <div style={{ marginTop: 24 }} data-testid="template-editor-panel">
          <TemplateEditor
            initial={editing}
            onSave={(g) => {
              setSavedJson(JSON.stringify(fromGraph(g), null, 2));
              setEditing(null);
            }}
          />
        </div>
      )}
      {savedJson && (
        <pre data-testid="saved-template-json" style={{ marginTop: 16, background: '#f5f5f5', padding: 12 }}>
          {savedJson}
        </pre>
      )}
    </div>
  );
}
