"use client"

import React from "react"
import { Undo2, Crop, RotateCcw, RotateCw, Expand, Sparkles, XCircle } from "lucide-react"
import type { useCanvas } from "../hooks/useCanvas"
import type { Layer } from "../hooks/useLayers"

type Props = {
  canvas: ReturnType<typeof useCanvas>
  activeLayer?: Layer | null
  activeTool?: "brush" | "eraser" | "move" | "select" | "lasso" | "transform" | "eyedropper"
}

export default function ToolOptions({ canvas, activeLayer, activeTool }: Props) {
  const { brush, setBrush, undoLastStroke, cropActiveLayerToSelection, rotateActiveLayer90, resizeActiveLayer, getSelectionRect, applyBrightnessContrast, applySepia, applyPixelate, clearSelection } = canvas
  const [brightness, setBrightness] = React.useState(0)
  const [contrast, setContrast] = React.useState(0)
  const [sepiaAmt, setSepiaAmt] = React.useState(60)
  const [pixelSize, setPixelSize] = React.useState(8)

  // Contextual visibility: show only when tool has options
  const showBrushOpts = activeTool === "brush" || activeTool === "eraser"
  const showTransformOpts = activeTool === "transform" || activeTool === "select" || activeTool === "lasso"
  const showFilters = (activeTool === "select" || activeTool === "lasso") && !!activeLayer

  if (!showBrushOpts && !showTransformOpts && !showFilters) {
    return (
      <div className="w-full text-sm opacity-80">
        <div className="font-semibold mb-2">Tool Options</div>
        <div>No contextual options for the current tool.</div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="font-semibold mb-2">Tool Options{activeTool ? ` · ${activeTool}` : ""}</div>
      {activeTool === "transform" && (
        <div className="text-xs mb-3 opacity-80">Drag corner handles to resize. Hold Shift to lock aspect ratio.</div>
      )}
      {activeTool === "select" && (
        <div className="text-xs mb-2 opacity-80">Drag to make a rectangle. Use Lasso for freehand polygons; filters and crop respect the selection.</div>
      )}
      {activeTool === "brush" && (
        <div className="text-xs mb-3 opacity-80">Tip: use the Eyedropper to pick a color from the canvas.</div>
      )}
      {(activeTool === "select" || activeTool === "lasso") && (
        <div className="mb-3 flex items-center gap-2">
          <button
            className="app-icon-btn"
            onClick={() => clearSelection()}
            disabled={!getSelectionRect()}
            title="Deselect (clear current selection)"
            aria-label="Deselect"
          >
            <XCircle className="w-4 h-4" />
          </button>
          <span className="text-xs opacity-80">Deselect</span>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {showBrushOpts && (
          <>
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
            {activeTool === "brush" && (
              <div className="flex items-center gap-2">
                <span className="w-24 text-sm">Color</span>
                <input type="color" value={brush.color} onChange={(e) => setBrush((b) => ({ ...b, color: e.target.value }))} />
              </div>
            )}
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
              <button className="app-icon-btn" onClick={undoLastStroke} aria-label="Undo last stroke" title="Undo last stroke">
                <Undo2 className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {/* Transform tools */}
        {showTransformOpts && (
          <div className="mt-2 border-t pt-2">
            <div className="font-semibold mb-2 text-sm">Transform (Active layer)</div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="app-icon-btn"
                onClick={() => rotateActiveLayer90("ccw")}
                disabled={!activeLayer}
                title="Rotate 90° CCW"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                className="app-icon-btn"
                onClick={() => rotateActiveLayer90("cw")}
                disabled={!activeLayer}
                title="Rotate 90° CW"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                className="app-icon-btn"
                onClick={() => rotateActiveLayer90("flip")}
                disabled={!activeLayer}
                title="Rotate 180°"
              >
                <RotateCw className="w-4 h-4" />
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
                className="app-icon-btn"
                disabled={!activeLayer}
                onClick={() => {
                  const wEl = document.getElementById("resize-w") as HTMLInputElement | null
                  const hEl = document.getElementById("resize-h") as HTMLInputElement | null
                  const w = Math.max(1, Number(wEl?.value ?? activeLayer?.width ?? 0))
                  const h = Math.max(1, Number(hEl?.value ?? activeLayer?.height ?? 0))
                  resizeActiveLayer(w, h)
                }}
              >
                <Expand className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2">
              <button
                className="app-icon-btn"
                onClick={cropActiveLayerToSelection}
                disabled={!getSelectionRect() || !activeLayer}
                title="Crop active layer to current selection"
              >
                <Crop className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        {showFilters && (
          <div className="mt-4 border-t pt-3">
            <div className="font-semibold mb-2 text-sm">Filters</div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-24 text-sm">Brightness</span>
              <input
                type="range"
                min={-100}
                max={100}
                value={brightness}
                onChange={(e) => setBrightness(Number(e.target.value))}
                className="range-gray w-40"
              />
              <span className="text-xs w-10 text-right">{brightness}</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-24 text-sm">Contrast</span>
              <input
                type="range"
                min={-100}
                max={100}
                value={contrast}
                onChange={(e) => setContrast(Number(e.target.value))}
                className="range-gray w-40"
              />
              <span className="text-xs w-10 text-right">{contrast}</span>
            </div>
            <button
              className="app-icon-btn"
              disabled={!activeLayer}
              onClick={() => applyBrightnessContrast(brightness, contrast)}
              title="Apply brightness/contrast to selection if present, else to entire active layer"
            >
              <Sparkles className="w-4 h-4" />
            </button>

            {/* Sepia */}
            <div className="mt-3 flex items-center gap-2 mb-2">
              <span className="w-24 text-sm">Sepia</span>
              <input
                type="range"
                min={0}
                max={100}
                value={sepiaAmt}
                onChange={(e) => setSepiaAmt(Number(e.target.value))}
                className="range-gray w-40"
              />
              <span className="text-xs w-10 text-right">{sepiaAmt}</span>
              <button
                className="app-icon-btn"
                disabled={!activeLayer}
                onClick={() => applySepia(sepiaAmt)}
                title="Apply sepia tone to selection if present, else to entire active layer"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>

            {/* Pixelate */}
            <div className="flex items-center gap-2 mb-2">
              <span className="w-24 text-sm">Pixelate</span>
              <input
                type="range"
                min={2}
                max={64}
                value={pixelSize}
                onChange={(e) => setPixelSize(Number(e.target.value))}
                className="range-gray w-40"
              />
              <span className="text-xs w-10 text-right">{pixelSize}px</span>
              <button
                className="app-icon-btn"
                disabled={!activeLayer}
                onClick={() => applyPixelate(pixelSize)}
                title="Apply mosaic pixelation to selection if present, else to entire active layer"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
