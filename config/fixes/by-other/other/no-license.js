import * as fs from 'node:fs/promises'
import path from 'node:path'

import { pkgRoot } from '../../../common.js'
import { globby } from 'globby'

/**
 * Check if the repository does not have a license. If the project is not
 * on GitHub, then do not add license files.
 */

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	const files = await globby(['*license*'], { caseSensitiveMatch: false })
	if (files.length === 0) {
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
