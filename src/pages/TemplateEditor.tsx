/**
 * Visual workflow template editor (@xyflow) — F6-C.
 */
import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button, Card, Space, Typography, message, Alert } from 'antd';
import { SaveOutlined, CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { isRecord } from '../utils/localStorage';

const { Title, Paragraph } = Typography;

const KIND_COLORS: Record<string, string> = {
  source: '#1677ff',
  filter: '#722ed1',
  review: '#fa8c16',
  'ai-plan': '#13c2c2',
  cover: '#eb2f96',
  render: '#52c41a',
  publish: '#faad14',
  notify: '#8c8c8c',
};

export interface TemplateGraph {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  variables?: Record<string, string>;
}

interface WorkflowTemplate {
  version: 'workflow-template.v1';
  id: string;
  name: string;
  nodes: { id: string; kind: string; params?: Record<string, unknown> }[];
  edges: { from: string; to: string }[];
  variables?: Record<string, string>;
}

export function toGraph(
  template: Omit<WorkflowTemplate, 'version'> & { version?: WorkflowTemplate['version'] }
): TemplateGraph {
  return {
    id: template.id,
    name: template.name,
    nodes: template.nodes.map((n, i) => ({
      id: n.id,
      type: 'default',
      position: { x: 80 + (i % 4) * 200, y: 80 + Math.floor(i / 4) * 120 },
      data: {
        label: `${n.id} (${n.kind})`,
        kind: n.kind,
        ...(n.params === undefined ? {} : { params: n.params }),
      },
      style: { borderColor: KIND_COLORS[n.kind] || '#999', borderWidth: 2 },
    })),
    edges: template.edges.map((e, i) => ({
      id: `e${i}`,
      source: e.from,
      target: e.to,
      animated: true,
    })),
    ...(template.variables === undefined ? {} : { variables: template.variables }),
  };
}

export function fromGraph(graph: TemplateGraph): WorkflowTemplate {
  return {
    version: 'workflow-template.v1' as const,
    id: graph.id,
    name: graph.name,
    nodes: graph.nodes.map((n) => {
      if (
        typeof n.data.kind !== 'string' ||
        !Object.prototype.hasOwnProperty.call(KIND_COLORS, n.data.kind)
      ) {
        throw new Error('节点类型无效');
      }
      return {
        id: n.id,
        kind: n.data.kind,
        ...(n.data.params === undefined
          ? {}
          : { params: n.data.params as Record<string, unknown> }),
      };
    }),
    edges: graph.edges.map((e) => ({ from: e.source, to: e.target })),
    ...(graph.variables === undefined ? {} : { variables: graph.variables }),
  };
}

export function detectCycle(nodes: Node[], edges: Edge[]): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) adj.set(e.source, [...(adj.get(e.source) || []), e.target]);
  const seen = new Set<string>();
  const stack = new Set<string>();
  const visit = (id: string): boolean => {
    if (stack.has(id)) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    stack.add(id);
    for (const n of adj.get(id) || []) if (visit(n)) return true;
    stack.delete(id);
    return false;
  };
  return nodes.some((n) => visit(n.id));
}

function graphErrors(nodes: Node[], edges: Edge[]): string[] {
  const errors: string[] = [];
  const ids = new Set(nodes.map((n) => n.id));
  if (nodes.length === 0) errors.push('模板至少需要一个节点');
  if (ids.size !== nodes.length || nodes.some((n) => !n.id.trim()))
    errors.push('节点 ID 必须唯一且非空');
  if (
    nodes.some(
      (n) =>
        typeof n.data.kind !== 'string' ||
        !Object.prototype.hasOwnProperty.call(KIND_COLORS, n.data.kind)
    )
  ) {
    errors.push('节点类型无效');
  }
  if (edges.some((e) => !ids.has(e.source) || !ids.has(e.target)))
    errors.push('连线包含不存在的节点');
  if (detectCycle(nodes, edges)) errors.push('检测到环，禁止保存');
  return errors;
}

export function isTemplateGraph(value: unknown): value is TemplateGraph {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    !value.id.trim() ||
    typeof value.name !== 'string' ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  )
    return false;
  if (
    !value.nodes.every(
      (n: unknown) =>
        isRecord(n) &&
        typeof n.id === 'string' &&
        isRecord(n.position) &&
        typeof n.position.x === 'number' &&
        Number.isFinite(n.position.x) &&
        typeof n.position.y === 'number' &&
        Number.isFinite(n.position.y) &&
        isRecord(n.data) &&
        typeof n.data.label === 'string' &&
        typeof n.data.kind === 'string' &&
        (n.data.params === undefined || isRecord(n.data.params))
    )
  )
    return false;
  if (
    !value.edges.every(
      (e: unknown) =>
        isRecord(e) &&
        typeof e.id === 'string' &&
        typeof e.source === 'string' &&
        typeof e.target === 'string'
    )
  )
    return false;
  if (
    value.variables !== undefined &&
    (!isRecord(value.variables) ||
      !Object.values(value.variables).every((v) => typeof v === 'string'))
  )
    return false;
  const graph = value as unknown as TemplateGraph;
  return (
    graphErrors(graph.nodes, graph.edges).length === 0 &&
    new Set(graph.edges.map((e) => e.id)).size === graph.edges.length
  );
}

export default function TemplateEditor({
  initial,
  onSave,
}: {
  initial: TemplateGraph;
  onSave?: (g: TemplateGraph) => void | boolean;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const name = initial.name;

  useEffect(() => {
    setNodes(initial.nodes);
    setEdges(initial.edges);
  }, [initial, setNodes, setEdges]);

  const hasCycle = useMemo(() => detectCycle(nodes, edges), [nodes, edges]);
  const errors = useMemo(() => graphErrors(nodes, edges), [nodes, edges]);

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((eds) => addEdge({ ...c, animated: true }, eds));
    },
    [setEdges]
  );

  const handleSave = () => {
    if (errors.length || !onSave) {
      message.error(errors[0] || '未配置模板保存位置');
      return;
    }
    try {
      if (onSave({ ...initial, nodes, edges }) === false) return;
      message.success('模板已保存到此浏览器');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '模板保存失败');
    }
  };

  return (
    <div
      data-testid="template-editor"
      style={{ height: 480, display: 'flex', flexDirection: 'column' }}
    >
      <Space style={{ marginBottom: 8 }}>
        <Title level={4} style={{ margin: 0 }}>
          编辑: {name}
        </Title>
        <Button
          data-testid="btn-save-template"
          type="primary"
          icon={<SaveOutlined />}
          disabled={errors.length > 0 || !onSave}
          onClick={handleSave}
        >
          保存模板
        </Button>
        {hasCycle ? (
          <Alert
            data-testid="cycle-warning"
            type="error"
            showIcon
            icon={<WarningOutlined />}
            message="检测到环，禁止保存"
          />
        ) : errors.length > 0 ? (
          <Alert data-testid="graph-warning" type="error" showIcon message={errors.join('；')} />
        ) : (
          <Alert
            data-testid="graph-ok"
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message="图结构有效"
          />
        )}
      </Space>
      <Paragraph type="secondary">
        节点可拖拽；拖拽连线新建边；保存输出 workflow-template.v1 JSON。
      </Paragraph>
      <Card style={{ flex: 1, minHeight: 360 }} styles={{ body: { height: '100%', padding: 0 } }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </Card>
    </div>
  );
}
