"use client"

import { useEffect, useRef, useState } from "react"
import type { useCanvas } from "../hooks/useCanvas"

type Props = {
  canvas: ReturnType<typeof useCanvas>
}

export default function EditorCanvas({ canvas }: Props) {
  const { displayCanvasRef, attachPointerEvents, composite, size } = canvas

  // Viewport transform state (CSS-only to avoid changing canvas coords)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const panning = useRef(false)
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const spaceDown = useRef(false)
  const [spaceHeld, setSpaceHeld] = useState(false)

  useEffect(() => {
    const el = displayCanvasRef.current
    const detach = attachPointerEvents(el)
    composite()
    return () => detach()
  }, [attachPointerEvents, composite, displayCanvasRef])

  // Center the canvas/grid in the viewport on first render or when a new image size loads
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    setOffset((o) => {
      // Avoid overriding user panning/zooming; only auto-center if still at origin
      if (o.x !== 0 || o.y !== 0) return o
      const rect = container.getBoundingClientRect()
      const scaledW = size.width * scale
      const scaledH = size.height * scale
      const cx = Math.max(0, (rect.width - scaledW) / 2)
      const cy = Math.max(0, (rect.height - scaledH) / 2)
      return { x: cx, y: cy }
    })
  }, [size.width, size.height, scale])

  // Wheel zoom (Ctrl + wheel) around cursor
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const newScale = Math.max(0.25, Math.min(4, scale * factor))
      // Adjust offset so the world point under the cursor stays fixed
      const r = newScale / scale
      const nx = r * offset.x + (1 - r) * cx
      const ny = r * offset.y + (1 - r) * cy
      setScale(newScale)
      setOffset({ x: nx, y: ny })
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [scale, offset])

  // Global space key tracking
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown.current = true
        setSpaceHeld(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        spaceDown.current = false
        setSpaceHeld(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
    }
  }, [])

  // Space + drag to pan
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const toLocal = (evt: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      return { x: evt.clientX - rect.left, y: evt.clientY - rect.top }
    }
    const onDown = (e: PointerEvent) => {
      if (!spaceDown.current) return
      panning.current = true
      lastPos.current = toLocal(e)
    }
    const onMove = (e: PointerEvent) => {
      if (!panning.current || !lastPos.current) return
      const pos = toLocal(e)
      const dx = pos.x - lastPos.current.x
      const dy = pos.y - lastPos.current.y
      setOffset((o) => ({ x: o.x + dx, y: o.y + dy }))
      lastPos.current = pos
    }
    const onUp = () => {
      panning.current = false
      lastPos.current = null
    }
    el.addEventListener("pointerdown", onDown)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    return () => {
      el.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="relative bg-zinc-600 border rounded-md w-full h-full min-h-[400px] overflow-hidden"
      style={{ cursor: spaceHeld ? (panning.current ? "grabbing" : "grab") : "default" }}
    >
      {/* Transformed wrapper guarantees alignment between grid and canvas */}
      <div
        className="absolute top-0 left-0"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "top left",
          zIndex: 0,
        }}
      >
        {/* Transparency grid sized to the real canvas area */}
        <div
          className="transparency-grid"
          style={{ width: `${size.width}px`, height: `${size.height}px`, pointerEvents: "none" }}
        />
        <canvas
          ref={displayCanvasRef}
          className="border shadow-sm"
          style={{ pointerEvents: spaceHeld ? "none" : "auto", position: "absolute", top: 0, left: 0 }}
        />
      </div>
      {/* Overlay to hint shortcuts */}
      <div className="pointer-events-none absolute left-2 bottom-2 text-xs text-zinc-200">
        Ctrl+Wheel: Zoom · Space+Drag: Pan
      </div>
    </div>
  )
}

