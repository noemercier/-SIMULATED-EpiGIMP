"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Layer } from "./useLayers"

export type BrushSettings = {
	size: number
	color: string
	hardness: number // 0..1 (simple alpha multiplier)
}

type UndoEntry =
  | { kind: "image"; data: ImageData }
  | { kind: "layer"; width: number; height: number; x: number; y: number; image: ImageData }

export function useCanvas(
	layers: Layer[],
	activeLayer: Layer | null,
	tool: "brush" | "eraser" | "move" | "select" = "brush",
) {
	const displayCanvasRef = useRef<HTMLCanvasElement | null>(null)
	const [brush, setBrush] = useState<BrushSettings>({ size: 12, color: "#000000", hardness: 1 })
	const [isDrawing, setIsDrawing] = useState(false)
	const lastPoint = useRef<{ x: number; y: number } | null>(null)
	const preStrokeImage = useRef<ImageData | null>(null)
	// Maintain a per-layer unified undo stack (strokes and transforms)
	const undoStacksRef = useRef<Map<string, UndoEntry[]>>(new Map())
	// Throttled tick used to refresh thumbnails in LayerPanel
	const [previewTick, setPreviewTick] = useState(0)
	const lastPreviewRef = useRef(0)
		const selection = useRef<{
			start: { x: number; y: number } | null
			rect: { x: number; y: number; w: number; h: number } | null
			active: boolean
		}>({ start: null, rect: null, active: false })

	const size = useMemo(() => {
		// Use the largest layer size present or default
		const w = Math.max(...layers.map((l) => l.width), 1)
		const h = Math.max(...layers.map((l) => l.height), 1)
		return { width: w || 1024, height: h || 768 }
	}, [layers])

	const composite = useCallback(() => {
		const canvas = displayCanvasRef.current
		if (!canvas) return
		canvas.width = size.width
		canvas.height = size.height
		const ctx = canvas.getContext("2d")
		if (!ctx) return
		ctx.clearRect(0, 0, canvas.width, canvas.height)
			for (const layer of layers) {
			if (!layer.visible) continue
			ctx.globalAlpha = layer.opacity
			ctx.globalCompositeOperation = layer.blendMode
				ctx.drawImage(layer.canvas, layer.x || 0, layer.y || 0)
		}
		ctx.globalAlpha = 1
		ctx.globalCompositeOperation = "source-over"

			// Selection overlay
			const rect = selection.current.rect
			if (rect) {
				ctx.save()
				ctx.strokeStyle = "#2563eb" // blue
				ctx.setLineDash([6, 4])
				ctx.lineWidth = 1
				ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
				ctx.restore()
			}

		// Tick for thumbnails (throttle ~200ms)
		const now = (typeof performance !== "undefined" ? performance.now() : Date.now()) as number
		if (now - lastPreviewRef.current > 200) {
			lastPreviewRef.current = now
			setPreviewTick((t) => t + 1)
		}
	}, [layers, size.width, size.height])

	useEffect(() => {
		composite()
	}, [composite])

		const drawLineOnActive = useCallback(
		(from: { x: number; y: number }, to: { x: number; y: number }) => {
			if (!activeLayer) return
			const ctx = activeLayer.ctx
			ctx.save()
				ctx.globalAlpha = brush.hardness
				if (tool === "eraser") {
					ctx.globalCompositeOperation = "destination-out"
					ctx.strokeStyle = "rgba(0,0,0,1)"
				} else {
					ctx.globalCompositeOperation = "source-over"
					ctx.strokeStyle = brush.color
				}
			ctx.lineJoin = "round"
			ctx.lineCap = "round"
			ctx.lineWidth = brush.size
			ctx.beginPath()
			ctx.moveTo(from.x, from.y)
			ctx.lineTo(to.x, to.y)
			ctx.stroke()
			ctx.restore()
		},
			[activeLayer, brush.color, brush.hardness, brush.size, tool],
	)

	const toCanvasCoords = useCallback(
		(evt: PointerEvent) => {
			const canvas = displayCanvasRef.current
			if (!canvas) return { x: 0, y: 0 }
			const rect = canvas.getBoundingClientRect()
			const x = ((evt.clientX - rect.left) / rect.width) * size.width
			const y = ((evt.clientY - rect.top) / rect.height) * size.height
			return { x, y }
		},
		[size.width, size.height],
	)

	const onPointerDown = useCallback(
			(evt: PointerEvent) => {
				if (!activeLayer) return
				const pos = toCanvasCoords(evt)
				lastPoint.current = pos
				// Select tool begins selection
				if (tool === "select") {
					selection.current.start = pos
					selection.current.rect = { x: pos.x, y: pos.y, w: 0, h: 0 }
					selection.current.active = true
					setIsDrawing(true)
					composite()
					return
				}
				// Move tool begins dragging but doesn't draw
				if (tool === "move") {
					setIsDrawing(true)
					return
				}
				setIsDrawing(true)
				// Snapshot for undo (multi-level): push pixel image before stroke
				try {
					const snapshot = activeLayer.ctx.getImageData(0, 0, activeLayer.width, activeLayer.height)
					const id = activeLayer.id
					const stack = undoStacksRef.current.get(id) ?? []
					stack.push({ kind: "image", data: snapshot })
					// Limit stack size to prevent unbounded memory (e.g., 30 steps)
					const MAX_STEPS = 30
					while (stack.length > MAX_STEPS) stack.shift()
					undoStacksRef.current.set(id, stack)
					// keep last snapshot for legacy single-step undo
					preStrokeImage.current = snapshot
				} catch {
					// ignore if getImageData fails
				}
			},
			[activeLayer, toCanvasCoords, tool],
	)

	const onPointerMove = useCallback(
			(evt: PointerEvent) => {
				if (!isDrawing || !lastPoint.current) return
				const pos = toCanvasCoords(evt)
				if (tool === "select") {
					const start = selection.current.start
					if (start) {
						const x = Math.min(start.x, pos.x)
						const y = Math.min(start.y, pos.y)
						const w = Math.abs(pos.x - start.x)
						const h = Math.abs(pos.y - start.y)
						selection.current.rect = { x, y, w, h }
						lastPoint.current = pos
						composite()
					}
					return
				}
				if (tool === "move" && activeLayer) {
					const dx = pos.x - lastPoint.current.x
					const dy = pos.y - lastPoint.current.y
					activeLayer.x = (activeLayer.x || 0) + dx
					activeLayer.y = (activeLayer.y || 0) + dy
					lastPoint.current = pos
					composite()
					return
				}
				drawLineOnActive(lastPoint.current, pos)
				lastPoint.current = pos
				composite()
			},
			[isDrawing, toCanvasCoords, drawLineOnActive, composite, tool, activeLayer],
	)

	const onPointerUp = useCallback(() => {
		setIsDrawing(false)
		lastPoint.current = null
			if (tool === "select") {
				selection.current.active = false
				composite()
			}
	}, [])

	const attachPointerEvents = useCallback((el: HTMLCanvasElement | null) => {
		if (!el) return () => {}
		const down = (e: PointerEvent) => onPointerDown(e)
		const move = (e: PointerEvent) => onPointerMove(e)
		const up = () => onPointerUp()
		el.addEventListener("pointerdown", down)
		window.addEventListener("pointermove", move)
		window.addEventListener("pointerup", up)
		return () => {
			el.removeEventListener("pointerdown", down)
			window.removeEventListener("pointermove", move)
			window.removeEventListener("pointerup", up)
		}
	}, [onPointerDown, onPointerMove, onPointerUp])

		const undoLastStroke = useCallback(() => {
			if (!activeLayer) return
			const id = activeLayer.id
			const stack = undoStacksRef.current.get(id) ?? []
			if (stack.length > 0) {
				const entry = stack.pop()!
				undoStacksRef.current.set(id, stack)
				if (entry.kind === "image") {
					// Pixel-only undo
					activeLayer.ctx.putImageData(entry.data, 0, 0)
					composite()
					return
				}
				// Full layer restore (size + pixels + position)
				const restored = document.createElement("canvas")
				restored.width = entry.width
				restored.height = entry.height
				const rctx = restored.getContext("2d")
				if (!rctx) return
				rctx.putImageData(entry.image, 0, 0)
				activeLayer.canvas = restored
				activeLayer.ctx = rctx
				activeLayer.width = entry.width
				activeLayer.height = entry.height
				activeLayer.x = entry.x
				activeLayer.y = entry.y
				composite()
				return
			}
			// Fallback to single-step snapshot if stack empty
			if (preStrokeImage.current) {
				activeLayer.ctx.putImageData(preStrokeImage.current, 0, 0)
				composite()
				preStrokeImage.current = null
			}
		}, [activeLayer, composite])

			const clearSelection = useCallback(() => {
				selection.current = { start: null, rect: null, active: false }
				composite()
			}, [composite])

			const getSelectionRect = useCallback(() => {
				return selection.current.rect
			}, [])

			const getSelectionCanvas = useCallback(() => {
				if (!activeLayer) return null
				const rect = selection.current.rect
				if (!rect || rect.w <= 0 || rect.h <= 0) return null
				const sx = rect.x - (activeLayer.x || 0)
				const sy = rect.y - (activeLayer.y || 0)
				// Clamp to layer bounds
				const clampedSx = Math.max(0, Math.min(activeLayer.width, sx))
				const clampedSy = Math.max(0, Math.min(activeLayer.height, sy))
				const clampedW = Math.max(0, Math.min(activeLayer.width - clampedSx, rect.w))
				const clampedH = Math.max(0, Math.min(activeLayer.height - clampedSy, rect.h))
				if (clampedW <= 0 || clampedH <= 0) return null
				const out = document.createElement("canvas")
				out.width = Math.floor(clampedW)
				out.height = Math.floor(clampedH)
				const ctx = out.getContext("2d")
				if (!ctx) return null
				ctx.drawImage(
					activeLayer.canvas,
					Math.floor(clampedSx),
					Math.floor(clampedSy),
					Math.floor(clampedW),
					Math.floor(clampedH),
					0,
					0,
					Math.floor(clampedW),
					Math.floor(clampedH),
				)
				return out
			}, [activeLayer])

			// Helpers to push a full layer snapshot before transforms
			const pushLayerSnapshot = useCallback(
				(layer: Layer) => {
					try {
						const img = layer.ctx.getImageData(0, 0, layer.width, layer.height)
						const entry: UndoEntry = {
							kind: "layer",
							width: layer.width,
							height: layer.height,
							x: layer.x || 0,
							y: layer.y || 0,
							image: img,
						}
						const stack = undoStacksRef.current.get(layer.id) ?? []
						stack.push(entry)
						const MAX_STEPS = 30
						while (stack.length > MAX_STEPS) stack.shift()
						undoStacksRef.current.set(layer.id, stack)
					} catch {
						// ignore if getImageData fails
					}
				},
				[],
			)

			// Transform helpers for the active layer
			const rotateActiveLayer90 = useCallback((dir: "cw" | "ccw" | "flip") => {
				if (!activeLayer) return
				pushLayerSnapshot(activeLayer)
				const src = activeLayer.canvas
				const w = activeLayer.width
				const h = activeLayer.height
				let outW = w
				let outH = h
				if (dir === "cw" || dir === "ccw") {
					outW = h
					outH = w
				}
				const out = document.createElement("canvas")
				out.width = outW
				out.height = outH
				const ctx = out.getContext("2d")
				if (!ctx) return
				ctx.save()
				if (dir === "cw") {
					ctx.translate(outW, 0)
					ctx.rotate(Math.PI / 2)
				} else if (dir === "ccw") {
					ctx.translate(0, outH)
					ctx.rotate(-Math.PI / 2)
				} else {
					// flip 180
					ctx.translate(outW, outH)
					ctx.rotate(Math.PI)
				}
				ctx.drawImage(src, 0, 0)
				ctx.restore()
				activeLayer.canvas = out
				activeLayer.ctx = ctx
				activeLayer.width = outW
				activeLayer.height = outH
				// Keep position roughly the same visually
				activeLayer.x = activeLayer.x || 0
				activeLayer.y = activeLayer.y || 0
				composite()
			}, [activeLayer, composite])

			const resizeActiveLayer = useCallback((newW: number, newH: number) => {
				if (!activeLayer) return
				pushLayerSnapshot(activeLayer)
				const out = document.createElement("canvas")
				out.width = Math.max(1, Math.floor(newW))
				out.height = Math.max(1, Math.floor(newH))
				const ctx = out.getContext("2d")
				if (!ctx) return
				ctx.drawImage(activeLayer.canvas, 0, 0, activeLayer.width, activeLayer.height, 0, 0, out.width, out.height)
				activeLayer.canvas = out
				activeLayer.ctx = ctx
				activeLayer.width = out.width
				activeLayer.height = out.height
				activeLayer.x = activeLayer.x || 0
				activeLayer.y = activeLayer.y || 0
				composite()
			}, [activeLayer, composite])

			const cropActiveLayerToSelection = useCallback(() => {
				if (!activeLayer) return
				const rect = selection.current.rect
				if (!rect || rect.w <= 0 || rect.h <= 0) return
				pushLayerSnapshot(activeLayer)
				const sx = Math.max(0, Math.floor(rect.x - (activeLayer.x || 0)))
				const sy = Math.max(0, Math.floor(rect.y - (activeLayer.y || 0)))
				const sw = Math.max(0, Math.min(activeLayer.width - sx, Math.floor(rect.w)))
				const sh = Math.max(0, Math.min(activeLayer.height - sy, Math.floor(rect.h)))
				if (sw <= 0 || sh <= 0) return
				const out = document.createElement("canvas")
				out.width = sw
				out.height = sh
				const ctx = out.getContext("2d")
				if (!ctx) return
				ctx.drawImage(activeLayer.canvas, sx, sy, sw, sh, 0, 0, sw, sh)
				activeLayer.canvas = out
				activeLayer.ctx = ctx
				activeLayer.width = sw
				activeLayer.height = sh
				activeLayer.x = Math.floor(rect.x)
				activeLayer.y = Math.floor(rect.y)
				// Clear selection so marching ants don't linger
				selection.current = { start: null, rect: null, active: false }
				composite()
			}, [activeLayer, composite])

	return {
		displayCanvasRef,
		size,
		brush,
		setBrush,
		composite,
		attachPointerEvents,
		undoLastStroke,
			clearSelection,
			getSelectionCanvas,
			getSelectionRect,
			rotateActiveLayer90,
			resizeActiveLayer,
			cropActiveLayerToSelection,
			previewTick,
	}
}

