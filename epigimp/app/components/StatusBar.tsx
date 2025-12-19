"use client"

type Props = {
  message?: string
}

export default function StatusBar({ message }: Props) {
  return (
    <div className="h-8 px-3 flex items-center bg-zinc-200 dark:bg-zinc-800 text-xs">
      <span>{message ?? "Ready"}</span>
    </div>
  )
}
