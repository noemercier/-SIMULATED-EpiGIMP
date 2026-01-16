"use client"

import Tooltip from "@/app/components/Tooltip"
import { Brush, Eraser, Move, SquareDashedMousePointer, Crop, RotateCcw, RotateCw, Expand, Pipette, LassoSelect } from "lucide-react"

type Tool = "brush" | "move" | "eraser" | "select" | "lasso" | "transform" | "eyedropper"

type Props = {
  activeTool: Tool
  onSelectTool: (tool: Tool) => void
  // Transform actions
  onCrop: () => void
  onRotateCW: () => void
  onRotateCCW: () => void
  onRotate180: () => void
  onResize: () => void
  hasSelection?: boolean
  canTransform?: boolean
}

const TOOL_TIPS: Record<Tool, string> = {
  brush: "Brush: paint strokes on the active layer",
  eraser: "Eraser: remove pixels from the active layer",
  move: "Move: reposition layer content",
  select: "Select: create a rectangular selection",
  lasso: "Lasso: freehand polygon selection",
  transform: "Transform: resize via corner handles",
  eyedropper: "Eyedropper: pick a color from the canvas",
}

export default function Toolbox({ activeTool, onSelectTool, onCrop, onRotateCW, onRotateCCW, onRotate180, onResize, hasSelection = false, canTransform = true }: Props) {
  const toolBtn = (tool: Tool, icon: React.ReactNode) => (
    <Tooltip key={tool} text={TOOL_TIPS[tool]}>
      <button
        aria-label={TOOL_TIPS[tool]}
        title={TOOL_TIPS[tool]}
        onClick={() => onSelectTool(tool)}
        className={`app-icon-btn ${activeTool === tool ? "active" : ""}`}
      >
        {icon}
      </button>
    </Tooltip>
  )

  const actionBtn = (key: string, icon: React.ReactNode, tip: string, onClick: () => void, disabled = false) => (
    <Tooltip key={key} text={tip}>
      <button
        aria-label={tip}
        title={tip}
        onClick={onClick}
        disabled={disabled}
        className={`app-icon-btn ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {icon}
      </button>
    </Tooltip>
  )

  return (
    <div className="flex flex-col gap-2 p-3 app-panel border-r min-w-12">
      {/* Tools */}
      {toolBtn("brush", <Brush size={18} />)}
      {toolBtn("eraser", <Eraser size={18} />)}
    {toolBtn("move", <Move size={18} />)}
  {toolBtn("select", <SquareDashedMousePointer size={18} />)}
    {toolBtn("lasso", <LassoSelect size={18} />)}
  {toolBtn("transform", <Expand size={18} />)}
    {toolBtn("eyedropper", <Pipette size={18} />)}

      {/* Divider */}
      <div className="my-1 border-t border-zinc-400/60" />
      {/* Transform actions */}
      {actionBtn("crop", <Crop size={18} />, "Crop active layer to current selection", onCrop, !hasSelection || !canTransform)}
      {actionBtn("rotate-ccw", <RotateCcw size={18} />, "Rotate active layer 90° CCW", onRotateCCW, !canTransform)}
      {actionBtn("rotate-cw", <RotateCw size={18} />, "Rotate active layer 90° CW", onRotateCW, !canTransform)}
      {actionBtn("rotate-180", <RotateCw size={18} />, "Rotate active layer 180°", onRotate180, !canTransform)}
      {actionBtn("resize", <Expand size={18} />, "Resize active layer (prompt)", onResize, !canTransform)}
    </div>
  )
}
