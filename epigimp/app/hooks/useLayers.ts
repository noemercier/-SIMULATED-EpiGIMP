"use client"

import { useCallback, useMemo, useState } from "react"

export type BlendMode = GlobalCompositeOperation

export type Layer = {
	id: string
	name: string
	visible: boolean
	opacity: number // 0..1
	blendMode: BlendMode
	canvas: HTMLCanvasElement
	ctx: CanvasRenderingContext2D
	width: number
	height: number
	x: number
	y: number
  // Optional metadata for file-system-backed layers
  fileHandle?: FileSystemFileHandle
  sourceName?: string
  sourceType?: string
}

export type LayersState = {
	layers: Layer[]
	activeLayerId: string | null
}

function createCanvas(width: number, height: number) {
	const canvas = document.createElement("canvas")
	canvas.width = width
	canvas.height = height
	const ctx = canvas.getContext("2d")
	if (!ctx) throw new Error("Failed to get 2D context")
	return { canvas, ctx }
}

export function useLayers(initialWidth = 1024, initialHeight = 768) {
	const [state, setState] = useState<LayersState>({ layers: [], activeLayerId: null })

	const size = useMemo(() => ({ width: initialWidth, height: initialHeight }), [initialWidth, initialHeight])

	const addEmptyLayer = useCallback(
		(name = "Layer", width = size.width, height = size.height) => {
			const { canvas, ctx } = createCanvas(width, height)
			const id = crypto.randomUUID()
			const layer: Layer = {
				id,
				name,
				visible: true,
				opacity: 1,
				blendMode: "source-over",
				canvas,
				ctx,
				width,
						height,
						x: 0,
						y: 0,
			}
			setState((prev) => ({
				layers: [...prev.layers, layer],
				activeLayerId: id,
			}))
			return layer
		},
		[size.width, size.height],
	)

	const addLayerFromImage = useCallback(
	  (img: HTMLImageElement, name = "Image", meta?: { fileHandle?: FileSystemFileHandle; sourceName?: string; sourceType?: string }) => {
		const width = img.naturalWidth
		const height = img.naturalHeight
		const { canvas, ctx } = createCanvas(width, height)
		ctx.drawImage(img, 0, 0)
		const id = crypto.randomUUID()
		const layer: Layer = {
			id,
			name,
			visible: true,
			opacity: 1,
			blendMode: "source-over",
			canvas,
			ctx,
			width,
					height,
				x: 0,
				y: 0,
	        fileHandle: meta?.fileHandle,
	        sourceName: meta?.sourceName,
	        sourceType: meta?.sourceType,
		}
		setState((prev) => ({ layers: [...prev.layers, layer], activeLayerId: id }))
		return layer
		}, [],
	)

		const addLayerFromCanvas = useCallback(
      (sourceCanvas: HTMLCanvasElement, name = "Canvas", meta?: { fileHandle?: FileSystemFileHandle; sourceName?: string; sourceType?: string }) => {
			const width = sourceCanvas.width
			const height = sourceCanvas.height
			const { canvas, ctx } = createCanvas(width, height)
			ctx.drawImage(sourceCanvas, 0, 0)
			const id = crypto.randomUUID()
			const layer: Layer = {
				id,
				name,
				visible: true,
				opacity: 1,
				blendMode: "source-over",
				canvas,
				ctx,
				width,
				height,
				x: 0,
				y: 0,
          fileHandle: meta?.fileHandle,
          sourceName: meta?.sourceName,
          sourceType: meta?.sourceType,
			}
			setState((prev) => ({ layers: [...prev.layers, layer], activeLayerId: id }))
			return layer
		}, [],
    )

	const removeLayer = useCallback((id: string) => {
		setState((prev) => {
			const layers = prev.layers.filter((l) => l.id !== id)
			const activeLayerId = prev.activeLayerId === id ? layers[layers.length - 1]?.id ?? null : prev.activeLayerId
			return { layers, activeLayerId }
		})
	}, [])

	const setActiveLayer = useCallback((id: string) => {
		setState((prev) => ({ ...prev, activeLayerId: id }))
	}, [])

	const toggleVisibility = useCallback((id: string) => {
		setState((prev) => ({
			...prev,
			layers: prev.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
		}))
	}, [])

	const setOpacity = useCallback((id: string, opacity: number) => {
		setState((prev) => ({
			...prev,
			layers: prev.layers.map((l) => (l.id === id ? { ...l, opacity: Math.max(0, Math.min(1, opacity)) } : l)),
		}))
	}, [])

	const setBlendMode = useCallback((id: string, blendMode: BlendMode) => {
		setState((prev) => ({
			...prev,
			layers: prev.layers.map((l) => (l.id === id ? { ...l, blendMode } : l)),
		}))
	}, [])

	const moveLayer = useCallback((id: string, direction: "up" | "down") => {
		setState((prev) => {
			const idx = prev.layers.findIndex((l) => l.id === id)
			if (idx < 0) return prev
			const next = [...prev.layers]
			const swapWith = direction === "up" ? idx + 1 : idx - 1
			if (swapWith < 0 || swapWith >= next.length) return prev
			;[next[idx], next[swapWith]] = [next[swapWith], next[idx]]
			return { ...prev, layers: next }
		})
	}, [])

	const activeLayer = useMemo(() => state.layers.find((l) => l.id === state.activeLayerId) ?? null, [state])

	return {
		layers: state.layers,
		activeLayer,
		addEmptyLayer,
		addLayerFromImage,
			addLayerFromCanvas,
		removeLayer,
		setActiveLayer,
		toggleVisibility,
		setOpacity,
		setBlendMode,
		moveLayer,
	}
}

