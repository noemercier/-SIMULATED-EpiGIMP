"use client"

import { useCanvas } from "../hooks/useCanvas"
import type { Layer } from "../hooks/useLayers"

type Props = {
	layers: Layer[]
	activeLayer: Layer | null
}

export default function Toolbar({ layers, activeLayer }: Props) {
	const { brush, setBrush, undoLastStroke } = useCanvas(layers, activeLayer)

	return (
		<div className="p-2 border rounded-md w-full flex items-center gap-4">
			<div className="font-semibold">Toolbar</div>
			<div className="flex items-center gap-2">
				<label className="text-sm">Brush size</label>
				<input
					type="range"
					min={1}
					max={128}
					value={brush.size}
					onChange={(e) => setBrush((b) => ({ ...b, size: Number(e.target.value) }))}
					className="range-gray w-40"
				/>
				<input type="color" value={brush.color} onChange={(e) => setBrush((b) => ({ ...b, color: e.target.value }))} />
				<label className="text-sm">Hardness</label>
				<input
					type="range"
					min={0}
					max={1}
					step={0.05}
					value={brush.hardness}
					onChange={(e) => setBrush((b) => ({ ...b, hardness: Number(e.target.value) }))}
					className="range-gray w-40"
				/>
			</div>
			<button className="px-3 py-1 border rounded" onClick={undoLastStroke} disabled={!activeLayer}>
				Undo stroke
			</button>
		</div>
	)
}

