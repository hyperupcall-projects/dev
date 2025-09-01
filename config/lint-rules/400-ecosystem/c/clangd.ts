import { filesMustHaveContent } from '#common'
import type { Issues } from '#types'

export const issues: Issues = async function* issues() {
	const content = `CompileFlags:
  Add: [-xc]\n`

	yield* filesMustHaveContent({ '.clangd': content })
}
