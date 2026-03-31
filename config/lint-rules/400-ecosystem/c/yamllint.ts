import { filesMustHaveContent } from '#common'
import type { Issues } from '#types'
import dedent from 'dedent'

export const issues: Issues = async function* issues() {
	const content = dedent`
		---
		extends: default
		rules:
		  document-start: disable\n`

	yield* filesMustHaveContent({ '.yamllint.yaml': content })
}
