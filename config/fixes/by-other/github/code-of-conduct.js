// SPDX-License-Identifier: MPL-2.0
import * as fs from 'node:fs/promises'

import { fileExists } from '../../../../fix/util.js'

/** @type {import('../../../../index.js').Issues} */
export const issues = async function* issues() {
	const conductFile = 'CODE_OF_CONDUCT.md'

	if (!(await fileExists(conductFile))) {
		yield {
			title: `The file "${conductFile}" must exist`
		}
	}

	const content = await fs.readFile(conductFile, 'utf-8')
	if (content.startsWith('\n')) {
		yield {
			title: 'Code of Conduct must not start with a newline',
		}
	}
}
