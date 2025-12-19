"use client"

import { useEffect, useRef, useState } from "react"

export type MenuItem = {
  label: string
  onClick: () => void
  disabled?: boolean
  active?: boolean
}

type Props = {
  label: string
  items: MenuItem[]
}

export default function Dropdown({ label, items }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [])

  return (
    <div ref={ref} className="relative select-none">
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
  )}
