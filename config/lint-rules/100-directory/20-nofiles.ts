import type { Issues } from '#types'
import { filesMustHaveContent, filesMustHaveName } from '#common'

/**
 * Check that certain files do not exist.
 */

export const issues: Issues = async function* issues() {
	yield* filesMustHaveName({
		'dev.toml': ['project.toml'],
	})

	yield* filesMustHaveContent({
		'foxxo.toml': null,
	})
}
