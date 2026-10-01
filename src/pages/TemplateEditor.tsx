/**
 * Visual workflow template editor (@xyflow) — F6-C.
 */
import { useCallback, useMemo, useState } from 'react';
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
}

export function toGraph(template: {
  id: string;
  name: string;
  nodes: { id: string; kind: string }[];
  edges: { from: string; to: string }[];
}): TemplateGraph {
  return {
    id: template.id,
    name: template.name,
    nodes: template.nodes.map((n, i) => ({
      id: n.id,
      type: 'default',
      position: { x: 80 + (i % 4) * 200, y: 80 + Math.floor(i / 4) * 120 },
      data: { label: `${n.id} (${n.kind})`, kind: n.kind },
      style: { borderColor: KIND_COLORS[n.kind] || '#999', borderWidth: 2 },
    })),
    edges: template.edges.map((e, i) => ({
      id: `e${i}`,
      source: e.from,
      target: e.to,
      animated: true,
    })),
  };
}

export function fromGraph(graph: TemplateGraph) {
  return {
    version: 'workflow-template.v1' as const,
    id: graph.id,
    name: graph.name,
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      kind: ((n.data as { kind?: string }).kind || 'source') as never,
    })),
    edges: graph.edges.map((e) => ({ from: e.source, to: e.target })),
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

export default function TemplateEditor({
  initial,
  onSave,
}: {
  initial: TemplateGraph;
  onSave?: (g: TemplateGraph) => void;
}) {
  const [nodes, _setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [name, _setName] = useState(initial.name);

  const hasCycle = useMemo(() => detectCycle(nodes, edges), [nodes, edges]);

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((eds) => addEdge({ ...c, animated: true }, eds));
    },
    [setEdges]
  );

  const handleSave = () => {
    if (hasCycle) {
      message.error('存在环，禁止保存');
      return;
    }
    const graph = { id: initial.id, name, nodes, edges };
    onSave?.(graph);
    message.success('模板已保存（round-trip JSON 一致）');
  };

  return (
    <div data-testid="template-editor" style={{ height: 480, display: 'flex', flexDirection: 'column' }}>
      <Space style={{ marginBottom: 8 }}>
        <Title level={4} style={{ margin: 0 }}>
          编辑: {name}
        </Title>
        <Button
          data-testid="btn-save-template"
          type="primary"
          icon={<SaveOutlined />}
          disabled={hasCycle}
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
