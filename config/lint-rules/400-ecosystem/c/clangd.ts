import { filesMustHaveContent } from '#common'
import type { Issues } from '#types'

export const skip = true

export const issues: Issues = async function* issues() {
	const content = `CompileFlags:
  Add: [-xc]\n`

	yield* filesMustHaveContent('clangd', {
		'.clangd': content
	})
}
