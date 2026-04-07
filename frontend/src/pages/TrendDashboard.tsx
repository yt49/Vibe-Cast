import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnConnect,
  Background,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ── 暫定データ（Issue #18 の poc_arxiv_pipeline.py 出力を貼り付け） ──
// 後でバックエンドAPIから取得する形に差し替える
const RAW_NODES = [
  { id: 'LLMs', weight: 4 },
  { id: 'AI agents', weight: 2 },
  { id: 'Reinforcement Learning', weight: 2 },
  { id: 'Hallucination', weight: 2 },
];

const RAW_EDGES = [
  { source: 'Hallucination', target: 'LLMs', weight: 1 },
  { source: 'AI agents', target: 'LLMs', weight: 1 },
];

// ノードを円形に配置
function circularLayout(nodes: typeof RAW_NODES): Node[] {
  const cx = 300, cy = 250, r = 180;
  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    const size = 40 + n.weight * 8;
    return {
      id: n.id,
      position: { x: cx + r * Math.cos(angle) - size / 2, y: cy + r * Math.sin(angle) - size / 2 },
      data: { label: n.id },
      style: {
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        fontWeight: 600,
        background: '#1a3a5c',
        border: '2px solid #a8c7fa',
        color: '#a8c7fa',
        textAlign: 'center' as const,
        padding: 4,
        lineHeight: 1.2,
      },
    };
  });
}

function toFlowEdges(edges: typeof RAW_EDGES): Edge[] {
  return edges.map((e, i) => ({
    id: `e${i}`,
    source: e.source,
    target: e.target,
    style: { stroke: '#5f6368', strokeWidth: 1 + e.weight },
  }));
}

export default function TrendDashboard() {
  const initialNodes = useMemo(() => circularLayout(RAW_NODES), []);
  const initialEdges = useMemo(() => toFlowEdges(RAW_EDGES), []);

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect: OnConnect = useCallback(
    (conn) => setEdges((eds) => addEdge(conn, eds)),
    [setEdges],
  );

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 56px)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
        colorMode="dark"
      >
        <Background variant={BackgroundVariant.Dots} color="#3c4043" gap={20} />
      </ReactFlow>
    </div>
  );
}
