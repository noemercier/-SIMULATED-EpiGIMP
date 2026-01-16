"use client"

import EditorCanvas from "./EditorCanvas"
import LayerPanel from "./LayerPanel"
import HistoryPanel from "./HistoryPanel"
import FileLoader from "./FileLoader"
import ToolOptions from "./ToolOptions"
import Toolbox from "./Toolbox"
import StatusBar from "./StatusBar"
import { useLayers } from "../hooks/useLayers"
import { useCanvas } from "../hooks/useCanvas"
import { useEffect, useState } from "react"
import { canvasToBMPBlob, downloadBlob, canvasToBlob } from "../lib/imageUtils"
import { Wand2, Sun, Moon } from "lucide-react"

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
          className="px-2 py-1 rounded app-btn"
        >
          {label}
        </button>
        {open && (
          <div className="absolute left-0 top-full mt-1 min-w-[200px] rounded border app-panel z-50">
            {items.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  if (!item.disabled) item.onClick()
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                  item.disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-zinc-700/20"
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
    onApplyFilters,
    filtersMenu,
    onToggleTheme,
    themeLabel,
  }: {
    onNewLayer: () => void;
    onExport: () => void;
    onExportJpeg: () => void;
    onExportWebp: () => void;
    onUndo: () => void;
    onNewLayerFromSelection: () => void;
    onDeleteActive: () => void;
  onPickTool: (tool: "brush" | "eraser" | "move" | "select" | "lasso" | "transform" | "eyedropper") => void;
  activeTool: "brush" | "eraser" | "move" | "select" | "lasso" | "transform" | "eyedropper";
    onApplyFilters: () => void;
    filtersMenu: { label: string; onClick: () => void; disabled?: boolean }[];
    onToggleTheme: () => void;
    themeLabel: string;
  }) {
    return (
      <div className="flex items-center gap-4 app-topbar px-3 py-2 text-sm">
        <div className="flex items-center gap-3">
          <LocalDropdown
            label="File"
            items={[
              { label: "Export PNG", onClick: onExport },
              { label: "Export JPEG", onClick: onExportJpeg },
              { label: "Export WebP", onClick: onExportWebp },
              { label: "Export AVIF", onClick: exportAvif },
              { label: "Export BMP", onClick: exportBmp },
              { label: "Open (File System)", onClick: openViaFS },
              { label: "Save Active", onClick: saveActiveToHandle, disabled: !layersApi.activeLayer || !layersApi.activeLayer.fileHandle },
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
              { label: "Open Layers panel", onClick: () => {
                const el = document.querySelector(".layers-panel") as HTMLElement | null
                el?.scrollIntoView({ behavior: "smooth" })
              } },
              { label: "New", onClick: onNewLayer },
              { label: "New from selection", onClick: onNewLayerFromSelection },
              { label: "Delete active", onClick: onDeleteActive, disabled: !layersApi.activeLayer || layersApi.layers.length <= 1 },
              { label: "Import image as layer…", onClick: importImageAsLayer },
              { label: "Resize Active Layer…", onClick: () => {
                const w = layersApi.activeLayer?.width ?? 0
                const h = layersApi.activeLayer?.height ?? 0
                const input = window.prompt(`Resize active layer (widthxheight)`, `${w}x${h}`)
                if (!input) return
                const m = input.trim().match(/^(\d+)x(\d+)$/i)
                if (!m) { alert("Enter size like 800x600"); return }
                const nw = Number(m[1])
                const nh = Number(m[2])
                canvasApi.resizeActiveLayer?.(nw, nh)
              }, disabled: !layersApi.activeLayer },
            ]}
          />
          <LocalDropdown
            label="Tools"
            items={("brush,eraser,move,select,lasso,transform,eyedropper".split(",") as ("brush" | "eraser" | "move" | "select" | "lasso" | "transform" | "eyedropper")[]).map(
              (t) => ({ label: t, onClick: () => onPickTool(t), active: activeTool === t })
            )}
          />
          <LocalDropdown label="Filters" items={filtersMenu} />
          <LocalDropdown
            label="Canvas"
            items={[
              { label: "Resize Canvas…", onClick: () => {
                const w = canvasApi.size.width
                const h = canvasApi.size.height
                const input = window.prompt(`Resize canvas (widthxheight)`, `${w}x${h}`)
                if (!input) return
                const m = input.trim().match(/^(\d+)x(\d+)$/i)
                if (!m) {
                  alert("Enter size like 1024x768")
                  return
                }
                const nw = Number(m[1])
                const nh = Number(m[2])
                canvasApi.resizeCanvas?.(nw, nh)
              } },
              { label: "Fit to Layers", onClick: () => canvasApi.fitCanvasToLayers?.() },
            ]}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="app-icon-btn" onClick={onApplyFilters} title="Open Filters panel" aria-label="Open Filters panel">
            <Wand2 className="w-4 h-4" />
          </button>
          <button type="button" className="app-icon-btn" onClick={onToggleTheme} title={`Toggle theme (${themeLabel})`} aria-label={`Toggle theme (${themeLabel})`}>
            {themeLabel === "Dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>
      </div>
    )
  }
  const layersApi = useLayers()
  const [activeTool, setActiveTool] = useState<"brush" | "move" | "eraser" | "select" | "lasso" | "transform" | "eyedropper">("brush")
  const canvasApi = useCanvas(layersApi.layers, layersApi.activeLayer, activeTool)
  const [clipboard, setClipboard] = useState<HTMLCanvasElement | null>(null)
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark"
    const t = window.localStorage.getItem("epigimp-theme") as "dark" | "light" | null
    return t ?? "dark"
  })

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme)
      window.localStorage.setItem("epigimp-theme", theme)
    }
  }, [theme])

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

  const exportAvif = () => {
    const el = canvasApi.displayCanvasRef.current
    if (!el) return
    let quality = 0.9
    const qStr = window.prompt("AVIF Quality (0.0 - 1.0)", "0.9")
    if (qStr) {
      const qNum = Number(qStr)
      if (!Number.isNaN(qNum) && qNum >= 0 && qNum <= 1) quality = qNum
    }
    const url = el.toDataURL("image/avif", quality)
    if (!url.startsWith("data:image/avif")) {
      alert("AVIF export is not supported by your browser.")
      return
    }
    const a = document.createElement("a")
    a.href = url
    a.download = "epigimp.avif"
    a.click()
  }

  const exportBmp = () => {
    const el = canvasApi.displayCanvasRef.current
    if (!el) return
    const blob = canvasToBMPBlob(el)
    downloadBlob("epigimp.bmp", blob)
  }

  const importImageAsLayer = async () => {
    try {
      // @ts-expect-error: File System Access API types may not be in TS lib
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: "Images",
            accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp"] },
          },
        ],
        multiple: false,
      })
      const file = await handle.getFile()
      const img = new Image()
      img.onload = () => {
        layersApi.addLayerFromImage(img, file.name, { fileHandle: handle, sourceName: file.name, sourceType: file.type })
      }
      img.onerror = () => alert("Failed to load image")
      img.src = URL.createObjectURL(file)
    } catch (e) {
      console.warn(e)
    }
  }

  const openViaFS = async () => {
    try {
      // @ts-expect-error: File System Access API types are not global in TS lib yet
      const [handle] = await window.showOpenFilePicker({
        types: [
          {
            description: "Images",
            accept: {
              "image/*": [".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif", ".bmp"],
            },
          },
        ],
        multiple: false,
      })
      const file = await handle.getFile()
      const img = new Image()
      img.onload = () => {
        layersApi.addLayerFromImage(img, file.name, {
          fileHandle: handle,
          sourceName: file.name,
          sourceType: file.type,
        })
      }
      img.onerror = () => alert("Failed to load image")
      img.src = URL.createObjectURL(file)
    } catch (e) {
      // user canceled or unsupported
      console.warn(e)
    }
  }

  const saveActiveToHandle = async () => {
    const layer = layersApi.activeLayer
    if (!layer || !layer.fileHandle) return
    type ExportMime = { mime: "image/png" | "image/jpeg" | "image/webp" | "image/avif"; qualityPrompt?: string; defaultQuality?: number }
    const typeMap: Record<string, ExportMime> = {
      "image/png": { mime: "image/png" },
      "image/jpeg": { mime: "image/jpeg", qualityPrompt: "JPEG Quality (0.0-1.0)", defaultQuality: 0.92 },
      "image/webp": { mime: "image/webp", qualityPrompt: "WebP Quality (0.0-1.0)", defaultQuality: 0.92 },
      "image/avif": { mime: "image/avif", qualityPrompt: "AVIF Quality (0.0-1.0)", defaultQuality: 0.9 },
    }
    const target: ExportMime = typeMap[layer.sourceType || "image/png"] || { mime: "image/png" }
    let quality = target.defaultQuality ?? undefined
    if (target.qualityPrompt) {
      const qStr = window.prompt(target.qualityPrompt, String(target.defaultQuality ?? ""))
      if (qStr) {
        const qNum = Number(qStr)
        if (!Number.isNaN(qNum) && qNum >= 0 && qNum <= 1) quality = qNum
      }
    }
    // Canvas to blob using desired type
    try {
      // If AVIF not supported, fallback to PNG
      let blob: Blob
      if (target.mime === "image/avif") {
        const url = layer.canvas.toDataURL("image/avif", quality)
        if (!url.startsWith("data:image/avif")) {
          alert("AVIF save not supported; falling back to PNG.")
          blob = await canvasToBlob(layer.canvas, "image/png")
        } else {
          blob = await canvasToBlob(layer.canvas, "image/avif", quality)
        }
      } else {
        blob = await canvasToBlob(layer.canvas, target.mime, quality)
      }
      const writable = await layer.fileHandle.createWritable()
      await writable.write(blob)
      await writable.close()
      alert(`Saved to ${layer.sourceName ?? "file"}`)
    } catch (e) {
      console.error(e)
      alert("Failed to save. Your browser may not support the File System Access API.")
    }
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
        onApplyFilters={() => {
          // Scroll to right dock tool options panel
          const el = document.querySelector(".tool-options-panel") as HTMLElement | null
          el?.scrollIntoView({ behavior: "smooth" })
        }}
        filtersMenu={[
          { label: "Brightness/Contrast…", onClick: () => {
            const bStr = window.prompt("Brightness (-100..100)", "0")
            const cStr = window.prompt("Contrast (-100..100)", "0")
            const b = Number(bStr ?? 0)
            const c = Number(cStr ?? 0)
            canvasApi.applyBrightnessContrast?.(b, c)
          }, disabled: !layersApi.activeLayer },
          { label: "Black & White", onClick: () => canvasApi.applyThresholdBW?.(128), disabled: !layersApi.activeLayer },
          { label: "Grayscale", onClick: () => canvasApi.applyGrayscale?.(), disabled: !layersApi.activeLayer },
          { label: "Invert Colors", onClick: () => canvasApi.applyInvert?.(), disabled: !layersApi.activeLayer },
          { label: "Emboss (engraved)", onClick: () => canvasApi.applyEmboss?.(), disabled: !layersApi.activeLayer },
          { label: "Flip Horizontal", onClick: () => canvasApi.flipActiveLayer?.("horizontal"), disabled: !layersApi.activeLayer },
          { label: "Flip Vertical", onClick: () => canvasApi.flipActiveLayer?.("vertical"), disabled: !layersApi.activeLayer },
        ]}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        themeLabel={theme === "dark" ? "Dark" : "Light"}
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
          onResizeCanvas={() => {
            const w = canvasApi.size.width
            const h = canvasApi.size.height
            const input = window.prompt(`Resize canvas (widthxheight)`, `${w}x${h}`)
            if (!input) return
            const m = input.trim().match(/^(\d+)x(\d+)$/i)
            if (!m) {
              alert("Enter size like 1024x768")
              return
            }
            const nw = Number(m[1])
            const nh = Number(m[2])
            canvasApi.resizeCanvas?.(nw, nh)
          }}
          hasSelection={!!canvasApi.getSelectionRect?.()}
          canTransform={!!layersApi.activeLayer}
        />
        {/* Center canvas area */}
        <div className="flex-1 p-4 overflow-auto">
          <EditorCanvas canvas={canvasApi} />
        </div>
        {/* Right dock: tool options + history + layers */}
        <div className="w-96 p-4 flex flex-col gap-3 border-l border-[var(--border)]">
          {(activeTool === "brush" || activeTool === "eraser" || activeTool === "select" || activeTool === "lasso" || activeTool === "transform") && (
            <div className="app-panel p-3 tool-options-panel">
              <ToolOptions canvas={canvasApi} activeLayer={layersApi.activeLayer} activeTool={activeTool} />
            </div>
          )}
          <HistoryPanel history={canvasApi.historyEntries} onUndo={canvasApi.undoLastStroke} onRedo={canvasApi.redoLastAction} />
          <div className="app-panel p-3">
            <FileLoader layersApi={layersApi} />
          </div>
          <LayerPanel
            classNameWrapper="layers-panel"
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
