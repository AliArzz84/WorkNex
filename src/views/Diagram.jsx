import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, addEdge,
  applyNodeChanges, applyEdgeChanges, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '../store.jsx'
import { Icon } from '../ui.jsx'
import { dfdStyle } from '../data.js'

let counter = 1
const newId = () => "node_" + Date.now() + "_" + (counter++)

export default function Diagram() {
  const { db, saveDiagram, theme, askText } = useStore()
  const [nodes, setNodes] = useState(db.diagram?.nodes || [])
  const [edges, setEdges] = useState(db.diagram?.edges || [])
  const firstRun = useRef(true)
  const saveTimer = useRef(null)

  // debounced autosave (skip first render)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => saveDiagram({ nodes, edges }), 700)
    return () => saveTimer.current && clearTimeout(saveTimer.current)
  }, [nodes, edges])

  // pull in external changes (realtime from the other user, or Clear all)
  useEffect(() => {
    const incoming = db.diagram || { nodes: [], edges: [] }
    const localStr = JSON.stringify({ nodes, edges })
    const incomingStr = JSON.stringify({ nodes: incoming.nodes || [], edges: incoming.edges || [] })
    if (incomingStr !== localStr) {
      setNodes(incoming.nodes || [])
      setEdges(incoming.edges || [])
    }
  }, [db.diagram])

  const onNodesChange = useCallback((ch) => setNodes(ns => applyNodeChanges(ch, ns)), [])
  const onEdgesChange = useCallback((ch) => setEdges(es => applyEdgeChanges(ch, es)), [])
  const onConnect = useCallback((c) => setEdges(es => addEdge({ ...c, label: "", markerEnd: { type: MarkerType.ArrowClosed } }, es)), [])

  const addNode = (kind, label) => {
    setNodes(ns => [...ns, {
      id: newId(),
      position: { x: 140 + Math.random() * 140, y: 90 + Math.random() * 140 },
      data: { label }, style: dfdStyle(kind),
    }])
  }
  const onNodeDoubleClick = useCallback(async (_, node) => {
    const label = await askText({ title: "Rename node", value: node.data.label, confirmText: "Rename" })
    if (label != null) setNodes(ns => ns.map(n => n.id === node.id ? { ...n, data: { ...n.data, label } } : n))
  }, [askText])
  const onEdgeDoubleClick = useCallback(async (_, edge) => {
    const label = await askText({ title: "Edge label", value: edge.label || "", confirmText: "Save" })
    if (label != null) setEdges(es => es.map(e => e.id === edge.id ? { ...e, label } : e))
  }, [askText])

  return (
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <div className="dfd-toolbar">
        <button className="btn sm add-btn" onClick={() => addNode("process", "Process")}><Icon name="plus" size={14} /> Process</button>
        <button className="btn ghost sm add-btn" onClick={() => addNode("entity", "External entity")}><Icon name="plus" size={14} /> Entity</button>
        <button className="btn ghost sm add-btn" onClick={() => addNode("store", "Data store")}><Icon name="plus" size={14} /> Data store</button>
        <span className="muted dfd-hint">Drag to move • drag dot → dot to connect • double-click to rename • Backspace to delete</span>
      </div>
      <div className="dfd-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          colorMode={theme === "dark" ? "dark" : "light"}
          defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
          fitView
        >
          <Background gap={16} />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  )
}
