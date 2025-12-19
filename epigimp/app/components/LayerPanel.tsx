"use client"

import type { Layer } from "../hooks/useLayers"
import { Trash2, Eye, EyeOff, ArrowUp, ArrowDown } from "lucide-react"

type Props = {
	layers: Layer[]
	activeLayerId: string | null
	onSelect: (id: string) => void
	onToggle: (id: string) => void
	onMove: (id: string, dir: "up" | "down") => void
	onRemove: (id: string) => void
	onAdd?: () => void
	previewTick?: number
}

export default function LayerPanel({ layers, activeLayerId, onSelect, onToggle, onMove, onRemove, onAdd, previewTick }: Props) {
	return (
		<div className="p-2 border rounded-md w-80">
			<div className="flex items-center justify-between mb-2">
				<div className="font-semibold">Layers</div>
				{onAdd && (
					<button className="px-2 py-1 border rounded text-xs" onClick={onAdd}>
						New Layer
					</button>
				)}
			</div>
			<ul className="space-y-2">
				{layers
					.map((l, i) => ({ l, i }))
					.reverse()
						.map(({ l }) => (
						<li
							key={l.id}
							className={`flex items-center justify-between gap-2 p-2 rounded border ${
								activeLayerId === l.id ? "bg-zinc-100 dark:bg-zinc-800" : "bg-transparent"
							} hover:bg-zinc-50 dark:hover:bg-zinc-900`}
						>
							<button className="flex-1 text-left flex items-center gap-2" onClick={() => onSelect(l.id)}>
								{/* Thumbnail preview */}
								<div className="w-10 h-10 rounded overflow-hidden border transparency-grid flex items-center justify-center">
									{/* Use data URL so it refreshes when previewTick changes */}
									<img
										src={l.canvas.toDataURL("image/png")}
										alt={l.name}
										className="w-full h-full object-contain"
										style={{ imageRendering: "pixelated" }}
									/>
								</div>
								<span className="flex items-center">
									{l.visible ? <Eye className="inline-block w-4 h-4 mr-1" /> : <EyeOff className="inline-block w-4 h-4 mr-1" />} {l.name}
								</span>
							</button>
							<div className="flex gap-1">
								<button title="Toggle" onClick={() => onToggle(l.id)} className="px-2 py-1 border rounded">
									{l.visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
								</button>
								<button title="Move up" onClick={() => onMove(l.id, "up")} className="px-2 py-1 border rounded">
									<ArrowUp className="w-4 h-4" />
								</button>
								<button title="Move down" onClick={() => onMove(l.id, "down")} className="px-2 py-1 border rounded">
									<ArrowDown className="w-4 h-4" />
								</button>
								<button
									title="Remove"
									onClick={() => {
										if (layers.length <= 1) return
										const ok = window.confirm(`Delete layer "${l.name}"?`)
										if (ok) onRemove(l.id)
									}}
									className="px-2 py-1 border rounded"
									disabled={layers.length <= 1}
								>
									<Trash2 className="w-4 h-4" />
								</button>
							</div>
						</li>
					))}
			</ul>
		</div>
	)
}

