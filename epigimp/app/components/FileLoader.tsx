"use client"

import { useRef } from "react"
import type { useLayers } from "../hooks/useLayers"

const SUPPORTED_FORMATS: string[] = ["image/png", "image/jpeg", "image/webp", "image/gif"]

function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.onload = () => resolve(img)
		img.onerror = reject
		img.src = URL.createObjectURL(file)
	})
}

type Props = {
	onImageLoaded?: (img: HTMLImageElement) => void
	layersApi: ReturnType<typeof useLayers>
}

export default function FileLoader({ onImageLoaded, layersApi }: Props) {
	const inputRef = useRef<HTMLInputElement | null>(null)

	const handleChange: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
		const file = e.target.files?.[0]
		if (!file) return
		if (!SUPPORTED_FORMATS.includes(file.type)) {
			alert(`Unsupported format: ${file.type}`)
			return
		}
		try {
			const img = await loadImage(file)
			onImageLoaded?.(img)
			layersApi.addLayerFromImage(img, file.name)
		} catch (err) {
			console.error(err)
			alert("Failed to load image")
		}
	}

	return (
		<div className="p-2">
			<input
				ref={inputRef}
				type="file"
				accept={SUPPORTED_FORMATS.join(",")}
				onChange={handleChange}
				className="sr-only"
			/>
			<button
				className="px-2 py-1 border rounded text-sm hover:bg-zinc-100 dark:hover:bg-zinc-900"
				onClick={() => inputRef.current?.click()}
			>
				Open Image
			</button>
		</div>
	)
}

