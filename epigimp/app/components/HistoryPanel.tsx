"use client"

import React from "react"

type Props = {
  history: { id: string; label: string; time: number }[]
  onUndo: () => void
  onRedo: () => void
}

export default function HistoryPanel({ history, onUndo, onRedo }: Props) {
  return (
    <div className="p-2 app-panel">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold">History</div>
        <div className="flex gap-2">
          <button className="app-icon-btn" title="Undo" aria-label="Undo" onClick={onUndo}>↶</button>
          <button className="app-icon-btn" title="Redo" aria-label="Redo" onClick={onRedo}>↷</button>
        </div>
      </div>
      <ul className="space-y-1 max-h-40 overflow-auto">
        {history.length === 0 && (
          <li className="text-xs opacity-70">No actions yet</li>
        )}
        {history.map((h) => (
          <li key={h.id} className="text-xs opacity-90">
            {new Date(h.time).toLocaleTimeString()} · {h.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
