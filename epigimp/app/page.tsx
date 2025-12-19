"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

export default function Home() {
  const [health, setHealth] = useState<"loading" | "ok" | "error">("loading")

  useEffect(() => {
    let cancelled = false
    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setHealth(d?.status === "ok" ? "ok" : "error")
      })
      .catch(() => !cancelled && setHealth("error"))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen w-full bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <div className="mx-auto max-w-4xl p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold">EpiGIMP</h1>
          <p className="text-zinc-600 dark:text-zinc-400">A local, layer-based image editor built with Next.js</p>
        </header>

        <section className="mb-6 flex items-center gap-3">
          <Link
            href="/editor"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-900"
          >
            Open Editor
          </Link>
          <span className="text-sm">
            Health: {health === "loading" ? "…" : health === "ok" ? "ok" : "error"}
          </span>
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-md border p-4">
            <h2 className="mb-2 text-lg font-medium">Supported formats</h2>
            <ul className="list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              <li>PNG</li>
              <li>JPEG</li>
              <li>WebP</li>
              <li>GIF (first frame)</li>
            </ul>
          </div>
          <div className="rounded-md border p-4">
            <h2 className="mb-2 text-lg font-medium">Basics included</h2>
            <ul className="list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
              <li>Layers with visibility, opacity, blend mode</li>
              <li>Brush tool (size, color, hardness)</li>
              <li>One-step undo for last stroke</li>
              <li>Import images as layers</li>
            </ul>
          </div>
        </section>

        <footer className="mt-10 text-xs text-zinc-500 dark:text-zinc-400">
          Tip: Go to <code>/editor</code> to start drawing.
        </footer>
      </div>
    </div>
  )
}
