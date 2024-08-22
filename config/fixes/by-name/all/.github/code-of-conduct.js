// SPDX-License-Identifier: MPL-2.0
import * as fs from 'node:fs/promises'

import { fileExists } from '../../../../fix/util.js'
import { globby } from 'globby'

/**
 * Check if the code of Conduct file (if it exists) conforms to my standards.
 *
 * If the project is hosted on GitHub, there should be a Code of Conduct file. But,
 * the code of conduct file must exist in the organization's ".github" repository.
 */

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	// TODO
	const content = await fs.readFile(conductFile, 'utf-8')
	if (content.startsWith('\n')) {
		yield {
			message: ['Expected code of conduct to not start with a newline'],
		}
	}
}
