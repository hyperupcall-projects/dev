// SPDX-License-Identifier: MPL-2.0
import * as fs from 'node:fs/promises'

import { globby } from 'globby'
import { findCodeOfConductFiles } from '#common'

/**
 * Check if the code of Conduct file (if it exists) conforms to my standards.
 *
 * If the project is hosted on GitHub, there should be a Code of Conduct file. But,
 * the code of conduct file must exist in the organization's ".github" repository.
 */

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	const files = await findCodeOfConductFiles()

	for (const file of files) {
		const content = await fs.readFile(file, 'utf-8')
		if (content.startsWith('\n')) {
			yield {
				message: ['Expected code of conduct to not start with a newline'],
			}
		}
	}
}
