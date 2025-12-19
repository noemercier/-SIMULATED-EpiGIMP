"use client"

// Minimal history manager for future expansion.
// Currently only supports storing arbitrary snapshots per layer id.

import { useCallback, useRef } from "react"

export function useHistory() {
	const stacks = useRef<Map<string, ImageData[]>>(new Map())

	const push = useCallback((layerId: string, image: ImageData) => {
		const stack = stacks.current.get(layerId) ?? []
		stack.push(image)
		stacks.current.set(layerId, stack)
	}, [])

	const pop = useCallback((layerId: string) => {
		const stack = stacks.current.get(layerId)
		if (!stack || stack.length === 0) return null
		return stack.pop() ?? null
	}, [])

	const clear = useCallback((layerId?: string) => {
		if (!layerId) stacks.current.clear()
		else stacks.current.delete(layerId)
	}, [])

	return { push, pop, clear }
}

