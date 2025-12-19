"use client"

import type { useCanvas } from "../hooks/useCanvas"
import type { Layer } from "../hooks/useLayers"

type Props = {
  canvas: ReturnType<typeof useCanvas>
  activeLayer?: Layer | null
}

export default function ToolOptions({ canvas, activeLayer }: Props) {
  const { brush, setBrush, undoLastStroke, cropActiveLayerToSelection, rotateActiveLayer90, resizeActiveLayer, getSelectionRect } = canvas

  return (
    <div className="p-2 border rounded-md w-full">
      <div className="font-semibold mb-2">Tool Options</div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="w-24 text-sm">Brush size</span>
          <input
            type="range"
            min={1}
            max={128}
            value={brush.size}
            onChange={(e) => setBrush((b) => ({ ...b, size: Number(e.target.value) }))}
            className="range-gray w-40"
          />
          <span className="text-xs">{brush.size}px</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-24 text-sm">Color</span>
          <input type="color" value={brush.color} onChange={(e) => setBrush((b) => ({ ...b, color: e.target.value }))} />
        </div>
        <div className="flex items-center gap-2">
          <span className="w-24 text-sm">Hardness</span>
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
        <div>
          <button className="px-3 py-1 border rounded" onClick={undoLastStroke}>
            Undo stroke
          </button>
        </div>

        {/* Transform tools */}
        <div className="mt-2 border-t pt-2">
          <div className="font-semibold mb-2 text-sm">Transform (Active layer)</div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="px-2 py-1 border rounded"
              onClick={() => rotateActiveLayer90("ccw")}
              disabled={!activeLayer}
              title="Rotate 90° CCW"
            >
              Rotate ⟲ 90°
            </button>
            <button
              className="px-2 py-1 border rounded"
              onClick={() => rotateActiveLayer90("cw")}
              disabled={!activeLayer}
              title="Rotate 90° CW"
            >
              Rotate ⟳ 90°
            </button>
            <button
              className="px-2 py-1 border rounded"
              onClick={() => rotateActiveLayer90("flip")}
              disabled={!activeLayer}
              title="Rotate 180°"
            >
              Rotate 180°
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="w-24 text-sm">Resize (px)</span>
            <input
              type="number"
              min={1}
              defaultValue={activeLayer?.width ?? 0}
              className="w-20 px-2 py-1 border rounded"
              id="resize-w"
            />
            <span>×</span>
            <input
              type="number"
              min={1}
              defaultValue={activeLayer?.height ?? 0}
              className="w-20 px-2 py-1 border rounded"
              id="resize-h"
            />
            <button
              className="px-2 py-1 border rounded"
              disabled={!activeLayer}
              onClick={() => {
                const wEl = document.getElementById("resize-w") as HTMLInputElement | null
                const hEl = document.getElementById("resize-h") as HTMLInputElement | null
                const w = Math.max(1, Number(wEl?.value ?? activeLayer?.width ?? 0))
                const h = Math.max(1, Number(hEl?.value ?? activeLayer?.height ?? 0))
                resizeActiveLayer(w, h)
              }}
            >
              Apply
            </button>
          </div>
          <div className="mt-2">
            <button
              className="px-2 py-1 border rounded"
              onClick={cropActiveLayerToSelection}
              disabled={!getSelectionRect() || !activeLayer}
              title="Crop active layer to current selection"
            >
              Crop to selection
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
