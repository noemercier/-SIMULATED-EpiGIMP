"use client"
import dynamic from "next/dynamic"

const EditorRoot = dynamic(() => import("../components/EditorRoot").then((m) => m.default), {
  ssr: false,
})

export default function Page() {
  return <EditorRoot />
}
