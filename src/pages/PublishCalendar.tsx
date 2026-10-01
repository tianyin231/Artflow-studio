import { useState } from 'react';
import { Card, Table, Tag, Button, Typography, Space, message, DatePicker } from 'antd';
import { CalendarOutlined, PlusOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

interface CalItem {
  id: string;
  platform: string;
  isoTime: string;
  status: string;
  rrule?: string;
}

const SEED: CalItem[] = [
  { id: '1', platform: 'bilibili', isoTime: '2026-10-02T12:00:00Z', status: 'scheduled', rrule: 'FREQ=DAILY' },
  { id: '2', platform: 'youtube', isoTime: '2026-10-02T18:00:00Z', status: 'scheduled', rrule: 'FREQ=WEEKLY' },
  { id: '3', platform: 'telegram', isoTime: '2026-10-01T09:00:00Z', status: 'published' },
  { id: '4', platform: 'douyin', isoTime: '2026-10-02T20:00:00Z', status: 'scheduled', rrule: 'FREQ=DAILY' },
];

export default function PublishCalendarPage() {
  const [items, setItems] = useState(SEED);
  return (
    <div data-testid="publish-calendar-page" style={{ padding: 24 }}>
      <Title level={2}>
        <CalendarOutlined /> 发布日历
      </Title>
      <Paragraph type="secondary">RRULE 重复 · 冲突检测 · 每日上限 · 时区 Asia/Shanghai</Paragraph>
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          data-testid="btn-new-schedule"
          onClick={() => {
            setItems((prev) => [
              ...prev,
              {
                id: String(Date.now()),
                platform: 'local-export',
                isoTime: new Date().toISOString(),
                status: 'scheduled',
              },
            ]);
            message.success('已新建排期');
          }}
        >
          新建排期
        </Button>
        <DatePicker />
      </Space>
      <Card>
        <Table
          rowKey="id"
          dataSource={items}
          data-testid="calendar-table"
          columns={[
            { title: '平台', dataIndex: 'platform', render: (p: string) => <Tag>{p}</Tag> },
            { title: '时间', dataIndex: 'isoTime' },
            { title: '重复', dataIndex: 'rrule', render: (r?: string) => r || '—' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (s: string) => (
                <Tag color={s === 'published' ? 'green' : s === 'scheduled' ? 'blue' : 'default'}>{s}</Tag>
              ),
            },
            {
              title: '操作',
              render: (_: unknown, row: CalItem) => (
                <Button
                  size="small"
                  danger
                  data-testid={`btn-cancel-${row.id}`}
                  onClick={() => {
                    setItems((prev) => prev.map((x) => (x.id === row.id ? { ...x, status: 'cancelled' } : x)));
                  }}
                >
                  取消
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
