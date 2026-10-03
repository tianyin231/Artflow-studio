import { useState } from 'react';
import { Card, Table, Tag, Button, Typography, Space, message, DatePicker } from 'antd';
import { CalendarOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from '../utils/dayjs';
import { createLocalId, isRecord, readLocalJson, writeLocalJson } from '../utils/localStorage';

const { Title, Paragraph } = Typography;

interface CalItem {
  id: string;
  platform: string;
  isoTime: string;
  status: 'scheduled' | 'published' | 'cancelled';
  rrule?: string;
}

const SEED: CalItem[] = [
  {
    id: '1',
    platform: 'bilibili',
    isoTime: '2026-10-02T12:00:00Z',
    status: 'scheduled',
    rrule: 'FREQ=DAILY',
  },
  {
    id: '2',
    platform: 'youtube',
    isoTime: '2026-10-02T18:00:00Z',
    status: 'scheduled',
    rrule: 'FREQ=WEEKLY',
  },
  { id: '3', platform: 'telegram', isoTime: '2026-10-01T09:00:00Z', status: 'published' },
  {
    id: '4',
    platform: 'douyin',
    isoTime: '2026-10-02T20:00:00Z',
    status: 'scheduled',
    rrule: 'FREQ=DAILY',
  },
];

const STORAGE_KEY = 'artflow-publish-calendar-v1';
const TIMEZONE = 'Asia/Shanghai';

function isCalendar(value: unknown): value is CalItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item: unknown) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        !!item.id &&
        typeof item.platform === 'string' &&
        typeof item.isoTime === 'string' &&
        Number.isFinite(Date.parse(item.isoTime)) &&
        ['scheduled', 'published', 'cancelled'].includes(item.status as string) &&
        (item.rrule === undefined || typeof item.rrule === 'string')
    ) &&
    new Set(value.map((item: CalItem) => item.id)).size === value.length
  );
}

export default function PublishCalendarPage() {
  const [items, setItems] = useState(() => readLocalJson(STORAGE_KEY, SEED, isCalendar));
  const [scheduleTime, setScheduleTime] = useState<Dayjs | null>(() => dayjs().tz(TIMEZONE));

  const saveItems = (next: CalItem[]): boolean => {
    if (!writeLocalJson(STORAGE_KEY, next)) {
      message.error('无法保存排期草稿，请检查浏览器存储权限或空间');
      return false;
    }
    setItems(next);
    return true;
  };

  const createSchedule = () => {
    if (!scheduleTime) return;
    // DatePicker supplies wall-clock fields in the browser's timezone. Interpret
    // those fields in the displayed timezone before storing a UTC instant.
    const isoTime = dayjs.tz(scheduleTime.format('YYYY-MM-DD HH:mm:ss'), TIMEZONE).toISOString();
    if (
      saveItems([
        ...items,
        {
          id: createLocalId('schedule'),
          platform: 'local-export',
          isoTime,
          status: 'scheduled',
        },
      ])
    )
      message.success('已在此浏览器保存排期草稿');
  };
  return (
    <div data-testid="publish-calendar-page" style={{ padding: 24 }}>
      <Title level={2}>
        <CalendarOutlined /> 发布日历
      </Title>
      <Paragraph type="secondary">
        本地排期草稿（含示例） · 时区 Asia/Shanghai；自动发布、重复执行与冲突检测尚未接入。
      </Paragraph>
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          data-testid="btn-new-schedule"
          disabled={!scheduleTime}
          onClick={createSchedule}
        >
          新建排期
        </Button>
        <DatePicker
          aria-label="排期时间（Asia/Shanghai）"
          placeholder="选择排期时间（北京时间）"
          showTime
          format="YYYY-MM-DD HH:mm:ss"
          value={scheduleTime}
          onChange={setScheduleTime}
        />
      </Space>
      <Card>
        <Table
          rowKey="id"
          dataSource={items}
          data-testid="calendar-table"
          columns={[
            { title: '平台', dataIndex: 'platform', render: (p: string) => <Tag>{p}</Tag> },
            {
              title: '时间（Asia/Shanghai）',
              dataIndex: 'isoTime',
              render: (isoTime: string) =>
                dayjs(isoTime).tz(TIMEZONE).format('YYYY-MM-DD HH:mm:ss'),
            },
            { title: '重复规则（预览）', dataIndex: 'rrule', render: (r?: string) => r || '—' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (s: string) => (
                <Tag color={s === 'published' ? 'green' : s === 'scheduled' ? 'blue' : 'default'}>
                  {s}
                </Tag>
              ),
            },
            {
              title: '操作',
              render: (_: unknown, row: CalItem) => (
                <Button
                  size="small"
                  danger
                  data-testid={`btn-cancel-${row.id}`}
                  disabled={row.status !== 'scheduled'}
                  onClick={() => {
                    if (row.status === 'scheduled') {
                      saveItems(
                        items.map((x) => (x.id === row.id ? { ...x, status: 'cancelled' } : x))
                      );
                    }
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
