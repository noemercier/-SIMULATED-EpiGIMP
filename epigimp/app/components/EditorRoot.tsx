"use client"

import EditorCanvas from "./EditorCanvas"
import LayerPanel from "./LayerPanel"
import FileLoader from "./FileLoader"
import ToolOptions from "./ToolOptions"
import Toolbox from "./Toolbox"
import StatusBar from "./StatusBar"
import { useLayers } from "../hooks/useLayers"
import { useCanvas } from "../hooks/useCanvas"
import { useEffect, useState } from "react"

export default function EditorRoot() {
  type LocalMenuItem = {
    label: string
    onClick: () => void
    disabled?: boolean
    active?: boolean
  }

  function LocalDropdown({ label, items }: { label: string; items: LocalMenuItem[] }) {
    const [open, setOpen] = useState(false)
    return (
      <div className="relative select-none">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="px-2 py-1 rounded hover:bg-zinc-300 dark:hover:bg-zinc-700"
        >
          {label}
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-1 min-w-[180px] rounded border bg-white shadow dark:bg-zinc-900 z-50">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (!item.disabled) item.onClick()
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                  item.disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
                disabled={item.disabled}
              >
                <span>{item.label}</span>
                {item.active && <span className="text-xs">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  function LocalTopMenu({
    onNewLayer,
    onExport,
    onExportJpeg,
    onExportWebp,
    onUndo,
    onNewLayerFromSelection,
    onDeleteActive,
    onPickTool,
    activeTool,
  }: {
    onNewLayer: () => void
    onExport: () => void
    onExportJpeg: () => void
    onExportWebp: () => void
    onUndo: () => void
    onNewLayerFromSelection: () => void
    onDeleteActive: () => void
    onPickTool: (tool: "brush" | "eraser" | "move" | "select") => void
    activeTool: "brush" | "eraser" | "move" | "select"
  }) {
    return (
      <div className="flex items-center gap-4 bg-zinc-200 dark:bg-zinc-800 px-3 py-2 text-sm">
        <div className="flex items-center gap-3">
          <LocalDropdown
            label="File"
            items={[
              { label: "Export PNG", onClick: onExport },
              { label: "Export JPEG", onClick: onExportJpeg },
              { label: "Export WebP", onClick: onExportWebp },
            ]}
          />
          <LocalDropdown
            label="Edit"
            items={[
              { label: "Undo (Ctrl+Z)", onClick: onUndo },
              { label: "Copy selection (Ctrl+C)", onClick: copySelection },
              { label: "Paste (Ctrl+V)", onClick: pasteClipboard, disabled: !clipboard },
            ]}
          />
          <LocalDropdown
            label="Layer"
            items={[
              { label: "New", onClick: onNewLayer },
              { label: "New from selection", onClick: onNewLayerFromSelection },
              { label: "Delete active", onClick: onDeleteActive, disabled: !layersApi.activeLayer || layersApi.layers.length <= 1 },
            ]}
          />
          <LocalDropdown
            label="Tools"
            items={("brush,eraser,move,select".split(",") as ("brush" | "eraser" | "move" | "select")[]).map(
              (t) => ({ label: t, onClick: () => onPickTool(t), active: activeTool === t })
            )}
          />
        </div>
        <div className="ml-auto" />
      </div>
    )
  }
  const layersApi = useLayers()
  const [activeTool, setActiveTool] = useState<"brush" | "move" | "eraser" | "select">("brush")
  const canvasApi = useCanvas(layersApi.layers, layersApi.activeLayer, activeTool)
  const [clipboard, setClipboard] = useState<HTMLCanvasElement | null>(null)

  const exportPng = () => {
    const el = canvasApi.displayCanvasRef.current
    if (!el) return
    const url = el.toDataURL("image/png")
    const a = document.createElement("a")
    a.href = url
    a.download = "epigimp.png"
    a.click()
  }

  const exportWithFormat = (mime: "image/jpeg" | "image/webp", defaultExt: string) => {
    const el = canvasApi.displayCanvasRef.current
    if (!el) return
    let quality = 0.92
    const qStr = window.prompt("Quality (0.0 - 1.0)", "0.92")
    if (qStr) {
      const qNum = Number(qStr)
      if (!Number.isNaN(qNum) && qNum >= 0 && qNum <= 1) quality = qNum
    }
    const url = el.toDataURL(mime, quality)
    const a = document.createElement("a")
    a.href = url
    a.download = `epigimp.${defaultExt}`
    a.click()
  }

  const newLayerFromSelection = () => {
    const source = canvasApi.getSelectionCanvas?.()
    if (!source) return
    layersApi.addLayerFromCanvas(source, "Selection")
    canvasApi.clearSelection?.()
  }

  const copySelection = () => {
    const source = canvasApi.getSelectionCanvas?.()
    if (!source) return
    setClipboard(source)
  }

  const pasteClipboard = () => {
    if (!clipboard) return
    layersApi.addLayerFromCanvas(clipboard, "Pasted")
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return
      }
      const isMod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (isMod && key === "z") {
        e.preventDefault()
        canvasApi.undoLastStroke?.()
      } else if (isMod && key === "c") {
        e.preventDefault()
        copySelection()
      } else if (isMod && key === "v") {
        e.preventDefault()
        pasteClipboard()
      } else if (!isMod && (key === "delete" || key === "backspace")) {
        // Delete active layer (confirmation), avoid when typing in inputs (handled above)
        const active = layersApi.activeLayer
        if (active && layersApi.layers.length > 1) {
          const ok = window.confirm(`Delete layer "${active.name}"?`)
          if (ok) layersApi.removeLayer(active.id)
        }
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [canvasApi, clipboard])

  return (
    <div className="flex flex-col h-screen">
      <LocalTopMenu
        onNewLayer={() => layersApi.addEmptyLayer("Empty Layer")}
        onExport={exportPng}
        onExportJpeg={() => exportWithFormat("image/jpeg", "jpeg")}
        onExportWebp={() => exportWithFormat("image/webp", "webp")}
        onUndo={canvasApi.undoLastStroke}
        onNewLayerFromSelection={newLayerFromSelection}
        onDeleteActive={() => {
          const active = layersApi.activeLayer
          if (!active || layersApi.layers.length <= 1) return
          const ok = window.confirm(`Delete layer "${active.name}"?`)
          if (ok) layersApi.removeLayer(active.id)
        }}
        onPickTool={(t) => setActiveTool(t)}
        activeTool={activeTool}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Left toolbox */}
        <Toolbox
          activeTool={activeTool}
          onSelectTool={setActiveTool}
          onCrop={() => canvasApi.cropActiveLayerToSelection?.()}
          onRotateCW={() => canvasApi.rotateActiveLayer90?.("cw")}
          onRotateCCW={() => canvasApi.rotateActiveLayer90?.("ccw")}
          onRotate180={() => canvasApi.rotateActiveLayer90?.("flip")}
          onResize={() => {
            const w = layersApi.activeLayer?.width ?? 0
            const h = layersApi.activeLayer?.height ?? 0
            const input = window.prompt(`Resize active layer (widthxheight)`, `${w}x${h}`)
            if (!input) return
            const m = input.trim().match(/^(\d+)x(\d+)$/i)
            if (!m) {
              alert("Enter size like 800x600")
              return
            }
            const nw = Number(m[1])
            const nh = Number(m[2])
            canvasApi.resizeActiveLayer?.(nw, nh)
          }}
          hasSelection={!!canvasApi.getSelectionRect?.()}
          canTransform={!!layersApi.activeLayer}
        />
        {/* Center canvas area */}
        <div className="flex-1 p-2 overflow-auto">
          <EditorCanvas canvas={canvasApi} />
        </div>
        {/* Right dock: tool options + layers */}
        <div className="w-80 p-2 flex flex-col gap-2 border-l">
          <ToolOptions canvas={canvasApi} activeLayer={layersApi.activeLayer} />
          <FileLoader layersApi={layersApi} />
          <LayerPanel
            layers={layersApi.layers}
            activeLayerId={layersApi.activeLayer?.id ?? null}
            onSelect={(id) => layersApi.setActiveLayer(id)}
            onToggle={(id) => layersApi.toggleVisibility(id)}
            onMove={(id, dir) => layersApi.moveLayer(id, dir)}
            onRemove={(id) => layersApi.removeLayer(id)}
            onAdd={() => layersApi.addEmptyLayer("Empty Layer")}
            previewTick={canvasApi.previewTick}
          />
        </div>
      </div>
      <StatusBar message={`Active tool: ${activeTool}${layersApi.activeLayer ? ` | Layer: ${layersApi.activeLayer.name}` : ""}`} />
    </div>
  )
}
