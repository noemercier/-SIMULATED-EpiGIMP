export function loadImage(file: File): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image()
		img.onload = () => resolve(img)
		img.onerror = reject
		img.src = URL.createObjectURL(file)
	})
}

// Encode a canvas to a 24-bit BMP Blob (bottom-up rows, BGR, padded to 4 bytes per row)
export function canvasToBMPBlob(canvas: HTMLCanvasElement): Blob {
	const w = canvas.width
	const h = canvas.height
	const ctx = canvas.getContext("2d")
	if (!ctx) throw new Error("No 2D context")
	const img = ctx.getImageData(0, 0, w, h)
	const src = img.data
	const bytesPerPixel = 3 // 24-bit
	const rowSize = ((w * bytesPerPixel + 3) & ~3) // pad to 4-byte boundary
	const pixelArraySize = rowSize * h
	const headerSize = 14 // BITMAPFILEHEADER
	const dibHeaderSize = 40 // BITMAPINFOHEADER
	const fileSize = headerSize + dibHeaderSize + pixelArraySize

	const buf = new ArrayBuffer(fileSize)
	const dv = new DataView(buf)
	let offset = 0

	// BITMAPFILEHEADER
	dv.setUint8(offset + 0, 0x42) // 'B'
	dv.setUint8(offset + 1, 0x4d) // 'M'
	dv.setUint32(offset + 2, fileSize, true) // bfSize
	dv.setUint16(offset + 6, 0, true) // bfReserved1
	dv.setUint16(offset + 8, 0, true) // bfReserved2
	dv.setUint32(offset + 10, headerSize + dibHeaderSize, true) // bfOffBits
	offset += headerSize

	// BITMAPINFOHEADER
	dv.setUint32(offset + 0, dibHeaderSize, true) // biSize
	dv.setInt32(offset + 4, w, true) // biWidth
	dv.setInt32(offset + 8, h, true) // biHeight (positive => bottom-up)
	dv.setUint16(offset + 12, 1, true) // biPlanes
	dv.setUint16(offset + 14, 24, true) // biBitCount
	dv.setUint32(offset + 16, 0, true) // biCompression = BI_RGB
	dv.setUint32(offset + 20, pixelArraySize, true) // biSizeImage
	dv.setInt32(offset + 24, 0, true) // biXPelsPerMeter
	dv.setInt32(offset + 28, 0, true) // biYPelsPerMeter
	dv.setUint32(offset + 32, 0, true) // biClrUsed
	dv.setUint32(offset + 36, 0, true) // biClrImportant
	offset += dibHeaderSize

	// Pixel array (bottom-up)
	const pad = rowSize - w * bytesPerPixel
	const row = new Uint8Array(rowSize)
	for (let y = 0; y < h; y++) {
		const srcY = h - 1 - y // bottom-up
		let ri = 0
		for (let x = 0; x < w; x++) {
			const si = (srcY * w + x) * 4
			const r = src[si]
			const g = src[si + 1]
			const b = src[si + 2]
			row[ri++] = b
			row[ri++] = g
			row[ri++] = r
		}
		// pad zeros
		for (let p = 0; p < pad; p++) row[ri++] = 0
		// copy row into buffer
		new Uint8Array(buf, offset, rowSize).set(row)
		offset += rowSize
	}

	return new Blob([buf], { type: "image/bmp" })
}

export function downloadBlob(filename: string, blob: Blob) {
	const url = URL.createObjectURL(blob)
	const a = document.createElement("a")
	a.href = url
	a.download = filename
	a.click()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function canvasToBlob(
	canvas: HTMLCanvasElement,
	type: "image/png" | "image/jpeg" | "image/webp" | "image/avif" = "image/png",
	quality?: number,
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		try {
			canvas.toBlob((blob) => {
				if (!blob) {
					reject(new Error("Failed to create blob"))
					return
				}
				resolve(blob)
			}, type, quality)
		} catch (e) {
			reject(e as Error)
		}
	})
}