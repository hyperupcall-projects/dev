import * as fs from 'node:fs/promises'

import { globby } from 'globby'
import type { Issues } from '#types'

/**
 * Check that the repository does not have a license.
 */

export const issues: Issues = async function* issues() {
	const files = await globby(['*license*', '.github/*readme*'], {
		caseSensitiveMatch: false,
	})
	if (files.length > 0) {
		yield {
			message: [
				'Expected to find no license files',
				`But, ${files.length} license files were found`,
			],
			fix: async () => {
				await Promise.all(files.map((file) => fs.rm(file)))
			},
		}
	}
}
