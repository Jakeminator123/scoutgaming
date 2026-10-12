"use client"

import { memo, useState, type DragEvent } from "react"
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react"
import { Film, Upload, Zap, Bot, Circle } from "lucide-react"
import {
  EXTRA_HANDLES,
  GROUP_META,
  REQUIREMENT_META,
  TRIGGER_META,
  type ClipNode,
  type Trigger,
} from "@/lib/clip-catalog"
import { cn } from "@/lib/utils"

const TRIGGER_ICON: Record<Trigger, typeof Circle> = {
  original: Circle,
  auto: Zap,
  openclaw: Bot,
}

function ClipNodeComponent({ id, data, selected }: NodeProps<ClipNode>) {
  const { updateNodeData } = useReactFlow()
  const [variantId, setVariantId] = useState(data.variants[0]?.id)
  const [isDragOver, setIsDragOver] = useState(false)
  const meta = GROUP_META[data.group]
  const variant = data.variants.find((item) => item.id === variantId) ?? data.variants[0]
  const filled = data.variants.filter((item) => item.hasFile).length
  const missing = !variant?.hasFile && !data.videoUrl
  const TriggerIcon = variant ? TRIGGER_ICON[variant.trigger] : Circle

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
    const file = event.dataTransfer.files[0]
    if (!file || !file.type.startsWith("video/")) return
    updateNodeData(id, {
      videoUrl: URL.createObjectURL(file),
      variants: data.variants.map((item) =>
        item.id === variant?.id ? { ...item, hasFile: true } : item,
      ),
    })
  }

  return (
    <article
      onDragOver={(event) => {
        event.preventDefault()
        event.stopPropagation()
        setIsDragOver(true)
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "w-[280px] overflow-hidden rounded-lg border bg-sg-panel text-sg-text shadow-xl transition-colors",
        selected ? "border-sg-lime" : "border-sg-line",
        isDragOver && "border-sg-lime ring-2 ring-sg-lime/40",
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-2.5 !border-sg-bg !bg-sg-muted" />

      <div className="flex items-center justify-between gap-2 border-b border-sg-line px-3 py-2">
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider" style={{ color: meta.color }}>
          <span
            className="rounded px-1 py-px text-[10px] font-semibold text-sg-bg"
            style={{ backgroundColor: meta.color }}
            aria-label={`Steg ${data.step}`}
          >
            {data.step}
          </span>
          {meta.label}
        </span>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase",
            data.requirement === "required" && "border-sg-red/60 text-sg-red",
            data.requirement === "recommended" && "border-sg-amber/60 text-sg-amber",
            data.requirement === "optional" && "border-sg-line text-sg-muted",
          )}
        >
          {REQUIREMENT_META[data.requirement]}
        </span>
      </div>

      <div className="flex gap-3 p-3">
        <div className="relative h-[124px] w-[70px] shrink-0 overflow-hidden rounded border border-sg-line bg-sg-bg">
          {data.videoUrl ? (
            <video src={data.videoUrl} className="size-full object-cover" muted loop autoPlay playsInline />
          ) : data.thumbnail ? (
            <img src={data.thumbnail || "/placeholder.svg"} alt="" className={cn("size-full object-cover", missing && "opacity-40 grayscale")} />
          ) : (
            <div className="flex size-full items-center justify-center">
              <Film className="size-5 text-sg-muted" aria-hidden />
            </div>
          )}
          {missing && (
            <span className="absolute inset-x-0 bottom-0 bg-sg-bg/80 py-0.5 text-center font-mono text-[8px] uppercase text-sg-amber">
              saknas
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="text-sm font-semibold leading-tight text-balance">{data.title}</h3>
          <p className="truncate font-mono text-[10px] text-sg-muted" title={data.slotKey}>
            {data.slotKey}
          </p>
          <div className="flex items-center gap-1 font-mono text-[10px]">
            <span className="rounded bg-sg-bg px-1.5 py-0.5">{data.from}</span>
            <span className="text-sg-muted" aria-label="till">{"→"}</span>
            <span className="rounded bg-sg-bg px-1.5 py-0.5">{data.to}</span>
          </div>
          <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[10px]">
            <dt className="text-sg-muted">Längd</dt>
            <dd>{data.durationSec}</dd>
            <dt className="text-sg-muted">Format</dt>
            <dd className="truncate" title={data.format}>{data.format}</dd>
          </dl>
        </div>
      </div>

      <div className="border-t border-sg-line px-3 py-2.5">
        {data.variants.length > 1 ? (
          <label className="flex flex-col gap-1">
            <span className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-sg-muted">
              {data.variantLabel ?? "Variant"}
              <span>{`${filled}/${data.variants.length} klipp`}</span>
            </span>
            <select
              value={variantId}
              onChange={(event) => setVariantId(event.target.value)}
              className="nodrag w-full rounded border border-sg-line bg-sg-bg px-2 py-1.5 text-xs text-sg-text outline-none focus:border-sg-lime"
            >
              {data.variants.map((item) => (
                <option key={item.id} value={item.id}>
                  {`${item.hasFile ? "●" : "○"} ${item.name}${item.trigger === "original" ? "" : ` · ${TRIGGER_META[item.trigger]}`}`}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="font-mono text-[9px] uppercase tracking-wider text-sg-muted">Ingen variant · ett klipp</p>
        )}

        {variant && (variant.condition || variant.line) && (
          <div className="mt-2 flex flex-col gap-1 rounded bg-sg-bg px-2 py-1.5 text-[10px]">
            {variant.condition && (
              <span className="flex items-center gap-1.5 text-sg-muted">
                <TriggerIcon className="size-3 shrink-0 text-sg-lime" aria-hidden />
                <span className="truncate font-mono">{variant.condition}</span>
              </span>
            )}
            {variant.line && <span className="italic text-sg-text/80">{`"${variant.line}"`}</span>}
          </div>
        )}

        {missing && (
          <p className="mt-2 flex items-center gap-1.5 rounded border border-dashed border-sg-line px-2 py-1.5 text-[10px] text-sg-muted">
            <Upload className="size-3 shrink-0" aria-hidden />
            Dra in en video hit
          </p>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!size-2.5 !border-sg-bg !bg-sg-lime" />
      {EXTRA_HANDLES[id]?.map((handle) => (
        <Handle
          key={handle}
          id={handle}
          type={handle.endsWith("-out") ? "source" : "target"}
          position={handle === "talk-out" ? Position.Bottom : Position.Top}
          isConnectable={false}
          className={cn(
            "!size-2 !border-sg-bg",
            handle.startsWith("talk") ? "!bg-[#9d8cff]" : "!bg-sg-lime",
          )}
        />
      ))}
    </article>
  )
}

export const ClipNodeView = memo(ClipNodeComponent)
