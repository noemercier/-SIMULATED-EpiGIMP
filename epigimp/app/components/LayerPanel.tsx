"use client"

import type { Layer } from "../hooks/useLayers"
import { Trash2, Eye, EyeOff, ArrowUp, ArrowDown, Plus } from "lucide-react"

type Props = {
	layers: Layer[]
	activeLayerId: string | null
	onSelect: (id: string) => void
	onToggle: (id: string) => void
	onMove: (id: string, dir: "up" | "down") => void
	onRemove: (id: string) => void
	onAdd?: () => void
	previewTick?: number
  classNameWrapper?: string
}

export default function LayerPanel({ layers, activeLayerId, onSelect, onToggle, onMove, onRemove, onAdd, previewTick, classNameWrapper }: Props) {
	return (
		<div className={`p-2 app-panel w-80 ${classNameWrapper ?? ""}`}>
			<div className="flex items-center justify-between mb-2">
				<div className="font-semibold">Layers</div>
				{onAdd && (
					<button className="app-icon-btn" aria-label="New Layer" title="New Layer" onClick={onAdd}>
						<Plus className="w-4 h-4" />
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
							className={`flex items-center justify-between gap-2 p-2 rounded border-[var(--border)] ${
								activeLayerId === l.id ? "bg-zinc-700/10" : "bg-transparent"
							} hover:bg-zinc-700/20`}
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
								<button title="Toggle" onClick={() => onToggle(l.id)} className="app-icon-btn">
									{l.visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
								</button>
								<button title="Move up" onClick={() => onMove(l.id, "up")} className="app-icon-btn">
									<ArrowUp className="w-4 h-4" />
								</button>
								<button title="Move down" onClick={() => onMove(l.id, "down")} className="app-icon-btn">
									<ArrowDown className="w-4 h-4" />
								</button>
								<button
									title="Remove"
									onClick={() => {
										if (layers.length <= 1) return
										const ok = window.confirm(`Delete layer "${l.name}"?`)
										if (ok) onRemove(l.id)
									}}
									className="app-icon-btn"
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

