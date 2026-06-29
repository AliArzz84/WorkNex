import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, MiniMap,
  Handle, Position, ConnectionMode, ConnectionLineType, MarkerType,
  addEdge, applyNodeChanges, applyEdgeChanges, useReactFlow,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../lib/store.jsx'
import { Icon } from '../../components/ui/ui.jsx'
import { dfdStyle } from '../../lib/data.js'
import styles from './Diagram.module.css'

let counter = 1
const newId = () => "node_" + Date.now() + "_" + (counter++)

/* the three DFD building blocks */
const KINDS = [
  { kind: "process", label: "Process", hint: "An action / transformation" },
  { kind: "entity", label: "External entity", hint: "A person or outside system" },
  { kind: "store", label: "Data store", hint: "Where data is kept" },
]
const KIND_LABEL = { process: "Process", entity: "External entity", store: "Data store" }

/* migrate legacy (style-only) nodes to the custom node type, inferring their kind */
const kindFromStyle = (s) => {
  const bg = String(s?.background || "")
  if (bg.includes("eafaf0")) return "store"
  if (bg.includes("fff4e6")) return "entity"
  return "process"
}
const toFlowNode = (n) => n?.type === "dfd"
  ? n
  : { ...n, type: "dfd", data: { ...(n?.data || {}), kind: n?.data?.kind || kindFromStyle(n?.style) } }

/* custom node: same look as before, but with connection points on all four sides */
const SIDES = [["t", Position.Top], ["r", Position.Right], ["b", Position.Bottom], ["l", Position.Left]]
function DfdNode({ data }) {
  return (
    <>
      {SIDES.map(([id, pos]) => (
        <Handle key={id} id={id} type="source" position={pos} className={styles.handle} />
      ))}
      <span className={styles.nodeLabel}>{data.label}</span>
    </>
  )
}
const nodeTypes = { dfd: DfdNode }

const EDGE_OPTS = { type: "smoothstep", markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 }, style: { strokeWidth: 1.6 } }
/* stable references — passing fresh arrays/objects inline makes React Flow re-init on every render */
const SNAP_GRID = [16, 16]
const DELETE_KEYS = ["Backspace", "Delete"]
const PRO_OPTIONS = { hideAttribution: true }

function DiagramCanvas() {
  const { db, saveDiagram, theme, askText, ask, isGuest } = useStore()
  const editable = !isGuest   // guests (shared view-only links) get a read-only canvas
  const { screenToFlowPosition, fitView } = useReactFlow()
  const wrapRef = useRef(null)
  const menuRef = useRef(null)
  const [nodes, setNodes] = useState(() => (db.diagram?.nodes || []).map(toFlowNode))
  const [edges, setEdges] = useState(db.diagram?.edges || [])
  const [menu, setMenu] = useState(null)   // { kind:'pane'|'node'|'edge', x, y, flow:{x,y}, id }
  const firstRun = useRef(true)
  const saveTimer = useRef(null)
  const lastSavedSig = useRef("")
  const dragging = useRef(false)   // true while a node is being dragged — pauses autosave hashing
  // unsaved local edits are pending — block an incoming snapshot from clobbering them
  // (this is what fixes the "a deleted node comes back, so you have to delete twice" bug)
  const localDirty = useRef(false)
  const history = useRef({ stack: [], i: -1, lock: false })   // undo/redo snapshots
  const [hist, setHist] = useState({ canUndo: false, canRedo: false })

  const syncHist = () => setHist({ canUndo: history.current.i > 0, canRedo: history.current.i < history.current.stack.length - 1 })
  const pushHistory = (state) => {
    const h = history.current
    h.stack = h.stack.slice(0, h.i + 1)
    h.stack.push({ nodes: [...state.nodes], edges: [...state.edges] })
    if (h.stack.length > 60) h.stack.shift()
    h.i = h.stack.length - 1
    syncHist()
  }
  const undo = () => {
    const h = history.current
    if (h.i <= 0) return
    dragging.current = false
    h.i--; h.lock = true                       // the resulting autosave shouldn't record a new step
    setNodes(h.stack[h.i].nodes); setEdges(h.stack[h.i].edges); syncHist()
  }
  const redo = () => {
    const h = history.current
    if (h.i >= h.stack.length - 1) return
    dragging.current = false
    h.i++; h.lock = true
    setNodes(h.stack[h.i].nodes); setEdges(h.stack[h.i].edges); syncHist()
  }

  /* only the meaningful parts — ignore ReactFlow's selected/dragging/measured churn.
     style is derived from kind (dfdStyle), so `k` already captures any visual change — no need to serialize the whole style object */
  const sig = (ns, es) => JSON.stringify({
    n: (ns || []).map(n => ({ id: n.id, x: Math.round(n.position?.x || 0), y: Math.round(n.position?.y || 0), l: n.data?.label, k: n.data?.kind })),
    e: (es || []).map(e => ({ id: e.id, s: e.source, t: e.target, sh: e.sourceHandle, th: e.targetHandle, l: e.label, a: !!e.animated, ty: e.type })),
  })

  /* debounced autosave — only when the signature truly changes */
  useEffect(() => {
    if (dragging.current) return   // mid-drag: skip hashing + saving entirely so the drag stays smooth (the final, dragging:false change runs this and saves)
    const cur = sig(nodes, edges)
    if (firstRun.current) {
      firstRun.current = false
      lastSavedSig.current = cur
      history.current = { stack: [{ nodes, edges }], i: 0, lock: false }
      return
    }
    if (cur === lastSavedSig.current) return
    localDirty.current = true   // a local edit is now waiting to be saved — don't let a remote snapshot revert it
    // consume the undo/redo lock now (not in the timer) so a fresh edit that coalesces with it still gets recorded
    const skipHistory = history.current.lock
    history.current.lock = false
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      lastSavedSig.current = cur
      localDirty.current = false
      saveDiagram({ nodes, edges })
      if (!skipHistory) pushHistory({ nodes, edges })   // undo/redo states are already in the stack
    }, 700)
    return () => saveTimer.current && clearTimeout(saveTimer.current)
  }, [nodes, edges])

  /* pull external changes (realtime / Clear all), compared by signature */
  useEffect(() => {
    if (localDirty.current) return   // we have an unsaved local edit in flight — our save will win; don't clobber it
    const incoming = db.diagram || { nodes: [], edges: [] }
    const incNodes = (incoming.nodes || []).map(toFlowNode)
    const incomingSig = sig(incNodes, incoming.edges)
    if (incomingSig === sig(nodes, edges)) return
    setNodes(incNodes)
    setEdges(incoming.edges || [])
    lastSavedSig.current = incomingSig
  }, [db.diagram])

  /* keyboard undo / redo (ignored while typing in a dialog field) */
  useEffect(() => {
    const onKey = (e) => {
      if (isGuest) return
      if (e.target?.matches?.("input, textarea")) return
      const z = e.key === "z" || e.key === "Z"
      if ((e.ctrlKey || e.metaKey) && z && !e.shiftKey) { e.preventDefault(); undo() }
      else if ((e.ctrlKey || e.metaKey) && ((z && e.shiftKey) || e.key === "y" || e.key === "Y")) { e.preventDefault(); redo() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  /* close the context menu on outside click / Escape */
  useEffect(() => {
    if (!menu) return
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null) }
    const onKey = (e) => { if (e.key === "Escape") setMenu(null) }
    window.addEventListener("mousedown", onDown)
    window.addEventListener("keydown", onKey)
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey) }
  }, [menu])

  const onNodesChange = useCallback((ch) => {
    // track drag state from the change stream; the final change of a drag carries dragging:false → autosave resumes and saves once
    const pos = ch.find(c => c.type === "position" && "dragging" in c)
    if (pos) dragging.current = !!pos.dragging
    setNodes(ns => applyNodeChanges(ch, ns))
  }, [])
  const onEdgesChange = useCallback((ch) => setEdges(es => applyEdgeChanges(ch, es)), [])
  const onConnect = useCallback((c) => setEdges(es => addEdge({ ...c, ...EDGE_OPTS }, es)), [])

  /* ---- actions ---- */
  const addNode = (kind, pos) => {
    dragging.current = false
    const r = wrapRef.current?.getBoundingClientRect()
    const position = pos || screenToFlowPosition({ x: (r?.left || 0) + (r?.width || 600) / 2, y: (r?.top || 0) + (r?.height || 400) / 2 })
    setNodes(ns => [...ns, { id: newId(), type: "dfd", position, data: { label: KIND_LABEL[kind], kind }, style: dfdStyle(kind) }])
  }
  const renameNode = async (id) => {
    const n = nodes.find(x => x.id === id)
    const label = await askText({ title: "Rename node", value: n?.data?.label || "", confirmText: "Rename" })
    if (label != null) setNodes(ns => ns.map(x => x.id === id ? { ...x, data: { ...x.data, label } } : x))
  }
  const duplicateNode = (id) => { dragging.current = false; setNodes(ns => {
    const n = ns.find(x => x.id === id); if (!n) return ns
    return [...ns.map(x => ({ ...x, selected: false })), { ...n, id: newId(), position: { x: n.position.x + 28, y: n.position.y + 28 }, selected: true }]
  }) }
  const setNodeKind = (id, kind) => setNodes(ns => ns.map(n => n.id === id ? { ...n, data: { ...n.data, kind }, style: dfdStyle(kind) } : n))
  const deleteNode = (id) => { dragging.current = false; setNodes(ns => ns.filter(n => n.id !== id)); setEdges(es => es.filter(e => e.source !== id && e.target !== id)) }

  const editEdgeLabel = async (id) => {
    const e = edges.find(x => x.id === id)
    const label = await askText({ title: "Connection label", value: e?.label || "", confirmText: "Save" })
    if (label != null) setEdges(es => es.map(x => x.id === id ? { ...x, label } : x))
  }
  const toggleEdgeAnimated = (id) => setEdges(es => es.map(x => x.id === id ? { ...x, animated: !x.animated } : x))
  const setEdgeType = (id, type) => setEdges(es => es.map(x => x.id === id ? { ...x, type } : x))
  const deleteEdge = (id) => { dragging.current = false; setEdges(es => es.filter(x => x.id !== id)) }

  const selectAll = () => { setNodes(ns => ns.map(n => ({ ...n, selected: true }))); setEdges(es => es.map(e => ({ ...e, selected: true }))) }
  const clearCanvas = async () => {
    if (await ask({ title: "Clear canvas", message: "Remove every node and connection from this diagram?", confirmText: "Clear", danger: true })) { dragging.current = false; setNodes([]); setEdges([]) }
  }

  /* ---- context menu ---- */
  const openMenu = useCallback((e, payload) => {
    e.preventDefault()
    // fixed-position menu in viewport coords, nudged in so it never spills off-screen
    const MENU_W = 210, MENU_H = 330
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth - MENU_W - 8))
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - MENU_H - 8))
    setMenu({ ...payload, x, y, flow: screenToFlowPosition({ x: e.clientX, y: e.clientY }) })
  }, [screenToFlowPosition])
  const run = (fn) => { setMenu(null); fn() }

  const node = menu?.kind === "node" ? nodes.find(n => n.id === menu.id) : null
  const edge = menu?.kind === "edge" ? edges.find(e => e.id === menu.id) : null

  // stable MiniMap props so it doesn't re-render on every parent render
  const miniMapColor = useCallback((n) => n.style?.background || "#94a3b8", [])
  const maskColor = useMemo(() => theme === "dark" ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.06)", [theme])

  return (
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <div className={styles.toolbar}>
        {editable && (
          <span className={styles.palette}>
            {KINDS.map(k => (
              <button key={k.kind} className={`${styles.tool} ${styles[k.kind]}`} title={k.hint} onClick={() => addNode(k.kind)}>
                <i className={styles.swatch} /> {k.label}
              </button>
            ))}
          </span>
        )}
        <span className={styles.legend}>
          {editable && <>
            <button className={styles.toolBtn} onClick={undo} disabled={!hist.canUndo} title="Undo (Ctrl+Z)"><Icon name="undo" size={15} /></button>
            <button className={styles.toolBtn} onClick={redo} disabled={!hist.canRedo} title="Redo (Ctrl+Shift+Z)"><Icon name="redo" size={15} /></button>
          </>}
          <button className={styles.toolBtn} onClick={() => fitView({ duration: 400, padding: 0.2 })} title="Fit to screen"><Icon name="expand" size={15} /></button>
          {editable && <>
            <button className={styles.toolBtn} onClick={selectAll} title="Select all"><Icon name="check" size={15} /></button>
            <button className={`${styles.toolBtn} ${styles.danger}`} onClick={clearCanvas} title="Clear canvas"><Icon name="trash" size={15} /></button>
          </>}
        </span>
        <span className={`muted ${styles.hint}`}>{editable ? "Right-click for actions • drag a dot to connect • double-click to rename • Ctrl+Z to undo" : "Read-only view — drag the canvas to pan, scroll to zoom"}</span>
      </div>

      <div className={styles.canvas} ref={wrapRef} onContextMenu={(e) => e.preventDefault()}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={editable ? onConnect : undefined}
          onNodeDoubleClick={editable ? (_, n) => renameNode(n.id) : undefined}
          onEdgeDoubleClick={editable ? (_, e) => editEdgeLabel(e.id) : undefined}
          onNodeDragStop={() => { dragging.current = false }}
          onPaneContextMenu={editable ? (e) => openMenu(e, { kind: "pane" }) : (e) => e.preventDefault()}
          onNodeContextMenu={editable ? (e, n) => openMenu(e, { kind: "node", id: n.id }) : (e) => e.preventDefault()}
          onEdgeContextMenu={editable ? (e, ed) => openMenu(e, { kind: "edge", id: ed.id }) : (e) => e.preventDefault()}
          onPaneClick={() => setMenu(null)}
          nodesDraggable={editable}
          nodesConnectable={editable}
          elementsSelectable={editable}
          connectionMode={ConnectionMode.Loose}
          connectionLineType={ConnectionLineType.SmoothStep}
          defaultEdgeOptions={EDGE_OPTS}
          colorMode={theme === "dark" ? "dark" : "light"}
          snapToGrid snapGrid={SNAP_GRID}
          zoomOnDoubleClick={false}
          deleteKeyCode={editable ? DELETE_KEYS : null}
          minZoom={0.3} maxZoom={2}
          proOptions={PRO_OPTIONS}
          fitView
        >
          <Background variant={BackgroundVariant.Dots} gap={18} size={1.4} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable nodeColor={miniMapColor} nodeStrokeWidth={2} maskColor={maskColor} />
        </ReactFlow>

        <AnimatePresence>
          {menu && (
            <motion.div ref={menuRef} className={styles.menu} style={{ left: menu.x, top: menu.y }}
              initial={{ opacity: 0, scale: 0.94, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.12 }}>

              {menu.kind === "pane" && <>
                <div className={styles.menuHead}>Add node</div>
                {KINDS.map(k => (
                  <button key={k.kind} className={styles.menuItem} onClick={() => run(() => addNode(k.kind, menu.flow))}>
                    <i className={`${styles.dot} ${styles[k.kind]}`} /> {k.label}
                  </button>
                ))}
                <div className={styles.menuDiv} />
                <button className={styles.menuItem} onClick={() => run(() => fitView({ duration: 400, padding: 0.2 }))}><Icon name="expand" size={14} /> Fit to screen</button>
                <button className={styles.menuItem} onClick={() => run(selectAll)}><Icon name="check" size={14} /> Select all</button>
                <div className={styles.menuDiv} />
                <button className={`${styles.menuItem} ${styles.danger}`} onClick={() => run(clearCanvas)}><Icon name="trash" size={14} /> Clear canvas</button>
              </>}

              {menu.kind === "node" && node && <>
                <div className={styles.menuHead}>{KIND_LABEL[node.data?.kind] || "Node"}</div>
                <button className={styles.menuItem} onClick={() => run(() => renameNode(node.id))}><Icon name="edit" size={14} /> Rename</button>
                <button className={styles.menuItem} onClick={() => run(() => duplicateNode(node.id))}><Icon name="copy" size={14} /> Duplicate</button>
                <div className={styles.menuDiv} />
                <div className={styles.menuHead}>Change type</div>
                <div className={styles.types}>
                  {KINDS.map(k => (
                    <button key={k.kind} className={`${styles.typeBtn} ${node.data?.kind === k.kind ? styles.on : ""}`}
                      title={k.label} onClick={() => run(() => setNodeKind(node.id, k.kind))}>
                      <i className={`${styles.dot} ${styles[k.kind]}`} />
                    </button>
                  ))}
                </div>
                <div className={styles.menuDiv} />
                <button className={`${styles.menuItem} ${styles.danger}`} onClick={() => run(() => deleteNode(node.id))}><Icon name="trash" size={14} /> Delete</button>
              </>}

              {menu.kind === "edge" && edge && <>
                <div className={styles.menuHead}>Connection</div>
                <button className={styles.menuItem} onClick={() => run(() => editEdgeLabel(edge.id))}><Icon name="edit" size={14} /> Edit label</button>
                <button className={styles.menuItem} onClick={() => run(() => toggleEdgeAnimated(edge.id))}><Icon name="flow" size={14} /> {edge.animated ? "Stop animation" : "Animate flow"}</button>
                <div className={styles.menuDiv} />
                <div className={styles.menuHead}>Line style</div>
                <div className={styles.types}>
                  {[["smoothstep", "Smooth"], ["step", "Step"], ["default", "Curved"], ["straight", "Straight"]].map(([ty, lbl]) => (
                    <button key={ty} className={`${styles.lineBtn} ${(edge.type || "smoothstep") === ty ? styles.on : ""}`} onClick={() => run(() => setEdgeType(edge.id, ty))}>{lbl}</button>
                  ))}
                </div>
                <div className={styles.menuDiv} />
                <button className={`${styles.menuItem} ${styles.danger}`} onClick={() => run(() => deleteEdge(edge.id))}><Icon name="trash" size={14} /> Delete</button>
              </>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function Diagram() {
  return (
    <ReactFlowProvider>
      <DiagramCanvas />
    </ReactFlowProvider>
  )
}
