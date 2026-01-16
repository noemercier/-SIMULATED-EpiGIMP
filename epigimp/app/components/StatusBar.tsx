"use client"

type Props = {
  message?: string
}

export default function StatusBar({ message }: Props) {
  return (
    <div className="h-8 px-3 flex items-center app-topbar text-xs">
      <span>{message ?? "Ready"}</span>
    </div>
  )
}
