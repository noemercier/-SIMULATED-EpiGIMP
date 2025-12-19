"use client"

import { useState } from "react"

type Props = {
  text: string
  children: React.ReactNode
}

export default function Tooltip({ text, children }: Props) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-xs text-white shadow">
          {text}
        </div>
      )}
    </div>
  )
}
