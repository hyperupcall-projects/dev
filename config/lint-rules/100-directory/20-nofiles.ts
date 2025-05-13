import * as fs from 'node:fs/promises'

import { globby } from 'globby'
import type { Issues } from '#types'
import { filesMustHaveContent } from '#common'

/**
 * Check that certain files do not exist.
 */

export const issues: Issues = async function* issues() {
	yield* filesMustHaveContent({
		'foxxo.toml': null,
		'project.toml': null,
	})
}
