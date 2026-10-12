"use client"

import { useCallback, useEffect, type DragEvent } from "react"
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesInitialized,
  useNodesState,
  useReactFlow,
  type Connection,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { ClipNodeView } from "./clip-node"
import { GROUP_META, initialEdges, initialNodes, type ClipNode } from "@/lib/clip-catalog"

const nodeTypes = { clip: ClipNodeView }

function Canvas() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ClipNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const { screenToFlowPosition, fitView } = useReactFlow()
  const nodesInitialized = useNodesInitialized()

  useEffect(() => {
    if (nodesInitialized) fitView({ padding: 0.08, maxZoom: 1 })
  }, [nodesInitialized, fitView])

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((current) =>
        addEdge({ ...connection, type: "smoothstep", style: { stroke: "#d6ff3a", strokeWidth: 1.5 } }, current),
      ),
    [setEdges],
  )

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault()
      const file = event.dataTransfer.files[0]
      if (!file || !file.type.startsWith("video/")) return
      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const newNode: ClipNode = {
        id: `custom-${Date.now()}`,
        type: "clip",
        position,
        data: {
          step: "+",
          group: "custom",
          title: file.name.replace(/\.[^.]+$/, ""),
          slotKey: "ej kopplad till fack",
          from: "VILA",
          to: "VILA",
          durationSec: "okänd",
          format: file.type.replace("video/", "").toUpperCase(),
          requirement: "optional",
          description: "Inlagt klipp. Dra en koppling till ett fack för att använda det i spelet.",
          videoUrl: URL.createObjectURL(file),
          variants: [{ id: "orig", name: "Original", trigger: "original", hasFile: true }],
        },
      }
      setNodes((current) => [...current, newNode])
    },
    [screenToFlowPosition, setNodes],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onDrop={onDrop}
      onDragOver={(event) => event.preventDefault()}
      colorMode="dark"
      minZoom={0.3}
      proOptions={{ hideAttribution: true }}
      className="!bg-sg-bg"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#33363b" />
      <Controls className="!border-sg-line !bg-sg-panel" showInteractive={false} />
      <MiniMap
        pannable
        zoomable
        className="!bg-sg-panel"
        maskColor="rgba(10,11,13,0.7)"
        nodeColor={(node) => GROUP_META[(node as ClipNode).data.group].color}
      />
    </ReactFlow>
  )
}

export function ClipCanvas() {
  return (
    <ReactFlowProvider>
      <Canvas />
    </ReactFlowProvider>
  )
}
