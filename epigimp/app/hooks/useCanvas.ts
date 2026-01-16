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
	tool: "brush" | "eraser" | "move" | "select" | "lasso" | "transform" | "eyedropper" = "brush",
) {
	const displayCanvasRef = useRef<HTMLCanvasElement | null>(null)
	const [brush, setBrush] = useState<BrushSettings>({ size: 12, color: "#000000", hardness: 1 })
	const [isDrawing, setIsDrawing] = useState(false)
	const lastPoint = useRef<{ x: number; y: number } | null>(null)
	const preStrokeImage = useRef<ImageData | null>(null)
		// Maintain per-layer undo/redo stacks (strokes, transforms, filters)
		const undoStacksRef = useRef<Map<string, UndoEntry[]>>(new Map())
		const redoStacksRef = useRef<Map<string, UndoEntry[]>>(new Map())
		type HistoryEntry = { id: string; label: string; time: number }
		const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([])
		const addHistory = useCallback((label: string) => {
			const entry: HistoryEntry = { id: crypto.randomUUID(), label, time: Date.now() }
			setHistoryEntries((prev) => {
				const MAX = 50
				const next = [...prev, entry]
				while (next.length > MAX) next.shift()
				return next
			})
		}, [])
	// Throttled tick used to refresh thumbnails in LayerPanel
	const [previewTick, setPreviewTick] = useState(0)
	const lastPreviewRef = useRef(0)
		// Transform (interactive resize) state
		type TransformState = {
			active: boolean
			mode: "idle" | "resize"
			corner: "nw" | "ne" | "se" | "sw" | "n" | "e" | "s" | "w"
			startRect: { x: number; y: number; w: number; h: number }
			previewRect?: { x: number; y: number; w: number; h: number }
		}
		const transform = useRef<TransformState>({ active: false, mode: "idle", corner: "nw", startRect: { x: 0, y: 0, w: 0, h: 0 }, previewRect: undefined })
		type SelectionState = {
			mode: "none" | "rect" | "lasso"
			start: { x: number; y: number } | null
			rect: { x: number; y: number; w: number; h: number } | null
			path: { x: number; y: number }[]
			active: boolean
		}
		const selection = useRef<SelectionState>({ mode: "none", start: null, rect: null, path: [], active: false })

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
					// Draw active layer with preview scaling when transforming
					if (tool === "transform" && activeLayer && layer.id === activeLayer.id && transform.current.active && transform.current.previewRect) {
						const r = transform.current.previewRect
						ctx.drawImage(layer.canvas, r.x, r.y, r.w, r.h)
					} else {
						ctx.drawImage(layer.canvas, layer.x || 0, layer.y || 0)
					}
		}
		ctx.globalAlpha = 1
		ctx.globalCompositeOperation = "source-over"

			// Selection overlay (more visible: double-stroke for contrast)
			if (selection.current.mode !== "none") {
				ctx.save()
				// First stroke: white, thicker
				ctx.setLineDash([6, 4])
				ctx.lineWidth = 2
				ctx.strokeStyle = "#ffffff"
				if (selection.current.mode === "rect" && selection.current.rect) {
					const r = selection.current.rect
					ctx.strokeRect(r.x, r.y, r.w, r.h)
				} else if (selection.current.mode === "lasso" && selection.current.path.length > 1) {
					const pts = selection.current.path
					ctx.beginPath()
					ctx.moveTo(pts[0].x, pts[0].y)
					for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
					ctx.closePath()
					ctx.stroke()
				}
				// Second stroke: blue, thinner on top
				ctx.lineWidth = 1
				ctx.strokeStyle = "#2563eb"
				if (selection.current.mode === "rect" && selection.current.rect) {
					const r = selection.current.rect
					ctx.strokeRect(r.x, r.y, r.w, r.h)
				} else if (selection.current.mode === "lasso" && selection.current.path.length > 1) {
					const pts = selection.current.path
					ctx.beginPath()
					ctx.moveTo(pts[0].x, pts[0].y)
					for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
					ctx.closePath()
					ctx.stroke()
				}
				ctx.restore()
			}

			// Transform overlay: bounding box + corner handles
			if (tool === "transform" && activeLayer) {
				const rect = transform.current.previewRect ?? { x: activeLayer.x || 0, y: activeLayer.y || 0, w: activeLayer.width, h: activeLayer.height }
				ctx.save()
				ctx.strokeStyle = "#10b981"
				ctx.setLineDash([6, 4])
				ctx.lineWidth = 1
				ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
				const hs = 10
				const drawHandle = (hx: number, hy: number) => {
					ctx.fillStyle = "#10b981"
					ctx.strokeStyle = "#0f766e"
					ctx.setLineDash([])
					ctx.lineWidth = 1
					ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs)
					ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs)
				}
				drawHandle(rect.x, rect.y)
				drawHandle(rect.x + rect.w, rect.y)
				drawHandle(rect.x + rect.w, rect.y + rect.h)
				drawHandle(rect.x, rect.y + rect.h)
				// Edge handles (midpoints)
				drawHandle(rect.x + rect.w / 2, rect.y)
				drawHandle(rect.x + rect.w, rect.y + rect.h / 2)
				drawHandle(rect.x + rect.w / 2, rect.y + rect.h)
				drawHandle(rect.x, rect.y + rect.h / 2)
				ctx.restore()
			}

		// Tick for thumbnails (throttle ~200ms)
		const now = (typeof performance !== "undefined" ? performance.now() : Date.now()) as number
		if (now - lastPreviewRef.current > 200) {
			lastPreviewRef.current = now
			setPreviewTick((t) => t + 1)
		}
	}, [layers, size.width, size.height, tool, activeLayer])

	useEffect(() => {
		composite()
	}, [composite])

	// Commit transform when switching away if a preview exists; otherwise clear overlay
	useEffect(() => {
		if (tool !== "transform") {
			if (transform.current.active && transform.current.previewRect && activeLayer) {
				// Commit interactive resize
				pushLayerSnapshot(activeLayer)
				const r = transform.current.previewRect
				const out = document.createElement("canvas")
				out.width = r.w
				out.height = r.h
				const ctx = out.getContext("2d")
				if (ctx) {
					ctx.drawImage(activeLayer.canvas, 0, 0, activeLayer.width, activeLayer.height, 0, 0, r.w, r.h)
					activeLayer.canvas = out
					activeLayer.ctx = ctx
					activeLayer.width = r.w
					activeLayer.height = r.h
					activeLayer.x = r.x
					activeLayer.y = r.y
					// Clear redo on new action
					redoStacksRef.current.set(activeLayer.id, [])
					addHistory("Resize (interactive)")
				}
			}
			transform.current.active = false
			transform.current.previewRect = undefined
			composite()
		}
	}, [tool, composite, activeLayer])

		const drawLineOnActive = useCallback(
			(from: { x: number; y: number }, to: { x: number; y: number }) => {
				if (!activeLayer) return
				// Convert global canvas coords to layer-local coords
				const ox = activeLayer.x || 0
				const oy = activeLayer.y || 0
				const lFrom = { x: from.x - ox, y: from.y - oy }
				const lTo = { x: to.x - ox, y: to.y - oy }
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
				ctx.moveTo(lFrom.x, lFrom.y)
				ctx.lineTo(lTo.x, lTo.y)
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
					selection.current.path = []
					selection.current.mode = "rect"
					selection.current.active = true
					setIsDrawing(true)
					composite()
					return
				}
				// Transform tool begins when grabbing a corner handle
				if (tool === "transform") {
					const rect = { x: activeLayer.x || 0, y: activeLayer.y || 0, w: activeLayer.width, h: activeLayer.height }
					const hs = 10
					const corners: ({ name: "nw" | "ne" | "se" | "sw"; x: number; y: number })[] = [
						{ name: "nw", x: rect.x, y: rect.y },
						{ name: "ne", x: rect.x + rect.w, y: rect.y },
						{ name: "se", x: rect.x + rect.w, y: rect.y + rect.h },
						{ name: "sw", x: rect.x, y: rect.y + rect.h },
					]
					const edges: ({ name: "n" | "e" | "s" | "w"; x: number; y: number })[] = [
						{ name: "n", x: rect.x + rect.w / 2, y: rect.y },
						{ name: "e", x: rect.x + rect.w, y: rect.y + rect.h / 2 },
						{ name: "s", x: rect.x + rect.w / 2, y: rect.y + rect.h },
						{ name: "w", x: rect.x, y: rect.y + rect.h / 2 },
					]
					const hitCorner = corners.find(c => Math.abs(pos.x - c.x) <= hs && Math.abs(pos.y - c.y) <= hs)
					const hitEdge = edges.find(c => Math.abs(pos.x - c.x) <= hs && Math.abs(pos.y - c.y) <= hs)
					const hit = hitCorner ?? hitEdge
					if (hit) {
						transform.current = { active: true, mode: "resize", corner: hit.name, startRect: rect, previewRect: rect }
						setIsDrawing(true)
						composite()
						return
					}
				}
				if (tool === "lasso") {
					selection.current.mode = "lasso"
					selection.current.path = [pos]
					selection.current.start = null
					selection.current.rect = null
					selection.current.active = true
					setIsDrawing(true)
					composite()
					return
				}
				// Eyedropper: pick color from display canvas
				if (tool === "eyedropper") {
					const canvas = displayCanvasRef.current
					if (!canvas) return
					const ctx = canvas.getContext("2d")
					if (!ctx) return
					const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(pos.x)))
					const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(pos.y)))
					try {
						const data = ctx.getImageData(x, y, 1, 1).data
						const r = data[0]
						const g = data[1]
						const b = data[2]
						const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`
						setBrush((b) => ({ ...b, color: hex }))
						addHistory("Pick color")
					} catch {}
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
				if (tool === "transform" && transform.current.active && activeLayer) {
					const start = transform.current.startRect
					const corner = transform.current.corner as "nw" | "ne" | "se" | "sw" | "n" | "e" | "s" | "w"
					let x = start.x
					let y = start.y
					let w = start.w
					let h = start.h
					if (corner === "nw") {
						x = pos.x
						y = pos.y
						w = start.x + start.w - pos.x
						h = start.y + start.h - pos.y
					} else if (corner === "ne") {
						y = pos.y
						w = pos.x - start.x
						h = start.y + start.h - pos.y
					} else if (corner === "se") {
						w = pos.x - start.x
						h = pos.y - start.y
					} else if (corner === "sw") {
						x = pos.x
						w = start.x + start.w - pos.x
						h = pos.y - start.y
					} else if (corner === "n") {
						y = pos.y
						h = start.y + start.h - pos.y
					} else if (corner === "e") {
						w = pos.x - start.x
					} else if (corner === "s") {
						h = pos.y - start.y
					} else if (corner === "w") {
						x = pos.x
						w = start.x + start.w - pos.x
					}
					// Normalize negative sizes when dragging past the opposite edge
					if (w < 1) {
						x = x + w
						w = -w
					}
					if (h < 1) {
						y = y + h
						h = -h
					}
					// Constrain aspect ratio if Shift held
					if (evt.shiftKey) {
						const ar = start.w / start.h || 1
						if (Math.abs(w / h - ar) > 1e-3) {
							if (Math.abs(w) > Math.abs(h)) h = w / ar
							else w = h * ar
							if (corner === "nw") { x = start.x + start.w - w; y = start.y + start.h - h }
							if (corner === "ne") { y = start.y + start.h - h }
							if (corner === "sw") { x = start.x + start.w - w }
						}
					}
					w = Math.max(1, Math.floor(w))
					h = Math.max(1, Math.floor(h))
					transform.current.previewRect = { x: Math.floor(x), y: Math.floor(y), w, h }
					composite()
					return
				}
				if (tool === "lasso" && selection.current.active) {
					selection.current.path.push(pos)
					lastPoint.current = pos
					composite()
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
			if (tool === "select" || tool === "lasso") {
				selection.current.active = false
				composite()
			}
				if (tool === "transform" && transform.current.active && activeLayer && transform.current.previewRect) {
					// Commit interactive resize
					pushLayerSnapshot(activeLayer)
					const r = transform.current.previewRect
					const out = document.createElement("canvas")
					out.width = r.w
					out.height = r.h
					const ctx = out.getContext("2d")
					if (ctx) {
						ctx.drawImage(activeLayer.canvas, 0, 0, activeLayer.width, activeLayer.height, 0, 0, r.w, r.h)
						activeLayer.canvas = out
						activeLayer.ctx = ctx
						activeLayer.width = r.w
						activeLayer.height = r.h
						activeLayer.x = r.x
						activeLayer.y = r.y
						// Clear redo on new action
						redoStacksRef.current.set(activeLayer.id, [])
						addHistory("Resize (interactive)")
					}
					transform.current = { active: false, mode: "idle", corner: "nw", startRect: { x: 0, y: 0, w: 0, h: 0 }, previewRect: undefined }
					composite()
				}
				if (tool === "move" && activeLayer) {
					addHistory("Move layer")
				}
				if ((tool === "brush" || tool === "eraser") && activeLayer) {
					// Clear redo on new action
					redoStacksRef.current.set(activeLayer.id, [])
					addHistory(tool === "brush" ? "Brush stroke" : "Eraser stroke")
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
						// Capture current state for redo
						try {
							if (entry.kind === "image") {
								const current = activeLayer.ctx.getImageData(0, 0, activeLayer.width, activeLayer.height)
								const rstack = redoStacksRef.current.get(id) ?? []
								rstack.push({ kind: "image", data: current })
								const MAX_STEPS = 30
								while (rstack.length > MAX_STEPS) rstack.shift()
								redoStacksRef.current.set(id, rstack)
							} else {
								const img = activeLayer.ctx.getImageData(0, 0, activeLayer.width, activeLayer.height)
								const rstack = redoStacksRef.current.get(id) ?? []
								rstack.push({ kind: "layer", width: activeLayer.width, height: activeLayer.height, x: activeLayer.x || 0, y: activeLayer.y || 0, image: img })
								const MAX_STEPS = 30
								while (rstack.length > MAX_STEPS) rstack.shift()
								redoStacksRef.current.set(id, rstack)
							}
						} catch {}
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

			const redoLastAction = useCallback(() => {
				if (!activeLayer) return
				const id = activeLayer.id
				const rstack = redoStacksRef.current.get(id) ?? []
				if (rstack.length > 0) {
					const entry = rstack.pop()!
					redoStacksRef.current.set(id, rstack)
					// Capture current for undo before applying redo
					try {
						if (entry.kind === "image") {
							const current = activeLayer.ctx.getImageData(0, 0, activeLayer.width, activeLayer.height)
							const stack = undoStacksRef.current.get(id) ?? []
							stack.push({ kind: "image", data: current })
							const MAX_STEPS = 30
							while (stack.length > MAX_STEPS) stack.shift()
							undoStacksRef.current.set(id, stack)
						} else {
							const img = activeLayer.ctx.getImageData(0, 0, activeLayer.width, activeLayer.height)
							const stack = undoStacksRef.current.get(id) ?? []
							stack.push({ kind: "layer", width: activeLayer.width, height: activeLayer.height, x: activeLayer.x || 0, y: activeLayer.y || 0, image: img })
							const MAX_STEPS = 30
							while (stack.length > MAX_STEPS) stack.shift()
							undoStacksRef.current.set(id, stack)
						}
					} catch {}
					if (entry.kind === "image") {
						activeLayer.ctx.putImageData(entry.data, 0, 0)
					} else {
						const out = document.createElement("canvas")
						out.width = entry.width
						out.height = entry.height
						const ctx = out.getContext("2d")
						if (!ctx) return
						ctx.putImageData(entry.image, 0, 0)
						activeLayer.canvas = out
						activeLayer.ctx = ctx
						activeLayer.width = entry.width
						activeLayer.height = entry.height
						activeLayer.x = entry.x
						activeLayer.y = entry.y
					}
					composite()
				}
			}, [activeLayer, composite])

			const clearSelection = useCallback(() => {
				selection.current = { mode: "none", start: null, rect: null, path: [], active: false }
				composite()
			}, [composite])

			const getSelectionRect = useCallback(() => {
				if (selection.current.mode === "rect") return selection.current.rect
				if (selection.current.mode === "lasso" && selection.current.path.length > 0) {
					const pts = selection.current.path
					let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y
					for (const p of pts) {
						if (p.x < minX) minX = p.x
						if (p.y < minY) minY = p.y
						if (p.x > maxX) maxX = p.x
						if (p.y > maxY) maxY = p.y
					}
					return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
				}
				return null
			}, [])

			// Point in polygon helper (ray casting)
			const pointInPolygon = (poly: { x: number; y: number }[], x: number, y: number) => {
				let inside = false
				for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
					const xi = poly[i].x, yi = poly[i].y
					const xj = poly[j].x, yj = poly[j].y
					const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.00001) + xi
					if (intersect) inside = !inside
				}
				return inside
			}

			const getSelectionCanvas = useCallback(() => {
				if (!activeLayer) return null
				if (selection.current.mode === "rect") {
					const rect = selection.current.rect
					if (!rect || rect.w <= 0 || rect.h <= 0) return null
					const sx = rect.x - (activeLayer.x || 0)
					const sy = rect.y - (activeLayer.y || 0)
					const clampedSx = Math.max(0, Math.min(activeLayer.width, Math.floor(sx)))
					const clampedSy = Math.max(0, Math.min(activeLayer.height, Math.floor(sy)))
					const clampedW = Math.max(0, Math.min(activeLayer.width - clampedSx, Math.floor(rect.w)))
					const clampedH = Math.max(0, Math.min(activeLayer.height - clampedSy, Math.floor(rect.h)))
					if (clampedW <= 0 || clampedH <= 0) return null
					const out = document.createElement("canvas")
					out.width = clampedW
					out.height = clampedH
					const ctx = out.getContext("2d")
					if (!ctx) return null
					ctx.drawImage(activeLayer.canvas, clampedSx, clampedSy, clampedW, clampedH, 0, 0, clampedW, clampedH)
					return out
				}
				if (selection.current.mode === "lasso" && selection.current.path.length > 2) {
					const pts = selection.current.path
					// Bounding box in global coords
					let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y
					for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y }
					// Convert to layer local and clamp
					const sx = Math.max(0, Math.floor(minX - (activeLayer.x || 0)))
					const sy = Math.max(0, Math.floor(minY - (activeLayer.y || 0)))
					const sw = Math.max(0, Math.min(activeLayer.width - sx, Math.floor(maxX - minX)))
					const sh = Math.max(0, Math.min(activeLayer.height - sy, Math.floor(maxY - minY)))
					if (sw <= 0 || sh <= 0) return null
					const out = document.createElement("canvas")
					out.width = sw
					out.height = sh
					const ctx = out.getContext("2d")
					if (!ctx) return null
					// Clip to polygon relative to bbox
					ctx.save()
					ctx.beginPath()
					ctx.moveTo(pts[0].x - minX, pts[0].y - minY)
					for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - minX, pts[i].y - minY)
					ctx.closePath()
					ctx.clip()
					// Draw cropped region
					ctx.drawImage(activeLayer.canvas, sx, sy, sw, sh, 0, 0, sw, sh)
					ctx.restore()
					return out
				}
				return null
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
				addHistory(dir === "cw" ? "Rotate 90° CW" : dir === "ccw" ? "Rotate 90° CCW" : "Rotate 180°")
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
				addHistory(`Resize`)
				composite()
			}, [activeLayer, composite])

			const cropActiveLayerToSelection = useCallback(() => {
				if (!activeLayer) return
				if (selection.current.mode === "rect") {
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
					selection.current = { mode: "none", start: null, rect: null, path: [], active: false }
					addHistory("Crop to selection")
					composite()
					return
				}
				if (selection.current.mode === "lasso" && selection.current.path.length > 2) {
					const pts = selection.current.path
					let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y
					for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y }
					pushLayerSnapshot(activeLayer)
					const sx = Math.max(0, Math.floor(minX - (activeLayer.x || 0)))
					const sy = Math.max(0, Math.floor(minY - (activeLayer.y || 0)))
					const sw = Math.max(0, Math.min(activeLayer.width - sx, Math.floor(maxX - minX)))
					const sh = Math.max(0, Math.min(activeLayer.height - sy, Math.floor(maxY - minY)))
					if (sw <= 0 || sh <= 0) return
					const out = document.createElement("canvas")
					out.width = sw
					out.height = sh
					const ctx = out.getContext("2d")
					if (!ctx) return
					// Clip the draw to polygon
					ctx.save()
					ctx.beginPath()
					ctx.moveTo(pts[0].x - minX, pts[0].y - minY)
					for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x - minX, pts[i].y - minY)
					ctx.closePath()
					ctx.clip()
					ctx.drawImage(activeLayer.canvas, sx, sy, sw, sh, 0, 0, sw, sh)
					ctx.restore()
					activeLayer.canvas = out
					activeLayer.ctx = ctx
					activeLayer.width = sw
					activeLayer.height = sh
					activeLayer.x = Math.floor(minX)
					activeLayer.y = Math.floor(minY)
					selection.current = { mode: "none", start: null, rect: null, path: [], active: false }
					addHistory("Crop to lasso")
					composite()
				}
			}, [activeLayer, composite])

			// Filters: brightness/contrast applied to selection (if any) or entire active layer
			const applyBrightnessContrast = useCallback((brightness: number, contrast: number) => {
				// brightness in [-100,100], contrast in [-100,100]
				if (!activeLayer) return
				pushLayerSnapshot(activeLayer)
				const layer = activeLayer
				let sx = 0, sy = 0, sw = layer.width, sh = layer.height
				let poly: { x: number; y: number }[] | null = null
				if (selection.current.mode === "rect" && selection.current.rect) {
					const rect = selection.current.rect
					sx = Math.max(0, Math.floor(rect.x - (layer.x || 0)))
					sy = Math.max(0, Math.floor(rect.y - (layer.y || 0)))
					sw = Math.max(0, Math.min(layer.width - sx, Math.floor(rect.w)))
					sh = Math.max(0, Math.min(layer.height - sy, Math.floor(rect.h)))
					if (sw <= 0 || sh <= 0) return
				} else if (selection.current.mode === "lasso" && selection.current.path.length > 2) {
					const pts = selection.current.path
					let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y
					for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y }
					sx = Math.max(0, Math.floor(minX - (layer.x || 0)))
					sy = Math.max(0, Math.floor(minY - (layer.y || 0)))
					sw = Math.max(0, Math.min(layer.width - sx, Math.floor(maxX - minX)))
					sh = Math.max(0, Math.min(layer.height - sy, Math.floor(maxY - minY)))
					if (sw <= 0 || sh <= 0) return
					// polygon points relative to bbox
					poly = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }))
				}
				try {
					const img = layer.ctx.getImageData(sx, sy, sw, sh)
					const data = img.data
					const orig = new Uint8ClampedArray(data)
					// Convert brightness/contrast into scale/offset
					const b = Math.max(-100, Math.min(100, brightness))
					const c = Math.max(-100, Math.min(100, contrast))
					const offset = (255 * b) / 100
					const factor = (259 * (c + 255)) / (255 * (259 - c)) // standard contrast formula
					for (let y = 0; y < sh; y++) {
						for (let x = 0; x < sw; x++) {
							const idx = (y * sw + x) * 4
							const inside = !poly || pointInPolygon(poly, x + 0.5, y + 0.5)
							if (!inside) {
								data[idx] = orig[idx]
								data[idx + 1] = orig[idx + 1]
								data[idx + 2] = orig[idx + 2]
								continue
							}
							for (let ch = 0; ch < 3; ch++) {
								const v = data[idx + ch]
								let nv = factor * (v - 128) + 128 + offset
								data[idx + ch] = nv < 0 ? 0 : nv > 255 ? 255 : nv
							}
						}
					}
					layer.ctx.putImageData(img, sx, sy)
					composite()
				} catch {
					/* ignore */
				}
				addHistory("Brightness/Contrast")
			}, [activeLayer, composite, pushLayerSnapshot])

			// Filters: grayscale (desaturate)
			const applyGrayscale = useCallback(() => {
				if (!activeLayer) return
				pushLayerSnapshot(activeLayer)
				const layer = activeLayer
				let sx = 0, sy = 0, sw = layer.width, sh = layer.height
				let poly: { x: number; y: number }[] | null = null
				if (selection.current.mode === "rect" && selection.current.rect) {
					const rect = selection.current.rect
					sx = Math.max(0, Math.floor(rect.x - (layer.x || 0)))
					sy = Math.max(0, Math.floor(rect.y - (layer.y || 0)))
					sw = Math.max(0, Math.min(layer.width - sx, Math.floor(rect.w)))
					sh = Math.max(0, Math.min(layer.height - sy, Math.floor(rect.h)))
					if (sw <= 0 || sh <= 0) return
				} else if (selection.current.mode === "lasso" && selection.current.path.length > 2) {
					const pts = selection.current.path
					let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y
					for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y }
					sx = Math.max(0, Math.floor(minX - (layer.x || 0)))
					sy = Math.max(0, Math.floor(minY - (layer.y || 0)))
					sw = Math.max(0, Math.min(layer.width - sx, Math.floor(maxX - minX)))
					sh = Math.max(0, Math.min(layer.height - sy, Math.floor(maxY - minY)))
					if (sw <= 0 || sh <= 0) return
					poly = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }))
				}
				try {
					const img = layer.ctx.getImageData(sx, sy, sw, sh)
					const data = img.data
					const orig = new Uint8ClampedArray(data)
					for (let y = 0; y < sh; y++) {
						for (let x = 0; x < sw; x++) {
							const idx = (y * sw + x) * 4
							const inside = !poly || pointInPolygon(poly, x + 0.5, y + 0.5)
							if (!inside) {
								data[idx] = orig[idx]
								data[idx + 1] = orig[idx + 1]
								data[idx + 2] = orig[idx + 2]
								continue
							}
							const r = data[idx]
							const g = data[idx + 1]
							const b = data[idx + 2]
							const yy = 0.2126 * r + 0.7152 * g + 0.0722 * b
							data[idx] = data[idx + 1] = data[idx + 2] = yy
						}
					}
					layer.ctx.putImageData(img, sx, sy)
					composite()
				} catch {}
				addHistory("Grayscale")
			}, [activeLayer, composite, pushLayerSnapshot])

			// Filters: sepia with amount [0..100]
			const applySepia = useCallback((amount: number = 100) => {
				if (!activeLayer) return
				pushLayerSnapshot(activeLayer)
				const layer = activeLayer
				let sx = 0, sy = 0, sw = layer.width, sh = layer.height
				let poly: { x: number; y: number }[] | null = null
				if (selection.current.mode === "rect" && selection.current.rect) {
					const rect = selection.current.rect
					sx = Math.max(0, Math.floor(rect.x - (layer.x || 0)))
					sy = Math.max(0, Math.floor(rect.y - (layer.y || 0)))
					sw = Math.max(0, Math.min(layer.width - sx, Math.floor(rect.w)))
					sh = Math.max(0, Math.min(layer.height - sy, Math.floor(rect.h)))
					if (sw <= 0 || sh <= 0) return
				} else if (selection.current.mode === "lasso" && selection.current.path.length > 2) {
					const pts = selection.current.path
					let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y
					for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y }
					sx = Math.max(0, Math.floor(minX - (layer.x || 0)))
					sy = Math.max(0, Math.floor(minY - (layer.y || 0)))
					sw = Math.max(0, Math.min(layer.width - sx, Math.floor(maxX - minX)))
					sh = Math.max(0, Math.min(layer.height - sy, Math.floor(maxY - minY)))
					if (sw <= 0 || sh <= 0) return
					poly = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }))
				}
				try {
					const img = layer.ctx.getImageData(sx, sy, sw, sh)
					const data = img.data
					const orig = new Uint8ClampedArray(data)
					const t = Math.max(0, Math.min(100, Math.floor(amount))) / 100
					for (let y = 0; y < sh; y++) {
						for (let x = 0; x < sw; x++) {
							const idx = (y * sw + x) * 4
							const inside = !poly || pointInPolygon(poly, x + 0.5, y + 0.5)
							if (!inside) {
								data[idx] = orig[idx]
								data[idx + 1] = orig[idx + 1]
								data[idx + 2] = orig[idx + 2]
								continue
							}
							const r = orig[idx]
							const g = orig[idx + 1]
							const b = orig[idx + 2]
							const sr = 0.393 * r + 0.769 * g + 0.189 * b
							const sg = 0.349 * r + 0.686 * g + 0.168 * b
							const sb = 0.272 * r + 0.534 * g + 0.131 * b
							data[idx] = r + (sr - r) * t
							data[idx + 1] = g + (sg - g) * t
							data[idx + 2] = b + (sb - b) * t
						}
					}
					layer.ctx.putImageData(img, sx, sy)
					composite()
				} catch {}
				addHistory("Sepia")
			}, [activeLayer, composite, pushLayerSnapshot])

			// Filters: pixelate with block size
			const applyPixelate = useCallback((blockSize: number = 8) => {
				if (!activeLayer) return
				const bs = Math.max(2, Math.floor(blockSize))
				pushLayerSnapshot(activeLayer)
				const layer = activeLayer
				let sx = 0, sy = 0, sw = layer.width, sh = layer.height
				let pts: { x: number; y: number }[] | null = null
				if (selection.current.mode === "rect" && selection.current.rect) {
					const rect = selection.current.rect
					sx = Math.max(0, Math.floor(rect.x - (layer.x || 0)))
					sy = Math.max(0, Math.floor(rect.y - (layer.y || 0)))
					sw = Math.max(1, Math.min(layer.width - sx, Math.floor(rect.w)))
					sh = Math.max(1, Math.min(layer.height - sy, Math.floor(rect.h)))
					if (sw <= 0 || sh <= 0) return
				} else if (selection.current.mode === "lasso" && selection.current.path.length > 2) {
					pts = selection.current.path
					let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y
					for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y }
					sx = Math.max(0, Math.floor(minX - (layer.x || 0)))
					sy = Math.max(0, Math.floor(minY - (layer.y || 0)))
					sw = Math.max(1, Math.min(layer.width - sx, Math.floor(maxX - minX)))
					sh = Math.max(1, Math.min(layer.height - sy, Math.floor(maxY - minY)))
					if (sw <= 0 || sh <= 0) return
				}
				// Downscale selection region
				const downW = Math.max(1, Math.floor(sw / bs))
				const downH = Math.max(1, Math.floor(sh / bs))
				const cDown = document.createElement("canvas")
				cDown.width = downW
				cDown.height = downH
				const dctx = cDown.getContext("2d")
				if (!dctx) return
				dctx.imageSmoothingEnabled = true
				dctx.drawImage(layer.canvas, sx, sy, sw, sh, 0, 0, downW, downH)
				// Upscale without smoothing
				const cUp = document.createElement("canvas")
				cUp.width = sw
				cUp.height = sh
				const uctx = cUp.getContext("2d")
				if (!uctx) return
				uctx.imageSmoothingEnabled = false
				uctx.drawImage(cDown, 0, 0, downW, downH, 0, 0, sw, sh)
				// Draw back, respecting lasso if present
				const lctx = layer.ctx
				lctx.save()
				if (pts && pts.length > 2) {
					lctx.beginPath()
					// Build path in layer-local coords
					const ox = layer.x || 0
					const oy = layer.y || 0
					lctx.moveTo(pts[0].x - ox, pts[0].y - oy)
					for (let i = 1; i < pts.length; i++) lctx.lineTo(pts[i].x - ox, pts[i].y - oy)
					lctx.closePath()
					lctx.clip()
				}
				lctx.imageSmoothingEnabled = false
				lctx.drawImage(cUp, 0, 0, sw, sh, sx, sy, sw, sh)
				lctx.restore()
				composite()
				addHistory("Pixelate")
			}, [activeLayer, composite, pushLayerSnapshot])

			// Filters: black & white threshold at 128
			const applyThresholdBW = useCallback((threshold: number = 128) => {
				if (!activeLayer) return
				pushLayerSnapshot(activeLayer)
				const layer = activeLayer
				let sx = 0, sy = 0, sw = layer.width, sh = layer.height
				let poly: { x: number; y: number }[] | null = null
				if (selection.current.mode === "rect" && selection.current.rect) {
					const rect = selection.current.rect
					sx = Math.max(0, Math.floor(rect.x - (layer.x || 0)))
					sy = Math.max(0, Math.floor(rect.y - (layer.y || 0)))
					sw = Math.max(0, Math.min(layer.width - sx, Math.floor(rect.w)))
					sh = Math.max(0, Math.min(layer.height - sy, Math.floor(rect.h)))
					if (sw <= 0 || sh <= 0) return
				} else if (selection.current.mode === "lasso" && selection.current.path.length > 2) {
					const pts = selection.current.path
					let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y
					for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y }
					sx = Math.max(0, Math.floor(minX - (layer.x || 0)))
					sy = Math.max(0, Math.floor(minY - (layer.y || 0)))
					sw = Math.max(0, Math.min(layer.width - sx, Math.floor(maxX - minX)))
					sh = Math.max(0, Math.min(layer.height - sy, Math.floor(maxY - minY)))
					if (sw <= 0 || sh <= 0) return
					poly = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }))
				}
				try {
					const img = layer.ctx.getImageData(sx, sy, sw, sh)
					const data = img.data
					const orig = new Uint8ClampedArray(data)
					const t = Math.max(0, Math.min(255, Math.floor(threshold)))
					for (let y = 0; y < sh; y++) {
						for (let x = 0; x < sw; x++) {
							const idx = (y * sw + x) * 4
							const inside = !poly || pointInPolygon(poly, x + 0.5, y + 0.5)
							if (!inside) {
								data[idx] = orig[idx]
								data[idx + 1] = orig[idx + 1]
								data[idx + 2] = orig[idx + 2]
								continue
							}
							const r = data[idx]
							const g = data[idx + 1]
							const b = data[idx + 2]
							const yv = 0.2126 * r + 0.7152 * g + 0.0722 * b
							const v = yv >= t ? 255 : 0
							data[idx] = data[idx + 1] = data[idx + 2] = v
						}
					}
					layer.ctx.putImageData(img, sx, sy)
					composite()
				} catch {}
				addHistory("Black & White")
			}, [activeLayer, composite, pushLayerSnapshot])

			// Filters: invert colors
			const applyInvert = useCallback(() => {
				if (!activeLayer) return
				pushLayerSnapshot(activeLayer)
				const layer = activeLayer
				let sx = 0, sy = 0, sw = layer.width, sh = layer.height
				let poly: { x: number; y: number }[] | null = null
				if (selection.current.mode === "rect" && selection.current.rect) {
					const rect = selection.current.rect
					sx = Math.max(0, Math.floor(rect.x - (layer.x || 0)))
					sy = Math.max(0, Math.floor(rect.y - (layer.y || 0)))
					sw = Math.max(0, Math.min(layer.width - sx, Math.floor(rect.w)))
					sh = Math.max(0, Math.min(layer.height - sy, Math.floor(rect.h)))
					if (sw <= 0 || sh <= 0) return
				} else if (selection.current.mode === "lasso" && selection.current.path.length > 2) {
					const pts = selection.current.path
					let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y
					for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y }
					sx = Math.max(0, Math.floor(minX - (layer.x || 0)))
					sy = Math.max(0, Math.floor(minY - (layer.y || 0)))
					sw = Math.max(0, Math.min(layer.width - sx, Math.floor(maxX - minX)))
					sh = Math.max(0, Math.min(layer.height - sy, Math.floor(maxY - minY)))
					if (sw <= 0 || sh <= 0) return
					poly = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }))
				}
				try {
					const img = layer.ctx.getImageData(sx, sy, sw, sh)
					const data = img.data
					const orig = new Uint8ClampedArray(data)
					for (let y = 0; y < sh; y++) {
						for (let x = 0; x < sw; x++) {
							const idx = (y * sw + x) * 4
							const inside = !poly || pointInPolygon(poly, x + 0.5, y + 0.5)
							if (!inside) {
								data[idx] = orig[idx]
								data[idx + 1] = orig[idx + 1]
								data[idx + 2] = orig[idx + 2]
								continue
							}
							data[idx] = 255 - data[idx]
							data[idx + 1] = 255 - data[idx + 1]
							data[idx + 2] = 255 - data[idx + 2]
						}
					}
					layer.ctx.putImageData(img, sx, sy)
					composite()
				} catch {}
				addHistory("Invert Colors")
			}, [activeLayer, composite, pushLayerSnapshot])

			// Filters: emboss (engraved effect) via 3x3 convolution kernel
			const applyEmboss = useCallback(() => {
				if (!activeLayer) return
				pushLayerSnapshot(activeLayer)
				const layer = activeLayer
				let sx = 0, sy = 0, sw = layer.width, sh = layer.height
				let poly: { x: number; y: number }[] | null = null
				if (selection.current.mode === "rect" && selection.current.rect) {
					const rect = selection.current.rect
					sx = Math.max(0, Math.floor(rect.x - (layer.x || 0)))
					sy = Math.max(0, Math.floor(rect.y - (layer.y || 0)))
					sw = Math.max(0, Math.min(layer.width - sx, Math.floor(rect.w)))
					sh = Math.max(0, Math.min(layer.height - sy, Math.floor(rect.h)))
					if (sw <= 0 || sh <= 0) return
				} else if (selection.current.mode === "lasso" && selection.current.path.length > 2) {
					const pts = selection.current.path
					let minX = pts[0].x, minY = pts[0].y, maxX = pts[0].x, maxY = pts[0].y
					for (const p of pts) { if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y; if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y }
					sx = Math.max(0, Math.floor(minX - (layer.x || 0)))
					sy = Math.max(0, Math.floor(minY - (layer.y || 0)))
					sw = Math.max(0, Math.min(layer.width - sx, Math.floor(maxX - minX)))
					sh = Math.max(0, Math.min(layer.height - sy, Math.floor(maxY - minY)))
					if (sw <= 0 || sh <= 0) return
					poly = pts.map((p) => ({ x: p.x - minX, y: p.y - minY }))
				}
				try {
					const img = layer.ctx.getImageData(sx, sy, sw, sh)
					const data = img.data
					const src = new Uint8ClampedArray(data)
					const orig = new Uint8ClampedArray(data)
					const w = img.width
					const h = img.height
					// Classic emboss kernel
					const kernel = [-2, -1, 0, -1, 1, 1, 0, 1, 2]
					const bias = 128
					for (let yy = 1; yy < h - 1; yy++) {
						for (let xx = 1; xx < w - 1; xx++) {
							const inside = !poly || pointInPolygon(poly, xx + 0.5, yy + 0.5)
							let rr = 0, gg = 0, bb = 0
							if (inside) {
								let ki = 0
								for (let ky = -1; ky <= 1; ky++) {
									for (let kx = -1; kx <= 1; kx++) {
										const ix = xx + kx
										const iy = yy + ky
										const idx = (iy * w + ix) * 4
										const k = kernel[ki++]
										rr += src[idx] * k
										gg += src[idx + 1] * k
										bb += src[idx + 2] * k
									}
								}
							}
							const di = (yy * w + xx) * 4
							if (inside) {
								data[di] = Math.max(0, Math.min(255, rr + bias))
								data[di + 1] = Math.max(0, Math.min(255, gg + bias))
								data[di + 2] = Math.max(0, Math.min(255, bb + bias))
							} else {
								data[di] = orig[di]
								data[di + 1] = orig[di + 1]
								data[di + 2] = orig[di + 2]
							}
						}
					}
					layer.ctx.putImageData(img, sx, sy)
					composite()
				} catch {}
				addHistory("Emboss")
			}, [activeLayer, composite, pushLayerSnapshot])

			// Deformations: flip horizontally/vertically
			const flipActiveLayer = useCallback((mode: "horizontal" | "vertical") => {
				if (!activeLayer) return
				pushLayerSnapshot(activeLayer)
				const out = document.createElement("canvas")
				out.width = activeLayer.width
				out.height = activeLayer.height
				const ctx = out.getContext("2d")
				if (!ctx) return
				ctx.save()
				if (mode === "horizontal") {
					ctx.translate(out.width, 0)
					ctx.scale(-1, 1)
				} else {
					ctx.translate(0, out.height)
					ctx.scale(1, -1)
				}
				ctx.drawImage(activeLayer.canvas, 0, 0)
				ctx.restore()
				activeLayer.canvas = out
				activeLayer.ctx = ctx
				activeLayer.width = out.width
				activeLayer.height = out.height
				activeLayer.x = activeLayer.x || 0
				activeLayer.y = activeLayer.y || 0
				composite()
				addHistory(mode === "horizontal" ? "Flip Horizontal" : "Flip Vertical")
			}, [activeLayer, composite, pushLayerSnapshot])

	return {
		displayCanvasRef,
		size,
		brush,
		setBrush,
		composite,
		attachPointerEvents,
		undoLastStroke,
	    redoLastAction,
			clearSelection,
			getSelectionCanvas,
			getSelectionRect,
			rotateActiveLayer90,
			resizeActiveLayer,
			cropActiveLayerToSelection,
			previewTick,
			applyBrightnessContrast,
			applyGrayscale,
			applyThresholdBW,
			applyInvert,
			applyEmboss,
			flipActiveLayer,
	    historyEntries,
			applySepia,
			applyPixelate,
	}
}

