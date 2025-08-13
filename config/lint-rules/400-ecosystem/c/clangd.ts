import fs from 'node:fs/promises'
import { fileExists, filesMustHaveContent, filesMustHaveShape } from '#common'
import type { Issues } from '#types'
import dedent from 'dedent'

export const issues: Issues = async function* issues({ project }) {
	const content = `CompileFlags:
  Add: [-xc]\n`

	yield* filesMustHaveContent({ '.clangd': content })
}
